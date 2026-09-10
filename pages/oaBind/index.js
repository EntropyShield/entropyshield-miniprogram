// 服务号网页授权绑定页（web-view 容器）
// 由首页「开启温度提醒」触发：静默授权拿到服务号 openid 后自动返回
Page({
  data: { url: '' },
  onLoad(options) {
    const url = decodeURIComponent((options && options.url) || '');
    if (!url) {
      wx.showToast({ title: '参数缺失', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ url });
  },
  onMessage(e) {
    // 授权页 postMessage 回调（部分场景 navigateBack 可能失败，这里兜底）
    const d = (e && e.detail && e.detail.data) || {};
    if (d.type === 'oa_bind_ok') {
      setTimeout(() => wx.navigateBack(), 300);
    }
  },
  onUnload() {
    // 回到首页后刷新绑定状态
    try {
      const pages = getCurrentPages();
      const prev = pages[pages.length - 2];
      if (prev && typeof prev.loadOaPushStatus === 'function') prev.loadOaPushStatus();
    } catch (e) { /* 忽略 */ }
  }
});
