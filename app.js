// ST_WXLOGIN_USE_QUERY_CODE_20260306
 // ====== [MOD:ENSURE_CLIENTID] START ======
 function ensureClientId() {
  try {
    let cid = wx.getStorageSync('clientId');
    if (typeof cid === 'string') cid = cid.trim();
    if (cid) return cid;

    // legacy keys
    const keys = ['openid','OPENID','fissionClientId','wx_openid','userOpenid'];
    for (const k of keys) {
      const v = wx.getStorageSync(k);
      if (v && String(v).trim()) { cid = String(v).trim(); break; }
    }

    // cached profile
    if (!cid) {
      const p = wx.getStorageSync('fissionProfile') || {};
      const v = p.clientId || p.openid || p.openId || p.client_id;
      if (v && String(v).trim()) cid = String(v).trim();
    }

    if (!cid) cid = 'ST-' + Date.now() + '-' + Math.floor(Math.random()*1e6);
    wx.setStorageSync('clientId', cid);
    return cid;
  } catch (e) {
    const cid = 'ST-' + Date.now() + '-' + Math.floor(Math.random()*1e6);
    try { wx.setStorageSync('clientId', cid); } catch(e2) {}
    return cid;
  }
}
// ====== [MOD:ENSURE_CLIENTID] END ======
// app.js - 稳定版启动（不重写 wx.getStorageSync / wx.setStorageSync，避免递归爆栈）
const { API_BASE, ENV, runtime } = require('./config');
// ====== [MOD:APP_DEBUG_SILENT_20260330] START ======
const __APP_DEBUG__ = false;
function appDebug() {
  if (!__APP_DEBUG__) return;
  try {
    console.log.apply(console, arguments);
  } catch (e) {}
}
// ====== [MOD:APP_DEBUG_SILENT_20260330] END ======
/* ====== ST_P0_BIND_INVITE_APPJS (P0 手收敛 / 2026-03-06) ======
目标：扫码进入即绑定邀请关系（不付费也绑定）
流程：extract inviteCode -> storage.pendingInviteCode -> 等 clientId ready -> POST /api/fission/init {clientId, inviteCode}
幂等：__st_bound_<clientId> = 1 后不再重复
============================================================== */
function __stGetApiBase() {
 try {
   const cfg = require('./config');
   return cfg.API_BASE || cfg.API_BASE_URL || cfg.PROD_API_BASE || cfg.DEV_API_BASE || '';
 } catch (e) {}
 try {
   const app = getApp && getApp();
   const g = app && app.globalData ? app.globalData : {};
   return g.API_BASE || g.API_BASE_URL || '';
 } catch (e) {}
 return '';
}

function __stExtractInviteCode(options) {
 try {
   const q = (options && options.query) ? options.query : {};
   if (q.inviteCode) return String(q.inviteCode).trim();
   if (q.invite_code) return String(q.invite_code).trim();
   if (q.scene) {
     const s = decodeURIComponent(String(q.scene));
     const m = s.match(/inviteCode=([A-Za-z0-9]+)/) || s.match(/invite_code=([A-Za-z0-9]+)/);
     if (m && m[1]) return m[1];
   }
 } catch (e) {}
 return '';
}

function __stCapturePendingInvite(options) {
 const code = __stExtractInviteCode(options);
 if (!code) return '';
 try {
   const old = wx.getStorageSync('pendingInviteCode');
   if (!old) wx.setStorageSync('pendingInviteCode', code);
 } catch (e) {}
 return code;
}

