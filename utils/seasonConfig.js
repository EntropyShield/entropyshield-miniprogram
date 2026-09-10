// utils/seasonConfig.js
// 训练营 / 赛季 的配置层：把原本硬编码的「7 天」参数化，并新增 30 天守纪赛季。
//
// 设计原则（2026-09-10 Phase 1）：
// 1) 默认模式 training = 原 7 天训练营，行为与改造前完全一致（文案、天数、奖励阈值均不变）。
// 2) season 模式 = 30 天守纪挑战赛，天数/承诺项/加赠比例全部由配置驱动。
// 3) 本文件只产出数据，不碰任何页面逻辑，也不发请求 —— 零副作用，可安全 require。
//
// 合规约束（总纲 / 62 号审计）：
// - 全篇禁止收益率、盈亏金额、收益暗示；只谈执行率与纪律。
// - 赛季判定只认「是否执行规则」，不读会员态（付费不得影响成绩）。

// ---------------------------------------------------------------------------
// 模式定义
// ---------------------------------------------------------------------------

var MODES = {
  // 原 7 天训练营（默认，保持现状）
  training: {
    key: 'training',
    days: 7,
    title: '7 天风控训练营',
    subtitle: '先控亏，再谈收益',
    rewardTimes: 4,        // 完成一轮赠送的完整方案次数
    maxRewardRounds: 3,    // 最多奖励轮次
    promises: [],          // 无承诺选择，走固定脚本
    bonusPct: 0            // 无加赠
  },

  // 30 天守纪挑战赛（62 号方案 Phase 1）
  season: {
    key: 'season',
    days: 30,
    title: '30 天守纪挑战赛',
    subtitle: '连续 30 天，按规则执行',
    rewardTimes: 10,       // 完成一个赛季赠送的完整方案次数
    maxRewardRounds: 99,   // 赛季按季结算，不限制参加次数
    bonusPct: 50,          // 首赛季（S1）加赠 50%；S2 起由后端下发 30%
    promises: [
      {
        id: 'A',
        name: '不留裸单',
        short: '每笔持仓都有止损位',
        desc: '建仓即设止损，不允许出现没有止损位的持仓。',
        check: '当日收盘时，所有持仓均已设置止损位。'
      },
      {
        id: 'B',
        name: '止损 48 小时内记录',
        short: '触发止损后 48h 内完成记录',
        desc: '每次触发止损，必须在 48 小时内写下原因与执行过程。',
        check: '触发止损后 48 小时内，已提交一条止损记录。'
      },
      {
        id: 'C',
        name: '单笔风险不超过 2%',
        short: '单笔最大亏损 ≤ 账户 2%',
        desc: '任何单笔交易的最大可承受亏损，不超过账户资金的 2%。',
        check: '当日新建仓位的单笔风险敞口均 ≤ 2%。'
      }
    ]
  }
};

// ---------------------------------------------------------------------------
// 赛季 30 天：每日焦点（4 周主题 × 每日一项，避免写 30 套完整文案）
// ---------------------------------------------------------------------------

// 每周主题（用于拼装 review / homework 模板）
var WEEK_THEME = {
  1: { theme: '认知与底线', review: '今天哪一次操作，是「按规则」而不是「按感觉」？', homework: '把今天最有触动的一条，写进你的底线清单。' },
  2: { theme: '纪律执行', review: '今天有没有想破例的瞬间？最后是怎么处理的？', homework: '给明天的自己写一条提醒：遇到 X 情况时，先做 Y。' },
  3: { theme: '系统固化', review: '今天的执行，有多少来自流程、多少来自临时判断？', homework: '把你今天用到的检查项，补进固定流程里。' },
  4: { theme: '压力与长期', review: '今天最难受的一刻是什么？规则有没有被顶住？', homework: '写一句能在压力下管住自己的话，放在最显眼的地方。' }
};

