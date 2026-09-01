// pages/riskCalculator/index.js
const funnel = require('../../utils/funnel.js');
const UR = require('../../utils/userRights.js');
const { syncEffectiveRights } = require('../../utils/rightsSync.js');

const DEPLOY_RATIO_OPTIONS = [30, 40, 50, 60, 70, 80].map(value => ({
  label: `${value}%`,
  value: value / 100
}));

const TEMPLATE_OPTIONS = [
  {
    label: '4:1:3:2',
    description: '稳健版 · 40% / 10% / 30% / 20%',
    planType: 'steady',
    value: 'FOUR_STEP_4_1_3_2_CHAIN_UP'
  },
  {
    label: '4:2:2:2',
    description: '稳健版 · 40% / 20% / 20% / 20%',
    planType: 'steady',
    value: 'FOUR_STEP_4_2_2_2_CHAIN_UP'
  },
  {
    label: '5:2:3',
    description: '加强版 · 50% / 20% / 30%',
    planType: 'advanced',
    value: 'THREE_STEP_5_2_3_CHAIN_UP'
  },
  {
    label: '4:3:3',
    description: '加强版 · 40% / 30% / 30%',
    planType: 'advanced',
    value: 'THREE_STEP_4_3_3_CHAIN_UP'
  },
  {
    label: '6:2:2',
    description: '加强版 · 60% / 20% / 20%',
    planType: 'advanced',
    value: 'THREE_STEP_6_2_2_CHAIN_UP'
  }
];

const STOP_MODE_OPTIONS = [
  {
    label: '标准风险控制',
    description: '优先保证各阶段最大亏损不超过账户资金的2%',
    value: 'STANDARD_RISK_CONTROL'
  },
  {
    label: '动态利润保护',
    description: '随分批进场动态上移止损，后期可能锁定已有收益',
    value: 'DYNAMIC_PROFIT_PROTECTION'
  }
];

/* ====== RC_V41_CLICK_DEDUPE (v4.1.2 / 2026-03-05) ======
目标：同一 clientId + 同一输入 + 同一按钮(稳健/加强) 只扣 1 次；第二次点击直接“复用跳转”，不再触发扣次
实现：sig = hash(picked inputs + __btn)，storage 写 rc_v41_consumed_{cid}_{sig}
====================================================== */

const __RCV41_PREFIX = 'rc_v41';

function rcV41GetClientId() {
  const g = (typeof getApp === 'function') ? getApp() : null;
  const gd = g && g.globalData ? g.globalData : {};
  return wx.getStorageSync('clientId') || wx.getStorageSync('openid') || gd.clientId || 'UNKNOWN';
}

function rcV41Hash32(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return (h >>> 0).toString(16);
}

function rcV41Normalize(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return isFinite(v) ? String(Number(v)) : '';
  if (typeof v === 'boolean') return v ? '1' : '0';
  if (typeof v === 'string') return v.trim();
  return '';
}

function rcV41PickKeys(data) {
  const allow = /(balance|amount|money|fund|price|buy|buyPrice|first|code|symbol|ticker|name|mode|type|risk|loss|profit|step|qty|count|deploy|ratio|template|stop|__btn)/i;
  const deny = /(^_|loading|disabled|plan|result|rights|freeCalc|membership|modal|show|err|error|toast|tips|log)/i;
  const keys = Object.keys(data || {});
  const picked = [];

  for (const k of keys) {
    if (deny.test(k)) continue;
    const v = data[k];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      if (allow.test(k)) picked.push(k);
    }
  }
  if (picked.length === 0) {
    for (const k of keys) {
      if (deny.test(k)) continue;
      const v = data[k];
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') picked.push(k);
    }
  }
  picked.sort();
  return picked;
}

function rcV41BuildSig(data) {
  const keys = rcV41PickKeys(data);
  const parts = [];
  for (const k of keys) parts.push(`${k}=${rcV41Normalize(data[k])}`);
  return rcV41Hash32(parts.join('&'));
}

function rcV41ConsumedKey(cid, sig) { return `${__RCV41_PREFIX}_consumed_${cid}_${sig}`; }
function rcV41IsConsumed(sig) {
  const cid = rcV41GetClientId();
  return !!wx.getStorageSync(rcV41ConsumedKey(cid, sig));
}
function rcV41MarkConsumed(sig) {
  const cid = rcV41GetClientId();
  wx.setStorageSync(rcV41ConsumedKey(cid, sig), Date.now());
}

