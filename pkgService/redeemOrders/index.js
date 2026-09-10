// pkgService/redeemOrders/index.js —— 我的兑换订单（L1 权益层 + L2 三档）
const exchangeApi = require('../../utils/exchangeApi.js');

Page({
  data: {
    list: [],
    loading: true,
    errMsg: ''
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    this.setData({ loading: true, errMsg: '' });
    exchangeApi.orders()
      .then((res) => {
        if (res && res.ok && Array.isArray(res.list)) {
          this.setData({ list: res.list, loading: false });
        } else {
          this.setData({ errMsg: '加载失败，请稍后重试', loading: false });
        }
      })
      .catch(() => {
        this.setData({ errMsg: '加载失败，请稍后重试', loading: false });
      });
  },

  copyCode(e) {
    const code = e.currentTarget.dataset.code || '';
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '已复制', icon: 'none' })
    });
  },

  goRoom() {
    wx.navigateTo({ url: '/pkgService/ebookRoom/index' });
  }
});