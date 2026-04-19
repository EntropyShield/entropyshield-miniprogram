// pages/riskCalculator/index.js
const funnel = require('../../utils/funnel.js');
const UR = require('../../utils/userRights.js');
const riskEngine = require('../../utils/riskEngine.js');
const mainchainStore = require('../../utils/mainchainStore.js');

/* ====== RC_V41_CLICK_DEDUPE (v4.1.2 / 2026-03-05) ====== */
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
  const allow = /(balance|amount|money|fund|price|buy|buyPrice|first|code|symbol|ticker|name|mode|type|risk|loss|profit|step|qty|count|__btn)/i;
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

function rcV41ConsumedKey(cid, sig) {
  return `${__RCV41_PREFIX}_consumed_${cid}_${sig}`;
}

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
  const source = rcV41PickString(data, [/source/i]) || 'riskCalculator';
  const entryVersion = rcV41PickString(data, [/entryversion/i]) || 'V1.4';

  if (!balance || !price || !code) {
    wx.showToast({ title: '复用跳转缺少参数，继续走原流程', icon: 'none' });
    return false;
  }

  const membershipType = encodeURIComponent('按次使用');
  const base =
    `?balance=${encodeURIComponent(balance)}` +
    `&price=${encodeURIComponent(price)}` +
    `&code=${encodeURIComponent(code)}` +
    `&source=${encodeURIComponent(source)}` +
    `&entryVersion=${encodeURIComponent(entryVersion)}` +
    `&membershipType=${membershipType}`;

  const url = (btn === 'advanced')
    ? `/pages/planAdvanced/index${base}`
    : `/pages/planSteady/index${base}`;

  try {
    console.log('[riskCalculator][v4.1] reuse navigate sig=', sig, 'url=', url);
  } catch (e) {}

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
      try {
        console.log('[riskCalculator][v4.1] marked consumed sig=', sig, 'before=', before, 'after=', after);
      } catch (e) {}
    }
  }, 2500);

  return { blocked: false, sig };
}

