// config.js (canonical)
// [V2.0-H4] 环境自动切换：按小程序运行环境映射后端地址
// 目的：杜绝"手改 API_BASE 忘改回来 → 生产连到 localhost"的事故
// 规则：release（正式版）永远强制生产环境，任何开关都无法覆盖

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
const IS_PROD = ENV === 'release';

// 正式版强制生产，不受 FORCE_PROD 影响 —— 这是本文件唯一不可绕过的规则
const API_BASE = IS_PROD ? PROD_API_BASE : (FORCE_PROD ? PROD_API_BASE : DEV_API_BASE);

module.exports = { API_BASE, DEV_API_BASE, PROD_API_BASE, ENV, IS_PROD };
