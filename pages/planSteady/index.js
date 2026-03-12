// pages/planSteady/index.js
const funnel = require('../../utils/funnel.js');

Page({
  data: {
    code: '',
    membershipType: '稳健策略 · 演示版',

    totalCapital: '',   // 账户资金 T
    firstPrice: '',     // 首次买入价 P1

    targetPrice: '',    // 目标收益价格
    targetProfit: '',   // 目标收益利润

    steps: []           // 有效建仓步骤（自动过滤 0 股）
  },

  onLoad(options) {
    // 从上一页接收参数
    const totalCapital = parseFloat(options.balance || options.capital || 0);
    const firstPrice = parseFloat(options.price || options.firstPrice || 0);
    const code = options.code ? decodeURIComponent(options.code) : '';
    const membershipType = options.membershipType
      ? decodeURIComponent(options.membershipType)
      : '稳健策略 · 演示版';

    if (!totalCapital || !firstPrice || isNaN(totalCapital) || isNaN(firstPrice)) {
      wx.showToast({
        title: '参数缺失，请返回重新输入',
        icon: 'none'
      });
      return;
    }

    const plan = this.calcSteadyPlan(totalCapital, firstPrice);

    if (!plan.steps.length) {
      wx.showToast({
        title: '当前资金不足以形成1手有效建仓',
        icon: 'none'
      });
    } else if (plan.steps.length < 4) {
      wx.showToast({
        title: `已自动缩减为${plan.steps.length}次有效建仓`,
        icon: 'none'
      });
    }

    this.setData({
      code,
      membershipType,
      totalCapital: plan.totalCapital,
      firstPrice: plan.firstPrice,
      targetPrice: plan.targetPrice,
      targetProfit: plan.targetProfit,
      steps: plan.steps
    });
  },

  /**
   * 稳健版 4 次进场 + 止损 公式
   *
   * 保持原公式不变，只修 3 个问题：
   * 1）某一步不足 100 股时，不再展示 0 股
   * 2）分母为 0 时，避免 NaN / Infinity
   * 3）过滤无效步骤后，重新编号展示
   */
  calcSteadyPlan(T, P1) {
    const useRatio = 0.8; // 80% 资金参与本轮交易
    const w1 = 0.4;
    const w2 = 0.1;
    const w3 = 0.3;
    const w4 = 0.2;

    // 风险金额比例
    const r1 = 0.02;
    const r2 = 0.0154;
    const r3 = 0.01804;
    const r4 = 0.01269856;

    const LOT_SIZE = 100;

    const roundLotDown = (shares) => {
      return Math.floor(Math.max(0, shares) / LOT_SIZE) * LOT_SIZE;
    };

    const safeDiv = (num, den, fallback = 0) => {
      return den > 0 ? (num / den) : fallback;
    };

    // 理论可用资金 & 总股数
    const available = T * useRatio;
    const totalShares = available / P1;

    // 4 次建仓股数（保持原逻辑：向下取整到 100 股）
    const N1 = roundLotDown(totalShares * w1);
    const N2 = roundLotDown(totalShares * w2);
    const N3 = roundLotDown(totalShares * w3);
    const N4 = roundLotDown(totalShares * w4);

    // 4 次建仓价格
    const P2 = P1 * 1.03;
    const P3 = P2 * 1.03;
    const P4 = P3 * 1.06;

    // 4 次建仓金额
    const M1 = N1 * P1;
    const M2 = N2 * P2;
    const M3 = N3 * P3;
    const M4 = N4 * P4;

    const sumShares12 = N1 + N2;
    const sumShares123 = N1 + N2 + N3;
    const sumShares1234 = N1 + N2 + N3 + N4;

    // 风险金额
    const L1 = -T * r1;
    const L2 = -T * r2;
    const L3 = -T * r3;
    const L4 = T * r4;

    // 4 个止损价格（分母为 0 时兜底，避免 NaN / Infinity）
    const S1 = safeDiv(L1 + N1 * P1, N1, P1);
    const S2 = safeDiv(L2 + N1 * P1 + N2 * P2, sumShares12, P2);
    const S3 = safeDiv(L3 + N1 * P1 + N2 * P2 + N3 * P3, sumShares123, P3);
    const S4 = safeDiv(L4 + N1 * P1 + N2 * P2 + N3 * P3 + N4 * P4, sumShares1234, P4);

    // 对应的止损金额（用来展示）
    const sl1Amount = (S1 - P1) * N1;
    const sl2Amount = (S2 - P1) * N1 + (S2 - P2) * N2;
    const sl3Amount = (S3 - P1) * N1 + (S3 - P2) * N2 + (S3 - P3) * N3;
    const sl4Amount = (S4 - P1) * N1 + (S4 - P2) * N2 + (S4 - P3) * N3 + (S4 - P4) * N4;

    // 目标价 & 目标利润（保持原比例）
    const targetPrice = P1 * 1.2525;
    const targetProfit = T * 0.21305536;

    // 原始 4 步
    const rawSteps = [
      {
        originalIndex: 1,
        buyPrice: P1,
        buyShares: N1,
        buyAmount: M1,
        stopPrice: S1,
        stopAmount: sl1Amount
      },
      {
        originalIndex: 2,
        buyPrice: P2,
        buyShares: N2,
        buyAmount: M2,
        stopPrice: S2,
        stopAmount: sl2Amount
      },
      {
        originalIndex: 3,
        buyPrice: P3,
        buyShares: N3,
        buyAmount: M3,
        stopPrice: S3,
        stopAmount: sl3Amount
      },
      {
        originalIndex: 4,
        buyPrice: P4,
        buyShares: N4,
        buyAmount: M4,
        stopPrice: S4,
        stopAmount: sl4Amount
      }
    ];

    // 过滤掉 0 股步骤，并重新编号
    const steps = rawSteps
      .filter(item => item.buyShares >= LOT_SIZE && item.buyAmount > 0)
      .map((item, idx) => ({
        label: `第 ${idx + 1} 次建仓`,
        buyPrice: item.buyPrice.toFixed(2),
        buyShares: item.buyShares,
        buyAmount: item.buyAmount.toFixed(2),
        stopPrice: item.stopPrice.toFixed(2),
        stopAmount: item.stopAmount.toFixed(2)
      }));

    return {
      totalCapital: T.toFixed(2),
      firstPrice: P1.toFixed(2),
      targetPrice: targetPrice.toFixed(2),
      targetProfit: targetProfit.toFixed(2),
      steps
    };
  },

  // 跳到「进阶控局者服务」（收费方案介绍）
  goPayIntro() {
    const { totalCapital, firstPrice, code, membershipType } = this.data;

    funnel.log('PLAN_STEADY_TO_PAYINTRO', {
      from: 'planSteady',
      membershipType,
      capital: totalCapital,
      price: firstPrice,
      code
    });

    wx.navigateTo({
      url:
        '/pages/payIntro/index'
        + '?from=planSteady'
        + '&membershipType=' + encodeURIComponent(membershipType || '')
        + '&balance=' + encodeURIComponent(totalCapital || '')
        + '&price=' + encodeURIComponent(firstPrice || '')
        + '&code=' + encodeURIComponent(code || '')
    });
  },

  // 返回首页
  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});