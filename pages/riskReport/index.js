// pages/riskReport/index.js
const store = require('../../utils/mainchainStore.js');
const mainchainApi = require('../../utils/mainchainApi.js');
const linkage = require('../../utils/mainchainLinkage.js');

const PLAN_TYPE_MAP = {
  steady: '稳健方案',
  advanced: '加强方案'
};
const DISPLAY_SOURCE = '熵盾风控系统';
const DISPLAY_VERSION = 'RiskOS1.0';

function safeText(v, d = '') {
  if (v === undefined || v === null) return d;
  const s = String(v).trim();
  return s ? s : d;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function fmtTime(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function getPlanTypeText(v) {
  return PLAN_TYPE_MAP[v] || safeText(v, '当前方案');
}

function normalizeReport(report = {}) {
  const steps = safeArray(report.steps);
  const firstStep = steps.find(step => step && (step.stopPrice || step.buyPrice)) || {};
  const stopAmounts = steps.map(step => safeNum(step && step.stopAmount)).filter(Number.isFinite);
  const negativeStops = stopAmounts.filter(v => v < 0);
  const derivedMaxLoss = negativeStops.length ? Math.abs(Math.min(...negativeStops)).toFixed(2) : '';
  const stopLossPrice = safeText(report.stopLossPrice || report.stopPrice || firstStep.stopPrice || '', '—');
  const maxLossAmount = safeText(
    report.maxLossAmount || report.riskAmount || report.totalRisk || report.totalLoss || derivedMaxLoss,
    '—'
  );

  return {
    ...report,
    stopLossPrice,
    maxLossAmount,
    riskAmount: maxLossAmount,
    totalRisk: maxLossAmount,
    totalLoss: maxLossAmount,
    source: DISPLAY_SOURCE,
    entryVersion: DISPLAY_VERSION
  };
}

function buildSummaryRows(report = {}) {
  return [
    { k: '首次价格', v: safeText(report.firstPrice || report.entryPrice, '—') },
    { k: '止损价格', v: safeText(report.stopLossPrice || report.stopPrice, '—') },
    { k: '目标价格', v: safeText(report.targetPrice, '—') },
    { k: '最大风险', v: safeText(report.maxLossAmount || report.riskAmount || report.totalRisk || report.totalLoss, '—') },
    { k: '来源', v: DISPLAY_SOURCE },
    { k: '版本', v: DISPLAY_VERSION }
  ];
}

function buildAiEnhancement(report = {}) {
  const planTypeText = getPlanTypeText(report.planType);
  const riskText = safeText(report.maxLossAmount || report.riskAmount || report.totalRisk || report.totalLoss, '未识别');
  const stopText = safeText(report.stopLossPrice || report.stopPrice, '未识别');
  const targetText = safeText(report.targetPrice, '未设置');
  const code = safeText(report.code, '未识别代码');

  return {
    summary: `${planTypeText}已生成。标的是 ${code}，来源统一为 ${DISPLAY_SOURCE}，版本 ${DISPLAY_VERSION}。`,
    riskExplanation: `最大风险口径为 ${riskText}，止损价格为 ${stopText}。先锁亏损边界，再谈利润。`,
    positionExplanation: '仓位执行必须按步骤推进，不得跳步、抢跑或临时加码。',
    stopLossExplanation: `止损价格以 ${stopText} 为准，触发边界后不能拖延执行。`,
    targetExplanation: `目标价格为 ${targetText}，到位后按计划处理，不贪不拖。`,
    disciplineWarning: '风控报告的第一原则是先控损，再放大利润。',
    nextActionSuggestion: `下一步先执行，再把结果沉淀到长期档案。当前报告编号：${safeText(report.reportId, '未生成')}`
  };
}

Page({
  data: {
    report: null,
    reportId: '',
    from: '',
    focus: '',
    timeText: '',
    planTypeMap: PLAN_TYPE_MAP,
    disciplineTips: [],
    steps: [],
    summaryRows: [],
    aiEnhancement: {
      summary: '',
      riskExplanation: '',
      positionExplanation: '',
      stopLossExplanation: '',
      targetExplanation: '',
      disciplineWarning: '',
      nextActionSuggestion: ''
    }
  },

  onLoad(options = {}) {
    const nav = linkage.parseNavOptions ? linkage.parseNavOptions(options, 'riskReport') : { reportId: safeText(options.reportId, ''), from: safeText(options.from, 'riskReport'), focus: safeText(options.focus, '') };
    this.setData({
      from: nav.from || 'riskReport',
      focus: nav.focus || ''
    });
    this.loadReport(nav.reportId || '');
  },

  onShow() {
    if (!this.data.report) {
      this.loadReport(this.data.reportId || '');
    }
  },

  loadReport(reportId = '') {
    const raw = store.getResolvedRiskReport ? store.getResolvedRiskReport(reportId) : null;
    if (!raw) {
      wx.showToast({ title: '暂无风控报告', icon: 'none' });
      return;
    }

    const report = normalizeReport(raw);
    this.setData({
      report,
      reportId: report.reportId || reportId || '',
      timeText: fmtTime(report.createdAt || report.generatedAt || 0),
      disciplineTips: safeArray(report.disciplineTips),
      steps: safeArray(report.steps),
      summaryRows: buildSummaryRows(report),
      aiEnhancement: buildAiEnhancement(report)
    });
  },

  saveLongArchive() {
    if (!this.data.report) {
      wx.showToast({ title: '暂无可归档报告', icon: 'none' });
      return;
    }
    if (mainchainApi.persistLongArchiveFromReport) {
      mainchainApi.persistLongArchiveFromReport(this.data.report);
    }
    if (store.saveLongArchiveFromReport) {
      store.saveLongArchiveFromReport(this.data.report);
    }
    wx.showToast({ title: '已加入长期档案', icon: 'success' });
  },

  onSaveArchive() {
    this.saveLongArchive();
  },

  goLongArchive() {
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/longArchive/index', {
        from: 'riskReport',
        focus: 'reportId',
        reportId: this.data.reportId || ''
      })
    });
  },

  goMainchainOverview() {
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/mainchainOverview/index', {
        from: 'riskReport',
        focus: 'reportId',
        reportId: this.data.reportId || ''
      })
    });
  },

  goTradeRecord() {
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/tradeRecord/index', {
        from: 'riskReport',
        focus: 'reportId',
        reportId: this.data.reportId || ''
      })
    });
  },

  goRiskCalculator() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index?from=riskReport'
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});