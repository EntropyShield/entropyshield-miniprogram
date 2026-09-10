// pkgService/exchange/index.js —— 积分商城（A 轨出侧 L1 权益层 + L2 微信读书礼品卡）
const exchangeApi = require('../../utils/exchangeApi.js');

Page({
  data: {
    balance: 0,
    loading: true,
    list: [],
    myCodes: [],          // 已兑换的礼品卡兑换码 [{sku,name,code}]
    errMsg: '',
    codeModal: { show: false, code: '', name: '' }
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    this.setData({ loading: true, errMsg: '' });
    Promise.all([exchangeApi.catalog(), exchangeApi.balance(), exchangeApi.orders()])
      .then(([cat, bal, ord]) => {
        const list = (cat && cat.list) || [];
        const balance = (bal && bal.ok && typeof bal.total === 'number') ? bal.total : 0;
        const nameMap = {};
        list.forEach((it) => { nameMap[it.sku] = it.name; });
        const myCodes = [];
        const ol = (ord && ord.list) || [];
        ol.forEach((o) => {
          if (o.fulfill_mode === 'gift_card' && o.code) {
            myCodes.push({ sku: o.sku, name: nameMap[o.sku] || o.sku, code: o.code });
          }
        });
        this.setData({ list, balance, myCodes, loading: false });
      })
      .catch(() => {
        this.setData({ loading: false, errMsg: '加载失败，请稍后重试' });
      });
  },

  onRedeem(e) {
    const sku = e.currentTarget.dataset.sku;
    const cost = Number(e.currentTarget.dataset.cost) || 0;
    if (this.data.balance < cost) {
      wx.showToast({ title: '积分不足', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '兑换中', mask: true });
    exchangeApi.redeem(sku).then((r) => {
      wx.hideLoading();
      if (r && r.ok) {
        if (r.fulfill && r.fulfill.mode === 'gift_card') {
          const name = (this.data.list.find((it) => it.sku === sku) || {}).name || '微信读书礼品卡';
          this.setData({ codeModal: { show: true, code: r.fulfill.code, name } });
        } else if (r.fulfill && r.fulfill.mode === 'ebook') {
          wx.showToast({ title: '已解锁，去书房阅读', icon: 'success' });
          setTimeout(() => { wx.navigateTo({ url: '/pkgService/ebookRoom/index' }); }, 900);
        } else {
          wx.showToast({ title: '兑换成功', icon: 'success' });
        }
        this.refresh();
      } else {
        wx.showToast({ title: (r && r.msg) || '兑换失败', icon: 'none' });
      }
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '兑换失败', icon: 'none' });
    });
  },

  copyCode(e) {
    const code = e.currentTarget.dataset.code || '';
    if (!code) return;
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: '兑换码已复制', icon: 'none' })
    });
  },

  closeCodeModal() {
    this.setData({ codeModal: { show: false, code: '', name: '' } });
  },

  goOrders() {
    wx.navigateTo({ url: '/pkgService/redeemOrders/index' });
  },

  goRoom() {
    wx.navigateTo({ url: '/pkgService/ebookRoom/index' });
  },

  goRules() {
    wx.navigateTo({ url: '/pkgService/pointsRules/index' });
  },

  noop() {}
});
