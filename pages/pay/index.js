// pages/pay/index.js
const { API_BASE } = require('../../config');
const { PLAN_LIST, getPlanByKey, buildOrderTitle } = require('../../utils/plans');

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
  console.log('[pay] cached clientId present =', Boolean(cached));

  const code = await loginCode();
  const res = await requestJson('POST', `${base}/api/wx/login`, { code });
  const data = res && res.data ? res.data : {};

  console.log('[pay] wx login ok =', Boolean(data && data.ok));

  if (!data || !data.ok) {
    throw new Error(
      data.message ||
      data.error ||
      '微信登录态获取失败'
    );
  }

  const clientId = String(
    data.clientId ||
    data.openid ||
    ''
  ).trim();

  if (!clientId || isTempClientId(clientId)) {
    throw new Error('后端未返回真实用户身份');
  }

  setClientIdEverywhere(clientId);
  return clientId;
}

function resolveVirtualPayArgs(payload = {}) {
  const p = payload || {};

  return {
    mode: String(p.mode || ''),
    signData: String(p.signData || ''),
    paySig: String(p.paySig || ''),
    signature: String(p.signature || ''),
    outTradeNo: String(p.outTradeNo || ''),
    productId: String(p.productId || ''),
    amountFen: Number(p.amountFen || 0) || 0,
    reusedPendingOrder: p.reusedPendingOrder === true
  };
}

