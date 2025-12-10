// pages/visitBooking/index.js
// 熵盾 · 来访预约页（自由时间段 + 摘要展示）

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
    name: '',
    mobile: '',
    peopleCount: 1,

    visitDate: '',
    startTime: '',
    endTime: '',

    purpose: '',
    remark: '',

    inviteCode: '', // 预留字段，后期可从裂变信息里带入

    submitting: false,

    // 日期选择范围
    dateStart: '',
    dateEnd: ''
  },

  onLoad() {
    // 生成 / 读取 clientId
    ensureClientId();

    // 设置日期选择范围：从今天起，未来 60 天
    const today = new Date();
    const start = this.formatDate(today);
    const endDate = new Date(today.getTime() + 60 * 24 * 3600 * 1000);
    const end = this.formatDate(endDate);

    this.setData({
      dateStart: start,
      dateEnd: end
    });

    funnel.log('VISIT_BOOKING_VIEW', {
      ts: Date.now()
    });
  },

  // ============ 工具函数 ============

  formatDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ============ 表单绑定 ============

  ,
  onNameInput(e) {
    this.setData({ name: e.detail.value.trim() });
  },

  onMobileInput(e) {
    this.setData({ mobile: e.detail.value.trim() });
  },

  onPeopleCountInput(e) {
    let val = parseInt(e.detail.value, 10);
    if (Number.isNaN(val) || val <= 0) {
      val = 1;
    }
    if (val > 10) {
      val = 10;
    }
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

  // 快捷填充来访目的
  onQuickPurposeTap(e) {
    const text = e.currentTarget.dataset.text || '';
    if (!text) return;
    this.setData({ purpose: text });
  },

  // ============ 交互 ============

  goMyList() {
    funnel.log('VISIT_MY_LIST_VIEW', {
      ts: Date.now()
    });

    wx.navigateTo({
      url: '/pages/visitMyList/index'
    });
  },

  // 提交前校验
  validateForm() {
    const { name, mobile, visitDate, startTime, endTime } = this.data;

    if (!name) {
      wx.showToast({
        title: '请填写称呼',
        icon: 'none'
      });
      return false;
    }

    if (!mobile) {
      wx.showToast({
        title: '请填写联系方式',
        icon: 'none'
      });
      return false;
    }

    if (!visitDate) {
      wx.showToast({
        title: '请选择来访日期',
        icon: 'none'
      });
      return false;
    }

    if (!startTime) {
      wx.showToast({
        title: '请选择开始时间',
        icon: 'none'
      });
      return false;
    }

    if (!endTime) {
      wx.showToast({
        title: '请选择结束时间',
        icon: 'none'
      });
      return false;
    }

    // 简单判断：结束时间必须晚于开始时间（HH:mm 字符串比较可用）
    if (startTime >= endTime) {
      wx.showToast({
        title: '结束时间需晚于开始时间',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  onSubmit() {
    if (this.data.submitting) return;

    funnel.log('VISIT_BOOKING_SUBMIT', {
      ts: Date.now()
    });

    if (!this.validateForm()) return;

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
      url: `${API_BASE_URL}/api/visit/submit`,
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
          wx.showToast({
            title: '预约已提交',
            icon: 'success'
          });

          // 稍等一下再跳转到“我的预约”
          setTimeout(() => {
            this.goMyList();
          }, 600);
        } else {
          wx.showToast({
            title: data.message || '提交失败',
            icon: 'none'
          });
        }
      },
      fail: () => {
        wx.showToast({
          title: '网络异常，稍后重试',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({ submitting: false });
      }
    });
  }
});
