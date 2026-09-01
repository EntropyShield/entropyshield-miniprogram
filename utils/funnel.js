// utils/funnel.js
// 埋点工具：本地记录 + [V2.0-H2] 服务端批量上传
//
// 背景（10 号代码体检结论）：原有实现只写 storage，从不上传 —— 埋点了等于没埋。
// 本次改造保留全部对外 API（log/getLogs/clearLogs）不变，只新增"上传层"，
// 因此所有已有调用点零修改即可自动获得上传能力。
//
// 【为什么这是 V2.0 第一优先级】
// 18 号审计闭环要求证明"参与组纪律执行率提升 X 个百分点"，对照组/基线必须在
// 改造前采集。V2.0 上线后老基线永久消失，故本文件的上传能力必须在 9/1 部署。

// ====== [MOD:FUNNEL_DEBUG_SILENT_20260330] START ======
const __FUNNEL_DEBUG__ = false;
function funnelDebug() {
  if (!__FUNNEL_DEBUG__) return;
  try {
    console.log.apply(console, arguments);
  } catch (e) {}
}
// ====== [MOD:FUNNEL_DEBUG_SILENT_20260330] END ======

const CONFIG = require('../config.js');

const STORAGE_KEY = 'payFunnelLogs';      // 历史本地日志（兼容保留）
const QUEUE_KEY = 'esTrackQueue';         // 待上传队列
const ANON_ID_KEY = 'esAnonId';           // 匿名设备标识
const LAST_OPEN_DATE_KEY = 'esLastOpenDate';
const FAIL_STREAK_KEY = 'esTrackFailStreak';

const SCHEMA_VERSION = 1;
const FLUSH_THRESHOLD = 20;   // 队列达到该条数触发上传
const FLUSH_INTERVAL = 60000; // 兜底定时上传间隔
const MAX_QUEUE = 500;        // 队列上限，防止撑爆 storage
const BATCH_SIZE = 100;       // 单次上传条数
const MAX_FAIL_STREAK = 3;    // 连续失败达此值进入冷却，停止无效请求

// 隐私红线：这些 key 一律不上传（持仓/价格/标的是敏感信息，12 号合规报告）
const SENSITIVE_KEYS = [
  'price', 'code', 'stock', 'amount', 'capital', 'cost',
  'stopLoss', 'target', 'position', 'shares', 'balance'
];

let flushTimer = null;

/**
 * 取（或生成）匿名标识。不采集 openid / 手机号 / 任何身份信息。
 */
function getAnonId() {
  try {
    let id = wx.getStorageSync(ANON_ID_KEY);
    if (!id) {
      id = 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      wx.setStorageSync(ANON_ID_KEY, id);
    }
    return id;
  } catch (e) {
    return 'unknown';
  }
}

/**
 * 脱敏：剔除业务方误传的敏感字段，只保留行为元数据。
 */
function sanitizeExt(ext) {
  const safe = {};
  if (!ext || typeof ext !== 'object') return safe;
  Object.keys(ext).forEach(function (k) {
    const lower = String(k).toLowerCase();
    let risky = false;
    for (let i = 0; i < SENSITIVE_KEYS.length; i++) {
      if (lower.indexOf(SENSITIVE_KEYS[i].toLowerCase()) >= 0) { risky = true; break; }
    }
    if (risky) return;
    const v = ext[k];
    const t = typeof v;
    if (t === 'string' || t === 'number' || t === 'boolean') safe[k] = v;
  });
  return safe;
}

function pushToQueue(record) {
  try {
    let q = wx.getStorageSync(QUEUE_KEY) || [];
    q.push(record);
    if (q.length > MAX_QUEUE) q = q.slice(q.length - MAX_QUEUE);
    wx.setStorageSync(QUEUE_KEY, q);
    return q.length;
  } catch (e) {
    return 0;
  }
}

function restoreFront(batch) {
  try {
    const q = wx.getStorageSync(QUEUE_KEY) || [];
    wx.setStorageSync(QUEUE_KEY, batch.concat(q).slice(0, MAX_QUEUE));
  } catch (e) {}
}

function inCooldown() {
  try {
    return (wx.getStorageSync(FAIL_STREAK_KEY) || 0) >= MAX_FAIL_STREAK;
  } catch (e) {
    return false;
  }
}

function markFail() {
  try {
    wx.setStorageSync(FAIL_STREAK_KEY, (wx.getStorageSync(FAIL_STREAK_KEY) || 0) + 1);
  } catch (e) {}
}

function clearFail() {
  try { wx.setStorageSync(FAIL_STREAK_KEY, 0); } catch (e) {}
}

