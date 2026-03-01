// pages/fissionTask/index.js

// ===== [PATCH-WS-02] safe requires (避免 require 抛错直接白屏) =====
let cfg = {}
try { cfg = require('../../config') } catch (e) { cfg = {} }

let clientIdUtil = null
try { clientIdUtil = require('../../utils/clientId') } catch (e) {
  console.error('[fissionTask] require ../../utils/clientId failed:', e)
  clientIdUtil = null
}

// ===== [PATCH-WS-02] anti white-screen helpers =====
function safeSetData(ctx, patch) {
  try { ctx.setData(patch) } catch (e) {}
}
function setPageError(ctx, where, err) {
  const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err)
  console.error('[fissionTask][ERROR]', where || 'unknown', msg)
  safeSetData(ctx, {
    pageError: msg,
    pageErrorWhere: where || 'unknown',
    pageLoading: false,
    statusText: '页面异常（已拦截，避免白屏）'
  })
}

function getApiBase() {
  try {
    const s1 = wx.getStorageSync('API_BASE') || ''
    if (s1) return String(s1).replace(/\/$/, '')
  } catch (e) {}
  try {
    const s2 = wx.getStorageSync('apiBaseUrl') || ''
    if (s2) return String(s2).replace(/\/$/, '')
  } catch (e) {}

  const app = getApp ? getApp() : null
  const gd = app && app.globalData ? app.globalData : null
  const base =
    (gd && (gd.API_BASE || gd.baseUrl || gd.API_BASE_URL)) ||
    cfg.API_BASE ||
    cfg.API_BASE_URL ||
    cfg.PROD_API_BASE ||
    cfg.DEV_API_BASE ||
    ''
  return String(base || '').replace(/\/$/, '')
}

function getEnvVersion() {
  try {
    const info = wx.getAccountInfoSync && wx.getAccountInfoSync()
    const v = info && info.miniProgram && info.miniProgram.envVersion
    if (v === 'develop' || v === 'trial' || v === 'release') return v
  } catch (e) {}
  return 'release'
}

function cleanCode(v) {
  try { v = decodeURIComponent(v) } catch (e) {}
  v = String(v || '').trim().toUpperCase()
  v = v.replace(/[^0-9A-Z]/g, '')
  return v
}

function parseInviteFromOptions(opt) {
  opt = opt || {}
  let v = opt.inviteCode || opt.invite_code || opt.ic || opt.scene || ''
  try { v = decodeURIComponent(v) } catch (e) {}
  v = String(v || '').trim()

  const m = v.match(/(?:^|[?&])(i|inviteCode)=([^&]+)/i)
  if (m && m[2]) v = m[2]

  // 兼容 scene=7BZLN3 这种纯码
  return cleanCode(v)
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
    })
  })
}

function requestGet(url) {
  return new Promise((resolve, reject) => {
    wx.request({
      method: 'GET',
      url,
      timeout: 12000,
      success: (res) => resolve(res),
      fail: (err) => reject(err)
    })
  })
}

// openid 登录失败兜底 ST-xxx，避免页面卡死
function fallbackClientIdST() {
  const key = 'clientId'
  let v = ''
  try { v = wx.getStorageSync(key) || '' } catch (e) {}
  v = String(v || '').trim()
  if (v) return v

  const rnd = Math.floor(Math.random() * 900000 + 100000)
  v = 'ST-' + Date.now() + '-' + rnd
  try { wx.setStorageSync(key, v) } catch (e) {}
  return v
}

