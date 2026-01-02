// pages/visitBooking/index.js
// MOD: CLEAN_HARDCODED_API_BASE_20260103
// 熵盾 · 来访预约页（自由时间段 + 摘要展示）

const funnel = require('../../utils/funnel.js');
const { API_BASE } = require('../../config');

function getBaseUrl() {
  return String(API_BASE || '').replace(/\/$/, '');
}

// MOD: 统一 clientId 存储口径：优先 clientId，兼容 st_client_id
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
    name: '',
    mobile: '',
    peopleCount: 1,

    visitDate: '',
    startTime: '',
    endTime: '',

    purpose: '',
    remark: '',

    inviteCode: '',

    submitting: false,

    dateStart: '',
    dateEnd: ''
  },

  onLoad() {
    ensureClientId();

    const today = new Date();
    const start = this.formatDate(today);
    const endDate = new Date(today.getTime() + 60 * 24 * 3600 * 1000);
    const end = this.formatDate(endDate);

    this.setData({
      dateStart: start,
      dateEnd: end
    });

    funnel.log('VISIT_BOOKING_VIEW', { ts: Date.now() });
  },

  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  onNameInput(e) {
    this.setData({ name: (e.detail.value || '').trim() });
  },

  onMobileInput(e) {
    this.setData({ mobile: (e.detail.value || '').trim() });
  },

  onPeopleCountInput(e) {
    let val = parseInt(e.detail.value, 10);
    if (Number.isNaN(val) || val <= 0) val = 1;
    if (val > 10) val = 10;
    this.setData({ peopleCount: val });
  },

  onDateChange(e) {
    this.setData({ visitDate: e.detail.value });
  },

  onStartTimeChange(e) {
    this.setData({ startTime: e.detail.value });
  },

  onEndTimeChange(e) {
    this.setData({ endTime: e.detail.value });
  },

  onPurposeInput(e) {
    this.setData({ purpose: e.detail.value });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  onQuickPurposeTap(e) {
    const text = e.currentTarget.dataset.text || '';
    if (!text) return;
    this.setData({ purpose: text });
  },

  goMyList() {
    funnel.log('VISIT_MY_LIST_VIEW', { ts: Date.now() });
    wx.navigateTo({ url: '/pages/visitMyList/index' });
  },

  validateForm() {
    const { name, mobile, visitDate, startTime, endTime } = this.data;

    if (!name) {
      wx.showToast({ title: '请填写称呼', icon: 'none' });
      return false;
    }
    if (!mobile) {
      wx.showToast({ title: '请填写联系方式', icon: 'none' });
      return false;
    }
    if (!visitDate) {
      wx.showToast({ title: '请选择来访日期', icon: 'none' });
      return false;
    }
    if (!startTime) {
      wx.showToast({ title: '请选择开始时间', icon: 'none' });
      return false;
    }
    if (!endTime) {
      wx.showToast({ title: '请选择结束时间', icon: 'none' });
      return false;
    }
    if (startTime >= endTime) {
      wx.showToast({ title: '结束时间需晚于开始时间', icon: 'none' });
      return false;
    }
    return true;
  },

  onSubmit() {
    if (this.data.submitting) return;

    funnel.log('VISIT_BOOKING_SUBMIT', { ts: Date.now() });

    if (!this.validateForm()) return;

    const baseUrl = getBaseUrl();
    const clientId = ensureClientId();

    const {
      name,
      mobile,
      peopleCount,
      visitDate,
      startTime,
      endTime,
      purpose,
      remark,
      inviteCode
    } = this.data;

    const visitTimeRange = `${startTime}-${endTime}`;

    this.setData({ submitting: true });

    wx.request({
      url: `${baseUrl}/api/visit/submit`,
      method: 'POST',
      data: {
        clientId,
        name,
        mobile,
        visitDate,
        visitTimeRange,
        purpose,
        remark,
        inviteCode,
        peopleCount
      },
      success: (res) => {
        const data = res.data || {};
        if (data.ok) {
          wx.showToast({ title: '预约已提交', icon: 'success' });
          setTimeout(() => this.goMyList(), 600);
        } else {
          wx.showToast({ title: data.message || '提交失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常，稍后重试', icon: 'none' });
      },
      complete: () => {
        this.setData({ submitting: false });
      }
    });
  }
});
