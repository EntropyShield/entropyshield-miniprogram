// pages/visitAdmin/index.js
// MOD: VISIT_ADMIN_ASCII_FINAL_20260313

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
    texts: {
      pageTitle: '\u6765\u8bbf\u7ba1\u7406',
      pageSubtitle: '\u5c4f\u67e5\u770b\u6240\u6709\u9884\u7ea6\uff0c\u53ca\u65f6\u786e\u8ba4 / \u5b8c\u6210 / \u53d6\u6d88\u3002',
      loadingTitle: '\u6b63\u5728\u52a0\u8f7d\u6765\u8bbf\u9884\u7ea6',
      loadingDesc: '\u8bf7\u7a0d\u5019\uff0c\u7cfb\u7edf\u6b63\u5728\u540c\u6b65\u6700\u65b0\u9884\u7ea6\u8bb0\u5f55\u3002',
      emptyTitle: '\u5f53\u524d\u7b5b\u9009\u4e0b\u6682\u65e0\u9884\u7ea6\u8bb0\u5f55',
      emptyDesc: '\u4f60\u53ef\u4ee5\u5207\u6362\u9876\u90e8\u72b6\u6001\u7b5b\u9009\uff0c\u67e5\u770b\u5176\u5b83\u9884\u7ea6\u8bb0\u5f55\u3002',
      unknownStatus: '\u672a\u77e5\u72b6\u6001',
      timeMissing: '\u65f6\u95f4\u672a\u586b',
      dash: '\u2014',
      unfilled: '\u672a\u586b\u5199',
      nameLabel: '\u79f0\u547c\uff1a',
      mobileLabel: '\u7535\u8bdd\uff1a',
      purposeLabel: '\u76ee\u7684\uff1a',
      remarkLabel: '\u5907\u6ce8\uff1a',
      createdAtLabel: '\u63d0\u4ea4\u65f6\u95f4\uff1a',
      idLabel: 'ID\uff1a',
      confirmBtn: '\u786e\u8ba4',
      doneBtn: '\u5b8c\u6210',
      cancelBtn: '\u53d6\u6d88',
      noPermission: '\u4ec5\u7ba1\u7406\u5458\u53ef\u8bbf\u95ee',
      apiMissing: '\u63a5\u53e3\u5730\u5740\u672a\u914d\u7f6e',
      loadFail: '\u52a0\u8f7d\u5931\u8d25',
      networkError: '\u7f51\u7edc\u5f02\u5e38',
      statusAlreadySame: '\u5f53\u524d\u5df2\u662f\u8be5\u72b6\u6001',
      updateStatusTitle: '\u66f4\u65b0\u9884\u7ea6\u72b6\u6001',
      updateSuccess: '\u72b6\u6001\u5df2\u66f4\u65b0',
      updateFail: '\u66f4\u65b0\u5931\u8d25',
      modalConfirm: '\u786e\u8ba4',
      modalCancel: '\u518d\u60f3\u60f3'
    },

    loading: false,
    hasLoaded: false,
    list: [],
    filteredList: [],
    activeStatus: 'all',
    updatingId: 0,
    updatingToStatus: -1,

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
      return String(isoOrDate).slice(0, 10);
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
      title: message || this.data.texts.noPermission,
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
      wx.showToast({ title: this.data.texts.apiMissing, icon: 'none' });
      this.setData({ loading: false, hasLoaded: true, list: [], filteredList: [] });
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
          wx.showToast({ title: data.message || this.data.texts.loadFail, icon: 'none' });
          this.setData({ list: [], filteredList: [] });
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
        wx.showToast({ title: this.data.texts.networkError, icon: 'none' });
        this.setData({ list: [], filteredList: [] });
      },
      complete: () => {
        this.setData({ loading: false, hasLoaded: true });
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
    const currentStatus = Number(e.currentTarget.dataset.currentStatus);

    if (!id || Number.isNaN(toStatus)) return;
    if (this.data.updatingId === id) return;

    if (!baseUrl || !clientId) {
      wx.showToast({ title: this.data.texts.apiMissing, icon: 'none' });
      return;
    }

    if (!Number.isNaN(currentStatus) && currentStatus === toStatus) {
      wx.showToast({ title: this.data.texts.statusAlreadySame, icon: 'none' });
      return;
    }

    const labelMap = this.data.statusTextMap || [];
    const label = labelMap[toStatus] || '\u72b6\u6001';

    wx.showModal({
      title: this.data.texts.updateStatusTitle,
      content: `\u786e\u8ba4\u5c06\u6b64\u9884\u7ea6\u6807\u8bb0\u4e3a\u300c${label}\u300d\uff1f`,
      confirmText: this.data.texts.modalConfirm,
      cancelText: this.data.texts.modalCancel,
      success: (res) => {
        if (!res.confirm) return;

        this.setData({
          updatingId: id,
          updatingToStatus: toStatus
        });

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
              const nextActiveStatus = this.data.activeStatus === 'all' ? 'all' : String(toStatus);
              this.setData({ activeStatus: nextActiveStatus });
              wx.showToast({ title: this.data.texts.updateSuccess, icon: 'success' });
              this.fetchList();
            } else {
              wx.showToast({ title: data.message || this.data.texts.updateFail, icon: 'none' });
            }
          },
          fail: (err) => {
            console.warn('[visitAdmin] update status fail:', err);
            wx.showToast({ title: this.data.texts.networkError, icon: 'none' });
          },
          complete: () => {
            this.setData({
              updatingId: 0,
              updatingToStatus: -1
            });
          }
        });
      }
    });
  }
});
