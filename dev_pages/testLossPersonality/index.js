Page({
  data: {
    questions: [],
    answeredCount: 0
  },

  onLoad() {
    const questions = [
      {
        title: '当一笔持仓浮亏 10% 时，你最常见的反应是？',
        activeValue: '',
        options: [
          { value: 0, label: '优先反思交易逻辑是否出错' },
          { value: 1, label: '有点烦躁，但会按原计划观察一段时间' },
          { value: 2, label: '用加仓把成本价“摊低一点”' },
          { value: 3, label: '只要没爆仓，就先放着不看了' }
        ]
      },
      {
        title: '你做出“加仓”决定时，通常依据是什么？',
        activeValue: '',
        options: [
          { value: 0, label: '提前写好的加仓计划/价格' },
          { value: 1, label: '感觉趋势还在，就顺手多买一点' },
          { value: 2, label: '看到别人都在买，我也不想错过' },
          { value: 3, label: '前面已经亏了不少，想靠这次“拉一把”' }
        ]
      },
      {
        title: '面对连续亏损 3 笔的情况，你会怎么处理？',
        activeValue: '',
        options: [
          { value: 0, label: '先停下来复盘，减少交易频率' },
          { value: 1, label: '换一个品种，继续按感觉做' },
          { value: 2, label: '加大仓位“挣回来”，不甘心就此认输' },
          { value: 3, label: '越亏越想交易，直到情绪释放完为止' }
        ]
      },
      {
        title: '你是否经常在下一笔交易中，把止损价悄悄上调/下移？',
        activeValue: '',
        options: [
          { value: 0, label: '基本不会，该止损就止损' },
          { value: 1, label: '偶尔会，为了再等等看情况' },
          { value: 2, label: '比较常见，经常把止损价往上/下拖' },
          { value: 3, label: '几乎每次都会，一直改到自己“心里舒服”为止' }
        ]
      },
      {
        title: '当别人提醒你控制风险时，你最真实的感受是？',
        activeValue: '',
        options: [
          { value: 0, label: '认同，风险控制是长期生存的关键' },
          { value: 1, label: '道理都懂，但总觉得“先赚到钱再说”' },
          { value: 2, label: '有点烦，觉得他们“太保守，不懂行情”' },
          { value: 3, label: '会直接无视，坚信自己这次一定能翻盘' }
        ]
      }
    ];

    this.setData({ questions });
  },

  // 选中某个选项
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

  // 提交计算分数
  onSubmit() {
    const { questions } = this.data;

    const unfinished = questions.some(
      q => q.activeValue === '' || q.activeValue === null
    );
    if (unfinished) {
      wx.showToast({
        title: '还有题目未作答',
        icon: 'none'
      });
      return;
    }

    let totalWeight = 0;
    questions.forEach(q => {
      totalWeight += Number(q.activeValue || 0);
    });

    const maxWeight = questions.length * 3;
    const score = Math.round((totalWeight / maxWeight) * 100);

    wx.navigateTo({
      url: `/pages/resultCommon/index?type=loss&score=${score}`
    });
  }
});
