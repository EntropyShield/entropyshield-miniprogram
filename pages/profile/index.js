// pages/profile/index.js
// MOD: FIX_PROFILE_INNER_TABS_20260213
// MOD: PATCH_AUDIT_PRIVACY_20260310_LOCAL_PAGE
// MOD: PRIVACY_DEFAULT_UNCHECKED_20260310

const funnel = require('../../utils/funnel.js');
const { API_BASE } = require('../../config');

function ensureClientId() {
  const appInst = getApp && getApp();
  let cid =
    (appInst && appInst.globalData && appInst.globalData.clientId) ||
    wx.getStorageSync('clientId');

  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    wx.setStorageSync('clientId', cid);
    console.log('[profile] new clientId generated:', cid);
  } else {
    console.log('[profile] use existing clientId:', cid);
  }

  if (appInst && appInst.globalData) appInst.globalData.clientId = cid;
  return cid;
}

function getBaseUrl() {
  return String(API_BASE || '').replace(/\/$/, '');
}

function requestJson(url, method = 'GET', data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header: { 'content-type': 'application/json' },
      success: (res) => resolve(res.data),
      fail: (err) => reject(err)
    });
  });
}

function pick(obj, keys, fallback) {
  if (!obj || typeof obj !== 'object') return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return fallback;
}

function normalizeVisitStatus(raw) {
  const v = String(raw === undefined || raw === null ? '' : raw).trim().toLowerCase();

  if (v === '0' || v === 'pending') return 'pending';
  if (v === '1' || v === 'confirmed') return 'confirmed';
  if (v === '2' || v === 'finished' || v === 'done') return 'finished';
  if (v === '3' || v === 'canceled' || v === 'cancelled') return 'canceled';

  return 'pending';
}


function formatVisitDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''

  function pad(n) {
    return String(n).padStart(2, '0')
  }

  function buildText(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  function toDate(v) {
    if (!v) return null

    if (/^\d{13}$/.test(v)) {
      const d = new Date(Number(v))
      return isNaN(d.getTime()) ? null : d
    }

    if (/^\d{10}$/.test(v)) {
      const d = new Date(Number(v) * 1000)
      return isNaN(d.getTime()) ? null : d
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const d = new Date(v.replace(/-/g, '/') + ' 00:00:00')
      return isNaN(d.getTime()) ? null : d
    }

    if (/^\d{4}\/\d{2}\/\d{2}$/.test(v)) {
      const d = new Date(v + ' 00:00:00')
      return isNaN(d.getTime()) ? null : d
    }

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) {
      const d = new Date(v.replace(/-/g, '/'))
      return isNaN(d.getTime()) ? null : d
    }

    if (/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) {
      const d = new Date(v)
      return isNaN(d.getTime()) ? null : d
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v)
      return isNaN(d.getTime()) ? null : d
    }

    return null
  }

  const d = toDate(raw)
  if (!d) return raw
  return buildText(d)
}

function normalizeLatestVisit(list) {
  if (!Array.isArray(list) || !list.length) return null;

  const v = list[0] || null;
  if (!v) return null;

  const visitDateRaw = pick(v, ['visit_date', 'visitDate', 'date'], '') || '';
  const start = pick(v, ['start_time', 'startTime', 'start'], '') || '';
  const end = pick(v, ['end_time', 'endTime', 'end'], '') || '';
  const visitTimeRangeRaw = pick(v, ['visit_time_range', 'visitTimeRange'], '') || '';

  const visitTimeRange =
    start && end
      ? `${String(start).slice(0, 5)}-${String(end).slice(0, 5)}`
      : visitTimeRangeRaw;

  return {
    ...v,
    visitDateDisplay: formatVisitDate(visitDateRaw),
    visitTimeRange,
    status: normalizeVisitStatus(pick(v, ['status'], 'pending'))
  };
}

