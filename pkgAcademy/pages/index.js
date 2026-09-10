// pkgAcademy/pages/index.js
// 控局者学院 · 列表（数据驱动，内容来自 utils/courseManifest.js）
// [58 号方案 波次1] 接入单课解锁：免费课直读，其余按「会员 / 积分 / 1元首课 / 19.9 正价」解锁。
// 解锁是成交引擎不是商品售卖：1 元首课制造微承诺，解锁后立即进课减少流失。
const manifest = require('../../utils/courseManifest.js');
const funnel = require('../../utils/funnel.js');
const academyApi = require('../../utils/academyApi.js');

const PROGRESS_KEY = 'esCourseProgress';

function readProgress() {
  try {
    return wx.getStorageSync(PROGRESS_KEY) || {};
  } catch (e) {
    return {};
  }
}

Page({
  data: {
    modules: [],
    doneCount: 0,
    totalCount: 0,
    aiBadge: '内容由熵盾 AI 教研生成',

    // 解锁相关
    ent: null, // { list, isMember, points, pointCost, firstOfferUsed }
    showUnlock: false,
    unlockLesson: null, // { id, title }
    unlocking: false,
    memberPitch: academyApi.MEMBER_PITCH,

    // 仅体验版/开发版可见的联调开关：把当前账号当成非会员，用于验证解锁与支付链路
    isTrialEnv: false,
    forceNonMember: false
  },

  onLoad() {
    let env = 'release';
    try {
      const acct = wx.getAccountInfoSync();
      env = (acct && acct.miniProgram && acct.miniProgram.envVersion) || 'release';
    } catch (e) {}
    this.setData({ isTrialEnv: env !== 'release' });
    this.buildModules();
  },

  // [联调] 切换「模拟非会员」——正式版(release)下 UI 不显示此开关
  toggleNonMember() {
    const v = !this.data.forceNonMember;
    this.setData({ forceNonMember: v });
    this.loadEntitlements();
    wx.showToast({ title: v ? '已模拟非会员' : '已恢复真实身份', icon: 'none' });
  },

  onShow() {
    funnel.log('ACADEMY_VIEW', { ts: Date.now() });
    this.loadEntitlements();
  },

  loadEntitlements() {
    const cid = academyApi.ensureClientId();
    academyApi.getEntitlements(cid).then((d) => {
      let ent = d && d.ok ? d : null;
      // 联调：模拟非会员，让会员账号也能看到并走通解锁/支付链路
      if (ent && this.data.forceNonMember) ent = Object.assign({}, ent, { isMember: false });
      this.setData({ ent });
      this.buildModules();
    });
  },

  buildModules() {
    const prog = readProgress();
    const ent = this.data.ent;
    const modules = manifest.MODULES.map((m) => {
      const lessons = manifest.lessonsOfModule(m.id).map((l) => ({
        id: l.id,
        title: l.title,
        subtitle: l.subtitle || '',
        unlock: l.unlock,
        unlockLabel: manifest.unlockLabel(l.unlock),
        duration: l.duration || 4,
        ready: !!l.blocks, // 有内容=可学；null=AI 制作中
        done: !!prog[l.id],
        locked: !academyApi.canRead(l, ent)
      }));
      const doneInModule = lessons.filter((l) => l.done).length;
      return {
        id: m.id,
        name: m.name,
        level: m.level,
        desc: m.desc,
        lessons,
        doneInModule,
        totalInModule: lessons.length
      };
    });
    const doneCount = Object.keys(prog).length;
    this.setData({ modules, doneCount, totalCount: manifest.LESSONS.length });
  },

  onLessonTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const lesson = manifest.getLesson(id);
    if (!lesson || !lesson.blocks) {
      wx.showToast({ title: '本节由 AI 制作中', icon: 'none' });
      return;
    }
    if (!academyApi.canRead(lesson, this.data.ent)) {
      this.setData({
        showUnlock: true,
        unlockLesson: { id: lesson.id, title: lesson.title }
      });
      return;
    }
    wx.navigateTo({ url: `/pkgAcademy/pages/lesson?id=${id}` });
  },

  onCloseUnlock() {
    this.setData({ showUnlock: false, unlockLesson: null });
  },

  onNoop() {
    // 阻止点击穿透到遮罩层（关闭面板）
  },

  // 解锁成功后：刷新权益 + 直接进课（营销：不让用户在成功页流失）
  afterUnlocked(id) {
    wx.showToast({ title: '解锁成功', icon: 'success' });
    this.setData({ showUnlock: false, unlockLesson: null });
    this.loadEntitlements();
    wx.navigateTo({ url: `/pkgAcademy/pages/lesson?id=${id}` });
  },

  onUnlockByPoints() {
    if (this.data.unlocking) return;
    const ul = this.data.unlockLesson;
    if (!ul) return;
    const ent = this.data.ent || {};
    const need = Number(ent.pointCost) || 80;
    const bal = Number(ent.points) || 0;

    if (bal < need) {
      wx.showToast({ title: `积分不足：需 ${need}，现有 ${bal}`, icon: 'none', duration: 2000 });
      return;
    }
    this.setData({ unlocking: true });
    const cid = academyApi.ensureClientId();
    academyApi.unlockByPoints(cid, ul.id).then((d) => {
      this.setData({ unlocking: false });
      if (d && d.ok) {
        this.afterUnlocked(ul.id);
      } else {
        wx.showToast({ title: (d && d.message) || '解锁失败', icon: 'none' });
      }
    });
  },

  onUnlockByPaid(e) {
    if (this.data.unlocking) return;
    const ul = this.data.unlockLesson;
    if (!ul) return;
    const productCode = e.currentTarget.dataset.code;
    if (!productCode) return;

    this.setData({ unlocking: true });
    const cid = academyApi.ensureClientId();
    academyApi.payAndUnlock(cid, ul.id, productCode, '控局者学院 · 单课解锁').then((r) => {
      this.setData({ unlocking: false });
      if (r && r.ok) {
        this.afterUnlocked(ul.id);
        return;
      }
      if (r && r.cancelled) return; // 用户主动取消，不打扰
      // 已付款但解锁失败：必须明确告知，避免资损纠纷
      if (r && r.paid) {
        wx.showModal({
          title: '付款已成功',
          content: '课程解锁同步失败，请截图联系客服处理（订单已记录）',
          showCancel: false
        });
        return;
      }
      wx.showToast({ title: (r && r.message) || '支付未完成', icon: 'none' });
    });
  },

  // 会员引导：课程只当赠品讲，主价值是测算次数（口径见 58 号方案）
  onGoMember() {
    wx.navigateTo({ url: '/pages/pay/index' });
  }
});
