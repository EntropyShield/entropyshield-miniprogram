// pages/fissionTask/index.js
// MOD: P1_4_GROWTH_CENTER_LINKAGE_20260323

let cfg = {};
try { cfg = require('../../config'); } catch (e) { cfg = {}; }

let clientIdUtil = null;
try { clientIdUtil = require('../../utils/clientId'); } catch (e) { clientIdUtil = null; }

// ===== 防白屏工具 =====
function safeSetData(ctx, patch) { try { ctx.setData(patch); } catch (e) {} }
function setPageError(ctx, where, err) {
  const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
  console.error('[fissionTask][ERROR]', where || 'unknown', msg);
  safeSetData(ctx, {
    pageError: msg,
    pageErrorWhere: where || 'unknown',
    pageLoading: false,
    statusText: '页面异常（已拦截，避免白屏）'
  });
}

// ===== 基础函数 =====
function getApiBase() {
  try {
    const s1 = wx.getStorageSync('API_BASE') || '';
    if (s1) return String(s1).replace(/\/$/, '');
  } catch (e) {}

  try {
    const s2 = wx.getStorageSync('apiBaseUrl') || '';
    if (s2) return String(s2).replace(/\/$/, '');
  } catch (e) {}

  const app = getApp ? getApp() : null;
  const gd = app && app.globalData ? app.globalData : null;
  const base =
    (gd && (gd.API_BASE || gd.baseUrl || gd.API_BASE_URL)) ||
    cfg.API_BASE ||
    cfg.API_BASE_URL ||
    cfg.PROD_API_BASE ||
    cfg.DEV_API_BASE ||
    '';

  return String(base || '').replace(/\/$/, '');
}

function getEnvVersion() {
  try {
    const info = wx.getAccountInfoSync && wx.getAccountInfoSync();
    const v = info && info.miniProgram && info.miniProgram.envVersion;
    if (v === 'develop' || v === 'trial' || v === 'release') return v;
  } catch (e) {}
  return 'release';
}

function cleanCode(v) {
  try { v = decodeURIComponent(v); } catch (e) {}
  v = String(v || '').trim().toUpperCase();
  v = v.replace(/[^0-9A-Z]/g, '');
  return v;
}

// scene 可能是纯邀请码，也可能是 "inviteCode=xxxx"
function parseInviteFromOptions(opt) {
  opt = opt || {};
  let v = opt.inviteCode || opt.invite_code || opt.ic || opt.scene || '';
  try { v = decodeURIComponent(v); } catch (e) {}
  v = String(v || '').trim();

  const m = v.match(/(?:^|[?&])(inviteCode|ic)=([^&]+)/i);
  if (m && m[2]) v = m[2];

  return cleanCode(v);
}

function requestJson(method, url, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      method,
      url,
      data,
      timeout: 12000,
      header: { 'Content-Type': 'application/json' },
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    });
  });
}

function requestGet(url) {
  return new Promise((resolve, reject) => {
    wx.request({
      method: 'GET',
      url,
      timeout: 12000,
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    });
  });
}

function fallbackClientIdST() {
  const key = 'clientId';
  let v = '';
  try { v = wx.getStorageSync(key) || ''; } catch (e) {}
  v = String(v || '').trim();
  if (v) return v;

  const rnd = Math.floor(Math.random() * 900000 + 100000);
  v = 'ST-' + Date.now() + '-' + rnd;
  try { wx.setStorageSync(key, v); } catch (e) {}
  return v;
}

function persistGrowthSnapshot(profile, totalRewardTimes, myInviteCode, invitedByCode) {
  try {
    const oldProf = wx.getStorageSync('fissionProfile') || {};
    wx.setStorageSync('fissionProfile', Object.assign({}, oldProf, profile || {}, {
      invite_code: myInviteCode || oldProf.invite_code || '',
      inviteCode: myInviteCode || oldProf.inviteCode || '',
      invited_by_code: invitedByCode || oldProf.invited_by_code || '',
      invitedByCode: invitedByCode || oldProf.invitedByCode || '',
      total_reward_times: Number(totalRewardTimes || 0) || 0,
      totalRewardTimes: Number(totalRewardTimes || 0) || 0
    }));
  } catch (e) {
    console.warn('[fissionTask] persist fissionProfile fail:', e);
  }

  try {
    const ur = wx.getStorageSync('userRights') || {};
    if (myInviteCode) ur.inviteCode = myInviteCode;
    if (invitedByCode) ur.invitedByCode = invitedByCode;
    ur.fissionSyncedTimes = Number(totalRewardTimes || 0) || 0;
    wx.setStorageSync('userRights', ur);
  } catch (e) {
    console.warn('[fissionTask] persist userRights fail:', e);
  }

  try {
    if (invitedByCode) wx.setStorageSync('fissionInvitedByCode', invitedByCode);
  } catch (e) {}
}

