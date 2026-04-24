// pages/pay/index.js
const { API_BASE } = require('../../config');

const PLAN_LIST = [
  {
    key: 'times3',
    title: '3天体验',
    amountFen: 990,
    amountText: '9.9',
    rights: '稳健版',
    desc: '9.9元 / 3天体验'
  },
  {
    key: 'month',
    title: '月会员',
    amountFen: 99900,
    amountText: '999',
    rights: '稳健版',
    desc: '999元 / 月'
  },
  {
    key: 'quarter',
    title: '季度会员',
    amountFen: 299900,
    amountText: '2999',
    rights: '稳健版 + 加强版',
    desc: '2999元 / 季度'
  },
  {
    key: 'year',
    title: '年度会员',
    amountFen: 999900,
    amountText: '9999',
    rights: '稳健版 + 加强版',
    desc: '9999元 / 年'
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

function readCachedClientId() {
  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    const gd = app && app.globalData ? app.globalData : null;

    const value =
      (gd && (gd.clientId || gd.openid)) ||
      wx.getStorageSync('clientId') ||
      wx.getStorageSync('openid') ||
      '';

    return String(value || '').trim();
  } catch (e) {
    return '';
  }
}

function isTempClientId(value) {
  return /^ST-/i.test(String(value || '').trim());
}

function setClientIdEverywhere(clientId) {
  const val = String(clientId || '').trim();
  if (!val) return;

  try {
    wx.setStorageSync('clientId', val);
  } catch (e) {}

  try {
    wx.setStorageSync('openid', val);
  } catch (e) {}

  try {
    const app = typeof getApp === 'function' ? getApp() : null;
    if (app && app.globalData) {
      app.globalData.clientId = val;
      app.globalData.openid = val;
    }
  } catch (e) {}
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

function loginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res && res.code) {
          resolve(res.code);
          return;
        }
        reject(new Error('wx.login 未返回 code'));
      },
      fail(err) {
        reject(err);
      }
    });
  });
}

