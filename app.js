const __CFG__ = require('./config');
const __API_BASE_SAFE__ = (__CFG__.API_BASE || __CFG__.PROD_API_BASE || __CFG__.DEV_API_BASE || '').replace(/\/$/, '');
// app.js - 启动应用并确保环境变量与数据库配置

const { API_BASE, ENV, runtime } = require('./config');  // 从 config.js 获取 API_BASE 和环境配置

// [PATCH-DEV-API-BASE-LOCK] DevTools only: if __DEV_API_BASE__ exists, lock API_BASE/apiBaseUrl to it (avoid compile override)
try {
  const __devBase = wx.getStorageSync('__DEV_API_BASE__') || '';
  if (__devBase) {
    const __origSet = wx.setStorageSync;
    wx.setStorageSync = function(k, v) {
      if (k === 'API_BASE' || k === 'apiBaseUrl') return __origSet.call(wx, k, __devBase);
      return __origSet.call(wx, k, v);
    };
    __origSet.call(wx, 'API_BASE', __devBase);
    __origSet.call(wx, 'apiBaseUrl', __devBase);
    console.log('[BOOT] dev api base locked:', __devBase);
  }
} catch(e) {}

App({
  onLaunch(options) {
  // [PATCH-DEV-BASE-GLOBALDATA] DevTools: if __DEV_API_BASE__ exists, lock globalData.API_BASE + Storage
  try {
    const __devBase = wx.getStorageSync('__DEV_API_BASE__') || '';
    if (__devBase) {
      this.globalData = this.globalData || {};
      this.globalData.API_BASE = __devBase;
      wx.setStorageSync('API_BASE', __devBase);
      wx.setStorageSync('apiBaseUrl', __devBase);
      console.log('[BOOT] globalData.API_BASE locked to', __devBase);
    }
  } catch(e) {}

    // [PATCH-DEVTOOLS-FORCE-LOCAL-API] DevTools 环境强制使用本机后端，避免编译后被覆盖回线上
    try {
      const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
      if (sys && sys.platform === 'devtools') {
        const local = 'https://api.entropyshield.com';
        try {
  const __keep = wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '';
  if (!__keep) wx.setStorageSync('API_BASE', local);
} catch(e) {}
// [PATCH-KEEP-API-BASE]

        try {
  const __keep = wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '';
  if (!__keep) wx.setStorageSync('apiBaseUrl', local);
} catch(e) {}
// [PATCH-KEEP-API-BASE]

        this.globalData = this.globalData || {};
        this.globalData.API_BASE = local;
        console.log('[BOOT][DEVTOOLS] force API_BASE=', local);
      }
    } catch (e) {}

    // [PATCH-KEEP-API-BASE-ONLAUNCH] capture manual API_BASE override (DevTools)
    try {
      const __b = wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '';
      if (__b) {
        wx.__API_BASE_OVERRIDE = __b;
        this.globalData = this.globalData || {};
        this.globalData.API_BASE = __b;
      }
    } catch (e) {}

    // [ADD] 统一接收分享/扫码携带的邀请码，落地 pendingInviteCode（供裂变页自动绑定）
    try {
      const q = (options && options.query) ? options.query : {};
      if (q && q.inviteCode) {
        wx.setStorageSync('pendingInviteCode', String(q.inviteCode).trim().toUpperCase());
      }

      // 预留：后续小程序码(getwxacodeunlimit)走 scene，同样落 pendingInviteCode
      // 兼容：有些入口会把 scene 放在 query.scene；也兼容 options.scene 为字符串时
      if (q && q.scene) {
        wx.setStorageSync('pendingInviteCode', decodeURIComponent(String(q.scene)).trim().toUpperCase());
      } else if (options && typeof options.scene === 'string' && options.scene) {
        wx.setStorageSync('pendingInviteCode', decodeURIComponent(String(options.scene)).trim().toUpperCase());
      }
    } catch (e) {}

    // 1) 启动时强制写入最新 API_BASE，彻底干掉旧缓存/旧兜底
    try {
      // 这里确保写入最新的生产环境地址
      try {
  const __keep = wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '';
  if (!__keep) wx.setStorageSync('apiBaseUrl', API_BASE);
} catch(e) {}
// [PATCH-KEEP-API-BASE]
 // 确保 API_BASE 是 https://api.entropyshield.com
      try {
  const __keep = wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '';
  if (!__keep) wx.setStorageSync('API_BASE', API_BASE);
} catch(e) {}
// [PATCH-KEEP-API-BASE]
    // 确保 API_BASE 是 https://api.entropyshield.com

      console.log('[BOOT] ENV=', ENV, 'platform=', runtime && runtime.platform, 'envVersion=', runtime && runtime.envVersion);
      console.log('[BOOT] API_BASE=', API_BASE); // 打印出 API_BASE，确保使用的是正确的后端地址
    } catch (e) {
      console.log('[BOOT] setStorage failed:', e);  // 错误处理
    }

    // 2) 健康检查：确认真机/预览/体验版是否成功访问线上域名
    try {
      // 确保健康检查请求的 URL 正确指向生产环境地址
      wx.request({
        url: API_BASE + '/api/health',  // 使用从 config.js 获取的 API_BASE 地址，确保正确指向后端接口
        method: 'GET',
        timeout: 10000,  // 设置请求超时为 10 秒
        success: (res) => {
          console.log('[BOOT] /api/health ok:', res.data); // 如果请求成功，打印响应数据
        },
        fail: (err) => {
          console.log('[BOOT] /api/health fail:', err);  // 如果请求失败，打印错误信息
          wx.showToast({
            title: '网络异常，请稍后重试',
            icon: 'none'
          });
        }
      });
    } catch (e) {
      console.log('[BOOT] health request exception:', e);  // 捕获请求异常
      wx.showToast({
        title: '健康检查失败，请稍后再试',
        icon: 'none'
      });
    }

    // 3) 你已有的逻辑（如果后续要加回去，放这里）
    // ... 你已有的逻辑 ...
    // [ADD-NAV-HOOK] FINISH_ON_REPORT_NAV
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
              var keys = Object.keys(logs || {}).filter(function(k){ return /^D[1-7]$/.test(k); });
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
                url: base + '/api/fission/camp/finish',
                method: 'POST',
                header: { 'content-type': 'application/json' },
                data: { clientId: clientId },
                success: function(res){ console.log('[NAV-HOOK] camp/finish resp:', res.data); },
                fail: function(err){ console.error('[NAV-HOOK] camp/finish fail:', err); }
              });
            }

            // inviter guard：若本地没写入，自动拉 profile 补齐 invited_by_code 再触发
            var invitedBy = wx.getStorageSync('fissionInvitedByCode') || '';
            if (!invitedBy) {
              if (wx.__campFinishInviterHydrating) return;
              wx.__campFinishInviterHydrating = true;

              wx.request({
                url: base + '/api/fission/profile?clientId=' + encodeURIComponent(clientId),
                method: 'GET',
                success: function(r) {
                  try {
                    var prof = r && r.data && (r.data.profile || r.data.user);
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
                fail: function() {
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
        // [ADD-NAV-HOOK] EXPOSE_FINISH_FN
        // 允许页面直达/编译直达时手动触发同一套逻辑
        wx.__tryFinishRewardOnReportNav = _tryFinishRewardOnReportNav;


        // hook navigateTo / redirectTo / reLaunch
        const _nav = wx.navigateTo;
        wx.navigateTo = function(opts) {
          try { _tryFinishRewardOnReportNav(opts && opts.url); } catch (e) {}
          return _nav.call(wx, opts);
        };

        const _red = wx.redirectTo;
        wx.redirectTo = function(opts) {
          try { _tryFinishRewardOnReportNav(opts && opts.url); } catch (e) {}
          return _red.call(wx, opts);
        };

        const _rel = wx.reLaunch;
        wx.reLaunch = function(opts) {
          try { _tryFinishRewardOnReportNav(opts && opts.url); } catch (e) {}
          return _rel.call(wx, opts);
        };
      }
    } catch (e) {
      console.log('[NAV-HOOK] install failed:', e);
    }

  
    // [PATCH-KEEP-API-BASE-ONLAUNCH] restore override after app boot (avoid being overwritten on compile)
    try {
      const __b2 = wx.__API_BASE_OVERRIDE || wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '';
      if (__b2) {
        try {
  const __keep = wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '';
  if (!__keep) wx.setStorageSync('API_BASE', __b2);
} catch(e) {}
// [PATCH-KEEP-API-BASE]

        try {
  const __keep = wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '';
  if (!__keep) wx.setStorageSync('apiBaseUrl', __b2);
} catch(e) {}
// [PATCH-KEEP-API-BASE]

        this.globalData = this.globalData || {};
        this.globalData.API_BASE = __b2;
      }
    } catch (e) {}
  },

  globalData: {
    // 统一使用 config.js 解析后的 API_BASE（DevTools=本地3000；真机=线上https）
    baseUrl: API_BASE  // 这里会自动使用正确的生产地址
  }
});

// --- 防止代码依赖分析忽略管理端页面（开发环境用）---
// 如果不需要管理端页面的逻辑，下面的代码可以删除
if (false) {
  require('./pages/visitAdmin/index.js');
}