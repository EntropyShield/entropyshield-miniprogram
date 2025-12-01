// pages/planAdvanced/index.js
const funnel = require('../../utils/funnel.js');

Page({
  data: {
    code: '',
    membershipType: '高阶策略 · 演示版',

    totalCapital: '',      // 账户资金 T
    firstPrice: '',        // 第一次买入价格 P1
    maxRiskPriceStep: '',  // 单股可承受风险价差
    targetPrice: '',       // 目标收益价格
    targetProfit: '',      // 目标收益利润
    steps: []              // 3 次进场 + 止损明细
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
    // 参数设定
    const useRatio = 0.8;      // 使用 80% 资金
    const riskRatio = 0.02;    // 最大风险 2%
    const w1 = 0.5, w2 = 0.3, w3 = 0.2; // 3 次进场权重

    // 1. 可用资金 & 总股数
    const available = T * useRatio;
    const totalShares = available / P1;

    // 2. 各次买入数量
    const qty1 = totalShares * w1;
    const qty2 = totalShares * w2;
    const qty3 = totalShares * w3;

    // 3. 各次买入价格
    const p1 = P1;
    const p2 = p1 * 1.05;  // +5%
    const p3 = p2 * 1.04;  // 在 P2 基础上 +4%

    // 4. 单股可承受风险价差（2% 总风险 / 第一次仓位）
    const maxRiskPriceStep = (T * riskRatio) / qty1;

    // 5. 目标价格（7R）
    const targetPrice = p1 + maxRiskPriceStep * 7;

    // 6. 总目标利润
    const profit1 = (targetPrice - p1) * qty1;
    const profit2 = (targetPrice - p2) * qty2;
    const profit3 = (targetPrice - p3) * qty3;
    const targetProfit = profit1 + profit2 + profit3;

    // 7. 止损价格
    const stop1 = p1 - maxRiskPriceStep;
    const stop2 = p2 - maxRiskPriceStep;
    const stop3 = p3 - maxRiskPriceStep;

    // 8. 止损金额（累计持仓）
    const sl1Amount =
      (stop1 - p1) * qty1;

    const sl2Amount =
      (stop2 - p2) * qty2 +
      (stop2 - p1) * qty1;

    const sl3Amount =
      (stop3 - p3) * qty3 +
      (stop3 - p2) * qty2 +
      (stop3 - p1) * qty1;

    // 9. 前端展示用字段（两位小数）
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

  // 跳转到「进阶控局者服务」页面
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

  // 返回风险计算器（从结果 → 会员 → 风控计算器，退两级）
  goBackCalc() {
    wx.navigateBack({
      delta: 2
    });
  },

  // 返回首页
  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});
