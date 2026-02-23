// pages/profile/index.js
// MOD: FIX_PROFILE_INNER_TABS_20260213
// 个人中心（TabBar）— 三段内页 Tab：rights / tools / lab

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

function normalizeLatestVisit(list) {
  if (!Array.isArray(list) || !list.length) return null;
  // 取第一条（后端通常已按最新排序）。若没排序也不致命。
  const v = list[0] || null;
  if (!v) return null;

  const visitDate =
    pick(v, ['visit_date', 'visitDate', 'date'], '') || '';
  const start =
    pick(v, ['start_time', 'startTime', 'start'], '') || '';
  const end =
    pick(v, ['end_time', 'endTime', 'end'], '') || '';

  return {
    ...v,
    visitDateDisplay: visitDate ? String(visitDate).slice(0, 10) : '',
    visitTimeRange: start && end ? `${String(start).slice(0, 5)}-${String(end).slice(0, 5)}` : '',
    status: pick(v, ['status'], 'pending')
  };
}

Page({
  data: {
    // 顶部用户信息
    userInfo: null,

    // 快速统计条
    freeCalcTimes: 0,
    campRewardCount: 0,
    fissionSyncedTimes: 0,
    campProgressText: '0/7',
    membershipName: '',

    // 常量展示
    CAMP_REWARD_TIMES: 4,

    // 内页 Tab（⚠️WXML用的是 activeInnerTab）
    // MOD: IMPORTANT_DEFAULT_RIGHTS
    activeInnerTab: 'rights',

    // 裂变关系
    myInviteCode: '',
    invitedByCode: '',

    // 最近来访
    latestVisit: null,
    statusTextMap: {
      pending: '待确认',
      confirmed: '已确认',
      finished: '已完成',
      canceled: '已取消',
      cancelled: '已取消'
    },
    statusClassMap: {
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      finished: 'status-finished',
      canceled: 'status-canceled',
      cancelled: 'status-canceled'
    }
  },

  onLoad(options) {
    funnel.log('PROFILE_VIEW', { from: (options && options.from) || '' });

    this.clientId = ensureClientId();

    // 先用本地缓存把页面撑起来（不依赖网络）
    this.refreshLocalSnapshot();

    // 再拉后端数据（失败也不影响基本显示）
    this.fetchFissionProfile();
    this.fetchLatestVisit();
  },

  onShow() {
    // 每次返回个人中心刷新一次本地权益（freeCalcTimes 等）
    this.refreshLocalSnapshot();
  },

  // MOD: FIX_EVENT_HANDLER_MATCH_WXML
  onInnerTabChange(e) {
    const ds = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const key = ds.key || 'rights';

    console.log('[profile] onInnerTabChange ->', key, ds);

    this.setData({
      activeInnerTab: key
    });
  },

  refreshLocalSnapshot() {
    // userInfo（如果你有在别处缓存）
    const cachedUserInfo = wx.getStorageSync('userInfo');
    if (cachedUserInfo && typeof cachedUserInfo === 'object') {
      this.setData({ userInfo: cachedUserInfo });
    }

    // userRights（你的项目里一直在用）
    const ur = wx.getStorageSync('userRights') || {};
    const freeCalcTimes = Number(pick(ur, ['freeCalcTimes', 'free_calc_times'], 0)) || 0;
    const membershipName = String(pick(ur, ['membershipName', 'membership_name'], '')) || '';

    // campRewardCount / campProgress（尽量从已有缓存推导）
    const campRewardCount = Number(pick(ur, ['campRewardCount', 'camp_reward_count'], 0)) || 0;

    // 若你有 campDailyLogs（数组），用它估算 0/7
    const logs = wx.getStorageSync('campDailyLogs');
    const doneDays = Array.isArray(logs) ? Math.min(7, logs.length) : Number(pick(ur, ['campDaysDone'], 0)) || 0;
    const campProgressText = `${Math.max(0, Math.min(7, doneDays))}/7`;

    // 裂变同步次数（如果 userRights 里已有）
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

    const url = `${baseUrl}/api/fission/profile?clientId=${encodeURIComponent(clientId)}`;
    requestJson(url, 'GET')
      .then((data) => {
        if (!data || !data.ok) {
          console.warn('[profile] fission profile failed:', data);
          return;
        }
        const profile = data.profile || {};
        const total = Number(pick(data, ['total_reward_times'], 0)) || 0;

        // 尽量兼容字段名
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

  // ====== WXML 里绑定的跳转方法（必须存在，否则点击无反应）======
  goCampIntro() {
    wx.navigateTo({ url: '/pages/campIntro/index' });
  },

  goFissionTask() {
    wx.navigateTo({ url: '/pages/fissionTask/index' });
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
