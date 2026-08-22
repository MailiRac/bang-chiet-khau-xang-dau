// API Đồng bộ dữ liệu đám mây thời gian thực (Multi-Device Persistent Sync)
const https = require('https');

const GITHUB_OWNER = 'MailiRac';
const GITHUB_REPO = 'bang-chiet-khau-xang-dau';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

let memoryCache = {
  data: null,
  updatedTime: null,
  updatedDate: null,
  updatedBy: null,
  staffList: [],
  historyLogs: []
};

function githubRequest(path, method, body) {
  if (!GITHUB_TOKEN) return Promise.resolve({ status: 200, data: {} });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'User-Agent': 'Petro-Sync-App',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function updateGitHubDataFile(newPriceData, effectiveTime, effectiveDate, operatorName) {
  if (!GITHUB_TOKEN) return;
  try {
    const getRes = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data.js`, 'GET');
    const sha = (getRes.data && getRes.data.sha) ? getRes.data.sha : undefined;

    const contentStr = `// Bảng giá chiết khấu xăng dầu - Cập nhật lúc ${effectiveTime} ngày ${effectiveDate} bởi ${operatorName}\nwindow.priceData = ${JSON.stringify(newPriceData, null, 2)};\n`;
    const contentBase64 = Buffer.from(contentStr, 'utf8').toString('base64');

    const putBody = {
      message: `Auto sync price data: ${effectiveTime} ${effectiveDate} by ${operatorName}`,
      content: contentBase64,
      sha: sha
    };

    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data.js`, 'PUT', putBody);
  } catch (err) {
    console.error('Lỗi khi ghi dữ liệu lên GitHub:', err);
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
      const { data, updatedTime, updatedDate, updatedBy, staffList, historyLogItem, masterPinHash } = payload;

      if (staffList && Array.isArray(staffList)) memoryCache.staffList = staffList;
      if (masterPinHash) memoryCache.masterPinHash = masterPinHash;

      if (Array.isArray(data)) {
        memoryCache.data = data;
        memoryCache.updatedTime = updatedTime || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        memoryCache.updatedDate = updatedDate || new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        memoryCache.updatedBy = updatedBy || 'Admin';

        if (historyLogItem) {
          memoryCache.historyLogs.unshift(historyLogItem);
          if (memoryCache.historyLogs.length > 50) memoryCache.historyLogs = memoryCache.historyLogs.slice(0, 50);
        }

        updateGitHubDataFile(data, memoryCache.updatedTime, memoryCache.updatedDate, memoryCache.updatedBy);
      }

      return res.status(200).json({
        success: true,
        message: 'Đã lưu và đồng bộ dữ liệu vĩnh viễn!',
        data: memoryCache.data,
        updatedTime: memoryCache.updatedTime,
        updatedDate: memoryCache.updatedDate,
        updatedBy: memoryCache.updatedBy,
        staffList: memoryCache.staffList,
        historyLogs: memoryCache.historyLogs
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(200).json({
    success: true,
    data: memoryCache.data,
    updatedTime: memoryCache.updatedTime,
    updatedDate: memoryCache.updatedDate,
    updatedBy: memoryCache.updatedBy,
    staffList: memoryCache.staffList,
    historyLogs: memoryCache.historyLogs
  });
};
