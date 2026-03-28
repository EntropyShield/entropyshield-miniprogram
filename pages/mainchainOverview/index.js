// pages/mainchainOverview/index.js
const store = require('../../utils/mainchainStore.js');
const linkage = require('../../utils/mainchainLinkage.js');

function safeText(v, fallback = '') {
  if (v === undefined || v === null || v === '') return fallback;
  return String(v);
}

function safeList(v) {
  return Array.isArray(v) ? v : [];
}

function fmtTime(v) {
  const n = Number(v || 0);
  if (!n) return '';
  const d = new Date(n);
  if (isNaN(d.getTime())) return '';
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getTradeList() {
  try {
    return safeList(store.getTradeRecords ? store.getTradeRecords() : []);
  } catch (e) {
    return [];
  }
}

function getArchiveList() {
  try {
    return safeList(store.getLongArchivesSorted ? store.getLongArchivesSorted() : []);
  } catch (e) {
    return [];
  }
}

function getLatestReport() {
  try {
    return (store.getLatestRiskReport && store.getLatestRiskReport()) || null;
  } catch (e) {
    return null;
  }
}

function getReportCount(latestReport) {
  try {
    if (store.getRiskReports) return safeList(store.getRiskReports()).length;
    if (store.getRiskReportHistory) return safeList(store.getRiskReportHistory()).length;
    if (store.getReportHistory) return safeList(store.getReportHistory()).length;
    return latestReport ? 1 : 0;
  } catch (e) {
    return latestReport ? 1 : 0;
  }
}

function buildOverview() {
  const tradeList = getTradeList();
  const archiveList = getArchiveList();
  const latestReport = getLatestReport();
  const latestTrade = tradeList[0] || null;
  const latestArchive = archiveList[0] || null;

  return {
    tradeCount: tradeList.length,
    reportCount: getReportCount(latestReport),
    archiveCount: archiveList.length,
    latestTrade,
    latestReport,
    latestArchive
  };
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

  const latestTradeCode = safeText(
    latestTrade.code || latestTrade.symbol || latestTrade.name,
    '暂无交易记录'
  );
  const latestTradePlan = safeText(
    latestTrade.planType || latestTrade.strategyName || latestTrade.planName,
    '当前计划'
  );
  const latestTradeSource = safeText(
    latestTrade.source || latestTrade.entrySource,
    'tradeRecord'
  );
  const latestTradeTarget = safeText(
    latestTrade.targetPrice || latestTrade.takeProfitPrice || latestTrade.target,
    '未设置'
  );
  const latestTradeRisk = safeText(
    latestTrade.maxLossAmount || latestTrade.riskAmount || latestTrade.totalRisk || latestTrade.totalLoss,
    '未识别'
  );

  const latestReportCode = safeText(latestReport.code, '暂无风控报告');
  const latestReportPlan = safeText(latestReport.planType, '方案');
  const latestReportVersion = safeText(latestReport.entryVersion, 'V1.4');
  const latestReportSource = safeText(latestReport.source, 'riskCalculator');
  const latestReportTarget = safeText(latestReport.targetPrice, '未设置');
  const latestReportRisk = safeText(
    latestReport.maxLossAmount || latestReport.riskAmount || latestReport.totalRisk || latestReport.totalLoss,
    '未识别'
  );

  const latestArchiveCode = safeText(
    latestArchive.code || latestArchive.symbol || latestArchive.name,
    '暂无长期档案'
  );
  const archiveProfit = safeText(
    latestArchive.targetProfit || latestArchive.targetPrice || latestArchive.takeProfitPrice,
    '未设置'
  );

  if (
    q.includes('最新交易') ||
    q.includes('交易记录') ||
    q.includes('执行') ||
    q.includes('下一步') ||
    q.includes('先看什么') ||
    q.includes('怎么做')
  ) {
    return `当前先按最新交易记录处理：最新记录是 ${latestTradeCode}，计划类型 ${latestTradePlan}，来源 ${latestTradeSource}，当前风险口径 ${latestTradeRisk}，目标价 ${latestTradeTarget}。执行顺序固定为：先核对这笔交易是否按计划执行，再对照最新风控报告 ${latestReportCode}，最后把有效样本沉淀到长期档案 ${latestArchiveCode}。`;
  }

  if (
    q.includes('最新报告') ||
    q.includes('风控报告') ||
    q.includes('报告怎么看')
  ) {
    return `最新风控报告是 ${latestReportCode}，方案类型是 ${latestReportPlan}，来源 ${latestReportSource}，版本 ${latestReportVersion}。当前已识别目标价 ${latestReportTarget}，最大风险口径 ${latestReportRisk}。复盘顺序：先看风险边界，再看目标利润，再看执行纪律。`;
  }

  if (q.includes('总览') || q.includes('主链')) {
    return `当前主链总览：交易记录 ${ctx.tradeCount} 条，风控报告 ${ctx.reportCount} 份，长期档案 ${ctx.archiveCount} 条。最近报告 ${latestReportCode}，最近档案 ${latestArchiveCode}。当前最优先动作是先看最新交易记录，再对照风控报告确认执行情况。`;
  }

  if (q.includes('风险') || q.includes('止损') || q.includes('仓位')) {
    return `当前主链里，优先参考最新交易记录 ${latestTradeCode} 的真实执行情况，再结合报告 ${latestReportCode} 校验风险边界。先守风险口径 ${latestTradeRisk || latestReportRisk}，再看目标价 ${latestTradeTarget || latestReportTarget}，不要临盘改规则。`;
  }

  if (q.includes('目标') || q.includes('止盈')) {
    return `最新交易记录 ${latestTradeCode} 的目标价是 ${latestTradeTarget}；最新报告 ${latestReportCode} 的目标价是 ${latestReportTarget}；最近长期档案 ${latestArchiveCode} 的目标利润是 ${archiveProfit}。到位后先按计划处理，不贪不拖。`;
  }

  return `基于当前主链数据，我建议你优先查看：最新交易记录 ${latestTradeCode}、最新风控报告 ${latestReportCode}、最近长期档案 ${latestArchiveCode}。你也可以直接问“最新交易记录怎么看”或“下一步做什么”。`;
}

Page({
  data: {
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
      '最新交易记录怎么看',
      '最新报告怎么看',
      '下一步做什么',
      '当前风险在哪里'
    ]
  },

  onLoad() {
    this.refreshOverview();
  },

  onShow() {
    this.refreshOverview();
  },

  refreshOverview() {
    const overview = buildOverview();

    this.setData({
      tradeCount: Number(overview.tradeCount || 0),
      reportCount: Number(overview.reportCount || 0),
      archiveCount: Number(overview.archiveCount || 0),
      latestTrade: overview.latestTrade || null,
      latestReport: overview.latestReport || null,
      latestArchive: overview.latestArchive || null,
      latestTradeTime: overview.latestTrade ? fmtTime(overview.latestTrade.createdAt || overview.latestTrade.generatedAt || overview.latestTrade.archivedAt || 0) : '',
      latestReportTime: overview.latestReport ? fmtTime(overview.latestReport.createdAt || overview.latestReport.generatedAt || 0) : '',
      latestArchiveTime: overview.latestArchive ? fmtTime(overview.latestArchive.archivedAt || overview.latestArchive.createdAt || overview.latestArchive.generatedAt || 0) : ''
    });
  },

  onQuestionInput(e) {
    this.setData({
      questionInput: safeText(e.detail && e.detail.value, '')
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
      }].concat(this.data.qaHistory || [])
    });
  },

  onQuickQuestionTap(e) {
    const q = safeText(e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.q, '');
    this.setData({ questionInput: q });
    this.askQuestion();
  },

  
  fillPreset(e) {
    if (typeof this.onQuickQuestionTap === 'function') {
      return this.onQuickQuestionTap(e);
    }
    const q = safeText(
      (e && e.currentTarget && e.currentTarget.dataset && (e.currentTarget.dataset.q || e.currentTarget.dataset.preset)) || '',
      ''
    );
    this.setData({ questionInput: q });
  },

  openLatestTradeRecord() {
    const latest = getLatestReport();
    const reportId = linkage.pickReportId(latest || {});
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
    if (latest && latest.reportId) {
      wx.redirectTo({
        url: linkage.buildNavUrl('/pages/riskReport/index', {
          from: 'mainchainOverview',
          focus: 'reportId',
          reportId: latest.reportId
        })
      });
      return;
    }
    wx.showToast({ title: '暂无风控报告', icon: 'none' });
  },

  openLatestArchive() {
    const latest = getLatestReport();
    const reportId = linkage.pickReportId(latest || {});
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/longArchive/index', {
        from: 'mainchainOverview',
        focus: reportId ? 'reportId' : 'latest',
        reportId
      })
    });
  },

  goTradeRecord() {
    const latest = getLatestReport();
    const reportId = linkage.pickReportId(latest || {});
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/tradeRecord/index', {
        from: 'mainchainOverview',
        focus: reportId ? 'reportId' : '',
        reportId
      })
    });
  },

  goRiskReport() {
    this.openLatestReport();
  },

  goLongArchive() {
    const latest = getLatestReport();
    const reportId = linkage.pickReportId(latest || {});
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/longArchive/index', {
        from: 'mainchainOverview',
        focus: reportId ? 'reportId' : '',
        reportId
      })
    });
  },

  goRiskCalculator() {
    wx.navigateTo({ url: '/pages/riskCalculator/index?source=overview' });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});