Page({
  retryPay() {
    // 返回支付页重新发起
    wx.redirectTo({
      url: '/pages/pay/index'
    });
  },

  goBack() {
    wx.navigateBack({
      delta: 1
    });
  }
});
