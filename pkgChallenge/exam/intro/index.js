// pkgChallenge/exam/intro/index.js —— A-1 统考落地页（带码、先考后注册、直接开考）
const examApi = require('../../utils/examApi.js');

const PENDING_INVITE_KEY = 'pendingInviteCode';

Page({
  data: {
    inviteCode: '',
    hasTaken: false,
    bestScore: 0,
    bestLevel: '',
    beatPct: null,
    attempts: 0,
    loading: true
  },

  onLoad(options) {
    // 带码进入：记录入口邀请码（仅展示 + 待绑定，注册/绑定由裂变链路自动完成）
    try {
      const raw = (options && options.inviteCode) || '';
      const code = String(raw).toUpperCase().trim();
      if (code) {
        this.setData({ inviteCode: code });
        const old = wx.getStorageSync(PENDING_INVITE_KEY) || '';
        if (!old) wx.setStorageSync(PENDING_INVITE_KEY, code);
        const app = getApp && getApp();
        if (app && app.globalData) app.globalData.inviteCode = code;
      }
    } catch (e) {}

    examApi.ensureLocalClientId();
    this.loadMine();
  },

  async loadMine() {
    try {
      const res = examApi.me();
      const d = (res && res.ok && res.data) || null;
      if (d && d.best) {
        this.setData({
          hasTaken: true,
          bestScore: Number(d.best.score || 0),
          bestLevel: d.best.levelTag || '',
          beatPct: (d.beatPct != null ? d.beatPct : null),
          attempts: Number(d.attempts || 0),
          loading: false
        });
      } else {
        this.setData({ loading: false });
      }
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  goStart() {
    wx.navigateTo({ url: '/pkgChallenge/exam/doing/index' });
  },

  goRank() {
    wx.navigateTo({ url: '/pkgChallenge/seasonRank/index' });
  },

  onShareAppMessage() {
    const app = getApp && getApp();
    const code = (this.data.inviteCode || (app && app.globalData && app.globalData.myInviteCode) || '').toUpperCase();
    const path = code
      ? `/pkgChallenge/exam/intro/index?inviteCode=${code}`
      : `/pkgChallenge/exam/intro/index`;
    return {
      title: '散户风控力大考 · 20 题测出你的控亏段位',
      path
    };
  }
});
