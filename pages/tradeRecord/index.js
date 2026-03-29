// pages/tradeRecord/index.js
const store = require('../../utils/mainchainStore.js');
const linkage = require('../../utils/mainchainLinkage.js');

const PLAN_TYPE_MAP = {
  steady: '稳健方案',
  advanced: '加强方案'
};
const DISPLAY_SOURCE = '熵盾风控系统';
const DISPLAY_VERSION = 'RiskOS1.0';

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

function normalizeRecord(item = {}) {
  const steps = safeList(item.steps);
  const firstStep = steps.find(step => step && (step.stopPrice || step.buyPrice)) || {};
  const stopAmounts = steps
    .map(step => safeNum(step && step.stopAmount))
    .filter(Number.isFinite);
  const negativeStops = stopAmounts.filter(v => v < 0);
  const derivedMaxLoss = negativeStops.length ? Math.abs(Math.min(...negativeStops)).toFixed(2) : '';

  const stopLossPrice = safeText(item.stopLossPrice || item.stopPrice || firstStep.stopPrice || '', '—');
  const maxLossAmount = safeText(
    item.maxLossAmount || item.riskAmount || item.totalRisk || item.totalLoss || derivedMaxLoss,
    '—'
  );

  return {
    ...item,
    stopLossPrice,
    maxLossAmount,
    source: DISPLAY_SOURCE,
    entryVersion: DISPLAY_VERSION,
    planTypeText: PLAN_TYPE_MAP[item.planType] || safeText(item.planType, '当前方案'),
    timeText: fmtTime(item.savedAt || item.generatedAt || item.createdAt || 0)
  };
}

function moveHitToTop(list = [], hitIndex = -1) {
  if (!Array.isArray(list) || !list.length || hitIndex <= 0) return list;
  const hit = list[hitIndex];
  return [hit].concat(list.slice(0, hitIndex)).concat(list.slice(hitIndex + 1));
}

Page({
  data: {
    list: [],
    totalCount: 0,
    latestTime: '',
    planTypeMap: PLAN_TYPE_MAP,
    from: '',
    focus: '',
    reportId: '',
    activeRecordId: ''
  },

  onLoad(options = {}) {
    const nav = linkage.parseNavOptions(options, 'tradeRecord');
    this.setData({
      from: nav.from,
      focus: nav.focus,
      reportId: nav.reportId
    });
    this.loadList();
  },

  onShow() {
    this.loadList();
  },

  loadList() {
    const raw = store.getTradeRecords ? store.getTradeRecords() : [];
    let list = safeList(raw).map(item => ({
      ...normalizeRecord(item),
      __activeKey: linkage.safeText(item.recordId || item.reportId || item.id, '')
    }));

    const hit = linkage.locateTradeItem(list, this.data.reportId, this.data.focus);
    if (hit && hit.index >= 0) {
      list = moveHitToTop(list, hit.index);
    }

    const first = list[0] || {};
    this.setData({
      list,
      totalCount: list.length,
      latestTime: list.length ? (list[0].timeText || '') : '',
      activeRecordId: linkage.safeText(first.recordId || first.reportId || first.id, '')
    });
  },

  getCurrentReportId() {
    const first = (this.data.list && this.data.list[0]) || {};
    const latest = store.getLatestRiskReport ? (store.getLatestRiskReport() || {}) : {};
    return linkage.safeText(this.data.reportId || first.reportId || latest.reportId || '', '');
  },

  goRiskReport() {
    const reportId = this.getCurrentReportId();
    if (!reportId) {
      wx.showToast({ title: '暂无风控报告', icon: 'none' });
      return;
    }
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/riskReport/index', {
        from: 'tradeRecord',
        focus: 'reportId',
        reportId
      })
    });
  },

  goLongArchive() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/longArchive/index', {
        from: 'tradeRecord',
        focus: reportId ? 'reportId' : '',
        reportId
      })
    });
  },

  goMainchainOverview() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/mainchainOverview/index', {
        from: 'tradeRecord',
        focus: reportId ? 'reportId' : '',
        reportId
      })
    });
  },

  goRiskCalculator() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index?from=tradeRecord'
    });
  }
});