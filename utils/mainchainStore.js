// utils/mainchainStore.js
const riskEngine = require('./riskEngine.js');

const KEYS = {
  DRAFT_LATEST: 'riskCalcLatestDraft',
  PLAN_LATEST: 'riskPlanLatest',
  PLAN_BY_DRAFT: 'riskPlanByDraft',
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

function safeMap(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function sortByTimeDesc(list = []) {
  return safeList(list).sort((a, b) => {
    const ta = Number(a.archivedAt || a.savedAt || a.createdAt || a.generatedAt || 0);
    const tb = Number(b.archivedAt || b.savedAt || b.createdAt || b.generatedAt || 0);
    return tb - ta;
  });
}

function pickEntityId(entityType, payload = {}) {
  const p = payload || {};
  switch (String(entityType || '')) {
    case 'riskCalcDraft':
      return p.draftId || '';
    case 'riskPlanResult':
      return p.resultId || '';
    case 'riskTradeRecord':
      return p.recordId || p.resultId || '';
    case 'riskReport':
      return p.reportId || p.resultId || '';
    case 'riskLongArchive':
      return p.archiveId || p.reportId || '';
    default:
      return p.id || p.resultId || p.reportId || p.recordId || p.archiveId || p.draftId || '';
  }
}

function saveRiskCalcDraft(draft = {}) {
  const nextDraft = riskEngine.buildRiskEntryDraft
    ? riskEngine.buildRiskEntryDraft(draft)
    : draft;

  wx.setStorageSync(KEYS.DRAFT_LATEST, nextDraft);
  return nextDraft;
}

function getLatestRiskCalcDraft() {
  return wx.getStorageSync(KEYS.DRAFT_LATEST) || null;
}

function clearRiskCalcDraft() {
  wx.removeStorageSync(KEYS.DRAFT_LATEST);
}

function savePlanResult(snapshot = {}) {
  const nextSnapshot = snapshot && snapshot.resultId
    ? (riskEngine.withChainMeta ? riskEngine.withChainMeta(snapshot) : snapshot)
    : (riskEngine.buildPlanSnapshot ? riskEngine.buildPlanSnapshot(snapshot) : snapshot);

  wx.setStorageSync(KEYS.PLAN_LATEST, nextSnapshot);

  if (nextSnapshot && nextSnapshot.draftId) {
    const map = safeMap(wx.getStorageSync(KEYS.PLAN_BY_DRAFT));
    map[nextSnapshot.draftId] = nextSnapshot;
    wx.setStorageSync(KEYS.PLAN_BY_DRAFT, map);
  }

  return nextSnapshot;
}

function getLatestPlanResult() {
  return wx.getStorageSync(KEYS.PLAN_LATEST) || null;
}

function getPlanResultByDraftId(draftId) {
  const map = safeMap(wx.getStorageSync(KEYS.PLAN_BY_DRAFT));
  return map[String(draftId || '')] || null;
}

function clearPlanResults() {
  wx.removeStorageSync(KEYS.PLAN_LATEST);
  wx.removeStorageSync(KEYS.PLAN_BY_DRAFT);
}

function saveTradeRecord(record = {}) {
  const seeded = {
    ...record,
    recordId: record.recordId || `tr_${record.resultId || Date.now()}`
  };

  const nextRecord = seeded.recordId && riskEngine.withChainMeta
    ? riskEngine.withChainMeta(seeded)
    : (riskEngine.buildTradeRecord ? riskEngine.buildTradeRecord(seeded) : seeded);

  const list = getTradeRecords();
  const next = [nextRecord].concat(
    list.filter(item => String(item.recordId || '') !== String(nextRecord.recordId || ''))
  );

  wx.setStorageSync(KEYS.TRADE_LIST, next.slice(0, 300));
  return nextRecord;
}

function getTradeRecords() {
  return safeList(wx.getStorageSync(KEYS.TRADE_LIST));
}

function clearTradeRecords() {
  wx.removeStorageSync(KEYS.TRADE_LIST);
}

function saveRiskReport(report = {}) {
  const seeded = {
    ...report,
    reportId: report.reportId || `rr_${report.resultId || Date.now()}`
  };

  const nextReport = seeded.reportId && riskEngine.withChainMeta
    ? riskEngine.withChainMeta(seeded)
    : (riskEngine.buildRiskReport ? riskEngine.buildRiskReport(seeded) : seeded);

  wx.setStorageSync(KEYS.REPORT_LATEST, nextReport);

  const history = getRiskReportHistory();
  const nextHistory = [nextReport].concat(
    history.filter(item => String(item.reportId || '') !== String(nextReport.reportId || ''))
  );
  wx.setStorageSync(KEYS.REPORT_HISTORY, nextHistory.slice(0, 300));

  const map = safeMap(wx.getStorageSync(KEYS.REPORT_BY_ID));
  map[nextReport.reportId] = nextReport;
  wx.setStorageSync(KEYS.REPORT_BY_ID, map);

  return nextReport;
}

function getLatestRiskReport() {
  return wx.getStorageSync(KEYS.REPORT_LATEST) || null;
}

function getRiskReportHistory() {
  return safeList(wx.getStorageSync(KEYS.REPORT_HISTORY));
}

function getRiskReportById(reportId) {
  const map = safeMap(wx.getStorageSync(KEYS.REPORT_BY_ID));
  return map[String(reportId || '')] || null;
}

function getResolvedRiskReport(reportId) {
  let report = null;

  if (reportId) {
    report = getRiskReportById(reportId);
  }

  if (!report && reportId) {
    const history = getRiskReportHistory();
    report = history.find(item => String(item.reportId || '') === String(reportId || '')) || null;
  }

  if (!report) {
    report = getLatestRiskReport();
  }

  return report || null;
}

function saveLongArchive(item = {}) {
  const seeded = {
    ...item,
    archiveId: item.archiveId || `la_${item.reportId || item.resultId || Date.now()}`
  };

  const nextItem = riskEngine.withChainMeta
    ? riskEngine.withChainMeta(seeded)
    : seeded;

  const list = getLongArchives();
  const next = [nextItem].concat(
    list.filter(row => String(row.archiveId || '') !== String(nextItem.archiveId || ''))
  );

  wx.setStorageSync(KEYS.ARCHIVE_LATEST, nextItem);
  wx.setStorageSync(KEYS.ARCHIVE_LIST, next.slice(0, 300));

  const map = safeMap(wx.getStorageSync(KEYS.ARCHIVE_BY_ID));
  map[nextItem.archiveId] = nextItem;
  wx.setStorageSync(KEYS.ARCHIVE_BY_ID, map);

  return nextItem;
}

function saveLongArchiveFromReport(report = {}) {
  const item = riskEngine.buildLongArchiveFromReport
    ? riskEngine.buildLongArchiveFromReport(report)
    : report;
  return saveLongArchive(item);
}

function getLongArchives() {
  return safeList(wx.getStorageSync(KEYS.ARCHIVE_LIST));
}

function getLongArchivesSorted() {
  return sortByTimeDesc(getLongArchives());
}

function getLatestLongArchive() {
  return wx.getStorageSync(KEYS.ARCHIVE_LATEST) || null;
}

function clearLongArchives() {
  wx.removeStorageSync(KEYS.ARCHIVE_LATEST);
  wx.removeStorageSync(KEYS.ARCHIVE_LIST);
  wx.removeStorageSync(KEYS.ARCHIVE_BY_ID);
}

function getOverview() {
  const drafts = getLatestRiskCalcDraft();
  const latestPlan = getLatestPlanResult();
  const trades = getTradeRecords();
  const reports = getRiskReportHistory();
  const archives = getLongArchivesSorted();

  return {
    draftCount: drafts ? 1 : 0,
    tradeCount: trades.length,
    reportCount: reports.length,
    archiveCount: archives.length,
    latestDraft: drafts || null,
    latestPlan: latestPlan || null,
    latestTrade: trades[0] || null,
    latestReport: reports[0] || null,
    latestArchive: archives[0] || null,
    createdAt: Date.now()
  };
}

function buildSyncPayload(entityType, payload = {}, clientId = '') {
  const normalized = riskEngine.withChainMeta
    ? riskEngine.withChainMeta(payload)
    : (payload || {});

  return {
    entityType: String(entityType || ''),
    entityId: pickEntityId(entityType, normalized),
    clientId: String(clientId || ''),
    source: normalized.source || 'riskCalculator',
    entryVersion: normalized.entryVersion || 'V1.4',
    createdAt: Date.now(),
    payload: normalized
  };
}

module.exports = {
  KEYS,

  saveRiskCalcDraft,
  getLatestRiskCalcDraft,
  clearRiskCalcDraft,

  savePlanResult,
  getLatestPlanResult,
  getPlanResultByDraftId,
  clearPlanResults,

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