function __stTryBindInviteOnce() {
 const apiBase = __stGetApiBase();
 const cid = wx.getStorageSync('clientId') || wx.getStorageSync('openid');
 const inviteCode = wx.getStorageSync('pendingInviteCode');
 const waitKey = '__st_bind_wait_' + String(inviteCode || '');
 const maxWait = 12;

 function clearRetry() {
   try { wx.removeStorageSync(waitKey); } catch (e) {}
 }

 function finishWithoutRetry() {
   clearRetry();
   try { wx.removeStorageSync('pendingInviteCode'); } catch (e) {}
 }

 function scheduleRetry() {
   try {
     const n = Number(wx.getStorageSync(waitKey) || 0);
     if (n >= maxWait) return;
     wx.setStorageSync(waitKey, n + 1);
     setTimeout(__stTryBindInviteOnce, 3000);
   } catch (e) {
     try { setTimeout(__stTryBindInviteOnce, 3000); } catch (e2) {}
   }
 }

 if (!inviteCode) return;
 if (!apiBase || !cid) { scheduleRetry(); return; }
 if (String(cid).startsWith('ST-')) { scheduleRetry(); return; }

 const boundKey = '__st_bound_' + cid;
 if (wx.getStorageSync(boundKey)) return;

 wx.request({
   url: apiBase + '/api/fission/init',
   method: 'POST',
   header: { 'content-type': 'application/json' },
   data: { clientId: cid },
   success() {
     wx.request({
       url: apiBase + '/api/fission/bind-v2',
       method: 'POST',
       header: { 'content-type': 'application/json' },
       data: { clientId: cid, inviteCode },
       success(res) {
         const d = (res && res.data) || {};
         const msg = String((d && d.message) || '').toLowerCase();
         const ok = !!d.ok;
         const already = msg.indexOf('already bound') >= 0;
         const selfBind = msg.indexOf('cannot bind self') >= 0 || msg.indexOf('cannot bind own') >= 0;

         if (ok || already) {
           wx.setStorageSync(boundKey, 1);
           finishWithoutRetry();
         } else if (selfBind) {
           finishWithoutRetry();
         } else {
           scheduleRetry();
         }

         try {
           appDebug('[ST_BIND_V2] resp', { cid, inviteCode, d, selfBind, already });
         } catch (e) {}
       },
       fail(err) {
         try {
           appDebug('[ST_BIND_V2] fail', { cid, inviteCode, err });
         } catch (e) {}
         scheduleRetry();
       }
     });
   },
   fail(err) {
     try {
       appDebug('[ST_INIT_BEFORE_BIND] fail', { cid, inviteCode, err });
     } catch (e) {}
     scheduleRetry();
   }
 });
}

/* ====== ST_P0_BIND_INVITE_APPJS END ====== */

// [PATCH] GLOBAL_SHARE_ALL_PAGES
const __RAW_PAGE__ = Page;

function __stBuildQuery__(obj) {
 const pairs = [];
 Object.keys(obj || {}).forEach((k) => {
   const v = obj[k];
   if (v === undefined || v === null || v === '') return;
   pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
 });
 return pairs.join('&');
}

function __stDefaultShare__(ctx) {
 const route = (ctx && ctx.route) ? ('/' + ctx.route) : '/pages/index/index';
 const query = __stBuildQuery__((ctx && ctx.options) || {});
 return {
   title: '熵盾研究院',
   path: query ? (route + '?' + query) : route,
   query: query
 };
}

Page = function(pageOptions) {
 const opts = pageOptions || {};
 const rawOnShow = opts.onShow;
 const rawShareAppMessage = opts.onShareAppMessage;
 const rawShareTimeline = opts.onShareTimeline;

 opts.onShow = function() {
   try {
     wx.showShareMenu({
       menus: ['shareAppMessage', 'shareTimeline']
     });
   } catch (e) {
     appDebug('[GLOBAL_SHARE] showShareMenu fail =>', e);
   }

   if (typeof rawOnShow === 'function') {
     return rawOnShow.apply(this, arguments);
   }
 };

 if (typeof rawShareAppMessage !== 'function') {
   opts.onShareAppMessage = function() {
     return __stDefaultShare__(this);
   };
 }

 if (typeof rawShareTimeline !== 'function') {
   opts.onShareTimeline = function() {
     const share = __stDefaultShare__(this);
     return {
       title: share.title,
       query: share.query || ''
     };
   };
 }

 return __RAW_PAGE__(opts);
};
// [PATCH END] GLOBAL_SHARE_ALL_PAGES
function __clearLocalMembershipCache() {
  let current = {};

  try {
    current = wx.getStorageSync('userRights') || {};
  } catch (e) {}

  const cleaned = Object.assign({}, current);

  const membershipKeys = [
    'membership',
    'calculator',
    'membershipName',
    'currentMembershipName',
    'membershipPlan',
    'currentMembershipType',
    'membershipType',
    'membershipLevel',
    'membershipProductCode',
    'membershipProduct',
    'productCode',
    'membershipExpireAt',
    'membershipExpireText',
    'membershipExpireAtText',
    'membership_name',
    'membership_level',
    'membership_expire_at',
    'membership_active',
    'trialActive',
    'trialExpireAt',
    'advancedEnabled',
    'advanced_enabled',
    'isMemberActive',
    'membershipActive',
    'is_member_active',
    'canUseCalculator',
    'can_use_calculator',
    'needsPay',
    'needs_pay',
    'effectiveRights'
  ];

  membershipKeys.forEach((key) => {
    delete cleaned[key];
  });

  try {
    wx.setStorageSync('userRights', cleaned);

    if (
      typeof wx.removeStorageSync === 'function'
    ) {
      wx.removeStorageSync('effectiveRights');
      wx.removeStorageSync(
        'lastEffectiveRightsSyncAt'
      );
    }
  } catch (e) {}

  try {
    const app = getApp();

    if (app && app.globalData) {
      app.globalData.userRights = cleaned;
      app.globalData.effectiveRights = {};
    }
  } catch (e) {}

  return cleaned;
}

