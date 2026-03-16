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
            console.log('[ST_BIND_V2] resp', { cid, inviteCode, d, selfBind, already });
          } catch (e) {}
        },
        fail(err) {
          try {
            console.log('[ST_BIND_V2] fail', { cid, inviteCode, err });
          } catch (e) {}
          scheduleRetry();
        }
      });
    },
    fail(err) {
      try {
        console.log('[ST_INIT_BEFORE_BIND] fail', { cid, inviteCode, err });
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
      console.log('[GLOBAL_SHARE] showShareMenu fail =>', e);
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
App({
  onLaunch(options) {
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

        const base = (wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || 'https://api.entropyshield.com').replace(/\/$/,'');

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
          const t = Date.parse(s.replace(/-/g,'/'));
          return isNaN(t) ? null : t;
        };

        const mergeRights = (p) => {
          try {
            const cur = wx.getStorageSync('userRights');
            const curObj = (cur && typeof cur === 'object') ? cur : {};
            const ur = Object.assign({}, curObj);

            // free times：优先用 profile.total_reward_times
            const freeRaw = (p && (p.total_reward_times || p.totalRewardTimes || p.free_calc_times || p.freeCalcTimes)) || ur.freeCalcTimes || 0;
            const free = Number(freeRaw) || 0;
            ur.freeCalcTimes = free;

            // membership: level/name/expire
            ur.membershipLevel = up((p && (p.membership_level || p.membershipLevel)) || ur.membershipLevel || '');
            const nameRaw = (p && (p.membership_name || p.membershipName)) || ur.membershipName || ur.membership_name || '';
            if (nameRaw) ur.membershipName = nameRaw;

            const expRaw = (p && (p.membership_expire_at != null ? p.membership_expire_at : p.membershipExpireAt)) ?? ur.membershipExpireAt ?? ur.membership_expire_at ?? null;
            ur.membershipExpireAt = toMs(expRaw);

            // 终身兜底：level / expire / name 任一命中
            const nm = String(ur.membershipName || '');
            const isLife = (ur.membershipLevel === 'LIFETIME') || (up(expRaw) === 'LIFETIME') || (nm.indexOf('终身') >= 0) || (nm.indexOf('终生') >= 0) || (nm.indexOf('永久') >= 0);
            if (isLife) {
              ur.membershipLevel = 'LIFETIME';
              ur.membershipName = '终身会员';
              ur.membershipExpireAt = 4102444800000;
            }

            wx.setStorageSync('fissionProfile', p || {});


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
            console.log('[BOOT][SYNC] merged userRights:', ur);
          } catch(e) {
            console.log('[BOOT][SYNC] merge error:', e);
          }
        };

        const syncByClientId = (cid) => {
          if (!cid) return;
          wx.request({
            url: base + '/api/fission/profile?clientId=' + encodeURIComponent(cid),
            success: (res) => {
                            const d = (res && res.data) ? res.data : {};
              const ok = !!d.ok;
              const p0 = d.profile || d.data || null;

              // ✅ total_reward_times 在响应根部（不在 profile 里），这里必须从 d 取
              const total = (d.total_reward_times || d.totalRewardTimes ||
                            (p0 && (p0.total_reward_times || p0.totalRewardTimes)) || 0);

              // 把 total_reward_times 塞回去，确保 mergeRights 能写入 freeCalcTimes
              const p = p0 ? Object.assign({}, p0, { total_reward_times: total }) : { total_reward_times: total };

              console.log('[BOOT][SYNC] profile resp:', d);
              if (ok) mergeRights(p);
            },
            fail: (e) => console.log('[BOOT][SYNC] profile fail:', e)
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
                  console.log('[BOOT] wx/login resp:', res && res.data);
                  if (openid) {
                    wx.setStorageSync('clientId', openid);
                    console.log('[BOOT] clientId(openid)=', openid);
                    syncByClientId(openid);
                  }
                },
                fail: (e) => console.log('[BOOT] wx/login request fail:', e)
              });
            },
            fail: (e) => console.log('[BOOT] wx.login fail:', e)
          });
        }
      }
    } catch(e) {}
    // ====== [MOD:BOOT_OPENID_PROFILE_RIGHTS_SYNC] END ======
     // ====== [MOD:WX_LOGIN_SET_CLIENTID] START ======
     try {
       // 1) 先保证本地一定有 clientId（避免 /profile 400）
       const __cid0 = ensureClientId();

       // 2) 再尝试 wx.login 换 openid，升级为稳定 clientId（支付/权益不会丢）
       const __base = (wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '').toString().replace(/\/$/,'');
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

                 // 3) 立刻拉 profile 同步到 userRights（合并不覆盖）
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

                     const lv = (p.membership_level || p.membershipLevel || ur.membershipLevel || '');
                     const exp = (p.membership_expire_at == null ? (p.membershipExpireAt == null ? null : p.membershipExpireAt) : p.membership_expire_at);
                     const nm = (p.membership_name || p.membershipName || ur.membershipName || '');
                     if (nm) ur.membershipName = nm;
                     if (lv) ur.membershipLevel = String(lv).toUpperCase();
                     if (exp != null) ur.membershipExpireAt = exp;

                     // 终身兜底：level/expire/name 任一命中 -> 2100
                     const expUp = String(exp || '').toUpperCase();
                     const isLife =
                       (String(ur.membershipLevel || '').toUpperCase() === 'LIFETIME') ||
                       (expUp === 'LIFETIME') ||
                       (String(ur.membershipName || '').indexOf('终身') >= 0);

                     if (isLife) {
                       ur.membershipLevel = 'LIFETIME';
                       ur.membershipName = '终身会员';
                       ur.membershipExpireAt = 4102444800000;
                     }

                     if (p.inviteCode) ur.inviteCode = p.inviteCode;

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
                     wx.setStorageSync('fissionProfile', p);
                     console.log('[BOOT][SYNC] userRights merged:', ur);
                   }
                 });
               }
             });
           }
         });
       }
     } catch(e) {}
     // ====== [MOD:WX_LOGIN_SET_CLIENTID] END ======

    // 基础信息
    let sys = {};
    let isDevtools = false;
    try {
      sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
      isDevtools = !!(sys && sys.platform === 'devtools');
    } catch (e) {}

    // 统一解析本次运行 base
    const cfgBase = (API_BASE || '').trim().replace(/\/$/, '');
    let resolvedBase = cfgBase;

    try {
      const stBase = (wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '').trim().replace(/\/$/, '');
      if (isDevtools && stBase) resolvedBase = stBase;
    } catch (e) {}

    // 真机/预览强制用 config.API_BASE
    if (!isDevtools) resolvedBase = cfgBase;

    // 写入 storage + globalData
    try {
      wx.setStorageSync('API_BASE', resolvedBase);
      wx.setStorageSync('apiBaseUrl', resolvedBase);
    } catch (e) {}

    this.globalData = this.globalData || {};
    this.globalData.API_BASE = resolvedBase;
    this.globalData.baseUrl = resolvedBase;

    console.log('[BOOT] ENV=', ENV, 'platform=', runtime && runtime.platform, 'envVersion=', runtime && runtime.envVersion);
    console.log('[BOOT] API_BASE(resolved)=', resolvedBase);

    // scene / inviteCode -> pendingInviteCode
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
          console.log('[BOOT][INVITE] pendingInviteCode=', finalCode);
        }
      }
    } catch (e) {
      console.log('[BOOT][INVITE] parse failed:', e);
    }

    // 启动健康检查
    try {
      wx.request({
        url: resolvedBase + '/api/health',
        method: 'GET',
        timeout: 10000,
        success: (res) => console.log('[BOOT] /api/health ok:', res && res.data),
        fail: (err) => console.log('[BOOT] /api/health fail:', err)
      });
    } catch (e) {
      console.log('[BOOT] health request exception:', e);
    }

    // 保留你原 NAV hook（不改骨架）
    try {
      if (!wx.__finishNavHookInstalled) {
        wx.__finishNavHookInstalled = true;

        function _tryFinishRewardOnReportNav(url) {
          try {
            if (!url || typeof url !== 'string') return;
            if (url.indexOf('/pages/campReport/index') === -1) return;
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
                success: function (res) { console.log('[NAV-HOOK] camp/finish resp:', res && res.data); },
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
          } catch (e) { console.log('[NAV-HOOK] err:', e); }
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
      console.log('[NAV-HOOK] install failed:', e);
    }

    // ==============================
    // [PATCH-MEMBER-SYNC-SAFE] ??? profile ?????? userRights?? hook????????
    // ==============================
    try {
      const base = (resolvedBase || '').replace(/\/$/, '');
      const cid = (wx.getStorageSync('clientId') || '').trim();
      if (base && cid) {
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
                                // ====== [MOD:LIFETIME_MAP_NEVER_EXPIRE] START ======
              ur.membershipLevel = (p.membership_level || p.membershipLevel || ur.membershipLevel || '').toString().toUpperCase();

              const expRaw = (p.membership_expire_at == null
                ? (p.membershipExpireAt == null ? null : p.membershipExpireAt)
                : p.membership_expire_at);
              const expUp  = String(expRaw || '').toUpperCase();

              const nameRaw = (p.membership_name || p.membershipName || ur.membershipName || ur.membership_name || '');
              if (nameRaw) ur.membershipName = nameRaw;

              ur.membershipExpireAt = expRaw;

              // ✅ 终身识别兜底：level / expire_at / name 任一命中 -> 强制终身 + 2100-01-01
              const isLife =
                (ur.membershipLevel === 'LIFETIME') ||
                (expUp === 'LIFETIME') ||
                (String(ur.membershipName || '').indexOf('终身') >= 0);

              if (isLife) {
                ur.membershipLevel = 'LIFETIME';
                ur.membershipName = '终身会员';
                ur.membershipExpireAt = 4102444800000; // 2100-01-01
              }
              // ====== [MOD:LIFETIME_MAP_NEVER_EXPIRE] END ======
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
              console.log('[BOOT][MEMBER] userRights synced:', ur);
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
  require('./pages/visitAdmin/index.js');
}


