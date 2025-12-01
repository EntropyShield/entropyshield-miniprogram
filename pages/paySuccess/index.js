Page({
  data: {
    planName: '专业版 · 月度订阅',
    amount: 999,
    orderId: 'SHD-20251123-0001',
    payTime: '2025-11-23 14:08'
  },

  // 返回风控计算器
  goToCalculator() {
    wx.redirectTo({
      url: '/pages/riskCalculator/index'
    });
  },

  // 返回首页（根据你首页路径调整）
  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});
