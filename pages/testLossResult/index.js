Page({
  data: {
    score: 0,
    levelName: '',
    levelClass: '',
    shortComment: '',
    summary: '',
    tagsStrong: [],
    tagsWeak: [],
    abilities: [],
    advices: []
  },

  onLoad(options) {
    const score = Number(options.score || 0);
    this.initResult(score);
  },

  initResult(score) {
    let levelName = '';
    let levelClass = '';
    let shortComment = '';
    let summary = '';
    let tagsStrong = [];
    let tagsWeak = [];
    let abilities = [];
    let advices = [];

    // 四个分段：新手 / 成长 / 稳健 / 大师
    if (score < 40) {
      levelName = '新手控局者';
      levelClass = 'level-beginner';
      shortComment = '已经意识到“风控很重要”，但工具和方法还不成体系。';
      summary = '适合从基础规则、止损线与仓位管理开始系统学习。';

      tagsStrong = ['风险意识正在被唤醒', '愿意接受系统化训练'];
      tagsWeak = ['缺少稳定的风控框架', '执行多凭感觉，下单前计划不足'];

      abilities = [
        { name: '风险认知', score: 45, desc: '知道“不能亏太多”，但缺少量化标准。' },
        { name: '仓位管理', score: 35, desc: '仓位偏随意，容易一次性重仓。' },
        { name: '止损纪律', score: 30, desc: '容易犹豫、拖延止损，心软居多。' },
        { name: '情绪稳定度', score: 40, desc: '行情剧烈时容易受到影响，追涨杀跌。' }
      ];

      advices = [
        '给自己设定“单笔最大亏损”“账户最大回撤”两个底线指标。',
        '所有建仓前先在纸上写出：买入价、止损价、目标价与仓位比例。',
        '建议从熵盾 7 天训练营开始，形成一套固定流程。'
      ];
    } else if (score < 70) {
      levelName = '成长控局者';
      levelClass = 'level-growing';
      shortComment = '已经有一套基本风控规则，但执行和稳定性还有提升空间。';
      summary = '你已经走在大部分交易者前面，接下来要做的是“固化流程”。';

      tagsStrong = ['已具备止损意识', '开始关注仓位与风险收益比'];
      tagsWeak = ['风控规则容易被行情打破', '盈利与亏损时的仓位节奏不够稳定'];

      abilities = [
        { name: '风险认知', score: 70, desc: '能看懂风险区间，知道何时“该停手”。' },
        { name: '仓位管理', score: 60, desc: '会分批建仓，但比例与节奏还未固定。' },
        { name: '止损纪律', score: 55, desc: '大部分能执行，但极端情况会犹豫。' },
        { name: '情绪稳定度', score: 60, desc: '有短暂的情绪波动，但能慢慢拉回理性。' }
      ];

      advices = [
        '把你现有的交易流程写成「 checklist 」，每次下单逐条勾选。',
        '使用熵盾风控计算器，为每次交易生成固定的分批与止损方案。',
        '建议每周做一次复盘：只看“是否按规则执行”，先不看盈亏。'
      ];
    } else if (score < 90) {
      levelName = '稳健控局者';
      levelClass = 'level-steady';
      shortComment = '风控规则比较清晰，执行稳定，已经具备“体系雏形”。';
      summary = '如果继续优化细节，你可以成为别人眼中的“风控教练”。';

      tagsStrong = ['止损与仓位控制较好', '能接受“错过机会胜过盲目出手”'];
      tagsWeak = ['盈利仓位的加减节奏还有优化空间', '在极端行情下仍有少量情绪扰动'];

      abilities = [
        { name: '风险认知', score: 85, desc: '能清晰区分系统性风险与个股风险。' },
        { name: '仓位管理', score: 80, desc: '分批结构比较稳定，整体回撤可控。' },
        { name: '止损纪律', score: 78, desc: '大部分情况能做到“打到就走”。' },
        { name: '情绪稳定度', score: 75, desc: '波动时仍有情绪波动，但不会轻易失控。' }
      ];

      advices = [
        '开始把自己的风控系统拆分为模块：开仓 → 加仓 → 减仓 → 清仓。',
        '在熵盾工具中，为不同行情预设多套“应急方案”。',
        '尝试帮助身边交易者做风控辅导，通过教别人来强化自己系统。'
      ];
    } else {
      levelName = '大师控局者';
      levelClass = 'level-master';
      shortComment = '你已经具备较成熟的风控体系，是“规则驱动型交易者”。';
      summary = '可以在保证风险可控的前提下，尝试多策略、多市场的扩展。';

      tagsStrong = ['风险边界清晰且稳定执行', '更关注回撤曲线而非单笔盈亏'];
      tagsWeak = ['可以进一步探索团队协作与量化风控工具'];

      abilities = [
        { name: '风险认知', score: 95, desc: '对风险/收益结构有深刻理解。' },
        { name: '仓位管理', score: 90, desc: '仓位结构清晰，极端行情下仍能保持底线。' },
        { name: '止损纪律', score: 92, desc: '严格执行事先规则，几乎无情绪化止损。' },
        { name: '情绪稳定度', score: 90, desc: '波动视为常态，更关注系统长期表现。' }
      ];

      advices = [
        '可尝试构建多资产、多周期的组合风控框架。',
        '将熵盾工具与自己的交易模型深度绑定，形成自动化执行流程。',
        '考虑通过课程、社群或战队形式，让更多人受益于你的体系。'
      ];
    }

    this.setData({
      score,
      levelName,
      levelClass,
      shortComment,
      summary,
      tagsStrong,
      tagsWeak,
      abilities,
      advices
    });
  },

  goCalc() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index'
    });
  },

  goCamp() {
    wx.navigateTo({
      url: '/pages/campIntro/index'
    });
  }
});
