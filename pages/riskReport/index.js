// pages/riskReport/index.js
const store = require('../../utils/mainchainStore.js');
const mainchainApi = require('../../utils/mainchainApi.js');

function fmtTime(ts) {
  const n = Number(ts || 0);
  if (!n) return '';
  const d = new Date(n);
  if (isNaN(d.getTime())) return '';
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function safeText(v, fallback = '') {
  if (v === undefined || v === null || v === '') return fallback;
  return String(v);
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function buildAiEnhancement(report = {}) {
  const planTypeMap = {
    steady: '稳健版',
    advanced: '加强版'
  };

  const planTypeText = planTypeMap[report.planType] || safeText(report.planType, '当前方案');
  const firstPrice = Number(report.firstPrice || report.entryPrice || 0);
  const stopLossPrice = Number(report.stopLossPrice || report.stopPrice || 0);
  const targetPrice = Number(report.targetPrice || 0);
  const steps = safeArray(report.steps);
  const disciplineTips = safeArray(report.disciplineTips);

  const stopDistance = firstPrice && stopLossPrice
    ? (((firstPrice - stopLossPrice) / firstPrice) * 100).toFixed(2) + '%'
    : '—';

  const targetDistance = firstPrice && targetPrice
    ? (((targetPrice - firstPrice) / firstPrice) * 100).toFixed(2) + '%'
    : '—';

  const riskAmount = safeText(
    report.maxLossAmount || report.riskAmount || report.totalRisk || report.totalLoss,
    '已按方案约束'
  );

  return {
    summary: `${planTypeText}已生成，当前重点不是预测对错，而是先把亏损边界和执行顺序锁住。`,
    riskExplanation: `本次方案把最大风险控制在 ${riskAmount} 的范围内，先看能亏多少，再看能赚多少。`,
    positionExplanation: steps.length
      ? `当前报告包含 ${steps.length} 个执行步骤，建议按步骤推进，不要临盘改规则。`
      : '当前报告没有拆出多步骤执行，建议单次执行也严格按固定节奏推进。',
    stopLossExplanation: stopLossPrice
      ? `止损位已给出，和首次价格相比回撤空间约 ${stopDistance}。触发后优先执行，不拖延。`
      : '本报告未识别出明确止损位，执行前先确认退出边界。',
    targetExplanation: targetPrice
      ? `目标位已给出，和首次价格相比目标空间约 ${targetDistance}。到位后按计划处理，不贪不赌。`
      : '本报告未识别出明确目标位，建议先确认止盈路径。',
    disciplineWarning: disciplineTips.length
      ? disciplineTips[0]
      : '不要加仓摊低，不要因为波动临时改规则。',
    nextActionSuggestion: report.reportId
      ? '先保存本报告，再归档到长期档案，后续按同一逻辑复盘。'
      : '先完成当前方案执行，再进入长期档案复盘。'
  };
}

Page({
  data: {
    report: null,
    reportId: '',
    timeText: '',
    disciplineTips: [],
    steps: [],
    aiEnhancement: {
      summary: '',
      riskExplanation: '',
      positionExplanation: '',
      stopLossExplanation: '',
      targetExplanation: '',
      disciplineWarning: '',
      nextActionSuggestion: ''
    },
    planTypeMap: {
      steady: '稳健版',
      advanced: '加强版'
    }
  },

  onLoad(options = {}) {
    const reportId = safeText(options.reportId, '');
    this.loadReport(reportId);
  },

  onShow() {
    if (!this.data.report) {
      this.loadReport(this.data.reportId || '');
    }
  },

  loadReport(reportId = '') {
    const report = store.getResolvedRiskReport(reportId);

    if (!report) {
      wx.showToast({ title: '暂无风控报告', icon: 'none' });
      return;
    }

    this.setData({
      report,
      reportId: report.reportId || reportId || '',
      timeText: fmtTime(report.createdAt || report.generatedAt || 0),
      disciplineTips: safeArray(report.disciplineTips),
      steps: safeArray(report.steps),
      aiEnhancement: buildAiEnhancement(report)
    });
  },

  saveLongArchive() {
    try {
      if (!this.data.report) {
        wx.showToast({ title: '暂无可归档报告', icon: 'none' });
        return;
      }

      try {
        mainchainApi.persistLongArchiveFromReport(this.data.report);
      } catch (e) {
        store.saveLongArchiveFromReport(this.data.report);
      }

      wx.showToast({ title: '已加入长期档案', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '归档失败', icon: 'none' });
    }
  },

  goLongArchive() {
    wx.navigateTo({
      url: '/pages/longArchive/index?from=riskReport'
    });
  },

  goMainchainOverview() {
    wx.navigateTo({
      url: '/pages/mainchainOverview/index?from=riskReport'
    });
  },

  goTradeRecord() {
    wx.navigateTo({
      url: '/pages/tradeRecord/index?from=riskReport'
    });
  },

  goRiskCalculator() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index?from=riskReport'
    });
  },

  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});