function rcV41GetTimes() {
  const ur = wx.getStorageSync('userRights') || {};
  return (typeof ur.freeCalcTimes === 'number') ? ur.freeCalcTimes : null;
}

function rcV41PickNumber(data, patterns) {
  const keys = Object.keys(data || {});
  for (const re of patterns) {
    const k = keys.find(x => re.test(x));
    if (!k) continue;
    const v = data[k];
    const n = Number(v);
    if (isFinite(n) && n > 0) return n;
  }
  for (const k of keys) {
    const v = data[k];
    const n = Number(v);
    if (isFinite(n) && n > 0) return n;
  }
  return null;
}

function rcV41PickString(data, patterns) {
  const keys = Object.keys(data || {});
  for (const re of patterns) {
    const k = keys.find(x => re.test(x));
    if (!k) continue;
    const v = data[k];
    if (v !== null && v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  for (const k of keys) {
    const v = data[k];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

function rcV41ReuseNavigate(pageThis, btn, sig) {
  const data = pageThis.data || {};
  const balance = rcV41PickNumber(data, [/balance/i, /amount/i, /money/i, /fund/i]);
  const price = rcV41PickNumber(data, [/buyprice/i, /first/i, /price/i]);
  const code = rcV41PickString(data, [/code/i, /symbol/i, /ticker/i, /name/i]);
  const deployRatio = Number(data.deployRatio || 0.8);
  const entryTemplateId = String(data.entryTemplateId || '').trim();
  const entryTemplateName = String(data.entryTemplateName || '').trim();
  const templatePlanType = String(data.templatePlanType || '').trim();
  const stopMode = String(data.stopMode || 'STANDARD_RISK_CONTROL').trim();
  const stopModeName = String(data.stopModeName || '标准风险控制').trim();

  if (!balance || !price || !code || !entryTemplateId) {
    wx.showToast({ title: '复用跳转缺少参数，继续走原流程', icon: 'none' });
    return false;
  }

  const membershipType = encodeURIComponent('任务权益 · 已扣次复用');
  const base =
    `?balance=${encodeURIComponent(balance)}` +
    `&price=${encodeURIComponent(price)}` +
    `&code=${encodeURIComponent(code)}` +
    `&deployRatio=${encodeURIComponent(deployRatio)}` +
    `&entryTemplateId=${encodeURIComponent(entryTemplateId)}` +
    `&entryTemplateName=${encodeURIComponent(entryTemplateName)}` +
    `&templatePlanType=${encodeURIComponent(templatePlanType)}` +
    `&stopMode=${encodeURIComponent(stopMode)}` +
    `&stopModeName=${encodeURIComponent(stopModeName)}` +
    `&membershipType=${membershipType}`;

  const url = (btn === 'advanced')
    ? `/pkgReport/planAdvanced/index${base}`
    : `/pkgReport/planSteady/index${base}`;

  try { console.log('[riskCalculator][v4.1] reuse navigate sig=', sig, 'url=', url); } catch (e) {}
  wx.navigateTo({ url });
  return true;
}

function rcV41OnClickGate(pageThis, btn) {
  const sig = rcV41BuildSig(Object.assign({}, pageThis.data || {}, { __btn: btn }));
  if (rcV41IsConsumed(sig)) {
    const ok = rcV41ReuseNavigate(pageThis, btn, sig);
    if (ok) return { blocked: true, sig };
  }

  const before = rcV41GetTimes();
  setTimeout(() => {
    const after = rcV41GetTimes();
    if (before !== null && after !== null && after < before) {
      rcV41MarkConsumed(sig);
      try { console.log('[riskCalculator][v4.1] marked consumed sig=', sig, 'before=', before, 'after=', after); } catch (e) {}
    }
  }, 2500);

  return { blocked: false, sig };
}
/* ====== RC_V41_CLICK_DEDUPE END ====== */

function getMembershipPatchByServerLevel(level, expireAt) {
  const lv = String(level || '').toUpperCase();

  if (lv === 'VIP_MONTH') {
    return {
      membershipLevel: 'MONTH',
      membershipPlan: 'month',
      membershipName: '月会员',
      productCode: 'VIP_MONTH',
      membershipProductCode: 'VIP_MONTH',
      membershipExpireAt: expireAt || '',
      advancedEnabled: false
    };
  }

  if (lv === 'VIP_QUARTER') {
    return {
      membershipLevel: 'QUARTER',
      membershipPlan: 'quarter',
      membershipName: '季度会员',
      productCode: 'VIP_QUARTER',
      membershipProductCode: 'VIP_QUARTER',
      membershipExpireAt: expireAt || '',
      advancedEnabled: true
    };
  }

  if (lv === 'VIP_YEAR') {
    return {
      membershipLevel: 'YEAR',
      membershipPlan: 'year',
      membershipName: '年度会员',
      productCode: 'VIP_YEAR',
      membershipProductCode: 'VIP_YEAR',
      membershipExpireAt: expireAt || '',
      advancedEnabled: true
    };
  }

  if (lv === 'LIFETIME') {
    return {
      membershipLevel: 'LIFETIME',
      membershipPlan: 'year',
      membershipName: '终身会员',
      productCode: 'VIP_YEAR',
      membershipProductCode: 'VIP_YEAR',
      membershipExpireAt: '',
      advancedEnabled: true
    };
  }

  return null;
}

Page({
  data: {
    balance: '',
    price: '',
    code: '',

    deployRatioOptions: DEPLOY_RATIO_OPTIONS,
    deployRatioIndex: 5,
    deployRatio: 0.8,

    templateOptions: TEMPLATE_OPTIONS,
    templateIndex: 0,
    entryTemplateId: TEMPLATE_OPTIONS[0].value,
    entryTemplateName: TEMPLATE_OPTIONS[0].label,
    templatePlanType: TEMPLATE_OPTIONS[0].planType,

    stopModeOptions: STOP_MODE_OPTIONS,
    stopModeIndex: 0,
    stopMode: STOP_MODE_OPTIONS[0].value,
    stopModeName: STOP_MODE_OPTIONS[0].label,

    freeCalcTimes: 0,
    membershipName: '',
    advancedEnabled: false,
    remainingDays: 0,
    unlimitedActive: false,
    canUseCalculator: false,
    needsPay: true,

    balanceError: '',
    priceError: '',
    codeError: ''
  },

  onLoad() {
    this.refreshFreeTimes();
    this.syncEffectiveRightsForCalculator('onLoad');
  },

  onShow() {
    this.refreshFreeTimes();
    this.syncEffectiveRightsForCalculator('onShow');
    this.syncProfileFreeTimes();
  },

  getCalculatorClientId() {
    let clientId = '';

    try {
      clientId =
        wx.getStorageSync('clientId') ||
        wx.getStorageSync('openid') ||
        wx.getStorageSync('openId') ||
        '';
    } catch (e) {}

    if (!clientId) {
      try {
        const rights = wx.getStorageSync('userRights') || {};
        const identity = rights.identity || {};
        const effectiveRights = rights.effectiveRights || wx.getStorageSync('effectiveRights') || {};
        const effectiveIdentity = effectiveRights.identity || {};

        clientId =
          rights.clientId ||
          rights.openid ||
          identity.clientId ||
          identity.openid ||
          effectiveIdentity.clientId ||
          effectiveIdentity.openid ||
          '';
      } catch (e) {}
    }

    if (!clientId) {
      try {
        const app = getApp && getApp();
        const gd = (app && app.globalData) || {};
        clientId =
          gd.clientId ||
          gd.openid ||
          gd.openId ||
          (gd.userInfo && gd.userInfo.openid) ||
          '';
      } catch (e) {}
    }

    return String(clientId || '').trim();
  },

  syncEffectiveRightsForCalculator(scene) {
    const clientId = this.getCalculatorClientId();

    if (!clientId) {
      try {
        console.log('[riskCalculator] effectiveRights sync skipped: clientId empty');
      } catch (e) {}
      return;
    }

    syncEffectiveRights({
      clientId,
      scene: 'risk_calculator_' + (scene || 'refresh')
    })
      .then((res) => {
        try {
          console.log('[riskCalculator] effectiveRights sync =>', res);
        } catch (e) {}

        this.refreshFreeTimes();
      })
      .catch((err) => {
        try {
          console.log('[riskCalculator] effectiveRights sync fail =>', err);
        } catch (e) {}
      });
  },
  refreshFreeTimes() {
    const rights = UR.getUserRights();
    const effectiveRights = rights.effectiveRights || wx.getStorageSync('effectiveRights') || {};
    const membership = effectiveRights.membership || {};
    const task = effectiveRights.task || {};
    const calculator = effectiveRights.calculator || {};

    const freeCalcTimes = Math.max(
      0,
      Number(
        task.freeCalcTimes != null
          ? task.freeCalcTimes
          : (task.rewardTimes != null ? task.rewardTimes : rights.freeCalcTimes)
      ) || 0
    );

    const rawName = String(membership.name || rights.membershipName || '').trim();
    const expireAt = Number(membership.expireAt || rights.membershipExpireAt || 0);
    const expired = !!(expireAt && Date.now() > expireAt);

    const remainingDays =
      Number(membership.remainingDays || 0) ||
      UR.getRemainingDays(rights);

    const membershipActive =
      membership.active === true ||
      (!!expireAt && Date.now() < expireAt);

    const unlimitedActive =
      UR.isUnlimitedMember(rights) ||
      (
        membershipActive &&
        String(membership.level || rights.membershipLevel || '').toUpperCase() !== 'FREE'
      );

    let membershipName = rawName;

    if (rawName && expired) {
      membershipName = rawName + '（已到期）';
    } else if (rawName && membershipActive && remainingDays) {
      membershipName = `${rawName}（剩余${remainingDays}天）`;
    }

    const advancedEnabled = UR.isAdvancedAllowed(rights);

    const canUseCalculator =
      calculator.canUse === true ||
      rights.canUseCalculator === true ||
      membershipActive ||
      freeCalcTimes > 0;

    const needsPay =
      !canUseCalculator &&
      (
        calculator.needsPay === true ||
        rights.needsPay === true ||
        true
      );

    this.setData({
      freeCalcTimes,
      membershipName,
      advancedEnabled,
      remainingDays,
      unlimitedActive,
      canUseCalculator,
      needsPay
    });
  },
  syncProfileFreeTimes() {
    try {
      const apiBase =
        wx.getStorageSync('API_BASE') ||
        wx.getStorageSync('apiBaseUrl') ||
        ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '');

      const clientId = wx.getStorageSync('clientId');
      if (!apiBase || !clientId) return;

      wx.request({
        url: `${String(apiBase).replace(/\/$/, '')}/api/fission/profile`,
        method: 'GET',
        data: { clientId },
        success: (res) => {
          const d = res && res.data;
          if (!d || !d.ok) return;

          const total = Number((d.total_reward_times ?? (d.profile && d.profile.total_reward_times) ?? 0)) || 0;

          const rights = UR.getUserRights();
          const currentFree = Number((rights.freeCalcTimes != null ? rights.freeCalcTimes : rights.rewardTimes) || 0) || 0;
          let lastSynced = Number(wx.getStorageSync('fission_total_reward_times_synced') || 0) || 0;

          if (lastSynced === 0 && currentFree > 0) {
            wx.setStorageSync('fission_total_reward_times_synced', total);
            lastSynced = total;
          }

          const delta = total - lastSynced;
          if (delta > 0) {
            UR.mergeUserRights({
              freeCalcTimes: currentFree + delta
            });
            wx.setStorageSync('fission_total_reward_times_synced', total);
          }

          this.refreshFreeTimes();
        },
        fail: (err) => {
          console.log('[riskCalculator] syncProfileFreeTimes fail', err);
        }
      });
    } catch (e) {
      console.log('[riskCalculator] syncProfileFreeTimes error', e);
    }
  },

  getAdvancedAccessInfo() {
    const rights = UR.getUserRights();
    const effectiveRights = rights.effectiveRights || wx.getStorageSync('effectiveRights') || {};
    const membership = effectiveRights.membership || {};
    const calculator = effectiveRights.calculator || {};

    const now = Date.now();

    const productCode = String(
      membership.productCode ||
      rights.membershipProductCode ||
      rights.productCode ||
      UR.normalizeProductCode(rights) ||
      ''
    ).toUpperCase();

    const plan = String(
      membership.plan ||
      rights.membershipPlan ||
      rights.currentMembershipType ||
      ''
    ).toLowerCase();

    const level = String(
      membership.level ||
      rights.membershipLevel ||
      ''
    ).toUpperCase();

    const name = String(
      membership.name ||
      rights.membershipName ||
      rights.currentMembershipName ||
      ''
    ).trim();

    const expireAt = Number(
      membership.expireAt ||
      rights.membershipExpireAt ||
      rights.trialExpireAt ||
      0
    ) || 0;

    const notExpired = !expireAt || expireAt > now;

    const isTrial3 =
      productCode === 'VIP_ONCE3' ||
      plan === 'trial3' ||
      plan === 'times3' ||
      level === 'TRIAL3' ||
      name.indexOf('7天') >= 0 ||
      name.indexOf('3天') >= 0 ||
      name.indexOf('体验') >= 0;

    const isMonth =
      productCode === 'VIP_MONTH' ||
      plan === 'month' ||
      level === 'MONTH' ||
      name.indexOf('月') >= 0;

    const isAdvancedProduct =
      productCode === 'VIP_QUARTER' ||
      productCode === 'VIP_YEAR' ||
      plan === 'quarter' ||
      plan === 'year' ||
      level === 'QUARTER' ||
      level === 'YEAR' ||
      level === 'LIFETIME';

    const advancedEnabled =
      UR.isAdvancedAllowed(rights) ||
      rights.advancedEnabled === true ||
      isAdvancedProduct;

    const ok =
      notExpired &&
      isAdvancedProduct &&
      advancedEnabled &&
      !isTrial3 &&
      !isMonth;

    let reason = '';

    if (!notExpired) {
      reason = 'EXPIRED';
    } else if (isTrial3) {
      reason = 'TRIAL3_NOT_ALLOWED';
    } else if (isMonth) {
      reason = 'MONTH_NOT_ALLOWED';
    } else if (!isAdvancedProduct) {
      reason = 'NOT_ADVANCED_PRODUCT';
    } else if (!advancedEnabled) {
      reason = 'ADVANCED_DISABLED';
    }

    return {
      ok,
      reason,
      productCode,
      plan,
      level,
      name,
      expireAt,
      advancedEnabled,
      calculatorCanUse: calculator.canUse === true
    };
  },

  promptAdvancedBlocked() {
    const { balance, price, code } = this.data;

    wx.showModal({
      title: '加强版权限',
      content: '加强版仅对有效季卡会员、年卡会员和终生会员开放。',
      confirmText: '去开通',
      cancelText: '返回修改',
      success: (r) => {
        if (!r.confirm) return;
        wx.navigateTo({
          url:
            `/pages/membership/index?type=advanced` +
            `&balance=${encodeURIComponent(balance)}` +
            `&price=${encodeURIComponent(price)}` +
            `&code=${encodeURIComponent(code || '')}`
        });
      }
    });
  },

  onBalanceInput(e) {
    this.setData({
      balance: e.detail.value,
      balanceError: ''
    });
  },

  onPriceInput(e) {
    this.setData({
      price: e.detail.value,
      priceError: ''
    });
  },

  onCodeInput(e) {
    this.setData({
      code: e.detail.value,
      codeError: ''
    });
  },

  onDeployRatioChange(e) {
    const index = Number(e.detail.value || 0);
    const option = DEPLOY_RATIO_OPTIONS[index] || DEPLOY_RATIO_OPTIONS[5];
    this.setData({
      deployRatioIndex: index,
      deployRatio: option.value
    });
  },

  onTemplateChange(e) {
    const index = Number(e.detail.value || 0);
    const option = TEMPLATE_OPTIONS[index] || TEMPLATE_OPTIONS[0];
    this.setData({
      templateIndex: index,
      entryTemplateId: option.value,
      entryTemplateName: option.label,
      templatePlanType: option.planType
    });

    if (option.planType === 'advanced') {
      wx.showToast({
        title: '该模板属于加强版，需使用加强版权益',
        icon: 'none',
        duration: 2200
      });
    }
  },

  onStopModeChange(e) {
    const index = Number(e.detail.value || 0);
    const option = STOP_MODE_OPTIONS[index] || STOP_MODE_OPTIONS[0];
    this.setData({
      stopModeIndex: index,
      stopMode: option.value,
      stopModeName: option.label
    });
  },

  validateForm() {
    const balance = String(this.data.balance || '').trim();
    const price = String(this.data.price || '').trim();
    const code = String(this.data.code || '').trim();
    const deployRatio = Number(this.data.deployRatio);
    const entryTemplateId = String(this.data.entryTemplateId || '').trim();
    const stopMode = String(this.data.stopMode || '').trim();

    let balanceError = '';
    let priceError = '';
    let codeError = '';

    if (!balance) {
      balanceError = '请输入账户可用资金';
    } else if (!/^\d+(\.\d+)?$/.test(balance) || Number(balance) <= 0) {
      balanceError = '请填写大于 0 的数字';
    }

    if (!price) {
      priceError = '请输入买入执行价';
    } else if (!/^\d+(\.\d+)?$/.test(price) || Number(price) <= 0) {
      priceError = '请填写大于 0 的数字';
    }

    if (!code) {
      codeError = '请输入标的代码或名称';
    }

    this.setData({ balanceError, priceError, codeError });

    const basicError = balanceError || priceError || codeError;
    if (basicError) {
      wx.showToast({ title: basicError, icon: 'none' });
      return false;
    }

    if (!DEPLOY_RATIO_OPTIONS.some(item => item.value === deployRatio)) {
      wx.showToast({ title: '仓位比例仅支持30%至80%', icon: 'none' });
      return false;
    }

    if (!TEMPLATE_OPTIONS.some(item => item.value === entryTemplateId)) {
      wx.showToast({ title: '请选择有效分批进场模板', icon: 'none' });
      return false;
    }

    if (!STOP_MODE_OPTIONS.some(item => item.value === stopMode)) {
      wx.showToast({ title: '请选择有效止损策略', icon: 'none' });
      return false;
    }

    return true;
  },

  onClickSteady() {
    console.log('[riskCalculator] click steady');
    if (!this.validateForm()) return;

    if (this.data.templatePlanType !== 'steady') {
      wx.showToast({
        title: '该模板属于加强版，请使用加强版方案',
        icon: 'none',
        duration: 2200
      });
      return;
    }

    const gate = rcV41OnClickGate(this, 'steady');
    if (gate && gate.blocked) return;

    funnel.log('CALC_CLICK_STEADY', {
      deployRatio: this.data.deployRatio,
      entryTemplateId: this.data.entryTemplateId,
      stopMode: this.data.stopMode
    });
    this.handleGeneratePlan('steady', { skipValidate: true });
  },

  onClickAdvanced() {
    console.log('[riskCalculator] click advanced');
    if (!this.validateForm()) return;

    if (this.data.templatePlanType !== 'advanced') {
      wx.showToast({
        title: '当前是稳健版四次进场模板，请先选择加强版三次进场模板',
        icon: 'none',
        duration: 2400
      });
      return;
    }

    const gate = rcV41OnClickGate(this, 'advanced');
    if (gate && gate.blocked) return;

    const adv = this.getAdvancedAccessInfo();

    if (adv.ok) {
      funnel.log('CALC_CLICK_ADVANCED_ALLOWED', {
        productCode: adv.productCode,
        plan: adv.plan,
        level: adv.level,
        expireAt: adv.expireAt,
        deployRatio: this.data.deployRatio,
        entryTemplateId: this.data.entryTemplateId,
        stopMode: this.data.stopMode
      });

      this.handleGeneratePlan('advanced', { skipValidate: true });
      return;
    }

    funnel.log('CALC_CLICK_ADVANCED_BLOCKED', {
      reason: adv.reason,
      productCode: adv.productCode,
      plan: adv.plan,
      level: adv.level,
      expireAt: adv.expireAt
    });

    try {
      console.log('[riskCalculator] advanced local/effective access blocked =>', adv);
    } catch (e) {}

    this.promptAdvancedBlocked();
  },

  getLocalSteadyAccessInfo() {
    const rights = UR.getUserRights();
    const effectiveRights = rights.effectiveRights || wx.getStorageSync('effectiveRights') || {};
    const membership = effectiveRights.membership || {};
    const calculator = effectiveRights.calculator || {};

    const now = Date.now();

    const localExpireAt = Number(rights.membershipExpireAt || rights.trialExpireAt || 0) || 0;
    const serverExpireAt = Number(membership.expireAt || 0) || 0;
    const expireAt = Math.max(localExpireAt, serverExpireAt);

    const productCode = String(
      membership.productCode ||
      rights.membershipProductCode ||
      rights.productCode ||
      ''
    ).toUpperCase();

    const plan = String(
      membership.plan ||
      rights.membershipPlan ||
      rights.currentMembershipType ||
      ''
    ).toLowerCase();

    const level = String(
      membership.level ||
      rights.membershipLevel ||
      ''
    ).toUpperCase();

    const name = String(
      membership.name ||
      rights.membershipName ||
      rights.currentMembershipName ||
      ''
    ).trim();

    const activeByExpire = !!(expireAt && expireAt > now);
    const activeByServer = membership.active === true || calculator.canUse === true;

    const isTrial3 =
      productCode === 'VIP_ONCE3' ||
      plan === 'trial3' ||
      plan === 'times3' ||
      level === 'TRIAL3' ||
      name.indexOf('7天') >= 0 ||
      name.indexOf('3天') >= 0 ||
      name.indexOf('体验') >= 0 ||
      name.indexOf('9.9') >= 0;

    const isMonth =
      productCode === 'VIP_MONTH' ||
      plan === 'month' ||
      level === 'MONTH' ||
      name.indexOf('月') >= 0;

    const isAdvancedProduct =
      productCode === 'VIP_QUARTER' ||
      productCode === 'VIP_YEAR' ||
      plan === 'quarter' ||
      plan === 'year' ||
      level === 'QUARTER' ||
      level === 'YEAR' ||
      level === 'LIFETIME';

    // 稳健版规则：7天体验、月卡、季卡、年卡、终身，只要未到期都可用稳健版。
    const ok =
      activeByExpire &&
      (isTrial3 || isMonth || isAdvancedProduct || activeByServer);

    const remainingDays = expireAt > now
      ? Math.ceil((expireAt - now) / 86400000)
      : 0;

    let reason = '';
    if (!activeByExpire) reason = 'EXPIRED_OR_EMPTY';
    else if (!ok) reason = 'NOT_ALLOWED';

    return {
      ok,
      reason,
      name: name || (isTrial3 ? '7天体验' : '会员'),
      productCode,
      plan,
      level,
      expireAt,
      remainingDays,
      activeByExpire,
      activeByServer,
      isTrial3,
      isMonth,
      isAdvancedProduct
    };
  },
  handleGeneratePlan(planType, options = {}) {
    if (!options.skipValidate && !this.validateForm()) return;

    const { balance, price, code, freeCalcTimes } = this.data;

    if (planType === 'advanced') {
      const adv = this.getAdvancedAccessInfo();
      if (!adv.ok) {
        console.log('[riskCalculator] advanced blocked =>', adv);
        funnel.log('CALC_ADV_BLOCK', {
          reason: adv.reason,
          productCode: adv.productCode,
          advancedEnabled: adv.advancedEnabled,
          expireAt: adv.expireAt
        });
        this.promptAdvancedBlocked();
        return;
      }
    }

    if (planType === 'steady') {
      const steadyAccess = this.getLocalSteadyAccessInfo();

      if (steadyAccess.ok) {
        const label =
          `${steadyAccess.name}${steadyAccess.remainingDays ? `（剩余${steadyAccess.remainingDays}天）` : ''} · 稳健版`;

        funnel.log('CALC_LOCAL_STEADY_MEMBER', {
          planType,
          productCode: steadyAccess.productCode,
          plan: steadyAccess.plan,
          level: steadyAccess.level,
          expireAt: steadyAccess.expireAt,
          isTrial3: steadyAccess.isTrial3
        });

        this.gotoPlanResult(planType, {
          balance,
          price,
          code,
          membershipType: label
        });

        return;
      }

      try {
        console.log('[riskCalculator] steady local access blocked =>', steadyAccess);
      } catch (e) {}
    }

    const rights = UR.getUserRights();
    const effectiveRights = rights.effectiveRights || wx.getStorageSync('effectiveRights') || {};
    const effectiveMembership = effectiveRights.membership || {};
    const effectiveCalculator = effectiveRights.calculator || {};
    const pc = UR.normalizeProductCode(rights);
    const unlimitedActive = UR.isUnlimitedMember(rights);

    if (
      planType === 'steady' &&
      effectiveCalculator.canUse === true &&
      effectiveMembership.active === true
    ) {
      const days =
        Number(effectiveMembership.remainingDays || 0) ||
        UR.getRemainingDays(rights);

      const name =
        effectiveMembership.name ||
        rights.membershipName ||
        '会员';

      const label = `${name}${days ? `（剩余${days}天）` : ''} · 统一权益`;

      funnel.log('CALC_EFFECTIVE_RIGHTS_MEMBER', {
        planType,
        unlockReason: effectiveCalculator.unlockReason || '',
        productCode: effectiveMembership.productCode || pc,
        expireAt: effectiveMembership.expireAt || rights.membershipExpireAt || 0
      });

      this.gotoPlanResult(planType, {
        balance,
        price,
        code,
        membershipType: label
      });

      return;
    }

    if (unlimitedActive) {
      const days = UR.getRemainingDays(rights);
      const name = rights.membershipName || '会员';
      const label = `${name}${days ? `（剩余${days}天）` : ''} · 无限使用`;

      funnel.log('CALC_MEMBER_UNLIMITED', {
        planType,
        productCode: pc,
        expireAt: rights.membershipExpireAt || 0
      });

      this.gotoPlanResult(planType, {
        balance,
        price,
        code,
        membershipType: label
      });

      return;
    }

    if (UR.canUseSteadyByMembership(rights)) {
      const days = UR.getRemainingDays(rights);
      const name = rights.membershipName || '会员';
      const label = `${name}${days ? `（剩余${days}天）` : ''} · 会员使用`;

      funnel.log('CALC_MEMBER_STEADY', {
        planType,
        productCode: pc,
        expireAt: rights.membershipExpireAt || 0
      });

      this.gotoPlanResult(planType, {
        balance,
        price,
        code,
        membershipType: label
      });

      return;
    }

    if (freeCalcTimes > 0) {
      const left = freeCalcTimes - 1;
      const label = `任务权益 · 剩余 ${left} 次`;

      this.gotoPlanResult(
        planType,
        { balance, price, code, membershipType: label },
        {
          onSuccess: () => {
            UR.mergeUserRights({ freeCalcTimes: left });
            this.setData({ freeCalcTimes: left });

            funnel.log('CALC_TIMES_DEDUCT', { planType, leftFreeTimes: left });

            wx.showToast({
              title: `已使用 1 次，剩余 ${left} 次`,
              icon: 'none',
              duration: 2000
            });
          },
          onFail: (err) => {
            console.error('[riskCalculator] gotoPlanResult failed, will NOT deduct times:', err);
            wx.showToast({
              title: '页面跳转失败，请检查结果页是否已注册',
              icon: 'none',
              duration: 2000
            });
          }
        }
      );
      return;
    }

    this.chooseNextStep(planType);
  },

  gotoPlanResult(planType, payload = {}, hooks = {}) {
    const data = this.data || {};
    const balance = payload.balance !== undefined ? payload.balance : data.balance;
    const priceValue = payload.price !== undefined ? payload.price : data.price;
    const code = payload.code !== undefined ? payload.code : data.code;
    const membershipType = payload.membershipType || '';
    const deployRatio = Number(data.deployRatio || 0.8);
    const entryTemplateId = String(data.entryTemplateId || '').trim();
    const entryTemplateName = String(data.entryTemplateName || '').trim();
    const templatePlanType = String(data.templatePlanType || '').trim();
    const stopMode = String(data.stopMode || 'STANDARD_RISK_CONTROL').trim();
    const stopModeName = String(data.stopModeName || '标准风险控制').trim();

    const base =
      `?balance=${encodeURIComponent(balance)}` +
      `&price=${encodeURIComponent(priceValue)}` +
      `&code=${encodeURIComponent(code || '')}` +
      `&deployRatio=${encodeURIComponent(deployRatio)}` +
      `&entryTemplateId=${encodeURIComponent(entryTemplateId)}` +
      `&entryTemplateName=${encodeURIComponent(entryTemplateName)}` +
      `&templatePlanType=${encodeURIComponent(templatePlanType)}` +
      `&stopMode=${encodeURIComponent(stopMode)}` +
      `&stopModeName=${encodeURIComponent(stopModeName)}`;

    const mt = membershipType ? `&membershipType=${encodeURIComponent(membershipType)}` : '';

    const url =
      (planType === 'steady')
        ? ('/pkgReport/planSteady/index' + base + mt)
        : ('/pkgReport/planAdvanced/index' + base + mt);

    console.log('[riskCalculator] will navigate url=', url);

    wx.navigateTo({
      url,
      success: () => {
        console.log('[riskCalculator] navigate success', url);
        if (hooks && typeof hooks.onSuccess === 'function') hooks.onSuccess();
      },
      fail: (e) => {
        console.error('[riskCalculator] navigate fail', e);
        wx.showToast({
          title: (e && e.errMsg) ? `跳转失败：${e.errMsg}` : '跳转失败',
          icon: 'none',
          duration: 2500
        });
        if (hooks && typeof hooks.onFail === 'function') hooks.onFail(e);
      }
    });
  },

  chooseNextStep(planType) {
    const { balance, price, code } = this.data;

    funnel.log('CALC_CHOOSE_NEXT', { planType, hasFreeTimes: false });

    wx.showActionSheet({
      itemList: [
        '直接开通会员，解锁完整方案',
        '先参加 7 天风控训练营',
        '邀请好友，免费获得使用次数'
      ],
      success: (res) => {
        const idx = res.tapIndex;

        funnel.log('CALC_CHOOSE_NEXT_RESULT', { planType, choiceIndex: idx });

        if (idx === 0) {
          wx.navigateTo({
            url:
              `/pages/membership/index?type=${planType}` +
              `&balance=${encodeURIComponent(balance)}` +
              `&price=${encodeURIComponent(price)}` +
              `&code=${encodeURIComponent(code || '')}`
          });
          return;
        }

        if (idx === 1) {
          wx.navigateTo({ url: '/pkgChallenge/campIntro/index' });
          return;
        }

        if (idx === 2) {
          wx.navigateTo({ url: `/pkgChallenge/fissionTask/index?fromPlan=${planType}` });
        }
      },
      fail: (err) => {
        console.log('[riskCalculator] actionSheet canceled or failed', err);
      }
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});