// pkgAcademy/pages/index.js
// 控局者学院 · 列表（数据驱动，内容来自 utils/courseManifest.js）
const manifest = require('../../utils/courseManifest.js');
const funnel = require('../../utils/funnel.js');

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
    aiBadge: '内容由熵盾 AI 教研生成'
  },

  onLoad() {
    this.buildModules();
  },

  onShow() {
    funnel.log('ACADEMY_VIEW', { ts: Date.now() });
    this.buildModules();
  },

  buildModules() {
    const prog = readProgress();
    const modules = manifest.MODULES.map((m) => {
      const lessons = manifest.lessonsOfModule(m.id).map((l) => ({
        id: l.id,
        title: l.title,
        subtitle: l.subtitle || '',
        unlock: l.unlock,
        unlockLabel: manifest.unlockLabel(l.unlock),
        duration: l.duration || 4,
        ready: !!l.blocks, // 有内容=可学；null=AI 制作中
        done: !!prog[l.id]
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
    wx.navigateTo({ url: `/pkgAcademy/pages/lesson?id=${id}` });
  }
});
