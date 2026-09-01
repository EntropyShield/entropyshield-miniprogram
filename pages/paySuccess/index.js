const { syncServerRights } = require('../../utils/rightsSync');
const { API_BASE } = require('../../config');

const PAY_SUCCESS_CONTEXT_KEYS = [
  'lastPaySuccessInfo',
  'paySuccessInfo',
  'lastPayOrder',
  'lastPaidOrder',
  'pendingPayOrder',
  'currentPayOrder',
  'payOrderResult',
  'createPayOrderResult',
  'membershipOrderInfo',
  'lastOrderInfo'
];

function getApiBase() {
  try {
    const saved =
      wx.getStorageSync('API_BASE') ||
      wx.getStorageSync('apiBaseUrl') ||
      '';

    if (saved) {
      return String(saved).replace(/\/+$/, '');
    }
  } catch (e) {}

  return String(API_BASE || '').replace(/\/+$/, '');
}

function getPlanMeta(planKey, amountFen) {
  const map = {
    times3: {
      title: '9.9\u5143 / 7\u5929\u4f53\u9a8c\u652f\u4ed8\u5b8c\u6210',
      rights: '\u7a33\u5065\u7248',
      desc: '\u6b63\u5728\u7b49\u5f85\u670d\u52a1\u7aef\u786e\u8ba4\u6743\u76ca'
    },
    month: {
      title: '\u6708\u4f1a\u5458\u652f\u4ed8\u5b8c\u6210',
      rights: '\u7a33\u5065\u7248',
      desc: '\u6b63\u5728\u7b49\u5f85\u670d\u52a1\u7aef\u786e\u8ba4\u6743\u76ca'
    },
    quarter: {
      title: '\u5b63\u5ea6\u4f1a\u5458\u652f\u4ed8\u5b8c\u6210',
      rights: '\u7a33\u5065\u7248 + \u52a0\u5f3a\u7248',
      desc: '\u6b63\u5728\u7b49\u5f85\u670d\u52a1\u7aef\u786e\u8ba4\u6743\u76ca'
    },
    year: {
      title: '\u5e74\u5ea6\u4f1a\u5458\u652f\u4ed8\u5b8c\u6210',
      rights: '\u7a33\u5065\u7248 + \u52a0\u5f3a\u7248',
      desc: '\u6b63\u5728\u7b49\u5f85\u670d\u52a1\u7aef\u786e\u8ba4\u6743\u76ca'
    }
  };

  if (map[planKey]) return map[planKey];

  const amount = Number(amountFen || 0);
  if (amount === 990) return map.times3;
  if (amount === 99900) return map.month;
  if (amount === 299900) return map.quarter;
  if (amount === 999900) return map.year;

  return {
    title: '\u652f\u4ed8\u5b8c\u6210',
    rights: '\u6743\u76ca\u786e\u8ba4\u4e2d',
    desc: '\u6b63\u5728\u7b49\u5f85\u670d\u52a1\u7aef\u786e\u8ba4\u6743\u76ca'
  };
}

function toExpireMs(v) {
  if (v === null || typeof v === 'undefined' || v === '') return 0;

  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return 0;
    if (v > 1e12) return Math.floor(v);
    if (v > 1e9) return Math.floor(v * 1000);
    return Math.floor(v);
  }

  const s = String(v || '').trim();
  if (!s) return 0;

  if (/^\d+$/.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return 0;
    if (n > 1e12) return Math.floor(n);
    if (n > 1e9) return Math.floor(n * 1000);
    return Math.floor(n);
  }

  const t = Date.parse(s.replace(' ', 'T'));
  return Number.isFinite(t) ? Math.floor(t) : 0;
}

function extendExpireMs(currentExpireAt, days) {
  const now = Date.now();
  const current = toExpireMs(currentExpireAt);
  const base = current > now ? current : now;
  return base + days * 24 * 60 * 60 * 1000;
}

function safeParseMaybeJson(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  if (typeof v !== 'string') return null;
  try {
    const obj = JSON.parse(v);
    return obj && typeof obj === 'object' ? obj : null;
  } catch (e) {
    return null;
  }
}

