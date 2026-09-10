// pkgService/ebookRoom/index.js —— 守护者电子书房（已解锁书目）
const API_BASE = require('../../utils/config.js').API_BASE || 'http://127.0.0.1:3001';
const { clientId } = require('../../utils/pkApi.js');

Page({
  data: {
    loading: true,
    errMsg: '',
    books: []
  },

  onShow() {
    this.loadBooks();
  },

  loadBooks() {
    this.setData({ loading: true, errMsg: '' });
    const cid = clientId();
    wx.request({
      url: API_BASE + '/api/points/ebooks?clientId=' + encodeURIComponent(cid),
      timeout: 8000,
      success: (res) => {
        const d = res.data || {};
        if (d.ok) {
          this.setData({ books: d.list || [], loading: false });
        } else {
          this.setData({ errMsg: d.msg || '加载失败', loading: false });
        }
      },
      fail: () => {
        this.setData({ errMsg: '网络异常，请稍后重试', loading: false });
      }
    });
  },

  onTapBook(e) {
    const url = e.currentTarget.dataset.url || '';
    const title = e.currentTarget.dataset.title || '阅读';
    if (!url) {
      wx.showToast({ title: '内容筹备中', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pkgService/ebookReader/index?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(title) });
  },

  goExchange() {
    wx.navigateTo({ url: '/pkgService/exchange/index' });
  },

  noop() {}
});
