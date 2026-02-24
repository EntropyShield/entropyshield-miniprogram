
// ===================== [ADD] QR_API_BASE_HELPER BEGIN =====================
const __CFG__ = require('../../config');
function __QR_API_BASE__() {
  const app = getApp ? getApp() : null;
  const gd = app && app.globalData ? app.globalData : null;
  const base = (gd && gd.API_BASE) || __CFG__.API_BASE || __CFG__.PROD_API_BASE || __CFG__.DEV_API_BASE || '';
  return String(base || '').replace(/\/$/, '');
}
function __QR_URL__(inviteCode) {
  const b = __QR_API_BASE__();
  const t = Date.now();
  return b + '/api/fission/qrcode?inviteCode=' + encodeURIComponent(inviteCode) + '&t=' + t;
}
// ===================== [ADD] QR_API_BASE_HELPER END =====================

// pages/fissionTask/index.js
const { API_BASE } = require('../../config');

function ensureClientId() {
  let cid = wx.getStorageSync('clientId');
  if (!cid) {
    cid = 'ST-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
    wx.setStorageSync('clientId', cid);
  }
  return cid;
}
function upperTrim(v) { return String(v || '').trim().toUpperCase(); }
function baseUrl() { return String(API_BASE || '').replace(/\/$/, ''); }

function unwrap(x) {
  let d = x || {};
  if (d && typeof d === 'object') {
    if (d.data && typeof d.data === 'object') d = d.data;
    else if (d.result && typeof d.result === 'object') d = d.result;
    else if (d.profile && typeof d.profile === 'object') d = d.profile;
  }
  return d || {};
}

function deepFindInviteCode(obj, depth = 0) {
  if (!obj || depth > 4) return '';
  if (typeof obj === 'string') {
    const s = upperTrim(obj);
    if (/^[A-Z0-9]{5,10}$/.test(s)) return s;
    return '';
  }
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const r = deepFindInviteCode(it, depth + 1);
      if (r) return r;
    }
    return '';
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      const lk = String(k).toLowerCase();
      if (typeof v === 'string' && (lk.includes('invite') || lk.includes('code'))) {
        const s = upperTrim(v);
        if (/^[A-Z0-9]{5,10}$/.test(s)) return s;
      }
    }
    for (const k of Object.keys(obj)) {
      const r = deepFindInviteCode(obj[k], depth + 1);
      if (r) return r;
    }
  }
  return '';
}

function normalizeQrcode(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') {
    let s = raw.trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || /^data:image\//i.test(s)) return s;
    if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 200) return 'data:image/png;base64,' + s;
    return s;
  }
  const d = unwrap(raw);
  let s = d.url || d.qrcodeUrl || d.qrUrl || d.data || '';
  if (typeof s !== 'string') return '';
  s = s.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s) || /^data:image\//i.test(s)) return s;
  if (/^[A-Za-z0-9+/=]+$/.test(s) && s.length > 200) return 'data:image/png;base64,' + s;
  return s;
}

Page({
  data: {
    clientId: '',
    inviteCode: '',
    qrcodeImage: '',
    bindInviteCode: '',
    bindLoading: false,
    loading: false,
    isDevtools: false,
  },

  onLoad() {
    const clientId = ensureClientId();
    // DevTools 环境简单判定
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    const isDevtools = sys.platform === 'devtools';

    this.setData({ clientId, isDevtools });
    this.initThenProfile();
  },

  initThenProfile() {
    this.initUser(() => this.fetchProfile());
  },

  initUser(done) {
    const base = baseUrl();
    const clientId = this.data.clientId;
    if (!base || !clientId) return done && done();

    wx.request({
      url: base + '/api/fission/init',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { clientId },
      success: (res) => {
        const code = deepFindInviteCode(res.data);
        if (code) {
          this.setData({ inviteCode: code });
          this.fetchQrcode(code);
        }
      },
      complete: () => done && done(),
    });
  },

  fetchProfile() {
    const base = baseUrl();
    const clientId = this.data.clientId;
    if (!base || !clientId) return;

    this.setData({ loading: true });
    wx.request({
      url: base + '/api/fission/profile?clientId=' + encodeURIComponent(clientId),
      method: 'GET',
      success: (res) => {
        const code = deepFindInviteCode(res.data);
        if (code) {
          this.setData({ inviteCode: code });
          this.fetchQrcode(code);
        }
      },
      complete: () => this.setData({ loading: false }),
    });
  },

  fetchQrcode(inviteCode) {
    const base = baseUrl();
    const code = upperTrim(inviteCode);
    if (!base || !code) return;

    wx.request({
      url: base + '/api/fission/qrcode?inviteCode=' + encodeURIComponent(code),
      method: 'GET',
      success: (res) => {
        const img = normalizeQrcode(res.data);
        if (img) this.setData({ qrcodeImage: img });
      },
    });
  },

  onInputBindCode(e) {
    this.setData({ bindInviteCode: upperTrim(e.detail && e.detail.value) });
  },

  onTapBind() {
    const base = baseUrl();
    const clientId = this.data.clientId;
    const inviteCode = upperTrim(this.data.bindInviteCode);

    console.log('[fissionTask] onTapBind', { clientId, inviteCode });

    if (!inviteCode) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    if (inviteCode === upperTrim(this.data.inviteCode)) {
      console.log('[fissionTask] self-invite blocked');
      wx.showToast({ title: '不能绑定自己的邀请码', icon: 'none' });
      return;
    }

    this.setData({ bindLoading: true });
    wx.request({
      url: base + '/api/fission/bind',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { clientId, inviteCode },
      success: (res) => {
        const d = unwrap(res.data);
        if (d.ok || d.success || res.data.ok || res.data.success) {
          wx.showToast({ title: '绑定成功', icon: 'success' });
          this.fetchProfile();
        } else {
          wx.showToast({ title: d.message || res.data.message || '绑定失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络错误', icon: 'none' }),
      complete: () => this.setData({ bindLoading: false }),
    });
  },

  
  onTapRefreshQrcode() {
    const inviteCode = (this.data && (this.data.myInviteCode || this.data.inviteCode)) || '';
    if (!inviteCode) {
      wx.showToast({ title: '邀请码生成中…', icon: 'none' });
      return;
    }
    const url = __QR_URL__(inviteCode);
    this.setData({ myQrPath: '' });

    wx.showLoading({ title: '生成二维码…' });
    wx.downloadFile({
      url,
      success: (r) => {
        if (r.statusCode === 200 && r.tempFilePath) {
          this.setData({ myQrPath: r.tempFilePath });
        } else {
          wx.showToast({ title: '二维码下载失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络错误', icon: 'none' }),
      complete: () => wx.hideLoading()
    });
  },


  onTapCopyInviteCode() {
    const code = upperTrim(this.data.inviteCode);
    if (!code) return wx.showToast({ title: '暂无邀请码', icon: 'none' });
    wx.setClipboardData({ data: code });
  },

  // DevTools 专用：一键切换身份（生成新的 clientId，相当于 B）
  onTapSwitchIdentity() {
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    if (sys.platform !== 'devtools') {
      wx.showToast({ title: '仅开发者工具可用', icon: 'none' });
      return;
    }
    wx.removeStorageSync('clientId');
    const cid = ensureClientId();
    this.setData({ clientId: cid, bindInviteCode: '' });
    wx.showToast({ title: '已切换为新身份(B)', icon: 'success' });
    this.initThenProfile();
  },
});