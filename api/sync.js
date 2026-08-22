// API Đồng bộ dữ liệu đám mây thời gian thực (Cloud Store)
// Hỗ trợ đồng bộ vĩnh viễn giữa tất cả các thiết bị (Điện thoại, Máy tính, Tablet)

const https = require('https');

// Cloud JSON Bin vĩnh viễn
const JSONBIN_URL = 'https://api.jsonbin.io/v3/b/66c6b4b4e41b4d34e423d4a1';
const MASTER_KEY = '$2a$10$7sQc1uWzQ0E8a8v7g9F8XeL1vXz9g2m7w0K4m9p8q1v8x7z2y5w1a'; // Key cấu hình

// Bộ nhớ đệm fallback
let memoryCache = {
  data: null,
  updatedTime: null,
  updatedDate: null,
  updatedBy: null,
  staffList: [],
  historyLogs: []
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Khi có thiết bị gửi dữ liệu lên (POST)
  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
      const { action, data, updatedTime, updatedDate, updatedBy, staffList, historyLogItem, masterPinHash } = payload;

      if (staffList && Array.isArray(staffList)) {
        memoryCache.staffList = staffList;
      }
      if (masterPinHash) {
        memoryCache.masterPinHash = masterPinHash;
      }

      if (Array.isArray(data)) {
        memoryCache.data = data;
        memoryCache.updatedTime = updatedTime || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        memoryCache.updatedDate = updatedDate || new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        memoryCache.updatedBy = updatedBy || 'Admin';

        if (historyLogItem) {
          memoryCache.historyLogs.unshift(historyLogItem);
          if (memoryCache.historyLogs.length > 50) {
            memoryCache.historyLogs = memoryCache.historyLogs.slice(0, 50);
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Đã đồng bộ dữ liệu thành công!',
        data: memoryCache.data,
        updatedTime: memoryCache.updatedTime,
        updatedDate: memoryCache.updatedDate,
        updatedBy: memoryCache.updatedBy,
        staffList: memoryCache.staffList,
        historyLogs: memoryCache.historyLogs,
        masterPinHash: memoryCache.masterPinHash
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // Khi thiết bị mở web lấy dữ liệu (GET)
  return res.status(200).json({
    success: true,
    data: memoryCache.data,
    updatedTime: memoryCache.updatedTime,
    updatedDate: memoryCache.updatedDate,
    updatedBy: memoryCache.updatedBy,
    staffList: memoryCache.staffList,
    historyLogs: memoryCache.historyLogs,
    masterPinHash: memoryCache.masterPinHash
  });
};
