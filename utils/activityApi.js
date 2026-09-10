// utils/activityApi.js
// 活动配置接口：读 /api/activity/config（开关/起止/奖励文案）
// 未建表或网络失败都返回空数组，前端不阻塞、不报错（静默降级，与 seasonApi 一致）

const CONFIG = require('../config.js');

function getConfig() {
  return new Promise((resolve) => {
    const base = (CONFIG && CONFIG.API_BASE) ? CONFIG.API_BASE : '';
    if (!base) return resolve([]);
    wx.request({
      url: base + '/api/activity/config',
      method: 'GET',
      timeout: 6000,
      success(res) {
        const r = res && res.data;
        if (!r || !r.ok || !r.data || !Array.isArray(r.data.activities)) return resolve([]);
        resolve(r.data.activities);
      },
      fail() { resolve([]); }
    });
  });
}

/** 统一活动列表：按 live/upcoming/past 分组（波次 3） */
function getList() {
  return new Promise((resolve) => {
    const base = (CONFIG && CONFIG.API_BASE) ? CONFIG.API_BASE : '';
    if (!base) return resolve({ live: [], upcoming: [], past: [] });
    wx.request({
      url: base + '/api/activity/list',
      method: 'GET',
      timeout: 6000,
      success(res) {
        const r = res && res.data;
        if (!r || !r.ok || !r.data) return resolve({ live: [], upcoming: [], past: [] });
        resolve(r.data);
      },
      fail() { resolve({ live: [], upcoming: [], past: [] }); }
    });
  });
}

/** 单个活动详情（含正文） —— 通用活动页用 */
function getDetail(key) {
  return new Promise((resolve) => {
    const base = (CONFIG && CONFIG.API_BASE) ? CONFIG.API_BASE : '';
    if (!base || !key) return resolve(null);
    wx.request({
      url: base + '/api/activity/detail?key=' + encodeURIComponent(key),
      method: 'GET',
      timeout: 6000,
      success(res) {
        const r = res && res.data;
        resolve(r && r.ok && r.data ? r.data : null);
      },
      fail() { resolve(null); }
    });
  });
}

/** 报名参加（幂等；若活动配了赠课则自动发放解锁券） */
function join(key, clientId) {
  return new Promise((resolve) => {
    const base = (CONFIG && CONFIG.API_BASE) ? CONFIG.API_BASE : '';
    if (!base || !key) return resolve({ ok: false, message: 'no base' });
    wx.request({
      url: base + '/api/activity/join',
      method: 'POST',
      data: { key: key, clientId: clientId || '' },
      timeout: 8000,
      success(res) { resolve(res && res.data ? res.data : { ok: false }); },
      fail() { resolve({ ok: false, message: 'network' }); }
    });
  });
}

module.exports = { getConfig, getList, getDetail, join };
