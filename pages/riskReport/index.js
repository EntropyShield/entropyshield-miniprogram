// pages/riskReport/index.js
const store = require('../../utils/mainchainStore.js');
const mainchainApi = require('../../utils/mainchainApi.js');
const linkage = require('../../utils/mainchainLinkage.js');

function safeText(v, d = '') {
  if (v === undefined || v === null) return d;
  const s = String(v).trim();
  return s ? s : d;
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

function hasValue(v) {
  return !(v === undefined || v === null || String(v).trim() === '');
}

function fmtValue(v, fallback = '—') {
  if (!hasValue(v)) return fallback;
  return String(v);
}

function getPlanTypeMap() {
  return {
    steady: '稳健方案',
    advanced: '加强方案'
  };
}

function getPlanTypeText(report = {}) {
  const map = getPlanTypeMap();
  return map[report.planType] || safeText(report.planType, '当前方案');
}

function getFirstPrice(report = {}) {
  return fmtValue(report.firstPrice || report.entryPrice || '');
}

function getStopPrice(report = {}) {
  return fmtValue(report.stopLossPrice || report.stopPrice || '');
}

function getTargetPrice(report = {}) {
  return fmtValue(report.targetPrice || '');
}

function getRiskText(report = {}) {
  return fmtValue(
    report.maxLossAmount || report.riskAmount || report.totalRisk || report.totalLoss || ''
  );
}

function getTargetProfit(report = {}) {
  return fmtValue(report.targetProfit || '');
}

function getCapitalText(report = {}) {
  return fmtValue(report.totalCapital || '');
}

function buildSummaryRows(report = {}) {
  const steps = safeArray(report.steps);
  return [
    { k: '首次价格', v: getFirstPrice(report) },
    { k: '止损价格', v: getStopPrice(report) },
    { k: '目标价格', v: getTargetPrice(report) },
    { k: '最大风险', v: getRiskText(report) },
    { k: '目标利润', v: getTargetProfit(report) },
    { k: '账户资金', v: getCapitalText(report) },
    { k: '计划类型', v: getPlanTypeText(report) },
    { k: '执行步数', v: String(steps.length || 0) }
  ];
}

function buildDisplaySteps(steps = []) {
  return safeArray(steps).map((item, index) => {
    const parts = [`第${index + 1}步`];

    const buyPrice = fmtValue(item.buyPrice || '');
    const buyShares = fmtValue(item.buyShares || '');
    const buyAmount = fmtValue(item.buyAmount || '');
    const stopPrice = fmtValue(item.stopPrice || '');
    const stopAmount = fmtValue(item.stopAmount || '');

    if (buyPrice !== '—') parts.push(`买入价 ${buyPrice}`);
    if (buyShares !== '—') parts.push(`买入数量 ${buyShares}`);
    if (buyAmount !== '—') parts.push(`买入金额 ${buyAmount}`);
    if (stopPrice !== '—') parts.push(`止损价 ${stopPrice}`);
    if (stopAmount !== '—') parts.push(`止损盈亏 ${stopAmount}`);

    return {
      index: index + 1,
      displayText: parts.join('；')
    };
  });
}

function buildDisciplineTips(report = {}) {
  const planType = String(report.planType || 'steady');
  const riskText = getRiskText(report);
  const targetPrice = getTargetPrice(report);

  if (planType === 'advanced') {
    return [
      `先守最大风险边界 ${riskText}，再看目标价 ${targetPrice}，不允许临盘放宽风险。`,
      '加强方案只在满足条件时执行，不抢跑、不补幻想单、不因为短线波动改规则。',
      '执行顺序必须按报告步骤推进，任何一步触发风控边界都应整体复核。'
    ];
  }

  return [
    `稳健方案先守最大风险边界 ${riskText}，再看目标价 ${targetPrice}。`,
    '分批执行要严格按步骤推进，不因为盘中波动打乱既定节奏。',
    '这份报告用于风控执行与复盘，不替代临盘追涨杀跌。'
  ];
}

function buildAiEnhancement(report = {}) {
  const planTypeText = getPlanTypeText(report);
  const code = safeText(report.code, '未识别代码');
  const source = safeText(report.source, 'riskCalculator');
  const version = safeText(report.entryVersion, 'V1.4');
  const riskText = getRiskText(report);
  const targetPrice = getTargetPrice(report);
  const targetProfit = getTargetProfit(report);
  const capitalText = getCapitalText(report);
  const stopPrice = getStopPrice(report);
  const steps = safeArray(report.steps);
  const stepCount = steps.length;

  return {
    summary: `${planTypeText}已生成。当前标的是 ${code}，来源 ${source}，版本 ${version}。这份报告先看风险边界，再看利润目标，最后看执行纪律。`,
    riskExplanation: `当前最大风险口径为 ${riskText}。你的第一优先级不是猜涨跌，而是确认亏损边界已经被锁定。`,
    positionExplanation: capitalText !== '—'
      ? `当前账户资金为 ${capitalText}，本次计划共 ${stepCount} 步。仓位执行必须按步骤推进，不得跳步、抢跑或临时加码。`
      : `当前计划共 ${stepCount} 步。仓位执行必须按步骤推进，不得跳步、抢跑或临时加码。`,
    stopLossExplanation: stopPrice !== '—'
      ? `当前止损参考价为 ${stopPrice}。一旦触发风控边界，应按整体纪律处理，而不是盘中犹豫。`
      : '当前报告未识别出明确止损价格，请优先回到原始计算结果，确认止损价与退出边界。',
    targetExplanation: targetPrice !== '—'
      ? `当前目标价为 ${targetPrice}${targetProfit !== '—' ? `，目标利润为 ${targetProfit}` : ''}。到位后按计划处理，不贪不拖。`
      : '当前报告未识别出明确目标价，请先核对目标利润与出场逻辑。',
    disciplineWarning: `${planTypeText}的纪律重点是：先控制亏损，再争取利润；不临盘改规则，不因为情绪放宽风控。`,
    nextActionSuggestion: `下一步先按这份风控报告执行，再把有效动作沉淀到长期档案。当前报告编号：${safeText(report.reportId, '未生成')}`
  };
}

Page({
  data: {
    report: null,
    reportId: '',
    from: '',
    focus: '',
    timeText: '',
    planTypeMap: getPlanTypeMap(),
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
      disciplineTips: buildDisciplineTips(report),
      steps: buildDisplaySteps(report.steps),
      summaryRows: buildSummaryRows(report),
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
    wx.showToast({ title: '已加入长期档案', icon: 'success' });
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