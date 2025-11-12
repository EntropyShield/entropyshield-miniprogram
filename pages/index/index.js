Page({
  goToRiskCalculator() {
    wx.navigateTo({
      url: '/pages/riskCalculator/riskCalculator',
    });
  },
  goToSentiment() {
    wx.navigateTo({
      url: '/pages/sentiment/sentiment',
    });
  },
  goToClub() {
    wx.navigateTo({
      url: '/pages/club/club',
    });
  },
});
