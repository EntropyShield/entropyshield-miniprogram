// utils/riskEngine.js
function safeNum(value, fallback = 0) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeFixed(num, digits = 2, fallback = '0.00') {
  return Number.isFinite(num) ? Number(num).toFixed(digits) : fallback;
}

function roundLotDown(shares, lotSize = 100) {
  return Math.floor(Math.max(0, Number(shares || 0)) / lotSize) * lotSize;
}

function safeDiv(num, den, fallback = 0) {
  return den > 0 ? (num / den) : fallback;
}

function buildId(prefix = 'id') {
  return `${prefix}_${Date.now()}`;
}

function buildRiskEntryDraft(payload = {}) {
  return {
    draftId: payload.draftId || buildId('rcd'),
    createdAt: payload.createdAt || Date.now(),
    source: payload.source || 'index',
    entryVersion: payload.entryVersion || 'V1.4',
    planType: payload.planType || '',
    balance: String(payload.balance || '').trim(),
    price: String(payload.price || '').trim(),
    code: String(payload.code || '').trim()
  };
}

function buildPlanSnapshot(payload = {}) {
  const planType = String(payload.planType || 'steady');
  return {
    snapshotType: 'riskPlanResult',
    planType,
    code: payload.code || '',
    membershipType: payload.membershipType || '',
    totalCapital: payload.totalCapital || '',
    firstPrice: payload.firstPrice || '',
    maxRiskPriceStep: payload.maxRiskPriceStep || '',
    targetPrice: payload.targetPrice || '',
    targetProfit: payload.targetProfit || '',
    steps: Array.isArray(payload.steps) ? payload.steps : [],
    source: payload.source || 'riskCalculator',
    draftId: payload.draftId || '',
    entryVersion: payload.entryVersion || 'V1.4',
    resultId: payload.resultId || buildId(planType),
    generatedAt: payload.generatedAt || Date.now()
  };
}

function buildTradeRecord(payload = {}) {
  return {
    recordId: payload.recordId || `tr_${payload.resultId || Date.now()}`,
    planType: payload.planType || '',
    code: payload.code || '',
    membershipType: payload.membershipType || '',
    totalCapital: payload.totalCapital || '',
    firstPrice: payload.firstPrice || '',
    maxRiskPriceStep: payload.maxRiskPriceStep || '',
    targetPrice: payload.targetPrice || '',
    targetProfit: payload.targetProfit || '',
    steps: Array.isArray(payload.steps) ? payload.steps : [],
    source: payload.source || 'riskCalculator',
    draftId: payload.draftId || '',
    entryVersion: payload.entryVersion || 'V1.4',
    resultId: payload.resultId || '',
    generatedAt: payload.generatedAt || Date.now(),
    savedAt: payload.savedAt || Date.now()
  };
}

function buildSteadyPlan(totalCapitalInput, firstPriceInput) {
  const T = safeNum(totalCapitalInput, 0);
  const P1 = safeNum(firstPriceInput, 0);

  const useRatio = 0.8;
  const w1 = 0.4;
  const w2 = 0.1;
  const w3 = 0.3;
  const w4 = 0.2;

  const r1 = 0.02;
  const r2 = 0.0154;
  const r3 = 0.01804;
  const r4 = 0.01269856;

  const available = T * useRatio;
  const totalShares = safeDiv(available, P1, 0);

  const N1 = roundLotDown(totalShares * w1);
  const N2 = roundLotDown(totalShares * w2);
  const N3 = roundLotDown(totalShares * w3);
  const N4 = roundLotDown(totalShares * w4);

  const P2 = P1 * 1.03;
  const P3 = P2 * 1.03;
  const P4 = P3 * 1.06;

  const M1 = N1 * P1;
  const M2 = N2 * P2;
  const M3 = N3 * P3;
  const M4 = N4 * P4;

  const sumShares12 = N1 + N2;
  const sumShares123 = N1 + N2 + N3;
  const sumShares1234 = N1 + N2 + N3 + N4;

  const L1 = -T * r1;
  const L2 = -T * r2;
  const L3 = -T * r3;
  const L4 = T * r4;

  const S1 = safeDiv(L1 + N1 * P1, N1, P1);
  const S2 = safeDiv(L2 + N1 * P1 + N2 * P2, sumShares12, P2);
  const S3 = safeDiv(L3 + N1 * P1 + N2 * P2 + N3 * P3, sumShares123, P3);
  const S4 = safeDiv(L4 + N1 * P1 + N2 * P2 + N3 * P3 + N4 * P4, sumShares1234, P4);

  const sl1Amount = (S1 - P1) * N1;
  const sl2Amount = (S2 - P1) * N1 + (S2 - P2) * N2;
  const sl3Amount = (S3 - P1) * N1 + (S3 - P2) * N2 + (S3 - P3) * N3;
  const sl4Amount = (S4 - P1) * N1 + (S4 - P2) * N2 + (S4 - P3) * N3 + (S4 - P4) * N4;

  const targetPrice = P1 * 1.2525;
  const targetProfit = T * 0.21305536;

  const rawSteps = [
    { buyPrice: P1, buyShares: N1, buyAmount: M1, stopPrice: S1, stopAmount: sl1Amount },
    { buyPrice: P2, buyShares: N2, buyAmount: M2, stopPrice: S2, stopAmount: sl2Amount },
    { buyPrice: P3, buyShares: N3, buyAmount: M3, stopPrice: S3, stopAmount: sl3Amount },
    { buyPrice: P4, buyShares: N4, buyAmount: M4, stopPrice: S4, stopAmount: sl4Amount }
  ];

  const steps = rawSteps
    .filter(item => item.buyShares >= 100 && item.buyAmount > 0)
    .map((item, idx) => ({
      label: `第 ${idx + 1} 次建仓`,
      buyPrice: safeFixed(item.buyPrice, 2),
      buyShares: item.buyShares,
      buyAmount: safeFixed(item.buyAmount, 2),
      stopPrice: safeFixed(item.stopPrice, 2),
      stopAmount: safeFixed(item.stopAmount, 2)
    }));

  return {
    planType: 'steady',
    totalCapital: safeFixed(T, 2),
    firstPrice: safeFixed(P1, 2),
    targetPrice: safeFixed(targetPrice, 2),
    targetProfit: safeFixed(targetProfit, 2),
    steps
  };
}

