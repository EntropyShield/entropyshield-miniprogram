// pkgAcademy/pages/lesson.js
// 控局者学院 · 课程详情（CourseRenderer：内容区块驱动，加新形态只加 block 类型）
const manifest = require('../../utils/courseManifest.js');
const points = require('../../utils/points.js');

const PROGRESS_KEY = 'esCourseProgress';

function ensureClientId() {
  let cid = wx.getStorageSync('clientId');
  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    wx.setStorageSync('clientId', cid);
  }
  return cid;
}

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
    aiBadge: '本内容由熵盾 AI 教研生成 · 无真人讲师'
  },

  onLoad(options) {
    const id = options && options.id || '';
    const lesson = manifest.getLesson(id);
    if (!lesson || !lesson.blocks) {
      this.setData({ notReady: true, id });
      return;
    }
    const mod = manifest.getModule(lesson.moduleId) || {};
    const unlock = lesson.unlock;
    let unlockNote = '';
    if (unlock === 'points') unlockNote = '正式版：用熵盾积分兑换解锁';
    else if (unlock === 'paid') unlockNote = '正式版：微信虚拟支付付费解锁';
    else if (unlock === 'member') unlockNote = '正式版：开通会员后通看';

    let prog = {};
    try { prog = wx.getStorageSync(PROGRESS_KEY) || {}; } catch (e) {}

    this.setData({
      id,
      title: lesson.title,
      moduleName: mod.name || '',
      blocks: lesson.blocks,
      unlock,
      unlockLabel: manifest.unlockLabel(unlock),
      unlockNote,
      done: !!prog[id]
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

    const cid = ensureClientId();
    points.grantCourse(cid, id).then(() => {
      wx.showToast({ title: '学完 +10 积分', icon: 'success' });
      this.setData({ done: true });
    }).catch(() => {
      this.setData({ done: true });
    });

    // 同步刷新个人中心积分卡（若用户稍后返回）
    try {
      const appInst = getApp && getApp();
      if (appInst && appInst.globalData) appInst.globalData.esCourseDirty = true;
    } catch (e) {}
  },

  onShareAppMessage() {
    return {
      title: '我在学熵盾控局者学院：' + this.data.title,
      path: `/pkgAcademy/pages/lesson?id=${this.data.id}`
    };
  }
});
