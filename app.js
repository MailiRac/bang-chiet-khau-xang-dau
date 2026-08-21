let priceData = window.priceData || [];
let currentRegion = 'ALL';
let searchQuery = '';

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
  if (priceData.length > 0) {
    dateDisplayEl.textContent = priceData[0].date || '--/--/----';
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
      <td class="center" style="color: var(--text-muted); font-size: 0.85rem;">${row.time || '-'}</td>
      <td class="center">
        <span class="badge-region ${getRegionClass(row.region)}">${row.region || '-'}</span>
      </td>
    </tr>
  `).join('');
}

// Read data directly from Excel sheet via Office.js
async function readDataFromExcel() {
  if (typeof Excel === 'undefined') return;

  try {
    await Excel.run(async (context) => {
      const sheet = context.workbook.worksheets.getActiveWorksheet();
      // Read range from B7 to R200
      const range = sheet.getRange("B7:R200");
      range.load(["text", "values"]);
      await context.sync();

      const rows = range.text;
      const parsedData = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const dateVal = row[0]; // B (Col 1)
        const supplierVal = row[1]; // C (Col 2)
        
        // Stop if row is empty
        if (!dateVal && !supplierVal) continue;

        parsedData.push({
          date: dateVal || '',
          supplier: supplierVal || '',
          e5: row[3] || '',     // E (Col 4, index 3)
          e10: row[4] || '',    // F (Col 5, index 4)
          do05: row[5] || '',   // G (Col 6, index 5)
          do001: row[6] || '',  // H (Col 7, index 6)
          time: row[7] || '0:00', // I (Col 8, index 7)
          region: row[16] || '' // R (Col 17, index 16)
        });
      }

      if (parsedData.length > 0) {
        priceData = parsedData;
        renderFilterButtons();
        renderTable();
      }
    });
  } catch (error) {
    console.error("Lỗi khi đọc dữ liệu từ Excel:", error);
  }
}

// Initialize Office.js or standalone browser
if (typeof Office !== 'undefined' && Office.onReady) {
  Office.onReady((info) => {
    if (info.host === Office.HostType.Excel) {
      console.log("Excel Web Add-in Ready!");
      readDataFromExcel();

      // Listen for changes in Excel sheet to auto-refresh
      Excel.run(async (context) => {
        const sheet = context.workbook.worksheets.getActiveWorksheet();
        sheet.onChanged.add(readDataFromExcel);
        await context.sync();
      });
    } else {
      // Standalone mode
      renderFilterButtons();
      renderTable();
    }
  });
} else {
  // Standalone mode fallback
  renderFilterButtons();
  renderTable();
}

// Search Handler
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderTable();
  });
}

// Refresh Button Handler
if (btnSync) {
  btnSync.addEventListener('click', () => {
    if (typeof Office !== 'undefined' && Office.context && Office.context.host === Office.HostType.Excel) {
      readDataFromExcel();
    } else {
      priceData = window.priceData || [];
      renderFilterButtons();
      renderTable();
    }
  });
}
