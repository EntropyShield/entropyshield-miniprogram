// pkgService/myWitness/index.js
// 守纪见证人主页：守纪名片 + 邀请码 + 凭码加入 + 我的见证人/我正在见证
const sup = require('../../utils/supervisorApi.js');

function decorate(it) {
  return {
    id: it.id,
    gradeText: sup.gradeText(it.grade),
    streakDays: it.streakDays || 0,
    totalDays: it.totalDays || 0,
    aPoints: it.aPoints || 0,
    canForecast: it.canForecast ? 1 : 0
  };
}

Page({
  data: {
    loading: true,
    myCard: null,
    inviteCode: '',
    activeTab: 'witness',
    witnessList: [],
    wardList: [],
    hasWitness: false,
    hasWard: false,
    joinCode: '',
    joining: false
  },

  onLoad() {
    this.clientId = sup.getClientId();
    this.loadCard();
    this.loadInvite();
    this.loadWitness();
    this.loadWard();
  },

  async loadCard() {
    const cid = this.clientId;
    if (!cid) {
      this.setData({ loading: false });
      return;
    }
    try {
      const d = await sup.getProfile(cid);
      if (d && d.ok && d.profile) {
        const p = d.profile;
        this.setData({
          myCard: {
            gradeText: sup.gradeText(p.grade),
            streakDays: p.streakDays || 0,
            totalDays: p.totalDays || 0,
            supervisorCount: p.supervisorCount || 0
          }
        });
      }
    } catch (e) {}
    this.setData({ loading: false });
  },

  async loadInvite() {
    const cid = this.clientId;
    if (!cid) return;
    try {
      const d = await sup.getInvite(cid);
      if (d && d.ok && d.code) this.setData({ inviteCode: d.code });
    } catch (e) {}
  },

  async loadWitness() {
    const cid = this.clientId;
    if (!cid) return;
    try {
      const d = await sup.getList(cid);
      if (d && d.ok) {
        const list = (d.list || []).map(decorate);
        this.setData({ witnessList: list, hasWitness: list.length > 0 });
      }
    } catch (e) {}
  },

  async loadWard() {
    const cid = this.clientId;
    if (!cid) return;
    try {
      const d = await sup.getWards(cid);
      if (d && d.ok) {
        const list = (d.list || []).map(decorate);
        this.setData({ wardList: list, hasWard: list.length > 0 });
      }
    } catch (e) {}
  },

  switchTab(e) {
    const t = e.currentTarget.dataset.tab;
    if (t) this.setData({ activeTab: t });
  },

  copyCode() {
    const code = this.data.inviteCode;
    if (!code) {
      wx.showToast({ title: '邀请码生成中', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: code,
      success() {
        wx.showToast({ title: '已复制邀请码', icon: 'none' });
      }
    });
  },

  joinInput(e) {
    this.setData({ joinCode: e.detail.value });
  },

  async doJoin() {
    const code = (this.data.joinCode || '').trim();
    const cid = this.clientId;
    if (!code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    if (!cid) {
      wx.showToast({ title: '未获取到用户ID', icon: 'none' });
      return;
    }
    this.setData({ joining: true });
    try {
      const d = await sup.joinWitness(cid, code);
      if (d && d.ok) {
        wx.showToast({ title: '已成为督察官', icon: 'success' });
        this.setData({ joinCode: '', activeTab: 'ward' });
        this.loadWard();
      } else {
        wx.showToast({ title: (d && d.msg) || '加入失败', icon: 'none' });
      }
    } catch (e) {
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      this.setData({ joining: false });
    }
  },

  goWall() {
    wx.navigateTo({ url: '/pkgService/witnessWall/index' });
  },

  onShareAppMessage() {
    const code = this.data.inviteCode;
    return {
      title: '邀请你做我的守纪督察官，一起把纪律守住',
      path: '/pages/index/index?supervisorCode=' + encodeURIComponent(code || '')
    };
  },

  goBack() {
    const pages = getCurrentPages();
    if (pages && pages.length > 1) wx.navigateBack({ delta: 1 });
    else wx.switchTab({ url: '/pages/profile/index' });
  }
});
