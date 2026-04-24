const { syncServerRights } = require('../../utils/rightsSync');
const { mergeUserRights } = require('../../utils/userRights');

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

function getPlanMeta(planKey, amountFen) {
  const map = {
    times3: { title: '9.9元 / 3天体验购买成功', rights: '稳健版', desc: '已开通3天体验，可返回使用稳健版' },
    month: { title: '月会员开通成功', rights: '稳健版', desc: '已开通月会员权益' },
    quarter: { title: '季度会员开通成功', rights: '稳健版 + 加强版', desc: '已开通季度会员权益' },
    year: { title: '年度会员开通成功', rights: '稳健版 + 加强版', desc: '已开通年度会员权益' }
  };
  if (map[planKey]) return map[planKey];

  const amount = Number(amountFen || 0);
  if (amount === 990) return map.times3;
  if (amount === 99900) return map.month;
  if (amount === 299900) return map.quarter;
  if (amount === 999900) return map.year;

  return { title: '购买成功', rights: '权益已开通', desc: '可返回使用风控计算器' };
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

  for (let i = 0; i < candidates.length; i++) {
    const item = candidates[i] || {};

    if (!planKey) {
      planKey = normalizePlanKey(
        item.planKey ||
        item.type ||
        item.plan ||
        item.membershipPlan ||
        item.currentMembershipType ||
        item.productCode ||
        item.membershipProductCode ||
        item.membershipLevel ||
        item.membershipName ||
        item.goodsName ||
        item.productName ||
        item.title ||
        ''
      );
    }

    if (!amountFen) {
      amountFen = pickAmountFen(item);
    }

    if (planKey && amountFen) break;
  }

  if (!planKey) {
    planKey = inferPlanKeyByAmount(amountFen);
  }

  return {
    planKey,
    amountFen
  };
}

function buildLocalMembershipPatch(planKey, amountFen) {
  const rights = wx.getStorageSync('userRights') || {};
  const amount = Number(amountFen || 0) || 0;
  const patch = {};

  if (planKey === 'times3' || amount === 990) {
    const expireAt = extendExpireMs(rights.membershipExpireAt || rights.trialExpireAt, 3);
    Object.assign(patch, {
      currentMembershipType: 'trial3',
      currentMembershipName: '3天体验',
      membershipName: '3天体验',
      membershipPlan: 'trial3',
      membershipLevel: 'TRIAL3',
      productCode: 'VIP_ONCE3',
      membershipProductCode: 'VIP_ONCE3',
      membershipExpireAt: expireAt,
      advancedEnabled: false,
      isMemberActive: true,

      // 兼容字段，仅兼容，不承担判权职责
      trialPurchaseCount: (Number(rights.trialPurchaseCount || 0) || 0) + 1,
      trialActive: true,
      trialExpireAt: expireAt
    });
  }

  if (planKey === 'month' || amount === 99900) {
    const expireAt = extendExpireMs(rights.membershipExpireAt, 30);
    Object.assign(patch, {
      currentMembershipType: 'month',
      currentMembershipName: '月会员',
      membershipName: '月会员',
      membershipPlan: 'month',
      membershipLevel: 'MONTH',
      productCode: 'VIP_MONTH',
      membershipProductCode: 'VIP_MONTH',
      membershipExpireAt: expireAt,
      advancedEnabled: false,
      isMemberActive: true
    });
  }

  if (planKey === 'quarter' || amount === 299900) {
    const expireAt = extendExpireMs(rights.membershipExpireAt, 90);
    Object.assign(patch, {
      currentMembershipType: 'quarter',
      currentMembershipName: '季度会员',
      membershipName: '季度会员',
      membershipPlan: 'quarter',
      membershipLevel: 'QUARTER',
      productCode: 'VIP_QUARTER',
      membershipProductCode: 'VIP_QUARTER',
      membershipExpireAt: expireAt,
      advancedEnabled: true,
      isMemberActive: true
    });
  }

  if (planKey === 'year' || amount === 999900) {
    const expireAt = extendExpireMs(rights.membershipExpireAt, 365);
    Object.assign(patch, {
      currentMembershipType: 'year',
      currentMembershipName: '年度会员',
      membershipName: '年度会员',
      membershipPlan: 'year',
      membershipLevel: 'YEAR',
      productCode: 'VIP_YEAR',
      membershipProductCode: 'VIP_YEAR',
      membershipExpireAt: expireAt,
      advancedEnabled: true,
      isMemberActive: true
    });
  }

  return patch;
}