Page({
  data: {
    // ===== [PATCH-WS-02] 防白屏状态 =====
    pageLoading: true,
    pageError: '',
    pageErrorWhere: '',

    statusText: '',
    clientId: '',
    incomingInviteCode: '',
    myInviteCode: '',
    invitedByCode: '',
    qrcodeUrl: '',
    debug: false
  },

  toggleDebug() {
    safeSetData(this, { debug: !this.data.debug })
  },

  onRetry() {
    try {
      const pending = cleanCode(this.data.incomingInviteCode || '')
      this.initFission(pending)
    } catch (e) {
      setPageError(this, 'onRetry', e)
    }
  },

  async onLoad(options) {
    safeSetData(this, { pageLoading: true, pageError: '', pageErrorWhere: '', statusText: '加载中…' })
    try {
      console.log('[fissionTask] onLoad options=', options)
      this._envVersion = getEnvVersion()

      const incomingFromOpt = parseInviteFromOptions(options)
      if (incomingFromOpt) {
        try { wx.setStorageSync('pendingInviteCode', incomingFromOpt) } catch (e) {}
      }

      let pending = ''
      try { pending = wx.getStorageSync('pendingInviteCode') || '' } catch (e) {}
      pending = cleanCode(pending)

      // clientId：优先 clientIdUtil，失败则 ST
      let clientId = ''
      if (clientIdUtil && typeof clientIdUtil.ensureClientId === 'function') {
        try {
          clientId = await clientIdUtil.ensureClientId(false)
        } catch (e) {
          console.warn('[fissionTask] ensureClientId failed, use ST fallback:', e)
          clientId = fallbackClientIdST()
        }
      } else {
        clientId = fallbackClientIdST()
      }

      safeSetData(this, { clientId, incomingInviteCode: pending || '' })

      await this.initFission(pending)
    } catch (e) {
      setPageError(this, 'onLoad', e)
    } finally {
      safeSetData(this, { pageLoading: false })
    }
  },

  async initFission(pendingInviteCode) {
    if (this._initing) return
    this._initing = true

    try {
      const API_BASE = getApiBase()
      if (!API_BASE) {
        safeSetData(this, { statusText: 'API_BASE 为空：请检查 config.js / app.js 的 API_BASE 配置' })
        return
      }

      const clientId = (this.data.clientId || '').trim() || fallbackClientIdST()

      let pending = cleanCode(pendingInviteCode)
      if (!pending) {
        try { pending = cleanCode(wx.getStorageSync('pendingInviteCode') || '') } catch (e) {}
      }

      safeSetData(this, { statusText: '初始化裂变档案…' })

      // 关键：这里必须能看到 network 请求 /api/fission/init
      const res = await requestJson('POST', API_BASE + '/api/fission/init', { clientId })
      const d = (res && res.data) ? res.data : {}
      const p = d.profile || null

      console.log('[fissionTask] init response=', d)

      if (!d.ok || !p) {
        safeSetData(this, { statusText: '初始化失败：/api/fission/init 返回异常' })
        return
      }

      const my = cleanCode(p.invite_code || '')
      if (my) {
        safeSetData(this, { myInviteCode: my })
        this.refreshQrcode()
      }

      const alreadyBound = cleanCode(p.invited_by_code || '')
      if (alreadyBound) {
        try { wx.setStorageSync('fissionInvitedByCode', alreadyBound) } catch (e) {}
        safeSetData(this, { invitedByCode: alreadyBound })
      } else {
        try {
          const cached = cleanCode(wx.getStorageSync('fissionInvitedByCode') || '')
          if (cached) safeSetData(this, { invitedByCode: cached })
        } catch (e) {}
      }

      // 有 pending 才 bind
      if (pending) {
        if (alreadyBound && alreadyBound === pending) {
          try { wx.removeStorageSync('pendingInviteCode') } catch (e) {}
          safeSetData(this, { incomingInviteCode: '' })
        } else if (!alreadyBound) {
          await this.tryBindInvite(pending)
          await this.refreshProfile()
        } else {
          try { wx.removeStorageSync('pendingInviteCode') } catch (e) {}
          safeSetData(this, { incomingInviteCode: '' })
        }
      }

      safeSetData(this, {
        statusText: this.data.invitedByCode ? '已建立邀请关系，可直接分享' : '可直接一键分享'
      })
    } catch (e) {
      setPageError(this, 'initFission', e)
    } finally {
      this._initing = false
    }
  },

  async tryBindInvite(inviteCode) {
    const API_BASE = getApiBase()
    if (!API_BASE) return

    const clientId = (this.data.clientId || '').trim() || fallbackClientIdST()
    inviteCode = cleanCode(inviteCode)
    if (!inviteCode) return

    try {
      const r = await requestJson('POST', API_BASE + '/api/fission/bind', { clientId, inviteCode })
      const d = (r && r.data) ? r.data : {}
      const p = d.profile || null

      if (d.ok && d.bound && p) {
        const code = cleanCode(p.invited_by_code || '')
        if (code) {
          try { wx.setStorageSync('fissionInvitedByCode', code) } catch (e) {}
          safeSetData(this, { invitedByCode: code })
        }
        try { wx.removeStorageSync('pendingInviteCode') } catch (e) {}
        safeSetData(this, { incomingInviteCode: '' })
      }
    } catch (e) {}
  },

  async refreshProfile() {
    const API_BASE = getApiBase()
    const clientId = (this.data.clientId || '').trim() || fallbackClientIdST()
    if (!API_BASE || !clientId) return

    try {
      const r = await requestGet(API_BASE + '/api/fission/profile?clientId=' + encodeURIComponent(clientId))
      const d = r && r.data ? r.data : {}
      const p = d.profile || null
      if (d.ok && p) {
        const code = cleanCode(p.invited_by_code || '')
        if (code) {
          try { wx.setStorageSync('fissionInvitedByCode', code) } catch (e) {}
          safeSetData(this, { invitedByCode: code })
          try { wx.removeStorageSync('pendingInviteCode') } catch (e) {}
          safeSetData(this, { incomingInviteCode: '' })
        }
      }
    } catch (e) {}
  },

  refreshQrcode() {
    const API_BASE = getApiBase()
    const code = cleanCode(this.data.myInviteCode)
    if (!API_BASE || !code) return

    const env = this._envVersion || 'release'
    const url = API_BASE +
      '/api/fission/qrcode?inviteCode=' + encodeURIComponent(code) +
      '&env_version=' + encodeURIComponent(env) +
      '&t=' + Date.now()

    safeSetData(this, { qrcodeUrl: url })
  },

  onShareAppMessage() {
    const code = cleanCode(this.data.myInviteCode)
    return {
      title: '熵盾风控训练营',
      path: '/pages/fissionTask/index?inviteCode=' + encodeURIComponent(code || '')
    }
  },

  onShareTimeline() {
    const code = cleanCode(this.data.myInviteCode)
    return {
      title: '熵盾风控训练营',
      query: 'inviteCode=' + encodeURIComponent(code || '')
    }
  },

  goCamp() {
    wx.navigateTo({
      url: '/pages/campIntro/index',
      fail: () => wx.switchTab({ url: '/pages/index/index' })
    })
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})