// pkgChallenge/seasonRank/index.js —— A-2《30 天守纪挑战赛》双榜 + 地区维度
// 达标率榜（season）+ 最长连续守纪天数榜（season_streak）
// 维度：全国榜 / 本省榜（scope=region，需用户在「我的」设置地区，不强采集）
const rankApi = require('../../utils/rankApi.js');
const seasonApi = require('../../utils/seasonApi.js');

Page({
  data: {
    tab: 'rate',           // rate | streak
    scope: 'global',       // global | region
    regionName: '',        // 用户设置的省份名，如「广东」
    regionSet: false,
    seasonNo: 'S1',
    rateList: [],
    streakList: [],
    meRate: null,
    meStreak: null,
    loading: true
  },

  onShow() {
    let region = '';
    try { region = wx.getStorageSync('userRegion') || ''; } catch (e) {}
    this.setData({ regionName: region, regionSet: !!region });
    this.resolveSeason();
  },

  resolveSeason() {
    let no = 'S1';
    try {
      const s = seasonApi.current();
      if (s && s.season && s.season.season_no) no = s.season.season_no;
    } catch (e) {}
    this.setData({ seasonNo: no, loading: true });
    this.loadBoth(no);
  },

  async loadBoth(no) {
    const scope = this.data.scope;
    const region = scope === 'region' ? this.data.regionName : '';
    const [rateRes, streakRes] = await Promise.all([
      rankApi.getRank({ activity: 'season', period: no, scope, region, limit: 100 }),
      rankApi.getRank({ activity: 'season_streak', period: no, scope, region, limit: 100 })
    ]);

    const rateData = (rateRes && rateRes.ok && rateRes.data) || null;
    const streakData = (streakRes && streakRes.ok && streakRes.data) || null;

    this.setData({
      rateList: rateData ? rateData.list : [],
      meRate: rateData ? rateData.me : null,
      streakList: streakData ? streakData.list : [],
      meStreak: streakData ? streakData.me : null,
      loading: false
    });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.tab) return;
    this.setData({ tab });
  },

  switchScope(e) {
    const scope = e.currentTarget.dataset.scope;
    if (scope === this.data.scope) return;
    if (scope === 'region' && !this.data.regionSet) {
      wx.showToast({ title: '请先在「我的」设置地区', icon: 'none' });
      setTimeout(() => wx.switchTab({ url: '/pages/profile/index' }), 1200);
      return;
    }
    this.setData({ scope, loading: true });
    this.loadBoth(this.data.seasonNo);
  },

  goExam() {
    wx.navigateTo({ url: '/pkgChallenge/exam/intro/index' });
  }
});
