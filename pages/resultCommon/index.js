// pages/resultCommon/index.js
Page({
  data: {
    type: '',
    score: 0,
    level: '',
    profile: {}
  },

  onLoad(options) {
    const type = (options.type || 'loss').toLowerCase();
    let score = Number(options.score || 0);
    if (isNaN(score)) score = 0;
    const levelParam = options.level || '';

    // 1️⃣ 如果是训练营入口，修改导航标题
    if (type === 'camp') {
      wx.setNavigationBarTitle({
        title: '7 天训练营战报'
      });
    }

    const profile = this.buildProfile(type, score, levelParam);

    this.setData({
      type,
      score,
      level: profile.level,
      profile
    });
  },

  /**
   * 根据 测试类型 + 分数 + level 构造诊断内容
   * type: loss / emotion / market / danger / ability / score / camp
   */
  buildProfile(type, score, levelParam) {
    // 1️⃣ 先算等级：0–39 低，40–69 中，70–100 高
    let level = levelParam;
    if (!level) {
      if (score < 40) level = 'low';
      else if (score < 70) level = 'mid';
      else level = 'high';
    }

    const isAbilityType =
      type === 'ability' || type === 'score' || type === 'camp';

    // 2️⃣ 不同测试类型使用不同的 标签文案 + 颜色
    // 风险类测试：低风险=绿，中=黄，高危=红
    // 能力/执行类测试：分数高=优秀（绿），中=待提升（黄），低=偏弱（红）
    let levelMap;

    if (isAbilityType) {
      // 能力 / 执行评分：高分=优秀（绿），低分=偏弱（红）
      levelMap = {
        low: { text: '执行/风控能力偏弱', cls: 'level-high' }, // 红色标签
        mid: { text: '执行/风控能力待提升', cls: 'level-mid' }, // 黄色 / 橙色
        high: { text: '执行/风控能力优秀', cls: 'level-low' } // 绿色标签
      };
    } else {
      // 风险类测试：低风险=绿，高危=红
      levelMap = {
        low: { text: '风险良好', cls: 'level-low' }, // 绿色
        mid: { text: '需要注意', cls: 'level-mid' }, // 黄色
        high: { text: '高危预警', cls: 'level-high' } // 红色
      };
    }

    const lv = levelMap[level] || levelMap.mid;

    // 一些通用默认值
    let base = {
      typeLabel: '',
      title: '',
      shortDesc: '',
      levelText: lv.text,
      levelClass: lv.cls,
      badges: [],
      profileHint: '',
      profileItems: [],
      planHint: '配合 7 天风控训练营效果更好',
      planItems: []
    };

    // 3️⃣ 分类型构造内容
    switch (type) {
      /** 0. 训练营战报（camp）—— 来自 7 天打卡的执行力评分 */
      case 'camp': {
        base.typeLabel = '7 天风控训练营 · 执行力战报';

        if (level === 'low') {
          base.title = '本轮训练执行度偏低，建议重新走一遍 7 天任务';
          base.shortDesc =
            '你的记录较为零散，很多关键任务没有完成，建议放慢节奏，用一轮时间专门练习「记录 + 复盘」。';
          base.badges = ['记录不连续', '关键任务完成率较低', '复盘习惯尚未建立'];
        } else if (level === 'mid') {
          base.title = '已经完成部分关键训练，还有很大提升空间';
          base.shortDesc =
            '你在打卡与记录上已经有基础，但在仓位、止损和情绪控制上，还缺少一套可以反复执行的“标准动作”。';
          base.badges = ['部分天数完整打卡', '开始关注回撤', '情绪控制有待加强'];
        } else {
          base.title = '执行力良好，风控习惯正在成型';
          base.shortDesc =
            '你能够比较稳定地记录和复盘交易行为，并尝试用规则约束自己，继续按现在的节奏坚持，会看到明显变化。';
          base.badges = ['连续多天打卡', '主动复盘', '愿意用规则约束自己'];
        }

        base.profileHint = '结合你这 7 天的打卡记录，我们看到：';
        base.profileItems = [
          {
            title: '记录与复盘的稳定度',
            desc: '记录越连续、内容越具体，你越容易看清自己的行为模式，并在下一轮训练中持续修正。'
          },
          {
            title: '仓位与止损是否开始“数字化”',
            desc: '如果你已经在日志中写到了仓位比例、止损价、最大回撤等数字，说明你在向“可量化的风控系统”迈进。'
          },
          {
            title: '情绪在交易中的占比是否下降',
            desc: '当你开始写下情绪触发点，并思考下次如何应对，那些曾经失控的瞬间，正在逐渐被你“掌控”。'
          }
        ];

        base.planHint = '建议用下一轮 7 天训练，把“执行力”进一步固化下来：';
        base.planItems = [
          {
            day: 'D1',
            title: '固定一个记录模板',
            desc: '统一用一份「每日打卡模板」记录：进场理由、仓位、止损、情绪与复盘，降低记录的阻力。'
          },
          {
            day: 'D2',
            title: '为执行力设置一个最低标准',
            desc: '例如：每天至少填满 2 个模块（记录 + 复盘），不论是否交易，都要完成。'
          },
          {
            day: 'D3-D5',
            title: '只练“小仓位 + 严止损”',
            desc: '用较小仓位，专门练习按计划止损和复盘，不追求盈利，只练习执行到位。'
          },
          {
            day: 'D6-D7',
            title: '整理一版「训练营执行清单」',
            desc: '把你认为最有效的 5 条训练动作整理成清单，后续每一轮训练都按清单打钩执行。'
          }
        ];
        break;
      }

      /** 1. 亏损人格 / 亏损危险等级（loss） */
      case 'loss':
        base.typeLabel = '亏损危险等级评估';
        if (level === 'low') {
          base.title = '亏损风险可控，但仍需保持边界意识';
          base.shortDesc =
            '你整体比较谨慎，偶尔会情绪化加仓，需要为自己设定更清晰的止损线。';
          base.badges = ['偏理性', '有止损意识', '容易被行情 FOMO 影响'];
        } else if (level === 'mid') {
          base.title = '已经接近“高危区”，需要立刻重建风控规则';
          base.shortDesc =
            '你的交易里有明显的“死扛 / 补仓赌反弹”行为，再这样下去，账户容易一次性重创。';
          base.badges = ['死扛亏损', '补仓成瘾', '难以离场'];
        } else {
          base.title = '属于高危亏损人格，请先停手，再重建交易系统';
          base.shortDesc =
            '已经具备典型“赌场型交易者”特征，现在最重要的是 —— 暂停实盘，先救心态和规则。';
          base.badges = ['高频补仓', '重仓梭哈', '不设止损', '亏损拖延'];
        }

        base.profileHint = '从你的答题行为中，我们看到这些关键特征：';
        base.profileItems = [
          {
            title: '对亏损极度敏感，却习惯“拖延处理”',
            desc: '明知需要止损，但会不断找理由安慰自己，比如“再等等”“快要反弹了”。'
          },
          {
            title: '容易被短期行情情绪带着走',
            desc: '涨得多了容易追，跌得多了容易补仓，决策更像是“情绪反应”而不是交易计划。'
          },
          {
            title: '缺少事先写好的交易剧本',
            desc: '多数时候是盘中临时决定，买入、加仓、止损都没有明确的价格和规则。'
          }
        ];

        base.planItems = [
          {
            day: 'D1',
            title: '写下你最近 3 笔大亏损',
            desc: '记录：买入原因 / 加仓节点 / 最终离场原因，只做复盘，不做辩解。'
          },
          {
            day: 'D2',
            title: '为自己设定“最大可承受回撤”',
            desc: '例如单笔不超过 2%，单日不超过 3%，一旦触发必须强制离场休息。'
          },
          {
            day: 'D3',
            title: '开始使用熵盾风控计算器',
            desc: '把资金和建仓价输入，按系统给的仓位和止损价执行一次完整策略。'
          },
          {
            day: 'D4-D7',
            title: '只做“小仓位 + 严止损”训练',
            desc: '暂时不要追求赚钱，先完成 3～5 笔“严格执行风控”的训练。'
          }
        ];
        break;

      /** 2. 情绪波动指数（emotion） */
      case 'emotion':
        base.typeLabel = '交易情绪波动指数';
        if (level === 'low') {
          base.title = '情绪波动可控，大部分时候能保持理性';
          base.shortDesc =
            '你偶尔会被行情影响，但基本可以按计划执行，是很好的风控土壤。';
          base.badges = ['节奏稳定', '不会轻易梭哈', '接受小亏损'];
        } else if (level === 'mid') {
          base.title = '情绪起伏较大，容易在关键时刻“乱了手脚”';
          base.shortDesc =
            '一旦遇到大涨大跌，你的计划执行率明显下降，需要建立情绪“减震器”。';
          base.badges = ['追涨杀跌', '容易懊悔', '止损迟疑'];
        } else {
          base.title = '情绪高度敏感，请优先修复交易心态';
          base.shortDesc =
            '恐惧和贪婪在你的交易中占比太高，短期应减少交易频率，拉长观察周期。';
          base.badges = ['频繁看盘', '睡前刷 K 线', '大赚大亏循环'];
        }

        base.profileHint = '从情绪回应中，我们观察到：';
        base.profileItems = [
          {
            title: '当账户浮亏时，心态容易被“放大镜”控制',
            desc: '你会不停刷新行情，甚至因为一两个点的涨跌改变原本计划。'
          },
          {
            title: '对盈利不够耐心，对亏损又不够决断',
            desc: '赚一点就想跑，亏很多才肯走，这样的盈亏结构很难长期正向。'
          }
        ];

        base.planItems = [
          {
            day: 'D1',
            title: '限制看盘频率',
            desc: '给自己设定每天最多看盘的次数，例如 3～5 次，其余时间不打开行情。'
          },
          {
            day: 'D2',
            title: '建立“进场前 5 个问题”',
            desc: '每次下单前，必须回答：为什么买 / 准备持有多久 / 止损价 / 目标价 / 最大仓位。'
          },
          {
            day: 'D3-D7',
            title: '每日写一句“交易情绪日记”',
            desc: '记录当天最强烈的情绪触发点，并思考：如果你是基金经理，会怎么做？'
          }
        ];
        break;

      /** 3. 市场风险温度计（market） */
      case 'market':
        base.typeLabel = '市场风险温度计';
        if (level === 'low') {
          base.title = '当前所处区间偏安全，但仍需控制仓位';
          base.shortDesc =
            '从你的判断维度来看，你对热点与风险的平衡把握得还不错。';
          base.badges = ['风格稳健', '能区分趋势与震荡', '不会盲目重仓'];
        } else if (level === 'mid') {
          base.title = '市场处于“情绪高位带”，需要更谨慎';
          base.shortDesc =
            '你对风险有感知，但执行上容易受热点影响，建议降低整体仓位。';
          base.badges = ['容易追高', '对回调容忍度低', '方向感尚可'];
        } else {
          base.title = '当前为高风险区，请优先考虑防守而非进攻';
          base.shortDesc =
            '你的风险判断与实际市场波动存在偏差，建议先减仓再重新评估。';
          base.badges = ['偏好热门题材', '逆势加仓', '缺少防守策略'];
        }

        base.profileHint = '结合你的判断选项，大致画像为：';
        base.profileItems = [
          {
            title: '更擅长跟随情绪，而非结构与节奏',
            desc: '你会关注“热点、题材、消息”，但对“位置、仓位、节奏”的权重偏低。'
          },
          {
            title: '对系统性风险的提前预判偏弱',
            desc: '大盘连续放量下跌或成交急剧放大时，你往往反应偏慢。'
          }
        ];

        base.planItems = [
          {
            day: 'D1',
            title: '为自己设定“整体仓位上限”',
            desc: '例如：普通市况不超过 50%，高风险阶段不超过 30%。'
          },
          {
            day: 'D2-D4',
            title: '每天只跟踪 3 个核心指标',
            desc: '比如：指数位置、成交量、北向 / 资金流，其他信息都归档到“杂讯”。'
          },
          {
            day: 'D5-D7',
            title: '用小资金演练“减仓优先”',
            desc: '当感觉“看不懂”时，先减仓，而不是继续加仓赌方向。'
          }
        ];
        break;

      /** 4. 整体亏损危险等级（danger） */
      case 'danger':
        base.typeLabel = '整体亏损危险等级';
        if (level === 'low') {
          base.title = '当前危险等级不高，但仍需坚持风控习惯';
          base.shortDesc =
            '你的账户尚未进入高危险区，继续保持“轻仓 + 止损”会很好。';
          base.badges = ['亏损可控', '仓位节奏尚可', '有改进空间'];
        } else if (level === 'mid') {
          base.title = '危险等级中等，若不改变习惯，未来会逐步恶化';
          base.shortDesc =
            '你已经出现“越亏越重 / 越亏越急”的迹象，需要系统性调整。';
          base.badges = ['补仓频繁', '不愿认错', '规则执行不稳定'];
        } else {
          base.title = '危险等级偏高，建议立即减仓并进入修复模式';
          base.shortDesc =
            '继续按现在的方式交易，很容易出现一次性 30% 以上的回撤。';
          base.badges = ['重仓扛单', '短线变中线', '盲目摊平成本'];
        }

        base.profileHint = '综合你的答题与分数，我们看到：';
        base.profileItems = [
          {
            title: '你对“风险极限”概念还不够清晰',
            desc: '比如：最大能接受亏多少、单日最大亏损多少，并没有量化。'
          },
          {
            title: '收益目标与承受风险之间略显失衡',
            desc: '期望收益偏高，但风险管理仍停留在“感觉上”。'
          }
        ];

        base.planItems = [
          {
            day: 'D1',
            title: '明确 3 个数字：账户上限回撤 / 单笔止损 / 单日止损',
            desc: '写在纸上或备忘录里，后续所有交易都不能突破这 3 条红线。'
          },
          {
            day: 'D2-D3',
            title: '尝试减少品种与交易次数',
            desc: '先把标的缩减到 1～3 只，目标是“看得懂、控得住”，而不是“买得多”。'
          },
          {
            day: 'D4-D7',
            title: '用风控计算器重新设计每一笔仓位',
            desc: '所有加减仓都用工具算一遍，逐渐把风险控制从“感觉”变成“数字”。'
          }
        ];
        break;

      /** 5. 风控能力评分（ability / score）—— 高分=优秀，绿色 */
      case 'ability':
      case 'score':
      default:
        base.typeLabel = '风控能力综合评分';

        if (level === 'low') {
          // 分数低：能力偏弱（红色标签）
          base.title = '当前风控能力偏弱，需要系统性补课';
          base.shortDesc =
            '你已经意识到风险重要性，但在规则、执行与复盘上仍比较薄弱，容易被行情牵着走。';
          base.badges = ['规则不成体系', '止损执行不稳定', '复盘习惯较弱'];
        } else if (level === 'mid') {
          // 分数中：能力待提升（黄色）
          base.title = '风控能力处于“及格线附近”，提升空间很大';
          base.shortDesc =
            '你在某些方面做得不错，但整体一致性不足，需要一套完整的执行系统来托底。';
          base.badges = ['部分交易有计划', '仓位管理尚可', '情绪容易反客为主'];
        } else {
          // 分数高：能力优秀（绿色标签）
          base.title = '已经具备走向机构化交易者的风控基础';
          base.shortDesc =
            '你愿意用数字和规则约束自己，只要保持稳定执行，就有机会长期留在牌桌上。';
          base.badges = ['重视回撤', '能接受空仓', '善于总结复盘'];
        }

        base.profileHint = '从你的答题习惯看，你在风控上的优势与短板：';
        base.profileItems = [
          {
            title: '在“事前规划”方面仍有优化空间',
            desc: '你会考虑风险，但不一定会把止损价、目标价写下来。'
          },
          {
            title: '在“事后复盘”方面尚未形成固定流程',
            desc: '一笔交易结束后，很少系统性地复盘买入、加仓、离场是否合理。'
          }
        ];

        base.planItems = [
          {
            day: 'D1',
            title: '写下你理想中的“风控交易者画像”',
            desc: '比如：最大回撤、年化目标、每月允许交易次数、允许的最大连续亏损等。'
          },
          {
            day: 'D2-D4',
            title: '用熵盾风控计算器，设计一套固定仓位模板',
            desc: '例如 80% 资金参与、4 次进场比例、止损和目标价的距离。'
          },
          {
            day: 'D5-D7',
            title: '开始建立属于自己的“风控执行清单”',
            desc: '每次交易前后，都对照清单打钩，逐步把好习惯固化下来。'
          }
        ];
        break;
    }

    base.level = level;
    return base;
  },

  // 去风控计算器
  goCalc() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index'
    });
  },

  // 去训练营
  goCamp() {
    wx.navigateTo({
      url: '/pages/campIntro/index'
    });
  },

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});
