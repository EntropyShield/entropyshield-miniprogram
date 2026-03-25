// pages/paymentSuccess/index.js
Page({
  onLoad(options) {
    const opts = options || {};
    const qs = [];
    Object.keys(opts).forEach((k) => {
      const v = opts[k];
      if (v !== undefined && v !== null && String(v) !== '') {
        qs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
      }
    });
    const url = '/pages/paySuccess/index' + (qs.length ? ('?' + qs.join('&')) : '');
    wx.redirectTo({
      url,
      fail() {
        wx.navigateTo({ url });
      }
    });
  }
});