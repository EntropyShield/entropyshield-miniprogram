// pages/membership/index.js

Page({
  data: {
    // 入口类型：steady = 稳健版；advanced = 加强版
    type: 'steady',
    balance: '',
    price: '',
    code: '',

    planLabel: '',   // 顶部文案：稳健版风控方案 / 加强版 · 高阶风控方案
    plans: [],       // 会员方案列表

    // 当前权益展示
    freeCalcTimes: 0,           // 剩余完整方案次数
    membershipNameDisplay: ''   // 会员名称（含“已到期”标记）
  },

  onLoad(options) {
    const type = options.type || 'steady';

    // 这里统一 decode 一下，避免以后参数里有特殊字符
    const balance = options.balance
      ? decodeURIComponent(options.balance)
      : '';
    const price = options.price
      ? decodeURIComponent(options.price)
      : '';
    const code = options.code
      ? decodeURIComponent(options.code)
      : '';

    const isAdvanced = type === 'advanced';
    const planLabel = isAdvanced
      ? '加强版 · 高阶风控方案'
      : '稳健版风控方案';

    // 会员方案配置（对齐 PRD，可随时调整 grantTimes / durationDays）
    const plans = [
      {
        id: 'trial14',
        name: '14 天体验会员',
        priceText: '¥99',
        unitText: '14 天',
        desc: '先体验一轮完整风控流程，14 天内专注养成风控习惯。',
        grantTimes: 6,        // 赠送完整方案次数（建议值：6）
        durationDays: 14
      },
      {
        id: 'month',
        name: '月度会员',
        priceText: '¥999',
        unitText: '每月',
        desc: '适合高频复盘者，30 天内反复使用风控计算器训练执行力。',
        grantTimes: 20,       // 建议值：20
        durationDays: 30
      },
      {
        id: 'quarter',
        name: '季度会员',
        priceText: '¥2999',
        unitText: '每季度',
        desc: '季度周期控局者，90 天内配合多轮训练营强化秩序感。',
        grantTimes: 70,       // 建议值：70
        durationDays: 90
      },
      {
        id: 'year',
        name: '年度会员',
        priceText: '¥9999',
        unitText: '每年',
        desc: '适合长期秩序架构师，一年内持续用风控方案约束自己。',
        grantTimes: 300,      // 建议值：300
        durationDays: 365
      }
    ];

    this.setData({
      type,
      balance,
      price,
      code,
      planLabel,
      plans
    });

    this.refreshRights();
  },

  onShow() {
    this.refreshRights();
  },

  // 刷新当前权益（从 userRights 读取）
  refreshRights() {
    const userRights = wx.getStorageSync('userRights') || {};
    const freeCalcTimes = Math.max(
      0,
      Number(userRights.freeCalcTimes || 0)
    );

    const rawName = userRights.membershipName || '';
    const expireAt = Number(userRights.membershipExpireAt || 0);

    let membershipNameDisplay = rawName;
    if (rawName && expireAt) {
      const now = Date.now();
      if (now > expireAt) {
        membershipNameDisplay = rawName + '（已到期）';
      }
    }

    this.setData({
      freeCalcTimes,
      membershipNameDisplay
    });
  },

  // 选择某个会员方案
  onSelectPlan(e) {
    const planId = e.currentTarget.dataset.planId;
    const { type, balance, price, code, plans, planLabel } = this.data;

    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      wx.showToast({
        title: '无法识别的会员方案',
        icon: 'none'
      });
      return;
    }

    // 规则：从“加强版入口”进来的，只允许年度会员
    if (type === 'advanced' && plan.id !== 'year') {
      wx.showToast({
        title: '高阶方案仅支持年度会员，请选择年度会员',
        icon: 'none'
      });
      return;
    }

    // === 下面视为「模拟支付成功」 ===
    wx.showModal({
      title: '开通会员（测试环境）',
      content: `当前为演示环境，将模拟开通「${plan.name}」，并一次性发放 ${plan.grantTimes} 次完整方案使用权。`,
      confirmText: '确认开通',
      cancelText: '再想想',
      success: (res) => {
        if (!res.confirm) return;

        // 1）更新本地 userRights（赠送 freeCalcTimes + 会员信息）
        const rights = wx.getStorageSync('userRights') || {};
        const oldTimes = Number(rights.freeCalcTimes || 0);
        const newTimes = oldTimes + Number(plan.grantTimes || 0);

        rights.freeCalcTimes = newTimes;
        rights.membershipPlan = plan.id;
        rights.membershipName = plan.name;
        // 记录是从稳健版入口还是高阶入口开的会员，方便以后做差异化权益
        rights.membershipEntryType = type; // 'steady' | 'advanced'

        if (plan.durationDays) {
          const now = Date.now();
          rights.membershipExpireAt =
            now + plan.durationDays * 24 * 60 * 60 * 1000;
        }

        wx.setStorageSync('userRights', rights);

        // 刷新顶部展示
        this.refreshRights();

        // 2）提示
        wx.showToast({
          title: `开通成功，新增 ${plan.grantTimes} 次完整方案机会`,
          icon: 'success',
          duration: 1800
        });

        // 3）立即跳转到对应风控方案结果页
        const membershipTypeText = `${plan.name} · ${planLabel}`;

        const query =
          `?balance=${encodeURIComponent(balance)}` +
          `&price=${encodeURIComponent(price)}` +
          `&code=${encodeURIComponent(code || '')}` +
          `&membershipType=${encodeURIComponent(membershipTypeText)}`;

        if (type === 'steady') {
          wx.navigateTo({
            url: '/pages/planSteady/index' + query
          });
        } else {
          wx.navigateTo({
            url: '/pages/planAdvanced/index' + query
          });
        }
      }
    });
  },

  // 入口备选：先去 7 天风控训练营
  goCamp() {
    wx.navigateTo({
      url: '/pages/campIntro/index'
    });
  },

  // 返回风控计算器
  goBackCalc() {
    wx.navigateBack();
  }
});
