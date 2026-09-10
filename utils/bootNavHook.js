// utils/bootNavHook.js —— 训练营结营页导航钩子，自动触发 /api/fission/camp/finish
const { appDebug } = require('./bootDebug');

function tryFinishRewardOnReportNav(url) {
  try {
    if (!url || typeof url !== 'string') return;
    if (url.indexOf('/pkgChallenge/campReport/index') === -1) return;
    if (wx.__campFinishNavDone) return;

    let done7 = false;
    const doneMap = wx.getStorageSync('campFinishedMap') || {};
    done7 = !!(doneMap.D7 || doneMap['D7'] || (Object.keys(doneMap || {}).length >= 7));
    if (!done7) {
      const logs = wx.getStorageSync('campDailyLogs') || {};
      const keys = Object.keys(logs || {}).filter(function (k) { return /^D[1-7]$/.test(k); });
      done7 = keys.length >= 7;
    }
    if (!done7) return;

    const base = String(wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '').replace(/\/$/, '');
    const clientId = wx.getStorageSync('clientId') || '';
    if (!base || !clientId) return;

    function sendFinish() {
      if (wx.__campFinishNavDone) return;
      wx.__campFinishNavDone = true;
      wx.request({
        url: base + '/api/fission/camp/finish',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { clientId: clientId },
        success: function (res) { appDebug('[NAV-HOOK] camp/finish resp:', res && res.data); },
        fail: function (err) { console.error('[NAV-HOOK] camp/finish fail:', err); }
      });
    }

    let invitedBy = wx.getStorageSync('fissionInvitedByCode') || '';
    if (!invitedBy) {
      if (wx.__campFinishInviterHydrating) return;
      wx.__campFinishInviterHydrating = true;
      wx.request({
        url: base + '/api/fission/profile?clientId=' + encodeURIComponent(clientId),
        method: 'GET',
        success: function (r) {
          try {
            const prof = r && r.data && (r.data.profile || r.data.user || r.data.data);
            let code = '';
            if (prof) code = prof.invited_by_code || prof.invitedByCode || '';
            code = code ? String(code).trim().toUpperCase() : '';
            if (code) {
              wx.setStorageSync('fissionInvitedByCode', code);
              invitedBy = code;
            }
            if (!invitedBy) return;
            sendFinish();
          } finally {
            wx.__campFinishInviterHydrating = false;
          }
        },
        fail: function () { wx.__campFinishInviterHydrating = false; }
      });
      return;
    }
    sendFinish();
  } catch (e) { appDebug('[NAV-HOOK] err:', e); }
}

function installCampNavHook() {
  if (wx.__finishNavHookInstalled) return;
  wx.__finishNavHookInstalled = true;
  wx.__tryFinishRewardOnReportNav = tryFinishRewardOnReportNav;

  const _nav = wx.navigateTo;
  wx.navigateTo = function (opts) { try { tryFinishRewardOnReportNav(opts && opts.url); } catch (e) {} return _nav.call(wx, opts); };
  const _red = wx.redirectTo;
  wx.redirectTo = function (opts) { try { tryFinishRewardOnReportNav(opts && opts.url); } catch (e) {} return _red.call(wx, opts); };
  const _rel = wx.reLaunch;
  wx.reLaunch = function (opts) { try { tryFinishRewardOnReportNav(opts && opts.url); } catch (e) {} return _rel.call(wx, opts); };
}

module.exports = { installCampNavHook };
