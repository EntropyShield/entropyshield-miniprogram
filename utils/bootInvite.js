// utils/bootInvite.js —— P0 扫码进入即绑定邀请关系（不付费也绑定）
const { appDebug } = require('./bootDebug');

function getApiBase() {
  try {
    const cfg = require('../config');
    return cfg.API_BASE || cfg.API_BASE_URL || cfg.PROD_API_BASE || cfg.DEV_API_BASE || '';
  } catch (e) {}
  try {
    const app = getApp && getApp();
    const g = app && app.globalData ? app.globalData : {};
    return g.API_BASE || g.API_BASE_URL || '';
  } catch (e) {}
  return '';
}

function extractInviteCode(options) {
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

function capturePendingInvite(options) {
  const code = extractInviteCode(options);
  if (!code) return '';
  try {
    const old = wx.getStorageSync('pendingInviteCode');
    if (!old) wx.setStorageSync('pendingInviteCode', code);
  } catch (e) {}
  return code;
}

function clearRetry(inviteCode) {
  const waitKey = '__st_bind_wait_' + String(inviteCode || '');
  try { wx.removeStorageSync(waitKey); } catch (e) {}
  try { wx.removeStorageSync('pendingInviteCode'); } catch (e) {}
}

function scheduleRetry(inviteCode) {
  const waitKey = '__st_bind_wait_' + String(inviteCode || '');
  const maxWait = 12;
  try {
    const n = Number(wx.getStorageSync(waitKey) || 0);
    if (n >= maxWait) return;
    wx.setStorageSync(waitKey, n + 1);
    setTimeout(tryBindInviteOnce, 3000);
  } catch (e) {
    try { setTimeout(tryBindInviteOnce, 3000); } catch (e2) {}
  }
}

function tryBindInviteOnce() {
  const apiBase = getApiBase();
  const cid = wx.getStorageSync('clientId') || wx.getStorageSync('openid');
  const inviteCode = wx.getStorageSync('pendingInviteCode');

  if (!inviteCode) return;
  if (!apiBase || !cid) { scheduleRetry(inviteCode); return; }
  if (String(cid).startsWith('ST-')) { scheduleRetry(inviteCode); return; }

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
            clearRetry(inviteCode);
          } else if (selfBind) {
            clearRetry(inviteCode);
          } else {
            scheduleRetry(inviteCode);
          }
          appDebug('[ST_BIND_V2] resp', { cid, inviteCode, d, selfBind, already });
        },
        fail(err) {
          appDebug('[ST_BIND_V2] fail', { cid, inviteCode, err });
          scheduleRetry(inviteCode);
        }
      });
    },
    fail(err) {
      appDebug('[ST_INIT_BEFORE_BIND] fail', { cid, inviteCode, err });
      scheduleRetry(inviteCode);
    }
  });
}

module.exports = { extractInviteCode, capturePendingInvite, tryBindInviteOnce };
