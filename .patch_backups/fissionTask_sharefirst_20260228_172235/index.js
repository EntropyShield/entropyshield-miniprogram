// pages/fissionTask/index.js
const cfg = require('../../config');
// [PATCH-USE-OPENID-CLIENTID] 用 utils/clientId.js 的 openid 作为 clientId（异步）
const clientIdUtil = require('../../utils/clientId');

function getApiBase() {
  // [PATCH-API-BASE-PRIORITY] 优先读 Storage，其次 globalData，再其次 config
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
    (gd && (gd.API_BASE || gd.baseUrl)) ||
    cfg.API_BASE ||
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

function parseInviteFromOptions(opt) {
  opt = opt || {};
  let v = opt.inviteCode || opt.invite_code || opt.ic || opt.scene || '';
  try { v = decodeURIComponent(v); } catch (e) {}
  v = String(v || '').trim();

  const m = v.match(/(?:^|[?&])(i|inviteCode)=([^&]+)/i);
  if (m && m[2]) v = m[2];

  v = String(v || '').trim().toUpperCase();
  v = v.replace(/[^0-9A-Z]/g, '');
  return v;
}

function requestJson(method, url, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      method,
      url,
      data,
      timeout: 10000,
      header: { 'Content-Type': 'application/json' },
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    });
  });
}

// [PATCH-FALLBACK-ST] 若 openid 登录失败，兜底生成 ST-xxx，避免页面卡死（但正常应走 openid）
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

Page({
  data: {
    statusText: 'ready',
    clientId: '',
    incomingInviteCode: '',
    myInviteCode: '',
    qrcodeUrl: ''
  },

  // [PATCH-ASYNC-ONLOAD] onLoad 改为 async：先拿 openid(clientId) → 再 init → 再 bind
  async onLoad(options) {
    this._envVersion = getEnvVersion();

    // 1) 收集 incoming（query）并写入 pendingInviteCode（同时兼容 app.js 已写入的 scene）
    const incomingFromOpt = parseInviteFromOptions(options);
    if (incomingFromOpt) {
      try { wx.setStorageSync('pendingInviteCode', incomingFromOpt); } catch (e) {}
    }

    let pending = '';
    try { pending = wx.getStorageSync('pendingInviteCode') || ''; } catch (e) {}
    pending = String(pending || '').trim().toUpperCase();

    // 2) 确保 clientId = openid（优先），失败兜底 ST
    this.setData({ statusText: 'getting clientId...' });

    let clientId = '';
    try {
      // 注意：utils/clientId.ensureClientId 会调用 wx.login + /api/wx/login
      clientId = await clientIdUtil.ensureClientId(false);
    } catch (e) {
      clientId = fallbackClientIdST();
    }

    this.setData({
      clientId,
      incomingInviteCode: pending || '',
      statusText: pending ? 'incoming invite detected' : 'no incoming invite'
    });

    // 3) init + bind（如有 pending）
    await this.initFission(pending);
  },

  // [PATCH-INIT-GUARD] 防止并发重复 init
  async initFission(pendingInviteCode) {
    if (this._initing) return;
    this._initing = true;

    const API_BASE = getApiBase();
    if (!API_BASE) {
      this.setData({ statusText: 'API_BASE missing' });
      this._initing = false;
      return;
    }

    // clientId 从 data 取（已确保）
    const clientId = (this.data.clientId || '').trim() || fallbackClientIdST();

    let pending = String(pendingInviteCode || '').trim().toUpperCase();
    if (!pending) {
      try { pending = String(wx.getStorageSync('pendingInviteCode') || '').trim().toUpperCase(); } catch (e) {}
    }

    this.setData({ statusText: 'initializing...' });

    try {
      // [PATCH-AUTO-INIT] 无论是否有 pending，都必须 init（真机避免 profile:null）
      const res = await requestJson('POST', API_BASE + '/api/fission/init', { clientId });

      const d = (res && res.data) ? res.data : {};
      const p = d.profile || null;

      if (!d.ok || !p) {
        this.setData({ statusText: 'init failed (backend returned no profile)' });
        this._initing = false;
        return;
      }

      const my = String(p.invite_code || '').trim().toUpperCase();
      if (my) {
        this.setData({ myInviteCode: my, statusText: 'init ok' });
        this.refreshQrcode();
      } else {
        this.setData({ statusText: 'init ok (no invite_code)' });
      }

      // 若已绑定则落地缓存（便于其他模块复用）
      const alreadyBound = String(p.invited_by_code || '').trim().toUpperCase();
      if (alreadyBound) {
        try { wx.setStorageSync('fissionInvitedByCode', alreadyBound); } catch (e) {}
      }

      // [PATCH-AUTO-BIND] 有 pending 才 bind；若已绑定同码则清 pending
      if (pending) {
        if (alreadyBound && alreadyBound === pending) {
          try { wx.removeStorageSync('pendingInviteCode'); } catch (e) {}
          this.setData({ statusText: 'already bound' });
        } else if (!alreadyBound) {
          await this.tryBindInvite(pending);
        } else {
          // 已绑定别的码，不再覆盖
          this.setData({ statusText: 'already bound (different inviter)' });
          try { wx.removeStorageSync('pendingInviteCode'); } catch (e) {}
        }
      }
    } catch (e) {
      this.setData({ statusText: 'init request failed' });
    } finally {
      this._initing = false;
    }
  },

  async tryBindInvite(inviteCode) {
    const API_BASE = getApiBase();
    if (!API_BASE) return;

    const clientId = (this.data.clientId || '').trim() || fallbackClientIdST();
    inviteCode = String(inviteCode || '').trim().toUpperCase();
    if (!inviteCode) return;

    try {
      const r = await requestJson('POST', API_BASE + '/api/fission/bind', { clientId, inviteCode });
      const d = (r && r.data) ? r.data : {};
      const p = d.profile || null;

      if (d.ok && d.bound && p) {
        const code = String(p.invited_by_code || '').trim().toUpperCase();
        if (code) {
          try { wx.setStorageSync('fissionInvitedByCode', code); } catch (e) {}
        }
        try { wx.removeStorageSync('pendingInviteCode'); } catch (e) {}
        this.setData({ statusText: 'bind ok' });
      } else {
        this.setData({ statusText: 'bind attempted' });
      }
    } catch (e) {
      this.setData({ statusText: 'bind failed' });
    }
  },

  refreshQrcode() {
    const API_BASE = getApiBase();
    const code = (this.data.myInviteCode || '').trim().toUpperCase();
    if (!API_BASE || !code) return;

    const env = this._envVersion || 'release';
    const url = API_BASE + '/api/fission/qrcode?inviteCode=' + encodeURIComponent(code) +
      '&env_version=' + encodeURIComponent(env) + '&t=' + Date.now();
    this.setData({ qrcodeUrl: url });
  },

  copyInviteCode() {
    const code = (this.data.myInviteCode || '').trim();
    if (!code) {
      wx.showToast({ title: 'no invite code', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: code,
      success: () => wx.showToast({ title: 'copied', icon: 'none' }),
      fail: () => wx.showToast({ title: 'copy failed', icon: 'none' })
    });
  }
});