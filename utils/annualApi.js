// utils/annualApi.js —— A-3 年报晒图节（我的年度风控报告）
// 全部静默失败：失败返回 {ok:false}，绝不阻塞用户流程（与 honorApi 一致）
const { API_BASE } = require('./config.js');

function req(path, method, data) {
  return new Promise((resolve) => {
    wx.request({
      url: API_BASE + path,
      method: method || 'GET',
      data: data || {},
      timeout: 8000,
      header: { 'Content-Type': 'application/json' },
      success: (r) => resolve((r && r.data) || {}),
      fail: () => resolve({ ok: false })
    });
  });
}

function clientId() {
  try {
    return (
      wx.getStorageSync('clientId') ||
      wx.getStorageSync('openid') ||
      (getApp() && getApp().globalData && (getApp().globalData.clientId || getApp().globalData.openid)) ||
      ''
    );
  } catch (e) {
    return '';
  }
}

function inviteCode() {
  try {
    const rights = wx.getStorageSync('userRights') || {};
    return String(rights.inviteCode || '').trim();
  } catch (e) {
    return '';
  }
}

// 年度风控报告聚合数据
function getAnnual() {
  const cid = clientId();
  const q = 'clientId=' + encodeURIComponent(cid);
  return req('/api/points/annual?' + q, 'GET');
}

// 小程序码 URL（复用 /api/fission/qrcode，与首页分享卡一致；无邀请码则回空 → 卡片画占位框）
function buildQrUrl() {
  const code = inviteCode();
  if (!code) return '';
  const base = String(API_BASE || '').replace(/\/+$/, '');
  if (!base) return '';
  let env = 'release';
  try {
    const ai = wx.getAccountInfoSync && wx.getAccountInfoSync();
    env = (ai && ai.miniProgram && ai.miniProgram.envVersion) || 'release';
  } catch (e) {}
  return base +
    '/api/fission/qrcode?inviteCode=' + encodeURIComponent(code) +
    '&env_version=' + encodeURIComponent(env) +
    '&page=' + encodeURIComponent('pages/index/index') +
    '&t=' + Date.now();
}

module.exports = { getAnnual, buildQrUrl, clientId };
