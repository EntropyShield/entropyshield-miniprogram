Page({
  data: {
    questions: [],
    answeredCount: 0
  },

  onLoad() {
    const questions = [
      {
        title: '你判断大盘是否“危险”，主要看什么？',
        activeValue: '',
        options: [
          { value: 0, label: '指数位置、成交量、宏观环境' },
          { value: 1, label: '大概看看指数涨跌和热点板块' },
          { value: 2, label: '基本只看自己持仓和喜欢的版块' },
          { value: 3, label: '不怎么看大盘，只关心有没有“热点题材”' }
        ]
      },
      {
        title: '当市场连续大涨后，你更可能的操作是？',
        activeValue: '',
        options: [
          { value: 0, label: '考虑逐步减仓或锁定部分利润' },
          { value: 1, label: '保持现有仓位，视情况微调' },
          { value: 2, label: '看到别人都赚钱，会跟着再加一点仓' },
          { value: 3, label: '越涨越上头，追高接力强势股' }
        ]
      },
      {
        title: '你对“系统性风险”（金融危机、流动性收紧等）的关注度如何？',
        activeValue: '',
        options: [
          { value: 0, label: '会定期关注宏观与政策，不会满仓硬扛' },
          { value: 1, label: '有印象，但不太会影响具体操作' },
          { value: 2, label: '不太了解，只在崩盘时才会注意' },
          { value: 3, label: '几乎不关心，认为这些离自己很远' }
        ]
      },
      {
        title: '当你持仓品种短期涨幅已经很大时，你更在意？',
        activeValue: '',
        options: [
          { value: 0, label: '位置是否偏高，风险是否放大' },
          { value: 1, label: '既想继续拿，又怕回调，会左右摇摆' },
          { value: 2, label: '只要还在涨，就继续拿着不动' },
          { value: 3, label: '还会继续加仓，想“吃到最后一口”' }
        ]
      },
      {
        title: '你是否会因为别人说“行情刚开始”，就改变仓位策略？',
        activeValue: '',
        options: [
          { value: 0, label: '不会，主要看自己对结构和节奏的判断' },
          { value: 1, label: '会参考，但不会大幅调整仓位' },
          { value: 2, label: '经常会，觉得他们“比我懂得多”' },
          { value: 3, label: '直接满仓上车，生怕错过整轮行情' }
        ]
      }
    ];

    this.setData({ questions });
  },

  onSelectOption(e) {
    const qindex = e.currentTarget.dataset.qindex;
    const value = Number(e.currentTarget.dataset.value);
    const { questions, answeredCount } = this.data;

    const q = questions[qindex];
    if (!q) return;

    const firstAnswer = q.activeValue === '' || q.activeValue === null;

    q.activeValue = value;
    questions[qindex] = q;

    this.setData({
      questions,
      answeredCount: firstAnswer ? answeredCount + 1 : answeredCount
    });
  },

  onSubmit() {
    const { questions } = this.data;
    const unfinished = questions.some(
      q => q.activeValue === '' || q.activeValue === null
    );
    if (unfinished) {
      wx.showToast({ title: '还有题目未作答', icon: 'none' });
      return;
    }

    let totalWeight = 0;
    questions.forEach(q => {
      totalWeight += Number(q.activeValue || 0);
    });

    const maxWeight = questions.length * 3;
    const score = Math.round((totalWeight / maxWeight) * 100);

    wx.navigateTo({
      url: `/pages/resultCommon/index?type=market&score=${score}`
    });
  }
});
