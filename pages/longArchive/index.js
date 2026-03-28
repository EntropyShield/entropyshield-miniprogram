// pages/longArchive/index.js
const store = require('../../utils/mainchainStore.js');
const linkage = require('../../utils/mainchainLinkage.js');

const PLAN_TYPE_MAP = {
  steady: '稳健方案',
  advanced: '加强方案'
};

function safeList(v) {
  return Array.isArray(v) ? v : [];
}

function safeText(v, d = '—') {
  if (v === undefined || v === null) return d;
  const s = String(v).trim();
  return s ? s : d;
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

function moveHitToTop(list = [], hitIndex = -1) {
  if (!Array.isArray(list) || !list.length || hitIndex <= 0) return list;
  const hit = list[hitIndex];
  return [hit].concat(list.slice(0, hitIndex)).concat(list.slice(hitIndex + 1));
}

function getPlanTypeText(item = {}) {
  return PLAN_TYPE_MAP[item.planType] || safeText(item.planType, '当前方案');
}

function buildAiReview(item = {}) {
  const code = safeText(item.code || item.symbol || item.name, '当前档案');
  const reportId = safeText(item.reportId || '', '未绑定');
  const targetProfit = safeText(item.targetProfit || item.targetPrice || item.takeProfitPrice || '', '未设置');
  const targetPrice = safeText(item.targetPrice || '', '未设置');
  const riskText = safeText(
    item.maxLossAmount || item.riskAmount || item.totalRisk || item.totalLoss || '',
    '未识别'
  );
  const behavior = safeText(item.behaviorTag || item.executionTag || '', '需继续复盘');
  const stepCount = safeList(item.steps).length;
  const planTypeText = getPlanTypeText(item);

  return {
    summary: `${code} 已进入长期档案，绑定报告 ${reportId}。这条记录的复盘重点不是预测涨跌，而是验证 ${planTypeText} 是否被完整执行。`,
    mistakeReview: stepCount
      ? `本次共有 ${stepCount} 个执行步骤，先检查是否按步骤推进；再核对目标价 ${targetPrice} 与目标利润 ${targetProfit} 是否被提前破坏。`
      : `当前未识别出完整执行步骤，后续要优先补足“如何进、何时退、何时止损”的过程记录。`,
    disciplineReview: `纪律复盘要先看风险口径 ${riskText}。一旦出现临盘改规则、拖延执行或放宽退出边界，都应判定为纪律失守。`,
    behaviorReview: `当前行为标签为：${behavior}。复盘时重点删掉冲动加仓、犹豫止损、达到目标后继续恋战这类动作。`,
    nextSuggestion: `下一步建议：先对照对应风控报告，再回看交易记录，最后把这条档案固化成下一轮可复制的执行模板。`
  };
}

Page({
  data: {
    list: [],
    totalCount: 0,
    latestTime: '',
    aiReviewMap: {},
    planTypeMap: PLAN_TYPE_MAP,
    from: '',
    focus: '',
    reportId: '',
    activeArchiveId: ''
  },

  onLoad(options = {}) {
    const nav = linkage.parseNavOptions(options, 'longArchive');
    this.setData({
      from: nav.from,
      focus: nav.focus,
      reportId: nav.reportId
    });
    this.loadList();
  },

  onShow() {
    this.loadList();
  },

  loadList() {
    const raw = store.getLongArchivesSorted ? store.getLongArchivesSorted() : [];
    let list = safeList(raw).map(item => {
      const reviewKey = item.archiveId || item.reportId || item.draftId || item.createdAt || String(Date.now());
      return {
        ...item,
        archivedTimeText: fmtTime(item.archivedAt || item.createdAt || item.generatedAt || 0),
        __activeKey: linkage.safeText(item.archiveId || item.reportId || item.draftId || item.id, ''),
        __reviewKey: reviewKey,
        __planTypeText: getPlanTypeText(item),
        __stepsCount: safeList(item.steps).length
      };
    });

    const hit = linkage.locateArchiveItem(list, this.data.reportId, this.data.focus);
    if (hit && hit.index >= 0) {
      list = moveHitToTop(list, hit.index);
    }

    const aiReviewMap = {};
    list.forEach(item => {
      aiReviewMap[item.__reviewKey] = buildAiReview(item);
    });

    const first = list[0] || {};
    this.setData({
      list,
      totalCount: list.length,
      latestTime: list.length ? (list[0].archivedTimeText || '') : '',
      aiReviewMap,
      activeArchiveId: linkage.safeText(first.archiveId || first.reportId || first.draftId || first.id, '')
    });
  },

  clearList() {
    const list = this.data.list || [];
    if (!list.length) {
      wx.showToast({ title: '暂无可清空档案', icon: 'none' });
      return;
    }
    if (store.clearLongArchives) {
      store.clearLongArchives();
    }
    this.loadList();
    wx.showToast({ title: '已清空', icon: 'success' });
  },

  clearAll() {
    this.clearList();
  },

  onClearList() {
    this.clearList();
  },

  getCurrentReportId() {
    const first = (this.data.list && this.data.list[0]) || {};
    const latest = store.getLatestRiskReport ? (store.getLatestRiskReport() || {}) : {};
    return linkage.safeText(
      this.data.reportId ||
      first.reportId ||
      latest.reportId ||
      '',
      ''
    );
  },

  goTradeRecord() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/tradeRecord/index', {
        from: 'longArchive',
        focus: reportId ? 'reportId' : '',
        reportId
      })
    });
  },

  goLatestRiskReport() {
    const reportId = this.getCurrentReportId();
    if (!reportId) {
      wx.showToast({ title: '暂无风控报告', icon: 'none' });
      return;
    }
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/riskReport/index', {
        from: 'longArchive',
        focus: 'reportId',
        reportId
      })
    });
  },

  goRiskReport() {
    this.goLatestRiskReport();
  },

  goMainchainOverview() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/mainchainOverview/index', {
        from: 'longArchive',
        focus: reportId ? 'reportId' : '',
        reportId
      })
    });
  },

  goRiskCalculator() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index?from=longArchive'
    });
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});