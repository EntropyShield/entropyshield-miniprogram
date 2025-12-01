// pages/payIntro/index.js
const funnel = require('../../utils/funnel.js');

Page({
  data: {
    wechatId: "dcd7467",   // 顾问微信号（统一命名）
    levelName: "",
    copied: false
  },

  onLoad(options) {
    const levelName = options.levelName || "";
    this.setData({ levelName });

    // 埋点：用户查看收费方案页
    funnel.log('PAY_VIEW_INTRO', {
      levelName
    });
  },

  /** A. 复制微信号 */
  onCopyWechat() {
    const wxid = this.data.wechatId;

    wx.setClipboardData({
      data: wxid,
      success: () => {
        wx.showToast({
          title: '已复制微信号',
          icon: 'success',
          duration: 1200
        });

        this.setData({ copied: true });

        funnel.log('PAY_COPY_WECHAT', {
          levelName: this.data.levelName,
          wechat: wxid
        });
      }
    });
  },

  /** B. 复制 + 跳到微信添加顾问 */
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

        // 👉 延时跳到微信（小程序限制，一般会失败，用 Toast 做兜底）
        setTimeout(() => {
          wx.openCustomerServiceChat({
            extInfo: { url: "" },
            corpId: "",
            success: () => {},
            fail: () => {
              wx.showToast({
                title: '请手动打开微信添加顾问',
                icon: 'none'
              });
            }
          });
        }, 500);
      }
    });
  },

  /** C. 开发者：查看漏斗数据（跳到 funnelLogs 页面） */
  debugShowFunnelLogs() {
    wx.navigateTo({
      url: '/pages/funnelLogs/index'
    });
  },

  /** D. 先继续自我训练 */
  onThinkMore() {
    funnel.log('PAY_THINK_MORE', {
      levelName: this.data.levelName
    });

    wx.showToast({
      title: '已记录你的选择',
      icon: 'none'
    });
  }
});
