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

    steps: []           // 4 次建仓 + 止损明细
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
   * 约定（与你提供的一致）：
   * - 资金使用比例 u = 0.8
   * - 权重：w1=0.4, w2=0.1, w3=0.3, w4=0.2
   * - 买入价：P2 = P1*1.03, P3 = P2*1.03, P4 = P3*1.06
   * - 风险金额：
   *   L1 = -0.02 * T
   *   L2 = -0.0154 * T
   *   L3 = -0.01804 * T
   *   L4 =  0.01269856 * T
   *   （用于反推止损价，使得在对应止损价全平时，浮盈/浮亏金额刚好等于 L1~L4）
   * - 目标价、目标利润（根据你给的数值反推）：
   *   TargetPrice = P1 * 1.2525
   *   TargetProfit = T * 0.21305536
   */
  calcSteadyPlan(T, P1) {
    const useRatio = 0.8; // 80% 资金参与本轮交易
    const w1 = 0.4;
    const w2 = 0.1;
    const w3 = 0.3;
    const w4 = 0.2;

    // 风险金额比例（由你给的 -20000, -15400, -18040, 12698.56 反推）
    const r1 = 0.02;        // L1 = -0.02 * T
    const r2 = 0.0154;      // L2 = -0.0154 * T
    const r3 = 0.01804;     // L3 = -0.01804 * T
    const r4 = 0.01269856;  // L4 =  0.01269856 * T

    // 理论可用资金 & 总股数
    const available = T * useRatio;     // A = T * 0.8
    const totalShares = available / P1; // N_total = A / P1

    // 4 次建仓股数（向下取整）
    const N1 = Math.floor(totalShares * w1);
    const N2 = Math.floor(totalShares * w2);
    const N3 = Math.floor(totalShares * w3);
    const N4 = Math.floor(totalShares * w4);

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
    const L4 =  T * r4;

    // 4 个止损价格（保证在此价位全平，盈亏 = L1~L4）
    const S1 = (L1 + N1 * P1) / N1;
    const S2 = (L2 + N1 * P1 + N2 * P2) / sumShares12;
    const S3 = (L3 + N1 * P1 + N2 * P2 + N3 * P3) / sumShares123;
    const S4 = (L4 + N1 * P1 + N2 * P2 + N3 * P3 + N4 * P4) / sumShares1234;

    // 对应的止损金额（用来展示）
    const sl1Amount = (S1 - P1) * N1;
    const sl2Amount = (S2 - P1) * N1 + (S2 - P2) * N2;
    const sl3Amount = (S3 - P1) * N1 + (S3 - P2) * N2 + (S3 - P3) * N3;
    const sl4Amount = (S4 - P1) * N1 + (S4 - P2) * N2 + (S4 - P3) * N3 + (S4 - P4) * N4;

    // 目标价 & 目标利润（按照你给的正确结果反推出来的比例）
    const targetPrice = P1 * 1.2525;      // 例：P1=50 → 62.625
    const targetProfit = T * 0.21305536;  // 例：T=1000000 → 213055.36

    // 拼装给 WXML 用的 steps
    const steps = [
      {
        label: '第 1 次建仓',
        buyPrice: P1.toFixed(2),
        buyShares: N1,
        buyAmount: M1.toFixed(2),
        stopPrice: S1.toFixed(2),
        stopAmount: sl1Amount.toFixed(2)
      },
      {
        label: '第 2 次建仓',
        buyPrice: P2.toFixed(2),
        buyShares: N2,
        buyAmount: M2.toFixed(2),
        stopPrice: S2.toFixed(2),
        stopAmount: sl2Amount.toFixed(2)
      },
      {
        label: '第 3 次建仓',
        buyPrice: P3.toFixed(2),
        buyShares: N3,
        buyAmount: M3.toFixed(2),
        stopPrice: S3.toFixed(2),
        stopAmount: sl3Amount.toFixed(2)
      },
      {
        label: '第 4 次建仓',
        buyPrice: P4.toFixed(2),
        buyShares: N4,
        buyAmount: M4.toFixed(2),
        stopPrice: S4.toFixed(2),
        stopAmount: sl4Amount.toFixed(2)
      }
    ];

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
