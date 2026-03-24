// pages/payIntro/index.js
const funnel = require('../../utils/funnel.js');

Page({
  data: {
    wechatId: "dcd7467",
    levelName: "",
    copied: false
  },

  onLoad(options) {
    const levelName = (options && options.levelName) || "";
    this.setData({ levelName });

    funnel.log('PAY_VIEW_INTRO', { levelName });
  },

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
            extInfo: { url: "" },
            corpId: "",
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
  }
});
