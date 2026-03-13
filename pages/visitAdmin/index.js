// pages/visitAdmin/index.js
// MOD: VISIT_ADMIN_STATUS_GUARD_20260313

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
    updatingId: 0,
    updatingToStatus: -1,

    statusTabs: [
      { key: 'all', label: '全部' },
      { key: '0', label: '待确认' },
      { key: '1', label: '已确认' },
      { key: '2', label: '已完成' },
      { key: '3', label: '已取消' }
    ],
    statusTextMap: [
      '待确认',
      '已确认',
      '已完成',
      '已取消'
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
      title: message || '仅管理员可访问',
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
      wx.showToast({ title: '接口地址未配置', icon: 'none' });
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

        if (res.statusCode === 403 || data.message === '无权限访问') {
          this.handleNoPermission();
          return;
        }

        if (!data.ok) {
          wx.showToast({ title: data.message || '加载失败', icon: 'none' });
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
        wx.showToast({ title: '网络异常', icon: 'none' });
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
    const currentStatus = Number(e.currentTarget.dataset.currentStatus);

    if (!id || Number.isNaN(toStatus)) return;
    if (this.data.updatingId === id) return;
    if (!baseUrl || !clientId) {
      wx.showToast({ title: '接口地址未配置', icon: 'none' });
      return;
    }
    if (!Number.isNaN(currentStatus) && currentStatus === toStatus) {
      wx.showToast({ title: '当前已是该状态', icon: 'none' });
      return;
    }

    const labelMap = this.data.statusTextMap || [];
    const label = labelMap[toStatus] || '状态';

    wx.showModal({
      title: '更新预约状态',
      content: `确认将此预约标记为「${label}」？`,
      confirmText: '确认',
      cancelText: '再想想',
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

            if (resp.statusCode === 403 || data.message === '无权限访问') {
              this.handleNoPermission();
              return;
            }

            if (data.ok) {
              wx.showToast({ title: '状态已更新', icon: 'success' });
              this.fetchList();
            } else {
              wx.showToast({ title: data.message || '更新失败', icon: 'none' });
            }
          },
          fail: (err) => {
            console.warn('[visitAdmin] update status fail:', err);
            wx.showToast({ title: '网络异常', icon: 'none' });
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