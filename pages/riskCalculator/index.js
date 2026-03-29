// pages/riskCalculator/index.js
const funnel = require('../../utils/funnel.js');
const UR = require('../../utils/userRights.js');
const riskEngine = require('../../utils/riskEngine.js');
const mainchainStore = require('../../utils/mainchainStore.js');

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
/* ====== RC_V41_CLICK_DEDUPE END ====== */

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

    if (!options.balance && !options.price && !options.code) {
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
    const { balance, price, code, source, entryVersion } = this.data;
    return {
      draftId: `rcd_${Date.now()}`,
      createdAt: Date.now(),
      source,
      entryVersion,
      planType,
      balance: String(balance || '').trim(),
      price: String(price || '').trim(),
      code: String(code || '').trim()
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

    const freeCalcTimes = Number(rights.freeCalcTimes || 0);
    const rawName = rights.membershipName || '';
    const expireAt = Number(rights.membershipExpireAt || 0);
    const expired = (expireAt && Date.now() > expireAt);

    const remainingDays = UR.getRemainingDays(rights);
    const unlimitedActive = UR.isUnlimitedMember(rights);

    let membershipName = rawName;
    if (rawName && expired) {
      membershipName = rawName + '（已到期）';
    } else if (rawName && unlimitedActive && remainingDays) {
      membershipName = `${rawName}（剩余${remainingDays}天 · 无限）`;
    }

    const advancedEnabled = UR.isAdvancedAllowed(rights);

    this.setData({
      freeCalcTimes,
      membershipName,
      advancedEnabled,
      remainingDays,
      unlimitedActive
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

          const rights = wx.getStorageSync('userRights') || {};
          const currentFree = Number(rights.freeCalcTimes || 0) || 0;
          let lastSynced = Number(wx.getStorageSync('fission_total_reward_times_synced') || 0) || 0;

          if (lastSynced === 0 && currentFree > 0) {
            wx.setStorageSync('fission_total_reward_times_synced', total);
            lastSynced = total;
          }

          const delta = total - lastSynced;
          if (delta > 0) {
            rights.freeCalcTimes = currentFree + delta;
            if (!rights.membershipName) rights.membershipName = 'FREE';
            wx.setStorageSync('userRights', rights);
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

    const productCode = UR.normalizeProductCode(rights);
    const expireAt = Number(rights.membershipExpireAt || 0);
    const notExpired = !expireAt || Date.now() < expireAt;

    const advancedEnabled = UR.isAdvancedAllowed(rights);
    const codeAllow = (productCode === 'VIP_QUARTER' || productCode === 'VIP_YEAR');

    const ok = (advancedEnabled || codeAllow) && notExpired;

    let reason = '';
    if (!notExpired) reason = 'EXPIRED';
    else if (!(advancedEnabled || codeAllow)) reason = 'NOT_ALLOWED';

    return { ok, reason, productCode, expireAt, advancedEnabled };
  },

  promptAdvancedBlocked() {
    const { balance, price, code } = this.data;

    wx.showModal({
      title: '需要季卡/年卡',
      content: '加强版仅对「季卡/年卡」开放；9.9次卡、14天体验、月卡仅支持稳健版。',
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
      const base = String(wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '').replace(/\/$/, '');
      const cid = String(wx.getStorageSync('clientId') || '').trim();

      if (base && cid) {
        wx.request({
          url: base + '/api/fission/profile?clientId=' + encodeURIComponent(cid),
          method: 'GET',
          timeout: 10000,
          success: (r) => {
            try {
              const p = r && r.data && (r.data.profile || r.data.user || r.data.data);
              const lv = String((p && p.membership_level) || '').toUpperCase();
              const allow = (lv === 'VIP_MONTH' || lv === 'VIP_QUARTER' || lv === 'VIP_YEAR' || lv === 'LIFETIME');

              if (allow) {
                try {
                  const ur0 = wx.getStorageSync('userRights');
                  const obj = (ur0 && typeof ur0 === 'object') ? ur0 : {};
                  const NAME = {
                    VIP_MONTH: '月卡',
                    VIP_QUARTER: '季卡',
                    VIP_YEAR: '年卡',
                    LIFETIME: '终身会员'
                  };
                  const next = Object.assign({}, obj, {
                    membershipLevel: lv,
                    membershipPlan: lv,
                    membershipName: NAME[lv] || obj.membershipName,
                    membershipExpireAt: (lv === 'LIFETIME') ? null : ((p && p.membership_expire_at) || null),
                    advancedEnabled: true
                  });
                  wx.setStorageSync('userRights', next);
                } catch (e) {}

                this.handleGeneratePlan('advanced', { skipValidate: true });
              } else {
                this.promptAdvancedBlocked();
              }
            } catch (e) {
              this.promptAdvancedBlocked();
            }
          },
          fail: () => this.promptAdvancedBlocked()
        });
        return;
      }
    } catch (e) {}

    this.handleGeneratePlan('advanced', { skipValidate: true });
  },

  handleGeneratePlan(planType, options = {}) {
    if (!options.skipValidate && !this.validateForm()) {
      this.releaseSubmitLock(0);
      return;
    }

    const { balance, price, code, freeCalcTimes } = this.data;
    const draft = this.saveRiskEntryDraft(planType);

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

    const rights = UR.getUserRights();
    const pc = UR.normalizeProductCode(rights);
    const unlimitedActive = UR.isUnlimitedMember(rights);

    if (unlimitedActive) {
      const days = UR.getRemainingDays(rights);
      const name = rights.membershipName || '会员';
      const label = `${name}${days ? `（剩余${days}天）` : ''}·无限`;

      funnel.log('CALC_MEMBER_UNLIMITED', {
        planType,
        productCode: pc,
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

    if (freeCalcTimes > 0) {
      const left = freeCalcTimes - 1;
      const label = '按次使用';

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
            this.setData({ freeCalcTimes: left });

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