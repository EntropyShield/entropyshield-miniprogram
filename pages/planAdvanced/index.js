// pages/planAdvanced/index.js
const funnel = require('../../utils/funnel.js');

function getUserRights() {
  return wx.getStorageSync('userRights') || {};
}

function isAdvancedAllowed(userRights) {
  if (!userRights) return false;

  // 到期则不允许
  const expireAt = Number(userRights.membershipExpireAt || 0);
  if (expireAt && Date.now() > expireAt) return false;

  // 后端显式开关（最可靠）
  if (userRights.advancedEnabled === true) return true;

  // 兼容字段：membershipPlan = quarter/year
  const plan = String(userRights.membershipPlan || '').toLowerCase();
  if (plan === 'quarter' || plan === 'year') return true;

  // 兼容显示名：包含“季卡/年卡”
  const name = String(userRights.membershipName || '');
  if (name.includes('季卡') || name.includes('年卡')) return true;

  return false;
}

Page({
  data: {
    code: '',
    membershipType: '高阶策略 · 演示版',

    totalCapital: '',
    firstPrice: '',
    maxRiskPriceStep: '',
    targetPrice: '',
    targetProfit: '',
    steps: []
  },

  onLoad(options) {
    const totalCapital = parseFloat(options.balance || options.capital || 0);
    const firstPrice = parseFloat(options.price || options.firstPrice || 0);
    const code = options.code ? decodeURIComponent(options.code) : '';
    const membershipType = options.membershipType
      ? decodeURIComponent(options.membershipType)
      : '高阶策略 · 演示版';

    if (!totalCapital || !firstPrice) {
      wx.showToast({
        title: '参数缺失，请返回重新输入',
        icon: 'none'
      });
      return;
    }

    // ===== 加强版硬门禁：只有季卡/年卡允许进入 =====
    const rights = getUserRights();
    const allowed = isAdvancedAllowed(rights);

    if (!allowed) {
      funnel.log('PLAN_ADVANCED_BLOCKED', {
        membershipPlan: rights.membershipPlan || '',
        membershipName: rights.membershipName || '',
        freeCalcTimes: Number(rights.freeCalcTimes || 0),
        expireAt: Number(rights.membershipExpireAt || 0)
      });

      wx.showModal({
        title: '需要季卡/年卡',
        content: '加强版仅对「季卡/年卡」开放；9.9 次卡 / 14天体验 / 月卡仅支持稳健版。',
        confirmText: '去开通',
        cancelText: '返回',
        success: (r) => {
          const q =
            `&balance=${encodeURIComponent(totalCapital || '')}` +
            `&price=${encodeURIComponent(firstPrice || '')}` +
            `&code=${encodeURIComponent(code || '')}`;

          if (r.confirm) {
            // 去会员页开通加强版（季/年）
            wx.redirectTo({
              url: `/pages/membership/index?type=advanced${q}`
            });
          } else {
            // 返回上一页
            wx.navigateBack({ delta: 1 });
          }
        }
      });
      return;
    }
    // ===== 门禁结束 =====

    const result = this.calcAdvancedPlan(totalCapital, firstPrice);

    this.setData({
      code,
      membershipType,
      totalCapital: result.totalCapital,
      firstPrice: result.firstPrice,
      maxRiskPriceStep: result.maxRiskPriceStep,
      targetPrice: result.targetPrice,
      targetProfit: result.targetProfit,
      steps: result.steps
    });
  },

  /**
   * 加强版完整计算公式
   */
  calcAdvancedPlan(T, P1) {
    const useRatio = 0.8;
    const riskRatio = 0.02;
    const w1 = 0.5, w2 = 0.3, w3 = 0.2;

    const available = T * useRatio;
    const totalShares = available / P1;

    const qty1 = totalShares * w1;
    const qty2 = totalShares * w2;
    const qty3 = totalShares * w3;

    const p1 = P1;
    const p2 = p1 * 1.05;
    const p3 = p2 * 1.04;

    const maxRiskPriceStep = (T * riskRatio) / qty1;

    const targetPrice = p1 + maxRiskPriceStep * 7;

    const profit1 = (targetPrice - p1) * qty1;
    const profit2 = (targetPrice - p2) * qty2;
    const profit3 = (targetPrice - p3) * qty3;
    const targetProfit = profit1 + profit2 + profit3;

    const stop1 = p1 - maxRiskPriceStep;
    const stop2 = p2 - maxRiskPriceStep;
    const stop3 = p3 - maxRiskPriceStep;

    const sl1Amount = (stop1 - p1) * qty1;

    const sl2Amount =
      (stop2 - p2) * qty2 +
      (stop2 - p1) * qty1;

    const sl3Amount =
      (stop3 - p3) * qty3 +
      (stop3 - p2) * qty2 +
      (stop3 - p1) * qty1;

    const steps = [
      {
        label: '第一次进场',
        buyPrice: p1.toFixed(2),
        buyShares: qty1.toFixed(0),
        buyAmount: (p1 * qty1).toFixed(2),
        stopPrice: stop1.toFixed(2),
        stopAmount: sl1Amount.toFixed(2)
      },
      {
        label: '第二次进场',
        buyPrice: p2.toFixed(2),
        buyShares: qty2.toFixed(0),
        buyAmount: (p2 * qty2).toFixed(2),
        stopPrice: stop2.toFixed(2),
        stopAmount: sl2Amount.toFixed(2)
      },
      {
        label: '第三次进场',
        buyPrice: p3.toFixed(2),
        buyShares: qty3.toFixed(0),
        buyAmount: (p3 * qty3).toFixed(2),
        stopPrice: stop3.toFixed(2),
        stopAmount: sl3Amount.toFixed(2)
      }
    ];

    return {
      totalCapital: T.toFixed(2),
      firstPrice: P1.toFixed(2),
      maxRiskPriceStep: maxRiskPriceStep.toFixed(4),
      targetPrice: targetPrice.toFixed(2),
      targetProfit: targetProfit.toFixed(2),
      steps
    };
  },

  goPayIntro() {
    const { totalCapital, firstPrice, code, membershipType } = this.data;

    funnel.log('PLAN_ADVANCED_TO_PAYINTRO', {
      from: 'planAdvanced',
      membershipType,
      capital: totalCapital,
      price: firstPrice,
      code
    });

    wx.navigateTo({
      url:
        '/pages/payIntro/index'
        + '?from=planAdvanced'
        + '&membershipType=' + encodeURIComponent(membershipType || '')
        + '&balance=' + encodeURIComponent(totalCapital || '')
        + '&price=' + encodeURIComponent(firstPrice || '')
        + '&code=' + encodeURIComponent(code || '')
    });
  },

  goBackCalc() {
    wx.navigateBack({
      delta: 2
    });
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});
