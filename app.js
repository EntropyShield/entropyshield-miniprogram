// app.js
App({
  onLaunch() {
    // ... 你已有的逻辑 ...
  },
  globalData: {
    // ... 你的全局变量 ...
  }
});

// --- 防止代码依赖分析忽略管理端页面（开发环境用）---
if (false) {
  require('./pages/visitAdmin/index.js');
}
