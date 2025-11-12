Page({
  data: {
    sentimentData: [],
    categories: []
  },

  onLoad() {
    this.fetchSentimentData();
  },

  fetchSentimentData() {
    // 假设接口返回的数据结构
    wx.request({
      url: 'https://example.com/api/sentiment', // 假设API
      method: 'GET',
      success: (res) => {
        if (res.data) {
          this.setData({
            sentimentData: res.data.sentiment,
            categories: res.data.categories
          });
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '获取数据失败',
          icon: 'none'
        });
      }
    });
  }
});
