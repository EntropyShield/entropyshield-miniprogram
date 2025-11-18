Page({
  data: {
    balance: "",  // 用户资金
    price: "",    // 用户输入的首次价格
    code: "",     // 用户标的代码
    steps: [],    // 计算的建仓步骤
    stopPrice: "",// 止损价格
    targetPrice: "", // 止盈目标价格
  },

  onLoad: function (options) {
    const balance = parseFloat(options.balance || "0");
    const price = parseFloat(options.price || "0");
    const code = decodeURIComponent(options.code || "");

    this.setData({
      balance: balance ? balance.toString() : "",
      price: price ? price.toString() : "",
      code: code
    });

    if (balance > 0 && price > 0) {
      this.makePlan(balance, price);
    }
  },

  // 加强版：三次建仓
  makePlan: function (balance, price) {
    const weights = [0.5, 0.3, 0.2]; // 3 次进场的资金和股数占比
    const steps = [];
    for (let i = 0; i < weights.length; i++) {
      const money = balance * 0.8 * weights[i];
      const priceStep = price * (1 + 0.03 * i);  // 每次进场价格递增
      const shares = Math.floor(money / priceStep / 100); // 每手是 100 股

      steps.push({
        label: `第 ${i + 1} 次建仓`,
        price: priceStep.toFixed(2),
        qty: shares
      });
    }

    const stopPrice = (price * 0.8).toFixed(2); // 止损价格是价格的 80%
    const targetPrice = (price * 1.2).toFixed(2); // 止盈目标是价格的 120%

    this.setData({
      steps: steps,
      stopPrice: stopPrice,
      targetPrice: targetPrice
    });
  }
});
