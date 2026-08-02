// ====== [MOD:FUNNEL_DEBUG_SILENT_20260330] START ======
const __FUNNEL_DEBUG__ = false;
function funnelDebug() {
  if (!__FUNNEL_DEBUG__) return;
  try {
    console.log.apply(console, arguments);
  } catch (e) {}
}
// ====== [MOD:FUNNEL_DEBUG_SILENT_20260330] END ======
// utils/funnel.js
// 简单本地埋点工具：所有漏斗行为都记在本地 storage 里，方便以后统计 / 上传

const STORAGE_KEY = 'payFunnelLogs';

/**
 * 记录一个漏斗事件
 * @param {string} step - 步骤名称，例如 'REPORT_VIEW'、'PAY_ACTION'
 * @param {object} ext  - 额外信息，会一并存储
 */
function log(step, ext = {}) {
  try {
    const now = Date.now();
    const logs = wx.getStorageSync(STORAGE_KEY) || [];

    const record = {
      step,
      ext,
      ts: now
    };

    logs.push(record);
    wx.setStorageSync(STORAGE_KEY, logs);

    // 为了在控制台看得清楚一点，做一个“展示用副本”
    const displayExt = { ...ext };
    if (displayExt.levelName && typeof displayExt.levelName === 'string') {
      try {
        displayExt.levelName = decodeURIComponent(displayExt.levelName);
      } catch (e) {
        // 解码失败就用原始值
      }
    }

    funnelDebug('[FUNNEL_LOG]', {
      step,
      ext: displayExt,
      ts: now
    });
  } catch (e) {
    funnelDebug('[funnel.log] 写入本地埋点失败：', e);
  }
}

/**
 * 读取所有本地埋点
 */
function getLogs() {
  try {
    return wx.getStorageSync(STORAGE_KEY) || [];
  } catch (e) {
    return [];
  }
}

/**
 * 清空本地埋点
 */
function clearLogs() {
  try {
    wx.removeStorageSync(STORAGE_KEY);
  } catch (e) {}
}

module.exports = {
  log,
  getLogs,
  clearLogs
};
