// pages/longArchive/index.js
const store = require('../../utils/mainchainStore.js');
const linkage = require('../../utils/mainchainLinkage.js');

const PLAN_TYPE_MAP = {
  steady: '稳健方案',
  advanced: '加强方案'
};

const EXECUTION_STATUS_MAP = {
  pending: '待执行',
  planned: '已计划',
  partial: '部分执行',
  deviated: '已偏离',
  done: '已完成',
  archived: '已归档'
};

function safeList(v) {
  return Array.isArray(v) ? v : [];
}

function safeText(v, d = '') {
  if (v === undefined || v === null) return d;
  const s = String(v).trim();
  return s ? s : d;
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function fmtTime(v) {
  const n = Number(v || 0);
  if (!n) return '';
  const d = new Date(n);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map(item => safeText(item, '')).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[，,、|]/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeExecutionStatus(value) {
  const raw = safeText(value, '').toLowerCase();
  return raw || 'pending';
}

function getPlanTypeText(v) {
  return PLAN_TYPE_MAP[v] || safeText(v, '当前方案');
}

function getExecutionStatusText(v) {
  const key = normalizeExecutionStatus(v);
  return EXECUTION_STATUS_MAP[key] || safeText(v, '待执行');
}

function normalizeArchive(item = {}) {
  const steps = safeList(item.steps);
  const firstStep = steps.find(step => step && (step.stopPrice || step.buyPrice)) || {};
  const stopAmounts = steps
    .map(step => safeNum(step && step.stopAmount))
    .filter(Number.isFinite);
  const negativeStops = stopAmounts.filter(v => v < 0);
  const derivedMaxLoss = negativeStops.length ? Math.abs(Math.min(...negativeStops)).toFixed(2) : '';

  const stopLossPrice = safeText(item.stopLossPrice || item.stopPrice || firstStep.stopPrice || '', '');
  const maxLossAmount = safeText(
    item.maxLossAmount || item.riskAmount || item.totalRisk || item.totalLoss || derivedMaxLoss,
    ''
  );

  const deviationTags = normalizeTags(item.deviationTags);
  const archiveTags = normalizeTags(item.archiveTags);
  const disciplineTips = normalizeTags(item.disciplineTips);

  return {
    ...item,
    stopLossPrice: stopLossPrice || '—',
    maxLossAmount: maxLossAmount || '—',
    planTypeText: getPlanTypeText(item.planType),
    executionStatus: normalizeExecutionStatus(item.executionStatus),
    executionStatusText: getExecutionStatusText(item.executionStatus),
    srrScoreText: item.srrScore === null || item.srrScore === undefined || item.srrScore === ''
      ? '待评分'
      : String(item.srrScore),
    deviationTags,
    deviationTagsText: deviationTags.length ? deviationTags.join(' / ') : '无',
    groupTag: safeText(item.groupTag, ''),
    stageTag: safeText(item.stageTag, ''),
    archiveTags,
    archiveTagsText: archiveTags.length ? archiveTags.join(' / ') : '无',
    disciplineTips,
    disciplineTipsText: disciplineTips.length ? disciplineTips.join('\n') : '',
    timeText: fmtTime(item.archivedAt || item.savedAt || item.createdAt || item.generatedAt || 0)
  };
}

function resolveArchive(reportId, archiveId) {
  const rid = safeText(reportId, '');
  const aid = safeText(archiveId, '');

  if (aid && store.getLongArchiveById) {
    const byId = store.getLongArchiveById(aid);
    if (byId) return byId;
  }

  const list = store.getLongArchivesSorted ? store.getLongArchivesSorted() : [];
  if (rid) {
    const hit = safeList(list).find(item => safeText(item.reportId, '') === rid);
    if (hit) return hit;
  }

  return safeList(list)[0] || null;
}

Page({
  data: {
    from: '',
    focus: '',
    reportId: '',
    archiveId: '',
    archive: null,
    emptyText: '暂无长期档案'
  },

  onLoad(options = {}) {
    this.setData({
      from: safeText(options.from, ''),
      focus: safeText(options.focus, ''),
      reportId: safeText(options.reportId, ''),
      archiveId: safeText(options.archiveId, '')
    });
    this.loadArchive();
  },

  onShow() {
    this.loadArchive();
  },

  loadArchive() {
    const archive = resolveArchive(this.data.reportId, this.data.archiveId);
    this.setData({
      archive: archive ? normalizeArchive(archive) : null
    });
  },

  getCurrentReportId() {
    return safeText(this.data.reportId || (this.data.archive && this.data.archive.reportId), '');
  },

  goTradeRecord() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/tradeRecord/index', {
        from: 'longArchive',
        focus: reportId ? 'reportId' : 'latest',
        reportId
      })
    });
  },

  goRiskReport() {
    const reportId = this.getCurrentReportId();
    if (!reportId) {
      wx.showToast({ title: '暂无风控报告', icon: 'none' });
      return;
    }
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/riskReport/index', {
        from: 'longArchive',
        focus: 'reportId',
        reportId
      })
    });
  },

  goMainchainOverview() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/mainchainOverview/index', {
        from: 'longArchive',
        focus: reportId ? 'reportId' : 'latest',
        reportId
      })
    });
  },

  goRiskCalculator() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index?from=longArchive'
    });
  }
});