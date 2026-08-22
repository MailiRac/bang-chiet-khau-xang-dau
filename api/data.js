const https = require('https');
const XLSX = require('xlsx');

// Link download trực tiếp file Excel từ OneDrive của bạn
const ONEDRIVE_URL = 'https://onedrive.live.com/download?resid=096C933C33A1F25C!s9acf710cbc4b44a39d35c5faeb6b91fc&ithint=file,xlsx';

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Xử lý chuyển hướng nếu có (301, 302, 307)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Tải file thất bại với mã lỗi: ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = async (req, res) => {
  // Cho phép gọi API từ mọi domain (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');

  try {
    const buffer = await fetchBuffer(ONEDRIVE_URL);
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    
    // Lấy sheet đầu tiên
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Đọc dạng ma trận mảng 2 chiều (Header = 1)
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });
    const parsedData = [];

    // Dữ liệu bắt đầu từ dòng 7 (index 6)
    for (let i = 6; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const dateVal = row[1];      // Cột B (index 1): Ngày
      const supplierVal = row[2];  // Cột C (index 2): ĐM / TNPP
      
      if (!dateVal && !supplierVal) continue;

      parsedData.push({
        date: dateVal ? String(dateVal).trim() : '',
        supplier: supplierVal ? String(supplierVal).trim() : '',
        e5: row[4] !== undefined ? String(row[4]).trim() : '',     // Cột E (index 4)
        e10: row[5] !== undefined ? String(row[5]).trim() : '',    // Cột F (index 5)
        do05: row[6] !== undefined ? String(row[6]).trim() : '',   // Cột G (index 6)
        do001: row[7] !== undefined ? String(row[7]).trim() : '',  // Cột H (index 7)
        time: row[8] ? String(row[8]).trim() : '0:00',             // Cột I (index 8)
        region: row[17] ? String(row[17]).trim() : ''              // Cột R (index 17)
      });
    }

    return res.status(200).json({
      success: true,
      total: parsedData.length,
      updatedAt: new Date().toISOString(),
      data: parsedData
    });
  } catch (error) {
    console.error('Lỗi đọc file Excel:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