async function ensureRealClientId(base) {
  const cached = readCachedClientId();
  console.log('[pay] cached clientId =', cached);

  if (cached && !isTempClientId(cached)) {
    return cached;
  }

  const code = await loginCode();
  const res = await requestJson('POST', `${base}/api/wx/login`, { code });
  const data = res && res.data ? res.data : {};

  console.log('[pay] /api/wx/login response =', data);

  if (!data || !data.ok) {
    throw new Error(data.message || data.error || '登录态获取失败');
  }

  const clientId = String(data.clientId || data.openid || '').trim();
  if (!clientId) {
    throw new Error('后端未返回真实用户身份');
  }

  setClientIdEverywhere(clientId);
  return clientId;
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

function buildPayPayload(plan, pageData, clientId) {
  const title = buildOrderTitle(plan, pageData);
  return {
    clientId,
    openid: clientId,
    planKey: plan.key,
    amountFen: plan.amountFen,
    totalFee: plan.amountFen,
    priceFen: plan.amountFen,
    title,
    body: title,
    description: title,
    from: pageData.from || '',
    type: pageData.type || '',
    courseId: pageData.courseId || '',
    source: 'pages/pay/index.js'
  };
}

function getErrMsg(err) {
  return String(
    (err && (err.errMsg || err.message || err.error)) || '支付失败'
  ).trim();
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
    topNotice: '请选择你的开通方式',
    upgradeMode: false,
    upgradeTargetPlanKey: '',
    upgradeTitle: '',
    upgradeContent: '',
    upgradeButtonText: ''
  },

  onLoad(options) {
    const opts = options || {};
    const type = String(opts.type || '').trim().toLowerCase();
    let selectedPlanKey = 'times3';
    let topNotice = '请选择你的开通方式';

    if (type === 'advanced') {
      selectedPlanKey = 'quarter';
      topNotice = '加强版仅支持：季度会员 / 年度会员';
    } else if (type === 'steady') {
      selectedPlanKey = 'times3';
      topNotice = '稳健版支持：3天体验 / 月会员 / 季度会员 / 年度会员';
    }

    this.setData({
      clientId: readCachedClientId(),
      from: opts.from || '',
      type,
      courseId: opts.courseId || '',
      selectedPlanKey,
      topNotice
    });
  },

  onShow() {
    this.setData({ clientId: readCachedClientId() });
  },

  onSelectPlan(e) {
    const ds = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const key = String(ds.key || '');
    if (!key) return;

    if (this.data.type === 'advanced' && (key === 'times3' || key === 'month')) {
      wx.showToast({ title: '加强版仅支持季度会员 / 年度会员', icon: 'none' });
      return;
    }

    this.setData({
      selectedPlanKey: key,
      upgradeMode: false,
      upgradeTargetPlanKey: '',
      upgradeTitle: '',
      upgradeContent: '',
      upgradeButtonText: ''
    });
  },

  enterUpgradeFlow(nextPlanKey) {
    const isAdvanced = this.data.type === 'advanced';
    this.setData({
      paying: false,
      selectedPlanKey: nextPlanKey,
      upgradeMode: true,
      upgradeTargetPlanKey: nextPlanKey,
      upgradeTitle: '3天体验次数已用完',
      upgradeContent: isAdvanced
        ? '当前账号已完成 3 次 9.9元/3天体验购买。继续使用加强版，请直接开通季度会员或年度会员。'
        : '当前账号已完成 3 次 9.9元/3天体验购买。继续使用稳健版，建议直接开通月会员。',
      upgradeButtonText: isAdvanced ? '去开通季度会员' : '去开通月会员',
      topNotice: isAdvanced
        ? '已切换为季度会员升级方案'
        : '已切换为月会员升级方案'
    });
  },

  clearUpgradeFlow() {
    this.setData({
      upgradeMode: false,
      upgradeTargetPlanKey: '',
      upgradeTitle: '',
      upgradeContent: '',
      upgradeButtonText: '',
      topNotice: this.data.type === 'advanced'
        ? '加强版仅支持：季度会员 / 年度会员'
        : '稳健版支持：3天体验 / 月会员 / 季度会员 / 年度会员'
    });
  },

  onUpgradeConfirm() {
    if (this.data.paying) return;
    const nextPlanKey = this.data.upgradeTargetPlanKey || this.data.selectedPlanKey || (this.data.type === 'advanced' ? 'quarter' : 'month');
    this.setData({
      selectedPlanKey: nextPlanKey,
      upgradeMode: false
    }, () => {
      this.onPayTap();
    });
  },

  async onPayTap() {
    if (this.data.paying) return;

    if (this.data.upgradeMode) {
      this.onUpgradeConfirm();
      return;
    }

    const base = getApiBase();
    const plan = getPlanByKey(this.data.selectedPlanKey);

    if (!base) {
      wx.showToast({ title: 'API_BASE 未配置', icon: 'none' });
      return;
    }

    if (this.data.type === 'advanced' && (plan.key === 'times3' || plan.key === 'month')) {
      wx.showToast({ title: '加强版仅支持季度会员 / 年度会员', icon: 'none' });
      return;
    }

    this.setData({ paying: true });

    try {
      const clientId = await ensureRealClientId(base);
      console.log('[pay] final clientId =', clientId);

      if (!clientId || isTempClientId(clientId)) {
        throw new Error('未获取到真实用户身份');
      }

      if (clientId !== this.data.clientId) {
        this.setData({ clientId });
      }

      const payload = buildPayPayload(plan, this.data, clientId);
      console.log('[pay] /api/pay/jsapi payload =', payload);

      const res = await requestJson('POST', `${base}/api/pay/jsapi`, payload);
      const data = res && res.data ? res.data : {};

      console.log('[pay] /api/pay/jsapi response =', data);

      if (!data || !data.ok) {
        const rawMsg = String(data.message || data.error || '支付下单失败');
        const isTrialLimit =
          String(data.error || '') === 'trial_purchase_limit_reached' ||
          /最多购买3次9\.9元\/3天体验/.test(rawMsg) ||
          /times3 purchase limit reached/i.test(rawMsg);

        if (isTrialLimit) {
          const nextPlanKey = this.data.type === 'advanced' ? 'quarter' : 'month';
          this.enterUpgradeFlow(nextPlanKey);
          return;
        }

        throw new Error(rawMsg);
      }

      if (data.alreadyPaid) {
        this.clearUpgradeFlow();
        this.setData({ paying: false });
        wx.showToast({
          title: data.message || '已开通，无需重复支付',
          icon: 'none'
        });
        return;
      }

      this.clearUpgradeFlow();
      const payArgs = resolvePayArgs(data.payargs || data.payArgs || data.data || data);
      console.log('[pay] requestPayment params =', payArgs);

      if (!payArgs.timeStamp || !payArgs.nonceStr || !payArgs.package || !payArgs.paySign) {
        throw new Error('支付参数不完整');
      }

      const payResult = await new Promise((resolve, reject) => {
        wx.requestPayment({
          timeStamp: payArgs.timeStamp,
          nonceStr: payArgs.nonceStr,
          package: payArgs.package,
          signType: payArgs.signType,
          paySign: payArgs.paySign,
          success: (res2) => {
            console.log('[pay] requestPayment success =', res2);
            resolve(res2);
          },
          fail: (err) => {
            console.log('[pay] requestPayment fail =', err);
            const msg = getErrMsg(err);

            if (/requestPayment:fail cancel/i.test(msg)) {
              resolve({ cancelled: true, errMsg: msg });
              return;
            }

            reject(err);
          }
        });
      });

      if (payResult && payResult.cancelled) {
        this.setData({ paying: false });
        wx.showToast({
          title: '已取消支付',
          icon: 'none',
          duration: 1500
        });
        return;
      }

      wx.redirectTo({
        url:
          '/pages/paySuccess/index' +
          `?planKey=${encodeURIComponent(plan.key)}` +
          `&amountFen=${encodeURIComponent(String(plan.amountFen))}`
      });
    } catch (err) {
      this.setData({ paying: false });

      const msg = getErrMsg(err);
      console.error('[pay] onPayTap error =', err);

      wx.hideLoading && wx.hideLoading();

      if (/requestPayment:fail cancel/i.test(msg)) {
        wx.showToast({
          title: '已取消支付',
          icon: 'none',
          duration: 1500
        });
        return;
      }

      try {
        wx.setStorageSync('pay_debug_last_error', JSON.stringify({
          time: new Date().toISOString(),
          planKey: plan.key,
          message: msg,
          err: err || null
        }));
      } catch (e) {}

      wx.showModal({
        title: '支付失败',
        content: msg || '支付过程中出现异常，请重试',
        showCancel: false
      });
    }
  }
});

