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

    if (!totalCapital || !firstPrice || isNaN(totalCapital) || isNaN(firstPrice)) {
      wx.showToast({
        title: '参数缺失，请返回重新输入',
        icon: 'none'
      });
      return;
    }

        // ===== 加强版硬门禁：只有季卡/年卡允许进入 =====
        const debugAllow = String(options.__debugAllow || '') === '1';

        const rights = getUserRights();
        const allowed = debugAllow ? true : isAdvancedAllowed(rights);
    
 if (!allowed) {
  funnel.log('PLAN_ADVANCED_BLOCKED', {
    membershipPlan: rights.membershipPlan || '',
    membershipName: rights.membershipName || '',
    freeCalcTimes: Number(rights.freeCalcTimes || 0),
    expireAt: Number(rights.membershipExpireAt || 0),
    debugAllow
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
            wx.redirectTo({
              url: `/pages/membership/index?type=advanced${q}`
            });
          } else {
            wx.navigateBack({ delta: 1 });
          }
        }
      });
      return;
    }
    // ===== 门禁结束 =====

    const result = this.calcAdvancedPlan(totalCapital, firstPrice);

    if (!result.steps.length) {
      wx.showToast({
        title: '当前资金不足以形成1手有效进场',
        icon: 'none'
      });
    } else if (result.steps.length < 3) {
      wx.showToast({
        title: `已自动缩减为${result.steps.length}次有效进场`,
        icon: 'none'
      });
    }

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
   *
   * 保持原公式不变，只修 3 个问题：
   * 1）某一步不足 100 股时，不再展示 0 股
   * 2）qty1 = 0 时，避免 Infinity / NaN
   * 3）过滤无效步骤后，重新编号展示
   */
  calcAdvancedPlan(T, P1) {
    const useRatio = 0.8;
    const riskRatio = 0.02;
    const w1 = 0.5;
    const w2 = 0.3;
    const w3 = 0.2;

    const LOT_SIZE = 100;

    const roundLotDown = (shares) => {
      return Math.floor(Math.max(0, shares) / LOT_SIZE) * LOT_SIZE;
    };

    const safeDiv = (num, den, fallback = 0) => {
      return den > 0 ? (num / den) : fallback;
    };

    const safeFixed = (num, digits = 2, fallback = '0.00') => {
      return Number.isFinite(num) ? num.toFixed(digits) : fallback;
    };

    const available = T * useRatio;
    const totalShares = available / P1;

    const qty1 = roundLotDown(totalShares * w1);
    const qty2 = roundLotDown(totalShares * w2);
    const qty3 = roundLotDown(totalShares * w3);

    const p1 = P1;
    const p2 = p1 * 1.05;
    const p3 = p2 * 1.04;

    const maxRiskPriceStep = safeDiv(T * riskRatio, qty1, 0);
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

    const rawSteps = [
      {
        originalIndex: 1,
        buyPrice: p1,
        buyShares: qty1,
        buyAmount: p1 * qty1,
        stopPrice: stop1,
        stopAmount: sl1Amount
      },
      {
        originalIndex: 2,
        buyPrice: p2,
        buyShares: qty2,
        buyAmount: p2 * qty2,
        stopPrice: stop2,
        stopAmount: sl2Amount
      },
      {
        originalIndex: 3,
        buyPrice: p3,
        buyShares: qty3,
        buyAmount: p3 * qty3,
        stopPrice: stop3,
        stopAmount: sl3Amount
      }
    ];

    const steps = rawSteps
      .filter(item => item.buyShares >= LOT_SIZE && item.buyAmount > 0)
      .map((item, idx) => ({
        label: `第 ${idx + 1} 次进场`,
        buyPrice: safeFixed(item.buyPrice, 2),
        buyShares: String(item.buyShares),
        buyAmount: safeFixed(item.buyAmount, 2),
        stopPrice: safeFixed(item.stopPrice, 2),
        stopAmount: safeFixed(item.stopAmount, 2)
      }));

    return {
      totalCapital: safeFixed(T, 2),
      firstPrice: safeFixed(P1, 2),
      maxRiskPriceStep: safeFixed(maxRiskPriceStep, 4, '0.0000'),
      targetPrice: safeFixed(targetPrice, 2),
      targetProfit: safeFixed(targetProfit, 2),
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