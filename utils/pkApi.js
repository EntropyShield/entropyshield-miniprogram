// utils/pkApi.js —— B 轨战力值 PK 对战 接口封装（68 号）
// 设计：全程静默失败，网络/后端不可达一律返回 null，前端继续本地流程，绝不阻断用户。
const { API_BASE } = require('./config.js');

function base() {
  return (typeof wx !== 'undefined' && wx.getStorageSync('API_BASE')) || API_BASE || '';
}

function req(url, method, data) {
  return new Promise((resolve) => {
    const b = base();
    if (!b) return resolve(null);
    wx.request({
      url: b + url,
      method: method || 'GET',
      data: data || {},
      timeout: 8000,
      header: { 'content-type': 'application/json' },
      success: (res) => resolve((res && res.data) || null),
      fail: () => resolve(null)
    });
  });
}

function clientId() {
  try {
    const app = getApp && getApp();
    return (app && app.globalData && app.globalData.clientId) || wx.getStorageSync('clientId') || '';
  } catch (e) {
    return '';
  }
}

// 战力值余额
function powerBalance(cid) {
  const id = cid || clientId();
  if (!id) return Promise.resolve(null);
  return req('/api/power/balance?clientId=' + encodeURIComponent(id), 'GET');
}

// 守纪者开盘 + 自押（stake：0/50/100）
function open(wardId, stake) {
  const cid = clientId();
  if (!cid) return Promise.resolve(null);
  return req('/api/pk/open', 'POST', { clientId: cid, wardId: wardId || cid, stake: stake || 0 });
}

// 单盘口状态
function pool(wardId, me) {
  const q = '?wardId=' + encodeURIComponent(wardId) + (me ? '&me=' + encodeURIComponent(me) : '');
  return req('/api/pk/pool' + q, 'GET');
}

// 本赛季所有盘口列表（大厅用）
function pools(seasonNo, me) {
  const q = '?seasonNo=' + encodeURIComponent(seasonNo || 'S1') + (me ? '&me=' + encodeURIComponent(me) : '');
  return req('/api/pk/pools' + q, 'GET');
}

// 围观下注
function bet(wardId, side, amount) {
  const cid = clientId();
  if (!cid) return Promise.resolve(null);
  return req('/api/pk/bet', 'POST', { clientId: cid, wardId, side, amount });
}

// 神算子榜（仅纪律数据）
function forecastRank(seasonNo) {
  return req('/api/pk/forecast-rank?seasonNo=' + encodeURIComponent(seasonNo || 'S1'), 'GET');
}

module.exports = { powerBalance, open, pool, pools, bet, forecastRank, clientId };
