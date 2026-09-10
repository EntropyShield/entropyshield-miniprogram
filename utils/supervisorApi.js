// utils/supervisorApi.js
// 守纪见证人（守纪督察官体系）前端统一封装
// 后端：/api/supervisor（routes/v2supervisor.js）
// 🔴 合规：只返回纪律数据，绝不含持仓/盈亏
const cfg = require('../config.js');

function getApiBase() {
  try {
    const s1 = wx.getStorageSync('API_BASE') || '';
    if (s1) return String(s1).replace(/\/$/, '');
  } catch (e) {}
  try {
    const app = getApp && getApp();
    const gd = (app && app.globalData) || {};
    const base =
      gd.API_BASE ||
      gd.API_BASE_URL ||
      cfg.API_BASE ||
      cfg.API_BASE_URL ||
      cfg.PROD_API_BASE ||
      cfg.DEV_API_BASE ||
      '';
    return String(base || '').replace(/\/$/, '');
  } catch (e) {
    return '';
  }
}

function getClientId() {
  try {
    const app = getApp && getApp();
    const gd = (app && app.globalData) || {};
    if (gd.clientId) return String(gd.clientId);
    if (gd.openid) return String(gd.openid);
  } catch (e) {}
  const keys = ['clientId', 'openid', 'CLIENT_ID'];
  for (let i = 0; i < keys.length; i++) {
    try {
      const v = wx.getStorageSync(keys[i]);
      if (v) return String(v);
    } catch (e) {}
  }
  return '';
}

function req(url, method, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: method || 'GET',
      data,
      header: { 'content-type': 'application/json' },
      success: (r) => resolve(r.data),
      fail: reject
    });
  });
}

const GRADE_MAP = {
  rookie: '见习守纪者',
  bronze: '铜牌守纪者',
  silver: '银牌守纪者',
  gold: '金牌守纪者',
  diamond: '钻石守纪者'
};
function gradeText(g) {
  return GRADE_MAP[String(g || 'rookie')] || String(g || '见习守纪者');
}

function getProfile(cid) {
  return req(`${getApiBase()}/api/supervisor/profile?clientId=${encodeURIComponent(cid)}`);
}
function getInvite(cid) {
  return req(`${getApiBase()}/api/supervisor/invite`, 'POST', { wardId: cid });
}
function getList(cid) {
  return req(`${getApiBase()}/api/supervisor/list?clientId=${encodeURIComponent(cid)}`);
}
function getWards(cid) {
  return req(`${getApiBase()}/api/supervisor/wards?clientId=${encodeURIComponent(cid)}`);
}
function joinWitness(cid, code) {
  return req(`${getApiBase()}/api/supervisor/join`, 'POST', { supervisorId: cid, code });
}
function getWall(page, pageSize) {
  return req(`${getApiBase()}/api/supervisor/wall?page=${page}&pageSize=${pageSize}`);
}

module.exports = {
  getApiBase,
  getClientId,
  req,
  gradeText,
  getProfile,
  getInvite,
  getList,
  getWards,
  joinWitness,
  getWall
};
