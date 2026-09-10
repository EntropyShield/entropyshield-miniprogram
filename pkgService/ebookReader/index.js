// pkgService/ebookReader/index.js —— 电子书阅读器（web-view 承载阅读页）
Page({
  data: { url: '', title: '' },
  onLoad(query) {
    const url = (query && query.url) ? decodeURIComponent(query.url) : '';
    const title = (query && query.title) ? decodeURIComponent(query.title) : '阅读';
    wx.setNavigationBarTitle({ title });
    this.setData({ url, title });
  },
  noop() {}
});
