// pkgService/honorWall/index.js —— L3 荣誉墙（赛季前 N 名 / 守护者名人堂，纯展示）
const honorApi = require('../../utils/honorApi.js');

Page({
  data: {
    loading: true,
    seasonNo: '',
    seasonTop: [],
    seasonTopEmpty: false,
    hallOfFame: [],
    me: null,
    errMsg: ''
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    this.setData({ loading: true, errMsg: '' });
    honorApi.getHonor(50).then((d) => {
      if (!d || !d.ok) {
        this.setData({ loading: false, errMsg: '加载失败，请稍后重试' });
        return;
      }
      this.setData({
        loading: false,
        seasonNo: d.seasonNo || '',
        seasonTop: d.seasonTop || [],
        seasonTopEmpty: !!d.seasonTopEmpty,
        hallOfFame: d.hallOfFame || [],
        me: d.me || null
      });
    }).catch(() => {
      this.setData({ loading: false, errMsg: '加载失败，请稍后重试' });
    });
  },

  noop() {}
});