function __syncServerAuthoritativeRights(
  clientId,
  scene
) {
  const cid = String(clientId || '').trim();

  if (!cid) {
    return Promise.resolve({
      ok: false,
      code: 'CLIENT_ID_EMPTY'
    });
  }

  if (
    wx.__authoritativeRightsClientId === cid &&
    wx.__authoritativeRightsPromise
  ) {
    return wx.__authoritativeRightsPromise;
  }

  try {
    const {
      syncEffectiveRights
    } = require('./utils/rightsSync');

    let task = null;

    const clearTask = () => {
      if (
        wx.__authoritativeRightsClientId === cid &&
        wx.__authoritativeRightsPromise === task
      ) {
        wx.__authoritativeRightsClientId = '';
        wx.__authoritativeRightsPromise = null;
      }
    };

    task = syncEffectiveRights({
      clientId: cid,
      scene: scene || 'app_launch'
    }).then(
      (result) => {
        appDebug(
          '[BOOT][RIGHTS] authoritative sync:',
          {
            ok: !!(result && result.ok),
            code:
              (result && result.code) || '',
            scene: scene || 'app_launch'
          }
        );

        clearTask();
        return result;
      },
      (error) => {
        appDebug(
          '[BOOT][RIGHTS] authoritative sync fail:',
          String(
            (error && error.message) ||
            error ||
            ''
          )
        );

        clearTask();

        return {
          ok: false,
          code: 'RIGHTS_SYNC_EXCEPTION'
        };
      }
    );

    wx.__authoritativeRightsClientId = cid;
    wx.__authoritativeRightsPromise = task;

    return task;
  } catch (error) {
    appDebug(
      '[BOOT][RIGHTS] module load fail:',
      String(
        (error && error.message) ||
        error ||
        ''
      )
    );

    return Promise.resolve({
      ok: false,
      code: 'RIGHTS_SYNC_MODULE_ERROR'
    });
  }
}