Page({
  data: {
    pageLoading: true,
    pageError: '',
    pageErrorWhere: '',

    statusText: '',
    clientId: '',
    incomingInviteCode: '',
    myInviteCode: '',
    invitedByCode: '',
    totalRewardTimes: 0,
    qrcodeUrl: '',
    debug: false
  },

  toggleDebug() {
    safeSetData(this, { debug: !this.data.debug });
  },

  onRetry() {
    try {
      const pending = cleanCode(this.data.incomingInviteCode || '');
      this.initAndRefresh(pending);
    } catch (e) {
      setPageError(this, 'onRetry', e);
    }
  },

  async onLoad(options) {
    safeSetData(this, {
      pageLoading: true,
      pageError: '',
      pageErrorWhere: '',
      statusText: '加载中…'
    });

    try {
      this._envVersion = getEnvVersion();

      const incomingFromOpt = parseInviteFromOptions(options);
      if (incomingFromOpt) {
        try { wx.setStorageSync('pendingInviteCode', incomingFromOpt); } catch (e) {}
      }

      let pending = '';
      try { pending = wx.getStorageSync('pendingInviteCode') || ''; } catch (e) {}
      pending = cleanCode(pending);

      let clientId = '';
      if (clientIdUtil && typeof clientIdUtil.ensureClientId === 'function') {
        try { clientId = await clientIdUtil.ensureClientId(false); } catch (e) { clientId = ''; }
      }
      clientId = String(clientId || '').trim();
      if (!clientId) clientId = fallbackClientIdST();

      safeSetData(this, { clientId, incomingInviteCode: pending || '' });

      await this.initAndRefresh(pending);
    } catch (e) {
      setPageError(this, 'onLoad', e);
    } finally {
      safeSetData(this, { pageLoading: false });
    }
  },

  async initAndRefresh(pendingInviteCode) {
    const API_BASE = getApiBase();
    if (!API_BASE) {
      safeSetData(this, { statusText: 'API_BASE 为空：请检查 config.js / app.js 的 API_BASE 配置' });
      return;
    }

    const clientId = String(this.data.clientId || '').trim() || fallbackClientIdST();

    let pending = cleanCode(pendingInviteCode);
    if (!pending) {
      try { pending = cleanCode(wx.getStorageSync('pendingInviteCode') || ''); } catch (e) {}
    }

    safeSetData(this, { statusText: '初始化裂变档案…' });

    try {
      await requestJson('POST', API_BASE + '/api/fission/init', {
        clientId,
        inviteCode: pending || ''
      });
    } catch (e) {
      setPageError(this, 'request:/api/fission/init', e);
      return;
    }

    safeSetData(this, { statusText: '拉取裂变档案…' });

    let prof = null;
    let totalRewardTimes = 0;

    try {
      const r = await requestGet(API_BASE + '/api/fission/profile?clientId=' + encodeURIComponent(clientId));
      const d = r && r.data ? r.data : {};
      prof = d.profile || (d.data && d.data.profile) || null;

      totalRewardTimes = Number(
        d.total_reward_times ??
        d.totalRewardTimes ??
        (prof ? prof.total_reward_times : 0) ??
        0
      ) || 0;
    } catch (e) {
      setPageError(this, 'request:/api/fission/profile', e);
      return;
    }

    if (!prof) {
      safeSetData(this, { statusText: 'profile 为空，请稍后重试' });
      return;
    }

    const my = cleanCode(prof.invite_code || prof.inviteCode || '');
    const invitedBy = cleanCode(prof.invited_by_code || prof.invitedByCode || '');

    persistGrowthSnapshot(prof, totalRewardTimes, my, invitedBy);

    safeSetData(this, {
      myInviteCode: my,
      invitedByCode: invitedBy,
      totalRewardTimes
    });

    if (my) this.refreshQrcode();

    safeSetData(this, {
      statusText: invitedBy ? '已建立邀请关系，可直接分享' : '可直接一键分享'
    });
  },

  refreshQrcode() {
    const API_BASE = getApiBase();
    const code = cleanCode(this.data.myInviteCode);
    if (!API_BASE || !code) return;

    const env = this._envVersion || 'release';
    const url =
      API_BASE +
      '/api/fission/qrcode?inviteCode=' + encodeURIComponent(code) +
      '&env_version=' + encodeURIComponent(env) +
      '&t=' + Date.now();

    safeSetData(this, { qrcodeUrl: url });
  },

  onShareAppMessage() {
    const code = cleanCode(this.data.myInviteCode);
    return {
      title: '熵盾训练营',
      path: '/pages/campIntro/index?inviteCode=' + encodeURIComponent(code || '')
    };
  },

  onShareTimeline() {
    const code = cleanCode(this.data.myInviteCode);
    return {
      title: '熵盾训练营',
      query: 'inviteCode=' + encodeURIComponent(code || '')
    };
  },

  goGrowthCenter() {
    wx.navigateTo({
      url: '/pages/commissionCenter/index?from=fissionTask'
    });
  },

  goCamp() {
    wx.navigateTo({
      url: '/pages/campIntro/index',
      fail: () => wx.switchTab({ url: '/pages/index/index' })
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});