// pkgAcademy/pages/lesson.js
// 控局者学院 · 课程详情（CourseRenderer：内容区块驱动，加新形态只加 block 类型）
// [58 号方案 波次1] 真门禁：未解锁不渲染正文。必须拦在这里——用户可能通过分享链接
// 直达本页，若只在列表页拦截，等于没拦。
const manifest = require('../../utils/courseManifest.js');
const points = require('../../utils/points.js');
const academyApi = require('../../utils/academyApi.js');
const funnel = require('../../utils/funnel.js');

const PROGRESS_KEY = 'esCourseProgress';

Page({
  data: {
    notReady: false,
    id: '',
    title: '',
    moduleName: '',
    blocks: [],
    unlock: 'free',
    unlockLabel: '免费',
    unlockNote: '',
    done: false,
    aiBadge: '本内容由熵盾 AI 教研生成 · 无真人讲师',

    // 解锁相关
    ent: null,
    locked: false,
    checked: false, // 权益拉取是否完成（未完成不渲染正文，防闪现）
    unlocking: false,
    memberPitch: academyApi.MEMBER_PITCH,
    iosCashHidden: academyApi.iosCashFrozen(), // [合规·iOS] true 时隐藏现金购买按钮

    // [58 号方案 波次2] 实操引导：学完即引导去用计算器（转化最强位）
    practice: null
  },

  onLoad(options) {
    const id = (options && options.id) || '';
    const lesson = manifest.getLesson(id);
    if (!lesson || !lesson.blocks) {
      this.setData({ notReady: true, id, checked: true });
      return;
    }
    const mod = manifest.getModule(lesson.moduleId) || {};
    const unlock = lesson.unlock;

    let prog = {};
    try {
      prog = wx.getStorageSync(PROGRESS_KEY) || {};
    } catch (e) {}

    const done = !!prog[id];
    this.setData({
      id,
      title: lesson.title,
      moduleName: mod.name || '',
      unlock,
      unlockLabel: manifest.unlockLabel(unlock),
      done,
      // 已学完的课进来也显示实操卡（用户可能回看）
      practice: done ? manifest.practiceOf(id) : null
    });

    this.checkAccess(lesson);
  },

  // 拉取权益并判断是否有权阅读；未解锁则不下发正文
  checkAccess(lesson) {
    const cid = academyApi.ensureClientId();
    academyApi.getEntitlements(cid).then((d) => {
      const ent = d && d.ok ? d : null;
      const ok = academyApi.canRead(lesson, ent);
      let unlockNote = '';
      if (!ok) {
        const cashOff = academyApi.iosCashFrozen() || (ent && ent.firstOfferEnabled === false);
        if (unlock === 'points') unlockNote = `可用 ${(ent && ent.pointCost) || 80} 积分解锁`;
        else if (unlock === 'paid') unlockNote = cashOff ? `可用 ${(ent && ent.pointCost) || 80} 积分解锁` : '1 元解锁首课，或 19.9 元解锁本课';
        else if (unlock === 'member') unlockNote = '会员免费看全部 72 课';
      }
      this.setData({
        ent,
        locked: !ok,
        checked: true,
        unlockNote,
        blocks: ok ? lesson.blocks : []
      });
    });
  },

  onMarkDone() {
    const id = this.data.id;
    if (!id) return;
    try {
      const prog = wx.getStorageSync(PROGRESS_KEY) || {};
      prog[id] = true;
      wx.setStorageSync(PROGRESS_KEY, prog);
    } catch (e) {}

    // 埋点：学完课（后续要能回答"哪门课带来的会员最多"）
    try {
      funnel.log('LESSON_DONE', { lessonId: id, moduleId: String(id || '').charAt(0) });
      academyApi.markLessonTouch(id); // 归因：后续会员成交可追溯到本课
    } catch (e) {}

    const cid = academyApi.ensureClientId();
    points.grantCourse(cid, id).then(() => {
      wx.showToast({ title: '学完 +20 积分', icon: 'success' });
      this.setData({ done: true, practice: manifest.practiceOf(id) });
      this.scrollToPractice();
    }).catch(() => {
      this.setData({ done: true, practice: manifest.practiceOf(id) });
      this.scrollToPractice();
    });

    // 同步刷新个人中心积分卡（若用户稍后返回）
    try {
      const appInst = getApp && getApp();
      if (appInst && appInst.globalData) appInst.globalData.esCourseDirty = true;
    } catch (e) {}
  },

  // ---------- 解锁（与列表页同逻辑）----------
  onUnlockByPoints() {
    if (this.data.unlocking) return;
    const ent = this.data.ent || {};
    const need = Number(ent.pointCost) || 80;
    const bal = Number(ent.points) || 0;
    if (bal < need) {
      wx.showToast({ title: `积分不足：需 ${need}，现有 ${bal}`, icon: 'none', duration: 2000 });
      return;
    }
    this.setData({ unlocking: true });
    academyApi.unlockByPoints(academyApi.ensureClientId(), this.data.id).then((d) => {
      this.setData({ unlocking: false });
      if (d && d.ok) {
        wx.showToast({ title: '解锁成功', icon: 'success' });
        const lesson = manifest.getLesson(this.data.id);
        if (lesson) this.checkAccess(lesson);
      } else {
        wx.showToast({ title: (d && d.message) || '解锁失败', icon: 'none' });
      }
    });
  },

  onUnlockByPaid(e) {
    if (this.data.unlocking) return;
    const productCode = e.currentTarget.dataset.code;
    if (!productCode) return;
    this.setData({ unlocking: true });
    academyApi
      .payAndUnlock(academyApi.ensureClientId(), this.data.id, productCode, '控局者学院 · 单课解锁')
      .then((r) => {
        this.setData({ unlocking: false });
        if (r && r.ok) {
          wx.showToast({ title: '解锁成功', icon: 'success' });
          const lesson = manifest.getLesson(this.data.id);
          if (lesson) this.checkAccess(lesson);
          return;
        }
        if (r && r.cancelled) return;
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

  onGoMember() {
    wx.navigateTo({ url: '/pages/pay/index' });
  },

  // [波次2] 实操引导：学完 → 去计算器用一次（用完免费次数即触发会员引导）
  // 学完后自动把页面滚到底部引导卡 —— 否则卡在屏幕外用户根本看不到（曾因此反馈"没看到去算"）
  scrollToPractice() {
    setTimeout(() => {
      const q = wx.createSelectorQuery().in(this);
      q.select('.practice-card').boundingClientRect();
      q.selectViewport().scrollOffset();
      q.exec((res) => {
        const rect = res && res[0];
        const off = res && res[1];
        if (!rect || !off || rect.top == null) return;
        const target = (off.scrollTop || 0) + rect.top - 160;
        wx.pageScrollTo({ scrollTop: Math.max(0, target), duration: 350 });
      });
    }, 450); // 等 wx:if 渲染完成 + Toast 可见后再滚
  },

  onGoPractice() {
    const p = this.data.practice;
    if (!p) return;
    try {
      funnel.log('LESSON_PRACTICE_TAP', {
        lessonId: this.data.id,
        planType: p.planType || 'steady'
      });
    } catch (e) {}
    wx.navigateTo({
      url: `/pages/riskCalculator/index?practiceFrom=${encodeURIComponent(this.data.id)}`
    });
  },

  onShareAppMessage() {
    return {
      title: '我在学熵盾控局者学院：' + this.data.title,
      path: `/pkgAcademy/pages/lesson?id=${this.data.id}`
    };
  }
});
