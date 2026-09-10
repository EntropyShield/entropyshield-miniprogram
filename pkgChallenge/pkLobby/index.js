// pkgChallenge/pkLobby/index.js —— 战力值 PK 大厅（68 号）
// 展示本赛季所有盘口 + 我的战力值余额 + 我的盘口入口 + 神算子榜入口
const pkApi = require('../../utils/pkApi.js');
const seasonApi = require('../../utils/seasonApi.js');

Page({
  data: {
    seasonNo: 'S1',
    power: 0,
    powerReady: false,
    myWardId: '',
    myPool: null,
    pools: [],
    loading: true,
    errHint: '',
    showHelp: false
  },

  onShow() { this.loadAll(); },

  async loadAll() {
    try {
      const cid = pkApi.clientId() || '';
      this.setData({ myWardId: cid, loading: true });

      const cur = await seasonApi.current();
      const seasonNo = (cur && cur.seasonNo) || 'S1';

      const bal = await pkApi.powerBalance(cid);
      const res = await pkApi.pools(seasonNo, cid);
      const mine = await pkApi.pool(cid, cid);

      const pools = ((res && res.ok && res.list) || []).map((p) => {
        p.wardMask = '守纪者·' + String(p.wardId).slice(-4);
        return p;
      });
      const myPool = (mine && mine.ok && mine.exists) ? mine : null;

      this.setData({
        seasonNo,
        power: bal && bal.ok ? bal.balance : 0,
        powerReady: !!(bal && bal.ok),
        pools,
        myPool,
        loading: false,
        errHint: (res || bal) ? '' : '网络暂不可用，稍后重试'
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onMyPool() {
    const myPool = this.data.myPool;
    if (myPool) {
      wx.navigateTo({ url: '/pkgChallenge/pkDetail/index?wardId=' + encodeURIComponent(this.data.myWardId) + '&seasonNo=' + this.data.seasonNo });
      return;
    }
    wx.showActionSheet({
      itemList: ['开盘并自押 50 战力值', '开盘并自押 100 战力值', '仅开盘(不自押)'],
      success: (r) => {
        const stake = [50, 100, 0][r.tapIndex];
        wx.showLoading({ title: '开盘中' });
        pkApi.open(this.data.myWardId, stake).then((res) => {
          wx.hideLoading();
          if (res && res.ok) {
            this.loadAll();
            wx.navigateTo({ url: '/pkgChallenge/pkDetail/index?wardId=' + encodeURIComponent(this.data.myWardId) + '&seasonNo=' + this.data.seasonNo });
          } else {
            wx.showToast({ title: (res && res.msg) || '开盘失败', icon: 'none' });
          }
        });
      }
    });
  },

  onPoolTap(e) {
    const wardId = e.currentTarget.dataset.wardId;
    wx.navigateTo({ url: '/pkgChallenge/pkDetail/index?wardId=' + encodeURIComponent(wardId) + '&seasonNo=' + this.data.seasonNo });
  },

  goRank() {
    wx.navigateTo({ url: '/pkgChallenge/pkRank/index?seasonNo=' + this.data.seasonNo });
  },

  showPowerHelp() {
    this.setData({ showHelp: true });
  },

  closePowerHelp() {
    this.setData({ showHelp: false });
  },

  noop() {}
});