App({
 onLaunch(options) {
   // ====== [A1:COMPLIANCE_GATE] START ======
   // 首次进入强制阅读并勾选协议，否则拦截使用（合规 Gate）
   try {
     const __agreed = wx.getStorageSync('agreedTerms');
     if (!__agreed) {
       let __enc = '';
       try {
         const __path = (options && options.path) || '';
         const __q = (options && options.query) || {};
         const __pairs = [];
         Object.keys(__q).forEach((k) => {
           const v = __q[k];
           if (v === undefined || v === null || v === '') return;
           __pairs.push(encodeURIComponent(k) + '=' + encodeURIComponent(String(v)));
         });
         const __full = __pairs.length ? (__path + '?' + __pairs.join('&')) : __path;
         __enc = __full ? encodeURIComponent(__full) : '';
       } catch (e) {}
       wx.reLaunch({ url: '/pages/agreementGate/index' + (__enc ? ('?entry=' + __enc) : '') });
     }
   } catch (e) {}
   // ====== [A1:COMPLIANCE_GATE] END ======

   // SERVER_MEMBERSHIP_AUTHORITATIVE
   __clearLocalMembershipCache();
   // [ST_P0_BIND_INVITE_APPJS] capture inviteCode at launch (do not wait payment)
   try { __stCapturePendingInvite(options); } catch(e) {}
   // [ST_P0_BIND_INVITE_APPJS] retry bind after clientId ready
   try {
     setTimeout(__stTryBindInviteOnce, 300);
     setTimeout(__stTryBindInviteOnce, 1200);
     setTimeout(__stTryBindInviteOnce, 3000);
     setTimeout(__stTryBindInviteOnce, 6000);
   } catch(e) {}
   // ====== [MOD:BOOT_OPENID_PROFILE_RIGHTS_SYNC] START ======
   try {
     if (!wx.__bootSyncProfileDone) {
       wx.__bootSyncProfileDone = true;

       const base = (wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || 'https://api.entropyshield.com').replace(/\/$/, '');

       const up = (v) => String(v || '').toUpperCase();
       const toMs = (v) => {
         if (v == null) return null;
         if (typeof v === 'number') return (v > 0 && v < 1e12) ? v * 1000 : v;
         const s = String(v);
         const su = s.toUpperCase();
         if (su === 'LIFETIME') return 4102444800000;
         if (/^\d+$/.test(s)) {
           const n = Number(s);
           return (n > 0 && n < 1e12) ? n * 1000 : n;
         }
         const t = Date.parse(s.replace(/-/g, '/'));
         return isNaN(t) ? null : t;
       };

       const mergeRights = (p) => {
         try {
           const cur = wx.getStorageSync('userRights');
           const curObj = (cur && typeof cur === 'object') ? cur : {};
           const ur = Object.assign({}, curObj);

           const freeRaw = (p && (p.total_reward_times || p.totalRewardTimes || p.free_calc_times || p.freeCalcTimes)) || ur.freeCalcTimes || 0;
           const free = Number(freeRaw) || 0;
           ur.freeCalcTimes = free;


           const bootInviteCode = String((p && (p.invite_code || p.inviteCode)) || '').trim().toUpperCase();
           const bootInvitedByCode = String((p && (p.invited_by_code || p.invitedByCode)) || '').trim().toUpperCase();

           if (bootInviteCode) ur.inviteCode = bootInviteCode;
           if (bootInvitedByCode) ur.invitedByCode = bootInvitedByCode;

           const bootProfile = Object.assign({}, p || {}, {
             inviteCode: bootInviteCode,
             invite_code: bootInviteCode,
             invitedByCode: bootInvitedByCode,
             invited_by_code: bootInvitedByCode
           });
           wx.setStorageSync('fissionProfile', bootProfile);

           // ====== [MOD:FREECALC_PRESERVE_MAX] START ======
           try {
             const __cur = wx.getStorageSync('userRights');
             const __curObj = (__cur && typeof __cur === 'object') ? __cur : {};
             const __curTimes = Number(__curObj.freeCalcTimes || __curObj.free_calc_times || 0) || 0;
             const __newTimes = Number(ur.freeCalcTimes || ur.free_calc_times || 0) || 0;
             ur.freeCalcTimes = Math.max(__curTimes, __newTimes);
           } catch (e) {}
           // ====== [MOD:FREECALC_PRESERVE_MAX] END ======

           wx.setStorageSync('userRights', ur);
           appDebug('[BOOT][SYNC] merged userRights:', ur);
         } catch (e) {
           appDebug('[BOOT][SYNC] merge error:', e);
         }
       };

       const syncByClientId = (cid) => {
         if (!cid) return;

         __syncServerAuthoritativeRights(
           cid,
           'app_launch'
         );
         wx.request({
           url: base + '/api/fission/profile?clientId=' + encodeURIComponent(cid),
           success: (res) => {
             const d = (res && res.data) ? res.data : {};
             const ok = !!d.ok;
             const p0 = d.profile || d.data || null;
             const total = (d.total_reward_times || d.totalRewardTimes || (p0 && (p0.total_reward_times || p0.totalRewardTimes)) || 0);
             const p = p0 ? Object.assign({}, p0, { total_reward_times: total }) : { total_reward_times: total };
             appDebug('[BOOT][SYNC] profile resp:', d);
             if (ok) mergeRights(p);
           },
           fail: (e) => appDebug('[BOOT][SYNC] profile fail:', e)
         });
       };

       const cid0 = wx.getStorageSync('clientId') || '';
       if (cid0 && /^o[A-Za-z0-9_-]+$/.test(cid0)) {
         syncByClientId(cid0);
       } else {
         wx.login({
           success: (r) => {
             if (!r || !r.code) return;
             wx.request({
               url: base + '/api/wx/login?code=' + encodeURIComponent(r.code),
               method: 'POST',
               header: { 'content-type': 'application/json' },
               success: (res) => {
                 const openid = (res && res.data && (res.data.openid || res.data.openId)) || (res.data && res.data.data && res.data.data.openid);
                 appDebug('[BOOT] wx/login resp:', res && res.data);
                 if (openid) {
                   wx.setStorageSync('clientId', openid);
                   appDebug('[BOOT] clientId(openid)=', openid);
                   syncByClientId(openid);
                 }
               },
               fail: (e) => appDebug('[BOOT] wx/login request fail:', e)
             });
           },
           fail: (e) => appDebug('[BOOT] wx.login fail:', e)
         });
       }
     }
   } catch(e) {}
   // ====== [MOD:BOOT_OPENID_PROFILE_RIGHTS_SYNC] END ======
   // ====== [MOD:WX_LOGIN_SET_CLIENTID] START ======
   try {
     const __cid0 = ensureClientId();
     const __base = (wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '').toString().replace(/\/$/, '');
     if (__base && !wx.__clientIdLoginDone) {
       wx.__clientIdLoginDone = true;
       wx.login({
         success: (lr) => {
           if (!lr || !lr.code) return;
           wx.request({
             url: __base + '/api/wx/login?code=' + encodeURIComponent(lr.code),
             method: 'POST',
             header: { 'content-type': 'application/json' },
             success: (rr) => {
               const d = (rr && rr.data && (rr.data.data || rr.data)) || {};
               const oid = (d.openid || d.openId || d.clientId || d.client_id);
               if (!oid) return;
               const __cid = String(oid).trim();
               if (!__cid) return;
               wx.setStorageSync('clientId', __cid);

               __syncServerAuthoritativeRights(
                 __cid,
                 'app_login_refresh'
               );

               wx.request({
                 url: __base + '/api/fission/profile?clientId=' + encodeURIComponent(__cid),
                 success: (pr) => {
                   const body = pr && pr.data ? pr.data : {};
                   if (!body || body.ok === false) return;
                   const p = body.profile || body.data || body;

                   const cur = wx.getStorageSync('userRights');
                   const curObj = (cur && typeof cur === 'object') ? cur : {};
                   const ur = Object.assign({}, curObj);

                   const t = (p.total_reward_times != null ? p.total_reward_times : (p.totalRewardTimes != null ? p.totalRewardTimes : null));
                   if (t != null && !Number.isNaN(Number(t))) ur.freeCalcTimes = Number(t);


                   const bootInviteCode = String(p.invite_code || p.inviteCode || '').trim().toUpperCase();
                   const bootInvitedByCode = String(p.invited_by_code || p.invitedByCode || '').trim().toUpperCase();

                   if (bootInviteCode) ur.inviteCode = bootInviteCode;
                   if (bootInvitedByCode) ur.invitedByCode = bootInvitedByCode;

                   // ====== [MOD:FREECALC_PRESERVE_MAX] START ======
                   try {
                     const __cur = wx.getStorageSync('userRights');
                     const __curObj = (__cur && typeof __cur === 'object') ? __cur : {};
                     const __curTimes = Number(__curObj.freeCalcTimes || __curObj.free_calc_times || 0) || 0;
                     const __newTimes = Number(ur.freeCalcTimes || ur.free_calc_times || 0) || 0;
                     ur.freeCalcTimes = Math.max(__curTimes, __newTimes);
                   } catch (e) {}
                   // ====== [MOD:FREECALC_PRESERVE_MAX] END ======

                   wx.setStorageSync('userRights', ur);
                   const bootProfile = Object.assign({}, p || {}, {
                     inviteCode: bootInviteCode,
                     invite_code: bootInviteCode,
                     invitedByCode: bootInvitedByCode,
                     invited_by_code: bootInvitedByCode
                   });
                   wx.setStorageSync('fissionProfile', bootProfile);
                   appDebug('[BOOT][SYNC] userRights merged:', ur);
                 }
               });
             }
           });
         }
       });
     }
   } catch(e) {}
   // ====== [MOD:WX_LOGIN_SET_CLIENTID] END ======

   let sys = {};
   let isDevtools = false;
   try {
     sys = (wx.getWindowInfo && wx.getWindowInfo()) || ((wx.getDeviceInfo && Object.assign({}, wx.getDeviceInfo(), wx.getAppBaseInfo ? wx.getAppBaseInfo() : {}, wx.getSystemSetting ? wx.getSystemSetting() : {})) || {});
     isDevtools = !!(sys && sys.platform === 'devtools');
   } catch (e) {}

   const cfgBase = (API_BASE || '').trim().replace(/\/$/, '');
   let resolvedBase = cfgBase;

   try {
     const stBase = (wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '').trim().replace(/\/$/, '');
     if (isDevtools && stBase) resolvedBase = stBase;
   } catch (e) {}

   if (!isDevtools) resolvedBase = cfgBase;

   try {
     wx.setStorageSync('API_BASE', resolvedBase);
     wx.setStorageSync('apiBaseUrl', resolvedBase);
   } catch (e) {}

   this.globalData = this.globalData || {};
   this.globalData.API_BASE = resolvedBase;
   this.globalData.baseUrl = resolvedBase;

   appDebug('[BOOT] ENV=', ENV, 'platform=', runtime && runtime.platform, 'envVersion=', runtime && runtime.envVersion);
   appDebug('[BOOT] API_BASE(resolved)=', resolvedBase);

   try {
     const q = (options && options.query) ? options.query : {};
     let inviteCode = '';

     if (q && q.inviteCode) inviteCode = String(q.inviteCode || '');
     if (!inviteCode && q && q.scene) inviteCode = String(q.scene || '');
     if (!inviteCode && options && typeof options.scene === 'string' && options.scene) inviteCode = String(options.scene);

     if (inviteCode) {
       let raw = '';
       try { raw = decodeURIComponent(inviteCode); } catch (e) { raw = inviteCode; }
       raw = String(raw || '').trim();

       if (raw.includes('=')) {
         const parts = raw.split('&').map(s => s.split('='));
         const map = {};
         parts.forEach(([k, v]) => { if (k) map[String(k).trim()] = (v || '').trim(); });
         raw = map.inviteCode || map.code || raw;
       }

       const finalCode = String(raw).trim().toUpperCase();
       if (finalCode) {
         wx.setStorageSync('pendingInviteCode', finalCode);
         appDebug('[BOOT][INVITE] pendingInviteCode=', finalCode);
       }
     }
   } catch (e) {
     appDebug('[BOOT][INVITE] parse failed:', e);
   }

   try {
     wx.request({
       url: resolvedBase + '/api/health',
       method: 'GET',
       timeout: 10000,
       success: (res) => appDebug('[BOOT] /api/health ok:', res && res.data),
       fail: (err) => appDebug('[BOOT] /api/health fail:', err)
     });
   } catch (e) {
     appDebug('[BOOT] health request exception:', e);
   }

   try {
     if (!wx.__finishNavHookInstalled) {
       wx.__finishNavHookInstalled = true;

       function _tryFinishRewardOnReportNav(url) {
         try {
           if (!url || typeof url !== 'string') return;
           if (url.indexOf('/pkgChallenge/campReport/index') === -1) return;
           if (wx.__campFinishNavDone) return;

           var doneMap = wx.getStorageSync('campFinishedMap') || {};
           var done7 = !!(doneMap.D7 || doneMap['D7'] || (Object.keys(doneMap || {}).length >= 7));
           if (!done7) {
             var logs = wx.getStorageSync('campDailyLogs') || {};
             var keys = Object.keys(logs || {}).filter(function (k) { return /^D[1-7]$/.test(k); });
             done7 = keys.length >= 7;
           }
           if (!done7) return;

           var base = wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '';
           var clientId = wx.getStorageSync('clientId') || '';
           if (!base || !clientId) return;

           function _sendFinish() {
             if (wx.__campFinishNavDone) return;
             wx.__campFinishNavDone = true;
             wx.request({
               url: base.replace(/\/$/, '') + '/api/fission/camp/finish',
               method: 'POST',
               header: { 'content-type': 'application/json' },
               data: { clientId: clientId },
               success: function (res) { appDebug('[NAV-HOOK] camp/finish resp:', res && res.data); },
               fail: function (err) { console.error('[NAV-HOOK] camp/finish fail:', err); }
             });
           }

           var invitedBy = wx.getStorageSync('fissionInvitedByCode') || '';
           if (!invitedBy) {
             if (wx.__campFinishInviterHydrating) return;
             wx.__campFinishInviterHydrating = true;

             wx.request({
               url: base.replace(/\/$/, '') + '/api/fission/profile?clientId=' + encodeURIComponent(clientId),
               method: 'GET',
               success: function (r) {
                 try {
                   var prof = r && r.data && (r.data.profile || r.data.user || r.data.data);
                   var code = '';
                   if (prof) code = prof.invited_by_code || prof.invitedByCode || '';
                   code = code ? String(code).trim().toUpperCase() : '';
                   if (code) {
                     wx.setStorageSync('fissionInvitedByCode', code);
                     invitedBy = code;
                   }
                   if (!invitedBy) return;
                   _sendFinish();
                 } finally {
                   wx.__campFinishInviterHydrating = false;
                 }
               },
               fail: function () { wx.__campFinishInviterHydrating = false; }
             });
             return;
           }

           _sendFinish();
         } catch (e) { appDebug('[NAV-HOOK] err:', e); }
       }

       wx.__tryFinishRewardOnReportNav = _tryFinishRewardOnReportNav;

       const _nav = wx.navigateTo;
       wx.navigateTo = function (opts) { try { _tryFinishRewardOnReportNav(opts && opts.url); } catch (e) {} return _nav.call(wx, opts); };
       const _red = wx.redirectTo;
       wx.redirectTo = function (opts) { try { _tryFinishRewardOnReportNav(opts && opts.url); } catch (e) {} return _red.call(wx, opts); };
       const _rel = wx.reLaunch;
       wx.reLaunch = function (opts) { try { _tryFinishRewardOnReportNav(opts && opts.url); } catch (e) {} return _rel.call(wx, opts); };
     }
   } catch (e) {
     appDebug('[NAV-HOOK] install failed:', e);
   }

   try {
     const base = (resolvedBase || '').replace(/\/$/, '');
     const cid = (wx.getStorageSync('clientId') || '').trim();
     if (base && cid) {
       __syncServerAuthoritativeRights(
         cid,
         'app_existing_identity'
       );

       wx.request({
         url: base + '/api/fission/profile?clientId=' + encodeURIComponent(cid),
         method: 'GET',
         timeout: 10000,
         success: (r) => {
           try {
             const p = r && r.data && (r.data.profile || r.data.user || r.data.data);
             if (!p) return;
             const cur = wx.getStorageSync('userRights');
             const curObj = (cur && typeof cur === 'object') ? cur : {};
             const ur = Object.assign({}, curObj);

             const bootInviteCode = String((p && (p.invite_code || p.inviteCode)) || '').trim().toUpperCase();
             const bootInvitedByCode = String((p && (p.invited_by_code || p.invitedByCode)) || '').trim().toUpperCase();

             if (bootInviteCode) ur.inviteCode = bootInviteCode;
             if (bootInvitedByCode) ur.invitedByCode = bootInvitedByCode;

             // ====== [MOD:FREECALC_PRESERVE_MAX] START ======
             try {
               const __cur = wx.getStorageSync('userRights');
               const __curObj = (__cur && typeof __cur === 'object') ? __cur : {};
               const __curTimes = Number(__curObj.freeCalcTimes || __curObj.free_calc_times || 0) || 0;
               const __newTimes = Number(ur.freeCalcTimes || ur.free_calc_times || 0) || 0;
               ur.freeCalcTimes = Math.max(__curTimes, __newTimes);
             } catch (e) {}
             // ====== [MOD:FREECALC_PRESERVE_MAX] END ======

             wx.setStorageSync('userRights', ur);
             const bootProfile = Object.assign({}, p || {}, {
               inviteCode: bootInviteCode,
               invite_code: bootInviteCode,
               invitedByCode: bootInvitedByCode,
               invited_by_code: bootInvitedByCode
             });
             wx.setStorageSync('fissionProfile', bootProfile);
             appDebug('[BOOT][MEMBER] userRights synced:', ur);
           } catch (e) {}
         }
       });
     }
   } catch (e) {}

 },

 globalData: {
   API_BASE: (API_BASE || '').trim().replace(/\/$/, ''),
   baseUrl: (API_BASE || '').trim().replace(/\/$/, '')
 }
});

// 防止依赖分析忽略管理端页面（开发环境用）
if (false) {
 require('./pkgService/visitAdmin/index.js');
}