function syncLocalRightsAfterPaid(planKey, amountFen) {
  const patch = buildLocalMembershipPatch(planKey, amountFen);
  if (Object.keys(patch).length > 0) {
    const merged = mergeUserRights(patch);
    try {
      wx.setStorageSync('lastPaySuccessResolved', {
        planKey,
        amountFen,
        patch,
        savedAt: Date.now()
      });
    } catch (e) {}
    return { ok: true, patch, merged };
  }

  try {
    wx.setStorageSync('lastPaySuccessResolved', {
      planKey,
      amountFen,
      patch: null,
      savedAt: Date.now()
    });
  } catch (e) {}

  return { ok: false, patch: null, merged: null };
}

function hasEffectiveMembership(rights) {
  const r = rights || {};
  const hasType = !!(
    r.membershipPlan ||
    r.productCode ||
    r.membershipProductCode ||
    (r.membershipLevel && String(r.membershipLevel).toUpperCase() !== 'FREE')
  );
  const expireAt = toExpireMs(r.membershipExpireAt);
  const notExpired = !expireAt || expireAt > Date.now();
  return hasType && notExpired;
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

function reconcileRightsAfterPaid(localPatch, resolved) {
  const clientId = getPaySuccessClientId();

  if (!clientId) {
    try {
      wx.setStorageSync('lastPaySuccessSyncResult', {
        ok: false,
        code: 'CLIENT_ID_EMPTY',
        scene: 'pay_success',
        savedAt: Date.now()
      });
    } catch (e) {}
    return;
  }

  const ctx = resolved || {};
  const delays = [0, 1200, 3000, 5200];

  delays.forEach((delay) => {
    setTimeout(() => {
      const beforeRights = wx.getStorageSync('userRights') || {};
      const beforeHasMembership = hasEffectiveMembership(beforeRights);

      syncServerRights({
        clientId,
        scene: delay === 0 ? 'pay_success_immediate' : 'pay_success_retry',
        planKey: ctx.planKey || '',
        amountFen: ctx.amountFen || 0
      })
        .then((res) => {
          const afterRights = wx.getStorageSync('userRights') || {};
          const afterHasMembership = hasEffectiveMembership(afterRights);

          try {
            wx.setStorageSync('lastPaySuccessSyncResult', {
              ok: !!(res && res.ok),
              code: (res && res.code) || '',
              scene: delay === 0 ? 'pay_success_immediate' : 'pay_success_retry',
              delay,
              clientId,
              planKey: ctx.planKey || '',
              amountFen: ctx.amountFen || 0,
              effectiveRightsVersion:
                res &&
                res.effectiveRights &&
                res.effectiveRights.version,
              membershipName: afterRights.membershipName || '',
              membershipExpireAt: afterRights.membershipExpireAt || 0,
              savedAt: Date.now()
            });
          } catch (e) {}

          if ((beforeHasMembership || localPatch) && !afterHasMembership && localPatch) {
            mergeUserRights(localPatch);
          }
        })
        .catch((err) => {
          try {
            wx.setStorageSync('lastPaySuccessSyncResult', {
              ok: false,
              code: 'SYNC_EXCEPTION',
              message: String((err && err.message) || err || ''),
              delay,
              clientId,
              planKey: ctx.planKey || '',
              amountFen: ctx.amountFen || 0,
              savedAt: Date.now()
            });
          } catch (e) {}

          if (localPatch) {
            mergeUserRights(localPatch);
          }
        });
    }, delay);
  });
}

Page({
  data: {
    title: '',
    rights: '',
    desc: '',
    amountText: ''
  },

  onLoad(options) {
    const resolved = resolvePayContext(options || {});
    const meta = getPlanMeta(resolved.planKey, resolved.amountFen);

    const applied = syncLocalRightsAfterPaid(resolved.planKey, resolved.amountFen);
    reconcileRightsAfterPaid(applied && applied.patch ? applied.patch : null, resolved);

    this.setData({
      title: meta.title,
      rights: meta.rights,
      desc: meta.desc,
      amountText: resolved.amountFen ? (resolved.amountFen / 100).toFixed(2) : ''
    });

    try {
      console.log('[paySuccess] resolved context =>', resolved);
      console.log('[paySuccess] local rights =>', wx.getStorageSync('userRights'));
    } catch (e) {}
  },

  goCalc() {
    wx.redirectTo({
      url: '/pages/riskCalculator/index',
      fail() {
        wx.navigateTo({ url: '/pages/riskCalculator/index' });
      }
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});