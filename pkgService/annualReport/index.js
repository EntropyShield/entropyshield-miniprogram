// pkgService/annualReport/index.js —— A-3 年报晒图节（我的年度风控报告）
const annualApi = require('../../utils/annualApi.js');

Page({
  data: {
    loading: true,
    errMsg: '',
    // 统计字段
    total: 0,        // 纪律分总额
    seasonDays: 0,   // 累计守纪天数
    seasons: 0,      // 参与赛季数
    redeemCount: 0,  // 兑换次数
    levelName: '',   // 当前段位
    // 分享卡
    cardVisible: false,
    cardQrcodeUrl: '',
    cardValue: 0,
    cardTag: '',
    cardTitle: '',
    cardDesc: '',
    cardGenerated: false
  },

  onShow() {
    this.refresh();
  },

  refresh() {
    this.setData({ loading: true, errMsg: '' });
    annualApi.getAnnual().then((d) => {
      if (!d || !d.ok) {
        this.setData({ loading: false, errMsg: '加载失败，请稍后重试' });
        return;
      }
      const desc = '守纪 ' + (d.seasonDays || 0) + ' 天 · 参与 ' + (d.seasons || 0) + ' 个赛季 · 兑换 ' + (d.redeemCount || 0) + ' 次';
      this.setData({
        loading: false,
        total: Number(d.total) || 0,
        seasonDays: Number(d.seasonDays) || 0,
        seasons: Number(d.seasons) || 0,
        redeemCount: Number(d.redeemCount) || 0,
        levelName: d.levelName || '',
        // 分享卡数据
        cardValue: Number(d.total) || 0,
        cardTag: d.levelName || '',
        cardTitle: '我的年度风控报告',
        cardDesc: desc
      });
    }).catch(() => {
      this.setData({ loading: false, errMsg: '加载失败，请稍后重试' });
    });
  },

  // 生成年度风控报告分享卡
  onGenerate() {
    const url = annualApi.buildQrUrl();
    this.setData({
      cardVisible: true,
      cardQrcodeUrl: url,
      cardGenerated: false
    });
  },

  onCardGenerated() {
    this.setData({ cardGenerated: true });
  },

  onCardError() {
    this.setData({ cardGenerated: false });
  },

  onCardClose() {
    this.setData({ cardVisible: false, cardGenerated: false });
  },

  noop() {}
});
