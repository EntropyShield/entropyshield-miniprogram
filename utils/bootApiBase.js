// utils/bootApiBase.js —— 启动时 API_BASE 解析与后端健康探测
const { appDebug } = require('./bootDebug');

const PROD_API_BASE = 'https://api.entropyshield.com';

function resolveApiBase(configBase) {
  let sys = {};
  let isDevtools = false;
  try {
    sys = (wx.getWindowInfo && wx.getWindowInfo()) || ((wx.getDeviceInfo && Object.assign({}, wx.getDeviceInfo(), wx.getAppBaseInfo ? wx.getAppBaseInfo() : {}, wx.getSystemSetting ? wx.getSystemSetting() : {})) || {});
    isDevtools = !!(sys && sys.platform === 'devtools');
  } catch (e) {}

  const cfgBase = String(configBase || '').trim().replace(/\/$/, '');
  let resolved = cfgBase || PROD_API_BASE;

  try {
    const stBase = String(wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '').trim().replace(/\/$/, '');
    if (isDevtools && stBase) resolved = stBase;
  } catch (e) {}

  if (!isDevtools) resolved = cfgBase || PROD_API_BASE;

  try {
    wx.setStorageSync('API_BASE', resolved);
    wx.setStorageSync('apiBaseUrl', resolved);
  } catch (e) {}

  return resolved;
}

function healthCheck({ base, app }) {
  const prodBase = PROD_API_BASE;
  const fallbackToProd = (reason) => {
    if (base === prodBase) return;
    appDebug('[BOOT][FALLBACK] ' + reason + ' —— 回落生产后端:', prodBase);
    base = prodBase;
    try {
      app.globalData = app.globalData || {};
      app.globalData.API_BASE = prodBase;
      app.globalData.baseUrl = prodBase;
    } catch (e) {}
    try {
      wx.setStorageSync('API_BASE', prodBase);
      wx.setStorageSync('apiBaseUrl', prodBase);
    } catch (e) {}
  };

  try {
    wx.request({
      url: base + '/api/health',
      method: 'GET',
      timeout: 5000,
      success: (res) => {
        const code = res && res.statusCode;
        const ok = code >= 200 && code < 300;
        appDebug('[BOOT] /api/health ' + (ok ? 'ok' : 'HTTP ' + code));
        if (!ok) fallbackToProd('health 返回 HTTP ' + code);
      },
      fail: (err) => {
        appDebug('[BOOT] /api/health fail:', err && err.errMsg);
        fallbackToProd('health 请求失败(' + String((err && err.errMsg) || 'unknown') + ')');
      }
    });
  } catch (e) {
    appDebug('[BOOT] health request exception:', e);
  }
}

module.exports = { resolveApiBase, healthCheck, PROD_API_BASE };
