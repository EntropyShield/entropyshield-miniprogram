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

  if (app && app.globalData) {
    app.globalData.clientId = cid
  }

  return cid
}

function normalizeInviteeClientId(item) {
  if (!item || typeof item !== 'object') return ''

  return String(
    item.client_id ||
      item.clientId ||
      item.invitee_openid ||
      item.inviteeOpenid ||
      item.openid ||
      item.client_id_masked ||
      ''
  ).trim()
}

function maskMobile(mobile, clientId) {
  const m = String(mobile || '').trim()
  if (/^1\d{10}$/.test(m)) {
    return `${m.slice(0, 3)}****${m.slice(-4)}`
  }

  const cid = String(clientId || '').trim()
  return cid ? `ID-${cid.slice(-6)}` : '-'
}

function countRows(rows) {
  const list = Array.isArray(rows) ? rows : []
  let real = 0
  let temp = 0

  list.forEach((item) => {
    const cid = normalizeInviteeClientId(item)
    if (/^ST-/.test(cid)) {
      temp += 1
    } else {
      real += 1
    }
  })

  return {
    total: list.length,
    real,
    temp
  }
}

function buildSummary(pendingRows, paidRows, expiredRows, rawSummary) {
  const p = countRows(pendingRows)
  const pd = countRows(paidRows)
  const ex = countRows(expiredRows)

  return Object.assign({}, rawSummary || {}, {
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
      title: '\u9080\u8bf7\u8ddf\u8e2a',
      currentId: '\u5f53\u524d\u67e5\u8be2ID',
      currentIdTip:
        '\u7528\u4e8e\u786e\u8ba4\u5f53\u524d\u67e5\u770b\u7684\u662f\u54ea\u4e2a\u9080\u8bf7\u5173\u7cfb\u8d26\u53f7\uff1b\u4ee5 ST- \u5f00\u5934\u4ee3\u8868临时ID\u3002',
      pending: '待转化',
      paid: '已成交',
      expired: '\u5df2\u8fc7\u671f',
      bindAt: '\u7ed1\u5b9a\u65f6\u95f4',
      expireAt: '\u5230\u671f\u65f6\u95f4',
      paidAt: '\u9996\u5355\u65f6\u95f4',
      amount: '首单支付分',
      orderNo: '\u8ba2\u5355\u53f7',
      level: '当前权益',
      empty: '\u6682\u65e0\u8bb0\u5f55',
      emptyPending: '\u6682\u65e0待转化\u8bb0\u5f55',
      emptyPaid: '\u6682\u65e0已成交\u8bb0\u5f55',
      emptyExpired: '\u6682\u65e0\u5df2\u8fc7\u671f\u8bb0\u5f55',
      refresh: '\u5237\u65b0',
      real: '真实',
      temp: '临时ID',
      statNote: '真实\u7528\u6237 / 临时ID'
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
        displayAmount: item.first_paid_amount
          ? (String(Math.round(Number(item.first_paid_amount) || 0)) + '分')
          : '0分',
        shortOrderNo: item.first_paid_order_no ? String(item.first_paid_order_no) : '',
        membershipLevelText: (item.membership_level === 'LIFETIME' ? '长期权益' : (item.membership_level === 'FREE' ? '未开通' : (item.membership_level || '未开通'))),
        isTempId: temp,
        identityTag: temp ? '临时ID' : '真实'
      }
    })
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
        wx.showToast({ title: '\u7f51\u7edc\u5f02\u5e38', icon: 'none' })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  }
})
