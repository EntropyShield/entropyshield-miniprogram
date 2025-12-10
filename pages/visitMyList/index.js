// pages/visitMyList/index.js
// [熵盾-来访模块-我的来访预约列表（修复日期 & 取消预约）]

const funnel = require('../../utils/funnel.js');

const API_BASE_URL = 'http://localhost:3000';
const CLIENT_ID_KEY = 'st_client_id';

// 自动生成 / 获取 clientId
function ensureClientId() {
  let cid = wx.getStorageSync(CLIENT_ID_KEY);
  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 900000) + 100000}`;
    wx.setStorageSync(CLIENT_ID_KEY, cid);
  }
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

  // 将数据库返回的日期转成本地 YYYY-MM-DD（解决少一天的问题）
  formatDate(isoOrDate) {
    if (!isoOrDate) return '';

    // 字符串情况
    if (typeof isoOrDate === 'string') {
      // 如果是纯日期 "YYYY-MM-DD"，直接返回
      if (!isoOrDate.includes('T')) {
        return isoOrDate;
      }

      // 带 T/Z 的 ISO 字符串，用 Date 解析成本地时间再取年月日
      const d = new Date(isoOrDate);
      if (Number.isNaN(d.getTime())) {
        // 解析失败兜底：直接取 T 前面的部分
        return isoOrDate.split('T')[0];
      }
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    // 非字符串，认为是 Date 对象或时间戳
    const d = new Date(isoOrDate);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  // 提交时间：格式化为 YYYY-MM-DD HH:mm
  formatDateTime(isoOrDateTime) {
    if (!isoOrDateTime) return '';

    let d;
    if (typeof isoOrDateTime === 'string') {
      // 已经是 "YYYY-MM-DD HH:mm" 就直接返回
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

  // 拉取“我的来访预约”列表
  fetchList() {
    const clientId = ensureClientId();

    this.setData({ loading: true });

    funnel.log('VISIT_MY_LIST_VIEW', {
      clientId,
      ts: Date.now()
    });

    wx.request({
      url: `${API_BASE_URL}/api/visit/my-list`,
      method: 'GET',
      data: { clientId },
      success: (res) => {
        const data = res.data || {};
        if (data.ok) {
          const rawList = data.list || data.data || [];

          const list = rawList.map((item) => {
            const visitDateDisplay = this.formatDate(
              item.visitDate || item.visit_date
            );

            const visitTimeRange =
              item.visitTimeRange ||
              item.visit_time_range ||
              item.timeSlot ||
              item.time_slot ||
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
        } else {
          wx.showToast({
            title: data.message || data.msg || '加载失败',
            icon: 'none'
          });
        }
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

  // 去预约页
  goBooking() {
    wx.navigateTo({
      url: '/pages/visitBooking/index'
    });
  },

  // [熵盾-来访模块-用户取消预约]
  // 对应 WXML 里的 bindtap="onCancelVisit"
  onCancelVisit(e) {
    // 同时从 currentTarget 和 target 兜底读取 data-*
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

    // 如果 status 取不到，就按待确认(0) 处理，允许取消
    let statusNum;
    if (rawStatus === undefined || rawStatus === null || rawStatus === '') {
      statusNum = 0;
    } else {
      statusNum = Number(rawStatus);
    }

    // 只有 已完成(2) / 已取消(3) 时禁止取消
    if (statusNum === 2 || statusNum === 3) {
      wx.showToast({
        title: '当前状态不可取消',
        icon: 'none'
      });
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

        wx.showLoading({
          title: '正在取消...',
          mask: true
        });

        wx.request({
          url: `${API_BASE_URL}/api/visit/cancel`,
          method: 'POST',
          header: {
            'content-type': 'application/json'
          },
          data: { id, clientId },
          success: (resp) => {
            wx.hideLoading();
            const data = resp.data || {};
            if (data.ok) {
              wx.showToast({
                title: '已取消预约',
                icon: 'success'
              });
              // 重新拉取列表
              this.fetchList();
            } else {
              wx.showToast({
                title: data.message || '取消失败',
                icon: 'none'
              });
            }
          },
          fail: () => {
            wx.hideLoading();
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
