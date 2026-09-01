// pages/agreementGate/index.js
// A1 合规首启闸门：首次进入必须阅读并勾选《用户服务协议》《隐私政策》，否则拦截使用。
const STORAGE_KEY = 'agreedTerms';
const STORAGE_AT = 'agreedAt';

function decodeEntry(enc) {
  if (!enc) return '';
  try {
    const s = decodeURIComponent(enc);
    if (typeof s !== 'string' || s.indexOf('/') !== 0) return '';
    if (s.indexOf('agreementGate') >= 0) return ''; // 防止回跳自身造成死循环
    if (s.indexOf('agreementPrivacy') >= 0) return '';
    if (s.indexOf('agreementService') >= 0) return '';
    return s;
  } catch (e) {
    return '';
  }
}

Page({
  data: {
    checked: false,
    privacyUrl: '/pages/agreementPrivacy/index',
    serviceUrl: '/pages/agreementService/index'
  },

  onLoad(options) {
    const entry = decodeEntry(options && options.entry);
    // 落地目标：分享/扫码深链入口；无则回首页
    this.entry = entry || '/pages/index/index';

    try {
      wx.setNavigationBarTitle({ title: '协议确认' });
    } catch (e) {}
  },

  toggleAgree() {
    this.setData({ checked: !this.data.checked });
  },

  openPrivacy() {
    wx.navigateTo({ url: this.data.privacyUrl });
  },

  openService() {
    wx.navigateTo({ url: this.data.serviceUrl });
  },

  onAgree() {
    if (!this.data.checked) return;
    try {
      wx.setStorageSync(STORAGE_KEY, 1);
      wx.setStorageSync(STORAGE_AT, Date.now());
    } catch (e) {}

    const target = this.entry || '/pages/index/index';
    wx.reLaunch({ url: target });
  },

  onDecline() {
    // 暂不使用：退出小程序（合规要求必须提供退出路径）
    try {
      wx.exitMiniProgram({
        success() {},
        fail() {}
      });
    } catch (e) {}
  }
});
