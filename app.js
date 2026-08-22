// --- PURE JS SHA-256 (Tương thích 100% mọi trình duyệt di động, Zalo, Safari, Chrome) ---
function sha256_pure(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  var mathPow = Math.pow;
  var maxWord = mathPow(2, 32);
  var lengthProperty = 'length';
  var i, j;
  var result = '';
  var words = [];
  var asciiBitLength = ascii[lengthProperty] * 8;
  var hash = [];
  var k = [];
  var primeCounter = 0;

  var isPrime = function(n) {
    for (var factor = 2; factor * factor <= n; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  ascii += '\x80';
  while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return;
    words[i >> 2] |= j << ((3 - i % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty];) {
    var w = words.slice(j, j += 16);
    var oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2];
      var s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      var s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      var s2 = (i < 16) ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      var ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      var maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      var temp1 = hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + s2;
      var temp2 = (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj;

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (i2 = 3; i2 >= 0; i2--) {
      var c = (hash[i] >> (i2 * 8)) & 255;
      result += ((c < 16) ? '0' : '') + c.toString(16);
    }
  }
  return result;
}

// Helper an toàn cho LocalStorage
const safeStorage = {
  get: function(key) {
    try { return localStorage.getItem(key); } catch(e) { return null; }
  },
  set: function(key, val) {
    try { localStorage.setItem(key, val); } catch(e) {}
  }
};

// Data & State
let priceData = window.priceData || [];
let currentRegion = 'ALL';
let searchQuery = '';
let effectiveTime = safeStorage.get('lastEffectiveTime') || '';
let effectiveDate = safeStorage.get('lastEffectiveDate') || '';

// Master PIN Hashes
const MASTER_HASH_888888 = '218b8f2762a4d3cf5565507ff5696c21a4f0b2f56f1dc7d8b5a03e6730248a3e';
const MASTER_HASH_123456 = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';

let staffList = [];
let historyLogs = [];
let currentUser = null;

// Khởi tạo từ LocalStorage nếu có
try {
  const savedData = safeStorage.get('customPriceData');
  if (savedData) {
    const parsed = JSON.parse(savedData);
    if (Array.isArray(parsed) && parsed.length > 0) priceData = parsed;
  }
  const savedStaff = safeStorage.get('customStaffList');
  if (savedStaff) staffList = JSON.parse(savedStaff);

  const savedLogs = safeStorage.get('customHistoryLogs');
  if (savedLogs) historyLogs = JSON.parse(savedLogs);
} catch (e) {}

// DOM Elements
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('search-input');
const regionFilters = document.getElementById('region-filters');
const dateDisplayEl = document.getElementById('date-display');
const timeDisplayEl = document.getElementById('time-display');
const btnSync = document.getElementById('btn-sync');

function getSupplierName(supplierStr) {
  if (!supplierStr) return '';
  const parts = String(supplierStr).split('-');
  return parts[0].trim().toUpperCase();
}

function countUniqueSuppliers(itemList) {
  const set = new Set();
  itemList.forEach(item => {
    const name = getSupplierName(item.supplier);
    if (name) set.add(name);
  });
  return set.size;
}

function getRegionClass(region) {
  if (!region) return 'other';
  const clean = String(region).toLowerCase();
  if (clean.includes('đnb') || clean.includes('dnb')) return 'dnb';
  if (clean.includes('bắc') || clean.includes('bac')) return 'mb';
  if (clean.includes('tây') || clean.includes('tay')) return 'mt';
  if (clean.includes('trung')) return 'mtrung';
  return 'other';
}

function formatValue(val) {
  if (val === undefined || val === null || val === '-' || val === '' || val === '0' || val === 0) {
    return `<span class="price-empty">-</span>`;
  }
  return `<span class="price-value">${val}</span>`;
}

function renderFilterButtons() {
  if (!regionFilters) return;
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

  regionFilters.querySelectorAll('.pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      regionFilters.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRegion = btn.dataset.region;
      renderTable();
    });
  });
}

