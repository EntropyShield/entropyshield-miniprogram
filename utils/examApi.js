// utils/examApi.js
// A-1《散户风控力大考》前端接口封装（62 号活动闭环）
//
// 设计原则（与 seasonApi / pkApi 一致）：
// 1) 全部接口**静默失败** —— 后端未上线 / 网络异常，一律返回 null，前端继续本地流程。
// 2) 分数由服务端按标准答案计算，前端只传选项，无法伪造高分。
// 3) 支持“先考后注册”：无 clientId 时自动生成本地匿名 ID（与 campIntro 同款 ST- 前缀）。
// 4) 不携带、不展示任何收益率 / 盈亏字段。

const { API_BASE } = require('./config.js');

function base() {
  return (typeof wx !== 'undefined' && wx.getStorageSync('API_BASE')) || API_BASE || '';
}

function getClientId() {
  try {
    const app = getApp && getApp();
    return (app && app.globalData && app.globalData.clientId) || wx.getStorageSync('clientId') || '';
  } catch (e) {
    return '';
  }
}

/** 先考后注册：无 clientId 时自动生成匿名本地 ID */
function ensureLocalClientId() {
  let cid = getClientId();
  if (cid) return cid;
  cid = 'ST-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
  try {
    wx.setStorageSync('clientId', cid);
    const app = getApp && getApp();
    if (app && app.globalData) app.globalData.clientId = cid;
  } catch (e) {}
  return cid;
}

function req(url, method, data) {
  return new Promise((resolve) => {
    const b = base();
    if (!b) return resolve(null);
    wx.request({
      url: b + url,
      method: method || 'GET',
      data: data || {},
      timeout: 10000,
      header: { 'content-type': 'application/json' },
      success: (res) => resolve((res && res.data) || null),
      fail: () => resolve(null)
    });
  });
}

/** 出题（不含答案，防作弊） */
function questions() {
  return req('/api/exam/questions', 'GET');
}

/** 交卷：answers=[{qid, opt}]，durationMs=作答毫秒数 */
function submit(answers, durationMs) {
  const cid = ensureLocalClientId();
  if (!cid) return Promise.resolve(null);
  return req('/api/exam/submit', 'POST', {
    clientId: cid,
    answers: answers || [],
    durationMs: durationMs || 0
  });
}

/** 我的成绩：{ best:{score,levelTag}, beatPct, attempts } */
function me() {
  const cid = getClientId();
  if (!cid) return Promise.resolve(null);
  return req('/api/exam/me?clientId=' + encodeURIComponent(cid), 'GET');
}

module.exports = { questions, submit, me, ensureLocalClientId, getClientId };
