// app.js
App({
  onLaunch() {
    // ... 你已有的逻辑 ...
  },
  globalData: {
    // MOD: GLOBAL_BASE_URL_20251214
    // 开发环境：DevTools 可用 localhost；真机请改成你电脑局域网 IP，例如：http://192.168.1.8:3000
    baseUrl: wx.getStorageSync('apiBaseUrl') || 'http://localhost:3000'
  }
});

// --- 防止代码依赖分析忽略管理端页面（开发环境用）---
if (false) {
  require('./pages/visitAdmin/index.js');
}
