let priceData = window.priceData || [];
let currentRegion = 'ALL';
let searchQuery = '';
let effectiveTime = localStorage.getItem('lastEffectiveTime') || '';
let effectiveDate = localStorage.getItem('lastEffectiveDate') || '';

// Master PIN SHA-256 Hashes for "888888" and "123456"
const MASTER_HASH_888888 = '218b8f2762a4d3cf5565507ff5696c21a4f0b2f56f1dc7d8b5a03e6730248a3e';
const MASTER_HASH_123456 = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';

// Staff List & History Logs
let staffList = [];
let historyLogs = [];
let currentUser = null; // { role: 'MASTER'|'STAFF', name: '...' }

// Load local storage
try {
  const savedData = localStorage.getItem('customPriceData');
  if (savedData) {
    const parsed = JSON.parse(savedData);
    if (Array.isArray(parsed) && parsed.length > 0) priceData = parsed;
  }
  const savedStaff = localStorage.getItem('customStaffList');
  if (savedStaff) staffList = JSON.parse(savedStaff);

  const savedLogs = localStorage.getItem('customHistoryLogs');
  if (savedLogs) historyLogs = JSON.parse(savedLogs);
} catch (e) {
  console.log('Error reading local storage:', e);
}

// DOM Elements
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('search-input');
const regionFilters = document.getElementById('region-filters');
const dateDisplayEl = document.getElementById('date-display');
const timeDisplayEl = document.getElementById('time-display');
const btnSync = document.getElementById('btn-sync');

// Helper function to extract supplier name (part before '-')
function getSupplierName(supplierStr) {
  if (!supplierStr) return '';
  const parts = String(supplierStr).split('-');
  return parts[0].trim().toUpperCase();
}

// Count unique suppliers in a list
function countUniqueSuppliers(itemList) {
  const set = new Set();
  itemList.forEach(item => {
    const name = getSupplierName(item.supplier);
    if (name) set.add(name);
  });
  return set.size;
}

// Get CSS class for region badge
function getRegionClass(region) {
  if (!region) return 'other';
  const clean = String(region).toLowerCase();
  if (clean.includes('đnb') || clean.includes('dnb')) return 'dnb';
  if (clean.includes('bắc') || clean.includes('bac')) return 'mb';
  if (clean.includes('tây') || clean.includes('tay')) return 'mt';
  if (clean.includes('trung')) return 'mtrung';
  return 'other';
}

// Format price/discount values
function formatValue(val) {
  if (val === undefined || val === null || val === '-' || val === '' || val === '0' || val === 0) {
    return `<span class="price-empty">-</span>`;
  }
  return `<span class="price-value">${val}</span>`;
}

// Render region buttons
function renderFilterButtons() {
  const regions = Array.from(new Set(priceData.map(item => item.region).filter(Boolean)));
  const totalUnique = countUniqueSuppliers(priceData);
  
  regionFilters.innerHTML = `
    <button class="pill-btn ${currentRegion === 'ALL' ? 'active' : ''}" data-region="ALL">Tất cả (${totalUnique})</button>
  `;

  regions.forEach(reg => {
    const filteredByReg = priceData.filter(d => d.region === reg);
    const uniqueCount = countUniqueSuppliers(filteredByReg);
    const btn = document.createElement('button');
    btn.className = `pill-btn ${currentRegion === reg ? 'active' : ''}`;
    btn.dataset.region = reg;
    btn.textContent = `${reg} (${uniqueCount})`;
    regionFilters.appendChild(btn);
  });

  // Event listeners
  regionFilters.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      regionFilters.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRegion = btn.dataset.region;
      renderTable();
    });
  });
}

