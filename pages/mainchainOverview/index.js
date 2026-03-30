// pages/mainchainOverview/index.js
const store = require('../../utils/mainchainStore.js');
const linkage = require('../../utils/mainchainLinkage.js');

const PLAN_TYPE_MAP = {
  steady: '稳健方案',
  advanced: '加强方案'
};

const EXECUTION_STATUS_MAP = {
  pending: '待执行',
  planned: '已计划',
  partial: '部分执行',
  deviated: '已偏离',
  done: '已完成',
  archived: '已归档'
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

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map(item => safeText(item, '')).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[，,、|]/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

function tagsToText(value) {
  const list = normalizeTags(value);
  return list.length ? list.join(' / ') : '无';
}

function normalizeExecutionStatus(value) {
  const raw = safeText(value, '').toLowerCase();
  return raw || 'pending';
}

function getPlanTypeText(v) {
  return PLAN_TYPE_MAP[v] || safeText(v, '当前方案');
}

function getExecutionStatusText(v) {
  const key = normalizeExecutionStatus(v);
  return EXECUTION_STATUS_MAP[key] || safeText(v, '待执行');
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

  const deviationTags = normalizeTags(item.deviationTags);
  const archiveTags = normalizeTags(item.archiveTags);

  return {
    ...item,
    stopLossPrice: stopLossPrice || '—',
    maxLossAmount: maxLossAmount || '—',
    riskAmount: maxLossAmount || '—',
    totalRisk: maxLossAmount || '—',
    totalLoss: maxLossAmount || '—',
    source: safeText(item.source, DISPLAY_SOURCE),
    entryVersion: safeText(item.entryVersion, DISPLAY_VERSION),
    planTypeText: getPlanTypeText(item.planType),
    executionStatus: normalizeExecutionStatus(item.executionStatus),
    executionStatusText: getExecutionStatusText(item.executionStatus),
    srrScoreText: item.srrScore === null || item.srrScore === undefined || item.srrScore === ''
      ? '待评分'
      : String(item.srrScore),
    deviationTags,
    deviationTagsText: tagsToText(item.deviationTags),
    groupTag: safeText(item.groupTag, ''),
    stageTag: safeText(item.stageTag, ''),
    archiveTags,
    archiveTagsText: tagsToText(item.archiveTags),
    disciplineTips: normalizeTags(item.disciplineTips)
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

function buildEntityScoreLine(label, entity = {}) {
  const code = safeText(entity.code || entity.symbol || entity.name, '—');
  const plan = safeText(entity.planTypeText || getPlanTypeText(entity.planType), '当前方案');
  const score = safeText(entity.srrScoreText || entity.srrScore, '待评分');
  const status = safeText(entity.executionStatusText || getExecutionStatusText(entity.executionStatus), '待执行');
  const deviation = safeText(entity.deviationTagsText || tagsToText(entity.deviationTags), '无');
  const groupTag = safeText(entity.groupTag, '无');
  const stageTag = safeText(entity.stageTag, '无');
  const archiveTags = safeText(entity.archiveTagsText || tagsToText(entity.archiveTags), '无');

  return `${label}：标的 ${code}，方案 ${plan}，SRR ${score}，状态 ${status}，偏差 ${deviation}，组标签 ${groupTag}，阶段标签 ${stageTag}，档案标签 ${archiveTags}。`;
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

  const overviewLine = `当前主链共有交易记录 ${ctx.tradeCount || 0} 条，风控报告 ${ctx.reportCount || 0} 条，长期档案 ${ctx.archiveCount || 0} 条。`;

  const tradeLine = buildEntityScoreLine('最新交易记录', latestTrade);
  const reportLine = buildEntityScoreLine('最新风控报告', latestReport);
  const archiveLine = buildEntityScoreLine('最新长期档案', latestArchive);

  const nextActionLine = `当前建议：优先查看最新风控报告与长期档案是否已经完成评分、执行状态和偏差标签回写，再决定下一次生成方案或继续复盘。`;

  if (!q) {
    return [overviewLine, tradeLine, reportLine, archiveLine, nextActionLine].join('\n\n');
  }

  if (q.includes('评分') || q.includes('srr')) {
    return [
      overviewLine,
      `最新评分概况：交易记录 ${safeText(latestTrade.srrScoreText, '待评分')}，风控报告 ${safeText(latestReport.srrScoreText, '待评分')}，长期档案 ${safeText(latestArchive.srrScoreText, '待评分')}。`,
      nextActionLine
    ].join('\n\n');
  }

  if (q.includes('执行') || q.includes('状态')) {
    return [
      overviewLine,
      `最新执行状态：交易记录 ${safeText(latestTrade.executionStatusText, '待执行')}，风控报告 ${safeText(latestReport.executionStatusText, '待执行')}，长期档案 ${safeText(latestArchive.executionStatusText, '待执行')}。`,
      nextActionLine
    ].join('\n\n');
  }

  if (q.includes('偏差') || q.includes('标签')) {
    return [
      overviewLine,
      `最新偏差与标签：交易记录 ${safeText(latestTrade.deviationTagsText, '无')}；风控报告 ${safeText(latestReport.deviationTagsText, '无')}；长期档案 ${safeText(latestArchive.archiveTagsText, '无')}。`,
      `组标签：${safeText(latestReport.groupTag || latestArchive.groupTag, '无')}；阶段标签：${safeText(latestReport.stageTag || latestArchive.stageTag, '无')}。`
    ].join('\n\n');
  }

  if (q.includes('交易记录')) {
    return [tradeLine, nextActionLine].join('\n\n');
  }

  if (q.includes('报告')) {
    return [reportLine, nextActionLine].join('\n\n');
  }

  if (q.includes('档案')) {
    return [archiveLine, nextActionLine].join('\n\n');
  }

  return [overviewLine, tradeLine, reportLine, archiveLine, nextActionLine].join('\n\n');
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
    quickQuestions: ['当前状态', '最新评分怎么看', '执行状态怎么看', '偏差标签怎么看', '下一步做什么']
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
    const latestTrade = getLatestTrade();
    const latestReport = getLatestReport();
    const reportId = linkage.pickReportId
      ? linkage.pickReportId(latestTrade || latestReport || {})
      : safeText((latestTrade && latestTrade.reportId) || (latestReport && latestReport.reportId), '');

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
    const latestArchive = getLatestArchive();
    const latestReport = getLatestReport();
    const reportId = linkage.pickReportId
      ? linkage.pickReportId(latestArchive || latestReport || {})
      : safeText((latestArchive && latestArchive.reportId) || (latestReport && latestReport.reportId), '');

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