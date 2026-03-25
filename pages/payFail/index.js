// pages/payFail/index.js
Page({
  data: {
    planKey: '',
    errMsg: ''
  },

  onLoad(options) {
    const opts = options || {};
    this.setData({
      planKey: String(opts.planKey || '').trim(),
      errMsg: String(opts.errMsg || '').trim()
    });
    console.log('payfail 页面加载', opts);
  },

  onShow() {
    console.log('payfail 页面显示');
  },

  goPay() {
    wx.redirectTo({
      url: '/pages/pay/index',
      fail() {
        wx.navigateTo({ url: '/pages/pay/index' });
      }
    });
  },

  goCalc() {
    wx.redirectTo({
      url: '/pages/riskCalculator/index',
      fail() {
        wx.navigateTo({ url: '/pages/riskCalculator/index' });
      }
    });
  }
});