// pages/planSteady/index.js
const funnel = require('../../utils/funnel.js');
const mainchainApi = require('../../utils/mainchainApi.js');

const DEPLOY_RATIO_OPTIONS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(value => ({
  label: `${Math.round(value * 100)}%`,
  value
}));

const STEADY_TEMPLATE_OPTIONS = [
  {
    label: '4:1:3:2',
    description: '40% / 10% / 30% / 20%',
    value: 'FOUR_STEP_4_1_3_2_CHAIN_UP'
  },
  {
    label: '4:2:2:2',
    description: '40% / 20% / 20% / 20%',
    value: 'FOUR_STEP_4_2_2_2_CHAIN_UP'
  }
];

function getApiBase() {
  return String(
    wx.getStorageSync('API_BASE') ||
    wx.getStorageSync('apiBaseUrl') ||
    ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '')
  ).replace(/\/$/, '');
}

function getClientId() {
  return String(
    wx.getStorageSync('clientId') ||
    wx.getStorageSync('openid') ||
    ''
  ).trim();
}

function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function price(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(4) : '0.0000';
}

function percent(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function signedMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) < 0.005) return '0.00';
  return `${n > 0 ? '+' : '-'}${Math.abs(n).toFixed(2)}`;
}

function signedPercentRatio(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) < 0.00000005) return '0.00';
  return `${n > 0 ? '+' : '-'}${Math.abs(n * 100).toFixed(2)}`;
}

function resultMeta(type) {
  const t = String(type || '').toUpperCase();
  if (t === 'LOCKED_PROFIT') {
    return { label: '当前阶段锁定收益', css: 'result-profit' };
  }
  if (t === 'BREAKEVEN') {
    return { label: '当前阶段盈亏平衡', css: 'result-neutral' };
  }
  return { label: '当前阶段最大亏损', css: 'result-loss' };
}

function apiErrorMessage(body, fallback) {
  if (body && body.message) return String(body.message);
  if (body && typeof body.detail === 'string') return body.detail;
  if (body && body.detail && body.detail.message) return String(body.detail.message);
  return fallback;
}


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
    payload.deployRatio || '',
    payload.entryTemplateId || '',
    payload.stopMode || '',
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
    payload.deployRatio || '',
    payload.entryTemplateId || '',
    payload.stopMode || '',
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
    stockName: '',
    membershipType: '稳健策略 · 演示版',

    totalCapital: '',
    firstPrice: '',

    deployRatioOptions: DEPLOY_RATIO_OPTIONS,
    deployRatioIndex: 7,
    deployRatio: 0.8,
    steadyTemplateOptions: STEADY_TEMPLATE_OPTIONS,
    templateIndex: 0,
    entryTemplateId: STEADY_TEMPLATE_OPTIONS[0].value,
    entryTemplateName: STEADY_TEMPLATE_OPTIONS[0].label,

    hasResult: false,
    isGenerating: false,
    loadError: '',
    stopMode: 'STANDARD_RISK_CONTROL',
    stopModeName: '标准风险控制',
    finalStopResultLabel: '',
    finalStopResultClass: '',
    finalStopPnlDisplay: '',
    finalStopPnlPctDisplay: '',

    deployCapital: '',
    riskLimitAmount: '',
    riskLimitPct: '2.00',
    planMaxRiskAmount: '',
    planMaxRiskPct: '',
    finalTotalQty: '',
    finalTotalCost: '',
    finalAvgCost: '',
    finalDynamicStop: '',
    targetPrice: '',
    targetProfit: '',
    steps: [],

    source: 'riskCalculator',
    entryVersion: 'V2.0_FORMAL',
    draftId: '',
    resultId: '',
    reportId: ''
  },

