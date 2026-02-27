// app.js - 启动应用：统一 API_BASE、支持 scene→pendingInviteCode（裂变扫码验收关键）

const { API_BASE, ENV, runtime } = require('./config');

// ==============================
// [PATCH-DEV-API-BASE-LOCK] DevTools only
// 若本地存了 __DEV_API_BASE__，则锁死 API_BASE/apiBaseUrl（避免编译/其他代码覆盖）
// ==============================
try {
  const __devBase = (wx.getStorageSync('__DEV_API_BASE__') || '').trim().replace(/\/$/, '');
  if (__devBase) {
    const __origSet = wx.setStorageSync;
    wx.setStorageSync = function (k, v) {
      if (k === 'API_BASE' || k === 'apiBaseUrl') return __origSet.call(wx, k, __devBase);
      return __origSet.call(wx, k, v);
    };
    __origSet.call(wx, 'API_BASE', __devBase);
    __origSet.call(wx, 'apiBaseUrl', __devBase);
    console.log('[BOOT] dev api base locked:', __devBase);
  }
} catch (e) {}

App({
  onLaunch(options) {
    // 基础信息
    let sys = {};
    let isDevtools = false;
    try {
      sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
      isDevtools = !!(sys && sys.platform === 'devtools');
    } catch (e) {}

    // ==============================
    // [PATCH-API-BASE-RESOLVE] 统一解析“本次运行”使用的 base
    // 规则：
    // - DevTools：优先使用 Storage 里的手动覆盖（API_BASE/apiBaseUrl），否则用 config.API_BASE
    // - 真机/预览/体验版：强制使用 config.API_BASE（确保线上域名一致，便于验收）
    // - 若 __DEV_API_BASE__ 存在，已在文件顶部锁定，无需再处理
    // ==============================
    const cfgBase = (API_BASE || '').trim().replace(/\/$/, '');
    let resolvedBase = cfgBase;

    try {
      const stBase = (wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '').trim().replace(/\/$/, '');
      if (isDevtools && stBase) {
        resolvedBase = stBase; // DevTools 允许手动覆盖
        wx.__API_BASE_OVERRIDE = stBase;
      }
    } catch (e) {}

    // 真机/预览/体验版：强制落 config.API_BASE（避免被旧缓存/手动覆盖污染验收）
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

    // ==============================
    // [PATCH-SCENE-TO-PENDING-INVITE] 统一接收分享/扫码携带的邀请码 → pendingInviteCode
    // 验收目标：真机扫码（scene=邀请码）后，裂变页 init/profile 绑定关系，
    // 最终以 profile.invited_by_code 作为证据。
    //
    // 支持入口：
    // 1) 分享参数：options.query.inviteCode
    // 2) scene 在 query：options.query.scene
    // 3) 小程序码 scene：options.scene（getwxacodeunlimit）
    // 兼容：scene 为纯邀请码 或 "inviteCode=XXX" / "code=XXX"
    // ==============================
    try {
      const q = (options && options.query) ? options.query : {};
      let inviteCode = '';

      // 1) query.inviteCode
      if (q && q.inviteCode) inviteCode = String(q.inviteCode || '');

      // 2) query.scene
      if (!inviteCode && q && q.scene) inviteCode = String(q.scene || '');

      // 3) options.scene (getwxacodeunlimit)
      if (!inviteCode && options && typeof options.scene === 'string' && options.scene) {
        inviteCode = String(options.scene);
      }

      // decode + parse
      if (inviteCode) {
        let raw = '';
        try { raw = decodeURIComponent(inviteCode); } catch (e) { raw = inviteCode; }
        raw = String(raw || '').trim();

        // 兼容 "inviteCode=XXX" / "code=XXX"
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

    // ==============================
    // [PATCH-HEALTH-CHECK] 启动健康检查：确认真机/预览/体验版可访问线上域名
    // ==============================
    try {
      wx.request({
        url: resolvedBase + '/api/health',
        method: 'GET',
        timeout: 10000,
        success: (res) => {
          console.log('[BOOT] /api/health ok:', res && res.data);
        },
        fail: (err) => {
          console.log('[BOOT] /api/health fail:', err);
          try {
            wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' });
          } catch (e) {}
        }
      });
    } catch (e) {
      console.log('[BOOT] health request exception:', e);
      try {
        wx.showToast({ title: '健康检查失败，请稍后再试', icon: 'none' });
      } catch (e2) {}
    }

    // ==============================
    // [ADD-NAV-HOOK] FINISH_ON_REPORT_NAV（保留你原逻辑，收口不改骨架）
    // ==============================
    try {
      if (!wx.__finishNavHookInstalled) {
        wx.__finishNavHookInstalled = true;

        function _tryFinishRewardOnReportNav(url) {
          try {
            if (!url || typeof url !== 'string') return;
            if (url.indexOf('/pages/campReport/index') === -1) return;

            // 只触发一次（本次小程序运行期）
            if (wx.__campFinishNavDone) return;

            // 7/7 判断：优先 campFinishedMap，其次 campDailyLogs
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

            // inviter guard：若本地没写入，自动拉 profile 补齐 invited_by_code 再触发
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
                    if (prof) {
                      code = prof.invited_by_code || prof.invitedByCode || prof.invited_by_code || '';
                    }
                    code = code ? String(code).trim().toUpperCase() : '';
                    if (code) {
                      wx.setStorageSync('fissionInvitedByCode', code);
                      invitedBy = code;
                    }
                    if (!invitedBy) return; // 仍未绑定则不触发 finish（避免噪音）
                    _sendFinish();
                  } finally {
                    wx.__campFinishInviterHydrating = false;
                  }
                },
                fail: function () {
                  wx.__campFinishInviterHydrating = false;
                }
              });
              return;
            }

            _sendFinish();
          } catch (e) {
            console.log('[NAV-HOOK] err:', e);
          }
        }

        // 暴露给页面（直达/编译直达时可手动触发同一套逻辑）
        wx.__tryFinishRewardOnReportNav = _tryFinishRewardOnReportNav;

        // hook navigateTo / redirectTo / reLaunch
        const _nav = wx.navigateTo;
        wx.navigateTo = function (opts) {
          try { _tryFinishRewardOnReportNav(opts && opts.url); } catch (e) {}
          return _nav.call(wx, opts);
        };

        const _red = wx.redirectTo;
        wx.redirectTo = function (opts) {
          try { _tryFinishRewardOnReportNav(opts && opts.url); } catch (e) {}
          return _red.call(wx, opts);
        };

        const _rel = wx.reLaunch;
        wx.reLaunch = function (opts) {
          try { _tryFinishRewardOnReportNav(opts && opts.url); } catch (e) {}
          return _rel.call(wx, opts);
        };
      }
    } catch (e) {
      console.log('[NAV-HOOK] install failed:', e);
    }

    // ==============================
    // [PATCH-KEEP-API-BASE-ONLAUNCH] DevTools：恢复本次 override（防止某些页面启动后又覆盖）
    // ==============================
    try {
      if (isDevtools) {
        const __b2 = (wx.__API_BASE_OVERRIDE || wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '').trim().replace(/\/$/, '');
        if (__b2) {
          try { wx.setStorageSync('API_BASE', __b2); } catch (e) {}
          try { wx.setStorageSync('apiBaseUrl', __b2); } catch (e) {}
          this.globalData = this.globalData || {};
          this.globalData.API_BASE = __b2;
          this.globalData.baseUrl = __b2;
        }
      }
    } catch (e) {}
  },

  globalData: {
    API_BASE: (API_BASE || '').trim().replace(/\/$/, ''),
    baseUrl: (API_BASE || '').trim().replace(/\/$/, '')
  }
});

// --- 防止代码依赖分析忽略管理端页面（开发环境用）---
if (false) {
  require('./pages/visitAdmin/index.js');
}