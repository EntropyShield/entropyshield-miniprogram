Page({
  data: {
    questions: [],
    answeredCount: 0
  },

  onLoad() {
    const questions = [
      {
        title: '你在开仓前，会不会写下“计划买入价格、止损价、目标价”？',
        activeValue: '',
        options: [
          { value: 0, label: '基本不会，更多靠临场感觉' },
          { value: 1, label: '偶尔会写，但执行不稳定' },
          { value: 2, label: '多数情况下会简单记录' },
          { value: 3, label: '几乎每一笔都会完整写好并执行' }
        ]
      },
      {
        title: '当价格触及你事先设定的止损位时，你通常会？',
        activeValue: '',
        options: [
          { value: 0, label: '犹豫再三，经常让止损价“失效”' },
          { value: 1, label: '会纠结一会儿，有时执行有时不执行' },
          { value: 2, label: '大部分情况下能执行' },
          { value: 3, label: '几乎都会坚定执行止损' }
        ]
      },
      {
        title: '你是如何控制整体仓位的？',
        activeValue: '',
        options: [
          { value: 0, label: '没有明确规则，全靠感觉' },
          { value: 1, label: '大致有一个上限，但经常突破' },
          { value: 2, label: '有上限，并且基本能控制在范围内' },
          { value: 3, label: '有清晰的仓位梯度（轻/中/重），严格按计划调节' }
        ]
      },
      {
        title: '一笔交易结束后，你是否会进行复盘？',
        activeValue: '',
        options: [
          { value: 0, label: '很少复盘，结束就翻篇' },
          { value: 1, label: '只有大赚或大亏时才会复盘' },
          { value: 2, label: '多数情况下会简单复盘' },
          { value: 3, label: '有固定复盘模板，并坚持记录' }
        ]
      },
      {
        title: '你对“最大可接受回撤”和“年度收益目标”的关系是否有整体规划？',
        activeValue: '',
        options: [
          { value: 0, label: '没有整体规划，只看短期盈亏' },
          { value: 1, label: '有一点想法，但没有量化' },
          { value: 2, label: '基本有框架，能大致控制节奏' },
          { value: 3, label: '有明确数字，并据此设计整个风控体系' }
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

    // 这里 value 越大，说明能力越强，score 越高越好
    let totalWeight = 0;
    questions.forEach(q => {
      totalWeight += Number(q.activeValue || 0);
    });

    const maxWeight = questions.length * 3;
    const score = Math.round((totalWeight / maxWeight) * 100);

    wx.navigateTo({
      url: `/pages/resultCommon/index?type=ability&score=${score}`
    });
  }
});
