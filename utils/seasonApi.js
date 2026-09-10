// utils/seasonApi.js
// 30 天守纪挑战赛 后端接口封装（62 号 Phase 1）
//
// 设计原则：
// 1) 全部接口**静默失败** —— 后端未上线 / 表不存在 / 网络异常，一律返回 null，
//    前端继续走本地流程，绝不因接口问题阻断用户使用。
// 2) 不在本文件做任何会员态判断（付费不得影响成绩，62 号第一红线）。
// 3) 不携带收益率、盈亏等字段。

const { API_BASE } = require('./config.js');

function base() {
  return (typeof wx !== 'undefined' && wx.getStorageSync('API_BASE')) || API_BASE || '';
}

function req(url, method, data) {
  return new Promise((resolve) => {
    const b = base();
    if (!b) return resolve(null);
    wx.request({
      url: b + url,
      method: method || 'GET',
      data: data || {},
      timeout: 8000,
      success: (res) => {
        const d = res && res.data;
        resolve(d && d.ok ? d : null);
      },
      fail: () => resolve(null)
    });
  });
}

function clientId() {
  try {
    const app = getApp && getApp();
    return (
      (app && app.globalData && app.globalData.clientId) ||
      wx.getStorageSync('clientId') ||
      ''
    );
  } catch (e) {
    return '';
  }
}

/** 当前赛季配置 */
function current() {
  return req('/api/season/current', 'GET');
}

/** 加入赛季（幂等） */
function join(promise) {
  const cid = clientId();
  if (!cid) return Promise.resolve(null);
  return req('/api/season/join', 'POST', { clientId: cid, promise: promise || 'A' });
}

/**
 * 每日守纪判定
 * @param {boolean} selfOk 自评结果（主链无数据时后端采用）
 * @param {string} date YYYY-MM-DD
 * @param {boolean} useExempt 未守住时是否消耗一个豁免日（不达成、也不算破戒）
 *
 * 后端可能返回：
 *   { ok:true, skipped:true, reason:'non-trading-day' }  休市日，不计入判定
 *   { ok:true, passed, source, exemptUsed, exemptLeft }
 */
function check(selfOk, date, useExempt) {
  const cid = clientId();
  if (!cid) return Promise.resolve(null);
  return req('/api/season/check', 'POST', {
    clientId: cid,
    date: date || '',
    selfOk: !!selfOk,
    useExempt: !!useExempt
  });
}

/** 我的赛季进度 */
function progress() {
  const cid = clientId();
  if (!cid) return Promise.resolve(null);
  return req('/api/season/progress?clientId=' + encodeURIComponent(cid), 'GET');
}

/** 赛季结算（幂等） */
function settle() {
  const cid = clientId();
  if (!cid) return Promise.resolve(null);
  return req('/api/season/settle', 'POST', { clientId: cid });
}

module.exports = { current, join, check, progress, settle };
