// pages/longArchive/index.js
const store = require('../../utils/mainchainStore.js');
const linkage = require('../../utils/mainchainLinkage.js');

function safeList(v) {
  return Array.isArray(v) ? v : [];
}

function buildAiReview(item = {}) {
  const code = linkage.safeText(item.code || item.symbol || item.name, '当前档案');
  const reportId = linkage.safeText(item.reportId || '', '未绑定');
  const targetProfit = linkage.safeText(item.targetProfit || item.targetPrice || item.takeProfitPrice || '未设置');
  const riskText = linkage.safeText(item.maxLossAmount || item.riskAmount || item.totalRisk || item.totalLoss || '未识别');
  const behavior = linkage.safeText(item.behaviorTag || item.executionTag || '需继续复盘');

  return {
    summary: `档案 ${code} 已进入长期复盘，绑定 reportId 为 ${reportId}。`,
    mistakeReview: `先复盘是否偏离计划，重点检查目标利润 ${targetProfit} 与执行偏差。`,
    disciplineReview: `纪律检查优先围绕风险口径 ${riskText}，不要临盘改规则。`,
    behaviorReview: `当前行为标签：${behavior}。继续保留有效动作，删除拖延和临盘冲动。`,
    nextSuggestion: `下一步先对照对应报告，再回看交易记录，把可复用动作固化为标准样本。`
  };
}

function moveHitToTop(list = [], hitIndex = -1) {
  if (!Array.isArray(list) || !list.length || hitIndex <= 0) return list;
  const hit = list[hitIndex];
  return [hit].concat(list.slice(0, hitIndex)).concat(list.slice(hitIndex + 1));
}

Page({
  data: {
    list: [],
    totalCount: 0,
    latestTime: '',
    aiReviewMap: {},
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
    let list = safeList(raw).map(item => ({
      ...item,
      __activeKey: linkage.safeText(item.archiveId || item.reportId || item.draftId || item.id, '')
    }));

    const hit = linkage.locateArchiveItem(list, this.data.reportId, this.data.focus);
    if (hit && hit.index >= 0) {
      list = moveHitToTop(list, hit.index);
    }

    const aiReviewMap = {};
    list.forEach(item => {
      const key = item.archiveId || item.reportId || item.draftId || item.createdAt || Math.random();
      aiReviewMap[key] = buildAiReview(item);
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
