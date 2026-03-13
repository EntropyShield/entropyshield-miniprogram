// pages/visitAdmin/index.js
// MOD: VISIT_ADMIN_TEXT_FIX_20260313

const funnel = require('../../utils/funnel.js');
const { API_BASE } = require('../../config');

function getBaseUrl() {
  return String(API_BASE || '').replace(/\/$/, '');
}

function ensureClientId() {
  const appInst = getApp && getApp();
  let cid =
    (appInst && appInst.globalData && appInst.globalData.clientId) ||
    wx.getStorageSync('clientId') ||
    wx.getStorageSync('st_client_id');

  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  }

  wx.setStorageSync('clientId', cid);
  wx.setStorageSync('st_client_id', cid);
  if (appInst && appInst.globalData) appInst.globalData.clientId = cid;
  return cid;
}

Page({
  data: {
    loading: false,
    list: [],
    filteredList: [],
    activeStatus: 'all',
    statusTabs: [
      { key: 'all', label: '\u5168\u90e8' },
      { key: '0', label: '\u5f85\u786e\u8ba4' },
      { key: '1', label: '\u5df2\u786e\u8ba4' },
      { key: '2', label: '\u5df2\u5b8c\u6210' },
      { key: '3', label: '\u5df2\u53d6\u6d88' }
    ],
    statusTextMap: [
      '\u5f85\u786e\u8ba4',
      '\u5df2\u786e\u8ba4',
      '\u5df2\u5b8c\u6210',
      '\u5df2\u53d6\u6d88'
    ],
    statusClassMap: [
      'status-pill-pending',
      'status-pill-confirmed',
      'status-pill-done',
      'status-pill-cancel'
    ],
    counters: {
      all: 0,
      '0': 0,
      '1': 0,
      '2': 0,
      '3': 0
    }
  },

  onShow() {
    this.clientId = ensureClientId();
    funnel.log('VISIT_ADMIN_VIEW', { ts: Date.now() });
    this.fetchList();
  },

  formatDate(isoOrDate) {
    if (!isoOrDate) return '';

    if (typeof isoOrDate === 'string') {
      const d = new Date(isoOrDate);
      if (!Number.isNaN(d.getTime())) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      return isoOrDate.slice(0, 10);
    }

    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  formatDateTime(isoOrDateTime) {
    if (!isoOrDateTime) return '';
    const d = new Date(isoOrDateTime);
    if (Number.isNaN(d.getTime())) return String(isoOrDateTime || '');
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  },

  handleNoPermission(message) {
    wx.showToast({
      title: message || '\u4ec5\u7ba1\u7406\u5458\u53ef\u8bbf\u95ee',
      icon: 'none'
    });
    setTimeout(() => {
      wx.switchTab({ url: '/pages/profile/index' });
    }, 800);
  },

  recomputeCounters(list) {
    const counters = {
      all: list.length,
      '0': 0,
      '1': 0,
      '2': 0,
      '3': 0
    };

    list.forEach((item) => {
      const key = String(item.status);
      if (Object.prototype.hasOwnProperty.call(counters, key)) {
        counters[key] += 1;
      }
    });

    this.setData({ counters });
  },

  applyFilter() {
    const { list, activeStatus } = this.data;
    let filtered = list;

    if (activeStatus !== 'all') {
      const target = parseInt(activeStatus, 10);
      filtered = list.filter((item) => Number(item.status) === target);
    }

    this.setData({ filteredList: filtered });
  },

  fetchList() {
    const baseUrl = getBaseUrl();
    const clientId = this.clientId || ensureClientId();

    if (!baseUrl || !clientId) {
      wx.showToast({ title: '\u63a5\u53e3\u5730\u5740\u672a\u914d\u7f6e', icon: 'none' });
      return;
    }

    this.setData({ loading: true });

    wx.request({
      url: `${baseUrl}/api/visit/list`,
      method: 'GET',
      data: {
        limit: 100,
        clientId
      },
      success: (res) => {
        const data = res.data || {};
        console.log('[visitAdmin] raw response =', data);

        if (res.statusCode === 403 || data.message === '\u65e0\u6743\u9650\u8bbf\u95ee') {
          this.handleNoPermission();
          return;
        }

        if (!data.ok) {
          wx.showToast({ title: data.message || '\u52a0\u8f7d\u5931\u8d25', icon: 'none' });
          return;
        }

        const rawList = data.list || data.data || [];
        const list = rawList.map((item) => {
          const visitDateDisplay = this.formatDate(item.visitDate || item.visit_date);
          const visitTimeRange = item.visitTimeRange || item.visit_time_range || '';
          const createdAtDisplay = this.formatDateTime(item.createdAt || item.created_at);

          return {
            ...item,
            id: Number(item.id),
            status: Number(item.status || 0),
            visitDateDisplay,
            visitTimeRange,
            createdAt: createdAtDisplay
          };
        });

        console.log('[visitAdmin] normalized list length:', list.length);

        this.setData({ list });
        this.recomputeCounters(list);
        this.applyFilter();
      },
      fail: (err) => {
        console.warn('[visitAdmin] fetch list fail:', err);
        wx.showToast({ title: '\u7f51\u7edc\u5f02\u5e38', icon: 'none' });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  onStatusTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeStatus) return;
    this.setData({ activeStatus: key });
    this.applyFilter();
  },

  onUpdateStatusTap(e) {
    const baseUrl = getBaseUrl();
    const clientId = this.clientId || ensureClientId();
    const id = Number(e.currentTarget.dataset.id || 0);
    const toStatus = Number(e.currentTarget.dataset.status);

    if (!id || Number.isNaN(toStatus)) return;

    const labelMap = this.data.statusTextMap || [];
    const label = labelMap[toStatus] || '\u72b6\u6001';

    wx.showModal({
      title: '\u66f4\u65b0\u9884\u7ea6\u72b6\u6001',
      content: `\u786e\u8ba4\u5c06\u6b64\u9884\u7ea6\u6807\u8bb0\u4e3a\u300c${label}\u300d\uff1f`,
      confirmText: '\u786e\u8ba4',
      cancelText: '\u518d\u60f3\u60f3',
      success: (res) => {
        if (!res.confirm) return;

        funnel.log('VISIT_ADMIN_UPDATE_STATUS', { id, toStatus, ts: Date.now() });

        wx.request({
          url: `${baseUrl}/api/visit/admin/update-status`,
          method: 'POST',
          header: { 'content-type': 'application/json' },
          data: {
            id,
            status: toStatus,
            clientId
          },
          success: (resp) => {
            const data = resp.data || {};

            if (resp.statusCode === 403 || data.message === '\u65e0\u6743\u9650\u8bbf\u95ee') {
              this.handleNoPermission();
              return;
            }

            if (data.ok) {
              wx.showToast({ title: '\u72b6\u6001\u5df2\u66f4\u65b0', icon: 'none' });
              this.fetchList();
            } else {
              wx.showToast({ title: data.message || '\u66f4\u65b0\u5931\u8d25', icon: 'none' });
            }
          },
          fail: (err) => {
            console.warn('[visitAdmin] update status fail:', err);
            wx.showToast({ title: '\u7f51\u7edc\u5f02\u5e38', icon: 'none' });
          }
        });
      }
    });
  }
});