onLoad(options) {
  const totalCapital = String(options.balance || options.capital || '').trim();
  const firstPrice = String(options.price || options.firstPrice || '').trim();
  const code = safeDecode(options.code, '');
  const stockName = safeDecode(options.name || options.stockName, code);
  const membershipType = safeDecode(options.membershipType, '稳健策略 · 演示版');
  const source = safeDecode(options.source, 'riskCalculator');
  const entryVersion = safeDecode(options.entryVersion, 'V2.0_FORMAL');
  const draftId = safeDecode(options.draftId, '');
  const deployRatio = Number(options.deployRatio || 0.8);
  const entryTemplateId = safeDecode(options.entryTemplateId, '');
  const entryTemplateName = safeDecode(options.entryTemplateName, '');
  const stopMode = safeDecode(
    options.stopMode,
    'STANDARD_RISK_CONTROL'
  ).toUpperCase();
  const stopModeName = safeDecode(
    options.stopModeName,
    stopMode === 'DYNAMIC_PROFIT_PROTECTION'
      ? '动态利润保护'
      : '标准风险控制'
  );
  const deployRatioIndex = Math.max(
    0,
    DEPLOY_RATIO_OPTIONS.findIndex(item => item.value === deployRatio)
  );
  const templateIndex = Math.max(
    0,
    STEADY_TEMPLATE_OPTIONS.findIndex(item => item.value === entryTemplateId)
  );

  this.setData({
    code,
    stockName,
    membershipType,
    totalCapital,
    firstPrice,
    source,
    entryVersion,
    draftId,
    deployRatio,
    deployRatioIndex,
    entryTemplateId,
    entryTemplateName,
    templateIndex,
    stopMode,
    stopModeName,
    hasResult: false,
    isGenerating: false,
    loadError: ''
  }, () => this.generatePlan());
},

  clearFormalResult(extra = {}) {
    this.setData({
      hasResult: false,
      deployCapital: '',
      riskLimitAmount: '',
      planMaxRiskAmount: '',
      planMaxRiskPct: '',
      finalTotalQty: '',
      finalTotalCost: '',
      finalAvgCost: '',
      finalDynamicStop: '',
      targetPrice: '',
      targetProfit: '',
      steps: [],
      resultId: '',
      reportId: '',
      ...extra
    });
  },

  onCodeInput(e) {
    const code = String(e.detail.value || '').trim();
    this.clearFormalResult({ code, stockName: code });
  },

  onCapitalInput(e) {
    this.clearFormalResult({ totalCapital: String(e.detail.value || '').trim() });
  },

  onFirstPriceInput(e) {
    this.clearFormalResult({ firstPrice: String(e.detail.value || '').trim() });
  },

  onDeployRatioChange(e) {
    const index = Number(e.detail.value || 0);
    const option = DEPLOY_RATIO_OPTIONS[index] || DEPLOY_RATIO_OPTIONS[7];
    this.clearFormalResult({
      deployRatioIndex: index,
      deployRatio: option.value
    });
  },

  onTemplateChange(e) {
    const index = Number(e.detail.value || 0);
    const option = STEADY_TEMPLATE_OPTIONS[index] || STEADY_TEMPLATE_OPTIONS[0];
    this.clearFormalResult({
      templateIndex: index,
      entryTemplateId: option.value,
      entryTemplateName: option.label
    });
  },

