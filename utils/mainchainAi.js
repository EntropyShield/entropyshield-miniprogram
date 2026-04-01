const { API_BASE } = require('../config');

function safeObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function safeStr(v, d = '') {
  if (v === undefined || v === null) return d;
  const s = String(v).trim();
  return s || d;
}

function getBaseUrl() {
  try {
    const app = getApp && getApp();
    const g = (app && app.globalData) || {};
    return safeStr(
      wx.getStorageSync('API_BASE') ||
      wx.getStorageSync('apiBaseUrl') ||
      g.API_BASE ||
      g.apiBaseUrl ||
      API_BASE ||
      '',
      ''
    ).replace(/\/$/, '');
  } catch (e) {
    return safeStr(API_BASE, '').replace(/\/$/, '');
  }
}

function requestAi(payload) {
  return new Promise((resolve, reject) => {
    const baseUrl = getBaseUrl();
    if (!baseUrl) {
      reject(new Error('缺少 API_BASE'));
      return;
    }

    wx.request({
      url: baseUrl + '/api/ai/mainchain/run',
      method: 'POST',
      timeout: 20000,
      header: {
        'Content-Type': 'application/json'
      },
      data: payload,
      success(res) {
        const body = safeObj(res && res.data);
        if (res.statusCode >= 200 && res.statusCode < 300 && body.ok) {
          resolve(body);
          return;
        }

        const err = new Error(safeStr(body.message, 'AI 服务暂时不可用'));
        err.code = safeStr(body.error, 'AI_REQUEST_FAILED');
        err.response = body;
        reject(err);
      },
      fail(err) {
        reject(err || new Error('AI 请求失败'));
      }
    });
  });
}

function runOverviewQa(payload) {
  return requestAi({
    scene: 'overview_qa',
    clientId: safeStr(payload.clientId, ''),
    reportId: safeStr(payload.reportId, ''),
    sourcePage: safeStr(payload.sourcePage, 'mainchainOverview'),
    entryVersion: safeStr(payload.entryVersion, 'V1.4'),
    question: safeStr(payload.question, ''),
    context: safeObj(payload.context)
  });
}

function runReportExplain(payload) {
  return requestAi({
    scene: 'report_explain',
    clientId: safeStr(payload.clientId, ''),
    reportId: safeStr(payload.reportId, ''),
    sourcePage: safeStr(payload.sourcePage, 'riskReport'),
    entryVersion: safeStr(payload.entryVersion, 'V1.4'),
    context: safeObj(payload.context)
  });
}

function runArchiveReview(payload) {
  return requestAi({
    scene: 'archive_review',
    clientId: safeStr(payload.clientId, ''),
    reportId: safeStr(payload.reportId, ''),
    sourcePage: safeStr(payload.sourcePage, 'longArchive'),
    entryVersion: safeStr(payload.entryVersion, 'V1.4'),
    context: safeObj(payload.context)
  });
}

module.exports = {
  requestAi,
  runOverviewQa,
  runReportExplain,
  runArchiveReview
};