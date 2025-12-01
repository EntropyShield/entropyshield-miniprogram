Page({
  data: {
    questions: [],
    answeredCount: 0
  },

  onLoad() {
    const questions = [
      {
        title: '当账户出现较大浮亏时，你看盘频率会怎样？',
        activeValue: '',
        options: [
          { value: 0, label: '和平时差不多，只按预定时间看盘' },
          { value: 1, label: '会多看几次，但还能控制自己' },
          { value: 2, label: '频繁刷新行情，几乎离不开屏幕' },
          { value: 3, label: '不断盯盘，影响日常生活和睡眠' }
        ]
      },
      {
        title: '遇到突发行情暴涨时，你更可能的行为是？',
        activeValue: '',
        options: [
          { value: 0, label: '按计划执行，是否追高提前写好' },
          { value: 1, label: '有一点 FOMO，但会控制仓位' },
          { value: 2, label: '忍不住重仓追进去“上车”' },
          { value: 3, label: '直接满仓或梭哈，生怕错过机会' }
        ]
      },
      {
        title: '你平时在交易结束后，情绪恢复到平静大概需要多久？',
        activeValue: '',
        options: [
          { value: 0, label: '很快，基本不影响生活' },
          { value: 1, label: '几小时内会慢慢平复' },
          { value: 2, label: '经常会影响一整天的心情' },
          { value: 3, label: '会持续好几天，甚至失眠' }
        ]
      },
      {
        title: '当你前几笔连续盈利时，你的心态更接近？',
        activeValue: '',
        options: [
          { value: 0, label: '保持冷静，反而会更谨慎' },
          { value: 1, label: '自信增强，但大致还能按计划来' },
          { value: 2, label: '容易兴奋，开始加大仓位' },
          { value: 3, label: '感觉自己“状态来了”，什么都敢做' }
        ]
      },
      {
        title: '你是否会因为一条新闻/一条评论，临时改变交易计划？',
        activeValue: '',
        options: [
          { value: 0, label: '极少，只在和计划一致时才行动' },
          { value: 1, label: '偶尔会，但会控制影响程度' },
          { value: 2, label: '经常会，不自觉就跟着改' },
          { value: 3, label: '基本都是“消息驱动型”，计划形同虚设' }
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
      url: `/pages/resultCommon/index?type=emotion&score=${score}`
    });
  }
});
