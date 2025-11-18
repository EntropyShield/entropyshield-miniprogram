// utils/riskPlans.js
// 统一管理：稳健版 & 加强版 风控方案计算

/**
 * 稳健版（4 次进场）
 * 资金占比：40% / 10% / 30% / 20%
 * 风险控制：总资金 2%，通过第一次仓位控制单股最大亏损
 *
 * @param {number} totalCapital  总资金，例如 1000000
 * @param {number} firstPrice    第一次建仓价格 P1，例如 50
 * @returns {object} 计算结果
 */
function calcSteadyPlan(totalCapital, firstPrice) {
  const useRatio = 0.8;                // 使用 80% 资金
  const weights = [0.4, 0.1, 0.3, 0.2]; // 4 次进场比例（资金 & 股数）
  const maxRiskRatio = 0.02;           // 最大承受风险 2%

  // 1. 可用资金
  const available = totalCapital * useRatio;

  // 2. 每次进场金额
  const amount1 = totalCapital * useRatio * weights[0];
  const amount2 = totalCapital * useRatio * weights[1];
  const amount3 = totalCapital * useRatio * weights[2];
  const amount4 = totalCapital * useRatio * weights[3];

  // 3. 最大承受风险金额
  const maxRiskAmount = totalCapital * maxRiskRatio;

  // 4. 可买总股数（全部按首次建仓价计算）
  const totalShares = available / firstPrice;

  // 5. 每次买入股数
  const shares1 = totalShares * weights[0];
  const shares2 = totalShares * weights[1];
  const shares3 = totalShares * weights[2];
  const shares4 = totalShares * weights[3];

  // 6. 每股最大风险波动价差（由第一次仓位控制）
  const riskPerShare = maxRiskAmount / shares1;

  // 如果需要，你也可以后续加上多档进场价格，这里先全部等于首次价格
  const price1 = firstPrice;
  const price2 = firstPrice;
  const price3 = firstPrice;
  const price4 = firstPrice;

  return {
    // 资金与风险
    available,                 // 可用资金（80%）
    amounts: [amount1, amount2, amount3, amount4], // 4 次进场金额
    maxRiskAmount,             // 最大承受风险金额（例如 2 万）
    riskPerShare,              // 每股最大风险价差

    // 股数结构
    totalShares,               // 理论可买总股数
    shares: [shares1, shares2, shares3, shares4],

    // 价格信息（目前全部等于首次价，后续可以按需要设计梯度）
    prices: [price1, price2, price3, price4]
  };
}

/**
 * 加强版（三次进场）
 * 资金占比：50% / 30% / 20%
 * 股数占比：50% / 30% / 20%
 * 价格递增：P2 = P1 * 1.03；P3 = P2 * 1.06
 * 风险控制：总资金 2%，由第一次仓位控制最大亏损
 * 目标价：P1 + 风险价差 * 7
 *
 * @param {number} totalCapital  总资金，例如 1000000
 * @param {number} firstPrice    第一次建仓价格 P1，例如 50
 * @returns {object} 计算结果
 */
function calcAdvancedPlan(totalCapital, firstPrice) {
  const useRatio = 0.8;                 // 使用 80% 资金
  const weights = [0.5, 0.3, 0.2];      // 三次进场比例（资金 & 股数）
  const maxRiskRatio = 0.02;            // 最大承受风险 2%

  const secondStepRate = 0.03;          // 第二次价格 +3%
  const thirdStepRate  = 0.06;          // 第三次价格在第二次基础上 +6%
  const targetRiskMulti = 7;            // 目标价 = P1 + 风险价差 * 7

  // 1. 可用资金
  const available = totalCapital * useRatio;

  // 2. 每次进场金额
  const amount1 = totalCapital * useRatio * weights[0];
  const amount2 = totalCapital * useRatio * weights[1];
  const amount3 = totalCapital * useRatio * weights[2];

  // 3. 最大承受风险金额
  const maxRiskAmount = totalCapital * maxRiskRatio;

  // 4. 可买总股数（全部按首次建仓价计算）
  const totalShares = available / firstPrice;

  // 5. 每次买入股数（50% / 30% / 20%）
  const shares1 = totalShares * weights[0];
  const shares2 = totalShares * weights[1];
  const shares3 = totalShares * weights[2];

  // 6. 每股最大风险波动价差（用第 1 仓位控制）
  const riskPerShare = maxRiskAmount / shares1;

  // 7. 三次进场价格
  const price1 = firstPrice;
  const price2 = price1 * (1 + secondStepRate);
  const price3 = price2 * (1 + thirdStepRate);

  // 8. 目标获利价格
  const targetPrice = price1 + targetRiskMulti * riskPerShare;

  // 9. 总盈利（完全按你指定的公式）
  const profit =
    (targetPrice - price1) * shares1 +
    (targetPrice - price2) * shares2 +
    (targetPrice - price3) * shares3;

  return {
    // 资金 & 风险
    available,                 // 可用资金（80%）
    amounts: [amount1, amount2, amount3],
    maxRiskAmount,             // 最大承受风险金额
    riskPerShare,              // 每股最大风险价差

    // 股数结构
    totalShares,
    shares: [shares1, shares2, shares3],

    // 价格结构
    prices: [price1, price2, price3],
    targetPrice,               // 目标获利价格
    profit                     // 按目标价计算出的总盈利
  };
}

module.exports = {
  calcSteadyPlan,
  calcAdvancedPlan
};
