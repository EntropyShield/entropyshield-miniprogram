// pages/mainchainOverview/index.js
const store = require('../../utils/mainchainStore.js');
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

function safeList(v) {
  return Array.isArray(v) ? v : [];
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

function getPlanTypeText(v) {
  return PLAN_TYPE_MAP[v] || safeText(v, '当前方案');
}

function normalizeRiskEntity(item = {}) {
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

  return {
    ...item,
    stopLossPrice: stopLossPrice || '—',
    maxLossAmount: maxLossAmount || '—',
    riskAmount: maxLossAmount || '—',
    totalRisk: maxLossAmount || '—',
    totalLoss: maxLossAmount || '—',
    source: DISPLAY_SOURCE,
    entryVersion: DISPLAY_VERSION
  };
}

function getTradeList() {
  try {
    return safeList(store.getTradeRecords ? store.getTradeRecords() : []).map(normalizeRiskEntity);
  } catch (e) {
    return [];
  }
}

function getLatestTrade() {
  const list = getTradeList();
  return list[0] || null;
}

function getLatestReport() {
  try {
    const report = (store.getLatestRiskReport && store.getLatestRiskReport()) || null;
    return report ? normalizeRiskEntity(report) : null;
  } catch (e) {
    return null;
  }
}

function getArchiveList() {
  try {
    return safeList(store.getLongArchivesSorted ? store.getLongArchivesSorted() : []).map(normalizeRiskEntity);
  } catch (e) {
    return [];
  }
}

function getLatestArchive() {
  const list = getArchiveList();
  return list[0] || null;
}

function getOverview() {
  try {
    if (store.getOverview) return store.getOverview() || {};
  } catch (e) {}
  return {};
}

function answerQuestion(question, ctx) {
  const q = safeText(question).trim().toLowerCase();
  const hasAny = ctx.tradeCount || ctx.reportCount || ctx.archiveCount;

  if (!hasAny) {
    return '当前主链还没有足够数据。先生成一次风控方案，再逐步沉淀交易记录、风控报告和长期档案。';
  }

  const latestTrade = ctx.latestTrade || {};
  const latestReport = ctx.latestReport || {};
  const latestArchive = ctx.latestArchive || {};

  const tradeCode = safeText(latestTrade.code || latestTrade.symbol || latestTrade.name, '暂无交易记录');
  const tradePlan = getPlanTypeText(latestTrade.planType || latestTrade.strategyName || latestTrade.planName);
  const tradeRisk = safeText(latestTrade.maxLossAmount || latestTrade.riskAmount || latestTrade.totalRisk || latestTrade.totalLoss, '未识别');
  const tradeStop = safeText(latestTrade.stopLossPrice || latestTrade.stopPrice, '未识别');
  const tradeTarget = safeText(latestTrade.targetPrice || latestTrade.takeProfitPrice || latestTrade.target, '未设置');

  const reportCode = safeText(latestReport.code, '暂无风控报告');
  const reportPlan = getPlanTypeText(latestReport.planType);
  const reportTarget = safeText(latestReport.targetPrice, '未设置');
  const reportRisk = safeText(latestReport.maxLossAmount || latestReport.riskAmount || latestReport.totalRisk || latestReport.totalLoss, '未识别');
  const reportStop = safeText(latestReport.stopLossPrice || latestReport.stopPrice, '未识别');

  const archiveCode = safeText(latestArchive.code, '暂无长期档案');
  const archivePlan = getPlanTypeText(latestArchive.planType);
  const archiveTarget = safeText(latestArchive.targetPrice || latestArchive.targetProfit, '未设置');

  const overviewLine = `当前主链总览：交易记录 ${ctx.tradeCount} 条，风控报告 ${ctx.reportCount} 份，长期档案 ${ctx.archiveCount} 条。`;
  const objectLine = `当前关键对象：最新交易 ${tradeCode}（${tradePlan}），最新报告 ${reportCode}（${reportPlan}），长期档案 ${archiveCode}（${archivePlan}）。`;

  if (q.includes('当前状态') || q.includes('主链状态') || q.includes('总览') || q.includes('主链')) {
    return [
      overviewLine,
      objectLine,
      `当前风险核心口径已经明确：交易层最大风险 ${tradeRisk}，交易止损价 ${tradeStop}；报告层最大风险 ${reportRisk}，报告止损价 ${reportStop}。`
    ].join('\n\n');
  }

  if (q.includes('最新交易') || q.includes('交易记录') || q.includes('执行') || q.includes('先看什么') || q.includes('怎么做')) {
    return [
      `最新交易记录：${tradeCode}。计划类型 ${tradePlan}。止损价 ${tradeStop}，最大风险 ${tradeRisk}，目标价 ${tradeTarget}。`,
      '先核对是否按计划执行，再检查是否出现临盘改规则、拖延止损、抢跑加码。'
    ].join('\n\n');
  }

  if (q.includes('最新报告') || q.includes('报告') || q.includes('风控报告') || q.includes('风险')) {
    return [
      `最新风控报告：${reportCode}。方案类型 ${reportPlan}。止损价 ${reportStop}，最大风险 ${reportRisk}，目标价 ${reportTarget}。`,
      '风控报告的核心不是预测，而是先锁亏损边界，再定义利润目标。'
    ].join('\n\n');
  }

  if (q.includes('长期档案') || q.includes('复盘') || q.includes('档案')) {
    return [
      `最新长期档案：${archiveCode}。方案类型 ${archivePlan}，目标口径 ${archiveTarget}。`,
      '档案层的重点是把执行结果沉淀成下一轮可复制的模板。'
    ].join('\n\n');
  }

  if (q.includes('下一步') || q.includes('下一步做什么') || q.includes('接下来') || q.includes('先做什么')) {
    return [
      `下一步建议：第一步核对最新交易 ${tradeCode} 的止损价 ${tradeStop} 和最大风险 ${tradeRisk}；第二步对照最新报告 ${reportCode} 的止损价 ${reportStop} 和最大风险 ${reportRisk}；第三步把结果沉淀到长期档案 ${archiveCode}。`
    ].join('\n\n');
  }

  return [
    overviewLine,
    objectLine,
    '建议优先问：最新交易记录怎么看、最新报告怎么看、下一步做什么。'
  ].join('\n\n');
}

Page({
  data: {
    planTypeMap: PLAN_TYPE_MAP,
    tradeCount: 0,
    reportCount: 0,
    archiveCount: 0,
    latestTrade: null,
    latestReport: null,
    latestArchive: null,
    latestTradeTime: '',
    latestReportTime: '',
    latestArchiveTime: '',
    questionInput: '',
    qaHistory: [],
    quickQuestions: ['当前状态', '最新交易记录怎么看', '最新报告怎么看', '下一步做什么']
  },

  onLoad() {
    this.refreshOverview();
  },

  onShow() {
    this.refreshOverview();
  },

  refreshOverview() {
    const overview = getOverview();
    const latestTrade = getLatestTrade();
    const latestReport = getLatestReport();
    const latestArchive = getLatestArchive();

    this.setData({
      tradeCount: Number(overview.tradeCount || getTradeList().length || 0),
      reportCount: Number(overview.reportCount || (latestReport ? 1 : 0)),
      archiveCount: Number(overview.archiveCount || getArchiveList().length || 0),
      latestTrade: latestTrade || null,
      latestReport: latestReport || null,
      latestArchive: latestArchive || null,
      latestTradeTime: latestTrade ? fmtTime(latestTrade.savedAt || latestTrade.generatedAt || latestTrade.createdAt || 0) : '',
      latestReportTime: latestReport ? fmtTime(latestReport.createdAt || latestReport.generatedAt || 0) : '',
      latestArchiveTime: latestArchive ? fmtTime(latestArchive.archivedAt || latestArchive.createdAt || latestArchive.generatedAt || 0) : ''
    });
  },

  onQuestionInput(e) {
    this.setData({
      questionInput: safeText(e && e.detail && e.detail.value, '')
    });
  },

  askQuestion() {
    const question = safeText(this.data.questionInput, '').trim();
    const ctx = {
      tradeCount: this.data.tradeCount,
      reportCount: this.data.reportCount,
      archiveCount: this.data.archiveCount,
      latestTrade: this.data.latestTrade,
      latestReport: this.data.latestReport,
      latestArchive: this.data.latestArchive
    };
    const answer = answerQuestion(question, ctx);
    this.setData({
      qaHistory: [{
        q: question || '未输入问题',
        a: answer
      }]
    });
  },

  onQuickQuestionTap(e) {
    const q = safeText(
      e && e.currentTarget && e.currentTarget.dataset && (e.currentTarget.dataset.q || e.currentTarget.dataset.preset),
      ''
    );
    this.setData({ questionInput: q });
    this.askQuestion();
  },

  fillPreset(e) {
    this.onQuickQuestionTap(e);
  },

  openLatestTradeRecord() {
    const latest = getLatestReport();
    const reportId = linkage.pickReportId ? linkage.pickReportId(latest || {}) : safeText(latest && latest.reportId, '');
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/tradeRecord/index', {
        from: 'mainchainOverview',
        focus: reportId ? 'reportId' : 'latest',
        reportId
      })
    });
  },

  openLatestReport() {
    const latest = getLatestReport();
    const reportId = safeText(latest && latest.reportId, '');
    if (!reportId) {
      wx.showToast({ title: '暂无风控报告', icon: 'none' });
      return;
    }
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/riskReport/index', {
        from: 'mainchainOverview',
        focus: 'reportId',
        reportId
      })
    });
  },

  openLatestArchive() {
    const latest = getLatestReport();
    const reportId = linkage.pickReportId ? linkage.pickReportId(latest || {}) : safeText(latest && latest.reportId, '');
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/longArchive/index', {
        from: 'mainchainOverview',
        focus: reportId ? 'reportId' : 'latest',
        reportId
      })
    });
  },

  goTradeRecord() {
    this.openLatestTradeRecord();
  },

  goRiskReport() {
    this.openLatestReport();
  },

  goLongArchive() {
    this.openLatestArchive();
  },

  goRiskCalculator() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index?source=overview'
    });
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});
