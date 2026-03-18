Page({
  data: {
    planName: '会员服务',
    amount: '',
    orderId: '',
    payTime: ''
  },

  onLoad(options) {
    this.setData({
      planName: options.planName ? decodeURIComponent(options.planName) : '会员服务',
      amount: options.amount ? decodeURIComponent(options.amount) : '',
      orderId: options.orderId ? decodeURIComponent(options.orderId) : '',
      payTime: options.payTime ? decodeURIComponent(options.payTime) : ''
    });
  },

  goToCalculator() {
    wx.redirectTo({
      url: '/pages/riskCalculator/index'
    });
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});