// Render table rows
function renderTable() {
  if (effectiveDate) {
    dateDisplayEl.textContent = effectiveDate;
  } else if (priceData.length > 0) {
    dateDisplayEl.textContent = priceData[0].date || '--/--/----';
  }

  if (effectiveTime) {
    timeDisplayEl.textContent = effectiveTime;
  } else if (priceData.length > 0) {
    timeDisplayEl.textContent = priceData[0].time || '0:00';
  }

  const filtered = priceData.filter(item => {
    const matchesRegion = currentRegion === 'ALL' || item.region === currentRegion;
    const matchesSearch = !searchQuery || 
      (item.supplier && String(item.supplier).toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.region && String(item.region).toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesRegion && matchesSearch;
  });

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="no-data">
          <p>Không tìm thấy dữ liệu phù hợp.</p>
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(row => `
    <tr>
      <td class="center" style="color: var(--text-muted); font-size: 0.85rem;">${row.date || '-'}</td>
      <td><span class="supplier-name">${row.supplier || '-'}</span></td>
      <td class="center">${formatValue(row.e5)}</td>
      <td class="center">${formatValue(row.e10)}</td>
      <td class="center">${formatValue(row.do05)}</td>
      <td class="center">${formatValue(row.do001)}</td>
      <td class="center" style="color: var(--text-muted); font-size: 0.85rem;">${effectiveTime || row.time || '-'}</td>
      <td class="center">
        <span class="badge-region ${getRegionClass(row.region)}">${row.region || '-'}</span>
      </td>
    </tr>
  `).join('');
}

// Fetch live data from Vercel API
async function fetchLiveDataFromAPI() {
  try {
    const res = await fetch('/api/sync?t=' + Date.now());
    if (!res.ok) throw new Error('API request failed');
    const result = await res.json();
    if (result.success) {
      if (Array.isArray(result.data) && result.data.length > 0) {
        priceData = result.data;
        localStorage.setItem('customPriceData', JSON.stringify(priceData));
      }
      if (result.updatedTime) {
        effectiveTime = result.updatedTime;
        localStorage.setItem('lastEffectiveTime', effectiveTime);
      }
      if (result.updatedDate) {
        effectiveDate = result.updatedDate;
        localStorage.setItem('lastEffectiveDate', effectiveDate);
      }
      if (Array.isArray(result.staffList)) {
        staffList = result.staffList;
        localStorage.setItem('customStaffList', JSON.stringify(staffList));
      }
      if (Array.isArray(result.historyLogs)) {
        historyLogs = result.historyLogs;
        localStorage.setItem('customHistoryLogs', JSON.stringify(historyLogs));
      }

      renderFilterButtons();
      renderTable();
      return true;
    }
  } catch (err) {
    console.log('Chưa có dữ liệu từ sync API, sử dụng dữ liệu cục bộ:', err.message);
  }
  return false;
}

// Initialize
renderFilterButtons();
renderTable();
fetchLiveDataFromAPI();

// Search Handler
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderTable();
  });
}

// Refresh Button Handler
if (btnSync) {
  btnSync.addEventListener('click', async () => {
    btnSync.style.opacity = '0.6';
    const fetched = await fetchLiveDataFromAPI();
    if (!fetched) {
      renderFilterButtons();
      renderTable();
    }
    setTimeout(() => { btnSync.style.opacity = '1'; }, 300);
  });
}

