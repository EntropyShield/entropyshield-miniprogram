Page({
  data: {
    task: {}
  },

  onLoad(options) {
    const tasks = [
      { day: 'D1', title: '写下你最近 3 笔大亏损', desc: '记录：买入原因 / 加仓节点 / 最终离场原因，只做复盘，不做辩解。' },
      { day: 'D2', title: '为自己设定“最大可承受回撤”', desc: '例如单笔不超过 2%，单日不超过 3%，一旦触发必须强制离场休息。' },
      { day: 'D3', title: '开始使用熵盾风控计算器', desc: '把资金和建仓价输入，按系统给的仓位和止损价执行一次完整策略。' },
      { day: 'D4-D7', title: '只做“小仓位 + 严止损”训练', desc: '暂时不要追求赚钱，先完成 3～5 笔“严格执行风控”的训练。' }
    ];

    const task = tasks.find(task => task.day === options.day);
    this.setData({ task });
  },

  goBack() {
    wx.navigateBack();
  }
});
