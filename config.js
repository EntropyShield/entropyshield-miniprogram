// config.js (canonical)
// [V2.0-H4] 环境自动切换 + [2026-09-07 修正] 体验版按生产处理
// 规则：release（正式版）永远强制生产环境，任何开关都无法覆盖
// 修正：trial（体验版）同样跑在真机上，localhost 指向手机自身、永远连不上开发者机器，
//       因此必须与 release 一样走生产。此前 trial 会先撞一次 127.0.0.1:3001 再靠
//       app.js 的 health 回落兜底，既慢又依赖兜底逻辑，直接归类更稳。

const DEV_API_BASE = 'http://127.0.0.1:3001';
const PROD_API_BASE = 'https://api.entropyshield.com';

// 本地调试时若需连生产后端，临时改为 true；该开关在 release 环境自动失效
const FORCE_PROD = false;

function currentEnv() {
  try {
    var info = typeof wx !== 'undefined' && wx.getAccountInfoSync && wx.getAccountInfoSync();
    var v = info && info.miniProgram && info.miniProgram.envVersion;
    return v || 'release'; // develop | trial | release
  } catch (e) {
    return 'release'; // 取不到一律按生产处理（最保守）
  }
}

const ENV = currentEnv();
// 正式版 + 体验版强制生产，不受 FORCE_PROD 影响 —— 这是本文件唯一不可绕过的规则
const IS_PROD = ENV === 'release' || ENV === 'trial';

// 正式版强制生产，不受 FORCE_PROD 影响 —— 这是本文件唯一不可绕过的规则
const API_BASE = IS_PROD ? PROD_API_BASE : (FORCE_PROD ? PROD_API_BASE : DEV_API_BASE);

module.exports = { API_BASE, DEV_API_BASE, PROD_API_BASE, ENV, IS_PROD };
