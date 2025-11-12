Page({
  data: {
    balance: '',
    price: '',
    code: '',
    batchPrice: '',
    maxLoss: '',
    targetProfit: ''
  },

  onBalanceInput(e) {
    this.setData({
      balance: e.detail.value
    });
  },
  
  onPriceInput(e) {
    this.setData({
      price: e.detail.value
    });
  },
  
  onCodeInput(e) {
    this.setData({
      code: e.detail.value
    });
  },
  
  onCalculate() {
    const { balance, price } = this.data;
    
    if (!balance || !price) {
      wx.showToast({
        title: '请输入资金和买入价格',
        icon: 'none'
      });
      return;
    }

    // 假设的简单计算逻辑
    const batchPrice = (balance / 4) / price;  // 分四次买入
    const maxLoss = 0.2 * balance;  // 最大亏损20%
    const targetProfit = 0.2 * balance;  // 目标利润20%

    this.setData({
      batchPrice,
      maxLoss,
      targetProfit
    });
  }
});
