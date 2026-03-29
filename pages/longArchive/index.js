// pages/longArchive/index.js
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

function buildAiReview(item = {}) {
  const code = safeText(item.code || item.symbol || item.name, '当前档案');
  const reportId = safeText(item.reportId || '', '未绑定');
  const targetProfit = safeText(item.targetProfit || item.targetPrice || item.takeProfitPrice || '', '未设置');
  const riskText = safeText(item.maxLossAmount || item.riskAmount || item.totalRisk || item.totalLoss || '', '未识别');

  return {
    summary: `档案 ${code} 已进入长期复盘，绑定报告 ${reportId}。`,
    mistakeReview: `先检查目标利润 ${targetProfit} 是否被提前破坏，再检查执行是否偏离计划。`,
    disciplineReview: `纪律检查优先围绕最大风险 ${riskText}，不能临盘改规则。`,
    behaviorReview: '复盘重点是删除冲动加仓、犹豫止损和达到目标后继续恋战。',
    nextSuggestion: '下一步先对照风控报告，再回看交易记录，把这次复盘固化为标准样本。'
  };
}

function normalizeArchive(item = {}) {
  const steps = safeList(item.steps);
  const firstStep = steps.find(step => step && (step.stopPrice || step.buyPrice)) || {};
  const stopAmounts = steps.map(step => safeNum(step && step.stopAmount)).filter(Number.isFinite);
  const negativeStops = stopAmounts.filter(v => v < 0);
  const derivedMaxLoss = negativeStops.length ? Math.abs(Math.min(...negativeStops)).toFixed(2) : '';

  const stopLossPrice = safeText(item.stopLossPrice || item.stopPrice || firstStep.stopPrice || '', '—');
  const maxLossAmount = safeText(
    item.maxLossAmount || item.riskAmount || item.totalRisk || item.totalLoss || derivedMaxLoss,
    '—'
  );

  const normalized = {
    ...item,
    stopLossPrice,
    maxLossAmount,
    source: DISPLAY_SOURCE,
    entryVersion: DISPLAY_VERSION,
    archivedTimeText: fmtTime(item.archivedAt || item.createdAt || item.generatedAt || 0)
  };

  normalized.aiReview = buildAiReview(normalized);
  normalized.__activeKey = safeText(
    normalized.archiveId || normalized.reportId || normalized.draftId || normalized.id,
    ''
  );

  return normalized;
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
    activeArchiveId: ''
  },

  onLoad(options = {}) {
    const nav = linkage.parseNavOptions
      ? linkage.parseNavOptions(options, 'longArchive')
      : {
          from: safeText(options.from, 'longArchive'),
          focus: safeText(options.focus, ''),
          reportId: safeText(options.reportId, '')
        };

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
    const raw = store.getLongArchivesSorted ? store.getLongArchivesSorted() : [];
    let list = safeList(raw).map(normalizeArchive);

    const hit = linkage.locateArchiveItem
      ? linkage.locateArchiveItem(list, this.data.reportId, this.data.focus)
      : { index: -1 };

    if (hit && hit.index >= 0) {
      list = moveHitToTop(list, hit.index);
    }

    const first = list[0] || {};
    this.setData({
      list,
      totalCount: list.length,
      latestTime: list.length ? (list[0].archivedTimeText || '') : '',
      activeArchiveId: safeText(first.archiveId || first.reportId || first.draftId || first.id, '')
    });
  },

  getCurrentReportId() {
    const first = (this.data.list && this.data.list[0]) || {};
    const latest = store.getLatestRiskReport ? (store.getLatestRiskReport() || {}) : {};
    return safeText(this.data.reportId || first.reportId || latest.reportId || '', '');
  },

  goTradeRecord() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/tradeRecord/index', {
        from: 'longArchive',
        focus: reportId ? 'reportId' : '',
        reportId
      })
    });
  },

  goLatestRiskReport() {
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

  goRiskReport() {
    this.goLatestRiskReport();
  },

  goMainchainOverview() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/mainchainOverview/index', {
        from: 'longArchive',
        focus: reportId ? 'reportId' : '',
        reportId
      })
    });
  },

  goRiskCalculator() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index?from=longArchive'
    });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});