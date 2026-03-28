// pages/riskReport/index.js
const store = require('../../utils/mainchainStore.js');
const mainchainApi = require('../../utils/mainchainApi.js');
const linkage = require('../../utils/mainchainLinkage.js');

function safeText(v, d = '') {
  if (v === undefined || v === null) return d;
  return String(v).trim();
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
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

function buildAiEnhancement(report = {}) {
  const planTypeMap = {
    steady: '稳健方案',
    advanced: '加强方案'
  };

  const planTypeText = planTypeMap[report.planType] || safeText(report.planType, '当前方案');
  const targetPrice = Number(report.targetPrice || 0);
  const riskText = safeText(
    report.maxLossAmount || report.riskAmount || report.totalRisk || report.totalLoss,
    '未识别'
  );

  return {
    summary: `${planTypeText} 已生成，先看风险边界，再看利润目标。`,
    riskReview: `当前最大风险口径为 ${riskText}。先守边界，不要临盘放宽。`,
    targetReview: targetPrice ? `目标价为 ${targetPrice}，到位后按计划处理。` : '目标价暂未识别，请先核对计划。',
    disciplineReview: '执行纪律固定：不开赌局，不拖止损，不临盘改规则。',
    nextActionSuggestion: report.reportId || ''
  };
}

Page({
  data: {
    report: null,
    reportId: '',
    from: '',
    focus: '',
    timeText: '',
    disciplineTips: [],
    steps: [],
    aiEnhancement: {
      summary: '',
      riskReview: '',
      targetReview: '',
      disciplineReview: '',
      nextActionSuggestion: ''
    }
  },

  onLoad(options = {}) {
    const nav = linkage.parseNavOptions(options, 'riskReport');
    this.setData({
      from: nav.from,
      focus: nav.focus
    });
    this.loadReport(nav.reportId);
  },

  onShow() {
    if (!this.data.report) {
      this.loadReport(this.data.reportId || '');
    }
  },

  loadReport(reportId = '') {
    const report = store.getResolvedRiskReport ? store.getResolvedRiskReport(reportId) : null;
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

  saveToLongArchive() {
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
    wx.showToast({ title: '已写入长期档案', icon: 'success' });
  },

  
  saveLongArchive() {
    return this.saveToLongArchive();
  },

  onSaveArchive() {
    this.saveToLongArchive();
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
