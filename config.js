// config.js
// MOD: CONFIG_API_BASE_COMPAT_20260102
// Strategy:
// - Default to PROD (https) so preview/real device works.
// - Allow local dev (http://127.0.0.1:3000) only when explicitly enabled in storage AND running in DevTools.

function safeGetAccountInfo() {
  try {
    return wx.getAccountInfoSync && wx.getAccountInfoSync();
  } catch (e) {
    return null;
  }
}

// [MODIFIED] 使用新的 API 替换 wx.getSystemInfoSync
function safeGetSystemInfo() {
  try {
    // [MODIFIED] 使用 wx.getDeviceInfo 替代 wx.getSystemInfoSync
    const result = wx.getDeviceInfo ? wx.getDeviceInfo() : {};  // 使用新的 API
    return result;
  } catch (e) {
    return {};  // 如果失败，返回空对象
  }
}

const accountInfo = safeGetAccountInfo();
const envVersion =
  (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion) || 'release';

const systemInfo = safeGetSystemInfo();
const platform = systemInfo.platform || ''; // devtools / ios / android
const runtime = { platform, envVersion };

// Local dev base (use the production domain for local testing)
const DEV_API_BASE = 'http://127.0.0.1:3000';  // 本地开发地址 (仅在开发模式下使用)

// Prod base (your real domain)
const PROD_API_BASE = 'https://api.entropyshield.com';  // 正式环境的域名

// Storage toggles (optional)
let useLocalApi = false;
try {
  // Set to '1' to enable local api ONLY in DevTools
  useLocalApi = wx.getStorageSync('useLocalApi') === '1';
} catch (e) {
  useLocalApi = false;
}

// Decide API base
// - Real device / preview / release: always PROD
// - DevTools: PROD by default, local only if useLocalApi=1
let API_BASE = PROD_API_BASE;  // 默认使用生产环境地址

if (platform === 'devtools') {
  // 仅在开发者工具中，并且本地 API 被启用时，使用本地开发地址
  API_BASE = useLocalApi ? DEV_API_BASE : PROD_API_BASE;
} else {
  // 非开发者工具环境，使用正式环境地址
  API_BASE = PROD_API_BASE;
}

// Optional: expose a simple ENV label for logs
const ENV = API_BASE === PROD_API_BASE ? 'prod' : 'dev';

// --- Compatibility aliases (IMPORTANT)
// Some pages may use API_BASE_URL / BASE_URL / API_HOST etc.
// Keep them aligned so old code won't keep hitting localhost.
module.exports = {
  ENV,
  DEV_API_BASE,
  PROD_API_BASE,

  // canonical
  API_BASE,

  // aliases (兼容旧代码写法)
  API_BASE_URL: API_BASE,
  BASE_URL: API_BASE,
  API_HOST: API_BASE,

  runtime
};