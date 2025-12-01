Page({
  data: {
    questions: [],
    answeredCount: 0
  },

  onLoad() {
    const questions = [
      {
        title: '你目前账户最大的回撤（高点到低点）大约是多少？',
        activeValue: '',
        options: [
          { value: 0, label: '控制在 10% 以内' },
          { value: 1, label: '10%～20% 之间' },
          { value: 2, label: '20%～40% 之间' },
          { value: 3, label: '经常超过 40%' }
        ]
      },
      {
        title: '你是否给自己设置过“单笔交易最大亏损比例”？',
        activeValue: '',
        options: [
          { value: 0, label: '有明确数字，并且严格执行' },
          { value: 1, label: '有大致概念，但执行不够稳定' },
          { value: 2, label: '想过，但没有真正写下来' },
          { value: 3, label: '没有，基本看当天心情' }
        ]
      },
      {
        title: '当你遇到大幅亏损时，最常见的处理方式是？',
        activeValue: '',
        options: [
          { value: 0, label: '及时止损，总结原因后再出发' },
          { value: 1, label: '先扛一扛，等情绪稳定再考虑处理' },
          { value: 2, label: '不停补仓，期待“拉回本”' },
          { value: 3, label: '不敢看账户，任其发展' }
        ]
      },
      {
        title: '你在同一时间通常会持有多少个标的？',
        activeValue: '',
        options: [
          { value: 0, label: '1～3 个，重点跟踪' },
          { value: 1, label: '4～6 个，略微分散' },
          { value: 2, label: '7～10 个，比较分散' },
          { value: 3, label: '十几个甚至更多，很难说清仓位结构' }
        ]
      },
      {
        title: '如果连续几天账户不断新低，你会怎么做？',
        activeValue: '',
        options: [
          { value: 0, label: '减仓或清仓，切换到防守模式' },
          { value: 1, label: '暂时观望，但没有系统化应对策略' },
          { value: 2, label: '继续原计划，觉得总会反弹的' },
          { value: 3, label: '越亏越急，频繁交易想赢回来' }
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
      url: `/pages/resultCommon/index?type=danger&score=${score}`
    });
  }
});