function buildAdvancedPlan(totalCapitalInput, firstPriceInput) {
  const T = safeNum(totalCapitalInput, 0);
  const P1 = safeNum(firstPriceInput, 0);

  const useRatio = 0.8;
  const riskRatio = 0.02;
  const w1 = 0.5;
  const w2 = 0.3;
  const w3 = 0.2;

  const available = T * useRatio;
  const totalShares = safeDiv(available, P1, 0);

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
  const sl2Amount = (stop2 - p2) * qty2 + (stop2 - p1) * qty1;
  const sl3Amount = (stop3 - p3) * qty3 + (stop3 - p2) * qty2 + (stop3 - p1) * qty1;

  const rawSteps = [
    { buyPrice: p1, buyShares: qty1, buyAmount: p1 * qty1, stopPrice: stop1, stopAmount: sl1Amount },
    { buyPrice: p2, buyShares: qty2, buyAmount: p2 * qty2, stopPrice: stop2, stopAmount: sl2Amount },
    { buyPrice: p3, buyShares: qty3, buyAmount: p3 * qty3, stopPrice: stop3, stopAmount: sl3Amount }
  ];

  const steps = rawSteps
    .filter(item => item.buyShares >= 100 && item.buyAmount > 0)
    .map((item, idx) => ({
      label: `第 ${idx + 1} 次进场`,
      buyPrice: safeFixed(item.buyPrice, 2),
      buyShares: String(item.buyShares),
      buyAmount: safeFixed(item.buyAmount, 2),
      stopPrice: safeFixed(item.stopPrice, 2),
      stopAmount: safeFixed(item.stopAmount, 2)
    }));

  return {
    planType: 'advanced',
    totalCapital: safeFixed(T, 2),
    firstPrice: safeFixed(P1, 2),
    maxRiskPriceStep: safeFixed(maxRiskPriceStep, 4, '0.0000'),
    targetPrice: safeFixed(targetPrice, 2),
    targetProfit: safeFixed(targetProfit, 2),
    steps
  };
}

function buildRiskReport(snapshot = {}) {
  const planType = String(snapshot.planType || 'steady');
  const isAdvanced = planType === 'advanced';

  return {
    reportId: `rr_${snapshot.resultId || Date.now()}`,
    snapshotType: 'riskReport',
    planType,
    code: snapshot.code || '',
    membershipType: snapshot.membershipType || '',
    totalCapital: snapshot.totalCapital || '',
    firstPrice: snapshot.firstPrice || '',
    maxRiskPriceStep: snapshot.maxRiskPriceStep || '',
    targetPrice: snapshot.targetPrice || '',
    targetProfit: snapshot.targetProfit || '',
    steps: Array.isArray(snapshot.steps) ? snapshot.steps : [],
    source: snapshot.source || 'riskCalculator',
    draftId: snapshot.draftId || '',
    entryVersion: snapshot.entryVersion || 'V1.4',
    resultId: snapshot.resultId || '',
    generatedAt: snapshot.generatedAt || Date.now(),
    createdAt: Date.now(),
    disciplineTips: isAdvanced
      ? [
          '先控亏，再放大利润，严格执行高阶方案中的每一步风险约束。',
          '未达到高阶方案适用条件前，不应跳步、抢跑或随意加重仓位。',
          '本报告仅用于风控推演与复盘，不替代临盘判断。'
        ]
      : [
          '先控亏，再放大利润，不因短时波动打乱原定风控节奏。',
          '分批建仓按既定顺序执行，任何一步触发止损都应整体执行。',
          '本报告仅用于风控推演与复盘，不替代临盘判断。'
        ]
  };
}

function buildLongArchiveItem(report = {}) {
  return {
    archiveId: `la_${report.reportId || report.resultId || Date.now()}`,
    snapshotType: 'riskLongArchive',
    reportId: report.reportId || '',
    resultId: report.resultId || '',
    planType: report.planType || '',
    code: report.code || '',
    membershipType: report.membershipType || '',
    totalCapital: report.totalCapital || '',
    firstPrice: report.firstPrice || '',
    maxRiskPriceStep: report.maxRiskPriceStep || '',
    targetPrice: report.targetPrice || '',
    targetProfit: report.targetProfit || '',
    steps: Array.isArray(report.steps) ? report.steps : [],
    source: report.source || 'riskCalculator',
    draftId: report.draftId || '',
    entryVersion: report.entryVersion || 'V1.4',
    generatedAt: report.generatedAt || Date.now(),
    createdAt: report.createdAt || Date.now(),
    archivedAt: Date.now()
  };
}

module.exports = {
  safeNum,
  safeFixed,
  roundLotDown,
  safeDiv,
  buildId,
  buildRiskEntryDraft,
  buildPlanSnapshot,
  buildTradeRecord,
  buildSteadyPlan,
  buildAdvancedPlan,
  buildRiskReport,
  buildLongArchiveItem
};