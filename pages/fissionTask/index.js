
// ===================== [ADD] AUTO_BIND_FROM_SCENE_V1 BEGIN =====================
const __CFG_BIND__ = require('../../config');

function __BIND_API_BASE__() {
  const app = getApp ? getApp() : null;
  const gd = app && app.globalData ? app.globalData : null;
  const base = (gd && gd.API_BASE) || __CFG_BIND__.API_BASE || __CFG_BIND__.PROD_API_BASE || __CFG_BIND__.DEV_API_BASE || '';
  return String(base || '').replace(/\/$/, '');
}
function __BIND_URL__(path) { return __BIND_API_BASE__() + path; }

// 娴犲孩澹傞惍浣稿棘閺佹媽袙閺?inviteCode閿涘牅绱崗?scene閿涘苯鍙惧▎?inviteCode閿?
function __PARSE_INVITE_CODE__(options) {
  if (!options) return '';
  let v = options.scene || options.inviteCode || '';
  try { v = decodeURIComponent(v); } catch(e) {}
  v = String(v || '').trim();
  // 閸忕厧顔?scene 閸欘垵鍏橀弰?"i=XXXXXX"
  const m = v.match(/(?:^|[?&])(i|inviteCode)=([^&]+)/i);
  if (m && m[2]) v = m[2];
  v = String(v).trim().toUpperCase();
  // 閸欘亙绻氶悾娆忕摟濮ｅ秵鏆熺€涙绱濋柆鍨帳閼村繑鏆熼幑?
  v = v.replace(/[^0-9A-Z]/g, '');
  return v;
}

