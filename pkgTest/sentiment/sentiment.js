// 市场情绪页面逻辑 (sentiment.js)
const { reportUsageData } = require('../../utils/analytics/dataReporting');
const { API_BASE } = require('../../config'); // ✅ 引入 API_BASE 配置

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

    // 使用动态 API_BASE 构建请求 URL
    const url = `${API_BASE}/api/sentiment`; // ✅ 确保请求 URL 使用 API_BASE

    wx.request({
      url: url, // 使用动态 URL
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