function renderTable() {
  if (!tableBody) return;

  if (effectiveDate && dateDisplayEl) {
    dateDisplayEl.textContent = effectiveDate;
  } else if (priceData.length > 0 && dateDisplayEl) {
    dateDisplayEl.textContent = priceData[0].date || '--/--/----';
  }

  if (effectiveTime && timeDisplayEl) {
    timeDisplayEl.textContent = effectiveTime;
  } else if (priceData.length > 0 && timeDisplayEl) {
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

// Fetch live data ngầm từ Server
async function fetchLiveDataFromAPI() {
  try {
    const res = await fetch('/api/sync?t=' + Date.now());
    if (!res.ok) return false;
    const result = await res.json();
    if (result.success) {
      if (Array.isArray(result.data) && result.data.length > 0) {
        priceData = result.data;
        safeStorage.set('customPriceData', JSON.stringify(priceData));
      }
      if (result.updatedTime) {
        effectiveTime = result.updatedTime;
        safeStorage.set('lastEffectiveTime', effectiveTime);
      }
      if (result.updatedDate) {
        effectiveDate = result.updatedDate;
        safeStorage.set('lastEffectiveDate', effectiveDate);
      }
      if (Array.isArray(result.staffList)) {
        staffList = result.staffList;
        safeStorage.set('customStaffList', JSON.stringify(staffList));
      }
      if (Array.isArray(result.historyLogs)) {
        historyLogs = result.historyLogs;
        safeStorage.set('customHistoryLogs', JSON.stringify(historyLogs));
      }

      renderFilterButtons();
      renderTable();
      return true;
    }
  } catch (err) {}
  return false;
}

// Hiển thị ngay lập tức khi load
document.addEventListener('DOMContentLoaded', () => {
  renderFilterButtons();
  renderTable();
  fetchLiveDataFromAPI();
});

// Chạy luôn nếu DOM đã load sẵn
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

// --- ADMIN DASHBOARD & PIN AUTH (Hỗ trợ 100% mobile) ---
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

const tabBtnUpdate = document.getElementById('tab-btn-update');
const tabBtnHistory = document.getElementById('tab-btn-history');
const tabBtnStaff = document.getElementById('tab-btn-staff');
const tabBtnPin = document.getElementById('tab-btn-pin');

const panelUpdate = document.getElementById('panel-update');
const panelHistory = document.getElementById('panel-history');
const panelStaff = document.getElementById('panel-staff');
const panelPin = document.getElementById('panel-pin');

const newPinInput = document.getElementById('new-pin-input');
const confirmPinInput = document.getElementById('confirm-pin-input');
const btnSavePin = document.getElementById('btn-save-pin');
const pinChangeStatus = document.getElementById('pin-change-status');

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
  if (pinChangeStatus) pinChangeStatus.style.display = 'none';
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

// Authenticate PIN (Tương thích 100% mọi trình duyệt)
function checkPin() {
  const entered = pinInput.value.trim();
  if (!entered) return;

  const enteredHash = sha256_pure(entered);
  const storedMasterHash = safeStorage.get('masterPinHash');

  const isMaster = (entered === '888888') || 
                   (entered === '123456') || 
                   (storedMasterHash && enteredHash === storedMasterHash) || 
                   (enteredHash === MASTER_HASH_888888) || 
                   (enteredHash === MASTER_HASH_123456);

  if (isMaster) {
    currentUser = { role: 'MASTER', name: 'Admin Tổng' };
    setupAdminView(true);
  } else {
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

  document.querySelectorAll('.master-only').forEach(el => {
    el.style.display = isMaster ? 'inline-block' : 'none';
  });

  switchTab('update');
  setTimeout(() => dataPasteInput.focus(), 100);
}

if (btnSubmitPin) {
  btnSubmitPin.addEventListener('click', checkPin);
  btnSubmitPin.addEventListener('touchend', (e) => { e.preventDefault(); checkPin(); });
}

if (pinInput) {
  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkPin();
  });
}

// Master Admin: Change PIN
if (btnSavePin) {
  btnSavePin.addEventListener('click', () => {
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

    const newHash = sha256_pure(p1);
    safeStorage.set('masterPinHash', newHash);

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
    safeStorage.set('customStaffList', JSON.stringify(staffList));
    renderStaffList();
    
    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_staff', staffList })
      });
    } catch (e) {}
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

    const pinHash = sha256_pure(pin);
    const newStaffObj = {
      id: Date.now(),
      name: name,
      pinHash: pinHash,
      createdAt: new Date().toLocaleDateString('vi-VN')
    };

    staffList.push(newStaffObj);
    safeStorage.set('customStaffList', JSON.stringify(staffList));
    newStaffName.value = '';
    newStaffPin.value = '';
    renderStaffList();

    try {
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_staff', staffList })
      });
      alert(`🎉 Đã cấp quyền thành công cho "${name}" với mã PIN riêng!`);
    } catch (e) {}
  });
}

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

function parsePastedCode(rawText) {
  if (!rawText) return null;
  let text = rawText.trim();
  
  while ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    text = text.slice(1, -1).trim();
  }

  text = text.replace(/""/g, '"');

  if (text.includes('=')) {
    text = text.substring(text.indexOf('=') + 1).trim();
  }
  if (text.endsWith(';')) {
    text = text.slice(0, -1).trim();
  }

  if (!text.startsWith('[')) {
    text = '[' + text;
  }
  if (!text.endsWith(']')) {
    text = text.replace(/,\s*$/, '') + ']';
  }

  try {
    const fn = new Function('return ' + text + ';');
    const result = fn();
    if (Array.isArray(result) && result.length > 0) {
      return result;
    }
  } catch (err) {
    console.error('Lỗi khi phân tích dữ liệu dán:', err);
  }
  return null;
}

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

    const now = new Date();
    effectiveTime = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    effectiveDate = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const operatorName = currentUser ? currentUser.name : 'Admin';

    priceData = parsed;
    safeStorage.set('customPriceData', JSON.stringify(priceData));
    safeStorage.set('lastEffectiveTime', effectiveTime);
    safeStorage.set('lastEffectiveDate', effectiveDate);

    const logItem = {
      id: Date.now(),
      time: effectiveTime,
      date: effectiveDate,
      user: operatorName,
      total: priceData.length
    };

    historyLogs.unshift(logItem);
    if (historyLogs.length > 50) historyLogs = historyLogs.slice(0, 50);
    safeStorage.set('customHistoryLogs', JSON.stringify(historyLogs));

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
    } catch (e) {}

    renderFilterButtons();
    renderTable();
    closeModal();
    alert(`🎉 Cập nhật thành công ${priceData.length} nhà phân phối!\n👤 Người thực hiện: ${operatorName}\n⏰ Giờ hiệu lực: ${effectiveTime} - ${effectiveDate}`);
  });
}