Page({
  data: {
    balance: '',
    price: '',
    code: '',

    freeCalcTimes: 0,
    membershipName: '',
    advancedEnabled: false,
    remainingDays: 0,
    unlimitedActive: false,

    balanceError: '',
    priceError: '',
    codeError: '',

    source: 'index',
    sourceLabel: '首页',
    entryVersion: 'V1.4',
    submitLoading: false,
    submitPlanType: '',
    globalError: '',
    draftId: ''
  },

  onLoad(options = {}) {
    const meta = this.getSourceMeta(options);

    const nextData = {
      source: meta.source,
      sourceLabel: meta.sourceLabel
    };

    if (options.balance) nextData.balance = this.sanitizeNumberInput(options.balance, 2);
    if (options.price) nextData.price = this.sanitizeNumberInput(options.price, 4);
    if (options.code) nextData.code = this.sanitizeCodeInput(options.code);

    const shouldRestoreDraft =
      String(options.restoreDraft || '') === '1' ||
      String(options.useLatestDraft || '') === '1';

    if (shouldRestoreDraft && !options.balance && !options.price && !options.code) {
      try {
        const latestDraft = mainchainStore.getLatestRiskCalcDraft();
        if (latestDraft) {
          if (latestDraft.balance) nextData.balance = this.sanitizeNumberInput(latestDraft.balance, 2);
          if (latestDraft.price) nextData.price = this.sanitizeNumberInput(latestDraft.price, 4);
          if (latestDraft.code) nextData.code = this.sanitizeCodeInput(latestDraft.code);
          if (latestDraft.source) {
            nextData.source = latestDraft.source;
            nextData.sourceLabel = this.getSourceMeta({ source: latestDraft.source }).sourceLabel;
          }
          if (latestDraft.draftId) nextData.draftId = latestDraft.draftId;
        }
      } catch (e) {
        console.log('[riskCalculator] hydrate latest draft fail', e);
      }
    } else if (!options.balance && !options.price && !options.code) {
      nextData.balance = '';
      nextData.price = '';
      nextData.code = '';
      nextData.draftId = '';
    }

    this.setData(nextData);
    this.refreshFreeTimes();
  },

  onShow() {
    this.refreshFreeTimes();
    this.syncProfileFreeTimes();
  },

  getSourceMeta(options = {}) {
    const raw = String(
      options.source ||
      options.from ||
      options.entrySource ||
      options.sceneSource ||
      'index'
    ).trim().toLowerCase();

    const source = raw || 'index';

    const map = {
      index: '首页',
      controller: '控局者',
      profile: '个人中心',
      camp: '训练营',
      report: '报告页',
      pay: '支付页',
      fission: '裂变任务'
    };

    return {
      source,
      sourceLabel: map[source] || source
    };
  },

  sanitizeNumberInput(value, maxDecimals = 4) {
    let s = String(value == null ? '' : value);

    s = s
      .replace(/，/g, ',')
      .replace(/。/g, '.')
      .replace(/[^\d.,]/g, '')
      .replace(/,/g, '');

    s = s.replace(/^\./, '');

    const firstDot = s.indexOf('.');
    if (firstDot >= 0) {
      s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
      const parts = s.split('.');
      const intPart = parts[0] || '';
      const decPart = (parts[1] || '').slice(0, maxDecimals);
      s = decPart ? `${intPart}.${decPart}` : `${intPart}.`;
    }

    return s;
  },

  sanitizeCodeInput(value) {
    return String(value == null ? '' : value)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 30);
  },

  acquireSubmitLock(planType) {
    if (this.data.submitLoading) return false;
    this.setData({
      submitLoading: true,
      submitPlanType: planType || '',
      globalError: ''
    });
    return true;
  },

  releaseSubmitLock(delay = 250) {
    setTimeout(() => {
      this.setData({
        submitLoading: false,
        submitPlanType: ''
      });
    }, delay);
  },

  buildRiskEntryDraft(planType) {
    const { balance, price, code, source, entryVersion, draftId } = this.data;

    if (riskEngine && typeof riskEngine.buildRiskEntryDraft === 'function') {
      return riskEngine.buildRiskEntryDraft({
        draftId: draftId || '',
        createdAt: Date.now(),
        source,
        entryVersion,
        planType,
        balance: this.sanitizeNumberInput(balance, 2),
        price: this.sanitizeNumberInput(price, 4),
        code: this.sanitizeCodeInput(code)
      });
    }

    return {
      draftId: draftId || `rcd_${Date.now()}`,
      createdAt: Date.now(),
      source,
      entryVersion,
      planType,
      balance: this.sanitizeNumberInput(balance, 2),
      price: this.sanitizeNumberInput(price, 4),
      code: this.sanitizeCodeInput(code)
    };
  },

  saveRiskEntryDraft(planType) {
    try {
      const draft = this.buildRiskEntryDraft(planType);
      wx.setStorageSync('riskCalcLatestDraft', draft);

      const list = wx.getStorageSync('riskCalcDraftHistory') || [];
      list.unshift(draft);
      wx.setStorageSync('riskCalcDraftHistory', list.slice(0, 100));

      this.setData({ draftId: draft.draftId });
      return draft;
    } catch (e) {
      console.log('[riskCalculator] saveRiskEntryDraft fail', e);
      return { draftId: '' };
    }
  },

  refreshFreeTimes() {
    const rights = UR.getUserRights();
    const freeCalcTimes = Number(rights.freeCalcTimes || 0) || 0;
    const labelMeta = UR.getMembershipLabel();
    const unlimitedActive = UR.isUnlimitedMember(rights);
    const remainingDays = UR.getRemainingDays(rights);
    const advancedEnabled = UR.canUseAdvancedByMembership(rights);

    this.setData({
      freeCalcTimes,
      membershipName: labelMeta.label || '',
      advancedEnabled,
      remainingDays,
      unlimitedActive
    });
  },

  syncProfileFreeTimes(force = false) {
    try {
      const now = Date.now();
      const syncingAt = Number(wx.getStorageSync('rc_profile_sync_ing') || 0) || 0;
      const lastOkAt = Number(wx.getStorageSync('rc_profile_sync_ok_at') || 0) || 0;

      if (!force) {
        if (syncingAt && (now - syncingAt) < 15000) return;
        if (lastOkAt && (now - lastOkAt) < 10 * 60 * 1000) return;
      }

      const apiBase =
        wx.getStorageSync('API_BASE') ||
        wx.getStorageSync('apiBaseUrl') ||
        ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '');

      const clientId = wx.getStorageSync('clientId');
      if (!apiBase || !clientId) return;

      wx.setStorageSync('rc_profile_sync_ing', now);

      wx.request({
        url: String(apiBase).replace(/\/$/, '') + '/api/fission/profile',
        method: 'GET',
        data: { clientId },
        timeout: 5000,
        success: (res) => {
          const d = res && res.data;
          if (!d || !d.ok) return;

          const p = d.profile || d.user || d.data || {};
          const currentRights = UR.getUserRights();
          const currentFree = Number(currentRights.freeCalcTimes || 0) || 0;

          const serverFreeRaw =
            p.free_calc_times ??
            p.freeCalcTimes ??
            null;

          const totalRewardTimes = Number(
            d.total_reward_times ??
            d.totalRewardTimes ??
            p.total_reward_times ??
            p.totalRewardTimes ??
            0
          ) || 0;

          let lastSynced = Number(wx.getStorageSync('fission_total_reward_times_synced') || 0) || 0;
          if (lastSynced === 0 && currentFree > 0) {
            wx.setStorageSync('fission_total_reward_times_synced', totalRewardTimes);
            lastSynced = totalRewardTimes;
          }

          const patch = {};

          const serverFree = Number(serverFreeRaw);
          if (Number.isFinite(serverFree) && serverFree >= 0) {
            patch.freeCalcTimes = Math.max(currentFree, serverFree);
          } else {
            const delta = totalRewardTimes - lastSynced;
            if (delta > 0) {
              patch.freeCalcTimes = currentFree + delta;
              wx.setStorageSync('fission_total_reward_times_synced', totalRewardTimes);
            }
          }

          const membershipName = p.membership_name || p.membershipName || '';
          if (membershipName) patch.membershipName = membershipName;

          const membershipExpireAt =
            p.membership_expire_at == null
              ? (p.membershipExpireAt == null ? null : p.membershipExpireAt)
              : p.membership_expire_at;
          if (membershipExpireAt != null && membershipExpireAt !== '') {
            patch.membershipExpireAt = membershipExpireAt;
          }

          const lvRaw = String(p.membership_level || p.membershipLevel || '').toUpperCase();
          if (lvRaw) {
            patch.membershipLevel = lvRaw;

            if (lvRaw === 'VIP_MONTH' || lvRaw === 'MONTH') {
              patch.membershipPlan = 'month';
              patch.productCode = 'VIP_MONTH';
              patch.membershipProductCode = 'VIP_MONTH';
              patch.advancedEnabled = false;
              if (!patch.membershipName) patch.membershipName = '控局者·月卡';
            } else if (lvRaw === 'VIP_QUARTER' || lvRaw === 'QUARTER') {
              patch.membershipPlan = 'quarter';
              patch.productCode = 'VIP_QUARTER';
              patch.membershipProductCode = 'VIP_QUARTER';
              patch.advancedEnabled = true;
              if (!patch.membershipName) patch.membershipName = '控局者·季卡';
            } else if (lvRaw === 'VIP_YEAR' || lvRaw === 'YEAR') {
              patch.membershipPlan = 'year';
              patch.productCode = 'VIP_YEAR';
              patch.membershipProductCode = 'VIP_YEAR';
              patch.advancedEnabled = true;
              if (!patch.membershipName) patch.membershipName = '控局者·年卡';
            } else if (lvRaw === 'LIFETIME') {
              patch.membershipPlan = 'year';
              patch.productCode = 'LIFETIME';
              patch.membershipProductCode = 'LIFETIME';
              patch.advancedEnabled = true;
              patch.membershipExpireAt = 0;
              if (!patch.membershipName) patch.membershipName = '终身会员';
            }
          }

          if (!lvRaw && membershipName && (membershipName.includes('体验') || membershipName.includes('3天') || membershipName.includes('9.9'))) {
            patch.membershipPlan = 'trial3';
            patch.productCode = 'VIP_ONCE3';
            patch.membershipProductCode = 'VIP_ONCE3';
            patch.advancedEnabled = false;
          }

          if (Object.keys(patch).length > 0) {
            UR.mergeUserRights(patch);
          }

          wx.setStorageSync('rc_profile_sync_ok_at', Date.now());
          this.refreshFreeTimes();
        },
        fail: (err) => {
          console.warn('[riskCalculator] syncProfileFreeTimes skipped/fail', err);
        },
        complete: () => {
          try { wx.removeStorageSync('rc_profile_sync_ing'); } catch (e) {}
        }
      });
    } catch (e) {
      console.warn('[riskCalculator] syncProfileFreeTimes error', e);
      try { wx.removeStorageSync('rc_profile_sync_ing'); } catch (e2) {}
    }
  },

  getAdvancedAccessInfo() {
    const rights = UR.getUserRights();
    const ok = UR.canUseAdvancedByMembership(rights);
    const productCode = UR.normalizeProductCode(rights);
    const expireAt = Number(rights.membershipExpireAt || 0) || 0;
    const advancedEnabled = !!rights.advancedEnabled;

    let reason = '';
    if (!UR.hasActiveMembership(rights)) {
      reason = 'NO_ACTIVE_MEMBER';
    } else if (!ok) {
      reason = 'NOT_ALLOWED';
    }

    return { ok, reason, productCode, expireAt, advancedEnabled };
  },

  promptAdvancedBlocked() {
    const { balance, price, code } = this.data;

    wx.showModal({
      title: '需要季度会员 / 年度会员',
      content: '加强版仅对「季度会员 / 年度会员」开放；9.9体验 / 月会员仅支持稳健版。',
      confirmText: '去开通',
      cancelText: '返回',
      success: (r) => {
        this.releaseSubmitLock(0);

        if (r.confirm) {
          wx.navigateTo({
            url:
              `/pages/pay/index?type=advanced` +
              `&balance=${encodeURIComponent(balance)}` +
              `&price=${encodeURIComponent(price)}` +
              `&code=${encodeURIComponent(code || '')}` +
              `&source=${encodeURIComponent(this.data.source || 'riskCalculator')}`
          });
        }
      },
      fail: () => {
        this.releaseSubmitLock(0);
      }
    });
  },

  onBalanceInput(e) {
    this.setData({
      balance: this.sanitizeNumberInput(e.detail.value, 2),
      balanceError: '',
      globalError: ''
    });
  },

  onPriceInput(e) {
    this.setData({
      price: this.sanitizeNumberInput(e.detail.value, 4),
      priceError: '',
      globalError: ''
    });
  },

  onCodeInput(e) {
    this.setData({
      code: this.sanitizeCodeInput(e.detail.value),
      codeError: '',
      globalError: ''
    });
  },

  validateForm() {
    let balance = this.sanitizeNumberInput(this.data.balance, 2);
    let price = this.sanitizeNumberInput(this.data.price, 4);
    const code = this.sanitizeCodeInput(this.data.code);

    if (balance.endsWith('.')) balance = balance.slice(0, -1);
    if (price.endsWith('.')) price = price.slice(0, -1);

    let balanceError = '';
    let priceError = '';
    let codeError = '';

    const balanceNum = Number(balance);
    const priceNum = Number(price);

    if (!balance) {
      balanceError = '请输入可用资金';
    } else if (!/^\d+(\.\d{1,2})?$/.test(balance) || !Number.isFinite(balanceNum)) {
      balanceError = '请填写正确的资金数字';
    } else if (balanceNum < 100) {
      balanceError = '可用资金不能低于100元';
    }

    if (!price) {
      priceError = '请输入首次买入价格';
    } else if (!/^\d+(\.\d{1,4})?$/.test(price) || !Number.isFinite(priceNum)) {
      priceError = '请填写正确的价格数字';
    } else if (priceNum < 0.01) {
      priceError = '首次买入价格不能低于0.01';
    }

    if (!code) {
      codeError = '请输入标的代码或名称';
    } else {
      const pureDigits = /^\d+$/.test(code);
      const pureLetters = /^[A-Za-z]+$/.test(code);
      const hasChinese = /[\u4e00-\u9fa5]/.test(code);
      const mixedAlphaNum = /^[A-Za-z0-9._-]+$/.test(code);

      let codeOk = false;

      if (pureDigits) {
        codeOk = /^\d{4,8}$/.test(code);
      } else if (pureLetters) {
        codeOk = /^[A-Za-z]{4,20}$/.test(code);
      } else if (hasChinese) {
        codeOk = code.length >= 2 && code.length <= 20;
      } else if (mixedAlphaNum) {
        codeOk = code.length >= 4 && code.length <= 20;
      }

      if (!codeOk) {
        codeError = '请输入有效的代码或名称';
      }
    }

    this.setData({
      balance,
      price,
      code,
      balanceError,
      priceError,
      codeError
    });

    if (balanceError || priceError || codeError) {
      wx.showToast({
        title: balanceError || priceError || codeError,
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  onClickSteady() {
    console.log('[riskCalculator] click steady');
    if (!this.validateForm()) return;
    if (!this.acquireSubmitLock('steady')) return;

    const gate = rcV41OnClickGate(this, 'steady');
    if (gate && gate.blocked) {
      this.releaseSubmitLock(0);
      return;
    }

    funnel.log('CALC_CLICK_STEADY', {
      source: this.data.source || 'index'
    });

    this.handleGeneratePlan('steady', { skipValidate: true });
  },

  onClickAdvanced() {
    console.log('[riskCalculator] click advanced');
    if (!this.validateForm()) return;
    if (!this.acquireSubmitLock('advanced')) return;

    const gate = rcV41OnClickGate(this, 'advanced');
    if (gate && gate.blocked) {
      this.releaseSubmitLock(0);
      return;
    }

    funnel.log('CALC_CLICK_ADVANCED', {
      source: this.data.source || 'index'
    });

    try {
      const localRights = UR.getUserRights();
      if (UR.canUseAdvancedByMembership(localRights)) {
        this.refreshFreeTimes();
        this.handleGeneratePlan('advanced', { skipValidate: true });
        return;
      }
    } catch (e) {
      console.warn('[riskCalculator] local advanced check fail', e);
    }

    try {
      const base = String(
        wx.getStorageSync('API_BASE') ||
        wx.getStorageSync('apiBaseUrl') ||
        ''
      ).replace(/\/$/, '');
      const cid = String(wx.getStorageSync('clientId') || '').trim();

      if (base && cid) {
        wx.request({
          url: base + '/api/fission/profile?clientId=' + encodeURIComponent(cid),
          method: 'GET',
          timeout: 10000,
          success: (r) => {
            try {
              const d = r && r.data;
              const p = d && (d.profile || d.user || d.data || {});
              const lv = String((p && (p.membership_level || p.membershipLevel)) || '').toUpperCase();

              const patch = {};

              const freeRaw =
                p.free_calc_times ??
                p.freeCalcTimes ??
                null;
              const freeNum = Number(freeRaw);
              if (Number.isFinite(freeNum) && freeNum >= 0) {
                patch.freeCalcTimes = freeNum;
              }

              const expireRaw =
                p.membership_expire_at == null
                  ? (p.membershipExpireAt == null ? null : p.membershipExpireAt)
                  : p.membership_expire_at;
              if (expireRaw != null && expireRaw !== '') {
                patch.membershipExpireAt = expireRaw;
              }

              if (lv === 'VIP_MONTH' || lv === 'MONTH') {
                patch.membershipLevel = lv;
                patch.membershipPlan = 'month';
                patch.membershipName = '控局者·月卡';
                patch.productCode = 'VIP_MONTH';
                patch.membershipProductCode = 'VIP_MONTH';
                patch.advancedEnabled = false;
              } else if (lv === 'VIP_QUARTER' || lv === 'QUARTER') {
                patch.membershipLevel = lv;
                patch.membershipPlan = 'quarter';
                patch.membershipName = '控局者·季卡';
                patch.productCode = 'VIP_QUARTER';
                patch.membershipProductCode = 'VIP_QUARTER';
                patch.advancedEnabled = true;
              } else if (lv === 'VIP_YEAR' || lv === 'YEAR') {
                patch.membershipLevel = lv;
                patch.membershipPlan = 'year';
                patch.membershipName = '控局者·年卡';
                patch.productCode = 'VIP_YEAR';
                patch.membershipProductCode = 'VIP_YEAR';
                patch.advancedEnabled = true;
              } else if (lv === 'LIFETIME') {
                patch.membershipLevel = lv;
                patch.membershipPlan = 'year';
                patch.membershipName = '终身会员';
                patch.productCode = 'LIFETIME';
                patch.membershipProductCode = 'LIFETIME';
                patch.advancedEnabled = true;
                patch.membershipExpireAt = 0;
              }

              if (!lv && p.membershipName && (String(p.membershipName).includes('体验') || String(p.membershipName).includes('3天') || String(p.membershipName).includes('9.9'))) {
                patch.membershipPlan = 'trial3';
                patch.productCode = 'VIP_ONCE3';
                patch.membershipProductCode = 'VIP_ONCE3';
                patch.advancedEnabled = false;
              }

              if (Object.keys(patch).length > 0) {
                UR.mergeUserRights(patch);
              }

              const latestRights = UR.getUserRights();
              if (UR.canUseAdvancedByMembership(latestRights)) {
                this.refreshFreeTimes();
                this.handleGeneratePlan('advanced', { skipValidate: true });
              } else {
                this.promptAdvancedBlocked();
              }
            } catch (e) {
              console.warn('[riskCalculator] remote advanced check parse fail', e);
              this.promptAdvancedBlocked();
            }
          },
          fail: (err) => {
            console.warn('[riskCalculator] remote advanced check fail', err);
            this.promptAdvancedBlocked();
          }
        });
        return;
      }
    } catch (e) {
      console.warn('[riskCalculator] remote advanced check error', e);
    }

    this.promptAdvancedBlocked();
  },

  buildMembershipAccessLabel() {
    const meta = UR.getMembershipLabel();
    if (meta && meta.label) return meta.label;
    return '会员有效'
  },

  handleGeneratePlan(planType, options = {}) {
    if (!options.skipValidate && !this.validateForm()) {
      this.releaseSubmitLock(0);
      return;
    }

    const { balance, price, code } = this.data;
    const draft = this.saveRiskEntryDraft(planType);
    const rights = UR.getUserRights();
    const currentFree = Number(rights.freeCalcTimes || 0) || 0;

    const hasSteadyMembership = UR.canUseSteadyByMembership(rights);
    const hasAdvancedMembership = UR.canUseAdvancedByMembership(rights);
    const hasRewardTimes = UR.hasRewardTimes(rights);

    if (planType === 'advanced') {
      const adv = this.getAdvancedAccessInfo();
      if (!adv.ok) {
        funnel.log('CALC_ADV_BLOCK', {
          reason: adv.reason,
          productCode: adv.productCode,
          advancedEnabled: adv.advancedEnabled,
          expireAt: adv.expireAt,
          source: this.data.source || 'index'
        });
        this.promptAdvancedBlocked();
        return;
      }
    }

    if (planType === 'steady' && hasSteadyMembership) {
      const label = this.buildMembershipAccessLabel();

      funnel.log('CALC_MEMBER_STEADY', {
        planType,
        productCode: UR.normalizeProductCode(rights),
        expireAt: rights.membershipExpireAt || 0,
        source: this.data.source || 'index'
      });

      this.gotoPlanResult(planType, {
        balance,
        price,
        code,
        membershipType: label,
        source: this.data.source || 'index',
        draftId: draft.draftId,
        entryVersion: this.data.entryVersion
      });
      return;
    }

    if (planType === 'advanced' && hasAdvancedMembership) {
      const label = this.buildMembershipAccessLabel();

      funnel.log('CALC_MEMBER_ADVANCED', {
        planType,
        productCode: UR.normalizeProductCode(rights),
        expireAt: rights.membershipExpireAt || 0,
        source: this.data.source || 'index'
      });

      this.gotoPlanResult(planType, {
        balance,
        price,
        code,
        membershipType: label,
        source: this.data.source || 'index',
        draftId: draft.draftId,
        entryVersion: this.data.entryVersion
      });
      return;
    }

    if (planType === 'steady' && hasRewardTimes && currentFree > 0) {
      const left = currentFree - 1;
      const label = '任务奖励使用';

      this.gotoPlanResult(
        planType,
        {
          balance,
          price,
          code,
          membershipType: label,
          source: this.data.source || 'index',
          draftId: draft.draftId,
          entryVersion: this.data.entryVersion
        },
        {
          onSuccess: () => {
            UR.mergeUserRights({ freeCalcTimes: left });
            this.refreshFreeTimes();

            funnel.log('CALC_TIMES_DEDUCT', {
              planType,
              leftFreeTimes: left,
              source: this.data.source || 'index'
            });

            wx.showToast({
              title: `已使用1次，剩余${left}次`,
              icon: 'none',
              duration: 1600
            });
          },
          onFail: (err) => {
            console.error('[riskCalculator] gotoPlanResult failed, will NOT deduct times:', err);
            this.setData({
              globalError: '页面跳转失败，请重试一次'
            });
            wx.showToast({
              title: '页面跳转失败，请重试一次',
              icon: 'none',
              duration: 2000
            });
          }
        }
      );
      return;
    }

    if (planType === 'advanced') {
      this.promptAdvancedBlocked();
      return;
    }

    this.chooseNextStep(planType);
  },

  gotoPlanResult(planType, { balance, price, code, membershipType, source, draftId, entryVersion }, hooks = {}) {
    const base =
      `?balance=${encodeURIComponent(balance)}` +
      `&price=${encodeURIComponent(price)}` +
      `&code=${encodeURIComponent(code || '')}` +
      `&source=${encodeURIComponent(source || this.data.source || 'riskCalculator')}` +
      `&entryVersion=${encodeURIComponent(entryVersion || this.data.entryVersion || 'V1.4')}`;

    const mt = membershipType ? `&membershipType=${encodeURIComponent(membershipType)}` : '';
    const did = draftId ? `&draftId=${encodeURIComponent(draftId)}` : '';

    const url = (planType === 'steady')
      ? ('/pages/planSteady/index' + base + mt + did)
      : ('/pages/planAdvanced/index' + base + mt + did);

    console.log('[riskCalculator] will navigate url=', url);

    wx.navigateTo({
      url,
      success: () => {
        this.releaseSubmitLock(0);
        console.log('[riskCalculator] navigate success', url);
        if (hooks && typeof hooks.onSuccess === 'function') hooks.onSuccess();
      },
      fail: (e) => {
        this.releaseSubmitLock(0);
        console.error('[riskCalculator] navigate fail', e);
        this.setData({
          globalError: (e && e.errMsg) ? `跳转失败：${e.errMsg}` : '跳转失败'
        });
        wx.showToast({
          title: '页面跳转失败，请重试',
          icon: 'none',
          duration: 2000
        });
        if (hooks && typeof hooks.onFail === 'function') hooks.onFail(e);
      }
    });
  },

  chooseNextStep(planType) {
    const { balance, price, code } = this.data;

    funnel.log('CALC_CHOOSE_NEXT', {
      planType,
      hasFreeTimes: false,
      source: this.data.source || 'index'
    });

    wx.showActionSheet({
      itemList: [
        '直接开通会员，解锁完整方案',
        '先参加7天风控训练营',
        '邀请好友，免费获得使用次数'
      ],
      success: (res) => {
        const idx = res.tapIndex;
        this.releaseSubmitLock(0);

        funnel.log('CALC_CHOOSE_NEXT_RESULT', {
          planType,
          choiceIndex: idx,
          source: this.data.source || 'index'
        });

        if (idx === 0) {
          wx.navigateTo({
            url:
              `/pages/pay/index?type=${planType}` +
              `&balance=${encodeURIComponent(balance)}` +
              `&price=${encodeURIComponent(price)}` +
              `&code=${encodeURIComponent(code || '')}` +
              `&source=${encodeURIComponent(this.data.source || 'riskCalculator')}`
          });
          return;
        }

        if (idx === 1) {
          wx.navigateTo({
            url: `/pages/campIntro/index?source=${encodeURIComponent(this.data.source || 'riskCalculator')}`
          });
          return;
        }

        if (idx === 2) {
          wx.navigateTo({
            url: `/pages/fissionTask/index?fromPlan=${planType}&source=${encodeURIComponent(this.data.source || 'riskCalculator')}`
          });
        }
      },
      fail: () => {
        this.releaseSubmitLock(0);
      }
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});