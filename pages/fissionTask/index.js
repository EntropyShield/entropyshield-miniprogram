
// ===================== [ADD] AUTO_BIND_FROM_SCENE_V1 BEGIN =====================
const __CFG_BIND__ = require('../../config');

function __BIND_API_BASE__() {
  const app = getApp ? getApp() : null;
  const gd = app && app.globalData ? app.globalData : null;
  const base = (gd && gd.API_BASE) || __CFG_BIND__.API_BASE || __CFG_BIND__.PROD_API_BASE || __CFG_BIND__.DEV_API_BASE || '';
  return String(base || '').replace(/\/$/, '');
}
function __BIND_URL__(path) { return __BIND_API_BASE__() + path; }

// 浠庢壂鐮佸弬鏁拌В鏋?inviteCode锛堜紭鍏?scene锛屽叾娆?inviteCode锛?
function __PARSE_INVITE_CODE__(options) {
  if (!options) return '';
  let v = options.scene || options.inviteCode || '';
  try { v = decodeURIComponent(v); } catch(e) {}
  v = String(v || '').trim();
  // 鍏煎 scene 鍙兘鏄?"i=XXXXXX"
  const m = v.match(/(?:^|[?&])(i|inviteCode)=([^&]+)/i);
  if (m && m[2]) v = m[2];
  v = String(v).trim().toUpperCase();
  // 鍙繚鐣欏瓧姣嶆暟瀛楋紝閬垮厤鑴忔暟鎹?
  v = v.replace(/[^0-9A-Z]/g, '');
  return v;
}

// 鑾峰彇褰撳墠鐢ㄦ埛 openid/clientId锛堜綘鍚庣鐢?openid 瀛楁锛屼絾鍓嶇涓€鑸彨 clientId锛?
function __GET_CLIENT_ID__() {
  const app = getApp ? getApp() : null;
  const gd = app && app.globalData ? app.globalData : null;
  return (gd && (gd.clientId || gd.openid)) || wx.getStorageSync('clientId') || wx.getStorageSync('openid') || '';
}
// ===================== [ADD] AUTO_BIND_FROM_SCENE_V1 END =====================


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

  
// ===== [P0-1] scene -> inviteCode 解析 START =====
function _safeDecode(v) {
  try { return decodeURIComponent(String(v || '')); } catch (e) { return String(v || ''); }
}
/**
 * scene 可能是：
 * 1) "TEST01"
 * 2) "inviteCode=TEST01"
 * 3) "inviteCode=TEST01&x=y"
 */
