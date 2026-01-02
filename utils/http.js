// utils/http.js
// MOD: HTTP_UNIFIED_20260102
const { API_BASE } = require('../config');

/**
 * 统一 request 封装
 * - 自动拼接 API_BASE
 * - 默认 JSON
 * - 返回 Promise
 */
function request({ url, method = 'GET', data = {}, header = {}, timeout = 15000 }) {
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;

  return new Promise((resolve, reject) => {
    wx.request({
      url: fullUrl,
      method,
      data,
      timeout,
      header: {
        'Content-Type': 'application/json',
        ...header
      },
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    });
  });
}

function get(url, data = {}, options = {}) {
  return request({ url, method: 'GET', data, ...options });
}

function post(url, data = {}, options = {}) {
  return request({ url, method: 'POST', data, ...options });
}

module.exports = {
  request,
  get,
  post
};
