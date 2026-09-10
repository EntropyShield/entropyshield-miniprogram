// utils/honorApi.js —— L3 荣誉墙（69 号 L3 纯展示，非兑换）
// 全部静默失败：失败返回 {ok:false}，绝不阻塞用户流程
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

// 荣誉墙数据：名人堂（总纪律分排名→段位）+ 赛季前 N 名 + 我的名次
function getHonor(limit) {
  const cid = clientId();
  const q = 'clientId=' + encodeURIComponent(cid) + '&limit=' + (limit || 50);
  return req('/api/points/honor?' + q, 'GET');
}

module.exports = { getHonor, clientId };
