const { API_BASE } = require('../../config')

function getBaseUrl() {
  return String(API_BASE || '').replace(/\/$/, '')
}

function ensureClientId() {
  const app = getApp && getApp()
  let cid =
    (app && app.globalData && app.globalData.clientId) ||
    wx.getStorageSync('clientId') ||
    wx.getStorageSync('st_client_id')

  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 900000) + 100000}`
  }

  wx.setStorageSync('clientId', cid)
  wx.setStorageSync('st_client_id', cid)
  if (app && app.globalData) app.globalData.clientId = cid
  return cid
}

function maskMobile(mobile, clientId) {
  const m = String(mobile || '').trim()
  if (/^1\d{10}$/.test(m)) {
    return `${m.slice(0, 3)}****${m.slice(-4)}`
  }
  const cid = String(clientId || '').trim()
  return cid ? `ID-${cid.slice(-6)}` : '-'
}

Page({
  data: {
    loading: false,
    currentClientId: '',
    debugClientId: '',
    texts: {
      title: '\u9080\u8bf7\u8ddf\u8e2a',
      currentId: '\u5f53\u524d\u67e5\u8be2ID',
      pending: '\u5f85\u6210\u4ea4',
      paid: '\u5df2\u6210\u4ea4',
      expired: '\u5df2\u8fc7\u671f',
      bindAt: '\u7ed1\u5b9a\u65f6\u95f4',
      expireAt: '\u5230\u671f\u65f6\u95f4',
      paidAt: '\u9996\u5355\u65f6\u95f4',
      amount: '\u9996\u5355\u91d1\u989d',
      orderNo: '\u8ba2\u5355\u53f7',
      level: '\u5f53\u524d\u7b49\u7ea7',
      empty: '\u6682\u65e0\u8bb0\u5f55',
      refresh: '\u5237\u65b0'
    },
    summary: {
      pendingCount: 0,
      paidCount: 0,
      expiredCount: 0
    },
    pending: [],
    paid: [],
    expired: []
  },

  onLoad(options) {
    const debugClientId = String((options && options.debugClientId) || '').trim()
    if (debugClientId) {
      this.setData({ debugClientId })
    }
  },

  onShow() {
    this.fetchData()
  },

  normalizeRows(rows) {
    return (rows || []).map((item) => ({
      ...item,
      displayName: maskMobile(item.mobile, item.client_id),
      displayAmount: item.first_paid_amount ? (Number(item.first_paid_amount) / 100).toFixed(2) : '',
      shortOrderNo: item.first_paid_order_no ? String(item.first_paid_order_no) : '',
      membershipLevelText: item.membership_level || 'FREE'
    }))
  },

  fetchData() {
    const baseUrl = getBaseUrl()
    const clientId = this.data.debugClientId || ensureClientId()

    this.setData({ currentClientId: clientId })

    if (!baseUrl || !clientId) {
      wx.showToast({ title: '\u63a5\u53e3\u5730\u5740\u672a\u914d\u7f6e', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    wx.request({
      url: `${baseUrl}/api/fission/invite-tracker`,
      method: 'GET',
      data: { clientId },
      success: (res) => {
        const d = (res && res.data) || {}
        console.log('[inviteTracker] clientId =', clientId)
        console.log('[inviteTracker] response =', d)

        if (!d.ok) {
          wx.showToast({ title: d.message || '\u52a0\u8f7d\u5931\u8d25', icon: 'none' })
          return
        }

        this.setData({
          summary: d.summary || this.data.summary,
          pending: this.normalizeRows(d.pending),
          paid: this.normalizeRows(d.paid),
          expired: this.normalizeRows(d.expired)
        })
      },
      fail: (err) => {
        console.warn('[inviteTracker] fetch fail:', err)
        wx.showToast({ title: '\u7f51\u7edc\u5f02\u5e38', icon: 'none' })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  }
})
