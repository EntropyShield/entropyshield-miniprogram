// pages/payIntro/index.js
// FIX: payIntro fallback page follows official pricing baseline only

const funnel = require('../../utils/funnel.js');

Page({
  data: {
    levelName: '',
    feeList: [
      {
        key: 'times3',
        name: '9.9 元 / 3次',
        rights: '稳健版',
        desc: '适合先体验风控计算器'
      },
      {
        key: 'month',
        name: '月卡 999',
        rights: '稳健版',
        desc: '适合短周期连续使用'
      },
      {
        key: 'quarter',
        name: '季卡 2999',
        rights: '稳健版 + 加强版',
        desc: '适合持续训练与复盘'
      },
      {
        key: 'year',
        name: '年卡 9999',
        rights: '稳健版 + 加强版',
        desc: '适合长期使用'
      }
    ]
  },

  onLoad(options) {
    let levelName = (options && options.levelName) || '';
    try {
      levelName = decodeURIComponent(levelName);
    } catch (e) {}

    this.setData({ levelName });

    funnel.log('PAY_VIEW_INTRO', { levelName });
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail() {
        wx.switchTab({
          url: '/pages/profile/index'
        });
      }
    });
  }
});