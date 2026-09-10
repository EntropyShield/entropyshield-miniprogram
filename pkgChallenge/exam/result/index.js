// pkgChallenge/exam/result/index.js —— A-1 统考成绩页
const examApi = require('../../utils/examApi.js');

const DIM_LABEL = {
  stop: '止损纪律',
  position: '仓位管理',
  emotion: '情绪控制',
  review: '复盘习惯'
};
const DIM_ORDER = ['stop', 'position', 'emotion', 'review'];

Page({
  data: {
    hasData: false,
    loading: true,
    score: 0,
    levelTag: '',
    correct: null,
    total: 0,
    beatPct: null,
    dims: [],          // [{name, pct, right, all}]
    valid: null,
    counted: null,
    rankStatusText: '',
    rankStatusClass: ''
  },

  onLoad() {
    let stash = null;
    try { stash = wx.getStorageSync('examLastResult') || null; } catch (e) {}

    examApi.me().then((res) => {
      const d = (res && res.ok && res.data) || null;
      const meBest = (d && d.best) || null;
      const beatPct = (d && d.beatPct != null) ? d.beatPct : null;

      const score = stash ? stash.score : (meBest ? meBest.score : 0);
      const levelTag = stash ? stash.levelTag : (meBest ? meBest.levelTag : '');

      let dims = [];
      if (stash && stash.dimStat) {
        dims = DIM_ORDER.map((k) => {
          const v = stash.dimStat[k] || { right: 0, all: 0 };
          const pct = v.all > 0 ? Math.round((v.right / v.all) * 100) : 0;
          return { name: DIM_LABEL[k] || k, pct, right: v.right, all: v.all };
        });
      }

      let statusText = '';
      let statusClass = '';
      if (stash) {
        if (stash.valid && stash.counted) {
          statusText = '已计入「统考榜」';
          statusClass = 'ok';
        } else if (!stash.valid) {
          statusText = '本次未计入榜单（作答过快或未答满全卷）';
          statusClass = 'warn';
        } else if (stash.valid && !stash.counted) {
          statusText = '今日已计入更高成绩，本次为练习';
          statusClass = 'muted';
        }
      }

      this.setData({
        hasData: true,
        loading: false,
        score: Number(score || 0),
        levelTag: levelTag || '',
        correct: stash ? stash.correct : null,
        total: stash ? stash.total : 0,
        beatPct,
        dims,
        valid: stash ? stash.valid : null,
        counted: stash ? stash.counted : null,
        rankStatusText: statusText,
        rankStatusClass: statusClass
      });
    }).catch(() => {
      this.setData({ loading: false, hasData: true });
    });
  },

  goRetry() {
    wx.redirectTo({ url: '/pkgChallenge/exam/doing/index' });
  },

  goRank() {
    wx.navigateTo({ url: '/pkgChallenge/seasonRank/index' });
  },

  goBack() {
    wx.navigateBack({ delta: 2 });
  }
});
