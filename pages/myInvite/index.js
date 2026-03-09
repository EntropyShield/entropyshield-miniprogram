const cfg = require('../../config.js')

function getApiBase() {
  try {
    const s1 = wx.getStorageSync('API_BASE') || ''
    if (s1) return String(s1).replace(/\/$/, '')
  } catch (e) {}

  try {
    const app = getApp && getApp()
    const gd = (app && app.globalData) || {}
    const base =
      gd.API_BASE ||
      gd.API_BASE_URL ||
      cfg.API_BASE ||
      cfg.API_BASE_URL ||
      cfg.PROD_API_BASE ||
      cfg.DEV_API_BASE ||
      ''
    return String(base || '').replace(/\/$/, '')
  } catch (e) {
    return ''
  }
}

function getClientId() {
  try {
    const app = getApp && getApp()
    const gd = (app && app.globalData) || {}
    if (gd.clientId) return String(gd.clientId)
    if (gd.openid) return String(gd.openid)
  } catch (e) {}

  const keys = ['clientId', 'openid', 'CLIENT_ID']
  for (let i = 0; i < keys.length; i++) {
    try {
      const v = wx.getStorageSync(keys[i])
      if (v) return String(v)
    } catch (e) {}
  }
  return ''
}

function requestGet(url) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'GET',
      timeout: 12000,
      success: resolve,
      fail: reject
    })
  })
}

Page({
  data: {
    loading: false,
    shown: false,
    found: false,
    hasInvitees: false,
    currentClientId: '',

    targetMobile: '-',
    targetClientId: '-',
    targetCode: '-',
    targetParentCode: '-',
    targetInviterClientId: '-',
    targetInviteeCount: 0,

    invitees: []
  },

  onLoad() {
    this.loadMyInvite()
  },

  async loadMyInvite() {
    const clientId = getClientId()
    const API_BASE = getApiBase()

    if (!clientId) {
      wx.showToast({ title: '未获取到当前用户ID', icon: 'none' })
      return
    }
    if (!API_BASE) {
      wx.showToast({ title: 'API_BASE 为空', icon: 'none' })
      return
    }

    this.setData({
      loading: true,
      shown: false,
      found: false,
      hasInvitees: false,
      invitees: [],
      currentClientId: clientId
    })

    try {
      const resp = await requestGet(
        API_BASE + '/api/fission/my-invite?clientId=' + encodeURIComponent(clientId)
      )
      const d = (resp && resp.data) ? resp.data : {}

      if (!d.ok) {
        throw new Error(d.message || '查询失败')
      }

      const target = d.target || {}
      const invitees = Array.isArray(d.invitees) ? d.invitees : []

      this.setData({
        shown: true,
        found: !!d.found,
        hasInvitees: invitees.length > 0,

        targetMobile: target.mobile || '-',
        targetClientId: target.client_id || '-',
        targetCode: target.invite_code || '-',
        targetParentCode: target.invited_by_code || '-',
        targetInviterClientId: target.inviter_client_id || '-',
        targetInviteeCount: Number(d.inviteeCount || 0),

        invitees: invitees.map(function (item) {
          return {
            mobileText: item.mobile || '-',
            clientIdText: item.client_id || '-',
            inviteCodeText: item.invite_code || '-',
            parentCodeText: item.invited_by_code || '-'
          }
        })
      })
    } catch (e) {
      console.error('[myInvite] load fail', e)
      wx.showToast({
        title: (e && e.message) ? e.message : '查询失败',
        icon: 'none'
      })
    } finally {
      this.setData({ loading: false })
    }
  }
})