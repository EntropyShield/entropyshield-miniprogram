// pages/planSteady/index.js
const funnel = require('../../utils/funnel.js');
const mainchainApi = require('../../utils/mainchainApi.js');

function safeDecode(v, d = '') {
  if (v === undefined || v === null || v === '') return d;
  try {
    return decodeURIComponent(v);
  } catch (e) {
    return String(v);
  }
}

function buildStableResultId(payload = {}) {
  const seed = [
    'steady',
    payload.code || '',
    payload.totalCapital || '',
    payload.firstPrice || '',
    payload.source || '',
    payload.entryVersion || '',
    payload.membershipType || '',
    payload.draftId || ''
  ].join('|');

  return `rs_${String(seed).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120)}`;
}

// ====== [MOD:PLAN_STEADY_REMOTE_CREATE_HELPERS] START ======
function buildRemoteTradeKey(payload = {}) {
  const seed = [
    'steady_remote',
    payload.code || '',
    payload.totalCapital || '',
    payload.firstPrice || '',
    payload.targetPrice || '',
    payload.source || '',
    payload.entryVersion || '',
    payload.membershipType || ''
  ].join('|');

  return `rt_${String(seed).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120)}`;
}

function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function toFen(v) {
  return Math.round(safeNum(v, 0) * 100);
}

function detectMarket(code = '') {
  const s = String(code || '').trim().toUpperCase();

  if (!s) return 'OTHER';
  if (/^\d{6}$/.test(s)) return 'CN_A';
  if (/(USDT|BTC|ETH|BNB|SOL|DOGE|XRP)/.test(s)) return 'CRYPTO';
  if (/^[A-Z]{1,5}$/.test(s)) return 'US_EQ';

  return 'OTHER';
}

function pickStopPriceFromSteps(steps = [], fallback = '') {
  const list = Array.isArray(steps) ? steps : [];
  const first = list.find(item => item && item.stopPrice !== undefined && item.stopPrice !== null && item.stopPrice !== '');
  return first ? String(first.stopPrice) : String(fallback || '');
}

function sumBuyShares(steps = []) {
  return (Array.isArray(steps) ? steps : []).reduce((sum, item) => {
    return sum + safeNum(item && item.buyShares, 0);
  }, 0);
}

function sumBuyAmount(steps = []) {
  return (Array.isArray(steps) ? steps : []).reduce((sum, item) => {
    return sum + safeNum(item && item.buyAmount, 0);
  }, 0);
}

function maxAbsStopAmount(steps = []) {
  const nums = (Array.isArray(steps) ? steps : [])
    .map(item => Math.abs(safeNum(item && item.stopAmount, 0)))
    .filter(v => v > 0);

  return nums.length ? Math.max(...nums) : 0;
}
// ====== [MOD:PLAN_STEADY_REMOTE_CREATE_HELPERS] END ======