function pickAmountFen(raw) {
  if (!raw || typeof raw !== 'object') return 0;

  const candidates = [
    raw.amountFen,
    raw.payAmountFen,
    raw.totalFee,
    raw.total_fee,
    raw.amount,
    raw.payAmount,
    raw.priceFen,
    raw.orderAmountFen,
    raw.cashFee,
    raw.cash_fee
  ];

  for (let i = 0; i < candidates.length; i++) {
    const v = candidates[i];
    if (v === null || typeof v === 'undefined' || v === '') continue;

    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) continue;

    if (n === 9.9) return 990;
    if (n === 999) return 99900;
    if (n === 2999) return 299900;
    if (n === 9999) return 999900;

    if (n === 990 || n === 99900 || n === 299900 || n === 999900) return Math.floor(n);

    if (!Number.isInteger(n) && n > 0) {
      return Math.round(n * 100);
    }

    return Math.floor(n);
  }

  return 0;
}

function normalizePlanKey(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';

  if (
    s === 'times3' ||
    s === 'trial3' ||
    s === 'vip_once3' ||
    s === 'once3' ||
    s.includes('3天') ||
    s.includes('7天') ||
    s.includes('体验') ||
    s.includes('9.9')
  ) return 'times3';

  if (s === 'month' || s === 'vip_month' || s.includes('月')) return 'month';
  if (s === 'quarter' || s === 'vip_quarter' || s.includes('季')) return 'quarter';
  if (s === 'year' || s === 'vip_year' || s.includes('年')) return 'year';

  return '';
}

function inferPlanKeyByAmount(amountFen) {
  const n = Number(amountFen || 0);
  if (n === 990) return 'times3';
  if (n === 99900) return 'month';
  if (n === 299900) return 'quarter';
  if (n === 999900) return 'year';
  return '';
}

function getContextCandidates(options) {
  const list = [];
  if (options && typeof options === 'object') list.push(options);

  PAY_SUCCESS_CONTEXT_KEYS.forEach((key) => {
    const val = wx.getStorageSync(key);
    const obj = safeParseMaybeJson(val) || val;
    if (obj && typeof obj === 'object') {
      list.push(obj);
    }
  });

  try {
    const app = getApp && getApp();
    if (app && app.globalData) {
      const gd = app.globalData;
      [
        gd.lastPaySuccessInfo,
        gd.paySuccessInfo,
        gd.lastPayOrder,
        gd.pendingPayOrder,
        gd.currentPayOrder
      ].forEach((v) => {
        if (v && typeof v === 'object') list.push(v);
      });
    }
  } catch (e) {}

  return list;
}

function resolvePayContext(options) {
  const candidates = getContextCandidates(options);

  let planKey = '';
  let amountFen = 0;
  let outTradeNo = '';

  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i] || {};

    if (!planKey) {
      planKey = normalizePlanKey(
        item.planKey ||
        item.plan ||
        item.productCode ||
        item.membershipLevel ||
        item.membershipName ||
        ''
      );
    }

    if (!amountFen) {
      amountFen = pickAmountFen(item);
    }

    if (!outTradeNo) {
      outTradeNo = String(
        item.outTradeNo ||
        item.out_trade_no ||
        item.orderNo ||
        item.order_no ||
        ''
      ).trim();
    }

    if (planKey && amountFen && outTradeNo) break;
  }

  if (!planKey) {
    planKey = inferPlanKeyByAmount(amountFen);
  }

  return {
    planKey,
    amountFen,
    outTradeNo
  };
}


function getPaySuccessClientId() {
  let clientId = '';

  try {
    clientId =
      wx.getStorageSync('clientId') ||
      wx.getStorageSync('openid') ||
      wx.getStorageSync('openId') ||
      '';
  } catch (e) {}

  if (!clientId) {
    try {
      const rights = wx.getStorageSync('userRights') || {};
      const identity = rights.identity || {};
      const effectiveRights = rights.effectiveRights || {};
      const effectiveIdentity = effectiveRights.identity || {};

      clientId =
        rights.clientId ||
        rights.openid ||
        identity.clientId ||
        identity.openid ||
        effectiveIdentity.clientId ||
        effectiveIdentity.openid ||
        '';
    } catch (e) {}
  }

  if (!clientId) {
    try {
      const app = getApp && getApp();
      const gd = (app && app.globalData) || {};
      clientId =
        gd.clientId ||
        gd.openid ||
        gd.openId ||
        (gd.userInfo && gd.userInfo.openid) ||
        '';
    } catch (e) {}
  }

  return String(clientId || '').trim();
}