Page({
  data: {
    userInfo: null,

    freeCalcTimes: 0,
    campRewardCount: 0,
    fissionSyncedTimes: 0,
    campProgressText: '0/7',
    membershipName: '',
    isVisitAdmin: false,

    privacyChecked: false,

    CAMP_REWARD_TIMES: 4,

    activeInnerTab: 'rights',

    myInviteCode: '',
    invitedByCode: '',

    latestVisit: null,
    statusTextMap: {
      pending: '\u5f85\u786e\u8ba4',
      confirmed: '\u5df2\u786e\u8ba4',
      finished: '\u5df2\u5b8c\u6210',
      canceled: '\u5df2\u53d6\u6d88',
      cancelled: '\u5df2\u53d6\u6d88'
    },
    statusClassMap: {
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      finished: 'status-finished',
      canceled: 'status-canceled',
      cancelled: 'status-canceled'
    },
    quickVisitTexts: {
      title: '\u7ebf\u4e0b\u6765\u8bbf\u63d0\u9192',
      timeFallback: '\u65f6\u95f4\u5f85\u786e\u8ba4',
      purposeFallback: '\u4ea4\u6d41\u98ce\u63a7\u4f53\u7cfb',
      statusFallback: '\u5f85\u786e\u8ba4'
    }
  },

  onLoad(options) {
    funnel.log('PROFILE_VIEW', { from: (options && options.from) || '' });

    this.clientId = ensureClientId();
    this.setData({
      privacyChecked: false
    });

    this.refreshLocalSnapshot();
    this.fetchFissionProfile();
    this.fetchLatestVisit();
    this.fetchAdminAccess();
  },

  onShow() {
    this.setData({
      privacyChecked: false
    });

    this.refreshLocalSnapshot();
    this.fetchFissionProfile();
    this.fetchLatestVisit();
    this.fetchAdminAccess();

    try {
      const apiBase = String(
        wx.getStorageSync('API_BASE') ||
        wx.getStorageSync('apiBaseUrl') ||
        ((getApp && getApp().globalData && getApp().globalData.API_BASE) || API_BASE || '')
      ).replace(/\/$/, '');

      const clientId = this.clientId || wx.getStorageSync('clientId');
      if (!apiBase || !clientId) return;

      wx.request({
        url: `${apiBase}/api/fission/profile`,
        method: 'GET',
        data: { clientId },
        success: (res) => {
          const d = res && res.data;
          if (!d || !d.ok) return;

          const total =
            Number(d.total_reward_times ?? (d.profile && d.profile.total_reward_times) ?? 0) || 0;

          const rights = wx.getStorageSync('userRights') || {};
          const currentFree = Number(rights.freeCalcTimes || 0) || 0;
          let lastSynced =
            Number(wx.getStorageSync('fission_total_reward_times_synced') || 0) || 0;

          if (lastSynced === 0 && currentFree > 0) {
            wx.setStorageSync('fission_total_reward_times_synced', total);
            lastSynced = total;
          }

          const delta = total - lastSynced;
          if (delta > 0) {
            rights.freeCalcTimes = currentFree + delta;
            if (!rights.membershipName) rights.membershipName = 'FREE';
            wx.setStorageSync('userRights', rights);
            wx.setStorageSync('fission_total_reward_times_synced', total);
          }

          const latestRights = wx.getStorageSync('userRights') || rights;
          this.setData({
            freeCalcTimes: Number(latestRights.freeCalcTimes || currentFree) || 0,
            membershipName: latestRights.membershipName || '????'
          });
        },
        fail: (err) => {
          console.warn('[profile] onShow sync fail:', err);
        }
      });
    } catch (e) {
      console.warn('[profile] onShow sync exception:', e);
    }
  },

  onInnerTabChange(e) {
    const ds = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const key = ds.key || 'rights';

    console.log('[profile] onInnerTabChange ->', key, ds);

    this.setData({
      activeInnerTab: key
    });
  },

  onPrivacyAgreementChange(e) {
    const values = (e && e.detail && e.detail.value) || [];
    const checked = values.includes('agree');
    this.setData({ privacyChecked: checked });
  },

  openPrivacyContract() {
    wx.navigateTo({
      url: '/pages/agreementPrivacy/index'
    });
  },

  openServiceAgreement() {
    wx.navigateTo({
      url: '/pages/agreementService/index'
    });
  },

  refreshLocalSnapshot() {
    const cachedUserInfo = wx.getStorageSync('userInfo');
    if (cachedUserInfo && typeof cachedUserInfo === 'object') {
      this.setData({ userInfo: cachedUserInfo });
    }

    const ur = wx.getStorageSync('userRights') || {};
    const freeCalcTimes = Number(pick(ur, ['freeCalcTimes', 'free_calc_times'], 0)) || 0;
    const membershipName = String(pick(ur, ['membershipName', 'membership_name'], '')) || '????';
    const campRewardCount = Number(pick(ur, ['campRewardCount', 'camp_reward_count'], 0)) || 0;

    const logs = wx.getStorageSync('campDailyLogs');
    const doneDays = Array.isArray(logs)
      ? Math.min(7, logs.length)
      : Number(pick(ur, ['campDaysDone'], 0)) || 0;

    const campProgressText = `${Math.max(0, Math.min(7, doneDays))}/7`;
    const fissionSyncedTimes = Number(pick(ur, ['fissionSyncedTimes', 'total_reward_times'], 0)) || 0;

    this.setData({
      freeCalcTimes,
      membershipName,
      campRewardCount,
      campProgressText,
      fissionSyncedTimes
    });
  },

  fetchFissionProfile() {
    const baseUrl = getBaseUrl();
    const clientId = this.clientId || ensureClientId();
    if (!baseUrl || !clientId) return;

    const url = `${baseUrl}/api/fission/profile?clientId=${encodeURIComponent(clientId)}`;
    requestJson(url, 'GET')
      .then((data) => {
        if (!data || !data.ok) {
          console.warn('[profile] fission profile failed:', data);
          return;
        }

        const profile = data.profile || {};
        const total = Number(pick(data, ['total_reward_times'], 0)) || 0;

        const myInviteCode = String(
          pick(profile, ['my_invite_code', 'invite_code', 'inviteCode', 'myInviteCode'], '')
        );
        const invitedByCode = String(
          pick(profile, ['invited_by_code', 'invitedByCode', 'invited_by', 'invitedBy'], '')
        );

        this.setData({
          myInviteCode,
          invitedByCode,
          fissionSyncedTimes: total || this.data.fissionSyncedTimes
        });
      })
      .catch((err) => {
        console.warn('[profile] fission profile request fail:', err);
      });
  },

  fetchLatestVisit() {
    const baseUrl = getBaseUrl();
    const clientId = this.clientId || ensureClientId();
    if (!baseUrl || !clientId) return;

    const url = `${baseUrl}/api/visit/my-list?clientId=${encodeURIComponent(clientId)}`;
    requestJson(url, 'GET')
      .then((data) => {
        if (!data || !data.ok) return;

        const list =
          data.list ||
          data.rows ||
          data.items ||
          (data.data && (data.data.list || data.data.rows || data.data.items)) ||
          [];

        const latestVisit = normalizeLatestVisit(list);
        this.setData({ latestVisit });
      })
      .catch((err) => {
        console.warn('[profile] visit my-list request fail:', err);
      });
  },

  fetchAdminAccess() {
    const baseUrl = getBaseUrl();
    const clientId = this.clientId || ensureClientId();
    if (!baseUrl || !clientId) {
      this.setData({ isVisitAdmin: false });
      return;
    }

    const url = `${baseUrl}/api/admin/me?clientId=${encodeURIComponent(clientId)}`;
    requestJson(url, 'GET')
      .then((data) => {
        this.setData({
          isVisitAdmin: !!(data && data.ok && data.isVisitAdmin)
        });
      })
      .catch((err) => {
        console.warn('[profile] admin access request fail:', err);
        this.setData({ isVisitAdmin: false });
      });
  },

  onTapLatestVisitQuick() {
    if (!this.data.latestVisit) return;
    if (this.data.isVisitAdmin) {
      wx.navigateTo({ url: '/pages/visitAdmin/index' });
      return;
    }
    wx.navigateTo({ url: '/pages/visitMyList/index' });
  },

  goCampIntro() {
    wx.navigateTo({ url: '/pages/campIntro/index' });
  },

  goFissionTask() {
    wx.navigateTo({ url: '/pages/fissionTask/index' });
  },

  goMyInvite() {
    wx.navigateTo({ url: '/pages/myInvite/index' });
  },

  goOrderCenter() {
    wx.showToast({ title: '敬请期待', icon: 'none' });
  },

  goVisitBooking() {
    wx.navigateTo({ url: '/pages/visitBooking/index' });
  },

  goVisitMyList() {
    wx.navigateTo({ url: '/pages/visitMyList/index' });
  },

  goVisitAdmin() {
    wx.navigateTo({ url: '/pages/visitAdmin/index' });
  }
});