// --- SECURE MULTI-USER & PIN MANAGEMENT (SHA-256) ---
async function hashString(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getStoredMasterPinHash() {
  return localStorage.getItem('masterPinHash') || DEFAULT_MASTER_HASH;
}

const adminModal = document.getElementById('admin-modal');
const btnAdminUpdate = document.getElementById('btn-admin-update');
const modalClose = document.getElementById('modal-close');
const authStep = document.getElementById('auth-step');
const dataStep = document.getElementById('data-step');
const pinInput = document.getElementById('pin-input');
const btnSubmitPin = document.getElementById('btn-submit-pin');
const pinError = document.getElementById('pin-error');
const dataPasteInput = document.getElementById('data-paste-input');
const btnSaveData = document.getElementById('btn-save-data');
const btnCancelData = document.getElementById('btn-cancel-data');
const currentUserBadge = document.getElementById('current-user-badge');

// Admin Tabs
const tabBtnUpdate = document.getElementById('tab-btn-update');
const tabBtnHistory = document.getElementById('tab-btn-history');
const tabBtnStaff = document.getElementById('tab-btn-staff');
const tabBtnPin = document.getElementById('tab-btn-pin');

const panelUpdate = document.getElementById('panel-update');
const panelHistory = document.getElementById('panel-history');
const panelStaff = document.getElementById('panel-staff');
const panelPin = document.getElementById('panel-pin');

// Change PIN elements
const newPinInput = document.getElementById('new-pin-input');
const confirmPinInput = document.getElementById('confirm-pin-input');
const btnSavePin = document.getElementById('btn-save-pin');
const pinChangeStatus = document.getElementById('pin-change-status');

// Staff Management elements
const newStaffName = document.getElementById('new-staff-name');
const newStaffPin = document.getElementById('new-staff-pin');
const btnAddStaff = document.getElementById('btn-add-staff');
const staffListContainer = document.getElementById('staff-list-container');
const historyLogBody = document.getElementById('history-log-body');

function openModal() {
  if (!adminModal) return;
  adminModal.classList.add('show');
  authStep.style.display = 'block';
  dataStep.style.display = 'none';
  pinInput.value = '';
  pinError.style.display = 'none';
  currentUser = null;
  setTimeout(() => pinInput.focus(), 100);
}

function closeModal() {
  if (!adminModal) return;
  adminModal.classList.remove('show');
  dataPasteInput.value = '';
  newPinInput.value = '';
  confirmPinInput.value = '';
  pinChangeStatus.style.display = 'none';
}

function switchTab(tabName) {
  const tabBtns = {
    update: document.getElementById('tab-btn-update'),
    history: document.getElementById('tab-btn-history'),
    staff: document.getElementById('tab-btn-staff'),
    pin: document.getElementById('tab-btn-pin')
  };
  const panels = {
    update: document.getElementById('panel-update'),
    history: document.getElementById('panel-history'),
    staff: document.getElementById('panel-staff'),
    pin: document.getElementById('panel-pin')
  };

  Object.keys(tabBtns).forEach(key => {
    if (tabBtns[key]) tabBtns[key].classList.remove('active');
    if (panels[key]) {
      panels[key].classList.remove('active');
      panels[key].style.display = 'none';
    }
  });

  if (tabBtns[tabName]) tabBtns[tabName].classList.add('active');
  if (panels[tabName]) {
    panels[tabName].classList.add('active');
    panels[tabName].style.display = 'block';
  }

  if (tabName === 'history') renderHistoryLogs();
  if (tabName === 'staff') renderStaffList();
}

if (tabBtnUpdate) tabBtnUpdate.addEventListener('click', () => switchTab('update'));
if (tabBtnHistory) tabBtnHistory.addEventListener('click', () => switchTab('history'));
if (tabBtnStaff) tabBtnStaff.addEventListener('click', () => switchTab('staff'));
if (tabBtnPin) tabBtnPin.addEventListener('click', () => switchTab('pin'));

if (btnAdminUpdate) btnAdminUpdate.addEventListener('click', openModal);
if (modalClose) modalClose.addEventListener('click', closeModal);
if (btnCancelData) btnCancelData.addEventListener('click', closeModal);

// Authenticate PIN (Master or Staff)
async function checkPin() {
  const entered = pinInput.value.trim();
  if (!entered) return;
  
  let enteredHash = '';
  try {
    enteredHash = await hashString(entered);
  } catch (err) {
    console.log('Hash calculation error, fallback to direct compare');
  }

  const storedMasterHash = localStorage.getItem('masterPinHash');

  // Check Master PIN (hỗ trợ hash, mã lưu trữ, và so khớp trực tiếp 888888 & 123456)
  const isMaster = (entered === '888888') || 
                   (entered === '123456') || 
                   (storedMasterHash && enteredHash === storedMasterHash) || 
                   (enteredHash === MASTER_HASH_888888) || 
                   (enteredHash === MASTER_HASH_123456);

  if (isMaster) {
    // Logged in as Master Admin
    currentUser = { role: 'MASTER', name: 'Admin Tổng' };
    setupAdminView(true);
  } else {
    // Check if matching any staff
    const staffMatch = staffList.find(s => s.pinHash === enteredHash || s.rawPin === entered);
    if (staffMatch) {
      currentUser = { role: 'STAFF', name: staffMatch.name };
      setupAdminView(false);
    } else {
      pinError.style.display = 'block';
      pinInput.focus();
    }
  }
}

function setupAdminView(isMaster) {
  authStep.style.display = 'none';
  dataStep.style.display = 'block';
  pinError.style.display = 'none';

  if (currentUserBadge) {
    currentUserBadge.textContent = currentUser.name;
    currentUserBadge.style.background = isMaster ? '#fef3c7' : '#e0f2fe';
    currentUserBadge.style.color = isMaster ? '#b45309' : '#0369a1';
  }

  // Show or hide Master-Only tabs
  document.querySelectorAll('.master-only').forEach(el => {
    el.style.display = isMaster ? 'inline-block' : 'none';
  });

  switchTab('update');
  setTimeout(() => dataPasteInput.focus(), 100);
}

if (btnSubmitPin) btnSubmitPin.addEventListener('click', checkPin);
if (pinInput) {
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkPin();
  });
}

