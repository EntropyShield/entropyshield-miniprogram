// utils/clientId.js
// [MOD-WX-OPENID-20251230] clientId 统一改为 openid（通过后端 /api/wx/login 换取）
// 兼容旧接口：仍导出 getOrCreateClientId（但现在返回 openid）
// 新增：ensureClientId（推荐在 onLoad 里 await）

const config = require('../config');

const KEY = 'clientId';

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'POST',
      data,
      timeout: 8000,
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

  // 兼容你当前 config.js：API_BASE / BASE_URL 都可
  const base =
    (config && (config.API_BASE || config.BASE_URL || config.apiBaseUrl || config.baseUrl)) || '';

  if (!base) {
    throw new Error('config.js 缺少 API_BASE（本地应为 http://127.0.0.1:3000）');
  }

  const resp = await postJson(`${base}/api/wx/login`, { code: loginRes.code });

  if (!resp || !resp.ok || !resp.openid) {
    throw new Error(`后端 /api/wx/login 失败：${resp ? JSON.stringify(resp) : 'empty resp'}`);
  }

  wx.setStorageSync(KEY, resp.openid);
  return resp.openid;
}

// 兼容旧调用：原来是同步返回 ST-xxx
// 现在：优先返回缓存；没有缓存就触发 ensureClientId 并返回 Promise
function getOrCreateClientId() {
  const cached = wx.getStorageSync(KEY);
  if (cached) return cached;

  // 重要：这里返回 Promise，避免“假装同步”导致身份错乱
  return ensureClientId();
}

// 可选：清理（调试用）
function clearClientId() {
  wx.removeStorageSync(KEY);
}

module.exports = {
  ensureClientId,
  getOrCreateClientId,
  clearClientId
};
