// app.js
const { API_BASE, ENV, runtime } = require('./config');

App({
  onLaunch() {
    // 1) 启动时强制写入最新 API_BASE，彻底干掉旧缓存/旧兜底
    try {
      wx.setStorageSync('apiBaseUrl', API_BASE);
      wx.setStorageSync('API_BASE', API_BASE);

      console.log('[BOOT] ENV=', ENV, 'platform=', runtime && runtime.platform, 'envVersion=', runtime && runtime.envVersion);
      console.log('[BOOT] API_BASE=', API_BASE);
    } catch (e) {
      console.log('[BOOT] setStorage failed:', e);
    }

    // 2) 健康检查：确认真机/预览/体验版是否成功访问线上域名
    try {
      wx.request({
        url: API_BASE + '/api/health',
        method: 'GET',
        success: (res) => {
          console.log('[BOOT] /api/health ok:', res.data);
        },
        fail: (err) => {
          console.log('[BOOT] /api/health fail:', err);
        }
      });
    } catch (e) {
      console.log('[BOOT] health request exception:', e);
    }

    // 3) 你已有的逻辑（如果后续要加回去，放这里）
    // ... 你已有的逻辑 ...
  },

  globalData: {
    // 统一使用 config.js 解析后的 API_BASE（DevTools=本地3001；真机=线上https）
    baseUrl: API_BASE
  }
});

// --- 防止代码依赖分析忽略管理端页面（开发环境用）---
if (false) {
  require('./pages/visitAdmin/index.js');
}
