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

  const latestTradeCode = ctx.latestTrade ? safeText(ctx.latestTrade.code, '最近一笔交易') : '暂无交易记录';
  const latestReportCode = ctx.latestReport ? safeText(ctx.latestReport.code, '最近一份报告') : '暂无风控报告';
  const latestArchiveCode = ctx.latestArchive ? safeText(ctx.latestArchive.code, '最近一条档案') : '暂无长期档案';

  if (q.includes('交易') || q.includes('record')) {
    return `当前主链里共有 ${ctx.tradeCount} 条交易记录。最近一笔是 ${latestTradeCode}。复盘时先看进出场是否按计划执行。`;
  }

  if (q.includes('报告') || q.includes('风控') || q.includes('risk')) {
    return `当前主链里共有 ${ctx.reportCount} 份风控报告。最近一份是 ${latestReportCode}。先看最大风险边界，再看目标利润，不要反过来。`;
  }

  if (q.includes('档案') || q.includes('长期') || q.includes('archive')) {
    return `当前主链里共有 ${ctx.archiveCount} 条长期档案。最近一条是 ${latestArchiveCode}。长期档案的重点是看执行纪律是否稳定，而不是只看盈亏。`;
  }

  if (q.includes('当前') || q.includes('状态') || q.includes('概况') || q.includes('总览') || q.includes('overview')) {
    return `当前主链总览：交易记录 ${ctx.tradeCount} 条，风控报告 ${ctx.reportCount} 份，长期档案 ${ctx.archiveCount} 条。最近报告是 ${latestReportCode}，最近档案是 ${latestArchiveCode}。`;
  }

  if (q.includes('建议') || q.includes('下一步') || q.includes('怎么做') || q.includes('action')) {
    return '下一步建议：先看最新风控报告，再对照交易记录确认执行情况，最后把有效样本沉淀进长期档案，形成固定复盘闭环。';
  }

  if (q.includes('风险') || q.includes('亏') || q.includes('止损')) {
    return '主链问答层当前只基于已保存数据回答。风险判断优先看最新风控报告里的边界与纪律，再结合交易记录确认是否严格执行。';
  }

  return `基于当前主链数据，我建议你优先查看：最新风控报告（${latestReportCode}）、最近交易记录（${latestTradeCode}）、最近长期档案（${latestArchiveCode}）。如果你要更具体的回答，可以直接问“最新报告怎么看”或“下一步做什么”。`;
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

  goTradeRecord() {
    wx.navigateTo({ url: '/pages/tradeRecord/index?from=mainchainOverview' });
  },

  goRiskReport() {
    const latest = store.getLatestRiskReport();
    if (latest && latest.reportId) {
      wx.navigateTo({
        url: '/pages/riskReport/index?reportId=' + encodeURIComponent(latest.reportId)
      });
      return;
    }
    wx.showToast({ title: '暂无风控报告', icon: 'none' });
  },

  goLongArchive() {
    wx.navigateTo({ url: '/pages/longArchive/index?from=mainchainOverview' });
  },

  goRiskCalculator() {
    wx.navigateTo({ url: '/pages/riskCalculator/index?source=overview' });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});