// pages/membership/index.js
const UR = require('../../utils/userRights.js');

function upperCode(v) {
  return String(v || '').toUpperCase();
}

function isUnlimitedProduct(code) {
  const c = upperCode(code);
  return ['VIP_TRIAL14', 'VIP_MONTH', 'VIP_QUARTER', 'VIP_YEAR'].includes(c);
}

function calcRemainingDays(expireAt) {
  const t = Number(expireAt || 0);
  if (!t) return 0;
  const ms = t - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function buildMembershipTypeText(rights) {
  const name = rights.membershipName || '';
  const expireAt = Number(rights.membershipExpireAt || 0);
  const code = upperCode(rights.productCode || rights.membershipProductCode || '');

  if (isUnlimitedProduct(code) && expireAt && Date.now() < expireAt) {
    const days = calcRemainingDays(expireAt);
    return `${name}（剩余${days}天） · 无限使用`;
  }

  if (code === 'VIP_ONCE3') {
    const t = Math.max(0, Number(rights.freeCalcTimes || 0));
    return `${name} · 按次使用（剩余${t}次）`;
  }

  return name || '未开通会员';
}

Page({
  data: {
    type: 'steady', // steady | advanced
    balance: '',
    price: '',
    code: '',

    planLabel: '',
    plans: [],

    freeCalcTimes: 0,
    membershipNameDisplay: ''
  },

  onLoad(options) {
    const type = options.type || 'steady';

    const balance = options.balance ? decodeURIComponent(options.balance) : '';
    const price = options.price ? decodeURIComponent(options.price) : '';
    const code = options.code ? decodeURIComponent(options.code) : '';

    const isAdvanced = type === 'advanced';
    const planLabel = isAdvanced ? '加强版 · 高阶风控方案' : '稳健版风控方案';

    // ✅ 规则：99/999/2999/9999 全部按“天数无限”，只有 9.9 按次数
    // ✅ 年卡：360 天（按你要求）
    const plansSteady = [
      {
        id: 'once3',
        name: '3 次单次包',
        priceText: '¥9.9',
        unitText: '3 次',
        desc: '按次收费：仅扣次数，不算天数。',
        durationDays: 0
      },
      {
        id: 'trial14',
        name: '14 天体验会员',
        priceText: '¥99',
        unitText: '14 天',
        desc: '有效期内无限使用（稳健版）。',
        durationDays: 14
      },
      {
        id: 'month',
        name: '月度会员',
        priceText: '¥999',
        unitText: '30 天',
        desc: '有效期内无限使用（稳健版）。',
        durationDays: 30
      }
    ];

    const plansAdvanced = [
      {
        id: 'quarter',
        name: '季度会员（加强版）',
        priceText: '¥2999',
        unitText: '90 天',
        desc: '有效期内无限使用：稳健版 + 加强版。',
        durationDays: 90
      },
      {
        id: 'year',
        name: '年度会员（加强版）',
        priceText: '¥9999',
        unitText: '360 天',
        desc: '有效期内无限使用：稳健版 + 加强版。',
        durationDays: 360
      }
    ];

    this.setData({
      type,
      balance,
      price,
      code,
      planLabel,
      plans: isAdvanced ? plansAdvanced : plansSteady
    });

    this.refreshRights();
  },

  onShow() {
    this.refreshRights();
  },

  refreshRights() {
    const rights = UR.getUserRights();
    const code = upperCode(rights.productCode || rights.membershipProductCode || '');
    const expireAt = Number(rights.membershipExpireAt || 0);
    const rawName = rights.membershipName || '';

    let membershipNameDisplay = rawName;

    if (rawName && expireAt) {
      if (Date.now() > expireAt) {
        membershipNameDisplay = rawName + '（已到期）';
      } else if (isUnlimitedProduct(code)) {
        const days = calcRemainingDays(expireAt);
        membershipNameDisplay = rawName + `（剩余${days}天）`;
      }
    }

    // UI 显示：无限会员不展示次数（统一置 0），按次包才显示次数
    let freeCalcTimes = Math.max(0, Number(rights.freeCalcTimes || 0));
    if (isUnlimitedProduct(code) && expireAt && Date.now() < expireAt) {
      freeCalcTimes = 0;
    }

    this.setData({ freeCalcTimes, membershipNameDisplay });
  },

  getApiBase() {
    try {
      const cfg = require('../../config.js') || {};
      return cfg.API_BASE || cfg.API_BASE_URL || cfg.PROD_API_BASE || 'https://api.entropyshield.com';
    } catch (e) {
      return 'https://api.entropyshield.com';
    }
  },

  ensureOpenid(cb) {
    const openid = wx.getStorageSync('openid');
    if (openid) return cb(openid);

    wx.login({
      success: (r) => {
        wx.request({
          url: this.getApiBase() + '/api/wx/login',
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          data: { code: r.code },
          success: (res) => {
            if (res.data && res.data.ok && res.data.openid) {
              wx.setStorageSync('openid', res.data.openid);
              cb(res.data.openid);
            } else {
              wx.showToast({ title: '获取 openid 失败', icon: 'none' });
              console.log('[membership] /api/wx/login res =>', res.data);
            }
          },
          fail: (err) => {
            wx.showToast({ title: '请求 wx/login 失败', icon: 'none' });
            console.error(err);
          }
        });
      },
      fail: (err) => {
        wx.showToast({ title: 'wx.login 失败', icon: 'none' });
        console.error(err);
      }
    });
  },

  planIdToProductCode(planId) {
    if (planId === 'once3') return 'VIP_ONCE3';
    if (planId === 'trial14') return 'VIP_TRIAL14';
    if (planId === 'month') return 'VIP_MONTH';
    if (planId === 'quarter') return 'VIP_QUARTER';
    if (planId === 'year') return 'VIP_YEAR';
    return 'VIP_MONTH';
  },

  // ===== 支付：金额转分（兼容 ¥99 / 99 / 9.9 / "9.9" 等）=====
  toFen(v) {
    if (v === null || typeof v === 'undefined') return 0;
    const raw = String(v).trim();
    if (!raw) return 0;

    // 去掉非数字/小数点字符（例如 "¥99" -> "99"）
    const s = raw.replace(/[^\d.]/g, '');
    if (!s) return 0;

    const n = Number(s);
    if (!isFinite(n)) return 0;

    // 含小数点：按元转分；不含小数点：默认按元转分（适配 99/999/2999/9999）
    if (s.includes('.')) return Math.round(n * 100);
    return Math.round(n * 100);
  },

  // ===== 调后端预下单，拿 payParams（timeStamp/nonceStr/package/paySign）=====
  callPayJsapi(openid, productCode, amountFen, description) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.getApiBase() + '/api/pay/jsapi',
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: { openid, productCode, amount: amountFen, description },
        success: (res) => {
          if (res.data && res.data.ok && res.data.payParams) resolve(res.data);
          else reject(res.data || { message: '/api/pay/jsapi 返回异常' });
        },
        fail: (err) => reject(err)
      });
    });
  },

  onSelectPlan(e) {
    const planId = e.currentTarget.dataset.planId;
    const { type, balance, price, code, plans, planLabel } = this.data;

    const plan = plans.find(p => p.id === planId);
    if (!plan) return wx.showToast({ title: '无法识别的会员方案', icon: 'none' });

    // 加强版入口只允许季卡/年卡
    if (type === 'advanced' && !['quarter', 'year'].includes(plan.id)) {
      return wx.showToast({ title: '加强版仅支持季卡/年卡', icon: 'none' });
    }

    wx.showModal({
      title: '开通会员',
      content: `将唤起微信支付，开通「${plan.name}」。`,
      confirmText: '去支付',
      success: (r) => {
        if (!r.confirm) return;

        const productCode = this.planIdToProductCode(plan.id);

        // 金额（分）：优先从 plan.priceText 解析；兜底用页面 price
        const amountFen = this.toFen(plan.priceText || price || 0);
        if (!amountFen || amountFen <= 0) {
          return wx.showToast({ title: '支付金额异常', icon: 'none' });
        }

        const description = `开通${plan.name}`;

        this.ensureOpenid((openid) => {
          wx.showLoading({ title: '拉起支付中…' });

          this.callPayJsapi(openid, productCode, amountFen, description)
            .then((data) => {
              wx.hideLoading();

              const payParams = data.payParams || {};
              wx.requestPayment({
                timeStamp: String(payParams.timeStamp || ''),
                nonceStr: payParams.nonceStr || '',
                package: payParams.package || '',
                signType: payParams.signType || 'RSA',
                paySign: payParams.paySign || '',
                success: () => {
                  // ✅ MVP：支付成功后立即本地发放权益（后续可再做 notify/查单“后端确权”）
                  const now = Date.now();
                  const expireAt = plan.durationDays
                    ? now + Number(plan.durationDays) * 24 * 60 * 60 * 1000
                    : 0;

                  const patch = {
                    openid,
                    membershipName: plan.name,
                    membershipPlan: plan.id,
                    membershipEntryType: type,

                    membershipProductCode: productCode,
                    productCode: productCode,

                    membershipExpireAt: expireAt,

                    // ✅ 权限：季/年才开加强版
                    advancedEnabled: (plan.id === 'quarter' || plan.id === 'year'),

                    // ✅ 次数：只给按次包，其它一律 0（按天无限）
                    freeCalcTimes: (upperCode(productCode) === 'VIP_ONCE3') ? 3 : 0
                  };

                  const nextRights = UR.mergeUserRights(patch);
                  this.refreshRights();

                  wx.showToast({ title: '支付成功', icon: 'success', duration: 1200 });

                  const membershipTypeText = buildMembershipTypeText(nextRights) + ` · ${planLabel}`;
                  const query =
                    `?balance=${encodeURIComponent(balance)}` +
                    `&price=${encodeURIComponent(price)}` +
                    `&code=${encodeURIComponent(code || '')}` +
                    `&membershipType=${encodeURIComponent(membershipTypeText)}`;

                  if (type === 'steady') {
                    wx.navigateTo({ url: '/pages/planSteady/index' + query });
                  } else {
                    wx.navigateTo({ url: '/pages/planAdvanced/index' + query });
                  }
                },
                fail: (err) => {
                  console.error('[membership] requestPayment fail =>', err);
                  const msg = (err && (err.errMsg || err.message)) ? (err.errMsg || err.message) : '支付失败';
                  wx.showToast({ title: msg, icon: 'none', duration: 2000 });
                }
              });
            })
            .catch((err) => {
              wx.hideLoading();
              console.error('[membership] /api/pay/jsapi failed =>', err);
              wx.showToast({
                title: (err && err.message) ? err.message : '拉起支付失败',
                icon: 'none'
              });
            });
        });
      }
    });
  },

  goCamp() {
    wx.navigateTo({ url: '/pages/campIntro/index' });
  },

  goBackCalc() {
    wx.navigateBack();
  }
});
