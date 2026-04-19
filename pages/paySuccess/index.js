// pages/paySuccess/index.js
const UR = require('../../utils/userRights')

function getPlanMeta(planKey, amountFen) {
  const map = {
    times3: { title: '9.9体验·3天', rights: '稳健版', desc: '适合先体验风控计算器' },
    month: { title: '月卡 999', rights: '稳健版', desc: '适合短周期连续使用' },
    quarter: { title: '季卡 2999', rights: '稳健版 + 加强版', desc: '适合持续训练与复盘' },
    year: { title: '年卡 9999', rights: '稳健版 + 加强版', desc: '适合长期使用' }
  };
  if (map[planKey]) return map[planKey];

  const amount = Number(amountFen || 0);
  if (amount === 990) return map.times3;
  if (amount === 99900) return map.month;
  if (amount === 299900) return map.quarter;
  if (amount === 999900) return map.year;

  return { title: '购买成功', rights: '权益已开通', desc: '可返回使用风控计算器' };
}

function extendExpireMs(currentExpireAt, days) {
  const now = Date.now();
  const current = Number(currentExpireAt || 0) || 0;
  const base = current > now ? current : now;
  return base + days * 24 * 60 * 60 * 1000;
}

function syncLocalRightsAfterPaid(planKey, amountFen) {
  const rights = UR.getUserRights();
  const patch = {};
  const currentFree = Number(rights.freeCalcTimes || 0) || 0;

  if (planKey === 'times3' || Number(amountFen || 0) === 990) {
    patch.membershipName = '9.9体验·3天';
    patch.membershipPlan = 'trial3';
    patch.productCode = 'VIP_ONCE3';
    patch.membershipProductCode = 'VIP_ONCE3';
    patch.advancedEnabled = false;
    patch.freeCalcTimes = Math.max(currentFree, 3);
    patch.membershipExpireAt = extendExpireMs(rights.membershipExpireAt, 3);
  }

  if (planKey === 'month' || Number(amountFen || 0) === 99900) {
    patch.membershipName = '控局者·月卡';
    patch.membershipPlan = 'month';
    patch.productCode = 'VIP_MONTH';
    patch.membershipProductCode = 'VIP_MONTH';
    patch.advancedEnabled = false;
    patch.membershipExpireAt = extendExpireMs(rights.membershipExpireAt, 30);
  }

  if (planKey === 'quarter' || Number(amountFen || 0) === 299900) {
    patch.membershipName = '控局者·季卡';
    patch.membershipPlan = 'quarter';
    patch.productCode = 'VIP_QUARTER';
    patch.membershipProductCode = 'VIP_QUARTER';
    patch.advancedEnabled = true;
    patch.membershipExpireAt = extendExpireMs(rights.membershipExpireAt, 90);
  }

  if (planKey === 'year' || Number(amountFen || 0) === 999900) {
    patch.membershipName = '控局者·年卡';
    patch.membershipPlan = 'year';
    patch.productCode = 'VIP_YEAR';
    patch.membershipProductCode = 'VIP_YEAR';
    patch.advancedEnabled = true;
    patch.membershipExpireAt = extendExpireMs(rights.membershipExpireAt, 365);
  }

  if (Object.keys(patch).length > 0) {
    const next = UR.mergeUserRights(patch);
    console.log('[paySuccess] local rights synced =', next);
  }
}

Page({
  data: {
    title: '',
    rights: '',
    desc: '',
    amountText: ''
  },

  onLoad(options) {
    const opts = options || {};
    const planKey = String(opts.planKey || '').trim();
    const amountFen = Number(opts.amountFen || 0) || 0;
    const meta = getPlanMeta(planKey, amountFen);

    syncLocalRightsAfterPaid(planKey, amountFen);

    this.setData({
      title: meta.title,
      rights: meta.rights,
      desc: meta.desc,
      amountText: amountFen ? (amountFen / 100).toFixed(2) : ''
    });
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