// pages/membership/index.js
const CFG = require('../../config.js');
const UR = require('../../utils/userRights.js');
let clientIdUtil = null;
try {
  clientIdUtil = require('../../utils/clientId');
} catch (e) {
  clientIdUtil = null;
}

function upperCode(v) {
  return String(v || '').toUpperCase();
}

function isUnlimitedProduct(code) {
  const c = upperCode(code);
  return ['VIP_MONTH', 'VIP_QUARTER', 'VIP_YEAR'].includes(c);
}

function calcRemainingDays(expireAt) {
  const t = Number(expireAt || 0);
  if (!t) return 0;
  const ms = t - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function buildMembershipTypeText(rights) {
  const name = rights.membershipName || '';
  const expireAt = Number(rights.membershipExpireAt || 0);
  const code = upperCode(rights.productCode || rights.membershipProductCode || '');

  if (isUnlimitedProduct(code) && expireAt && Date.now() < expireAt) {
    const days = calcRemainingDays(expireAt);
    return `${name}锛堝墿浣?{days}澶╋級 路 鏃犻檺浣跨敤`;
  }

  if (code === 'VIP_ONCE3') {
    const t = Math.max(0, Number(rights.freeCalcTimes || 0));
    return `${name} 路 鎸夋浣跨敤锛堝墿浣?{t}娆★級`;
  }

  return name || '鏈紑閫氫細鍛?;
}

function formatFenPrice(fen) {
  const n = (Number(fen || 0) || 0) / 100;
  return Number.isInteger(n) ? ¥ : ¥;
}

function defaultRuntimeConfig() {
  return {
    trial_enabled: 1,
    trial_price_fen: 990,
    official_paid_min_amount_fen: 99900
  };
}

function getRuntimeApiBase() {
  try {
    const s1 = wx.getStorageSync('API_BASE') || '';
    if (s1) return String(s1).replace(/\/$/, '');
  } catch (e) {}
  try {
    const s2 = wx.getStorageSync('apiBaseUrl') || '';
    if (s2) return String(s2).replace(/\/$/, '');
  } catch (e) {}
  try {
    const app = getApp && getApp();
    const gd = (app && app.globalData) || {};
    const base =
      gd.API_BASE ||
      gd.API_BASE_URL ||
      CFG.API_BASE ||
      CFG.API_BASE_URL ||
      CFG.PROD_API_BASE ||
      CFG.DEV_API_BASE ||
      '';
    return String(base || '').replace(/\/$/, '');
  } catch (e) {
    return '';
  }
}

function requestRuntimeConfig() {
  const base = getRuntimeApiBase();
  return new Promise((resolve, reject) => {
    if (!base) {
      reject(new Error('missing API_BASE'));
      return;
    }
    wx.request({
      url: base + '/api/fission/runtime-config',
      method: 'GET',
      timeout: 12000,
      success(res) {
        const d = (res && res.data) || {};
        if (d.ok && d.config) {
          resolve(d.config);
          return;
        }
        reject(new Error(d.message || 'runtime config failed'));
      },
      fail: reject
    });
  });
}

function buildPlansByRuntime(type, runtimeConfig) {
  const cfg = runtimeConfig || defaultRuntimeConfig();
  const trialEnabled = Number(cfg.trial_enabled || 0) === 1;
  const trialPriceFen = Number(cfg.trial_price_fen || 990) || 990;

  const runtimeConfig = defaultRuntimeConfig();

    this.setData({
      type,
      balance,
      price,
      code,
      planLabel,
      runtimeConfig,
      plans: buildPlansByRuntime(type, runtimeConfig)
    });

    this.refreshRights();
  
    this.ensureOpenid(() => {});
},

  onShow() {
    this.refreshRights();
    this.syncRuntimeConfig();
  },

  syncRuntimeConfig() {
    requestRuntimeConfig()
      .then((runtimeConfig) => {
        this.setData({
          runtimeConfig,
          plans: buildPlansByRuntime(this.data.type || 'steady', runtimeConfig)
        });
      })
      .catch((err) => {
        console.log('[membership] runtime-config fail =>', err);
      });
  },

  refreshRights() {
    const rights = UR.getUserRights();
    const code = upperCode(rights.productCode || rights.membershipProductCode || '');
    const expireAt = Number(rights.membershipExpireAt || 0);
    const rawName = rights.membershipName || '';

    let membershipNameDisplay = rawName;

    if (rawName && expireAt) {
      if (Date.now() > expireAt) {
        membershipNameDisplay = rawName + '锛堝凡鍒版湡锛?;
      } else if (isUnlimitedProduct(code)) {
        const days = calcRemainingDays(expireAt);
        membershipNameDisplay = rawName + `锛堝墿浣?{days}澶╋級`;
      }
    }

    // UI 鏄剧ず锛氭棤闄愪細鍛樹笉灞曠ず娆℃暟锛堢粺涓€缃?0锛夛紝鎸夋鍖呮墠鏄剧ず娆℃暟
    let freeCalcTimes = Math.max(0, Number(rights.freeCalcTimes || 0));
    if (isUnlimitedProduct(code) && expireAt && Date.now() < expireAt) {
      freeCalcTimes = 0;
    }

    this.setData({ freeCalcTimes, membershipNameDisplay });
  },

  getApiBase() {
    try {
      const cfg = require('../../config.js') || {};
      return cfg.API_BASE || cfg.API_BASE_URL || cfg.PROD_API_BASE || 'https://api.entropyshield.com';
    } catch (e) {
      return 'https://api.entropyshield.com';
    }
  },

  ensureOpenid(cb) {
    const done = (oid) => {
      const openid = String(oid || '').trim();
      if (!openid) {
        if (typeof cb === 'function') cb('');
        return;
      }
      try {
        wx.setStorageSync('openid', openid);
        wx.setStorageSync('clientId', openid);
      } catch (e) {}
      if (typeof cb === 'function') cb(openid);
    };
  
    const failAll = (msg, extra) => {
      console.log('[membership] ensureOpenid failed =>', msg, extra || '');
      wx.showToast({ title: msg || '鑾峰彇鐧诲綍淇℃伅澶辫触', icon: 'none' });
      if (typeof cb === 'function') cb('');
    };
  
    // 1) 鍏堣缂撳瓨锛歰penid / clientId 浠讳竴瀛樺湪閮界洿鎺ョ敤
    try {
      const cached = String(
        wx.getStorageSync('openid') ||
        wx.getStorageSync('clientId') ||
        ''
      ).trim();
  
      if (cached) {
        return done(cached);
      }
    } catch (e) {}
  
    // 2) 鍐嶈蛋 utils/clientId.ensureClientId锛堜綘椤圭洰閲屽凡缁熶竴灏佽锛?
    if (clientIdUtil && typeof clientIdUtil.ensureClientId === 'function') {
      Promise.resolve(clientIdUtil.ensureClientId(false))
        .then((oid) => {
          oid = String(oid || '').trim();
          if (oid) {
            done(oid);
            return;
          }
          fallbackWxLogin();
        })
        .catch((err) => {
          console.log('[membership] clientIdUtil.ensureClientId error =>', err);
          fallbackWxLogin();
        });
      return;
    }
  
    // 3) 鏈€鍚庡厹搴曪細wx.login + /api/wx/login
    fallbackWxLogin();
  
    const self = this;
  
    function fallbackWxLogin() {
      wx.login({
        success(loginRes) {
          if (!loginRes || !loginRes.code) {
            failAll('鑾峰彇鐧诲綍淇℃伅澶辫触');
            return;
          }
  
          wx.request({
            url: self.getApiBase() + '/api/wx/login',
            method: 'POST',
            data: { code: loginRes.code },
            success(res) {
              const d = res && res.data;
              const oid = d && (d.openid || d.openId || d.clientId || d.client_id);
  
              if (oid) {
                done(oid);
                return;
              }
  
              console.log('[membership] /api/wx/login res =>', d);
              failAll('鑾峰彇鐧诲綍淇℃伅澶辫触');
            },
            fail(err) {
              console.log('[membership] /api/wx/login fail =>', err);
              failAll('鑾峰彇鐧诲綍淇℃伅澶辫触');
            }
          });
        },
        fail(err) {
          console.log('[membership] wx.login fail =>', err);
          failAll('鑾峰彇鐧诲綍淇℃伅澶辫触');
        }
      });
    }
  },

  planIdToProductCode(planId) {
    if (planId === 'once3') return 'VIP_ONCE3';
    if (planId === 'once3') return 'VIP_ONCE3';
    if (planId === 'month') return 'VIP_MONTH';
    if (planId === 'quarter') return 'VIP_QUARTER';
    if (planId === 'year') return 'VIP_YEAR';
    return 'VIP_MONTH';
  },

  // ===== 鏀粯锛氶噾棰濊浆鍒嗭紙鍏煎 楼99 / 99 / 9.9 / "9.9" 绛夛級=====
  toFen(v) {
    if (v === null || typeof v === 'undefined') return 0;
    const raw = String(v).trim();
    if (!raw) return 0;

    // 鍘绘帀闈炴暟瀛?灏忔暟鐐瑰瓧绗︼紙渚嬪 "楼99" -> "99"锛?
    const s = raw.replace(/[^\d.]/g, '');
    if (!s) return 0;

    const n = Number(s);
    if (!isFinite(n)) return 0;

    // 鍚皬鏁扮偣锛氭寜鍏冭浆鍒嗭紱涓嶅惈灏忔暟鐐癸細榛樿鎸夊厓杞垎锛堥€傞厤 99/999/2999/9999锛?
    if (s.includes('.')) return Math.round(n * 100);
    return Math.round(n * 100);
  },

  // ===== 璋冨悗绔涓嬪崟锛屾嬁 payParams锛坱imeStamp/nonceStr/package/paySign锛?====
  callPayJsapi(openid, productCode, amountFen, description) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.getApiBase() + '/api/pay/jsapi',
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: { openid, productCode, amount: amountFen, description },
        success: (res) => {
          if (res.data && res.data.ok && res.data.payParams) resolve(res.data);
          else reject(res.data || { message: '/api/pay/jsapi 杩斿洖寮傚父' });
        },
        fail: (err) => reject(err)
      });
    });
  },

  onSelectPlan(e) {
    const planId = e.currentTarget.dataset.planId;
    const { type, balance, price, code, plans, planLabel } = this.data;

    const plan = plans.find(p => p.id === planId);
    if (!plan) return wx.showToast({ title: '鏃犳硶璇嗗埆鐨勪細鍛樻柟妗?, icon: 'none' });

    // 鍔犲己鐗堝叆鍙ｅ彧鍏佽瀛ｅ崱/骞村崱
    if (type === 'advanced' && !['quarter', 'year'].includes(plan.id)) {
      return wx.showToast({ title: '鍔犲己鐗堜粎鏀寔瀛ｅ崱/骞村崱', icon: 'none' });
    }

    wx.showModal({
      title: '寮€閫氫細鍛?,
      content: `灏嗗敜璧峰井淇℃敮浠橈紝寮€閫氥€?{plan.name}銆嶃€俙,
      confirmText: '鍘绘敮浠?,
      success: (r) => {
        if (!r.confirm) return;

        const productCode = this.planIdToProductCode(plan.id);

        // 閲戦锛堝垎锛夛細浼樺厛浠?plan.priceText 瑙ｆ瀽锛涘厹搴曠敤椤甸潰 price
        const amountFen = this.toFen(plan.priceText || price || 0);
        if (!amountFen || amountFen <= 0) {
          return wx.showToast({ title: '鏀粯閲戦寮傚父', icon: 'none' });
        }

        const description = `寮€閫?{plan.name}`;

        this.ensureOpenid((openid) => {
          wx.showLoading({ title: '鎷夎捣鏀粯涓€? });

          this.callPayJsapi(openid, productCode, amountFen, description)
            .then((data) => {
              wx.hideLoading();

              const payParams = data.payParams || {};
              wx.requestPayment({
                timeStamp: String(payParams.timeStamp || ''),
                nonceStr: payParams.nonceStr || '',
                package: payParams.package || '',
                signType: payParams.signType || 'RSA',
                paySign: payParams.paySign || '',
                success: () => {
                  // 鉁?MVP锛氭敮浠樻垚鍔熷悗绔嬪嵆鏈湴鍙戞斁鏉冪泭锛堝悗缁彲鍐嶅仛 notify/鏌ュ崟鈥滃悗绔‘鏉冣€濓級
                  const now = Date.now();
                  const expireAt = plan.durationDays
                    ? now + Number(plan.durationDays) * 24 * 60 * 60 * 1000
                    : 0;

                  const patch = {
                    openid,
                    membershipName: plan.name,
                    membershipPlan: plan.id,
                    membershipEntryType: type,

                    membershipProductCode: productCode,
                    productCode: productCode,

                    membershipExpireAt: expireAt,

                    // 鉁?鏉冮檺锛氬/骞存墠寮€鍔犲己鐗?
                    advancedEnabled: (plan.id === 'quarter' || plan.id === 'year'),

                    // 鉁?娆℃暟锛氬彧缁欐寜娆″寘锛屽叾瀹冧竴寰?0锛堟寜澶╂棤闄愶級
                    freeCalcTimes: (upperCode(productCode) === 'VIP_ONCE3') ? 3 : 0
                  };

                  const nextRights = UR.mergeUserRights(patch);
                  this.refreshRights();

                  wx.showToast({ title: '鏀粯鎴愬姛', icon: 'success', duration: 1200 });

                  const membershipTypeText = buildMembershipTypeText(nextRights) + ` 路 ${planLabel}`;
                  const query =
                    `?balance=${encodeURIComponent(balance)}` +
                    `&price=${encodeURIComponent(price)}` +
                    `&code=${encodeURIComponent(code || '')}` +
                    `&membershipType=${encodeURIComponent(membershipTypeText)}`;

                  if (type === 'steady') {
                    wx.navigateTo({ url: '/pages/planSteady/index' + query });
                  } else {
                    wx.navigateTo({ url: '/pages/planAdvanced/index' + query });
                  }
                },
                fail: (err) => {
                  console.error('[membership] requestPayment fail =>', err);
                  const msg = (err && (err.errMsg || err.message)) ? (err.errMsg || err.message) : '鏀粯澶辫触';
                  wx.showToast({ title: msg, icon: 'none', duration: 2000 });
                }
              });
            })
            .catch((err) => {
              wx.hideLoading();
              console.error('[membership] /api/pay/jsapi failed =>', err);
              wx.showToast({
                title: (err && err.message) ? err.message : '鎷夎捣鏀粯澶辫触',
                icon: 'none'
              });
            });
        });
      }
    });
  },

  goCamp() {
    wx.navigateTo({ url: '/pages/campIntro/index' });
  },

  goBackCalc() {
    wx.navigateBack();
  }
});
