// pages/riskCalculator/pay/index.js
Page({
  data: {
    selectedPlan: 'month',  // 默认选中月度版
    payAmount: 999,         // 对应金额
    agreed: false,          // 是否勾选协议
    canPay: false,          // 支付按钮是否可用
    paying: false           // 是否显示“支付中”蒙层
  },

  // 选择套餐
  selectPlan(e) {
    const plan = e.currentTarget.dataset.plan;
    this.updatePayAmount(plan);
  },

  // 根据套餐更新金额
  updatePayAmount(plan) {
    let amount = 0;
    if (plan === 'trial') {
      amount = 99; // 免费试用
    } else if (plan === 'month') {
      amount = 999; // 月度套餐
    } else if (plan === 'year') {
      amount = 9999; // 年度套餐
    }

    this.setData({
      selectedPlan: plan,
      payAmount: amount,
      canPay: this.data.agreed && amount > 0  // 如果勾选了协议且金额大于0，则支付按钮可用
    });
  },

  // 勾选/取消协议
  toggleAgree() {
    const agreed = !this.data.agreed;
    this.setData({
      agreed,
      canPay: agreed && this.data.payAmount > 0  // 更新支付按钮可用状态
    });
  },

  // 打开发服务协议（暂时用 Toast 占位）
  openProtocol() {
    wx.showToast({
      title: '服务协议页面待接入',
      icon: 'none'
    });
  },

  // 打开风险提示
  openRisk() {
    wx.showToast({
      title: '风险提示页面待接入',
      icon: 'none'
    });
  },

  // 右上角帮助（如果你后面加按钮，可以用这个方法）
  onHelp() {
    wx.showToast({
      title: '如支付有问题，请联系熵盾客服',
      icon: 'none'
    });
  },

  // 发起支付（目前先做模拟逻辑）
  onPay() {
    if (!this.data.canPay) {
      wx.showToast({
        title: '请先勾选服务协议',
        icon: 'none'
      });
      return;
    }

    // 显示“支付中”蒙层
    this.setData({ paying: true });

    // 模拟支付逻辑（实际应该调用 wx.requestPayment）
    setTimeout(() => {
      this.setData({ paying: false });

      // 模拟“支付成功”
      wx.navigateTo({
        url: '/pages/paySuccess/index'  // 支付成功后跳转
      });
    }, 1000);  // 模拟支付过程，延时1秒后支付成功
  }
});
