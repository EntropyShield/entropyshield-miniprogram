// pages/visitBooking/index.js
// MOD: VISIT_BOOKING_ASCII_SAFE_FINAL_20260313

const funnel = require('../../utils/funnel.js');
const { API_BASE } = require('../../config');

function getBaseUrl() {
  return String(API_BASE || '').replace(/\/$/, '');
}

function ensureClientId() {
  const app = getApp && getApp();
  let cid =
    (app && app.globalData && app.globalData.clientId) ||
    wx.getStorageSync('clientId') ||
    wx.getStorageSync('st_client_id');

  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 900000) + 100000}`;
  }

  wx.setStorageSync('clientId', cid);
  wx.setStorageSync('st_client_id', cid);
  if (app && app.globalData) app.globalData.clientId = cid;

  return cid;
}

function normalizePeopleCount(value) {
  let v = parseInt(value, 10);
  if (Number.isNaN(v) || v < 1) v = 1;
  if (v > 10) v = 10;
  return v;
}

function isValidCnMobile(mobile) {
  return /^1\d{10}$/.test(String(mobile || '').trim());
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
    privacyChecked: false,

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
      dateEnd: end,
      privacyChecked: false
    });

    funnel.log('VISIT_BOOKING_VIEW', { ts: Date.now() });
    console.log('[visitBooking] onLoad');
  },

  onShow() {
    this.setData({
      privacyChecked: false
    });
    console.log('[visitBooking] onShow');
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
    this.setData({ peopleCount: normalizePeopleCount(e.detail.value) });
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
    this.setData({ purpose: e.detail.value || '' });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value || '' });
  },

  onQuickPurposeTap(e) {
    const text = (e.currentTarget.dataset.text || '').trim();
    if (!text) return;
    this.setData({ purpose: text });
  },

  onPrivacyAgreementChange(e) {
    const values = (e && e.detail && e.detail.value) || [];
    const checked = values.includes('agree');
    this.setData({ privacyChecked: checked });
  },

  openServiceAgreement() {
    wx.navigateTo({
      url: '/pages/agreementService/index'
    });
  },

  openPrivacyContract() {
    wx.navigateTo({
      url: '/pages/agreementPrivacy/index'
    });
  },

  goProfile() {
    wx.switchTab({ url: '/pages/profile/index' });
  },

  validateForm() {
    const {
      name,
      mobile,
      peopleCount,
      visitDate,
      startTime,
      endTime,
      privacyChecked
    } = this.data;

    console.log('[visitBooking] validate input =', {
      name,
      mobile,
      peopleCount,
      visitDate,
      startTime,
      endTime,
      privacyChecked
    });

    if (!name) {
      wx.showToast({ title: '\u8bf7\u586b\u5199\u79f0\u547c', icon: 'none' });
      return false;
    }

    if (!mobile) {
      wx.showToast({ title: '\u8bf7\u586b\u5199\u8054\u7cfb\u65b9\u5f0f', icon: 'none' });
      return false;
    }

    if (!isValidCnMobile(mobile)) {
      wx.showToast({ title: '\u8bf7\u586b\u5199\u6b63\u786e\u768411\u4f4d\u624b\u673a\u53f7', icon: 'none' });
      return false;
    }

    if (!privacyChecked) {
      wx.showToast({ title: '\u8bf7\u5148\u9605\u8bfb\u5e76\u540c\u610f\u534f\u8bae\u4e0e\u9690\u79c1\u653f\u7b56', icon: 'none' });
      return false;
    }

    if (!visitDate) {
      wx.showToast({ title: '\u8bf7\u9009\u62e9\u6765\u8bbf\u65e5\u671f', icon: 'none' });
      return false;
    }

    if (!startTime) {
      wx.showToast({ title: '\u8bf7\u9009\u62e9\u5f00\u59cb\u65f6\u95f4', icon: 'none' });
      return false;
    }

    if (!endTime) {
      wx.showToast({ title: '\u8bf7\u9009\u62e9\u7ed3\u675f\u65f6\u95f4', icon: 'none' });
      return false;
    }

    if (startTime >= endTime) {
      wx.showToast({ title: '\u7ed3\u675f\u65f6\u95f4\u9700\u665a\u4e8e\u5f00\u59cb\u65f6\u95f4', icon: 'none' });
      return false;
    }

    if (normalizePeopleCount(peopleCount) < 1 || normalizePeopleCount(peopleCount) > 10) {
      wx.showToast({ title: '\u6765\u8bbf\u4eba\u6570\u8bf7\u586b\u51991\u523010', icon: 'none' });
      return false;
    }

    console.log('[visitBooking] validate pass');
    return true;
  },

  onSubmit() {
    if (this.data.submitting) {
      console.warn('[visitBooking] blocked: already submitting');
      return;
    }

    funnel.log('VISIT_BOOKING_SUBMIT', { ts: Date.now() });
    console.log('[visitBooking] onSubmit start');

    if (!this.validateForm()) {
      console.warn('[visitBooking] validate not pass');
      return;
    }

    const baseUrl = getBaseUrl();
    const clientId = ensureClientId();

    if (!baseUrl) {
      console.warn('[visitBooking] empty baseUrl');
      wx.showToast({ title: '\u63a5\u53e3\u5730\u5740\u672a\u914d\u7f6e', icon: 'none' });
      return;
    }

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

    const safePeopleCount = normalizePeopleCount(peopleCount);
    const visitTimeRange = `${startTime}-${endTime}`;

    const payload = {
      clientId,
      name,
      mobile,
      visitDate,
      startTime,
      endTime,
      visitTimeRange,
      purpose,
      remark,
      inviteCode,
      peopleCount: safePeopleCount
    };

    console.log('[visitBooking] submit payload =', {
      url: `${baseUrl}/api/visit/submit`,
      payload
    });

    this.setData({ submitting: true });

    wx.request({
      url: `${baseUrl}/api/visit/submit`,
      method: 'POST',
      timeout: 10000,
      header: {
        'content-type': 'application/json'
      },
      data: payload,
      success: (res) => {
        console.log('[visitBooking] submit success raw =', res);

        const data = (res && res.data) || {};

        if (data.ok) {
          wx.showToast({
            title: '\u9884\u7ea6\u5df2\u63d0\u4ea4',
            icon: 'success'
          });

          setTimeout(() => {
            wx.switchTab({ url: '/pages/profile/index' });
          }, 900);
        } else {
          wx.showToast({
            title: data.message || '\u63d0\u4ea4\u5931\u8d25',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.warn('[visitBooking] submit fail =', err);
        wx.showToast({
          title: '\u7f51\u7edc\u5f02\u5e38\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5',
          icon: 'none'
        });
      },
      complete: (res) => {
        console.log('[visitBooking] submit complete =', res);
        this.setData({ submitting: false });
      }
    });
  }
});