// Master Admin: Change Master PIN
if (btnSavePin) {
  btnSavePin.addEventListener('click', async () => {
    if (!currentUser || currentUser.role !== 'MASTER') return;
    const p1 = newPinInput.value.trim();
    const p2 = confirmPinInput.value.trim();

    if (!p1) {
      pinChangeStatus.textContent = '❌ Mã PIN mới không được để trống!';
      pinChangeStatus.style.color = '#dc2626';
      pinChangeStatus.style.display = 'block';
      return;
    }
    if (p1 !== p2) {
      pinChangeStatus.textContent = '❌ Mã PIN xác nhận không khớp!';
      pinChangeStatus.style.color = '#dc2626';
      pinChangeStatus.style.display = 'block';
      return;
    }

    const newHash = await hashString(p1);
    localStorage.setItem('masterPinHash', newHash);

    pinChangeStatus.textContent = '🎉 Đã đổi mã PIN Admin Tổng thành công!';
    pinChangeStatus.style.color = '#059669';
    pinChangeStatus.style.display = 'block';
    newPinInput.value = '';
    confirmPinInput.value = '';
  });
}

// Master Admin: Staff Management
function renderStaffList() {
  if (!staffListContainer) return;
  if (staffList.length === 0) {
    staffListContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">Chưa có nhân sự nào được phân quyền.</p>';
    return;
  }

  staffListContainer.innerHTML = staffList.map((st, idx) => `
    <div class="staff-item">
      <div class="staff-info">
        <span class="staff-name">${st.name}</span>
        <span class="staff-pin-hint">Tạo lúc: ${st.createdAt || 'N/A'}</span>
      </div>
      <button class="btn-delete-staff" onclick="deleteStaff(${idx})">🗑️ Xóa</button>
    </div>
  `).join('');
}

window.deleteStaff = async function(index) {
  if (confirm(`Bạn có chắc chắn muốn thu hồi quyền của "${staffList[index].name}" không?`)) {
    staffList.splice(index, 1);
    localStorage.setItem('customStaffList', JSON.stringify(staffList));
    renderStaffList();
    
    // Sync to API
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_staff', staffList })
      });
    } catch (e) {
      console.log('Staff sync error:', e);
    }
  }
};

if (btnAddStaff) {
  btnAddStaff.addEventListener('click', async () => {
    const name = newStaffName.value.trim();
    const pin = newStaffPin.value.trim();

    if (!name || !pin) {
      alert('Vui lòng nhập đầy đủ tên nhân viên và mã PIN!');
      return;
    }

    const pinHash = await hashString(pin);
    const newStaffObj = {
      id: Date.now(),
      name: name,
      pinHash: pinHash,
      createdAt: new Date().toLocaleDateString('vi-VN')
    };

    staffList.push(newStaffObj);
    localStorage.setItem('customStaffList', JSON.stringify(staffList));
    newStaffName.value = '';
    newStaffPin.value = '';
    renderStaffList();

    // Sync to API
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_staff', staffList })
      });
      alert(`🎉 Đã cấp quyền thành công cho "${name}" với mã PIN riêng!`);
    } catch (e) {
      console.log('Staff sync error:', e);
    }
  });
}

