// config.js
// MOD: CONFIG_API_BASE_COMPAT_20260102
// Strategy:
// - Default to PROD (https) so preview/real device works.
// - Allow local dev (http://127.0.0.1:3001) only when explicitly enabled in storage AND running in DevTools.

function safeGetAccountInfo() {
  try {
    return wx.getAccountInfoSync && wx.getAccountInfoSync();
  } catch (e) {
    return null;
  }
}

function safeGetSystemInfo() {
  try {
    return wx.getSystemInfoSync && wx.getSystemInfoSync();
  } catch (e) {
    return {};
  }
}

const accountInfo = safeGetAccountInfo();
const envVersion =
  (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.envVersion) || 'release';

const systemInfo = safeGetSystemInfo();
const platform = systemInfo.platform || ''; // devtools / ios / android
const runtime = { platform, envVersion };

// Local dev base (your requirement: port 3001)
const DEV_API_BASE = 'http://127.0.0.1:3001';

// Prod base (your real domain)
const PROD_API_BASE = 'https://api.entropyshaield.com';

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
let API_BASE = PROD_API_BASE;

if (platform === 'devtools') {
  API_BASE = useLocalApi ? DEV_API_BASE : PROD_API_BASE;
} else {
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