// 閼惧嘲褰囪ぐ鎾冲閻劍鍩?openid/clientId閿涘牅缍橀崥搴ｎ伂閻?openid 鐎涙顔岄敍灞肩稻閸撳秶顏稉鈧懜顒€褰?clientId閿?
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

  
// ===== [P0-1] scene -> inviteCode 瑙ｆ瀽 START =====
function _safeDecode(v) {
  try { return decodeURIComponent(String(v || '')); } catch (e) { return String(v || ''); }
}
/**
 * scene 鍙兘鏄細
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
// ===== [P0-1] scene -> inviteCode 瑙ｆ瀽 END =====
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

      // 婵″倹鐏夋い鐢告桨瀹稿弶妯夌粈琛♀偓婊冨嚒缂佹垵鐣鹃柇鈧拠铚傛眽閳ユ繐绱濋惄瀛樺复濞?pending
      if (this.data && this.data.hasBoundInviter) {
        wx.removeStorageSync('pendingInviteCode');
        this.setData({ pendingInviteCode: '' });
        return;
      }

      const clientId = String(__GET_CLIENT_ID__() || '').trim();
      if (!clientId) return; // 缁?profile/init 閹?clientId 閸愭瑥鍙?globalData 閸氬氦鍤滈崝銊╁櫢鐠?

      const myCode = String((this.data && (this.data.myInviteCode || this.data.inviteCode)) || '').trim().toUpperCase();
      if (myCode && pending === myCode) {
        wx.removeStorageSync('pendingInviteCode');
        this.setData({ pendingInviteCode: '' });
        wx.showToast({ title: '娑撳秷鍏樼紒鎴濈暰閼奉亜绻?, icon: 'none' });
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
            // 閸氬海顏鑼€栭崠鏍电窗bound / duplicated
            if (d.bound) wx.showToast({ title: '缂佹垵鐣鹃幋鎰', icon: 'success' });
            else if (d.duplicated) wx.showToast({ title: '瀹歌尙绮︾€规俺绻冮柇鈧拠铚傛眽', icon: 'none' });

            // 濞?pending閿涘矂浼╅崗宥呭冀婢跺秷袝閸?
            wx.removeStorageSync('pendingInviteCode');
            this.setData({ pendingInviteCode: '' });

            // 閸欘垶鈧绱版俊鍌涚亯閸氬海顏潻鏂挎礀 profile閿涘瞼娲块幒銉︽纯閺備即銆夐棃銏㈠Ц閹?
            if (d.profile) {
              const invitedByCode = d.profile.invited_by_code || '';
              this.setData({
                hasBoundInviter: !!invitedByCode,
                invitedByCode
              });
            }
          } else {
            wx.showToast({ title: d.message || '缂佹垵鐣炬径杈Е', icon: 'none' });
          }
        },
        fail: () => wx.showToast({ title: '缂冩垹绮堕柨娆掝嚖', icon: 'none' }),
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
    // ===== [P0-1] 扫码落地：读取 scene 并写入 pendingInviteCode START =====
    const __opt = (arguments && arguments[0]) || {};
    const rawScene =
      (__opt && __opt.scene) ||
      (__opt && __opt.query && __opt.query.scene) ||
      '';

    const inviteFromScene = parseInviteCodeFromScene(rawScene);
    const inviteFromQuery = (__opt && (__opt.inviteCode || __opt.invite_code || __opt.ic)) || '';
    const incomingInviteCode = (inviteFromQuery || inviteFromScene || '').trim();

    if (incomingInviteCode) {
      wx.setStorageSync('pendingInviteCode', incomingInviteCode);
      console.log('[P0-1] incomingInviteCode=', incomingInviteCode, 'rawScene=', rawScene);
    } else {
      console.log('[P0-1] no incoming invite code. rawScene=', rawScene, '__opt=', __opt);
    }

    setTimeout(() => {
      try { if (this.tryAutoBindInvite) this.tryAutoBindInvite(); } catch(e) {}
    }, 800);
    // ===== [P0-1] 扫码落地：读取 scene 并写入 pendingInviteCode END =====
    const clientId = ensureClientId();
    // DevTools 閻滎垰顣ㄧ粻鈧崡鏇炲灲鐎?
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
      wx.showToast({ title: '鐠囩柉绶崗銉╁€嬬拠椋庣垳', icon: 'none' });
      return;
    }
    if (inviteCode === upperTrim(this.data.inviteCode)) {
      console.log('[fissionTask] self-invite blocked');
      wx.showToast({ title: '娑撳秷鍏樼紒鎴濈暰閼奉亜绻侀惃鍕€嬬拠椋庣垳', icon: 'none' });
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
          wx.showToast({ title: '缂佹垵鐣鹃幋鎰', icon: 'success' });
          this.fetchProfile();
        } else {
          wx.showToast({ title: d.message || res.data.message || '缂佹垵鐣炬径杈Е', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '缂冩垹绮堕柨娆掝嚖', icon: 'none' }),
      complete: () => this.setData({ bindLoading: false }),
    });
  },

  
  onTapRefreshQrcode() {
    const inviteCode = (this.data && (this.data.myInviteCode || this.data.inviteCode)) || '';
    if (!inviteCode) {
      wx.showToast({ title: '闁偓鐠囬鐖滈悽鐔稿灇娑擃厸鈧?, icon: 'none' });
      return;
    }
    const url = __QR_URL__(inviteCode);
    this.setData({ myQrPath: '' });

    wx.showLoading({ title: '閻㈢喐鍨氭禍宀€娣惍浣测偓? });
    wx.downloadFile({
      url,
      success: (r) => {
        if (r.statusCode === 200 && r.tempFilePath) {
          this.setData({ myQrPath: r.tempFilePath });
        } else {
          wx.showToast({ title: '娴滃瞼娣惍浣风瑓鏉炶棄銇戠拹?, icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '缂冩垹绮堕柨娆掝嚖', icon: 'none' }),
      complete: () => wx.hideLoading()
    });
  },


  onTapCopyInviteCode() {
    const code = upperTrim(this.data.inviteCode);
    if (!code) return wx.showToast({ title: '閺嗗倹妫ら柇鈧拠椋庣垳', icon: 'none' });
    wx.setClipboardData({ data: code });
  },

  // DevTools 娑撴挾鏁ら敍姘闁款喖鍨忛幑銏ｉ煩娴犳枻绱欓悽鐔稿灇閺傛壆娈?clientId閿涘瞼娴夎ぐ鎾茬艾 B閿?
  onTapSwitchIdentity() {
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    if (sys.platform !== 'devtools') {
      wx.showToast({ title: '娴犲懎绱戦崣鎴ｂ偓鍛紣閸忓嘲褰查悽?, icon: 'none' });
      return;
    }
    wx.removeStorageSync('clientId');
    const cid = ensureClientId();
    this.setData({ clientId: cid, bindInviteCode: '' });
    wx.showToast({ title: '瀹告彃鍨忛幑顫礋閺傛媽闊╂禒?B)', icon: 'success' });
    this.initThenProfile();
  },
  // ===== [P0-1] 鑷姩缁戝畾閫昏緫 START =====
  tryAutoBindInvite: function () {
    // 閲嶈瘯绛夊緟 clientId 灏辩华
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

    // 灏介噺鎷?API_BASE锛堟寜浣犻」鐩父瑙佸啓娉曞厹搴曪級
    let API_BASE = '';
    try {
      const app = getApp && getApp();
      API_BASE = (app && app.globalData && (app.globalData.API_BASE || app.globalData.API_BASE_URL)) || '';
    } catch(e) {}

    if (!API_BASE) {
      try { API_BASE = require('../../config').API_BASE || ''; } catch(e) {}
    }

    if (!API_BASE) {
      console.error('[P0-1] API_BASE missing. 璇风‘璁?config.js / globalData.API_BASE');
      return;
    }

    // 閬垮厤鑷繁鎵嚜宸憋紙鑻ュ凡鎷垮埌 myInviteCode锛?    const myInviteCode =
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
          wx.showToast({ title: '宸茶嚜鍔ㄧ粦瀹氶個璇峰叧绯?, icon: 'success' });
          if (typeof this.loadProfile === 'function') this.loadProfile();
          return;
        }

        // 鑻ュ悗绔彁绀哄凡缁戝畾/鏃犻渶缁戝畾锛屼篃娓?pending锛岄槻姝㈠弽澶嶅脊
        const msg = (res && res.data && (res.data.message || res.data.msg)) || '';
        if (msg.match(/already|宸茬粦瀹殀鏃犻渶|exists/i)) {
          wx.removeStorageSync('pendingInviteCode');
        }
        if (msg) wx.showToast({ title: msg, icon: 'none' });
      },
      fail: (err) => {
        console.error('[P0-1] bind fail err=', err);
      }
    });
  }
  // ===== [P0-1] 鑷姩缁戝畾閫昏緫 END =====
});