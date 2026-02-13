// pages/riskCalculator/index.js
const funnel = require('../../utils/funnel.js');

Page({
  data: {
    balance: '',        // 可用资金
    price: '',          // 首次买入价格
    code: '',           // 标的代码或名称

    freeCalcTimes: 0,   // 剩余免费生成完整方案次数（会员 + 训练营奖励）
    membershipName: ''  // 当前权益名称（例如：14 天体验会员 / 7 天训练营奖励）
  },

  onLoad() {
    this.refreshFreeTimes();
  },

  onShow() {
    // 每次回来刷新一下免费次数（防止在别的页面被修改）
    this.refreshFreeTimes();
  },

  // 从本地存储读取权益信息
  refreshFreeTimes() {
    const userRights = wx.getStorageSync('userRights') || {};
    const freeCalcTimes = Number(userRights.freeCalcTimes || 0);

    const rawName = userRights.membershipName || '';
    const expireAt = Number(userRights.membershipExpireAt || 0);

    let membershipName = rawName;
    if (rawName && expireAt) {
      const now = Date.now();
      if (now > expireAt) {
        // 简单标记一下已到期（次数不清零，方便后面自己定规则）
        membershipName = rawName + '（已到期）';
      }
    }

    this.setData({
      freeCalcTimes,
      membershipName
    });
  },

  // 处理输入
  onBalanceInput(e) {
    this.setData({ balance: e.detail.value });
  },

  onPriceInput(e) {
    this.setData({ price: e.detail.value });
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value });
  },

  // 校验表单
  validateForm() {
    const { balance, price } = this.data;

    if (!balance) {
      wx.showToast({
        title: '请输入可用资金',
        icon: 'none'
      });
      return false;
    }

    if (!price) {
      wx.showToast({
        title: '请输入首次买入价格',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  // 点击：生成稳健版
  onClickSteady() {
    console.log('[riskCalculator] click steady');
    funnel.log('CALC_CLICK_STEADY', {});
    this.handleGeneratePlan('steady');
  },

  // 点击：生成加强版
  onClickAdvanced() {
    console.log('[riskCalculator] click advanced');
    funnel.log('CALC_CLICK_ADVANCED', {});
    this.handleGeneratePlan('advanced');
  },

  /**
   * 统一处理生成方案：
   * 1）优先消耗免费次数
   * 2）否则弹出三选一下一步
   */
  handleGeneratePlan(planType) {
    if (!this.validateForm()) return;

    const { balance, price, code, freeCalcTimes } = this.data;

    // 1. 有免费次数：直接跳结果页
    if (freeCalcTimes > 0) {
      // [MOD-NAV-20260212] 不再提前扣次数，改为：navigateTo 成功后再扣，避免“只扣次数不显示”
      const left = freeCalcTimes - 1;

      this.gotoPlanResult(
        planType,
        {
          balance,
          price,
          code,
          membershipType: '训练营/会员 · 免费权益使用'
        },
        {
          onSuccess: () => {
            const userRights = wx.getStorageSync('userRights') || {};
            userRights.freeCalcTimes = left;
            wx.setStorageSync('userRights', userRights);

            this.setData({ freeCalcTimes: left });

            funnel.log('CALC_FREE_PLAN', {
              planType,
              leftFreeTimes: left
            });

            wx.showToast({
              title: `已使用免费次数，剩余 ${left} 次`,
              icon: 'none',
              duration: 2000
            });
          },
          onFail: (err) => {
            console.error('[riskCalculator] gotoPlanResult failed, will NOT deduct free times:', err);
            wx.showToast({
              title: '页面跳转失败，请检查结果页是否已注册',
              icon: 'none',
              duration: 2000
            });
          }
        }
      );

      return;
    }

    // 2. 没有免费次数：弹出下一步选择
    this.chooseNextStep(planType);
  },

  // 跳转到对应方案结果页（稳健版 / 加强版）
  // [MOD-NAV-20260212] 增加 hooks：onSuccess/onFail，且补充 navigateTo 成功/失败日志
  gotoPlanResult(planType, { balance, price, code, membershipType }, hooks = {}) {
    const base =
      `?balance=${encodeURIComponent(balance)}` +
      `&price=${encodeURIComponent(price)}` +
      `&code=${encodeURIComponent(code || '')}`;

    const mt =
      membershipType
        ? `&membershipType=${encodeURIComponent(membershipType)}`
        : '';

    let url = '';
    if (planType === 'steady') {
      url = '/pages/planSteady/index' + base + mt;
    } else {
      url = '/pages/planAdvanced/index' + base + mt;
    }

    console.log('[riskCalculator] will navigate url=', url);

    wx.navigateTo({
      url,
      success: () => {
        console.log('[riskCalculator] navigate success', url);
        if (hooks && typeof hooks.onSuccess === 'function') hooks.onSuccess();
      },
      fail: (e) => {
        console.error('[riskCalculator] navigate fail', e);
        // 常见：page "xxx" is not found（未在 app.json/subpackages 注册）
        wx.showToast({
          title: (e && e.errMsg) ? `跳转失败：${e.errMsg}` : '跳转失败',
          icon: 'none',
          duration: 2500
        });
        if (hooks && typeof hooks.onFail === 'function') hooks.onFail(e);
      }
    });
  },

  // 弹出下一步选择（会员 / 训练营 / 邀请好友）
  chooseNextStep(planType) {
    const { balance, price, code } = this.data;

    funnel.log('CALC_CHOOSE_NEXT', {
      planType,
      hasFreeTimes: false
    });

    wx.showActionSheet({
      itemList: [
        '直接开通会员，解锁完整方案',
        '先参加 7 天风控训练营',
        '邀请好友，免费获得使用次数'
      ],
      success: res => {
        const idx = res.tapIndex;

        // 记录埋点
        funnel.log('CALC_CHOOSE_NEXT_RESULT', {
          planType,
          choiceIndex: idx
        });

        // 0: 直接开通会员
        if (idx === 0) {
          wx.navigateTo({
            url:
              `/pages/membership/index?type=${planType}` +
              `&balance=${encodeURIComponent(balance)}` +
              `&price=${encodeURIComponent(price)}` +
              `&code=${encodeURIComponent(code || '')}`
          });
          return;
        }

        // 1: 先参加 7 天风控训练营
        if (idx === 1) {
          wx.navigateTo({
            url: '/pages/campIntro/index'
          });
          return;
        }

        // 2: 邀请好友，免费获得使用次数 -> 去任务裂变页
        if (idx === 2) {
          wx.navigateTo({
            url: `/pages/fissionTask/index?fromPlan=${planType}`
          });
        }
      },
      fail: err => {
        console.log('[riskCalculator] actionSheet canceled or failed', err);
      }
    });
  },

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});
