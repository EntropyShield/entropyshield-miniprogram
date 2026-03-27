// utils/mainchainStore.js
const riskEngine = require('./riskEngine.js');

const KEYS = {
  DRAFT_LATEST: 'riskCalcLatestDraft',
  DRAFT_HISTORY: 'riskCalcDraftHistory',

  PLAN_LATEST: 'riskPlanLatestResult',
  PLAN_HISTORY: 'riskPlanResultHistory',
  PLAN_BY_DRAFT: 'riskPlanByDraftId',

  TRADE_LIST: 'riskTradeRecordList',

  REPORT_LATEST: 'riskReportLatest',
  REPORT_HISTORY: 'riskReportHistory',
  REPORT_BY_ID: 'riskReportById',

  ARCHIVE_LATEST: 'riskLongArchiveLatest',
  ARCHIVE_LIST: 'riskLongArchiveList',
  ARCHIVE_BY_ID: 'riskLongArchiveById'
};

function safeList(v) {
  return Array.isArray(v) ? v : [];
}

function saveRiskCalcDraft(draft) {
  wx.setStorageSync(KEYS.DRAFT_LATEST, draft);
  const history = safeList(wx.getStorageSync(KEYS.DRAFT_HISTORY));
  history.unshift(draft);
  wx.setStorageSync(KEYS.DRAFT_HISTORY, history.slice(0, 100));
  return draft;
}

function getLatestRiskCalcDraft() {
  return wx.getStorageSync(KEYS.DRAFT_LATEST) || null;
}

function getRiskCalcDraftHistory() {
  return safeList(wx.getStorageSync(KEYS.DRAFT_HISTORY));
}

function clearRiskCalcDrafts() {
  wx.removeStorageSync(KEYS.DRAFT_LATEST);
  wx.removeStorageSync(KEYS.DRAFT_HISTORY);
}

function savePlanResult(snapshot) {
  wx.setStorageSync(KEYS.PLAN_LATEST, snapshot);

  const history = safeList(wx.getStorageSync(KEYS.PLAN_HISTORY));
  history.unshift(snapshot);
  wx.setStorageSync(KEYS.PLAN_HISTORY, history.slice(0, 100));

  if (snapshot && snapshot.draftId) {
    const map = wx.getStorageSync(KEYS.PLAN_BY_DRAFT) || {};
    map[snapshot.draftId] = snapshot;
    wx.setStorageSync(KEYS.PLAN_BY_DRAFT, map);
  }

  return snapshot;
}

function getPlanResultHistory() {
  return safeList(wx.getStorageSync(KEYS.PLAN_HISTORY));
}

function getLatestPlanResult() {
  return wx.getStorageSync(KEYS.PLAN_LATEST) || null;
}

function saveTradeRecord(record) {
  const list = safeList(wx.getStorageSync(KEYS.TRADE_LIST));
  const next = [record].concat(list.filter(item => item.resultId !== record.resultId));
  wx.setStorageSync(KEYS.TRADE_LIST, next.slice(0, 200));
  return record;
}

function getTradeRecords() {
  return safeList(wx.getStorageSync(KEYS.TRADE_LIST));
}

function clearTradeRecords() {
  wx.removeStorageSync(KEYS.TRADE_LIST);
}

function saveRiskReport(report) {
  wx.setStorageSync(KEYS.REPORT_LATEST, report);

  const history = safeList(wx.getStorageSync(KEYS.REPORT_HISTORY));
  history.unshift(report);
  wx.setStorageSync(KEYS.REPORT_HISTORY, history.slice(0, 100));

  const map = wx.getStorageSync(KEYS.REPORT_BY_ID) || {};
  map[report.reportId] = report;
  wx.setStorageSync(KEYS.REPORT_BY_ID, map);

  return report;
}

function getLatestRiskReport() {
  return wx.getStorageSync(KEYS.REPORT_LATEST) || null;
}

function getRiskReportHistory() {
  return safeList(wx.getStorageSync(KEYS.REPORT_HISTORY));
}

function getRiskReportById(reportId) {
  const map = wx.getStorageSync(KEYS.REPORT_BY_ID) || {};
  return map[reportId] || null;
}

function getResolvedRiskReport(reportId = '') {
  let report = null;

  if (reportId) {
    report = getRiskReportById(reportId);
  }

  if (!report && reportId) {
    const history = getRiskReportHistory();
    report = history.find(item => item && item.reportId === reportId) || null;
  }

  if (!report) {
    report = getLatestRiskReport();
  }

  return report || null;
}

function saveLongArchive(item) {
  const list = safeList(wx.getStorageSync(KEYS.ARCHIVE_LIST));
  const next = [item].concat(list.filter(x => x.reportId !== item.reportId));
  wx.setStorageSync(KEYS.ARCHIVE_LIST, next.slice(0, 200));
  wx.setStorageSync(KEYS.ARCHIVE_LATEST, item);

  const map = wx.getStorageSync(KEYS.ARCHIVE_BY_ID) || {};
  map[item.archiveId] = item;
  wx.setStorageSync(KEYS.ARCHIVE_BY_ID, map);

  return item;
}

function saveLongArchiveFromReport(report) {
  const item = riskEngine.buildLongArchiveItem(report || {});
  return saveLongArchive(item);
}

function getLongArchives() {
  return safeList(wx.getStorageSync(KEYS.ARCHIVE_LIST));
}

function getLongArchivesSorted() {
  return getLongArchives().slice().sort((a, b) => Number(b.archivedAt || 0) - Number(a.archivedAt || 0));
}

function getLatestLongArchive() {
  return wx.getStorageSync(KEYS.ARCHIVE_LATEST) || null;
}

function clearLongArchives() {
  wx.removeStorageSync(KEYS.ARCHIVE_LIST);
  wx.removeStorageSync(KEYS.ARCHIVE_LATEST);
  wx.removeStorageSync(KEYS.ARCHIVE_BY_ID);
}

function getOverview() {
  const drafts = getRiskCalcDraftHistory();
  const trades = getTradeRecords();
  const reports = getRiskReportHistory();
  const archives = getLongArchivesSorted();

  return {
    draftCount: drafts.length,
    tradeCount: trades.length,
    reportCount: reports.length,
    archiveCount: archives.length,
    latestDraft: drafts[0] || null,
    latestTrade: trades[0] || null,
    latestReport: reports[0] || null,
    latestArchive: archives[0] || null
  };
}

function buildSyncPayload(entityType, payload, clientId = '') {
  const cid = String(clientId || wx.getStorageSync('clientId') || '').trim();
  return {
    clientId: cid,
    entityType: String(entityType || '').trim(),
    entityVersion: 'V1',
    createdAt: Date.now(),
    payload: payload || {}
  };
}

module.exports = {
  KEYS,

  saveRiskCalcDraft,
  getLatestRiskCalcDraft,
  getRiskCalcDraftHistory,
  clearRiskCalcDrafts,

  savePlanResult,
  getPlanResultHistory,
  getLatestPlanResult,

  saveTradeRecord,
  getTradeRecords,
  clearTradeRecords,

  saveRiskReport,
  getLatestRiskReport,
  getRiskReportHistory,
  getRiskReportById,
  getResolvedRiskReport,

  saveLongArchive,
  saveLongArchiveFromReport,
  getLongArchives,
  getLongArchivesSorted,
  getLatestLongArchive,
  clearLongArchives,

  getOverview,
  buildSyncPayload
};