Page({
  onLoad(options) {
    const opts = options || {};
    const qs = [];

    Object.keys(opts).forEach((key) => {
      const val = opts[key];
      if (val === null || typeof val === 'undefined' || val === '') return;
      qs.push(
        encodeURIComponent(key) + '=' + encodeURIComponent(String(val))
      );
    });

    if (!Object.prototype.hasOwnProperty.call(opts, 'from')) {
      qs.push('from=' + encodeURIComponent('membership'));
    }

    const url = '/pages/pay/index' + (qs.length ? ('?' + qs.join('&')) : '');

    wx.redirectTo({
      url,
      fail() {
        wx.navigateTo({
          url,
          fail() {
            wx.switchTab({ url: '/pages/index/index' });
          }
        });
      }
    });
  }
});