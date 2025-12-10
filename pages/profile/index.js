// pages/profile/index.js
const funnel = require('../../utils/funnel.js');
const API_BASE_URL = 'http://localhost:3000';
const CLIENT_ID_KEY = 'st_client_id';

function ensureClientId() {
  let cid = wx.getStorageSync(CLIENT_ID_KEY);
  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 900000) + 100000}`;
    wx.setStorageSync(CLIENT_ID_KEY, cid);
  }
  return cid;
}

Page({
  data: {
    activeInnerTab: 'rights', // rights | tools | lab

    // 用户信息
    userInfo: null,

    // 权益相关
    freeCalcTimes: 0,
    campRewardCount: 0,
    fissionSyncedTimes: 0,
    membershipName: '尚未开通会员',
    campProgressText: '0 / 7 天',

    // 裂变相关
    myInviteCode: '',
    invitedByCode: '',

    // 顾问微信（与 payIntro 保持一致即可）
    advisorWechat: 'dcd7467',

    // 常量：每轮训练营奖励次数（只用于文案）
    CAMP_REWARD_TIMES: 4,

    // 最近来访预约
    latestVisit: null,
    loadingVisit: false,

    // 来访状态文案映射
    statusTextMap: {
      0: '待确认',
      1: '已确认',
      2: '已完成',
      3: '已取消'
    },
    // 来访状态样式映射（对应 wxss 里的类名）
    statusClassMap: {
      0: 'status-pending',
      1: 'status-confirmed',
      2: 'status-done',
      3: 'status-cancelled'
    }
  },

  onShow() {
    funnel.log('PROFILE_VIEW', {
      from: 'tab',
      ts: Date.now()
    });

    this.initPage();
  },

  // ================== 初始化 ==================

  initPage() {
    this.loadUserInfo();
    this.loadRightsFromStorage();
    this.loadCampProgress();
    this.loadFissionInfo();
    this.fetchLatestVisit();
  },

  loadUserInfo() {
    try {
      const app = getApp && getApp();
      if (app && app.globalData && app.globalData.userInfo) {
        this.setData({
          userInfo: app.globalData.userInfo
        });
      }
    } catch (e) {
      console.log('[profile] loadUserInfo error', e);
    }
  },

  // 从本地 userRights 读取权益信息
  loadRightsFromStorage() {
    try {
      const userRights = wx.getStorageSync('userRights') || {};
      const freeCalcTimes = Number(userRights.freeCalcTimes || 0);
      const campRewardCount = Number(userRights.campRewardCount || 0);
      const fissionSyncedTimes = Number(
        userRights.fissionSyncedTimes || 0
      );
      const membershipName =
        userRights.membershipName || '尚未开通会员';

      this.setData({
        freeCalcTimes,
        campRewardCount,
        fissionSyncedTimes,
        membershipName
      });
    } catch (e) {
      console.error('[profile] loadRightsFromStorage error', e);
    }
  },

  // 训练营进度（0~7 天）
  loadCampProgress() {
    try {
      const finishedMap =
        wx.getStorageSync('campFinishedMap') || {};
      const finishedDays = Object.keys(finishedMap).length || 0;
      const text = finishedDays + ' / 7 天';

      this.setData({
        campProgressText: text
      });
    } catch (e) {
      console.error('[profile] loadCampProgress error', e);
    }
  },

  // 裂变邀请码信息
  loadFissionInfo() {
    try {
      const myInviteCode = (
        wx.getStorageSync('fissionMyInviteCode') || ''
      )
        .toUpperCase()
        .trim();

      const invitedByCode = (
        wx.getStorageSync('fissionInvitedByCode') || ''
      )
        .toUpperCase()
        .trim();

      this.setData({
        myInviteCode,
        invitedByCode
      });
    } catch (e) {
      console.error('[profile] loadFissionInfo error', e);
    }
  },

  // 最近一条来访预约
  fetchLatestVisit() {
    const clientId = ensureClientId();

    funnel.log('PROFILE_VISIT_LATEST_FETCH', {
      ts: Date.now(),
      clientId
    });

    this.setData({ loadingVisit: true });

    wx.request({
      url: `${API_BASE_URL}/api/visit/my-list`,
      method: 'GET',
      data: {
        clientId,
        limit: 1
      },
      success: (res) => {
        const data = res.data || {};
        if (!data.ok || !Array.isArray(data.list) || data.list.length === 0) {
          this.setData({
            latestVisit: null,
            loadingVisit: false
          });
          return;
        }

        const raw = data.list[0];

        // 处理日期展示：只要 YYYY-MM-DD
        let visitDateDisplay = '';
        if (raw.visitDate) {
          visitDateDisplay = String(raw.visitDate).slice(0, 10);
        }

        const latestVisit = {
          ...raw,
          visitDateDisplay
        };

        this.setData({
          latestVisit,
          loadingVisit: false
        });
      },
      fail: () => {
        this.setData({
          latestVisit: null,
          loadingVisit: false
        });
      }
    });
  },

  // ================== 内部 Tab 切换 ==================

  onInnerTabChange(e) {
    const key = e.currentTarget.dataset.key;
    if (!key || key === this.data.activeInnerTab) return;
    this.setData({
      activeInnerTab: key
    });
  },

  // ================== 跳转 / 交互 ==================

  goRightsDetail() {
    wx.showModal({
      title: '权益说明',
      content:
        '· 完成一轮 7 天风控训练营，可获赠完整风控方案使用次数；\n' +
        '· 裂变任务产生的奖励会自动同步到“剩余完整方案次数”；\n' +
        '· 会员权益（如有）将在开通后展示在此页面。\n\n' +
        '所有功能仅提供风控工具与教育信息，不构成投资建议或收益承诺。',
      showCancel: false
    });
  },

  goCalc() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index'
    });
  },

  goCampIntro() {
    wx.navigateTo({
      url: '/pages/campIntro/index'
    });
  },

  goCampReport() {
    wx.navigateTo({
      url: '/pages/campReport/index'
    });
  },

    // 订单中心（当前仅弹说明，后续接入真实订单页）
    goOrderCenter() {
      const clientId = ensureClientId();
      funnel.log('PROFILE_TOOL_ORDER_CENTER', {
        clientId,
        from: 'tab2',
        ts: Date.now()
      });
  
      wx.showToast({
        title: '订单中心内测筹备中，请先通过顾问确认订单',
        icon: 'none'
      });
    },
  
  goControllerCalendar() {
    // 控局者课程日历目前放在 Tab2：控局者里，这里直接切 Tab
    wx.switchTab({
      url: '/pages/controller/index'
    });
  },

  goFissionTask() {
    wx.navigateTo({
      url: '/pages/fissionTask/index'
    });
  },

  goVisitBooking() {
    wx.navigateTo({
      url: '/pages/visitBooking/index'
    });
  },

  goVisitAdmin() {
    wx.navigateTo({
      url: '/pages/visitAdmin/index'
    });
  },

  // [熵盾-来访模块-20251204] 我的来访预约列表
  goVisitMyList() {
    wx.navigateTo({
      url: '/pages/visitMyList/index'
    });
  },

  goBookshelf() {
    wx.showToast({
      title: '控局者书架正在筹备中',
      icon: 'none'
    });
  },

  copyAdvisorWechat() {
    const wxid = this.data.advisorWechat || '';
    if (!wxid) {
      wx.showToast({
        title: '暂未配置顾问微信',
        icon: 'none'
      });
      return;
    }

    wx.setClipboardData({
      data: wxid,
      success: () => {
        wx.showToast({
          title: '已复制顾问微信',
          icon: 'success',
          duration: 1500
        });
      }
    });
  },

  showUsageInfo() {
    wx.showModal({
      title: '使用说明与合规提示',
      content:
        '熵盾研究院与风控计算器仅用于交易风控训练与风险教育，不构成任何证券/期货/数字资产的买卖建议，也不承诺任何形式的保本或收益。\n\n' +
        '请根据自身资金状况与风险承受能力，独立做出交易决策，自行承担盈亏。',
      showCancel: false
    });
  },

  showAbout() {
    wx.showModal({
      title: '关于熵盾研究院',
      content:
        '熵盾以“熵智能”为核心，用数据和概率把市场的不确定性量化为可管理的风险预算。\n\n' +
        '我们不承诺收益，只承诺把亏损控制在预算内：先守住本金，再谈收益；先设好护栏，再提高效率。\n\n' +
        '一句话：熵盾守护风险，用户安心前行。',
      showCancel: false
    });
  },

  clearCampLocalData() {
    wx.showModal({
      title: '确认清理本地训练数据？',
      content:
        '仅会清理本机上的 7 天训练营打卡记录与本地训练轮次标记，用于重新体验或测试，不会影响服务器端的权益与裂变奖励记录。',
      confirmText: '确认清理',
      cancelText: '再想想',
      success: res => {
        if (!res.confirm) return;

        try {
          wx.removeStorageSync('campDailyLogs');
          wx.removeStorageSync('campFinishedMap');

          const userRights =
            wx.getStorageSync('userRights') || {};
          delete userRights.campRewardDone;
          delete userRights.campRewardCount;
          wx.setStorageSync('userRights', userRights);

          wx.showToast({
            title: '本地训练数据已清理',
            icon: 'none'
          });

          // 刷新展示
          this.initPage();
        } catch (e) {
          console.error('[profile] clearCampLocalData error', e);
          wx.showToast({
            title: '清理失败，请稍后重试',
            icon: 'none'
          });
        }
      }
    });
  }
});
