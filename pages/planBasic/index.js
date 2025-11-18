Page({
  data: {
    balance: "",
    price: "",
    code: "",
    steps: [],        // 稳健版的步骤列表
    stopPrice: "",
    targetPrice: "",
    maxLossRate: 0.2,       // 止损 -20%（可调）
    targetProfitRate: 0.2   // 止盈 +20%（可调）
  },

  onLoad: function (options) {
    var balance = parseFloat(options.balance || "0");
    var price = parseFloat(options.price || "0");
    var code = decodeURIComponent(options.code || "");

    this.setData({
      balance: balance ? balance.toString() : "",
      price: price ? price.toString() : "",
      code: code
    });

    if (balance > 0 && price > 0) {
      this.makePlan(balance, price);
    }
  },

  /**
   * 稳健版方案「计算框架」
   * =====================================
   * 👉 后面你只要告诉我：每一步投入比例 & 对应价格系数。
   *    我在 parts / factors 里替换即可。
   */
  makePlan: function (balance, price) {
    // 【示意参数】—— 当前只是占位用，方便你看结构：
    // parts   表示每一步投入比例；四个数加起来最好 ≈ 1
    // factors 表示相对首价的价格系数，比如 0.97 = 价格下调 3%
    var parts =   [0.25, 0.25, 0.25, 0.25];   // ← 这里以后按你的模型改
    var factors = [1.00, 0.97, 0.94, 0.91];   // ← 这里以后按你的模型改

    var steps = [];

    for (var i = 0; i < parts.length; i++) {
      var money = balance * parts[i];
      var execPrice = price * factors[i];
      var hands = Math.floor(money / execPrice / 100); // 一手 = 100

      steps.push({
        label: "步骤 " + (i + 1),
        price: execPrice.toFixed(2),
        qty: hands
      });
    }

    var stopPrice = (price * (1 - this.data.maxLossRate)).toFixed(2);
    var targetPrice = (price * (1 + this.data.targetProfitRate)).toFixed(2);

    this.setData({
      steps: steps,
      stopPrice: stopPrice,
      targetPrice: targetPrice
    });
  }
});
