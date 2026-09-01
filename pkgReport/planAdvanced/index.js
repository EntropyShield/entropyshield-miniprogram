const funnel = require('../../utils/funnel.js');

const mainchainApi = require('../../utils/mainchainApi.js');

const DEPLOY_RATIO_OPTIONS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(value => ({
  label: `${Math.round(value * 100)}%`,
  value
}));

const ADVANCED_TEMPLATE_OPTIONS = [
  { label: '5:2:3', description: '50% / 20% / 30%', value: 'THREE_STEP_5_2_3_CHAIN_UP' },
  { label: '4:3:3', description: '40% / 30% / 30%', value: 'THREE_STEP_4_3_3_CHAIN_UP' },
  { label: '6:2:2', description: '60% / 20% / 20%', value: 'THREE_STEP_6_2_2_CHAIN_UP' }
];

function safeDecode(v, d = '') {
  if (v === undefined || v === null || v === '') return d;
  try { return decodeURIComponent(v); } catch (e) { return String(v); }
}

function getApiBase() {
  return String(
    wx.getStorageSync('API_BASE') ||
    wx.getStorageSync('apiBaseUrl') ||
    ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '')
  ).replace(/\/$/, '');
}

function getClientId() {
  return String(wx.getStorageSync('clientId') || wx.getStorageSync('openid') || '').trim();
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

function buildStableResultId(payload = {}) {
  const seed = [
    'advanced', payload.code || '', payload.totalCapital || '', payload.firstPrice || '',
    payload.deployRatio || '', payload.entryTemplateId || '', payload.source || '',
    payload.entryVersion || '', payload.membershipType || '', payload.draftId || ''
  ].join('|');
  return `ra_${String(seed).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 120)}`;
}


function getUserRights() {
  return wx.getStorageSync('userRights') || {};
}

function isAdvancedAllowed(userRights) {
  if (!userRights) return false;

  const expireAt = Number(userRights.membershipExpireAt || 0);
  if (expireAt && Date.now() > expireAt) return false;

  if (userRights.advancedEnabled === true) return true;

  const plan = String(userRights.membershipPlan || '').toLowerCase();
  if (plan === 'quarter' || plan === 'year' || plan === 'lifetime') return true;

  const name = String(userRights.membershipName || '');
  const nameLower = name.trim().toLowerCase();
  if (
    name.includes('季度') ||
    name.includes('年度') ||
    name.includes('季卡') ||
    name.includes('年卡') ||
    name.includes('终身') ||
    nameLower === 'quarter' ||
    nameLower === 'year' ||
    nameLower === 'lifetime'
  ) return true;

  return false;
}

Page({
  data: {
    code: '',
    stockName: '',
    membershipType: '高阶策略·演示版',

    totalCapital: '',
    firstPrice: '',

    deployRatioOptions: DEPLOY_RATIO_OPTIONS,
    deployRatioIndex: 7,
    deployRatio: 0.8,
    advancedTemplateOptions: ADVANCED_TEMPLATE_OPTIONS,
    templateIndex: 0,
    entryTemplateId: ADVANCED_TEMPLATE_OPTIONS[0].value,
    entryTemplateName: ADVANCED_TEMPLATE_OPTIONS[0].label,

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
  const membershipType = safeDecode(options.membershipType, '加强版会员');
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
    ADVANCED_TEMPLATE_OPTIONS.findIndex(item => item.value === entryTemplateId)
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

    if (!code) return wx.showToast({ title: '请输入标的代码或名称', icon: 'none' });
    if (!Number.isFinite(accountCapital) || accountCapital <= 0) {
      return wx.showToast({ title: '请输入有效账户可用资金', icon: 'none' });
    }
    if (!Number.isFinite(firstEntryPrice) || firstEntryPrice <= 0) {
      return wx.showToast({ title: '请输入有效执行价', icon: 'none' });
    }
    if (!DEPLOY_RATIO_OPTIONS.some(item => item.value === deployRatio)) {
      return wx.showToast({ title: '请选择有效仓位比例', icon: 'none' });
    }
    if (!ADVANCED_TEMPLATE_OPTIONS.some(item => item.value === entryTemplateId)) {
      return wx.showToast({ title: '请选择加强版分批模板', icon: 'none' });
    }
    if (!apiBase || !clientId) {
      return wx.showToast({ title: '登录信息不完整，请重新进入', icon: 'none' });
    }


    this.setData({ isGenerating: true, hasResult: false, loadError: '' });
    wx.showLoading({ title: '正在生成方案', mask: true });

    wx.request({
      url: `${apiBase}/api/rights/plan-calc`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        clientId,
        planType: 'advanced',
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
          const message = apiErrorMessage(body, '加强版方案生成失败');
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
          console.error('[planAdvanced] formal response invalid', err);
          const message = err.message || '正式结果校验失败';
          this.setData({ loadError: message });
          wx.showToast({ title: message, icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('[planAdvanced] formal request failed', err);
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

  if (result.entries.length !== 3) {
    throw new Error('加强版必须生成3个进场档次');
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
    if (riskUsage - riskLimit > 0.011) {
      throw new Error(`第${idx + 1}档风险超过2%上限`);
    }

    return {
      label: `第 ${idx + 1} 次进场`,
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
    planType: 'advanced',
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
      if (!plan || !Array.isArray(plan.steps) || !plan.steps.length) return;
      const generatedAt = Date.now();
      const snapshot = {
        resultId,
        reportId,
        planType: 'advanced',
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
        targetPrice: plan.targetPrice,
        targetProfit: plan.targetProfit,
        steps: plan.steps,
        source,
        draftId,
        entryVersion,
        generatedAt,
        savedAt: generatedAt
      };

      mainchainApi.persistPlanResult(snapshot);
      mainchainApi.persistTradeRecord(snapshot);
      const reportResult = mainchainApi.persistRiskReport(snapshot);
      const reportSaved = reportResult && reportResult.saved ? reportResult.saved : null;
      if (reportSaved) mainchainApi.persistLongArchiveFromReport(reportSaved);
    } catch (err) {
      console.error('[planAdvanced] persist mainchain failed', err);
    }
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
        '/pages/pay/index'
        + '?from=planAdvanced'
        + '&membershipType=' + encodeURIComponent(membershipType || '')
        + '&balance=' + encodeURIComponent(totalCapital || '')
        + '&price=' + encodeURIComponent(firstPrice || '')
        + '&code=' + encodeURIComponent(code || '')
    });
  },


  openTradeRecordEntry() {
    wx.navigateTo({
      url: '/pkgReport/tradeRecord/index?from=planAdvanced&focus=latest'
    });
  },

  openRiskReportEntry() {
    wx.navigateTo({
      url: '/pkgReport/riskReport/index?from=planAdvanced&focus=latest'
    });
  },

  openLongArchiveEntry() {
    wx.navigateTo({
      url: '/pkgReport/longArchive/index?from=planAdvanced&focus=latest'
    });
  },

  openMainchainOverviewEntry() {
    wx.navigateTo({
      url: '/pkgService/mainchainOverview/index?from=planAdvanced&focus=latest'
    });
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});