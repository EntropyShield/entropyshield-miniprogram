// utils/exchangeApi.js —— 积分兑换（A 轨出侧，69 号 L1 闭环）
// 全部静默失败：失败返回 null / {ok:false}，绝不阻塞用户流程
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

// 兑换目录（status=1）
function catalog() {
  return req('/api/points/catalog', 'GET');
}

// 我的积分余额
function balance() {
  const cid = clientId();
  if (!cid) return Promise.resolve({ ok: false });
  return req('/api/points/me?clientId=' + encodeURIComponent(cid), 'GET');
}

// 兑换
function redeem(sku) {
  const cid = clientId();
  if (!cid) return Promise.resolve({ ok: false, msg: '未登录' });
  return req('/api/points/redeem', 'POST', { clientId: cid, sku });
}

// 我的兑换订单
function orders() {
  const cid = clientId();
  if (!cid) return Promise.resolve({ ok: false });
  return req('/api/points/orders?clientId=' + encodeURIComponent(cid), 'GET');
}

module.exports = { catalog, balance, redeem, orders, clientId };
