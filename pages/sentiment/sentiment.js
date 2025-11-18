// 市场情绪页面逻辑 (sentiment.js)
const { reportUsageData } = require('../../utils/analytics/dataReporting');

Page({
  data: {
    sentimentData: [],
    categories: [],
    loading: false
  },

  onLoad() {
    this.fetchSentimentData();
  },

  fetchSentimentData() {
    if (this.data.loading) return; // 防止重复请求
    this.setData({ loading: true });

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

          // 数据加载完成，发送数据报告
          reportUsageData('sentiment_data_loaded', { count: res.data.sentiment.length });
        }
      },
      fail: (err) => {
        wx.showToast({
          title: '获取数据失败',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  }
});