editParameters() {
  wx.navigateBack({ delta: 1 });
},

  generatePlan() {
    if (this.data.isGenerating) return;

    const code = String(this.data.code || '').trim();
    const stockName = String(this.data.stockName || code).trim();
    const accountCapital = Number(this.data.totalCapital);
    const firstEntryPrice = Number(this.data.firstPrice);
    const deployRatio = Number(this.data.deployRatio);
    const entryTemplateId = String(this.data.entryTemplateId || '').trim();
    const stopMode = String(this.data.stopMode || 'STANDARD_RISK_CONTROL').trim().toUpperCase();
    const apiBase = getApiBase();
    const clientId = getClientId();

    if (!code) {
      wx.showToast({ title: '请输入标的代码或名称', icon: 'none' });
      return;
    }
    if (!Number.isFinite(accountCapital) || accountCapital <= 0) {
      wx.showToast({ title: '请输入有效账户可用资金', icon: 'none' });
      return;
    }
    if (!Number.isFinite(firstEntryPrice) || firstEntryPrice <= 0) {
      wx.showToast({ title: '请输入有效执行价', icon: 'none' });
      return;
    }
    if (!DEPLOY_RATIO_OPTIONS.some(item => item.value === deployRatio)) {
      wx.showToast({ title: '请选择有效仓位比例', icon: 'none' });
      return;
    }
    if (!STEADY_TEMPLATE_OPTIONS.some(item => item.value === entryTemplateId)) {
      wx.showToast({ title: '请选择稳健版分批模板', icon: 'none' });
      return;
    }
    if (!apiBase || !clientId) {
      wx.showToast({ title: '登录信息不完整，请重新进入', icon: 'none' });
      return;
    }

    this.setData({ isGenerating: true, hasResult: false, loadError: '' });
    wx.showLoading({ title: '正在生成方案', mask: true });

    wx.request({
      url: `${apiBase}/api/rights/plan-calc`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        clientId,
        planType: 'steady',
        security: code,
        stock_name: stockName,
        first_entry_price: firstEntryPrice,
        account_capital: accountCapital,
        deploy_ratio: deployRatio,
        entry_template_id: entryTemplateId,
        stop_mode: stopMode
      },
      success: (res) => {
        const body = res && res.data ? res.data : {};
        const ok = !!(res && res.statusCode >= 200 && res.statusCode < 300 && body.ok === true);
        if (!ok) {
          const message = apiErrorMessage(body, '稳健版方案生成失败');
          this.setData({ loadError: message });
          wx.showToast({ title: message, icon: 'none', duration: 2600 });
          return;
        }

        try {
          const plan = this.buildFormalPlan(body, accountCapital);
          const resultId = buildStableResultId({
            code,
            totalCapital: plan.totalCapital,
            firstPrice: plan.firstPrice,
            deployRatio,
            entryTemplateId,
            stopMode,
            source: this.data.source,
            entryVersion: this.data.entryVersion,
            membershipType: this.data.membershipType,
            draftId: this.data.draftId
          });
          const reportId = `rr_${resultId}`;
          const rightsName = String(body.rights && body.rights.membershipName || '').trim();
          const membershipType = rightsName || this.data.membershipType;

          this.setData({
            ...plan,
            code,
            stockName,
            membershipType,
            resultId,
            reportId,
            hasResult: true
          });

          this.persistMainchainSnapshot({
            code,
            stockName,
            membershipType,
            source: this.data.source,
            entryVersion: this.data.entryVersion,
            draftId: this.data.draftId,
            resultId,
            reportId,
            plan
          });
        } catch (err) {
          console.error('[planSteady] formal response invalid', err);
          const message = err.message || '正式结果校验失败';
          this.setData({ loadError: message });
          wx.showToast({ title: message, icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('[planSteady] formal request failed', err);
        this.setData({ loadError: '网络异常，方案生成失败' });
        wx.showToast({ title: '网络异常，方案生成失败', icon: 'none' });
      },
      complete: () => {
        wx.hideLoading();
        this.setData({ isGenerating: false });
      }
    });
  },

buildFormalPlan(body, accountCapital) {
  const result =
    (Array.isArray(body.results) && body.results[0]) ||
    body.h5_default_result;

  if (!result || !result.summary || !Array.isArray(result.entries)) {
    throw new Error('正式计算结果结构不完整');
  }

  if (result.entries.length !== 4) {
    throw new Error('稳健版必须生成4个进场档次');
  }

  const summary = result.summary;
  const rawRows = Array.isArray(result.raw_detail_rows)
    ? result.raw_detail_rows
    : [];
  const rawMap = {};
  rawRows.forEach(item => {
    rawMap[Number(item.entry_no)] = item;
  });

  const riskLimit = Number(summary.risk_amount_R || 0);
  const steps = result.entries.map((item, idx) => {
    const raw = rawMap[Number(item.entry_no)] || {};
    const riskUsage = Number(
      item.risk_usage_amount ??
      raw.risk_usage_amount ??
      raw.actual_risk_amount ??
      0
    );
    const pnl = Number(
      item.stop_exit_pnl_amount ??
      raw.stop_exit_pnl_amount ??
      0
    );
    const pnlPct = Number(
      item.stop_exit_pnl_pct ??
      raw.stop_exit_pnl_pct ??
      (accountCapital > 0 ? pnl / accountCapital : 0)
    );
    const resultType = String(
      item.stop_exit_result_type ||
      raw.stop_exit_result_type ||
      (pnl > 0 ? 'LOCKED_PROFIT' : pnl < 0 ? 'LOSS' : 'BREAKEVEN')
    ).toUpperCase();
    const meta = resultMeta(resultType);
    const buyQty = Number(item.buy_qty || 0);

    if (buyQty < 100) {
      throw new Error(`第${idx + 1}档资金不足1手`);
    }
    if (riskUsage > riskLimit + 0.01) {
      throw new Error(`第${idx + 1}档风险超过2%上限`);
    }

    return {
      label: `第 ${idx + 1} 次建仓`,
      entryWeightRatioPct: percent(Number(raw.entry_weight_ratio || 0) * 100),
      plannedCash: money(raw.planned_cash),
      theoreticalShares: Number(raw.raw_qty || 0).toFixed(2),
      buyPrice: price(item.entry_price),
      buyShares: buyQty,
      buyAmount: money(item.buy_amount),
      cumQty: Number(item.cum_qty || 0),
      cumCost: money(item.cum_cost),
      avgCost: price(item.avg_cost),
      stopPrice: price(item.dynamic_stop),
      riskUsageAmount: money(riskUsage),
      riskUsagePct: percent(
        accountCapital > 0 ? riskUsage / accountCapital * 100 : 0
      ),
      stopResultLabel: meta.label,
      stopResultClass: meta.css,
      stopExitPnlDisplay: signedMoney(pnl),
      stopExitPnlPctDisplay: signedPercentRatio(pnlPct),
      stopExitPnlAmount: pnl,
      stopExitPnlPct: pnlPct,
      stopExitResultType: resultType,
      stopAmount: money(riskUsage),
      actualRiskPct: percent(
        accountCapital > 0 ? riskUsage / accountCapital * 100 : 0
      ),
      target10RStage: price(item.target_10r_stage),
      targetProfitAmount: money(item.target_profit_amount),
      targetProfitDisplay: signedMoney(Number(item.target_profit_amount || 0))
    };
  });

  const finalPnl = Number(summary.final_stop_exit_pnl_amount || 0);
  const finalPnlPct = Number(
    summary.final_stop_exit_pnl_pct ||
    (accountCapital > 0 ? finalPnl / accountCapital : 0)
  );
  const finalType = String(
    summary.final_stop_exit_result_type ||
    (finalPnl > 0 ? 'LOCKED_PROFIT' : finalPnl < 0 ? 'LOSS' : 'BREAKEVEN')
  ).toUpperCase();
  const finalMeta = resultMeta(finalType);
  const planMaxLoss = Number(summary.plan_max_loss_amount || 0);

  return {
    planType: 'steady',
    apiVersion: body.api_version || '',
    totalCapital: money(accountCapital),
    firstPrice: price(summary.first_entry_price),
    deployRatio: Number(summary.deploy_ratio || this.data.deployRatio),
    deployRatioPct: percent(
      Number(summary.deploy_ratio || this.data.deployRatio) * 100
    ),
    entryTemplateId:
      result.template_id || summary.template_id || this.data.entryTemplateId,
    entryTemplateName:
      result.template_name || summary.template_name || this.data.entryTemplateName,
    stopMode: String(
      summary.stop_mode || result.stop_mode || this.data.stopMode
    ),
    stopModeName: this.data.stopModeName,
    deployCapital: money(
      summary.nominal_deploy_capital ?? summary.deploy_capital
    ),
    actualCapitalUsagePct: percent(
      Number(summary.final_actual_capital_usage_pct || 0) * 100
    ),
    riskLimitAmount: money(riskLimit),
    riskLimitPct: percent(Number(summary.risk_percent || 0.02) * 100),
    planMaxRiskAmount: money(planMaxLoss),
    planMaxRiskPct: percent(
      Number(summary.plan_max_loss_pct || 0) * 100
    ),
    finalStopResultLabel: finalMeta.label.replace('当前阶段', '最终阶段'),
    finalStopResultClass: finalMeta.css,
    finalStopPnlDisplay: signedMoney(finalPnl),
    finalStopPnlPctDisplay: signedPercentRatio(finalPnlPct),
    finalTotalQty: Number(summary.final_total_qty || 0),
    finalTotalCost: money(summary.final_total_cost),
    finalAvgCost: price(summary.final_avg_cost),
    finalDynamicStop: price(summary.final_dynamic_stop),
    targetPrice: price(summary.first_10r_target_price),
    targetProfit: money(summary.first_10r_target_profit_amount),
    targetProfitDisplay: signedMoney(
      Number(summary.first_10r_target_profit_amount || 0)
    ),
    steps
  };
},

  persistMainchainSnapshot({ code, stockName, membershipType, source, entryVersion, draftId, resultId, reportId, plan }) {
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
        stockName,
        membershipType,
        totalCapital: plan.totalCapital,
        firstPrice: plan.firstPrice,
        deployRatio: plan.deployRatio,
        deployRatioPct: plan.deployRatioPct,
        entryTemplateId: plan.entryTemplateId,
        entryTemplateName: plan.entryTemplateName,
        stopMode: plan.stopMode,
        stopModeName: plan.stopModeName,
        deployCapital: plan.deployCapital,
        riskLimitAmount: plan.riskLimitAmount,
        riskLimitPct: plan.riskLimitPct,
        planMaxRiskAmount: plan.planMaxRiskAmount,
        planMaxRiskPct: plan.planMaxRiskPct,
        finalTotalQty: plan.finalTotalQty,
        finalTotalCost: plan.finalTotalCost,
        finalAvgCost: plan.finalAvgCost,
        finalDynamicStop: plan.finalDynamicStop,
        finalStopResultLabel: plan.finalStopResultLabel,
        finalStopPnlDisplay: plan.finalStopPnlDisplay,
        finalStopPnlPctDisplay: plan.finalStopPnlPctDisplay,
        apiVersion: plan.apiVersion,
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
        deployRatio: snapshot.deployRatio || tradeSaved.deployRatio || '',
        entryTemplateId: snapshot.entryTemplateId || tradeSaved.entryTemplateId || '',
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
      const plannedLossAmountFen = toFen(snapshot.planMaxRiskAmount || maxAbsStopAmount(steps));
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

// ====== [MOD:PLANSTEADY_MAINCHAIN_ENTRY_20260402] START ======
openTradeRecordEntry() {
  wx.navigateTo({
    url: '/pages/tradeRecord/index?from=planSteady&focus=latest'
  });
},

openRiskReportEntry() {
  wx.navigateTo({
    url: '/pages/riskReport/index?from=planSteady&focus=latest'
  });
},

openLongArchiveEntry() {
  wx.navigateTo({
    url: '/pages/longArchive/index?from=planSteady&focus=latest'
  });
},

openMainchainOverviewEntry() {
  wx.navigateTo({
    url: '/pages/mainchainOverview/index?from=planSteady&focus=latest'
  });
},
// ====== [MOD:PLANSTEADY_MAINCHAIN_ENTRY_20260402] END ======

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});