Page({
  data: {
    code: '',
    membershipType: '稳健策略 · 演示版',

    totalCapital: '',
    firstPrice: '',

    targetPrice: '',
    targetProfit: '',

    steps: [],

    source: 'riskCalculator',
    entryVersion: 'V1.4',
    draftId: '',
    resultId: '',
    reportId: ''
  },

  onLoad(options) {
    const totalCapital = parseFloat(options.balance || options.capital || 0);
    const firstPrice = parseFloat(options.price || options.firstPrice || 0);
    const code = safeDecode(options.code, '');
    const membershipType = safeDecode(options.membershipType, '稳健策略 · 演示版');
    const source = safeDecode(options.source, 'riskCalculator');
    const entryVersion = safeDecode(options.entryVersion, 'V1.4');
    const draftId = safeDecode(options.draftId, '');

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
        title: '当前资金不足以形成有效建仓',
        icon: 'none'
      });
    } else if (plan.steps.length < 4) {
      wx.showToast({
        title: `已自动缩减为${plan.steps.length}次有效建仓`,
        icon: 'none'
      });
    }

    const resultId = buildStableResultId({
      code,
      totalCapital: plan.totalCapital,
      firstPrice: plan.firstPrice,
      source,
      entryVersion,
      membershipType,
      draftId
    });
    const reportId = `rr_${resultId}`;

    this.setData({
      code,
      membershipType,
      totalCapital: plan.totalCapital,
      firstPrice: plan.firstPrice,
      targetPrice: plan.targetPrice,
      targetProfit: plan.targetProfit,
      steps: plan.steps,
      source,
      entryVersion,
      draftId,
      resultId,
      reportId
    });

    this.persistMainchainSnapshot({
      code,
      membershipType,
      source,
      entryVersion,
      draftId,
      resultId,
      reportId,
      plan
    });
  },

  persistMainchainSnapshot({ code, membershipType, source, entryVersion, draftId, resultId, reportId, plan }) {
    try {
      if (!plan || !Array.isArray(plan.steps) || !plan.steps.length) {
        console.warn('[planSteady] skip persist: empty steps');
        return;
      }

      const generatedAt = Date.now();

      const snapshot = {
        resultId,
        reportId,
        planType: 'steady',
        code,
        membershipType,
        totalCapital: plan.totalCapital,
        firstPrice: plan.firstPrice,
        maxRiskPriceStep: '',
        targetPrice: plan.targetPrice,
        targetProfit: plan.targetProfit,
        steps: plan.steps,
        source,
        draftId,
        entryVersion,
        generatedAt,
        savedAt: generatedAt
      };

      const resultReceipt = mainchainApi.persistPlanResult(snapshot);
      const tradeResult = mainchainApi.persistTradeRecord(snapshot);
      const tradeSaved = tradeResult && tradeResult.saved ? tradeResult.saved : null;
      const reportResult = mainchainApi.persistRiskReport(snapshot);
      const reportSaved = reportResult && reportResult.saved ? reportResult.saved : null;
      const archiveResult = reportSaved
        ? mainchainApi.persistLongArchiveFromReport(reportSaved)
        : null;

      this.createRemoteTradeRecord(snapshot, tradeSaved);

      console.log('[planSteady] mainchain persisted', {
        resultId,
        reportId,
        resultReceipt,
        tradeResult,
        reportResult,
        archiveResult
      });
    } catch (err) {
      console.error('[planSteady] persist mainchain failed', err);
    }
  },

  // ====== [MOD:PLAN_STEADY_REMOTE_CREATE] START ======
  createRemoteTradeRecord(snapshot = {}, tradeSaved = {}) {
    try {
      const apiBase = String(
        wx.getStorageSync('API_BASE') ||
        wx.getStorageSync('apiBaseUrl') ||
        ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '')
      ).replace(/\/$/, '');

      const clientId = String(wx.getStorageSync('clientId') || '').trim();
      const code = String(snapshot.code || tradeSaved.code || '').trim();
      const steps = Array.isArray(snapshot.steps) ? snapshot.steps : [];
      const targetPrice = safeNum(snapshot.targetPrice || tradeSaved.targetPrice, 0);

      const remoteTradeKey = buildRemoteTradeKey({
        code,
        totalCapital: snapshot.totalCapital || tradeSaved.totalCapital || '',
        firstPrice: snapshot.firstPrice || tradeSaved.firstPrice || '',
        targetPrice: targetPrice || '',
        source: snapshot.source || tradeSaved.source || '',
        entryVersion: snapshot.entryVersion || tradeSaved.entryVersion || '',
        membershipType: snapshot.membershipType || tradeSaved.membershipType || ''
      });

      const remoteDoneKey = `trade_record_remote_done_${remoteTradeKey}`;
      const remoteIngKey = `trade_record_remote_ing_${remoteTradeKey}`;
      const ingAt = Number(wx.getStorageSync(remoteIngKey) || 0) || 0;

      if (!apiBase || !clientId || !remoteTradeKey) {
        console.warn('[planSteady] skip remote create: missing apiBase/clientId/remoteTradeKey', {
          hasApiBase: !!apiBase,
          hasClientId: !!clientId,
          remoteTradeKey
        });
        return;
      }

      if (wx.getStorageSync(remoteDoneKey)) {
        console.log('[planSteady] remote trade already created, skip', remoteTradeKey);
        return;
      }

      if (ingAt && (Date.now() - ingAt) < 15000) {
        console.log('[planSteady] remote trade in-flight, skip duplicate request', remoteTradeKey);
        return;
      }

      const market = detectMarket(code);
      const entryPrice = safeNum(snapshot.firstPrice || tradeSaved.firstPrice, 0);
      const stopPrice = safeNum(
        pickStopPriceFromSteps(steps, tradeSaved.stopLossPrice || tradeSaved.stopPrice || ''),
        0
      );
      const positionSize = sumBuyShares(steps);
      const positionValueFen = toFen(sumBuyAmount(steps));
      const accountEquityFen = toFen(snapshot.totalCapital || tradeSaved.totalCapital || 0);
      const plannedLossAmountFen = toFen(maxAbsStopAmount(steps));
      const plannedProfitAmountFen = toFen(snapshot.targetProfit || tradeSaved.targetProfit || 0);
      const noteText = `planSteady:${remoteTradeKey}`;

      const payload = {
        clientId,
        recordMode: 'pre_trade',
        dataSourceType: 'calculator_new',
        symbol: code,
        market,
        direction: 'LONG',
        accountEquityFen,
        entryPrice,
        stopPrice,
        targetPrice,
        positionSize,
        positionValueFen,
        plannedLossAmountFen,
        plannedProfitAmountFen,
        sourcePlanType: 'calculator',
        followPlanFlag: 1,
        executionStatus: 'planned',
        resultType: 'open',
        noteText
      };

      wx.setStorageSync(remoteIngKey, Date.now());

      wx.request({
        url: `${apiBase}/api/trade-record/create`,
        method: 'POST',
        data: payload,
        header: {
          'content-type': 'application/json'
        },
        success: (res) => {
          const ok = !!(res && res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.ok);
          if (!ok) {
            console.error('[planSteady] remote trade create failed', {
              statusCode: res && res.statusCode,
              data: res && res.data
            });
            return;
          }

          wx.setStorageSync(remoteDoneKey, {
            ok: true,
            tradeId: res.data && res.data.trade_id,
            deduped: !!(res.data && res.data.deduped),
            at: Date.now(),
            remoteTradeKey
          });

          console.log('[planSteady] remote trade created', {
            remoteTradeKey,
            tradeId: res.data && res.data.trade_id,
            deduped: !!(res.data && res.data.deduped),
            payload
          });
        },
        fail: (err) => {
          console.error('[planSteady] remote trade request fail', err);
        },
        complete: () => {
          try { wx.removeStorageSync(remoteIngKey); } catch (e) {}
        }
      });
    } catch (err) {
      console.error('[planSteady] createRemoteTradeRecord error', err);
    }
  },
  // ====== [MOD:PLAN_STEADY_REMOTE_CREATE] END ======

  calcSteadyPlan(T, P1) {
    const useRatio = 0.8;
    const w1 = 0.4;
    const w2 = 0.1;
    const w3 = 0.3;
    const w4 = 0.2;

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

    const available = T * useRatio;
    const totalShares = available / P1;

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
        '/pages/pay/index'
        + '?from=planSteady'
        + '&membershipType=' + encodeURIComponent(membershipType || '')
        + '&balance=' + encodeURIComponent(totalCapital || '')
        + '&price=' + encodeURIComponent(firstPrice || '')
        + '&code=' + encodeURIComponent(code || '')
    });
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});