// pages/mainchainOverview/index.js
const store = require('../../utils/mainchainStore.js');

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

function buildQaContext(overview = {}) {
  return {
    tradeCount: Number(overview.tradeCount || 0),
    reportCount: Number(overview.reportCount || 0),
    archiveCount: Number(overview.archiveCount || 0),
    latestTrade: overview.latestTrade || null,
    latestReport: overview.latestReport || null,
    latestArchive: overview.latestArchive || null
  };
}

function answerQuestion(question, ctx) {
  const q = safeText(question).trim().toLowerCase();
  if (!q) {
    return '请输入你想追问的主链问题。';
  }

  const hasAny = ctx.tradeCount || ctx.reportCount || ctx.archiveCount;
  if (!hasAny) {
    return '当前主链暂无足够数据，先去生成方案、保存风控报告或加入长期档案。';
  }

  const latestTrade = ctx.latestTrade || {};
  const latestReport = ctx.latestReport || {};
  const latestArchive = ctx.latestArchive || {};

  const latestTradeCode = safeText(latestTrade.code, '暂无交易记录');
  const latestReportCode = safeText(latestReport.code, '暂无风控报告');
  const latestArchiveCode = safeText(latestArchive.code, '暂无长期档案');

  const latestReportPlan = safeText(latestReport.planType, '方案');
  const latestReportVersion = safeText(latestReport.entryVersion, 'V1.4');
  const latestReportSource = safeText(latestReport.source, 'riskCalculator');
  const latestReportTarget = safeText(latestReport.targetPrice, '未设置');
  const latestReportRisk = safeText(
    latestReport.maxLossAmount || latestReport.riskAmount || latestReport.totalRisk || latestReport.totalLoss,
    '未识别'
  );

  const archiveSteps = safeArray(latestArchive.steps).length;
  const archiveProfit = safeText(latestArchive.targetProfit, '未识别');
  const archiveType = safeText(latestArchive.planType, '方案');

  if (q.includes('交易') || q.includes('record')) {
    return `当前主链共有 ${ctx.tradeCount} 条交易记录。最近一笔是 ${latestTradeCode}。建议先到交易记录页确认进出场是否按计划执行，再回来看报告和档案。`;
  }

  if (q.includes('报告') || q.includes('风控') || q.includes('risk')) {
    return `最新风控报告是 ${latestReportCode}，方案类型是 ${latestReportPlan}，来源 ${latestReportSource}，版本 ${latestReportVersion}。当前已识别目标价 ${latestReportTarget}，最大风险口径 ${latestReportRisk}。复盘顺序：先看风险边界，再看目标利润，再看执行纪律。`;
  }

  if (q.includes('档案') || q.includes('长期') || q.includes('archive')) {
    return `最近一条长期档案是 ${latestArchiveCode}，方案类型 ${archiveType}，步骤数量 ${archiveSteps} 步，目标利润 ${archiveProfit}。长期档案重点不是看一次盈亏，而是看执行流程是否稳定复制。`;
  }

  if (q.includes('当前') || q.includes('状态') || q.includes('概况') || q.includes('总览') || q.includes('overview')) {
    return `当前主链总览：交易记录 ${ctx.tradeCount} 条，风控报告 ${ctx.reportCount} 份，长期档案 ${ctx.archiveCount} 条。最近报告 ${latestReportCode}，最近档案 ${latestArchiveCode}。当前最优先动作是先看最新报告，再对照交易记录确认执行情况。`;
  }

  if (q.includes('建议') || q.includes('下一步') || q.includes('怎么做') || q.includes('action')) {
    return `下一步建议：先查看最新风控报告 ${latestReportCode}，确认目标价 ${latestReportTarget} 与风险边界 ${latestReportRisk}；再去交易记录核对是否按计划执行；最后把有效样本沉淀进长期档案 ${latestArchiveCode}，形成固定复盘闭环。`;
  }

  if (q.includes('风险') || q.includes('亏') || q.includes('止损')) {
    return `当前主链里最新风险参考来自报告 ${latestReportCode}。已识别风险口径 ${latestReportRisk}。先守风险边界，再谈利润扩张；不要临盘改规则，不要拖延退出。`;
  }

  if (q.includes('利润') || q.includes('目标') || q.includes('止盈')) {
    return `最新报告 ${latestReportCode} 的目标价是 ${latestReportTarget}；最近长期档案 ${latestArchiveCode} 的目标利润是 ${archiveProfit}。到位后先按计划处理，不贪不拖。`;
  }

  return `基于当前主链数据，我建议你优先查看：最新风控报告 ${latestReportCode}、最近交易记录 ${latestTradeCode}、最近长期档案 ${latestArchiveCode}。你也可以直接问“最新报告怎么看”或“下一步做什么”。`;
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
    qaAnswer: '',
    qaHistory: []
  },

  onShow() {
    this.loadOverview();
  },

  loadOverview() {
    const overview = store.getOverview();

    this.setData({
      tradeCount: Number(overview.tradeCount || 0),
      reportCount: Number(overview.reportCount || 0),
      archiveCount: Number(overview.archiveCount || 0),
      latestTrade: overview.latestTrade || null,
      latestReport: overview.latestReport || null,
      latestArchive: overview.latestArchive || null,
      latestTradeTime: overview.latestTrade ? fmtTime(overview.latestTrade.savedAt || overview.latestTrade.generatedAt || 0) : '',
      latestReportTime: overview.latestReport ? fmtTime(overview.latestReport.createdAt || overview.latestReport.generatedAt || 0) : '',
      latestArchiveTime: overview.latestArchive ? fmtTime(overview.latestArchive.archivedAt || overview.latestArchive.createdAt || 0) : ''
    });
  },

  onQuestionInput(e) {
    this.setData({
      questionInput: safeText(e.detail.value, '')
    });
  },

  askQuestion() {
    const question = safeText(this.data.questionInput, '').trim();
    const ctx = buildQaContext({
      tradeCount: this.data.tradeCount,
      reportCount: this.data.reportCount,
      archiveCount: this.data.archiveCount,
      latestTrade: this.data.latestTrade,
      latestReport: this.data.latestReport,
      latestArchive: this.data.latestArchive
    });

    const answer = answerQuestion(question, ctx);
    const nextHistory = [{
      q: question || '未输入问题',
      a: answer,
      createdAt: fmtTime(Date.now())
    }].concat(this.data.qaHistory || []).slice(0, 6);

    this.setData({
      qaAnswer: answer,
      qaHistory: nextHistory
    });
  },

  fillPreset(e) {
    const q = safeText(e.currentTarget.dataset.q, '');
    this.setData({ questionInput: q });
    this.askQuestion();
  },

  openLatestTrade() {
    wx.navigateTo({ url: '/pages/tradeRecord/index?from=mainchainOverview&focus=latest' });
  },

  openLatestReport() {
    const latest = store.getLatestRiskReport();
    if (latest && latest.reportId) {
      wx.navigateTo({
        url: '/pages/riskReport/index?reportId=' + encodeURIComponent(latest.reportId)
      });
      return;
    }
    wx.showToast({ title: '暂无风控报告', icon: 'none' });
  },

  openLatestArchive() {
    wx.navigateTo({ url: '/pages/longArchive/index?from=mainchainOverview&focus=latest' });
  },

  goTradeRecord() {
    wx.navigateTo({ url: '/pages/tradeRecord/index?from=mainchainOverview' });
  },

  goRiskReport() {
    this.openLatestReport();
  },

  goLongArchive() {
    this.openLatestArchive();
  },

  goRiskCalculator() {
    wx.navigateTo({ url: '/pages/riskCalculator/index?source=overview' });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});