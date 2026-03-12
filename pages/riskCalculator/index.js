// pages/riskCalculator/index.js
const funnel = require('../../utils/funnel.js');
const UR = require('../../utils/userRights.js');

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
  const deny  = /(^_|loading|disabled|plan|result|rights|freeCalc|membership|modal|show|err|error|toast|tips|log)/i;
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
  const price   = rcV41PickNumber(data, [/buyprice/i, /first/i, /price/i]);
  const code    = rcV41PickString(data, [/code/i, /symbol/i, /ticker/i, /name/i]);

  if (!balance || !price || !code) {
    wx.showToast({ title: '复用跳转缺少参数，继续走原流程', icon: 'none' });
    return false;
  }

  const membershipType = encodeURIComponent('按次/奖励 · 已扣次复用');
  const url = (btn === 'advanced')
    ? `/pages/planAdvanced/index?balance=${encodeURIComponent(balance)}&price=${encodeURIComponent(price)}&code=${encodeURIComponent(code)}&membershipType=${membershipType}`
    : `/pages/planSteady/index?balance=${encodeURIComponent(balance)}&price=${encodeURIComponent(price)}&code=${encodeURIComponent(code)}&membershipType=${membershipType}`;

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

Page({
  data: {
    balance: '',        // 可用资金
    price: '',          // 首次买入价格
    code: '',           // 标的代码或名称（必填）

    freeCalcTimes: 0,   // 剩余按次/奖励次数
    membershipName: '', // 当前会员名称展示
    advancedEnabled: false,
    remainingDays: 0,
    unlimitedActive: false,

    // V1.2：行内错误提示
    balanceError: '',
    priceError: '',
    codeError: ''
  },

  onLoad() {
    this.refreshFreeTimes();
  },

  onShow() {
    this.refreshFreeTimes();
    this.syncProfileFreeTimes();
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
      title: '加强版权限',
      content: '加强版仅对「季卡/年卡」开放。\n月卡/体验/9.9按次/训练营奖励仅支持稳健版。',
      confirmText: '去开通',
      cancelText: '用稳健版',
      success: (r) => {
        if (r.confirm) {
          wx.navigateTo({
            url:
              `/pages/membership/index?type=advanced` +
              `&balance=${encodeURIComponent(balance)}` +
              `&price=${encodeURIComponent(price)}` +
              `&code=${encodeURIComponent(code || '')}`
          });
        } else {
          this.handleGeneratePlan('steady', { skipValidate: true });
        }
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

  validateForm() {
    const balance = String(this.data.balance || '').trim();
    const price = String(this.data.price || '').trim();
    const code = String(this.data.code || '').trim();

    let balanceError = '';
    let priceError = '';
    let codeError = '';

    if (!balance) {
      balanceError = '请输入可用资金';
    } else if (!/^\d+(\.\d+)?$/.test(balance) || Number(balance) <= 0) {
      balanceError = '请填写大于 0 的数字';
    }

    if (!price) {
      priceError = '请输入首次买入价格';
    } else if (!/^\d+(\.\d+)?$/.test(price) || Number(price) <= 0) {
      priceError = '请填写大于 0 的数字';
    }

    if (!code) {
      codeError = '请输入标的代码或名称';
    }

    this.setData({
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

    const gate = rcV41OnClickGate(this, 'steady');
    if (gate && gate.blocked) return;

    funnel.log('CALC_CLICK_STEADY', {});
    this.handleGeneratePlan('steady', { skipValidate: true });
  },

  onClickAdvanced() {
    console.log('[riskCalculator] click advanced');
    if (!this.validateForm()) return;

    const gate = rcV41OnClickGate(this, 'advanced');
    if (gate && gate.blocked) return;

    try {
      const base = String(wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '').replace(/\/$/, '');
      const cid  = String(wx.getStorageSync('clientId') || '').trim();

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
                console.log('[riskCalculator] adv allowed by server level=', lv);
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
                console.log('[riskCalculator] adv blocked by server level=', lv);
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

    funnel.log('CALC_CLICK_ADVANCED', {});
    this.handleGeneratePlan('advanced', { skipValidate: true });
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

    const rights = UR.getUserRights();
    const pc = UR.normalizeProductCode(rights);
    const unlimitedActive = UR.isUnlimitedMember(rights);

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

    if (freeCalcTimes > 0) {
      const left = freeCalcTimes - 1;

      const name = rights.membershipName || '按次/奖励';
      const label = `${name} · 按次使用`;

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

  gotoPlanResult(planType, { balance, price, code, membershipType }, hooks = {}) {
    const base =
      `?balance=${encodeURIComponent(balance)}` +
      `&price=${encodeURIComponent(price)}` +
      `&code=${encodeURIComponent(code || '')}`;

    const mt = membershipType ? `&membershipType=${encodeURIComponent(membershipType)}` : '';

    const url =
      (planType === 'steady')
        ? ('/pages/planSteady/index' + base + mt)
        : ('/pages/planAdvanced/index' + base + mt);

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
          wx.navigateTo({ url: '/pages/campIntro/index' });
          return;
        }

        if (idx === 2) {
          wx.navigateTo({ url: `/pages/fissionTask/index?fromPlan=${planType}` });
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