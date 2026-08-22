// Bộ nhớ cache trên server Vercel
let cachedPrices = null;
let cachedTime = null;
let cachedDate = null;
let cachedStaffList = [];
let cachedHistoryLogs = [];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Khi gửi dữ liệu cập nhật (POST)
  if (req.method === 'POST') {
    try {
      const { 
        action, 
        data, 
        updatedTime, 
        updatedDate, 
        updatedBy, 
        staffList, 
        historyLogItem 
      } = req.body;

      // Cập nhật danh sách nhân sự
      if (staffList && Array.isArray(staffList)) {
        cachedStaffList = staffList;
      }

      // Cập nhật bảng giá & ghi log
      if (Array.isArray(data)) {
        cachedPrices = data;
        cachedTime = updatedTime || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        cachedDate = updatedDate || new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        if (historyLogItem) {
          cachedHistoryLogs.unshift(historyLogItem);
          // Giới hạn 50 log gần nhất
          if (cachedHistoryLogs.length > 50) {
            cachedHistoryLogs = cachedHistoryLogs.slice(0, 50);
          }
        }

        return res.status(200).json({
          success: true,
          message: 'Đã nhận và lưu bảng giá thành công!',
          total: data.length,
          updatedTime: cachedTime,
          updatedDate: cachedDate,
          updatedBy: updatedBy || 'Admin'
        });
      }

      // Chỉ cập nhật danh sách staff
      if (action === 'update_staff') {
        return res.status(200).json({
          success: true,
          message: 'Đã cập nhật danh sách nhân sự!',
          staffList: cachedStaffList
        });
      }

      return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ' });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // Khi trang web mở lên để lấy dữ liệu (GET)
  return res.status(200).json({
    success: true,
    data: cachedPrices,
    updatedTime: cachedTime,
    updatedDate: cachedDate,
    staffList: cachedStaffList,
    historyLogs: cachedHistoryLogs
  });
};
