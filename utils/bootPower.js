// utils/bootPower.js - 每日战力值（B 轨）自动领取（66 号 §2）
// 设计：用户每日首次启动即领取平台免费发放的战力值（PK 筹码），零门槛。
// 静默失败：接口不可用 / 未登录 / 未配置域名，一律不阻断启动。
function claimDailyPower() {
  try {
    const app = getApp && getApp();
    const clientId = (app && app.globalData && app.globalData.clientId) || wx.getStorageSync('clientId');
    if (!clientId) return;
    const base = (app && app.globalData && app.globalData.API_BASE) || '';
    if (!base) return;
    wx.request({
      url: base + '/api/power/claim',
      method: 'POST',
      data: { clientId: clientId },
      header: { 'content-type': 'application/json' },
      success: () => {},
      fail: () => {}
    });
  } catch (e) { /* 静默 */ }
}

module.exports = { claimDailyPower };
