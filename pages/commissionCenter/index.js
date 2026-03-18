const { API_BASE } = require('../../config');

function request(url, data = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: String(API_BASE || '').replace(/\/$/, '') + url,
      method: 'GET',
      data,
      success: (res) => {
        const d = res.data || {};
        if (d.ok) resolve(d);
        else reject(new Error(d.error || d.message || 'request failed'));
      },
      fail: reject
    });
  });
}

function mapStatusLabel(status) {
  const s = String(status || '').trim().toLowerCase();
  if (s === 'unsettled') return '处理中';
  if (s === 'settled') return '已完成';
  if (s === 'reversed') return '已冲回';
  return status || '-';
}

Page({
  data: {
    activeTab: 'detail',

    auditLoading: false,
    auditSummary: null,

    detailLoading: false,
    rankingLoading: false,

    detailPage: 1,
    detailPageSize: 20,
    detailTotal: 0,
    detailStatus: '',
    detailKeyword: '',
    detailList: [],

    rankingMetric: 'commission_amount',
    rankingPeriod: 'all',
    rankingList: [],

    statusOptions: [
      { label: '全部', value: '' },
      { label: '处理中', value: 'unsettled' },
      { label: '已完成', value: 'settled' },
      { label: '已冲回', value: 'reversed' }
    ],
    metricOptions: [
      { label: '按贡献值', value: 'commission_amount' },
      { label: '按记录数', value: 'commission_count' }
    ],
    periodOptions: [
      { label: '全部', value: 'all' },
      { label: '30天', value: '30d' },
      { label: '7天', value: '7d' }
    ]
  },

  onLoad() {
    this.loadAuditSummary();
    this.loadDetail();
    this.loadRanking();
  },

  onPullDownRefresh() {
    Promise.allSettled([
      this.loadAuditSummary(),
      this.loadDetail(),
      this.loadRanking()
    ]).finally(() => {
      wx.stopPullDownRefresh();
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
  },

  onKeywordInput(e) {
    this.setData({ detailKeyword: e.detail.value || '' });
  },

  onSearchTap() {
    this.setData({ detailPage: 1 });
    this.loadDetail();
  },

  clearSearch() {
    this.setData({ detailKeyword: '', detailPage: 1 });
    this.loadDetail();
  },

  switchStatus(e) {
    const status = e.currentTarget.dataset.value || '';
    this.setData({ detailStatus: status, detailPage: 1 });
    this.loadDetail();
  },

  switchMetric(e) {
    const metric = e.currentTarget.dataset.value;
    this.setData({ rankingMetric: metric });
    this.loadRanking();
  },

  switchPeriod(e) {
    const period = e.currentTarget.dataset.value;
    this.setData({ rankingPeriod: period });
    this.loadRanking();
  },

  async loadAuditSummary() {
    this.setData({ auditLoading: true });
    try {
      const data = await request('/api/fission/audit-summary');
      this.setData({
        auditSummary: data || null
      });
    } catch (err) {
      wx.showToast({
        title: err.message || '统计说明加载失败',
        icon: 'none'
      });
    } finally {
      this.setData({ auditLoading: false });
    }
  },

  async loadDetail() {
    this.setData({ detailLoading: true });
    try {
      const data = await request('/api/fission/commissions', {
        page: this.data.detailPage,
        pageSize: this.data.detailPageSize,
        status: this.data.detailStatus,
        keyword: this.data.detailKeyword
      });

      const list = (data.list || []).map(item => ({
        ...item,
        statusLabel: mapStatusLabel(item.status)
      }));

      this.setData({
        detailList: list,
        detailTotal: data.total || 0
      });
    } catch (err) {
      wx.showToast({ title: err.message || '记录加载失败', icon: 'none' });
    } finally {
      this.setData({ detailLoading: false });
    }
  },

  async loadRanking() {
    this.setData({ rankingLoading: true });
    try {
      const data = await request('/api/fission/commission-rankings', {
        metric: this.data.rankingMetric,
        period: this.data.rankingPeriod,
        limit: 20
      });
      this.setData({ rankingList: data.list || [] });
    } catch (err) {
      wx.showToast({ title: err.message || '排行加载失败', icon: 'none' });
    } finally {
      this.setData({ rankingLoading: false });
    }
  }
});