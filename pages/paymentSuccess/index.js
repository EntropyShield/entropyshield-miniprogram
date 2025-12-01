Page({
  data: {
    // membership 传过来的参数
    planType: '',      // 'steady' 或 'advanced'
    memberPlan: '',    // 'trial' | 'month' | 'quarter' | 'year'
    balance: '',
    price: '',
    code: '',

    // 展示用
    planName: '',
    rightsText: ''
  },

  onLoad(options) {
    // 注意：这里用的是 membership 传过来的 type / plan
    const planType = options.type || 'steady';   // steady / advanced
    const memberPlan = options.plan || '';       // trial / month / quarter / year
    const balance = options.balance ? decodeURIComponent(options.balance) : '';
    const price = options.price ? decodeURIComponent(options.price) : '';
    const code = options.code ? decodeURIComponent(options.code) : '';

    // 会员名称
    const memberNameMap = {
      trial: '拉新体验版（99元一次）',
      month: '月度版会员（999元/月）',
      quarter: '季度版会员（2999元/季）',
      year: '年度版会员（9999元/年）'
    };

    // 权益说明
    const rightsTextMap = {
      trial: '可使用稳健版风控方案 14 天（演示）',
      month: '可使用稳健版风控方案，优先获得策略更新（演示）',
      quarter: '可使用稳健版风控方案，更长期折扣权益（演示）',
      year: '稳健版 + 加强版全开通，含额外高级权益（演示）'
    };

    const planName = memberNameMap[memberPlan] || '未知会员类型';
    const rightsText = rightsTextMap[memberPlan] || '仅用于演示，不含真实权益说明';

    this.setData({
      planType,
      memberPlan,
      balance,
      price,
      code,
      planName,
      rightsText
    });
  },

  // 查看本次风控方案
  goPlan() {
    const { planType, memberPlan, balance, price, code } = this.data;

    // 默认跳稳健版
    let targetPage = '/pages/planSteady/index';
    if (planType === 'advanced') {
      targetPage = '/pages/planAdvanced/index';
    }

    const url =
      targetPage +
      '?balance=' + encodeURIComponent(balance || '') +
      '&price=' + encodeURIComponent(price || '') +
      '&code=' + encodeURIComponent(code || '') +
      '&memberPlan=' + encodeURIComponent(memberPlan || '');

    wx.navigateTo({ url });
  },

  // 返回风控计算器
  goBackCalc() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index'
    });
  },

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});
