// pages/visitAdmin/index.js
// [熵盾-来访模块-管理端列表]

const funnel = require('../../utils/funnel.js');

const API_BASE_URL = 'http://localhost:3000';

Page({
  data: {
    loading: false,

    // 原始列表（接口返回的所有预约）
    list: [],

    // 按状态筛选后的列表，用于渲染
    filteredList: [],

    // 当前筛选状态：all | 0 | 1 | 2 | 3
    activeStatus: 'all',

    // 顶部状态 Tab
    statusTabs: [
      { key: 'all', label: '全部' },
      { key: '0', label: '待确认' },
      { key: '1', label: '已确认' },
      { key: '2', label: '已完成' },
      { key: '3', label: '已取消' }
    ],

    // 状态文案 & 样式
    statusTextMap: ['待确认', '已确认', '已完成', '已取消'],
    statusClassMap: [
      'status-pill-pending',
      'status-pill-confirmed',
      'status-pill-done',
      'status-pill-cancel'
    ],

    // 各状态数量统计
    counters: {
      all: 0,
      '0': 0,
      '1': 0,
      '2': 0,
      '3': 0
    }
  },

  onShow() {
    funnel.log('VISIT_ADMIN_VIEW', {
      ts: Date.now()
    });
    this.fetchList();
  },

  // 将日期转成 YYYY-MM-DD（兼容字符串 / 时间戳）
  formatDate(isoOrDate) {
    if (!isoOrDate) return '';

    if (typeof isoOrDate === 'string') {
      // 已经是 "YYYY-MM-DD" 直接返回
      if (!isoOrDate.includes('T')) {
        return isoOrDate;
      }

      const d = new Date(isoOrDate);
      if (Number.isNaN(d.getTime())) {
        // 解析失败兜底：取 T 前
        return isoOrDate.split('T')[0];
      }
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  // 提交时间：转成 YYYY-MM-DD HH:mm
  formatDateTime(isoOrDateTime) {
    if (!isoOrDateTime) return '';

    let d;
    if (typeof isoOrDateTime === 'string') {
      // 已经是 "YYYY-MM-DD HH:mm" 直接返回
      if (isoOrDateTime.includes(' ') && !isoOrDateTime.includes('T')) {
        return isoOrDateTime;
      }
      d = new Date(isoOrDateTime);
    } else {
      d = new Date(isoOrDateTime);
    }

    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  },

  // 拉取预约列表（管理端视角）
  fetchList() {
    this.setData({ loading: true });

    wx.request({
      url: `${API_BASE_URL}/api/visit/list`,
      method: 'GET',
      data: {
        limit: 100 // 管理端看最近 100 条足够
      },
      success: (res) => {
        const data = res.data || {};
        if (!data.ok) {
          wx.showToast({
            title: data.message || '加载失败',
            icon: 'none'
          });
          return;
        }

        const rawList = data.list || data.data || [];

        const list = rawList.map((item) => {
          const visitDateDisplay = this.formatDate(
            item.visitDate || item.visit_date
          );

          const visitTimeRange =
            item.visitTimeRange ||
            item.visit_time_range ||
            '';

          const createdAtDisplay = this.formatDateTime(
            item.createdAt || item.created_at
          );

          return {
            ...item,
            visitDateDisplay,
            visitTimeRange,
            createdAt: createdAtDisplay
          };
        });

        this.setData({ list });

        this.recomputeCounters(list);
        this.applyFilter();
      },
      fail: () => {
        wx.showToast({
          title: '网络异常',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  // 重新统计各状态数量
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

  // 按当前 activeStatus 过滤列表
  applyFilter() {
    const { list, activeStatus } = this.data;
    let filtered = list;

    if (activeStatus !== 'all') {
      const target = parseInt(activeStatus, 10);
      filtered = list.filter((item) => Number(item.status) === target);
    }

    this.setData({ filteredList: filtered });
  },

  // 顶部状态 Tab 点击
  onStatusTabTap(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeStatus) return;

    this.setData({ activeStatus: key });
    this.applyFilter();
  },

  // 管理端更新预约状态
  onUpdateStatusTap(e) {
    const id = e.currentTarget.dataset.id;
    const toStatus = Number(e.currentTarget.dataset.status);

    if (!id || Number.isNaN(toStatus)) return;

    const labelMap = this.data.statusTextMap || [];
    const label = labelMap[toStatus] || '状态';

    wx.showModal({
      title: '更新预约状态',
      content: `确认将此预约标记为「${label}」？`,
      confirmText: '确认',
      cancelText: '再想想',
      success: (res) => {
        if (!res.confirm) return;

        funnel.log('VISIT_ADMIN_UPDATE_STATUS', {
          id,
          toStatus,
          ts: Date.now()
        });

        wx.request({
          url: `${API_BASE_URL}/api/visit/admin/update-status`,
          method: 'POST',
          data: {
            id,
            status: toStatus
          },
          success: (resp) => {
            const data = resp.data || {};
            if (data.ok) {
              wx.showToast({
                title: '状态已更新',
                icon: 'none'
              });
              this.fetchList();
            } else {
              wx.showToast({
                title: data.message || '更新失败',
                icon: 'none'
              });
            }
          },
          fail: () => {
            wx.showToast({
              title: '网络异常',
              icon: 'none'
            });
          }
        });
      }
    });
  }
});