// 30 天每日焦点（d=第几天, name=日历短名, title=当日主题, focus=当日执行项）
var SEASON_DAY_META = [
  { d: 1, name: '底线宣言', title: '写下你不再重复的亏损习惯', focus: '列出最近 3 笔让你难受的交易，只写事实：买入原因、加仓节点、离场原因。' },
  { d: 2, name: '账户体检', title: '算出你能承受的最大回撤', focus: '统计近 3-6 个月最大回撤、最大单笔亏损、连续亏损次数，写下心理极限。' },
  { d: 3, name: '单笔上限', title: '把单笔风险写成一个数字', focus: '确定你的单笔最大风险敞口（建议 ≤ 2%），写下来并贴在交易界面旁。' },
  { d: 4, name: '止损位', title: '给每一笔持仓画出止损线', focus: '检查当前所有持仓：哪些还没设止损位？今天全部补齐。' },
  { d: 5, name: '仓位规则', title: '定下你的仓位上限', focus: '写下单一标的与总仓位的上限比例，以及触发减仓的条件。' },
  { d: 6, name: '情绪记录', title: '给情绪打一次分', focus: '记录今天最强烈的一次情绪波动，以及触发它的行情变化。' },
  { d: 7, name: '第一周复盘', title: '第一周：我做到了几条', focus: '回看 D1-D6，统计自己真正做到几天，没做到的原因是什么。' },
  { d: 8, name: '不留裸单', title: '今日不许出现无止损的持仓', focus: '建仓前先写止损位，没有止损位就不建仓。' },
  { d: 9, name: '先写后做', title: '开仓前先写下方案', focus: '今天每一笔交易前，先写下：进场理由、止损位、目标位、退出条件。' },
  { d: 10, name: '执行止损', title: '触发止损就走，不讨价还价', focus: '今天若触发止损，按价位执行，不做任何例外处理。' },
  { d: 11, name: '不追高', title: '拒绝临时起意的追单', focus: '今天不在盘中止损位之外临时追单；想追就先记下来，收盘再看。' },
  { d: 12, name: '不加死码', title: '亏损不加仓', focus: '今天任何亏损中的持仓，都不加仓摊平。' },
  { d: 13, name: '减仓规则', title: '达到条件就减，不犹豫', focus: '检查是否有持仓已触发你的减仓条件；触发即执行。' },
  { d: 14, name: '第二周复盘', title: '第二周：执行率是多少', focus: '统计本周 7 天的执行率，找出最高频的破戒点。' },
  { d: 15, name: '复盘模板', title: '固定你的复盘格式', focus: '确定一套固定复盘模板（进场/持仓/离场各检查什么），今天起照用。' },
  { d: 16, name: '交易日志', title: '建立一页纸交易日志', focus: '把今天所有操作按模板记进日志，含未执行的计划。' },
  { d: 17, name: '熔断机制', title: '设定连续亏损熔断线', focus: '写下连续亏损 N 笔后强制停手的规则，并承诺执行。' },
  { d: 18, name: '月度回撤线', title: '画出月度最大回撤红线', focus: '设定月度回撤上限，触及即当月停止交易。' },
  { d: 19, name: '机会筛选', title: '只做符合清单的机会', focus: '今天只考虑符合你筛选清单的机会，其余一律跳过。' },
  { d: 20, name: '等待纪律', title: '今天练习「不动手」', focus: '没有符合条件的机会就空仓，把「等待」也当成一次执行。' },
  { d: 21, name: '第三周复盘', title: '第三周：流程化了多少', focus: '评估本周有多少决策来自固定流程，而非临场判断。' },
  { d: 22, name: '极端预案', title: '给极端行情写预案', focus: '写下极端行情（跳空/连续跌停/流动性枯竭）时的处理动作。' },
  { d: 23, name: '减少看盘', title: '刻意减少盘中看盘次数', focus: '今天把看盘次数控制在你设定的上限内，用计时器提醒自己。' },
  { d: 24, name: '降低频率', title: '今天只做必要的操作', focus: '统计今日操作次数，与上周同期对比，问自己是否过度交易。' },
  { d: 25, name: '回撤与耐心', title: '理解回撤的必然性', focus: '写下你能接受的回撤区间，以及回撤期间的应对动作。' },
  { d: 26, name: '清单定稿', title: '定稿你的风控执行清单', focus: '把三周积累的规则整理成一页纸：进场前/持仓中/离场后。' },
  { d: 27, name: '模拟演练', title: '用清单走一遍完整流程', focus: '选一个标的，用清单完整模拟一遍：规划→建仓→加减仓→止损/止盈→复盘。' },
  { d: 28, name: '纪律评分', title: '给自己的纪律打分', focus: '按执行率给这 28 天打分，并写下扣分最多的那一项。' },
  { d: 29, name: '写给同路人', title: '把你的经验写给一个新手', focus: '用你自己的话，写给刚入市的人一条最重要的风控建议。' },
  { d: 30, name: '赛季总结', title: '30 天结束：我把哪些变成了习惯', focus: '列出这 30 天真正沉淀下来的 3 条习惯，以及下赛季要改进的一项。' }
];