function reconcileRightsAfterPaid(page, resolved) {
  const clientId = getPaySuccessClientId();
  const ctx = resolved || {};
  const apiBase = getApiBase();

  if (!clientId || !ctx.outTradeNo || !apiBase) {
    page.setData({
      statusDesc: '\u8ba2\u5355\u4fe1\u606f\u4e0d\u5b8c\u6574\uff0c\u8bf7\u7a0d\u540e\u8fd4\u56de\u9996\u9875\u67e5\u770b\u6743\u76ca'
    });
    return;
  }

  const delays = [0, 1200, 3000, 5200];
  let confirmed = false;

  delays.forEach((delay, index) => {
    setTimeout(() => {
      if (confirmed) return;

      wx.request({
        url:
          apiBase +
          '/api/virtual-pay/status?outTradeNo=' +
          encodeURIComponent(ctx.outTradeNo) +
          '&clientId=' +
          encodeURIComponent(clientId),

        method: 'GET',

        success(resp) {
          const data = (resp && resp.data) || {};

          const fulfilled =
            resp.statusCode === 200 &&
            data.ok === true &&
            data.fulfilled === true &&
            String(data.outTradeNo || '') === ctx.outTradeNo &&
            Number(data.amountFen || 0) === Number(ctx.amountFen || 0);

          if (!fulfilled) {
            if (index === delays.length - 1) {
              page.setData({
                statusDesc: '\u6743\u76ca\u4ecd\u5728\u786e\u8ba4\u4e2d\uff0c\u8bf7\u7a0d\u540e\u8fd4\u56de\u9996\u9875\u67e5\u770b'
              });
            }
            return;
          }

          syncServerRights({
            clientId,
            scene: 'pay_success_fulfilled',
            planKey: ctx.planKey || '',
            amountFen: ctx.amountFen || 0
          }).then((result) => {
            if (!result || result.ok !== true) return;

            confirmed = true;

            page.setData({
              confirmed: true,
              statusTitle: '\u6743\u76ca\u5df2\u5230\u8d26',
              statusDesc: '\u670d\u52a1\u7aef\u5df2\u786e\u8ba4\u5e76\u540c\u6b65\u6743\u76ca\uff0c\u53ef\u4ee5\u5f00\u59cb\u4f7f\u7528',
              desc: '\u6743\u76ca\u5df2\u5230\u8d26\uff0c\u53ef\u7acb\u5373\u4f7f\u7528'
            });
          });
        }
      });
    }, delay);
  });
}

Page({
  data: {
    statusTitle: '支付完成',
    statusDesc: '正在等待服务端确认权益',
    confirmed: false,
    title: '',
    rights: '',
    desc: '',
    amountText: ''
  },

  onLoad(options) {
    const resolved = resolvePayContext(options || {});
    const meta = getPlanMeta(
      resolved.planKey,
      resolved.amountFen
    );

    this.setData({
      title: meta.title,
      rights: meta.rights,
      desc: meta.desc,
      amountText: resolved.amountFen
        ? (resolved.amountFen / 100).toFixed(2)
        : ''
    });

    reconcileRightsAfterPaid(this, resolved);
  },

  goCalc() {
    if (!this.data.confirmed) {
      wx.showToast({
        title: '\u6743\u76ca\u4ecd\u5728\u786e\u8ba4\u4e2d',
        icon: 'none'
      });
      return;
    }

    wx.redirectTo({
      url: '/pages/riskCalculator/index',
      fail() {
        wx.navigateTo({
          url: '/pages/riskCalculator/index'
        });
      }
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});