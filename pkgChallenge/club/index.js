// pkgChallenge/club/index.js
// 守护者俱乐部：展示会员等级权益 + 近期活动 / 沙龙入口（D-6，2026-09-10 填充）
const activityApi = require('../../utils/activityApi.js');

// 活动元数据（标题/副标题/类型/路径/时间）全部由后端 /api/activity/list 提供，
// 前端不再硬编码映射——新增活动只需后端加一条记录，不用改代码、不用发版。

const USER_RIGHTS_KEY = 'userRights';

function parseExpireMs(v) {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.replace(/-/g, '/')).getTime();
  const n = Number(s);
  return Number.isFinite(n) && n > 1e12 ? n : 0;
}

function expireText(ms) {
  if (!ms) return '-';
  const d = new Date(ms);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

Page({
  data: {
    membershipName: '未开通会员',
    freeCalcTimes: 0,
    expireText: '-',
    isMember: false,
    liveList: [],
    upcomingList: [],
    pastList: [],
    hasAct: false
  },

  onShow() {
    this.loadRights();
    this.loadActivities();
  },

  loadRights() {
    const rights = wx.getStorageSync(USER_RIGHTS_KEY) || {};
    const eff = wx.getStorageSync('effectiveRights') || {};
    const membership = eff.membership || {};
    const task = eff.task || {};
    const freeCalcTimes = Number(
      task.freeCalcTimes != null ? task.freeCalcTimes : (rights.freeCalcTimes || 0)
    ) || 0;
    const rawName = membership.name || rights.membershipName || rights.membership_name || '';
    const expireMs = parseExpireMs(membership.expireAt || rights.membershipExpireAt || rights.membership_expire_at);
    const active = membership.active === true || (!!expireMs && expireMs > Date.now());
    const isMember = !!rawName && rawName !== '未开通' && rawName !== '未开通会员';
    this.setData({
      membershipName: isMember ? (active ? rawName : rawName + '（已到期）') : '未开通会员',
      freeCalcTimes: Math.max(0, freeCalcTimes),
      expireText: expireMs ? expireText(expireMs) : '-',
      isMember: isMember && active
    });
  },

  // 统一活动：进行中 / 即将开始 / 往期（含回放）。公开课、体验课、沙龙见面会、训练营
  // 与统考、挑战赛、晒图节同走一套数据，全部后端配置。
  loadActivities() {
    activityApi.getList().then((d) => {
      const live = (d && d.live) || [];
      const upcoming = (d && d.upcoming) || [];
      const past = (d && d.past) || [];
      this.setData({
        liveList: live,
        upcomingList: upcoming,
        pastList: past,
        hasAct: (live.length + upcoming.length + past.length) > 0
      });
    }).catch(() => {});
  },

  goActivity(e) {
    const path = e.currentTarget.dataset.path;
    if (path) wx.navigateTo({ url: path });
  },

  goVip() {
    wx.switchTab({ url: '/pages/profile/index' });
  }
});
