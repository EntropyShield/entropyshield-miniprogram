// utils/clientId.js
// clientId 统一改为 openid（通过后端 /api/wx/login 换取）
// 兼容旧接口：仍导出 getOrCreateClientId（但现在返回 openid）
// 新增：ensureClientId（推荐在 onLoad 里 await）

const config = require('../config');
const KEY = 'clientId';

function getRuntimeApiBase() {
  // [PATCH-API-BASE-PRIORITY] 优先 Storage，其次 globalData，再其次 config
  try {
    const s1 = wx.getStorageSync('API_BASE') || '';
    if (s1) return String(s1).replace(/\/$/, '');
  } catch (e) {}
  try {
    const s2 = wx.getStorageSync('apiBaseUrl') || '';
    if (s2) return String(s2).replace(/\/$/, '');
  } catch (e) {}

  try {
    const app = getApp ? getApp() : null;
    const gd = app && app.globalData ? app.globalData : null;
    const g = gd && (gd.API_BASE || gd.baseUrl);
    if (g) return String(g).replace(/\/$/, '');
  } catch (e) {}

  const base =
    (config && (config.API_BASE || config.BASE_URL || config.apiBaseUrl || config.baseUrl || config.PROD_API_BASE || config.DEV_API_BASE)) || '';
  return String(base || '').replace(/\/$/, '');
}

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'POST',
      data,
      timeout: 10000,
      header: { 'Content-Type': 'application/json' },
      success: (res) => resolve(res.data),
      fail: reject
    });
  });
}

// 推荐：异步确保 clientId（openid）存在
async function ensureClientId(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = wx.getStorageSync(KEY);
    if (cached) return cached;
  }

  const loginRes = await new Promise((resolve, reject) => {
    wx.login({ success: resolve, fail: reject });
  });

  if (!loginRes.code) throw new Error('wx.login 没有返回 code');

  const base = getRuntimeApiBase();
  if (!base) throw new Error('缺少 API_BASE（Storage/globalData/config 均未取到）');

  const resp = await postJson(`${base}/api/wx/login`, { code: loginRes.code });

  if (!resp || !resp.ok || !resp.openid) {
    throw new Error(`后端 /api/wx/login 失败：${resp ? JSON.stringify(resp) : 'empty resp'}`);
  }

  wx.setStorageSync(KEY, resp.openid);
  return resp.openid;
}

function getOrCreateClientId() {
  const cached = wx.getStorageSync(KEY);
  if (cached) return cached;
  // 返回 Promise，避免假同步
  return ensureClientId();
}

function clearClientId() {
  wx.removeStorageSync(KEY);
}

module.exports = {
  ensureClientId,
  getOrCreateClientId,
  clearClientId
};