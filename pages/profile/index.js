// pages/profile/index.js
// G4 重构（22 号方案）：个人中心四层单列 + 代码债清偿
//  - onLoad 首次拉取；onShow 仅本地快照 + 60s 节流差量同步（去重 onLoad/onShow 重复请求）
//  - fission 双请求合并（差量同步逻辑并入 fetchFissionProfile，删除原 onShow 内联块）
//  - 头像/昵称改用新版 chooseAvatar / nickname 输入组件，可更新
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
  const raw = String(value || '').trim();
  if (!raw) return '';

  function pad(n) {
    return String(n).padStart(2, '0');
  }
  function buildText(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function toDate(v) {
    if (!v) return null;
    if (/^\d{13}$/.test(v)) {
      const d = new Date(Number(v));
      return isNaN(d.getTime()) ? null : d;
    }
    if (/^\d{10}$/.test(v)) {
      const d = new Date(Number(v) * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const d = new Date(v.replace(/-/g, '/') + ' 00:00:00');
      return isNaN(d.getTime()) ? null : d;
    }
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(v)) {
      const d = new Date(v + ' 00:00:00');
      return isNaN(d.getTime()) ? null : d;
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) {
      const d = new Date(v.replace(/-/g, '/'));
      return isNaN(d.getTime()) ? null : d;
    }
    if (/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  }

  const d = toDate(raw);
  if (!d) return raw;
  return buildText(d);
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

// 节流：60s 内 fission 差量同步只跑一次（去重 onShow 全量刷新）
let lastFissionSync = 0;

Page({
  data: {
    avatarUrl: '',
    nickName: '熵盾用户',

    // L1 身份铭牌
    levelText: 'V1 见习控局者',
    streakDays: 0,

    // L2 资产账本
    isMember: false,
    membershipName: '未开通',
    membershipExpireText: '-',
    planActionText: '开通会员',
    taskRightsText: '0次',
    campProgressText: '0/7',

    // L3 战场
    challengeText: '第一赛季 · 预约中',
    witnessCount: 0,
    myInviteCode: '',
    invitedCountText: '—',

    // L4 服务台
    isVisitAdmin: false,
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
    },
    quickVisitTexts: {
      title: '线下来访提醒',
      timeFallback: '时间待确认',
      purposeFallback: '交流风控体系',
      statusFallback: '待确认'
    }
  },

  onLoad(options) {
    funnel.log('PROFILE_VIEW', { from: (options && options.from) || '' });
    this.clientId = ensureClientId();
    // 首次进入：本地快照 + 全量拉取
    this.refreshLocalSnapshot();
    this.fetchFissionProfile();
    this.fetchLatestVisit();
    this.fetchAdminAccess();
  },

  onShow() {
    // 返回页面：仅本地快照 + 节流差量同步，不再重复全量请求（去重 C1）
    this.refreshLocalSnapshot();
    this.throttledSyncFission();
  },

  throttledSyncFission() {
    const now = Date.now();
    if (now - lastFissionSync < 60000) return;
    lastFissionSync = now;
    this.fetchFissionProfile();
  },

  refreshLocalSnapshot() {
    const cached = wx.getStorageSync('userInfo') || {};
    const avatarUrl = cached.avatarUrl || '';
    const nickName = cached.nickName || '熵盾用户';
    this.setData({ avatarUrl, nickName });

    const ur = wx.getStorageSync('userRights') || {};
    const effectiveRights = ur.effectiveRights || wx.getStorageSync('effectiveRights') || {};
    const membership = effectiveRights.membership || {};
    const task = effectiveRights.task || {};

    const freeCalcTimes = Number(
      task.freeCalcTimes != null
        ? task.freeCalcTimes
        : task.rewardTimes != null
        ? task.rewardTimes
        : pick(ur, ['freeCalcTimes', 'free_calc_times'], 0)
    ) || 0;

    const rawName = String(
      membership.name || pick(ur, ['membershipName', 'membership_name', 'currentMembershipName'], '')
    ).trim();
    const expireAt = Number(
      membership.expireAt || pick(ur, ['membershipExpireAt', 'membership_expire_at', 'trialExpireAt'], 0)
    ) || 0;
    const active = membership.active === true || (!!expireAt && expireAt > Date.now());

    function normalizeName(n) {
      const s = String(n || '').trim();
      if (!s || s === 'FREE' || s === 'free' || s === '未开通会员' || s === '未开通' || s === '体验会员') {
        return '未开通';
      }
      return s;
    }

    let membershipName = normalizeName(rawName);
    let membershipExpireText = '-';
    const isMember = membershipName !== '未开通';

    if (isMember) {
      membershipName = active ? membershipName : membershipName + '（已到期）';
      if (expireAt) {
        const d = new Date(expireAt);
        if (!isNaN(d.getTime())) {
          membershipExpireText = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
            d.getDate()
          ).padStart(2, '0')}`;
        }
      }
    }

    let planActionText = '开通会员';
    if (isMember) planActionText = active ? '查看权益' : '续费会员';

    const logs = wx.getStorageSync('campDailyLogs');
    const doneDays = Array.isArray(logs)
      ? Math.min(7, logs.length)
      : Number(pick(ur, ['campDaysDone'], 0)) || 0;
    const campProgressText = `${Math.max(0, Math.min(7, doneDays))}/7`;

    // L1 铭牌：段位 + 连续打卡天数（本地推导，后端未就绪先默认态）
    const streakDays = Number(wx.getStorageSync('checkinStreak') || 0) || 0;
    const riskLevel = wx.getStorageSync('riskLevel') || wx.getStorageSync('srrLevel') || '';
    const levelText = riskLevel ? String(riskLevel) : 'V1 见习控局者';

    this.setData({
      isMember,
      membershipName,
      membershipExpireText,
      planActionText,
      taskRightsText: `${Math.max(0, freeCalcTimes)}次`,
      campProgressText,
      streakDays,
      levelText
    });
  },

  fetchEsPoints() {
    const points = require('../../utils/points.js');
    const cid = this.clientId || ensureClientId();
    if (!cid) return;
    points.getMe(cid).then((d) => {
      if (!d || !d.ok) return;
      const rewards = (d.pendingRewards || []).map((r) => ({ id: r.id, label: r.label, claimed: false }));
      this.setData({
        esPoints: Number(d.points) || 0,
        esLevel: Number(d.level) || 0,
        esLevelName: d.levelName || '入门守护者',
        esNextLevelAt: Number(d.nextLevelAt) || 0,
        esPendingRewards: rewards,
      });
    });
  },

  onClaimReward(e) {
    const id = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || '';
    if (!id) return;
    const points = require('../../utils/points.js');
    const cid = this.clientId || ensureClientId();
    points.claimReward(cid, id).then((d) => {
      if (d && d.ok) { wx.showToast({ title: '已领取', icon: 'success' }); this.fetchEsPoints(); }
    });
  },

  fetchFissionProfile() {
    const baseUrl = getBaseUrl();
    const clientId = this.clientId || ensureClientId();
    if (!baseUrl || !clientId) return;

    const url = `${baseUrl}/api/fission/profile?clientId=${encodeURIComponent(clientId)}`;
    requestJson(url, 'GET')
      .then((data) => {
        if (!data || !data.ok) return;

        const profile = data.profile || {};
        const total = Number(pick(data, ['total_reward_times'], 0)) || 0;
        const myInviteCode = String(pick(profile, ['my_invite_code', 'invite_code', 'inviteCode', 'myInviteCode'], ''));
        const invitedByCode = String(pick(profile, ['invited_by_code', 'invitedByCode', 'invited_by', 'invitedBy'], ''));
        const invitedCount = Number(pick(profile, ['invited_count', 'inviteCount'], 0)) || 0;

        // 差量同步 fission 奖励到本地权益（合并原 onShow 内联块，去重 C2）
        const rights = wx.getStorageSync('userRights') || {};
        const currentFree = Number(rights.freeCalcTimes || 0) || 0;
        let lastSynced = Number(wx.getStorageSync('fission_total_reward_times_synced') || 0) || 0;
        if (lastSynced === 0 && currentFree > 0) {
          wx.setStorageSync('fission_total_reward_times_synced', total);
          lastSynced = total;
        }
        const delta = total - lastSynced;
        if (delta > 0) {
          rights.freeCalcTimes = currentFree + delta;
          wx.setStorageSync('userRights', rights);
          wx.setStorageSync('fission_total_reward_times_synced', total);
        }

        this.setData({
          myInviteCode,
          invitedByCode,
          invitedCountText: invitedCount ? String(invitedCount) : '—',
          fissionSyncedTimes: total || this.data.fissionSyncedTimes
        });
        this.refreshLocalSnapshot();
      })
      .catch((err) => {
        console.warn('[profile] fission profile fail:', err);
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
        this.setData({ latestVisit: normalizeLatestVisit(list) });
      })
      .catch((err) => {
        console.warn('[profile] visit my-list fail:', err);
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
        this.setData({ isVisitAdmin: !!(data && data.ok && data.isVisitAdmin) });
      })
      .catch((err) => {
        console.warn('[profile] admin access fail:', err);
        this.setData({ isVisitAdmin: false });
      });
  },

  // 头像：新版 chooseAvatar 组件
  onChooseAvatar(e) {
    const avatarUrl = (e && e.detail && e.detail.avatarUrl) || '';
    if (!avatarUrl) return;
    const cached = wx.getStorageSync('userInfo') || {};
    cached.avatarUrl = avatarUrl;
    wx.setStorageSync('userInfo', cached);
    this.setData({ avatarUrl });
  },

  // 昵称：新版 nickname 输入
  onInputNickname(e) {
    const nickName = (e && e.detail && e.detail.value) || '';
    if (!nickName) return;
    const cached = wx.getStorageSync('userInfo') || {};
    cached.nickName = nickName;
    wx.setStorageSync('userInfo', cached);
    this.setData({ nickName });
  },

  copyInviteCode() {
    const code = this.data.myInviteCode;
    if (!code) {
      wx.showToast({ title: '邀请码待生成', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: code,
      success() {
        wx.showToast({ title: '已复制', icon: 'none' });
      }
    });
  },

  // L2 → 会员页
  goMembership() {
    wx.navigateTo({ url: '/pages/membership/index?from=profile' });
  },

  // L4 → 订阅与通知管理
  goSettings() {
    wx.navigateTo({ url: '/pkgService/settings/recall/index' });
  },

  // L3 → 挑战赛
  goChallenge() {
    wx.navigateTo({ url: '/pkgChallenge/campIntro/index' });
  },

  // L3 → 见证人
  goWitness() {
    wx.navigateTo({ url: '/pkgService/myInvite/index' });
  },


  goTradeRecord() {
    wx.navigateTo({ url: '/pkgReport/tradeRecord/index?from=profile' });
  },

  goLongArchive() {
    wx.navigateTo({ url: '/pkgReport/longArchive/index?from=profile' });
  },

  goRiskReport() {
    wx.navigateTo({ url: '/pkgReport/riskReport/index?from=profile' });
  },


  goVisitBooking() {
    wx.navigateTo({ url: '/pkgService/visitBooking/index' });
  },




  openServiceAgreement() {
    wx.navigateTo({ url: '/pages/agreementService/index' });
  },

  openPrivacyContract() {
    wx.navigateTo({ url: '/pages/agreementPrivacy/index' });
  },

  onTapLatestVisitQuick() {
    if (!this.data.latestVisit) return;
    if (this.data.isVisitAdmin) {
      wx.navigateTo({ url: '/pkgService/visitAdmin/index' });
      return;
    }
    wx.navigateTo({ url: '/pkgService/visitMyList/index' });
  },

  tapAboutEntropy() {
    // 管理端入口：普通用户不可见，仅管理员可进入
    if (!this.data.isVisitAdmin) return;
    wx.navigateTo({ url: '/pkgService/visitAdmin/index' });
  }
});
