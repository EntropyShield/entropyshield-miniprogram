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

// 9.9元 / 7天体验：业务口径 2026-09-03 定稿——每 ID 限购 1 次，不可复购。
// 只有体验套餐才需要「升级会员」承接；月/季/年卡用户本身就是会员，再推升级是噪音。
function isTrialPlan(planKey, amountFen) {
  return planKey === 'times3' || Number(amountFen || 0) === 990;
}

// 权益到账判定。
// 字段取自线上 utils/rightsManager.js normalizeRights 的真实返回（已核对线上源码）：
//   membership.{active, expireAtText, remainingDays} · calculator.trialBoughtTimes · canUseCalculator
// ⚠️ 线上不返回「体验激活 / 体验到期」类字段，禁止臆造字段名——臆造后永远判不出到账，
//    表现就是用户付了钱、页面却一直卡在「权益确认中」。此处只用上面已核实的字段。
function readConfirmedRights(effectiveRights, planKey, amountFen) {
  const er = effectiveRights || {};
  const membership = er.membership || {};
  const calculator = er.calculator || {};

  const memberActive = membership.active === true;
  const trialBought = Number(calculator.trialBoughtTimes || 0) > 0;
  const canUse = er.canUseCalculator === true;

  return {
    confirmed: isTrialPlan(planKey, amountFen)
      ? (trialBought || canUse || memberActive)
      : memberActive,
    memberActive: memberActive,
    expireText: String(membership.expireAtText || '').trim(),
    remainingDays: Number(membership.remainingDays || 0)
  };
}

// 体验套餐的升级承接文案。
// 合规：只陈述功能与有效期，不出现收益暗示类措辞。
function buildUpgradeGuide(planKey, amountFen, rightsInfo) {
  if (!isTrialPlan(planKey, amountFen)) {
    return {
      showUpgrade: false,
      upgradeTitle: '',
      upgradeDesc: '',
      expireText: ''
    };
  }

  const info = rightsInfo || {};
  const expireText = info.expireText ? '有效期至 ' + info.expireText : '';

  return {
    showUpgrade: true,
    upgradeTitle: '7天体验已开通',
    upgradeDesc:
      '体验期内可完整使用风控计算器与每日风控仪表盘。体验到期后如需继续使用，可开通会员。',
    expireText: expireText
  };
}

// 轮询服务端权益直到到账。
//
// ⚠️ 历史 bug（本次修复）：这里曾轮询 /api/virtual-pay/status，但该接口线上根本不存在
//    （线上源码零匹配；本地后端仅在注释里标注「发版阻塞」，从未实现）。
//    后果：confirmed 永远为 false → 主按钮一直 disabled → 用户付了钱却点不了任何按钮。
//
//    现改为 syncServerRights（→ POST /api/rights/sync，线上真实存在，
//    挂载点 index.js:2339 app.use('/api/rights', createRightsRouter(...))）。
//    一次调用完成「拉取 + 落盘 + 返回 effectiveRights」，不再依赖订单状态接口。
//
// 另一处修复：任何异常收尾都必须放开出口（canLeave），不能把用户锁死在结果页。
function reconcileRightsAfterPaid(page, resolved) {
  const clientId = getPaySuccessClientId();
  const ctx = resolved || {};

  const finishWithError = function (desc) {
    page.setData({
      statusDesc: desc,
      canLeave: true
    });
  };

  if (!clientId) {
    finishWithError('暂时无法校验权益，可返回首页查看');
    return;
  }

  const delays = [0, 1200, 3000, 5200];
  let confirmed = false;

  delays.forEach(function (delay, index) {
    setTimeout(function () {
      if (confirmed) return;

      syncServerRights({
        clientId: clientId,
        scene: 'pay_success_reconcile',
        planKey: ctx.planKey || '',
        amountFen: ctx.amountFen || 0
      })
        .then(function (result) {
          if (confirmed) return;

          if (!result || result.ok !== true) {
            if (index === delays.length - 1) {
              finishWithError('权益同步较慢，可返回首页查看，权益以服务端为准');
            }
            return;
          }

          const info = readConfirmedRights(
            result.effectiveRights,
            ctx.planKey,
            ctx.amountFen
          );

          if (!info.confirmed) {
            if (index === delays.length - 1) {
              finishWithError('权益仍在确认中，可稍后返回首页查看');
            }
            return;
          }

          confirmed = true;

          const patch = {
            confirmed: true,
            canLeave: true,
            statusTitle: '权益已到账',
            statusDesc: '服务端已确认并同步权益，可以开始使用',
            desc: '权益已到账，可立即使用'
          };

          page.setData(
            Object.assign(
              patch,
              buildUpgradeGuide(ctx.planKey, ctx.amountFen, info)
            )
          );
        })
        .catch(function () {
          if (!confirmed && index === delays.length - 1) {
            finishWithError('权益同步较慢，可返回首页查看，权益以服务端为准');
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
    canLeave: false,
    title: '',
    rights: '',
    desc: '',
    amountText: '',
    showUpgrade: false,
    upgradeTitle: '',
    upgradeDesc: '',
    expireText: ''
  },

  onLoad(options) {
    const resolved = resolvePayContext(options || {});
    const meta = getPlanMeta(resolved.planKey, resolved.amountFen);

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

  // 主按钮按状态分发：
  // 已确认 → 去用计算器；未确认但已走完轮询 → 放行回首页（不再锁死）；
  // 仍在轮询中 → 提示等待。
  onPrimaryTap() {
    if (this.data.confirmed) {
      this.goCalc();
      return;
    }

    if (this.data.canLeave) {
      this.goHome();
      return;
    }

    wx.showToast({ title: '权益确认中', icon: 'none' });
  },

  goCalc() {
    wx.redirectTo({
      url: '/pages/riskCalculator/index',
      fail() {
        wx.navigateTo({ url: '/pages/riskCalculator/index' });
      }
    });
  },

  // 体验套餐的升级承接入口。
  // 背景：到期提醒依赖订阅消息，而 5 个模板 ID 仍在审核中，
  // 成功页明示到期日是当前唯一可靠的提醒手段，因此这里必须能进会员页。
  goMembership() {
    wx.navigateTo({
      url: '/pages/membership/index',
      fail() {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
