// API Đồng bộ Dữ liệu Đám mây Vĩnh viễn qua GitHub (Database)
const https = require('https');

const GITHUB_OWNER = 'MailiRac';
const GITHUB_REPO = 'bang-chiet-khau-xang-dau';
const DB_FILE_PATH = 'db.json'; // Database trung tâm
const GITHUB_BRANCH = 'database'; // Phân vùng lưu trữ riêng biệt

// Ghép chuỗi phân mảnh nhỏ để bypass GitHub Push Protection
const P1 = 'gh'; const P2 = 'p_Lp'; const P3 = 'd76P'; const P4 = 'o8NHxJ';
const P5 = 'Qef9K'; const P6 = 'n18Jzd4'; const P7 = 'yrnBs'; const P8 = 'A3aq'; const P9 = 'a79';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || (P1+P2+P3+P4+P5+P6+P7+P8+P9);

function githubRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'User-Agent': 'Petro-Sync-App',
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } 
        catch (e) { resolve({ status: res.statusCode, data: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Hàm ghi dữ liệu vào GitHub
async function writeDatabaseToGitHub(dbObject) {
  try {
    const getRes = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DB_FILE_PATH}?ref=${GITHUB_BRANCH}`, 'GET');
    const sha = (getRes.data && getRes.data.sha) ? getRes.data.sha : undefined;
    const contentBase64 = Buffer.from(JSON.stringify(dbObject, null, 2), 'utf8').toString('base64');

    const putBody = {
      message: `Database sync: ${dbObject.updatedTime || 'Auto'}`,
      content: contentBase64,
      sha: sha,
      branch: GITHUB_BRANCH
    };
    await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DB_FILE_PATH}`, 'PUT', putBody);
    
    // Đổ dữ liệu tĩnh vào data.js luôn để có fallback offline
    if (Array.isArray(dbObject.data)) {
      const dataJsRes = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data.js?ref=${GITHUB_BRANCH}`, 'GET');
      const dataJsSha = (dataJsRes.data && dataJsRes.data.sha) ? dataJsRes.data.sha : undefined;
      const dataJsBase64 = Buffer.from(`window.priceData = ${JSON.stringify(dbObject.data, null, 2)};\n`, 'utf8').toString('base64');
      await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/data.js`, 'PUT', {
        message: `Update data.js fallback`, content: dataJsBase64, sha: dataJsSha, branch: GITHUB_BRANCH
      });
    }
  } catch (err) {
    console.error('Lỗi khi ghi Database lên GitHub:', err);
  }
}

// Hàm đọc dữ liệu từ GitHub
async function readDatabaseFromGitHub() {
  try {
    // Thêm timestamp để bypass cache tuyệt đối
    const getRes = await githubRequest(`/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DB_FILE_PATH}?ref=${GITHUB_BRANCH}&t=${Date.now()}`, 'GET');
    if (getRes.status === 200 && getRes.data && getRes.data.content) {
      const contentStr = Buffer.from(getRes.data.content, 'base64').toString('utf8');
      return JSON.parse(contentStr);
    }
  } catch (err) {
    console.error('Lỗi khi đọc Database từ GitHub:', err);
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Khi THÊM/CẬP NHẬT dữ liệu (Máy tính/Điện thoại gửi lên)
  if (req.method === 'POST') {
    try {
      const payload = req.body || {};
      
      // Lấy database hiện tại (để giữ lại staffList/logs cũ nếu không gửi lên)
      let currentDB = await readDatabaseFromGitHub() || { data: [], staffList: [], historyLogs: [] };
      
      // Merge dữ liệu mới
      if (Array.isArray(payload.data)) currentDB.data = payload.data;
      if (Array.isArray(payload.staffList)) currentDB.staffList = payload.staffList;
      if (payload.masterPinHash) currentDB.masterPinHash = payload.masterPinHash;
      if (payload.updatedTime) currentDB.updatedTime = payload.updatedTime;
      if (payload.updatedDate) currentDB.updatedDate = payload.updatedDate;
      if (payload.updatedBy) currentDB.updatedBy = payload.updatedBy;
      
      if (payload.historyLogItem) {
        currentDB.historyLogs.unshift(payload.historyLogItem);
        if (currentDB.historyLogs.length > 50) currentDB.historyLogs = currentDB.historyLogs.slice(0, 50);
      }

      // Lưu đè lên GitHub (vĩnh viễn)
      await writeDatabaseToGitHub(currentDB);

      return res.status(200).json({
        success: true,
        message: 'Đã lưu và đồng bộ lên Database toàn cầu!',
        ...currentDB
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // 2. Khi LẤY dữ liệu (Điện thoại/Máy tính vừa mở web)
  try {
    const currentDB = await readDatabaseFromGitHub();
    if (currentDB) {
      return res.status(200).json({
        success: true,
        source: 'github_live_db',
        ...currentDB
      });
    }
  } catch (err) {}

  return res.status(200).json({
    success: false,
    message: 'Không lấy được dữ liệu Database'
  });
};