/**
 * 生成 30 天赛季的每日任务（结构与 7 天训练营保持一致，页面无需分支）
 * 字段：day / name / title / brief / daily[] / practice[] / review[] / homework[]
 */
function buildSeasonTasks(cfg) {
  var weekOf = function (d) { return Math.min(4, Math.floor((d - 1) / 7) + 1); };

  return SEASON_DAY_META.map(function (m) {
    var w = WEEK_THEME[weekOf(m.d)] || WEEK_THEME[4];
    return {
      day: 'D' + m.d,
      name: m.name,
      title: m.title,
      brief: '第 ' + weekOf(m.d) + ' 周 · ' + w.theme + ' ｜ ' + (cfg ? cfg.title : '30 天守纪挑战赛'),
      daily: [m.focus],
      practice: ['按你选择的守纪承诺，在今天的所有操作中执行，并在下方记录执行结果。'],
      review: [w.review],
      homework: [w.homework]
    };
  });
}

// ---------------------------------------------------------------------------
// 对外方法
// ---------------------------------------------------------------------------

/** 由页面入参解析模式：?mode=season → season，其余一律 training（默认行为不变） */
function getMode(options) {
  var m = (options && (options.mode || options.campMode)) || '';
  m = String(m).toLowerCase();
  return MODES[m] ? MODES[m] : MODES.training;
}

/** 生成 D1..Dn 的 dayKey 数组 */
function dayKeysOf(cfg) {
  var out = [];
  for (var i = 1; i <= (cfg && cfg.days ? cfg.days : 7); i++) out.push('D' + i);
  return out;
}

// ---------------------------------------------------------------------------
// [Phase 2] 训练日历（64 号评估 + 用户 2026-09-10 决议）
//
// 结论一：7 天训练营**不被交易日历绑死** —— 实证只有 D1/D7 需要实盘，其余 5 天
//         本质是盘后复盘与规则制定；周末不是没时间训练，是不适合动手。
//         故周末自动降级为「复盘日」：隐藏实盘演练，保留 daily/review/homework。
// 结论二：30 天赛季**周末与节假日不判定、不计入分母** —— 承诺只在交易日有意义，
//         判通过=白送 8-10 天稀释含金量，判不通过=冤枉用户导致弃赛。
//         口径：30 自然日 ≈ 22 个交易日参与判定。
// ---------------------------------------------------------------------------

/** 本地日期 YYYY-MM-DD（与后端 todayStr 同格式） */
function dateStr(d) {
  var dt = d ? new Date(d) : new Date();
  var p = function (n) { return String(n).padStart ? String(n).padStart(2, '0') : ('0' + n).slice(-2); };
  return dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate());
}

/** 是否周末（仅作前端乐观兜底；节假日以服务端 season_trading_day / 温度快照为准） */
function isWeekend(ds) {
  var s = String(ds || dateStr()).slice(0, 10);
  var wd = new Date(s + 'T00:00:00').getDay();
  return wd === 0 || wd === 6;
}

/**
 * 周末降级：把当天的「实盘演练」换成「复盘」。
 * 只删 practice、补一条说明，其余字段保持原样 —— 页面无需分支即可兼容。
 */
function applyRestDay(task, ds) {
  if (!task || !isWeekend(ds)) return task;
  var out = {};
  for (var k in task) if (Object.prototype.hasOwnProperty.call(task, k)) out[k] = task[k];
  out.isRestDay = true;
  out.practice = [];
  out.restTip = '周末休市：今天不做实盘动作，只做复盘与规则整理。';
  return out;
}

/** 30 自然日 ≈ 22 个交易日（与后端 0.72 系数保持一致） */
function estimateTradingDays(days) {
  return Math.max(1, Math.round(Number(days || 30) * 0.72));
}

module.exports = {
  MODES: MODES,
  SEASON_DAY_META: SEASON_DAY_META,
  WEEK_THEME: WEEK_THEME,
  buildSeasonTasks: buildSeasonTasks,
  getMode: getMode,
  dayKeysOf: dayKeysOf,
  dateStr: dateStr,
  isWeekend: isWeekend,
  applyRestDay: applyRestDay,
  estimateTradingDays: estimateTradingDays
};