function parseInviteCodeFromScene(rawScene) {
  const s = _safeDecode(rawScene).trim();
  if (!s) return '';
  const m = s.match(/(?:inviteCode|invite_code|ic)=([^&]+)/i);
  if (m && m[1]) return m[1].trim();
  return s.split('&')[0].trim();
}
// ===== [P0-1] scene -> inviteCode 解析 END =====
Page({
  onShow() {
    // [ADD] AUTO_BIND_FROM_SCENE_ONSHOW
    this.__tryAutoBind__ && this.__tryAutoBind__('onShow');
  },

  pendingInviteCode: '',

  // ===================== [ADD] __tryAutoBind__ BEGIN =====================
  __tryAutoBind__(reason) {
    try {
      if (this.__bindingInvite__) return;
      const pending = (this.data && this.data.pendingInviteCode) || wx.getStorageSync('pendingInviteCode') || '';
      if (!pending) return;

      // 濡傛灉椤甸潰宸叉樉绀衡€滃凡缁戝畾閭€璇蜂汉鈥濓紝鐩存帴娓?pending
      if (this.data && this.data.hasBoundInviter) {
        wx.removeStorageSync('pendingInviteCode');
        this.setData({ pendingInviteCode: '' });
        return;
      }

      const clientId = String(__GET_CLIENT_ID__() || '').trim();
      if (!clientId) return; // 绛?profile/init 鎶?clientId 鍐欏叆 globalData 鍚庤嚜鍔ㄩ噸璇?

      const myCode = String((this.data && (this.data.myInviteCode || this.data.inviteCode)) || '').trim().toUpperCase();
      if (myCode && pending === myCode) {
        wx.removeStorageSync('pendingInviteCode');
        this.setData({ pendingInviteCode: '' });
        wx.showToast({ title: '涓嶈兘缁戝畾鑷繁', icon: 'none' });
        return;
      }

      this.__bindingInvite__ = true;

      wx.request({
        url: __BIND_URL__('/api/fission/bind'),
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: { clientId, inviteCode: pending },
        success: (res) => {
          const d = (res && res.data) || {};
          if (d.ok) {
            // 鍚庣宸茬‖鍖栵細bound / duplicated
            if (d.bound) wx.showToast({ title: '缁戝畾鎴愬姛', icon: 'success' });
            else if (d.duplicated) wx.showToast({ title: '宸茬粦瀹氳繃閭€璇蜂汉', icon: 'none' });

            // 娓?pending锛岄伩鍏嶅弽澶嶈Е鍙?
            wx.removeStorageSync('pendingInviteCode');
            this.setData({ pendingInviteCode: '' });

            // 鍙€夛細濡傛灉鍚庣杩斿洖 profile锛岀洿鎺ユ洿鏂伴〉闈㈢姸鎬?
            if (d.profile) {
              const invitedByCode = d.profile.invited_by_code || '';
              this.setData({
                hasBoundInviter: !!invitedByCode,
                invitedByCode
              });
            }
          } else {
            wx.showToast({ title: d.message || '缁戝畾澶辫触', icon: 'none' });
          }
        },
        fail: () => wx.showToast({ title: '缃戠粶閿欒', icon: 'none' }),
        complete: () => { this.__bindingInvite__ = false; }
      });
    } catch (e) {
      this.__bindingInvite__ = false;
    }
  },
  // ===================== [ADD] __tryAutoBind__ END =====================

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
    // DevTools 鐜绠€鍗曞垽瀹?
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
      wx.showToast({ title: '璇疯緭鍏ラ個璇风爜', icon: 'none' });
      return;
    }
    if (inviteCode === upperTrim(this.data.inviteCode)) {
      console.log('[fissionTask] self-invite blocked');
      wx.showToast({ title: '涓嶈兘缁戝畾鑷繁鐨勯個璇风爜', icon: 'none' });
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
          wx.showToast({ title: '缁戝畾鎴愬姛', icon: 'success' });
          this.fetchProfile();
        } else {
          wx.showToast({ title: d.message || res.data.message || '缁戝畾澶辫触', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '缃戠粶閿欒', icon: 'none' }),
      complete: () => this.setData({ bindLoading: false }),
    });
  },

  
  onTapRefreshQrcode() {
    const inviteCode = (this.data && (this.data.myInviteCode || this.data.inviteCode)) || '';
    if (!inviteCode) {
      wx.showToast({ title: '閭€璇风爜鐢熸垚涓€?, icon: 'none' });
      return;
    }
    const url = __QR_URL__(inviteCode);
    this.setData({ myQrPath: '' });

    wx.showLoading({ title: '鐢熸垚浜岀淮鐮佲€? });
    wx.downloadFile({
      url,
      success: (r) => {
        if (r.statusCode === 200 && r.tempFilePath) {
          this.setData({ myQrPath: r.tempFilePath });
        } else {
          wx.showToast({ title: '浜岀淮鐮佷笅杞藉け璐?, icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '缃戠粶閿欒', icon: 'none' }),
      complete: () => wx.hideLoading()
    });
  },


  onTapCopyInviteCode() {
    const code = upperTrim(this.data.inviteCode);
    if (!code) return wx.showToast({ title: '鏆傛棤閭€璇风爜', icon: 'none' });
    wx.setClipboardData({ data: code });
  },

  // DevTools 涓撶敤锛氫竴閿垏鎹㈣韩浠斤紙鐢熸垚鏂扮殑 clientId锛岀浉褰撲簬 B锛?
  onTapSwitchIdentity() {
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    if (sys.platform !== 'devtools') {
      wx.showToast({ title: '浠呭紑鍙戣€呭伐鍏峰彲鐢?, icon: 'none' });
      return;
    }
    wx.removeStorageSync('clientId');
    const cid = ensureClientId();
    this.setData({ clientId: cid, bindInviteCode: '' });
    wx.showToast({ title: '宸插垏鎹负鏂拌韩浠?B)', icon: 'success' });
    this.initThenProfile();
  },
  // ===== [P0-1] 自动绑定逻辑 START =====
  tryAutoBindInvite: function () {
    // 重试等待 clientId 就绪
    this._p01_bindRetry = this._p01_bindRetry || 0;

    const pendingInviteCode = (wx.getStorageSync('pendingInviteCode') || '').trim();
    if (!pendingInviteCode) return;

    const clientId = (this.data && this.data.clientId) || wx.getStorageSync('clientId') || '';
    if (!clientId) {
      if (this._p01_bindRetry < 8) {
        this._p01_bindRetry++;
        setTimeout(() => { try { this.tryAutoBindInvite(); } catch(e) {} }, 400);
      }
      return;
    }

    // 尽量拿 API_BASE（按你项目常见写法兜底）
    let API_BASE = '';
    try {
      const app = getApp && getApp();
      API_BASE = (app && app.globalData && (app.globalData.API_BASE || app.globalData.API_BASE_URL)) || '';
    } catch(e) {}

    if (!API_BASE) {
      try { API_BASE = require('../../config').API_BASE || ''; } catch(e) {}
    }

    if (!API_BASE) {
      console.error('[P0-1] API_BASE missing. 请确认 config.js / globalData.API_BASE');
      return;
    }

    // 避免自己扫自己（若已拿到 myInviteCode）
    const myInviteCode =
      (this.data && (this.data.myInviteCode || this.data.inviteCode || this.data.invite_code)) ||
      (this.data && this.data.profile && (this.data.profile.inviteCode || this.data.profile.invite_code)) ||
      '';

    if (myInviteCode && pendingInviteCode === myInviteCode) {
      console.log('[P0-1] pendingInviteCode == myInviteCode, skip & clear pending');
      wx.removeStorageSync('pendingInviteCode');
      return;
    }

    console.log('[P0-1] try bind now. clientId=', clientId, 'pendingInviteCode=', pendingInviteCode);

    wx.request({
      url: API_BASE.replace(/\/$/, '') + '/api/fission/bind',
      method: 'POST',
      data: { clientId, inviteCode: pendingInviteCode },
      success: (res) => {
        console.log('[P0-1] bind resp=', res);
        const ok = res && res.data && res.data.ok;

        if (ok) {
          wx.removeStorageSync('pendingInviteCode');
          wx.showToast({ title: '已自动绑定邀请关系', icon: 'success' });
          if (typeof this.loadProfile === 'function') this.loadProfile();
          return;
        }

        // 若后端提示已绑定/无需绑定，也清 pending，防止反复弹
        const msg = (res && res.data && (res.data.message || res.data.msg)) || '';
        if (msg.match(/already|已绑定|无需|exists/i)) {
          wx.removeStorageSync('pendingInviteCode');
        }
        if (msg) wx.showToast({ title: msg, icon: 'none' });
      },
      fail: (err) => {
        console.error('[P0-1] bind fail err=', err);
      }
    });
  }
  // ===== [P0-1] 自动绑定逻辑 END =====
});