// pages/mainchainOverview/index.js
const store = require('../../utils/mainchainStore.js');
const linkage = require('../../utils/mainchainLinkage.js');

const PLAN_TYPE_MAP = {
  steady: '稳健方案',
  advanced: '加强方案'
};

function safeText(v, d = '') {
  if (v === undefined || v === null) return d;
  const s = String(v).trim();
  return s ? s : d;
}

function safeList(v) {
  return Array.isArray(v) ? v : [];
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

function getTradeList() {
  try {
    return safeList(store.getTradeRecords ? store.getTradeRecords() : []);
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
    return (store.getLatestRiskReport && store.getLatestRiskReport()) || null;
  } catch (e) {
    return null;
  }
}

function getArchiveList() {
  try {
    return safeList(store.getLongArchivesSorted ? store.getLongArchivesSorted() : []);
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

function getPlanTypeText(v) {
  return PLAN_TYPE_MAP[v] || safeText(v, '当前方案');
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
  const tradeSource = safeText(latestTrade.source || latestTrade.entrySource, 'tradeRecord');
  const tradeRisk = safeText(
    latestTrade.maxLossAmount || latestTrade.riskAmount || latestTrade.totalRisk || latestTrade.totalLoss,
    '未识别'
  );
  const tradeTarget = safeText(
    latestTrade.targetPrice || latestTrade.takeProfitPrice || latestTrade.target,
    '未设置'
  );

  const reportCode = safeText(latestReport.code, '暂无风控报告');
  const reportPlan = getPlanTypeText(latestReport.planType);
  const reportVersion = safeText(latestReport.entryVersion, 'V1.4');
  const reportSource = safeText(latestReport.source, 'riskCalculator');
  const reportTarget = safeText(latestReport.targetPrice, '未设置');
  const reportRisk = safeText(
    latestReport.maxLossAmount || latestReport.riskAmount || latestReport.totalRisk || latestReport.totalLoss,
    '未识别'
  );

  const archiveCode = safeText(latestArchive.code, '暂无长期档案');
  const archivePlan = getPlanTypeText(latestArchive.planType);
  const archiveTarget = safeText(latestArchive.targetPrice || latestArchive.targetProfit, '未设置');
  const archiveSource = safeText(latestArchive.source, 'longArchive');

  const overviewLine = `当前主链总览：交易记录 ${ctx.tradeCount} 条，风控报告 ${ctx.reportCount} 份，长期档案 ${ctx.archiveCount} 条。`;
  const objectLine = `当前关键对象：最新交易 ${tradeCode}（${tradePlan}，来源 ${tradeSource}），最新报告 ${reportCode}（${reportPlan}，版本 ${reportVersion}），长期档案 ${archiveCode}（${archivePlan}，来源 ${archiveSource}）。`;

  if (q.includes('当前状态') || q.includes('主链状态') || q.includes('总览') || q.includes('主链')) {
    return [
      overviewLine,
      objectLine,
      `当前优先顺序：先检查最新交易 ${tradeCode} 是否按计划执行，再对照报告 ${reportCode} 的风险边界 ${reportRisk} 与目标价 ${reportTarget}，最后把有效动作沉淀到长期档案 ${archiveCode}。`
    ].join('\n\n');
  }

  if (q.includes('最新交易') || q.includes('交易记录') || q.includes('执行') || q.includes('先看什么') || q.includes('怎么做')) {
    return [
      `最新交易记录：${tradeCode}。计划类型 ${tradePlan}，来源 ${tradeSource}，当前风险口径 ${tradeRisk}，目标价 ${tradeTarget}。`,
      '这笔交易的主链位置是“执行层”，先看是否严格按计划推进，再看是否出现临盘改规则、拖延退出或抢跑加码。',
      `联动动作：先核对交易记录，再回看风控报告 ${reportCode}，最后把执行结果沉淀到长期档案 ${archiveCode}。`
    ].join('\n\n');
  }

  if (q.includes('最新报告') || q.includes('报告') || q.includes('风控报告') || q.includes('风险')) {
    return [
      `最新风控报告：${reportCode}。方案类型 ${reportPlan}，来源 ${reportSource}，版本 ${reportVersion}。`,
      `报告重点：最大风险口径 ${reportRisk}，目标价 ${reportTarget}。这份报告的作用是先锁亏损边界，再定义利润目标与执行纪律。`,
      `联动动作：用报告校验最新交易 ${tradeCode} 是否偏离计划，再把复盘结论写入长期档案 ${archiveCode}。`
    ].join('\n\n');
  }

  if (q.includes('长期档案') || q.includes('复盘') || q.includes('档案')) {
    return [
      `最新长期档案：${archiveCode}。方案类型 ${archivePlan}，目标口径 ${archiveTarget}，来源 ${archiveSource}。`,
      '档案层重点不是再做一次计算，而是复盘：哪些动作有效、哪些动作破坏纪律、哪些规则需要下轮保留。',
      `联动动作：先对照风控报告 ${reportCode} 和交易记录 ${tradeCode}，再把这次复盘沉淀成下一轮可复制的执行模板。`
    ].join('\n\n');
  }

  if (q.includes('下一步') || q.includes('下一步做什么') || q.includes('接下来') || q.includes('先做什么')) {
    return [
      `下一步建议：第一步，核对最新交易 ${tradeCode} 是否按计划执行；第二步，对照最新风控报告 ${reportCode} 的风险边界 ${reportRisk} 与目标价 ${reportTarget}；第三步，把结果沉淀到长期档案 ${archiveCode}。`,
      '如果交易已经偏离计划，就先修纪律；如果交易未偏离计划，就继续按报告执行，不要临盘改规则。'
    ].join('\n\n');
  }

  if (q.includes('止损') || q.includes('仓位') || q.includes('目标')) {
    return [
      `关键风控口径：交易层风险 ${tradeRisk}，报告层风险 ${reportRisk}，交易目标 ${tradeTarget}，报告目标 ${reportTarget}。`,
      '解释顺序固定：先看亏损边界是否清楚，再看目标价是否合理，最后看仓位执行是否按步骤推进。'
    ].join('\n\n');
  }

  return [
    overviewLine,
    objectLine,
    '建议你优先问这三类问题：最新交易记录怎么看、最新风控报告怎么看、下一步做什么。'
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
    quickQuestions: [
      '当前状态',
      '最新交易记录怎么看',
      '最新报告怎么看',
      '下一步做什么'
    ]
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
      }].concat(this.data.qaHistory || []).slice(0, 12)
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