Page({
  data: {
    balance: '',
    price: '',
    code: ''
  },

  // 输入资金
  onInputBalance(e) {
    this.setData({ balance: e.detail.value });
  },

  // 输入价格
  onInputPrice(e) {
    this.setData({ price: e.detail.value });
  },

  // 输入代码
  onInputCode(e) {
    this.setData({ code: e.detail.value });
  },

  // 跳转：稳健版
  onSteadyPlan() {
    console.log("生成稳健版点击");

    const { balance, price, code } = this.data;

    if (!balance || !price || !code) {
      wx.showToast({
        title: '请填写完整参数',
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/planSteady/index?capital=${balance}&firstPrice=${price}&code=${code}`
    });
  },

  // 跳转：加强版
  onAdvancedPlan() {
    console.log("生成加强版点击");

    const { balance, price, code } = this.data;

    if (!balance || !price || !code) {
      wx.showToast({
        title: '请填写完整参数',
        icon: 'none'
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/planAdvanced/index?balance=${balance}&price=${price}&code=${code}`
    });
  },

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});
