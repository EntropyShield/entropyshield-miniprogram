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

function normalizeInviteeClientId(item) {
  return String(
    (item && (item.client_id || item.invitee_openid || item.openid)) || ''
  ).trim()
}

function isTempInvitee(item) {
  return /^ST-/.test(normalizeInviteeClientId(item))
}

function buildSummary(pendingRows, paidRows, expiredRows, fallback) {
  const count = (rows) => {
    const list = rows || []
    const temp = list.filter(isTempInvitee).length
    const real = list.length - temp
    return { total: list.length, real, temp }
  }

  const p = count(pendingRows)
  const pd = count(paidRows)
  const ex = count(expiredRows)

  return Object.assign({}, fallback || {}, {
    pendingCount: p.total,
    paidCount: pd.total,
    expiredCount: ex.total,
    pendingRealCount: p.real,
    pendingTempCount: p.temp,
    paidRealCount: pd.real,
    paidTempCount: pd.temp,
    expiredRealCount: ex.real,
    expiredTempCount: ex.temp
  })
}

Page({
  data: {
    loading: false,
    currentClientId: '',
    debugClientId: '',
    texts: {
      title: '邀请跟踪',
      currentId: '当前查询ID',
      pending: '待成交',
      paid: '已成交',
      expired: '已过期',
      bindAt: '绑定时间',
      expireAt: '到期时间',
      paidAt: '首单时间',
      amount: '首单金额',
      orderNo: '订单号',
      level: '当前等级',
      empty: '暂无记录',
      refresh: '刷新',
      real: '真实用户',
      temp: '临时ID'
    },
    summary: {
      pendingCount: 0,
      paidCount: 0,
      expiredCount: 0,
      pendingRealCount: 0,
      pendingTempCount: 0,
      paidRealCount: 0,
      paidTempCount: 0,
      expiredRealCount: 0,
      expiredTempCount: 0
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
    return (rows || []).map((item) => {
      const clientId = normalizeInviteeClientId(item)
      const temp = /^ST-/.test(clientId)
      return {
        ...item,
        client_id: clientId,
        displayName: maskMobile(item.mobile, clientId),
        displayAmount: item.first_paid_amount ? (Number(item.first_paid_amount) / 100).toFixed(2) : '',
        shortOrderNo: item.first_paid_order_no ? String(item.first_paid_order_no) : '',
        membershipLevelText: item.membership_level || 'FREE',
        isTempId: temp,
        identityTag: temp ? '临时ID' : '真实用户'
      }
    })
  },

  fetchData() {
    const baseUrl = getBaseUrl()
    const clientId = this.data.debugClientId || ensureClientId()

    this.setData({ currentClientId: clientId })

    if (!baseUrl || !clientId) {
      wx.showToast({ title: '接口地址未配置', icon: 'none' })
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
          wx.showToast({ title: d.message || '加载失败', icon: 'none' })
          return
        }

        const pendingRows = this.normalizeRows(d.pending)
        const paidRows = this.normalizeRows(d.paid)
        const expiredRows = this.normalizeRows(d.expired)

        this.setData({
          summary: buildSummary(pendingRows, paidRows, expiredRows, d.summary || this.data.summary),
          pending: pendingRows,
          paid: paidRows,
          expired: expiredRows
        })
      },
      fail: (err) => {
        console.warn('[inviteTracker] fetch fail:', err)
        wx.showToast({ title: '网络异常', icon: 'none' })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  }
})