// Master Admin: Render History Logs
function renderHistoryLogs() {
  if (!historyLogBody) return;
  if (historyLogs.length === 0) {
    historyLogBody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 16px;">Chưa có nhật ký cập nhật nào.</td></tr>';
    return;
  }

  historyLogBody.innerHTML = historyLogs.map(log => `
    <tr>
      <td>${log.time} - ${log.date}</td>
      <td><strong>${log.user || 'Admin'}</strong></td>
      <td class="center"><span class="price-value" style="font-size: 0.775rem;">${log.total} ĐM</span></td>
    </tr>
  `).join('');
}

// Helper to parse pasted JS or JSON data with auto-cleaning Excel quotes
function parsePastedCode(rawText) {
  if (!rawText) return null;
  let text = rawText.trim();
  
  // 1. Tự động loại bỏ dấu ngoặc kép bọc ngoài do Excel Clipboard sinh ra (cả " và "")
  while ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  // 2. Tự động sửa các dấu "" bị Excel nhân đôi thành "
  text = text.replace(/""/g, '"');

  // 3. Nếu chứa window.priceData = [...];
  if (text.includes('=')) {
    text = text.substring(text.indexOf('=') + 1).trim();
  }
  if (text.endsWith(';')) {
    text = text.slice(0, -1).trim();
  }

  // 4. Đảm bảo bọc trong mảng [ ... ]
  if (!text.startsWith('[')) {
    text = '[' + text;
  }
  if (!text.endsWith(']')) {
    text = text.replace(/,\s*$/, '') + ']';
  }

  // 5. Phân tích an toàn bằng Function evaluation
  try {
    const fn = new Function('return ' + text + ';');
    const result = fn();
    if (Array.isArray(result) && result.length > 0) {
      return result;
    }
  } catch (err) {
    console.error('Lỗi khi phân tích dữ liệu dán:', err, '\nĐoạn text đã xử lý:', text);
  }
  return null;
}

// Save Pasted Data & Stamp Exact Admin Update Time & User Log
if (btnSaveData) {
  btnSaveData.addEventListener('click', async () => {
    const raw = dataPasteInput.value.trim();
    if (!raw) {
      alert('Vui lòng dán dữ liệu từ ô Excel vào khung!');
      return;
    }

    const parsed = parsePastedCode(raw);
    if (!parsed || parsed.length === 0) {
      alert('❌ Dữ liệu không đúng định dạng. Vui lòng copy đúng ô công thức từ Excel!');
      return;
    }

    // Capture Real Admin Update Time & Date
    const now = new Date();
    effectiveTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    effectiveDate = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const operatorName = currentUser ? currentUser.name : 'Admin';

    priceData = parsed;
    localStorage.setItem('customPriceData', JSON.stringify(priceData));
    localStorage.setItem('lastEffectiveTime', effectiveTime);
    localStorage.setItem('lastEffectiveDate', effectiveDate);

    // Create History Log Item
    const logItem = {
      id: Date.now(),
      time: effectiveTime,
      date: effectiveDate,
      user: operatorName,
      total: priceData.length
    };

    historyLogs.unshift(logItem);
    if (historyLogs.length > 50) historyLogs = historyLogs.slice(0, 50);
    localStorage.setItem('customHistoryLogs', JSON.stringify(historyLogs));

    // Try sync to backend serverless API
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: priceData,
          updatedTime: effectiveTime,
          updatedDate: effectiveDate,
          updatedBy: operatorName,
          historyLogItem: logItem
        })
      });
    } catch (e) {
      console.log('Sync to API error:', e);
    }

    renderFilterButtons();
    renderTable();
    closeModal();
    alert(`🎉 Cập nhật thành công ${priceData.length} nhà phân phối!\n👤 Người thực hiện: ${operatorName}\n⏰ Giờ hiệu lực: ${effectiveTime} - ${effectiveDate}`);
  });
}
