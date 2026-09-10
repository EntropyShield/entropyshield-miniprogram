// pkgChallenge/pkRank/index.js —— 神算子榜（68 号）
// 仅按预测命中率排序，绝不展示战力值余额/赢额（合规红线）
const pkApi = require('../../utils/pkApi.js');
const seasonApi = require('../../utils/seasonApi.js');

const GRADE = { rookie: '新兵', bronze: '青铜', silver: '白银', gold: '黄金', diamond: '钻石' };

Page({
  data: {
    seasonNo: 'S1',
    list: [],
    loading: true
  },

  onShow() { this.load(); },

  async load() {
    try {
      const cur = await seasonApi.current();
      const seasonNo = (cur && cur.seasonNo) || 'S1';
      const res = await pkApi.forecastRank(seasonNo);
      const list = ((res && res.ok && res.list) || []).map((it) => {
        it.gradeText = GRADE[it.grade] || '新兵';
        return it;
      });
      this.setData({ seasonNo, list, loading: false });
    } catch (e) {
      this.setData({ loading: false });
    }
  }
});
