// pages/membership/index.js
<<<<<<< HEAD
// FIX: restore official pricing baseline for risk calculator only

const { API_BASE } = require('../../config');
=======
// MOD: RESTORE_MEMBERSHIP_BASELINE_20260324
>>>>>>> parent of 02b7517 (fix: restore lifetime member display and clean pay intro page)

function pick(obj, keys, fallback) {
  if (!obj || typeof obj !== 'object') return fallback;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') return obj[k];
  }
  return fallback;
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isLifetimeMember(rights) {
  const level = String(
    pick(rights, ['membershipLevel', 'membership_level'], '')
  ).trim().toUpperCase();

  const name = String(
    pick(rights, ['membershipName', 'membership_name'], '')
  ).trim();

  if (level === 'LIFETIME') return true;
  if (/终身|永久|LIFE/i.test(name)) return true;

  return false;
}

function normalizeMembershipName(rights) {
  const rawName = String(
    pick(rights, ['membershipName', 'membership_name'], '')
  ).trim();

  const rawLevel = String(
    pick(rights, ['membershipLevel', 'membership_level'], '')
  ).trim().toUpperCase();

  if (isLifetimeMember(rights)) return '终身会员';

  if (rawName) return rawName;
<<<<<<< HEAD
  if (rawLevel === 'FREE') return '体验会员';
  if (rawLevel === 'MONTH') return '月卡';
  if (rawLevel === 'QUARTER') return '季卡';
  if (rawLevel === 'YEAR' || rawLevel === 'ANNUAL') return '年卡';
=======

  if (rawLevel === 'YEAR' || rawLevel === 'ANNUAL') return '年度会员';
  if (rawLevel === 'QUARTER') return '季度会员';
  if (rawLevel === 'MONTH') return '月度会员';
  if (rawLevel === 'FREE') return '体验会员';
>>>>>>> parent of 02b7517 (fix: restore lifetime member display and clean pay intro page)

  return '未开通会员';
}

function formatExpireText(rights) {
  if (isLifetimeMember(rights)) return '终身有效';

  let expireAt = pick(rights, ['membershipExpireAt', 'membership_expire_at'], 0);
  expireAt = toNumber(expireAt, 0);

  if (!expireAt) return '';

<<<<<<< HEAD
=======
  // 兼容秒 / 毫秒时间戳
>>>>>>> parent of 02b7517 (fix: restore lifetime member display and clean pay intro page)
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
<<<<<<< HEAD
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
=======
    planList: [
      {
        key: 'diagnosis',
        title: '1 对 1 风控诊断',
        desc: '适合先做一次深度诊断，明确当下交易短板'
      },
      {
        key: 'camp',
        title: '进阶控局者训练营',
        desc: '适合需要阶段性陪跑与规则固化的人群'
      },
      {
        key: 'toolkit',
        title: '高级风控工具包',
        desc: '适合需要工具与模板长期辅助的用户'
>>>>>>> parent of 02b7517 (fix: restore lifetime member display and clean pay intro page)
      }
    ]
  },

  onShow() {
    this.syncFromStorage();
  },

  syncFromStorage() {
    const rights = wx.getStorageSync('userRights') || {};
    const profile = wx.getStorageSync('fissionProfile') || {};

    const inviteCode = String(
      pick(rights, ['inviteCode', 'invite_code'], '') ||
      pick(profile, ['invite_code', 'inviteCode'], '')
    ).trim().toUpperCase();

    this.setData({
<<<<<<< HEAD
      membershipName: normalizeMembershipName(rights, profile),
      freeCalcTimes: Number(pick(rights, ['freeCalcTimes', 'free_calc_times'], 0)) || 0,
      inviteCode,
      membershipExpireText: formatExpireText(rights, profile),
      isLifetimeMember: isLifetime(rights, profile)
=======
      membershipName: normalizeMembershipName(rights),
      freeCalcTimes: toNumber(pick(rights, ['freeCalcTimes', 'free_calc_times'], 0), 0),
      inviteCode,
      membershipExpireText: formatExpireText(rights),
      isLifetimeMember: isLifetimeMember(rights)
>>>>>>> parent of 02b7517 (fix: restore lifetime member display and clean pay intro page)
    });
  },

  goPayIntro(e) {
    const ds = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const levelName = ds.levelName || '会员服务';

<<<<<<< HEAD
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
=======
    wx.navigateTo({
      url: '/pages/pay/index?levelName=' + encodeURIComponent(levelName)
    });
>>>>>>> parent of 02b7517 (fix: restore lifetime member display and clean pay intro page)
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