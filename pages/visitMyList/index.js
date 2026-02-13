// pages/visitMyList/index.js
// MOD: CLEAN_HARDCODED_API_BASE_20260103
// [熵盾-来访模块-我的来访预约列表（修复日期 & 取消预约）]

const funnel = require('../../utils/funnel.js');
const { API_BASE } = require('../../config'); // ✅ 引入 API_BASE 配置

function getBaseUrl() {
  return String(API_BASE || '').replace(/\/$/, ''); // ✅ 使用 API_BASE 来构建基础 URL
}

function ensureClientId() {
  const app = getApp && getApp();
  let cid = wx.getStorageSync('clientId') || wx.getStorageSync('st_client_id');
  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 900000) + 100000}`;
  }
  wx.setStorageSync('clientId', cid);
  wx.setStorageSync('st_client_id', cid);
  if (app && app.globalData) app.globalData.clientId = cid;
  return cid;
}

Page({
  data: {
    loading: false,
    list: [],
    statusTextMap: ['待确认', '已确认', '已完成', '已取消'],
    statusClassMap: [
      'status-pending',
      'status-confirmed',
      'status-done',
      'status-cancel'
    ]
  },

  onShow() {
    this.fetchList();
  },

  formatDate(isoOrDate) {
    if (!isoOrDate) return '';

    if (typeof isoOrDate === 'string') {
      if (!isoOrDate.includes('T')) return isoOrDate;

      const d = new Date(isoOrDate);
      if (Number.isNaN(d.getTime())) return isoOrDate.split('T')[0];

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

  formatDateTime(isoOrDateTime) {
    if (!isoOrDateTime) return '';

    let d;
    if (typeof isoOrDateTime === 'string') {
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

  fetchList() {
    const baseUrl = getBaseUrl(); // ✅ 使用 API_BASE 来获取 baseUrl
    const clientId = ensureClientId();

    this.setData({ loading: true });

    funnel.log('VISIT_MY_LIST_VIEW', { clientId, ts: Date.now() });

    wx.request({
      url: `${baseUrl}/api/visit/my-list`, // ✅ 使用动态构建的 URL
      method: 'GET',
      data: { clientId },
      success: (res) => {
        const data = res.data || {};
        if (data.ok) {
          const rawList = data.list || data.data || [];

          const list = rawList.map((item) => {
            const visitDateDisplay = this.formatDate(item.visitDate || item.visit_date);

            const visitTimeRange =
              item.visitTimeRange ||
              item.visit_time_range ||
              item.timeSlot ||
              item.time_slot ||
              '';

            const createdAtDisplay = this.formatDateTime(item.createdAt || item.created_at);

            return {
              ...item,
              visitDateDisplay,
              visitTimeRange,
              createdAt: createdAtDisplay
            };
          });

          this.setData({ list });
        } else {
          wx.showToast({ title: data.message || data.msg || '加载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  goBooking() {
    wx.navigateTo({ url: '/pages/visitBooking/index' });
  },

  onCancelVisit(e) {
    const baseUrl = getBaseUrl(); // ✅ 使用 API_BASE 来获取 baseUrl
    const ds = e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset : {};
    const tds = e.target && e.target.dataset ? e.target.dataset : {};

    const id = ds.id || tds.id;
    const rawStatus =
      ds.status !== undefined
        ? ds.status
        : (tds.status !== undefined ? tds.status : undefined);

    if (!id) {
      console.warn('[visitMyList] onCancelVisit 缺少 id, dataset =', ds, tds);
      return;
    }

    let statusNum;
    if (rawStatus === undefined || rawStatus === null || rawStatus === '') {
      statusNum = 0;
    } else {
      statusNum = Number(rawStatus);
    }

    if (statusNum === 2 || statusNum === 3) {
      wx.showToast({ title: '当前状态不可取消', icon: 'none' });
      return;
    }

    const clientId = ensureClientId();

    wx.showModal({
      title: '取消预约',
      content: '确认要取消这条来访预约吗？',
      confirmText: '确认取消',
      cancelText: '再想想',
      success: (res) => {
        if (!res.confirm) return;

        funnel.log('VISIT_CANCEL_CONFIRM', {
          clientId,
          id,
          status: statusNum,
          ts: Date.now()
        });

        wx.showLoading({ title: '正在取消...', mask: true });

        wx.request({
          url: `${baseUrl}/api/visit/cancel`, // ✅ 使用动态构建的 URL
          method: 'POST',
          header: { 'content-type': 'application/json' },
          data: { id, clientId },
          success: (resp) => {
            wx.hideLoading();
            const data = resp.data || {};
            if (data.ok) {
              wx.showToast({ title: '已取消预约', icon: 'success' });
              this.fetchList();
            } else {
              wx.showToast({ title: data.message || '取消失败', icon: 'none' });
            }
          },
          fail: () => {
            wx.hideLoading();
            wx.showToast({ title: '网络异常', icon: 'none' });
          }
        });
      }
    });
  }
});
