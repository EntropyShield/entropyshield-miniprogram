// utils/bootProfileSync.js —— 启动时登录 + 权益 + 裂变档案一次性同步
const { appDebug } = require('./bootDebug');
const { syncServerAuthoritativeRights } = require('./bootRights');

function mergeRights(profile) {
  try {
    const cur = wx.getStorageSync('userRights');
    const curObj = (cur && typeof cur === 'object') ? cur : {};
    const ur = Object.assign({}, curObj);

    const freeRaw = (profile && (profile.total_reward_times || profile.totalRewardTimes || profile.free_calc_times || profile.freeCalcTimes)) || ur.freeCalcTimes || 0;
    const free = Number(freeRaw) || 0;
    ur.freeCalcTimes = Math.max(Number(ur.freeCalcTimes || 0), free);

    const inviteCode = String((profile && (profile.invite_code || profile.inviteCode)) || '').trim().toUpperCase();
    const invitedByCode = String((profile && (profile.invited_by_code || profile.invitedByCode)) || '').trim().toUpperCase();
    if (inviteCode) ur.inviteCode = inviteCode;
    if (invitedByCode) ur.invitedByCode = invitedByCode;

    wx.setStorageSync('userRights', ur);

    const bootProfile = Object.assign({}, profile || {}, {
      inviteCode: inviteCode,
      invite_code: inviteCode,
      invitedByCode: invitedByCode,
      invited_by_code: invitedByCode
    });
    wx.setStorageSync('fissionProfile', bootProfile);
    appDebug('[BOOT][SYNC] merged userRights:', ur);
  } catch (e) {
    appDebug('[BOOT][SYNC] merge error:', e);
  }
}

function fetchProfileAndMerge(base, clientId, scene) {
  syncServerAuthoritativeRights(clientId, scene);
  wx.request({
    url: base + '/api/fission/profile?clientId=' + encodeURIComponent(clientId),
    method: 'GET',
    timeout: 10000,
    success: (r) => {
      try {
        const body = r && r.data ? r.data : {};
        if (!body || body.ok === false) return;
        const p = body.profile || body.data || body;
        const total = (body.total_reward_times || body.totalRewardTimes || (p && (p.total_reward_times || p.totalRewardTimes)) || 0);
        const profile = p ? Object.assign({}, p, { total_reward_times: total }) : { total_reward_times: total };
        mergeRights(profile);
      } catch (e) {}
    },
    fail: (e) => appDebug('[BOOT][SYNC] profile fail:', e)
  });
}

function syncByClientId(base, clientId, scene) {
  if (!clientId) return;
  wx.setStorageSync('clientId', clientId);
  fetchProfileAndMerge(base, clientId, scene);
}

function syncProfileAndRights({ base, scene }) {
  if (wx.__bootSyncProfileDone) return;
  wx.__bootSyncProfileDone = true;

  const cid0 = wx.getStorageSync('clientId') || '';
  if (cid0 && /^o[A-Za-z0-9_-]+$/.test(cid0)) {
    syncByClientId(base, cid0, scene || 'app_launch');
    return;
  }

  wx.login({
    success: (r) => {
      if (!r || !r.code) return;
      wx.request({
        url: base + '/api/wx/login?code=' + encodeURIComponent(r.code),
        method: 'POST',
        header: { 'content-type': 'application/json' },
        success: (res) => {
          const d = (res && res.data && (res.data.data || res.data)) || {};
          const openid = d.openid || d.openId;
          if (openid) {
            wx.setStorageSync('clientId', openid);
            appDebug('[BOOT] clientId(openid)=', openid);
            syncByClientId(base, openid, scene || 'app_login_refresh');
          }
        },
        fail: (e) => appDebug('[BOOT] /api/wx/login request fail:', e)
      });
    },
    fail: (e) => appDebug('[BOOT] wx.login fail:', e)
  });
}

module.exports = { syncProfileAndRights };
