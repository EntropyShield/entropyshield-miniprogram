// utils/http.js
// MOD: COURSE_HTTP_20251214 - unified request wrapper

const DEFAULT_TIMEOUT = 15000;

function request({ url, method = 'GET', data = {}, header = {} }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header: {
        'content-type': 'application/json',
        ...header
      },
      timeout: DEFAULT_TIMEOUT,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data);
        else reject({ statusCode: res.statusCode, data: res.data });
      },
      fail: (err) => reject(err)
    });
  });
}

module.exports = { request };
