// app.js - 稳定版启动（不重写 wx.getStorageSync / wx.setStorageSync，避免递归爆栈）
const { API_BASE, ENV, runtime } = require('./config');

App({
  onLaunch(options) {
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
              ur.membershipLevel = (p.membership_level || ur.membershipLevel || '').toString();
              ur.membershipExpireAt = (p.membership_expire_at == null ? null : p.membership_expire_at);
              if (ur.membershipLevel === 'LIFETIME') ur.membershipName = '\u7ec8\u8eab\u4f1a\u5458';
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