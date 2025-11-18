Page({
  data: {
    balance: "",
    price: "",
    code: "",
    steps: [],        // 加强版的步骤列表
    stopPrice: "",
    targetPrice: "",
    maxLossRate: 0.2,
    targetProfitRate: 0.2
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
   * 加强版方案「计算框架」
   * =====================================
   * 👉 和稳健版一样，只是这里我们预期是更“进攻型”的分布。
   *    后面你确定模型后，我在 parts / factors 里替换即可。
   */
  makePlan: function (balance, price) {
    // 【示意参数】—— 当前仅为占位：
    var parts =   [0.30, 0.30, 0.40];   // ← 加强版：越往后投入比例越大（示意）
    var factors = [1.00, 0.95, 0.90];   // ← 示意：价格每步下调 5%

    var steps = [];

    for (var i = 0; i < parts.length; i++) {
      var money = balance * parts[i];
      var execPrice = price * factors[i];
      var hands = Math.floor(money / execPrice / 100);

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
