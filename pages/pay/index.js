// pages/pay/index.js
const { API_BASE } = require('../../config');

const PLAN_LIST = [
  {
    key: 'times3',
    title: '9.9元 / 3次',
    amountFen: 990,
    amountText: '9.9',
    rights: '稳健版',
    desc: '适合先体验风控计算器'
  },
  {
    key: 'month',
    title: '月卡 999',
    amountFen: 99900,
    amountText: '999',
    rights: '稳健版',
    desc: '适合短周期连续使用'
  },
  {
    key: 'quarter',
    title: '季卡 2999',
    amountFen: 299900,
    amountText: '2999',
    rights: '稳健版 + 加强版',
    desc: '适合持续训练与复盘'
  },
  {
    key: 'year',
    title: '年卡 9999',
    amountFen: 999900,
    amountText: '9999',
    rights: '稳健版 + 加强版',
    desc: '适合长期使用'
  }
];

function getApiBase() {
  try {
    const s1 = wx.getStorageSync('API_BASE') || '';
    if (s1) return String(s1).replace(/\/$/, '');
  } catch (e) {}

  try {
    const s2 = wx.getStorageSync('apiBaseUrl') || '';
    if (s2) return String(s2).replace(/\/$/, '');
  } catch (e) {}

  const app = typeof getApp === 'function' ? getApp() : null;
  const gd = app && app.globalData ? app.globalData : null;
  const base = (gd && (gd.API_BASE || gd.baseUrl || gd.API_BASE_URL)) || API_BASE || '';
  return String(base || '').replace(/\/$/, '');
}

function getClientId() {
  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    const cid =
      (app && app.globalData && app.globalData.clientId) ||
      wx.getStorageSync('clientId') ||
      '';
    return String(cid || '').trim();
  } catch (e) {
    return '';
  }
}

function requestJson(method, url, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      method,
      url,
      data,
      timeout: 15000,
      header: { 'Content-Type': 'application/json' },
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    });
  });
}

function resolvePayArgs(payload = {}) {
  const p = payload || {};
  return {
    timeStamp: String(p.timeStamp || p.timestamp || ''),
    nonceStr: String(p.nonceStr || p.noncestr || ''),
    package: String(p.package || p.packageValue || ''),
    signType: String(p.signType || 'RSA'),
    paySign: String(p.paySign || p.paysign || '')
  };
}

function getPlanByKey(key) {
  return PLAN_LIST.find(item => item.key === key) || PLAN_LIST[0];
}

function buildOrderTitle(plan, options = {}) {
  const type = String(options.type || '').trim().toLowerCase();
  if (type === 'advanced') return `风控计算器-${plan.title}-加强版`;
  if (type === 'steady') return `风控计算器-${plan.title}-稳健版`;
  return `风控计算器-${plan.title}`;
}

Page({
  data: {
    paying: false,
    clientId: '',
    from: '',
    type: '',
    courseId: '',
    selectedPlanKey: 'times3',
    plans: PLAN_LIST,
    topNotice: '请选择你的开通方式'
  },

  onLoad(options) {
    const opts = options || {};
    const type = String(opts.type || '').trim().toLowerCase();
    let selectedPlanKey = 'times3';
    let topNotice = '请选择你的开通方式';

    if (type === 'advanced') {
      selectedPlanKey = 'quarter';
      topNotice = '加强版仅支持季卡 / 年卡';
    } else if (type === 'steady') {
      selectedPlanKey = 'times3';
      topNotice = '稳健版支持 9.9/3次、月卡、季卡、年卡';
    }

    this.setData({
      clientId: getClientId(),
      from: opts.from || '',
      type,
      courseId: opts.courseId || '',
      selectedPlanKey,
      topNotice
    });
  },

  onShow() {
    this.setData({ clientId: getClientId() });
  },

  onSelectPlan(e) {
    const ds = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const key = String(ds.key || '');
    if (!key) return;

    if (this.data.type === 'advanced' && (key === 'times3' || key === 'month')) {
      wx.showToast({ title: '加强版仅支持季卡 / 年卡', icon: 'none' });
      return;
    }

    this.setData({ selectedPlanKey: key });
  },

  async onPayTap() {
    if (this.data.paying) return;

    const base = getApiBase();
    const clientId = this.data.clientId || getClientId();
    const plan = getPlanByKey(this.data.selectedPlanKey);

    if (!base) {
      wx.showToast({ title: 'API_BASE 未配置', icon: 'none' });
      return;
    }

    if (!clientId) {
      wx.showToast({ title: '未获取到用户身份', icon: 'none' });
      return;
    }

    if (this.data.type === 'advanced' && (plan.key === 'times3' || plan.key === 'month')) {
      wx.showToast({ title: '加强版仅支持季卡 / 年卡', icon: 'none' });
      return;
    }

    this.setData({ paying: true });

    try {
      const payload = {
        clientId,
        planKey: plan.key,
        amountFen: plan.amountFen,
        title: buildOrderTitle(plan, this.data),
        from: this.data.from || '',
        type: this.data.type || '',
        courseId: this.data.courseId || ''
      };

      const res = await requestJson('POST', `${base}/api/pay/jsapi`, payload);
      const data = res && res.data ? res.data : {};
      if (!data || !data.ok) {
        throw new Error(data.message || data.error || '支付下单失败');
      }

      const payArgs = resolvePayArgs(data.payargs || data.payArgs || data.data || data);
      if (!payArgs.timeStamp || !payArgs.nonceStr || !payArgs.package || !payArgs.paySign) {
        throw new Error('支付参数不完整');
      }

      await new Promise((resolve, reject) => {
        wx.requestPayment({
          timeStamp: payArgs.timeStamp,
          nonceStr: payArgs.nonceStr,
          package: payArgs.package,
          signType: payArgs.signType,
          paySign: payArgs.paySign,
          success: resolve,
          fail: reject
        });
      });

      wx.redirectTo({
        url:
          '/pages/paySuccess/index' +
          `?planKey=${encodeURIComponent(plan.key)}` +
          `&amountFen=${encodeURIComponent(String(plan.amountFen))}`
      });
    } catch (err) {
      const msg = (err && (err.errMsg || err.message)) ? (err.errMsg || err.message) : '支付失败';
      wx.showToast({ title: msg, icon: 'none' });
      wx.redirectTo({
        url: '/pages/payFail/index?planKey=' + encodeURIComponent(plan.key)
      });
    } finally {
      this.setData({ paying: false });
    }
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail() {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  }
});
