Page({
  onLoad(options) {
    const type = options && options.type ? String(options.type) : '';
    const from = options && options.from ? String(options.from) : 'membership';
    const url =
      '/pages/commissionCenter/index?from=' + encodeURIComponent(from) +
      (type ? '&type=' + encodeURIComponent(type) : '');

    wx.redirectTo({
      url,
      fail() {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  }
});