/**
 * 上报一批事件。全部异常静默 —— 埋点绝不能影响业务。
 * @param {boolean} force 是否忽略条数阈值立即上报
 */
function flush(force) {
  try {
    if (inCooldown()) return;
    const q = wx.getStorageSync(QUEUE_KEY) || [];
    if (!q.length) return;
    if (!force && q.length < FLUSH_THRESHOLD) return;

    const batch = q.slice(0, BATCH_SIZE);
    wx.setStorageSync(QUEUE_KEY, q.slice(BATCH_SIZE));

    wx.request({
      url: CONFIG.API_BASE + '/api/track/batch',
      method: 'POST',
      data: {
        v: SCHEMA_VERSION,
        anonId: getAnonId(),
        env: CONFIG.ENV,
        events: batch
      },
      timeout: 8000,
      success: function (res) {
        if (res && res.statusCode >= 200 && res.statusCode < 300) {
          clearFail();
          funnelDebug('[funnel.flush] 上报成功', batch.length, '条');
        } else {
          restoreFront(batch); markFail();
        }
      },
      fail: function () { restoreFront(batch); markFail(); }
    });
  } catch (e) {
    funnelDebug('[funnel.flush] 异常：', e);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setInterval(function () { flush(false); }, FLUSH_INTERVAL);
}

/**
 * 记录一个漏斗事件（对外 API 不变，内部新增入队上传）
 * @param {string} step - 步骤名称
 * @param {object} ext  - 额外信息（敏感字段会被自动剔除）
 */
function log(step, ext = {}) {
  try {
    const now = Date.now();

    // 兼容原有本地日志
    const logs = wx.getStorageSync(STORAGE_KEY) || [];
    logs.push({ step, ext, ts: now });
    // 本地日志同样设上限，避免长期累积拖慢 storage 读写
    if (logs.length > 1000) logs.splice(0, logs.length - 1000);
    wx.setStorageSync(STORAGE_KEY, logs);

    // [V2.0] 入上传队列
    const pages = (typeof getCurrentPages === 'function') ? getCurrentPages() : [];
    const cur = pages.length ? pages[pages.length - 1] : null;
    pushToQueue({
      step: step,
      ext: sanitizeExt(ext),
      ts: now,
      path: cur ? (cur.route || '') : ''
    });

    if ((wx.getStorageSync(QUEUE_KEY) || []).length >= FLUSH_THRESHOLD) flush(true);
    scheduleFlush();

    // 控制台展示用副本（保持原有行为）
    const displayExt = { ...ext };
    if (displayExt.levelName && typeof displayExt.levelName === 'string') {
      try { displayExt.levelName = decodeURIComponent(displayExt.levelName); } catch (e) {}
    }
    funnelDebug('[FUNNEL_LOG]', { step, ext: displayExt, ts: now });
  } catch (e) {
    funnelDebug('[funnel.log] 写入本地埋点失败：', e);
  }
}

/**
 * 【基线指标专用】每日首次启动打点。
 * 用途：计算改造前的次日/7日留存基线 —— 这是审计闭环唯一不可逆的数据。
 * 调用时机：app.js onLaunch / onShow（待 27 个未提交改动确认后再挂载）
 */
function trackDailyOpen() {
  try {
    const d = new Date();
    const dateStr = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    const last = wx.getStorageSync(LAST_OPEN_DATE_KEY);
    if (last === dateStr) return false; // 当天已记过
    wx.setStorageSync(LAST_OPEN_DATE_KEY, dateStr);
    log('APP_DAILY_OPEN', { date: dateStr });
    flush(true); // 留存基线务必及时上报
    return true;
  } catch (e) {
    return false;
  }
}

/** 读取所有本地埋点 */
function getLogs() {
  try { return wx.getStorageSync(STORAGE_KEY) || []; } catch (e) { return []; }
}

/** 清空本地埋点 */
function clearLogs() {
  try { wx.removeStorageSync(STORAGE_KEY); } catch (e) {}
}

module.exports = {
  log,
  getLogs,
  clearLogs,
  // [V2.0] 新增
  flush,
  trackDailyOpen,
  getAnonId
};

// ====== [V2.0-H2] 零侵入自启动 ======
// 说明：本模块被 12 个页面 require，首次加载即在此记录每日打开，
// 从而在"不改 app.js"的前提下立刻启动留存基线采集（app.js 当前有 27 个未提交改动，暂不触碰）。
// TODO(app.js 改动确认后)：在 app.js onLaunch 中显式调用 trackDailyOpen()，并删除本段。
try {
  trackDailyOpen();
} catch (e) {}
