// pages/tradeRecord/index.js
const store = require('../../utils/mainchainStore.js');
const linkage = require('../../utils/mainchainLinkage.js');

function safeList(v) {
  return Array.isArray(v) ? v : [];
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
    from: '',
    focus: '',
    reportId: '',
    activeRecordId: ''
  },

  onLoad(options = {}) {
    const nav = linkage.parseNavOptions(options, 'tradeRecord');
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
    const raw = store.getTradeRecords ? store.getTradeRecords() : [];
    let list = safeList(raw).map(item => ({
      ...item,
      __activeKey: linkage.safeText(item.recordId || item.reportId || item.id, '')
    }));

    const hit = linkage.locateTradeItem(list, this.data.reportId, this.data.focus);
    if (hit && hit.index >= 0) {
      list = moveHitToTop(list, hit.index);
    }

    const first = list[0] || {};
    this.setData({
      list,
      totalCount: list.length,
      latestTime: list.length ? (list[0].timeText || '') : '',
      activeRecordId: linkage.safeText(first.recordId || first.reportId || first.id, '')
    });
  },

  clearList() {
    const list = this.data.list || [];
    if (!list.length) {
      wx.showToast({ title: '暂无可清空记录', icon: 'none' });
      return;
    }
    if (store.clearTradeRecords) {
      store.clearTradeRecords();
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

  goLatestRiskReport() {
    const reportId = this.getCurrentReportId();
    if (!reportId) {
      wx.showToast({ title: '暂无风控报告', icon: 'none' });
      return;
    }
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/riskReport/index', {
        from: 'tradeRecord',
        focus: 'reportId',
        reportId
      })
    });
  },

  goRiskReport() {
    this.goLatestRiskReport();
  },

  goLongArchive() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/longArchive/index', {
        from: 'tradeRecord',
        focus: reportId ? 'reportId' : '',
        reportId
      })
    });
  },

  
  goRiskCalculator() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index?from=tradeRecord'
    });
  },

  goMainchainOverview() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/mainchainOverview/index', {
        from: 'tradeRecord',
        focus: reportId ? 'reportId' : '',
        reportId
      })
    });
  }
});