function buildVirtualPayPayload(plan, clientId) {
  return {
    clientId,
    openid: clientId,
    productId: plan.virtualProductId
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

    let selectedPlanKey = getPlanByKey(opts.planKey).key;

    if (type === 'advanced') {
      if (selectedPlanKey !== 'quarter' && selectedPlanKey !== 'year') {
        selectedPlanKey = 'quarter';
        topNotice = '加强版仅支持：季度会员 / 年度会员';
      } else {
        topNotice = '加强版仅支持：季度会员 / 年度会员';
      }
    } else if (type === 'steady') {
      topNotice = '稳健版支持：7天体验 / 月会员 / 季度会员 / 年度会员';
    } else {
      const sel = getPlanByKey(selectedPlanKey);
      topNotice = sel.rights === 'advanced'
        ? '稳健版 + 加强版：季度会员 / 年度会员'
        : '稳健版支持：7天体验 / 月会员 / 季度会员 / 年度会员';
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
      upgradeTitle: '7天体验购买资格已用完',
      upgradeContent: isAdvanced
        ? '当前账号已完成 1 次 9.9元/7天体验购买。继续使用加强版，请直接开通季度会员或年度会员。'
        : '当前账号已完成 1 次 9.9元/7天体验购买。继续使用稳健版，可直接开通月会员。',
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
        : '稳健版支持：7天体验 / 月会员 / 季度会员 / 年度会员'
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

  // 支付页「返回」按钮：优先返回上一页；
  // 若页面栈只有 1 层（如从分享/扫码直接进入支付页），navigateBack 会失败，
  // 此时兜底跳首页 tab，避免出现「点了没反应」。
  goBack() {
    const pages = (typeof getCurrentPages === 'function' && getCurrentPages()) || [];
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 });
      return;
    }
    wx.switchTab({
      url: '/pages/index/index',
      fail: () => {
        wx.reLaunch({ url: '/pages/index/index' });
      }
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
      wx.showToast({
        title: 'API_BASE 未配置',
        icon: 'none'
      });
      return;
    }

    if (
      this.data.type === 'advanced' &&
      (plan.key === 'times3' || plan.key === 'month')
    ) {
      wx.showToast({
        title: '加强版仅支持季度会员 / 年度会员',
        icon: 'none'
      });
      return;
    }

    if (!plan.virtualProductId) {
      wx.showToast({
        title: '虚拟商品未配置',
        icon: 'none'
      });
      return;
    }

    if (typeof wx.requestVirtualPayment !== 'function') {
      wx.showModal({
        title: '无法发起支付',
        content: '当前微信版本不支持虚拟支付，请升级微信后重试。',
        showCancel: false
      });
      return;
    }

    this.setData({ paying: true });

    try {
      const clientId = await ensureRealClientId(base);

      if (!clientId || isTempClientId(clientId)) {
        throw new Error('未获取到真实用户身份');
      }

      if (clientId !== this.data.clientId) {
        this.setData({ clientId });
      }

      const payload = buildVirtualPayPayload(
        plan,
        clientId
      );

      const res = await requestJson(
        'POST',
        `${base}/api/virtual-pay/create`,
        payload
      );

      const data = res && res.data ? res.data : {};

      console.log('[pay][virtual] create result =', {
        ok: Boolean(data && data.ok),
        error: String((data && data.error) || ''),
        productId: String((data && data.productId) || ''),
        amountFen: Number((data && data.amountFen) || 0),
        reusedPendingOrder:
          Boolean(data && data.reusedPendingOrder),
        outTradeNo:
          String((data && data.outTradeNo) || '')
      });

      if (!data || !data.ok) {
        const errorCode = String(data.error || '');
        const rawMsg = String(
          data.message ||
          data.error ||
          '支付下单失败'
        );

        const isTrialLimit =
          errorCode === 'TRIAL_PURCHASE_LIMIT_REACHED' ||
          /每个ID只能购买1次9\.9元\/7天体验/.test(rawMsg);

        if (isTrialLimit) {
          const nextPlanKey =
            this.data.type === 'advanced'
              ? 'quarter'
              : 'month';

          this.enterUpgradeFlow(nextPlanKey);
          return;
        }

        throw new Error(rawMsg);
      }

      const payArgs = resolveVirtualPayArgs(data);

      if (
        !payArgs.mode ||
        !payArgs.signData ||
        !payArgs.paySig ||
        !payArgs.signature
      ) {
        throw new Error('虚拟支付参数不完整');
      }

      if (
        payArgs.productId !== plan.virtualProductId ||
        payArgs.amountFen !== plan.amountFen
      ) {
        throw new Error('虚拟支付商品或金额校验失败');
      }

      this.clearUpgradeFlow();

      const payResult = await new Promise(
        (resolve, reject) => {
          wx.requestVirtualPayment({
            mode: payArgs.mode,
            signData: payArgs.signData,
            paySig: payArgs.paySig,
            signature: payArgs.signature,

            success: (result) => {
              console.log(
                '[pay][virtual] payment success'
              );
              resolve(result || {});
            },

            fail: (error) => {
              const message = getErrMsg(error);

              console.log(
                '[pay][virtual] payment failed =',
                message
              );

              if (
                /requestVirtualPayment:fail cancel/i.test(message) ||
                /cancel/i.test(message)
              ) {
                resolve({
                  cancelled: true,
                  errMsg: message
                });
                return;
              }

              reject(error);
            }
          });
        }
      );

      if (payResult && payResult.cancelled) {
        this.setData({ paying: false });

        wx.showToast({
          title: '已取消支付',
          icon: 'none',
          duration: 1500
        });
        return;
      }

      this.setData({ paying: false });

      wx.redirectTo({
        url:
          '/pages/paySuccess/index' +
          `?planKey=${encodeURIComponent(plan.key)}` +
          `&amountFen=${encodeURIComponent(String(plan.amountFen))}` +
          `&outTradeNo=${encodeURIComponent(payArgs.outTradeNo)}`
      });
    } catch (err) {
      this.setData({ paying: false });

      const msg = getErrMsg(err);
      console.error('[pay][virtual] onPayTap error =', msg);

      if (
        /requestVirtualPayment:fail cancel/i.test(msg) ||
        /cancel/i.test(msg)
      ) {
        wx.showToast({
          title: '已取消支付',
          icon: 'none',
          duration: 1500
        });
        return;
      }

      try {
        wx.setStorageSync(
          'pay_debug_last_error',
          JSON.stringify({
            time: new Date().toISOString(),
            planKey: plan.key,
            productId: plan.virtualProductId,
            message: msg
          })
        );
      } catch (e) {}

      wx.showModal({
        title: '支付失败',
        content:
          msg ||
          '支付过程中出现异常，请重试',
        showCancel: false
      });
    }
  }
});