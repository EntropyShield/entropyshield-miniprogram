// pages/payIntro/index.js
<<<<<<< HEAD
// FIX: payIntro fallback page follows official pricing baseline only
=======
// MOD: RESTORE_PAY_INTRO_BASELINE_20260324
>>>>>>> parent of 02b7517 (fix: restore lifetime member display and clean pay intro page)

const funnel = require('../../utils/funnel.js');

Page({
  data: {
<<<<<<< HEAD
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
=======
    wechatId: 'dcd7467',
    levelName: '',
    copied: false,
    pageTitle: '进阶服务说明'
  },

  onLoad(options) {
    const levelName = (options && options.levelName) || '会员服务';
    const pageTitle = levelName ? `${levelName} · 开通说明` : '进阶服务说明';
>>>>>>> parent of 02b7517 (fix: restore lifetime member display and clean pay intro page)

    this.setData({
      levelName,
      pageTitle
    });

    funnel.log('PAY_VIEW_INTRO', { levelName });
  },

<<<<<<< HEAD
=======
  onCopyWechat() {
    const wxid = this.data.wechatId;

    wx.setClipboardData({
      data: wxid,
      success: () => {
        wx.showToast({ title: '已复制微信号', icon: 'success', duration: 1200 });
        this.setData({ copied: true });

        funnel.log('PAY_COPY_WECHAT', {
          levelName: this.data.levelName,
          wechat: wxid
        });
      }
    });
  },

  onCopyAndGo() {
    const wxid = this.data.wechatId;

    wx.setClipboardData({
      data: wxid,
      success: () => {
        wx.showToast({
          title: '微信号已复制，可前往微信添加',
          icon: 'success',
          duration: 1500
        });

        this.setData({ copied: true });

        funnel.log('PAY_COPY_AND_GO_WECHAT', {
          levelName: this.data.levelName,
          wechat: wxid
        });

        setTimeout(() => {
          wx.openCustomerServiceChat({
            extInfo: { url: '' },
            corpId: '',
            success: () => {},
            fail: () => {
              wx.showToast({ title: '请手动打开微信添加顾问', icon: 'none' });
            }
          });
        }, 500);
      }
    });
  },

  onThinkMore() {
    funnel.log('PAY_THINK_MORE', { levelName: this.data.levelName });

    wx.showToast({
      title: '已记录你的选择',
      icon: 'none'
    });
  },

>>>>>>> parent of 02b7517 (fix: restore lifetime member display and clean pay intro page)
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