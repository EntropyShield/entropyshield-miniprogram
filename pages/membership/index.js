// pages/membership/index.js
// FIX: restore official pricing baseline for risk calculator only

const { API_BASE } = require('../../config');

function pick(obj, keys, fallback) {
  if (!obj || typeof obj !== 'object') return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return fallback;
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
      fail: reject
    });
  });
}

function isLifetime(rights = {}, profile = {}) {
  const level = String(
    pick(rights, ['membershipLevel', 'membership_level'], '') ||
    pick(profile, ['membershipLevel', 'membership_level'], '')
  ).trim().toUpperCase();

  const name = String(
    pick(rights, ['membershipName', 'membership_name'], '') ||
    pick(profile, ['membershipName', 'membership_name'], '')
  ).trim();

  return level === 'LIFETIME' || /终身|永久|LIFE/i.test(name);
}

function normalizeMembershipName(rights = {}, profile = {}) {
  if (isLifetime(rights, profile)) return '终身会员';

  const rawName = String(
    pick(rights, ['membershipName', 'membership_name'], '') ||
    pick(profile, ['membershipName', 'membership_name'], '')
  ).trim();

  const rawLevel = String(
    pick(rights, ['membershipLevel', 'membership_level'], '') ||
    pick(profile, ['membershipLevel', 'membership_level'], '')
  ).trim().toUpperCase();

  if (rawName) return rawName;
  if (rawLevel === 'FREE') return '体验会员';
  if (rawLevel === 'MONTH') return '月卡';
  if (rawLevel === 'QUARTER') return '季卡';
  if (rawLevel === 'YEAR' || rawLevel === 'ANNUAL') return '年卡';

  return '未开通会员';
}

function formatExpireText(rights = {}, profile = {}) {
  if (isLifetime(rights, profile)) return '终身有效';

  let expireAt = Number(
    pick(rights, ['membershipExpireAt', 'membership_expire_at'], 0) ||
    pick(profile, ['membershipExpireAt', 'membership_expire_at'], 0) ||
    0
  );

  if (!expireAt || Number.isNaN(expireAt)) return '';

  if (expireAt > 0 && expireAt < 1000000000000) {
    expireAt = expireAt * 1000;
  }

  try {
    const d = new Date(expireAt);
    if (Number.isNaN(d.getTime())) return '';

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch (e) {
    return '';
  }
}

Page({
  data: {
    membershipName: '未开通会员',
    freeCalcTimes: 0,
    inviteCode: '',
    membershipExpireText: '',
    isLifetimeMember: false,
    feeList: [
      {
        key: 'times3',
        name: '9.9 元 / 3次',
        rights: '稳健版',
        desc: '适合先体验风控计算器'
      },
      {
        key: 'month',
        name: '月卡 999',
        rights: '稳健版',
        desc: '适合短周期连续使用'
      },
      {
        key: 'quarter',
        name: '季卡 2999',
        rights: '稳健版 + 加强版',
        desc: '适合持续训练与复盘'
      },
      {
        key: 'year',
        name: '年卡 9999',
        rights: '稳健版 + 加强版',
        desc: '适合长期使用'
      }
    ]
  },

  onShow() {
    this.syncFromStorage();
    this.refreshFromServer();
  },

  syncFromStorage() {
    const rights = wx.getStorageSync('userRights') || {};
    const profile = wx.getStorageSync('fissionProfile') || {};

    const inviteCode = String(
      pick(rights, ['inviteCode', 'invite_code'], '') ||
      pick(profile, ['inviteCode', 'invite_code'], '')
    ).trim().toUpperCase();

    this.setData({
      membershipName: normalizeMembershipName(rights, profile),
      freeCalcTimes: Number(pick(rights, ['freeCalcTimes', 'free_calc_times'], 0)) || 0,
      inviteCode,
      membershipExpireText: formatExpireText(rights, profile),
      isLifetimeMember: isLifetime(rights, profile)
    });
  },

  refreshFromServer() {
    const base = getBaseUrl();
    const clientId = String(wx.getStorageSync('clientId') || '').trim();
    if (!base || !clientId) return;

    requestJson(`${base}/api/fission/profile?clientId=${encodeURIComponent(clientId)}`, 'GET')
      .then((data) => {
        if (!data || !data.ok) return;

        const profile = data.profile || {};
        const rights = wx.getStorageSync('userRights') || {};
        const nextRights = Object.assign({}, rights);

        const profileName = pick(profile, ['membershipName', 'membership_name'], '');
        const profileLevel = pick(profile, ['membershipLevel', 'membership_level'], '');
        const profileExpire = pick(profile, ['membershipExpireAt', 'membership_expire_at'], '');
        const profileInviteCode = pick(profile, ['inviteCode', 'invite_code'], '');

        if (profileName) nextRights.membershipName = profileName;
        if (profileLevel) nextRights.membershipLevel = profileLevel;
        if (profileExpire) nextRights.membershipExpireAt = profileExpire;
        if (profileInviteCode) nextRights.inviteCode = String(profileInviteCode).trim().toUpperCase();

        if (isLifetime(nextRights, profile)) {
          nextRights.membershipName = '终身会员';
          nextRights.membershipLevel = 'LIFETIME';
          nextRights.membershipExpireAt = '';
        }

        wx.setStorageSync('userRights', nextRights);
        wx.setStorageSync('fissionProfile', Object.assign({}, wx.getStorageSync('fissionProfile') || {}, profile));

        this.syncFromStorage();
      })
      .catch(() => {});
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail() {
        wx.switchTab({
          url: '/pages/profile/index'
        });
      }
    });
  }
});