// config.js
// 统一管理后端 API 地址，方便切换本地 / 线上环境

// 当前环境：'dev' | 'prod'
// 上线前只需要把 ENV 改成 'prod'，并配置好 PROD_API_BASE 即可
const ENV = 'dev';

// 本地调试用
const DEV_API_BASE = 'http://localhost:3000';

// 线上正式环境（占位，等你有正式域名后改成真实地址）
const PROD_API_BASE = 'https://your-api-domain.com';

const API_BASE = ENV === 'prod' ? PROD_API_BASE : DEV_API_BASE;

module.exports = {
  API_BASE
};
