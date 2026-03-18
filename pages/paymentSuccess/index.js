Page({
  data: {
    planType: '',
    memberPlan: '',
    balance: '',
    price: '',
    code: '',
    planName: '',
    rightsText: ''
  },

  onLoad(options) {
    const planType = options.type || 'steady';
    const memberPlan = options.plan || '';
    const balance = options.balance ? decodeURIComponent(options.balance) : '';
    const price = options.price ? decodeURIComponent(options.price) : '';
    const code = options.code ? decodeURIComponent(options.code) : '';

    const memberNameMap = {
      once3: '体验版（按次）',
      month: '月度会员（999元/月）',
      quarter: '季度会员（2999元/季）',
      year: '年度会员（9999元/年）'
    };

    const rightsTextMap = {
      once3: '可使用稳健版 3 次。',
      month: '可使用稳健版。',
      quarter: '可使用稳健版 + 加强版。',
      year: '可使用稳健版 + 加强版。'
    };

    const planName =
      (options.planName ? decodeURIComponent(options.planName) : '') ||
      memberNameMap[memberPlan] ||
      '会员服务';

    const rightsText =
      (options.rightsText ? decodeURIComponent(options.rightsText) : '') ||
      rightsTextMap[memberPlan] ||
      '以实际开通权益为准。';

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

  goPlan() {
    const { planType, memberPlan, balance, price, code } = this.data;
    let targetPage = '/pages/planSteady/index';
    if (planType === 'advanced') targetPage = '/pages/planAdvanced/index';

    const url =
      targetPage +
      '?balance=' + encodeURIComponent(balance || '') +
      '&price=' + encodeURIComponent(price || '') +
      '&code=' + encodeURIComponent(code || '') +
      '&memberPlan=' + encodeURIComponent(memberPlan || '');

    wx.navigateTo({ url });
  },

  goBackCalc() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index'
    });
  },

  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});