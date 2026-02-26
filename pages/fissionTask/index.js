const cfg = require('../../config');

function getApiBase() {
  const app = getApp ? getApp() : null;
  const gd = app && app.globalData ? app.globalData : null;
  const base = (gd && gd.API_BASE) || cfg.API_BASE || cfg.PROD_API_BASE || cfg.DEV_API_BASE || '';
  return String(base || '').replace(/\/$/, '');
}

function getEnvVersion() {
  try {
    const info = wx.getAccountInfoSync && wx.getAccountInfoSync();
    const v = info && info.miniProgram && info.miniProgram.envVersion;
    if (v === 'develop' || v === 'trial' || v === 'release') return v;
  } catch(e) {}
  return 'release';
}

function parseInviteFromOptions(opt) {
  opt = opt || {};
  let v = opt.inviteCode || opt.invite_code || opt.ic || opt.scene || '';
  try { v = decodeURIComponent(v); } catch(e) {}
  v = String(v || '').trim();

  // support: "i=XXXX"
  const m = v.match(/(?:^|[?&])(i|inviteCode)=([^&]+)/i);
  if (m && m[2]) v = m[2];

  v = String(v || '').trim().toUpperCase();
  v = v.replace(/[^0-9A-Z]/g, '');
  return v;
}

function ensureClientId() {
  const key = 'clientId';
  let v = '';
  try { v = wx.getStorageSync(key) || ''; } catch(e) {}
  v = String(v || '').trim();
  if (v) return v;

  const rnd = Math.floor(Math.random() * 900000 + 100000);
  v = 'ST-' + Date.now() + '-' + rnd;
  try { wx.setStorageSync(key, v); } catch(e) {}
  return v;
}

function requestJson(method, url, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      method,
      url,
      data,
      header: { 'Content-Type': 'application/json' },
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    });
  });
}

Page({
  data: {
    statusText: 'ready',
    clientId: '',
    incomingInviteCode: '',
    myInviteCode: '',
    qrcodeUrl: ''
  },

  onLoad(options) {
    const clientId = ensureClientId();
    const incoming = parseInviteFromOptions(options);
    if (incoming) {
      try { wx.setStorageSync('pendingInviteCode', incoming); } catch(e) {}
    }

    this._envVersion = getEnvVersion();

    this.setData({
      clientId,
      incomingInviteCode: incoming || '',
      statusText: incoming ? 'incoming invite detected' : 'no incoming invite'
    });

    this.initFission();
  },

  async initFission() {
    const API_BASE = getApiBase();
    if (!API_BASE) {
      this.setData({ statusText: 'API_BASE missing' });
      return;
    }

    const clientId = ensureClientId();
    let pending = '';
    try { pending = wx.getStorageSync('pendingInviteCode') || ''; } catch(e) {}
    pending = String(pending || '').trim().toUpperCase();

    this.setData({ statusText: 'initializing...' });

    try {
      // backend may ignore inviteCode; keep it schema-adaptive
      const res = await requestJson('POST', API_BASE + '/api/fission/init', { clientId, inviteCode: pending });

      const d = res && res.data ? res.data : {};

      const p = d.profile || {};
      const my = (d.inviteCode || d.invite_code || d.code || p.inviteCode || p.invite_code || p.invite_code || '').toString().trim().toUpperCase();
      if (d.ok && my) {
        this.setData({ myInviteCode: my, statusText: 'init ok' });
        this.refreshQrcode();
        if (pending) this.tryBindInvite(pending);
      } else {
        this.setData({ statusText: 'init failed (check backend response)' });
      }
    } catch (e) {
      this.setData({ statusText: 'init request failed' });
    }
  },

  async tryBindInvite(inviteCode) {
    const API_BASE = getApiBase();
    if (!API_BASE) return;
    const clientId = ensureClientId();
    inviteCode = String(inviteCode || '').trim().toUpperCase();
    if (!inviteCode) return;

    try {
      await requestJson('POST', API_BASE + '/api/fission/bind', { clientId, inviteCode });
      this.setData({ statusText: 'bind attempted' });
    } catch(e) {
      // ignore bind error; init may already bind on backend
    }
  },

  refreshQrcode() {
    const API_BASE = getApiBase();
    const code = (this.data.myInviteCode || '').trim().toUpperCase();
    if (!API_BASE || !code) return;

    const env = this._envVersion || 'release';
    const url = API_BASE + '/api/fission/qrcode?inviteCode=' + encodeURIComponent(code) + '&env_version=' + encodeURIComponent(env) + '&t=' + Date.now();
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