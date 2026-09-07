// utils/courseManifest.js
// 控局者学院 · 课程内容即数据（doc 51 可升级架构核心）
// 设计要点：
//  1) 加课 = 加一条数据，不动页面代码；新内容形态 = 加一个 block 类型一次，全站复用。
//  2) 每条课带 schemaVersion，向前兼容；unlock 走插件化策略（free/points/paid/member）。
//  3) 所有内容由「熵盾 AI 教研」生成，无真人讲师；页面须显著标识 AI（合规《标识办法》）。
//  4) 免费课观看 0 积分（只看不发分）；积分只奖主动行为（打卡/分享/结课/付费，见 utils/points.js）。
//
// block 类型（CourseRenderer 支持）：
//   hero    口号标题
//   hook    价值钩子 + 反常识开场
//   card    知识点卡片 {title, body}
//   story   拟人化故事 {title, body}
//   quiz    互动题 {q, a}
//   mnemonic 记忆口诀 {text}
//   action  今天行动卡 {text}
//   disclaimer 免责声明 {text}
//
// unlock 取值：free(免费·0分) / points(积分兑换) / paid(付费解锁) / member(会员通看)
// 红线：文案只讲纪律/等级/报告，禁"盈利/稳赚/保本/建议买"。

const SCHEMA_VERSION = 1;

const MODULES = [
  { id: 'A', name: '风控启蒙', level: '入门守护者', desc: '搞懂亏钱的根因与三道底线，建立"先控亏再谈赚"的直觉。', unlock: 'free' },
  { id: 'B', name: '稳健方法', level: '控局者·青铜', desc: '把止损、仓位、开仓清单变成开仓前会自动做的动作。', unlock: 'mixed' },
  { id: 'C', name: '实战演练', level: '控局者·白银', desc: '用真实场景演练分批进场、持仓诊断与盘中应激。', unlock: 'mixed' },
  { id: 'D', name: '交易心法', level: '控局者·黄金', desc: '管住情绪、连续打卡、把纪律养成习惯。', unlock: 'mixed' },
  { id: 'E', name: '体系搭建', level: '控局者·铂金', desc: '搭一套可长期复用的个人风控系统。', unlock: 'member' },
  { id: 'F', name: '控局大师', level: '控局者·钻石', desc: '从守门人到控局者，活过三轮牛熊。', unlock: 'member' }
];

// A 模块 12 课 · 全文（生动 / 有趣 / 实用 / 简单有效）
const A_LESSONS = [
  {
    id: 'A1', moduleId: 'A', title: '你账户里的"隐形小偷"', subtitle: '为什么亏钱的从来不是消息，而是没画线的手',
    duration: 4, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '你账户里的"隐形小偷"' },
      { t: 'hook', text: '大多数人亏钱，第一反应是新消息不准、庄家太狠、运气太差。但统计上看，真正偷走账户的大多是同一个东西——没有提前画好"这条线不能越"。本课用一个小故事，让你一眼认出它。' },
      { t: 'card', title: '小偷一：没止损', body: '下跌时不设底线，账户被一次性"搬空"，再没有翻本的本钱。' },
      { t: 'card', title: '小偷二：满仓赌', body: '一把 all-in，对错各 50%，但错一次就出局，市场专杀赌徒。' },
      { t: 'card', title: '小偷三：不止盈复盘', body: '赚的靠运气，亏的靠硬扛，一年下来账户原地踏步。' },
      { t: 'story', title: '账户舱的小人国', body: '把账户想象成一艘船，里面住着三个小人：船长（你的计划）、水手（你的手）、小偷（没画线的冲动）。小偷最爱趁船长不在时撬舱门。画一条线（止损线），等于给舱门装锁。' },
      { t: 'quiz', q: '下列哪件事最像"账户小偷"？', a: '没设止损、跌了还加仓摊平 —— 这正是在给小偷递钥匙。' },
      { t: 'mnemonic', text: '口诀：先画线，再下单；线不到，手不动。' },
      { t: 'action', text: '今天：打开风控计算器，给任意一只你关注的票算一次最大可亏金额，写进备忘录。' },
      { t: 'disclaimer', text: '熵盾只做风控测算与纪律陪伴，不构成任何投资建议，不替你做买卖决策。' }
    ]
  },
  {
    id: 'A2', moduleId: 'A', title: '给每笔交易画一条"不能越过的线"', subtitle: '风险预算：用 1% 守住账户的命',
    duration: 4, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '给每笔交易画一条"不能越过的线"' },
      { t: 'hook', text: '职业交易员第一原则：先想"这笔最多亏多少"，再想"能赚多少"。账户活得久，靠的不是每把都赢，而是每把亏得少。' },
      { t: 'card', title: '风险预算=账户×比例', body: '10 万账户、单笔风险 1% = 每笔最多亏 1000 元。比例你自己定（0.5%–3%），但一定要先定。' },
      { t: 'card', title: '由预算反推止损价', body: '想亏 1000、买 1000 股，则每股最多跌 1 元就是止损线。线由预算算出来，不是拍脑袋。' },
      { t: 'card', title: '比例固定，次数才多', body: '每次都只冒 1% 险，你能错 100 次还有本钱；一次冒 50%，错两次就接近归零。' },
      { t: 'story', title: '小船的吃水线', body: '风险预算是船身的吃水线。浪再大，只要不没过线，船就翻不了。很多船不是被浪打翻，是被自己灌太多水沉的。' },
      { t: 'quiz', q: '账户 20 万、单笔风险 1%，每笔最多亏多少？', a: '2000 元。预算先算，止损价才站得住。' },
      { t: 'mnemonic', text: '口诀：先算亏，再算赚；比例定，活得长。' },
      { t: 'action', text: '今天：把你的单笔风险比例写下来（如 1%），下次开仓前先算预算。' },
      { t: 'disclaimer', text: '比例为通用风控认知，非收益承诺；具体比例请结合自身承受能力。' }
    ]
  },
  {
    id: 'A3', moduleId: 'A', title: '止损不是认输，是给账户买保险', subtitle: '为什么高手都先买"退路"',
    duration: 3, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '止损不是认输，是给账户买保险' },
      { t: 'hook', text: '很多人扛单，是因为觉得"止损=承认我错了"。换个角度看：止损是花小钱买一份"不爆仓"的保险。' },
      { t: 'card', title: '止损=保费', body: '触发止损亏的那点，就是保费；没它，一次黑天鹅就能赔掉全年利润。' },
      { t: 'card', title: '扛单的代价', body: '小亏拖成大亏，大亏拖成套牢，套牢拖成睡不着——情绪成本远高于那笔保费。' },
      { t: 'card', title: '机械执行', body: '到线就走，不讨价还价。把决策提前到冷静时做，盘中只执行。' },
      { t: 'story', title: '消防栓原则', body: '家里装消防栓不是盼着着火，是着火时能保命。止损同理：你希望永远用不上，但必须有。' },
      { t: 'quiz', q: '到止损线但"再等等会不会回？"该怎么做？', a: '按计划走。回不回是市场的事，守住底线是你的事。' },
      { t: 'mnemonic', text: '口诀：止损是保险，不是投降；到线就走，不商量。' },
      { t: 'action', text: '今天：给持仓里每一只票标上止损价，没标的今晚补齐。' },
      { t: 'disclaimer', text: '熵盾提供工具与规则支持，买卖决策与结果由你自行承担。' }
    ]
  },
  {
    id: 'A4', moduleId: 'A', title: '仓位不是猜大小，是算"亏得起多少"', subtitle: '用预算倒推你该买几股',
    duration: 4, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '仓位不是猜大小，是算"亏得起多少"' },
      { t: 'hook', text: '"满仓干"听起来热血，实则是把账户的命交给了一次对错。仓位该由"亏得起多少"倒推，不是由"有多看好"决定。' },
      { t: 'card', title: '预算÷每股风险=股数', body: '每笔愿亏 1000、每股风险 2 元，则买 500 股。算出来，不猜。' },
      { t: 'card', title: '整百股取整', body: 'A 股一手 100 股，算出的股数向下取整百，别买零股（无法顺利平仓）。' },
      { t: 'card', title: '多笔分摊', body: '看好也分批，单笔风险不超标，留子弹应对变化。' },
      { t: 'story', title: '分篮子装鸡蛋', body: '你不会把全部鸡蛋塞一个篮子还举过头顶。仓位也是：分开放，摔一个不致命。' },
      { t: 'quiz', q: '愿亏 2000、每股风险 4 元、A 股整百，买多少股？', a: '500 股（2000÷4=500，恰为整百）。' },
      { t: 'mnemonic', text: '口诀：仓由亏定，不由看好定；整百买，留后手。' },
      { t: 'action', text: '今天：用风控计算器算一笔你真想买的票，看股数是否合理。' },
      { t: 'disclaimer', text: '计算结果为风控参考，非买卖建议。' }
    ]
  },
  {
    id: 'A5', moduleId: 'A', title: '整百股与手续费：别让摩擦吃掉纪律', subtitle: '交易成本的隐形损耗',
    duration: 3, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '整百股与手续费：别让摩擦吃掉纪律' },
      { t: 'hook', text: '频繁小割、零股折腾，手续费和滑点会悄悄啃掉你的纪律成果。看懂成本，才看得懂真实盈亏。' },
      { t: 'card', title: 'A 股一手=100 股', body: '买入须为 100 整数倍；不足一手的零头无法顺畅卖出，规划时避开。' },
      { t: 'card', title: '成本含佣金+印花税', body: '卖出有印花税，买卖有佣金，短线高频时成本占比显著上升。' },
      { t: 'card', title: '止损也要算成本', body: '画止损线时把单边成本算进去，否则"止在成本线"实则小亏。' },
      { t: 'story', title: '漏水的船', body: '账户像船，手续费是底板的小洞。一次看不出，天天漏就沉。' },
      { t: 'quiz', q: '为什么零股计划要避开？', a: '无法整手平仓、流动性差，纪律执行会卡壳。' },
      { t: 'mnemonic', text: '口诀：整百买，算成本；小洞补，船不沉。' },
      { t: 'action', text: '今天：查一次你最近一笔交易的实际手续费占比。' },
      { t: 'disclaimer', text: '费率以券商实际为准，本课仅为成本意识提醒。' }
    ]
  },
  {
    id: 'A6', moduleId: 'A', title: '交易前的 3 分钟清单', subtitle: '开仓必过的 5 道关',
    duration: 4, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '交易前的 3 分钟清单' },
      { t: 'hook', text: '冲动下单前，给大脑 3 分钟。一份清单，把"凭感觉"换成"按规则"。' },
      { t: 'card', title: '关1：资金真实可用', body: '用你真实账户里能亏的钱，不借钱、不加超限杠杆。' },
      { t: 'card', title: '关2：已算风险预算', body: '单笔最多亏多少？止损价多少？先有数再动手。' },
      { t: 'card', title: '关3：股数整百', body: '由预算倒推股数，向下取整百，避开零股。' },
      { t: 'card', title: '关4：已有持仓风险', body: '算上现有持仓，总风险是否超当日上限。' },
      { t: 'card', title: '关5：写进入口', body: '把计划写进风控计算器/持仓记录，盘中只执行。' },
      { t: 'story', title: '飞行前检查单', body: '飞行员起飞前必念检查单，不是不相信技术，是防"一时昏"。你也需要。' },
      { t: 'quiz', q: '哪一步最容易被跳过却最关键？', a: '关2 算风险预算——没它，其余都是空谈。' },
      { t: 'mnemonic', text: '口诀：五关过，再下单；少一关，先暂停。' },
      { t: 'action', text: '今天：把这份清单截图设为开仓前壁纸。' },
      { t: 'disclaimer', text: '清单为风控流程参考，非投资建议。' }
    ]
  },
  {
    id: 'A7', moduleId: 'A', title: '持仓诊断：你的账户现在安全吗', subtitle: '3 秒看懂持仓风险',
    duration: 3, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '持仓诊断：你的账户现在安全吗' },
      { t: 'hook', text: '买完不是结束，是守护开始。每周一次持仓诊断，像体检一样必要。' },
      { t: 'card', title: '查止损线', body: '每只票都有止损价吗？没有=缺口，立即补。' },
      { t: 'card', title: '查总风险', body: '全部持仓若同时触止损，总亏损在预算内吗？' },
      { t: 'card', title: '查集中度过高的票', body: '单一标的占比过高=把命押一处，考虑分摊。' },
      { t: 'story', title: '花园巡检', body: '账户像花园，不巡就长杂草（无止损的票）。每周拔一次草，园子才整齐。' },
      { t: 'quiz', q: '持仓诊断最该先补什么？', a: '给没有止损价的票立刻标线。' },
      { t: 'mnemonic', text: '口诀：周周诊，线线齐；缺口补，心不虚。' },
      { t: 'action', text: '今天：打开"持仓诊断"，数数几只票还没设止损。' },
      { t: 'disclaimer', text: '诊断结果仅基于你录入的数据，非投资顾问意见。' }
    ]
  },
  {
    id: 'A8', moduleId: 'A', title: '复盘不是写日记，是留证据', subtitle: '给未来的自己留一张地图',
    duration: 4, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '复盘不是写日记，是留证据' },
      { t: 'hook', text: '复盘的价值不在"反省"，而在"留下可复用的证据"：哪次守了线、哪次破了戒。' },
      { t: 'card', title: '记计划 vs 实际', body: '开仓前计划是什么，盘中实际做了什么，差异就是成长点。' },
      { t: 'card', title: '记情绪触发点', body: '哪次是"上头"买的？标出来，下次同场景先停手。' },
      { t: 'card', title: '记守住线的单', body: '守纪律盈利的单更要记，强化正向习惯。' },
      { t: 'story', title: '时间胶囊', body: '复盘是给三个月后的自己寄时间胶囊：到时候打开，就知道哪些坑别再踩。' },
      { t: 'quiz', q: '复盘最该记的是什么？', a: '计划与实际的差异，以及情绪触发点。' },
      { t: 'mnemonic', text: '口诀：记差异，记情绪；常回看，少踩坑。' },
      { t: 'action', text: '今天：写一条你最近一笔交易的复盘（3 句话即可）。' },
      { t: 'disclaimer', text: '复盘为个人记录，熵盾不提供投资建议。' }
    ]
  },
  {
    id: 'A9', moduleId: 'A', title: '情绪来了怎么办：给"上头"装刹车', subtitle: '3 个立刻能用的降温动作',
    duration: 3, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '情绪来了怎么办：给"上头"装刹车' },
      { t: 'hook', text: '市场专挑你上头时下手。识别情绪、装个刹车，比学 100 个指标都管用。' },
      { t: 'card', title: '信号：心跳快/想 ALL IN', body: '身体比大脑先报警，出现就暂停。' },
      { t: 'card', title: '动作1：关软件 10 分钟', body: '物理隔离，让皮质醇降下来。' },
      { t: 'card', title: '动作2：念清单', body: '回到 A6 的五关，过不了就不做。' },
      { t: 'story', title: '红绿灯', body: '情绪是黄灯，不是绿灯。黄灯亮，该停不是该冲。' },
      { t: 'quiz', q: '上头时第一步该做什么？', a: '立刻关掉交易软件，物理隔离。' },
      { t: 'mnemonic', text: '口诀：上头先停，莫硬撑；黄灯亮，等绿灯。' },
      { t: 'action', text: '今天：把"关软件 10 分钟"设为手机快捷指令。' },
      { t: 'disclaimer', text: '情绪管理为通用方法，非医疗或投资建议。' }
    ]
  },
  {
    id: 'A10', moduleId: 'A', title: '连续打卡 7 天：习惯比天赋值钱', subtitle: '用最小动作养出纪律',
    duration: 3, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '连续打卡 7 天：习惯比天赋值钱' },
      { t: 'hook', text: '风控不是靠顿悟，靠每天一次的小动作。连续 7 天打卡，大脑就把"看风险"变成默认项。' },
      { t: 'card', title: '门槛要极低', body: '每天只做一件小事：看一眼风险温度或打卡一次，不难就不拖延。' },
      { t: 'card', title: '连胜保护', body: '偶尔漏一天别清零，用积分兑一次保护，降低流失。' },
      { t: 'card', title: '看见进度', body: '7 格亮起来，断签显红，进度看得见才有动力。' },
      { t: 'story', title: '肌肉记忆', body: '就像每天刷牙，做够 21 天就自动驾驶。纪律也是肌肉，练出来。' },
      { t: 'quiz', q: '为什么打卡门槛要低？', a: '低门槛才做得下去，做得下去才成习惯。' },
      { t: 'mnemonic', text: '口诀：天天做，不贪多；七格亮，习惯成。' },
      { t: 'action', text: '今天：打开小程序完成第一次打卡，设每天固定提醒。' },
      { t: 'disclaimer', text: '打卡为行为习惯工具，不构成收益承诺。' }
    ]
  },
  {
    id: 'A11', moduleId: 'A', title: '控局者是什么：从赌徒到守门人', subtitle: '你和市场的关系该重新定义',
    duration: 4, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '控局者是什么：从赌徒到守门人' },
      { t: 'hook', text: '赌徒关心"这把赢多少"，守门人关心"这把别出局"。身份一换，动作全变。' },
      { t: 'card', title: '赌徒：All in 听天由命', body: '把结果交给运气，长期必被概率收割。' },
      { t: 'card', title: '守门人：先控亏再求活', body: '每笔限风险，留本钱打持久战。' },
      { t: 'card', title: '控局者：体系化自律', body: '工具+打卡+复盘，形成可复用的个人风控系统。' },
      { t: 'story', title: '球场守门员', body: '前锋负责进球，守门员负责不丢球。你先当好自己的守门员，比分才不会崩。' },
      { t: 'quiz', q: '控局者最先保证什么？', a: '先保证不出血、活得久，再谈收益。' },
      { t: 'mnemonic', text: '口诀：先守门，再进攻；活下去，才有戏。' },
      { t: 'action', text: '今天：写一句话定义"我要成为自己的守门人"。' },
      { t: 'disclaimer', text: '身份比喻仅作理念传达，非投资建议。' }
    ]
  },
  {
    id: 'A12', moduleId: 'A', title: '你的第一张风控仪表盘', subtitle: 'A 模块结业：把今天学的串起来',
    duration: 5, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '你的第一张风控仪表盘' },
      { t: 'hook', text: '结业不是结束，是装上仪表盘的第一天。四块表，每天开盘前扫一眼。' },
      { t: 'card', title: '表1：风险温度', body: '今日市场风险温度，决定今天激进度。' },
      { t: 'card', title: '表2：持仓诊断', body: '几只票没止损？总风险超预算没？' },
      { t: 'card', title: '表3：今日清单', body: '打卡、测算、复盘，三件小事勾完。' },
      { t: 'card', title: '表4：连胜天数', body: '连续守纪几天，断签立刻补。' },
      { t: 'story', title: '飞行员仪表', body: '老练飞行员不靠感觉飞，靠仪表。你也一样：看表，不拍脑袋。' },
      { t: 'quiz', q: '仪表盘最核心的一块是？', a: '四块都重要，但"持仓诊断"最常被忽略，务必每天看。' },
      { t: 'mnemonic', text: '口诀：四表齐，开盘稳；天天看，控局成。' },
      { t: 'action', text: '结业行动：连续 7 天用仪表盘，然后来 B 模块学稳健方法。' },
      { t: 'disclaimer', text: '仪表盘为风控工具聚合，不构成投资建议。' }
    ]
  }
];

// [熵盾 V2.1 · 技能:S04 学院 B–F 全文] Module B 全文（doc 51 流水线，每课必审留痕）
const B_LESSONS = [
  {
    id: 'B1', moduleId: 'B', title: '止损价的三种画法', subtitle: '百分比法 / ATR法 / 前低法怎么选',
    duration: 4, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '止损价的三种画法' },
      { t: 'hook', text: '止损价不是随便画一条线，画法不同，性格也不同。本课给你三种，按你的风格挑一个用熟。' },
      { t: 'card', title: '百分比法', body: '买入价下方固定百分比（如 -5%）即止损。最简单，但不看波动，震荡市容易被洗。' },
      { t: 'card', title: 'ATR 法', body: '用近期平均真实波幅 ATR 定止损：波动大留宽、波动小留窄，更贴合行情节奏。' },
      { t: 'card', title: '前低法', body: '以近期明显低点下方一点点作止损，尊重市场结构，适合趋势与震荡边界。' },
      { t: 'story', title: '三条裤腰带', body: '百分比法是均码，ATR 是量腰围定做，前低是按身形改。选合身的不勒人，止损也一样。' },
      { t: 'quiz', q: '震荡市哪种画法更贴合结构？', a: '前低法或 ATR 法，比死百分比更尊重行情边界。' },
      { t: 'mnemonic', text: '口诀：止损三法看性格；震荡用结构，趋势用 ATR。' },
      { t: 'action', text: '今天：给一只持仓票分别用三法画一次止损价，看彼此差多少。' },
      { t: 'disclaimer', text: '画法为通用技术方法，非投资建议；具体比例请结合自身承受能力。' }
    ]
  },
  {
    id: 'B2', moduleId: 'B', title: '仓位公式实操', subtitle: '把预算变成股数的 3 个例子',
    duration: 4, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '仓位公式实操' },
      { t: 'hook', text: '预算÷每股风险=股数，这句口诀值千金。今天用三个例子把它练熟。' },
      { t: 'card', title: '例1', body: '账户 10 万、单笔风险 1%=1000、每股风险 2 元 → 买 500 股。' },
      { t: 'card', title: '例2', body: '账户 50 万、风险 0.5%=2500、每股风险 5 元 → 买 500 股。' },
      { t: 'card', title: '例3', body: '算出来非整百 → 向下取整百（如 533→500），留余地也便于平仓。' },
      { t: 'story', title: '厨师按食谱下料', body: '预算是食谱，股数是份量，乱下料就糊锅。仓位也按预算下，不靠手感。' },
      { t: 'quiz', q: '账户 20 万、风险 1%、每股风险 4 元，买多少股？', a: '500 股（2000÷4=500，恰为整百）。' },
      { t: 'mnemonic', text: '口诀：公式三步走，预算÷风险=股；非整百，向下凑。' },
      { t: 'action', text: '今天：用公式算你下一只想买的票，写进计划单。' },
      { t: 'disclaimer', text: '计算为风控参考，非买卖建议。' }
    ]
  },
  {
    id: 'B3', moduleId: 'B', title: '分批进场不焦虑', subtitle: '为什么分 3 批比一把稳',
    duration: 4, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '分批进场不焦虑' },
      { t: 'hook', text: '一把梭是赌博，分三批是作战。分批让你错得起、也拿得住。' },
      { t: 'card', title: '为什么分 3 批', body: '一次判断常错，分 3 批把“猜”变“验证”：首仓探路、加仓确认。' },
      { t: 'card', title: '怎么分', body: '计划买 900 股 → 首仓 300 试探、确认后 300、再 300；每批都带止损。' },
      { t: 'card', title: '不焦虑的源头', body: '首仓小，错了亏得少；对了有后手加，心态自然稳。' },
      { t: 'story', title: '试水温', body: '先脚尖探，再小腿，再全身。没人会一头扎进未知水温的池子。' },
      { t: 'quiz', q: '分批最大的好处是什么？', a: '降低单次判断错误的杀伤，心态更稳，也更易拿住对的单。' },
      { t: 'mnemonic', text: '口诀：首仓探，确认加；批批带止损，心不慌。' },
      { t: 'action', text: '今天：把下一次计划拆成 3 批，标好每批触发条件。' },
      { t: 'disclaimer', text: '分批为通用风控手法，非收益承诺。' }
    ]
  },
  {
    id: 'B4', moduleId: 'B', title: '开仓清单自动化', subtitle: '用计算器生成你的计划单',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '开仓清单自动化' },
      { t: 'hook', text: '把 A6 的五关搬进计算器，点一下生成你的计划单，盘中只看单执行。' },
      { t: 'card', title: '清单六要素', body: '方向 / 股数 / 止损价 / 目标价 / 风险预算 / 批次，缺一不可。' },
      { t: 'card', title: '自动生成', body: '风控计算器输入预算与持仓，自动反推股数与止损，省去手算。' },
      { t: 'card', title: '存档复盘', body: '计划单存本地，盘后对照实际，差异即成长点。' },
      { t: 'story', title: '飞行计划表', body: '飞行员不靠记忆飞，你也不该靠脑子记计划。' },
      { t: 'quiz', q: '计划单最少要有哪六项？', a: '方向 / 股数 / 止损 / 目标 / 预算 / 批次。' },
      { t: 'mnemonic', text: '口诀：清单六要素，计算器代劳；盘前定，盘中跑。' },
      { t: 'action', text: '今天：用计算器生成一张你真想做的计划单并存档。' },
      { t: 'disclaimer', text: '工具生成计划，决策仍由你做。' }
    ]
  },
  {
    id: 'B5', moduleId: 'B', title: '移动止损的艺术', subtitle: '让利润跑、让底线跟',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '移动止损的艺术' },
      { t: 'hook', text: '止损不是焊死的，赚钱时可以往上移——让利润跑，让底线跟。' },
      { t: 'card', title: '什么是移动止损', body: '价格涨，止损价同步上移，锁定已有利润，不回吐。' },
      { t: 'card', title: '怎么移', body: '每涨一个波段，把止损提到成本线或近期低点上方，绝不回到成本之下。' },
      { t: 'card', title: '陷阱', body: '移太紧被洗、移太松吐利润——按 ATR 或半仓逻辑定节奏。' },
      { t: 'story', title: '爬楼梯扶手', body: '你往上走，手也往上挪，摔了还有扶手接。移动止损就是你账户的扶手。' },
      { t: 'quiz', q: '移动止损的核心目的？', a: '锁定利润的同时给趋势留空间，不靠猜顶离场。' },
      { t: 'mnemonic', text: '口诀：涨就提止损，成本线兜；利润落袋，不回吐。' },
      { t: 'action', text: '今天：给一只盈利持仓设一条移动止损规则并写下来。' },
      { t: 'disclaimer', text: '移动止损为技术方法，非投资建议。' }
    ]
  },
  {
    id: 'B6', moduleId: 'B', title: '回撤控制', subtitle: '账户从高点回撤多少该减仓',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '回撤控制' },
      { t: 'hook', text: '账户从最高点回落多少该减仓甚至空仓？这条线比目标价更重要。' },
      { t: 'card', title: '定义回撤', body: '当前资产 ÷ 历史高点 − 1 即回撤，是“活着”的体温计。' },
      { t: 'card', title: '设阈值', body: '单周回撤上限（如 -5%）触线减半；月回撤 -10% 考虑离场观望。' },
      { t: 'card', title: '为什么急', body: '大回撤后回本极难——亏 20% 要赚 25% 回本，亏 50% 要赚 100%。' },
      { t: 'story', title: '漏水警报', body: '船漏到一定比例必须停泵抽水，不然就沉。回撤红线就是你的抽水警报。' },
      { t: 'quiz', q: '亏 50% 要赚多少才能回本？', a: '100%，所以控回撤比追收益更急。' },
      { t: 'mnemonic', text: '口诀：回撤设红线，触线减；小漏快补，船不沉。' },
      { t: 'action', text: '今天：给你账户定一条周 / 月回撤红线，写进风控档案。' },
      { t: 'disclaimer', text: '阈值为通用认知，非收益承诺。' }
    ]
  },
  {
    id: 'B7', moduleId: 'B', title: '震荡市怎么活', subtitle: '不追涨杀跌的两种应对',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '震荡市怎么活' },
      { t: 'hook', text: '不追涨杀跌，震荡市靠“高抛低吸的纪律”活下来，而不是靠预测。' },
      { t: 'card', title: '识别震荡', body: '价格在一个区间上下晃、无明确方向、均线走平。' },
      { t: 'card', title: '做法1', body: '靠近区间下沿买、上沿卖，止损设在区间外。' },
      { t: 'card', title: '做法2', body: '降低仓位，震荡市假突破多，少动少错。' },
      { t: 'story', title: '荡秋千', body: '借力来回，不试图一直往一个方向冲。震荡市赚的是节奏，不是方向。' },
      { t: 'quiz', q: '震荡市最该避免什么？', a: '在区间内追涨杀跌、被假突破反复割。' },
      { t: 'mnemonic', text: '口诀：震荡看区间，下沿买上沿卖；假突破，管住手。' },
      { t: 'action', text: '今天：找一只你熟悉的震荡票，标出它的区间上下沿。' },
      { t: 'disclaimer', text: '区间判断为技术参考，非投资建议。' }
    ]
  },
  {
    id: 'B8', moduleId: 'B', title: '趋势市怎么跟', subtitle: '顺着线走，不抄底摸顶',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '趋势市怎么跟' },
      { t: 'hook', text: '顺着线走，不抄底摸顶。趋势是朋友，也是末端最大的陷阱。' },
      { t: 'card', title: '识别趋势', body: '高点低点依次抬高 = 上升；均线多头排列。' },
      { t: 'card', title: '跟法', body: '回踩不破前低就持有，破线减仓；不预测顶，让止损替你离场。' },
      { t: 'card', title: '末端警惕', body: '加速赶顶、放量滞涨，减仓不追，利润落袋。' },
      { t: 'story', title: '顺水行舟', body: '借水流走，别逆流划；但快到瀑布前要减速。趋势末端就是瀑布前。' },
      { t: 'quiz', q: '趋势中该用止损还是猜顶？', a: '用移动止损，不猜顶。' },
      { t: 'mnemonic', text: '口诀：趋势顺线走，回踩持有；加速末端，减仓不追。' },
      { t: 'action', text: '今天：画一条你关注标的的趋势线，标好持有 / 减仓条件。' },
      { t: 'disclaimer', text: '趋势判断为技术参考，非投资建议。' }
    ]
  },
  {
    id: 'B9', moduleId: 'B', title: '消息面前的冷静', subtitle: '看到利好 / 利空先做什么',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '消息面前的冷静' },
      { t: 'hook', text: '看到利好利空先做什么？九成的人做反——本课给你标准动作。' },
      { t: 'card', title: '利好不追', body: '利好常已 price-in，开盘冲高易套；等回踩确认再动。' },
      { t: 'card', title: '利空不慌', body: '先看是否触及你的止损线，没破按原计划，破了才走。' },
      { t: 'card', title: '动作清单', body: '关推送噪 → 看计划单 → 核对止损 → 非计划不动。' },
      { t: 'story', title: '菜市场喊价', body: '小贩越喊你越要算自己的账，不被带节奏。消息也是喊价。' },
      { t: 'quiz', q: '突发利好第一反应应是？', a: '不追，先看计划与止损，等确认。' },
      { t: 'mnemonic', text: '口诀：消息来，先停手；看计划，核对止损再走。' },
      { t: 'action', text: '今天：把“消息面前标准动作”设为开仓前提醒。' },
      { t: 'disclaimer', text: '消息应对为通用方法，非投资建议。' }
    ]
  },
  {
    id: 'B10', moduleId: 'B', title: '手续费优化', subtitle: '降低摩擦的 4 个习惯',
    duration: 3, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '手续费优化' },
      { t: 'hook', text: '省下的手续费就是赚到的纪律红利。四个习惯，长期复利惊人。' },
      { t: 'card', title: '习惯1', body: '减少无谓高频，每笔前问“必要吗”。' },
      { t: 'card', title: '习惯2', body: '集中下单，别把一笔拆十次小单，省佣金。' },
      { t: 'card', title: '习惯3', body: '长持降换手，短线成本吞噬利润。' },
      { t: 'card', title: '习惯4', body: '了解费率结构，选低成本通道（以券商实际为准）。' },
      { t: 'story', title: '漏水水龙头', body: '一滴不多，天天滴就满缸。手续费也是默默漏。' },
      { t: 'quiz', q: '手续费最影响哪类交易？', a: '高频短线，成本占比显著。' },
      { t: 'mnemonic', text: '口诀：少交易，集中下；长持有，看费率。' },
      { t: 'action', text: '今天：查你上月手续费总额，算占比。' },
      { t: 'disclaimer', text: '费率以券商为准，本课为成本意识提醒。' }
    ]
  },
  {
    id: 'B11', moduleId: 'B', title: '账户体检模板', subtitle: '每月一次的 8 项检查',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '账户体检模板' },
      { t: 'hook', text: '每月一次 8 项体检，像车检一样必要，防患于未然。' },
      { t: 'card', title: '项1-2', body: '总回撤 / 单笔最大亏损是否超阈值。' },
      { t: 'card', title: '项3-4', body: '持仓集中度（单一标的是否过高）/ 零股清理。' },
      { t: 'card', title: '项5-8', body: '止损覆盖（几只没线）/ 计划单完整度 / 连胜天数 / 情绪记录。' },
      { t: 'story', title: '年度体检', body: '平时没感觉，查了才知隐患。账户也该定期查。' },
      { t: 'quiz', q: '体检最该先补什么？', a: '没设止损的票立刻标线。' },
      { t: 'mnemonic', text: '口诀：月月检，八项齐；隐患早，账户稳。' },
      { t: 'action', text: '今天：用熵盾诊断 + 本模板，做第一次账户体检。' },
      { t: 'disclaimer', text: '体检为工具聚合，非投资顾问意见。' }
    ]
  },
  {
    id: 'B12', moduleId: 'B', title: '青铜结业测验', subtitle: '12 题检验你是否真懂',
    duration: 5, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '青铜结业测验' },
      { t: 'hook', text: '12 题检验你是否真懂稳健方法。结业不是终点，是上白银的起点。' },
      { t: 'card', title: '测验结构', body: '止损画法 / 仓位公式 / 分批 / 移动止损 / 回撤 / 震荡趋势 / 消息 / 成本 / 体检，各 1-2 题。' },
      { t: 'card', title: '过关线', body: '答对 ≥9 题再进 C 模块；不足回去重练对应课。' },
      { t: 'card', title: '结业动作', body: '连续 7 天用计划单 + 诊断，固化成习惯再升级。' },
      { t: 'story', title: '段位考核', body: '不是为难你，是确认你真能上场。青铜稳了，才上白银。' },
      { t: 'quiz', q: '进 C 模块前先做什么？', a: '测验过关 + 习惯固化，不然学了也用不上。' },
      { t: 'mnemonic', text: '口诀：测过关，习固化；青铜稳，再上白银。' },
      { t: 'action', text: '结业：用计算器 + 诊断连续跑 7 天，再来 C 模块。' },
      { t: 'disclaimer', text: '测验为能力自测，不构成资质认定。' }
    ]
  }
];

// C–F 模块：标题骨架（内容由 AI 批量制作，doc 51 流水线）。blocks=null 表示"制作中"。
const STUB_LESSONS = [
  // C 实战演练（白银）：全文已由 C_LESSONS 生成（波次3 S04，2026-09-02）
  // E 体系搭建（铂金）：会员
  ['E1', 'E', '个人风控系统蓝图', '把零散动作连成系统', 'member'],
  ['E2', 'E', '信号→计划→执行闭环', '三段式工作流', 'member'],
  ['E3', 'E', '风险预算分层', '日/周/月三级限额', 'member'],
  ['E4', 'E', '自动化提醒设置', '用召回补上遗忘', 'member'],
  ['E5', 'E', '年度报告怎么读', '用长期档案看自己', 'member'],
  ['E6', 'E', '策略迭代方法', '小步快跑改规则', 'member'],
  ['E7', 'E', '多账户风控', '主账户与试验仓', 'member'],
  ['E8', 'E', '杠杆的边界', '什么情况绝不用杠杆', 'member'],
  ['E9', 'E', '黑天鹅预案库', '提前写好的应对卡', 'member'],
  ['E10', 'E', '系统自检清单', '每月跑一次', 'member'],
  ['E11', 'E', '教别人=学最牢', '把体系讲给朋友', 'member'],
  ['E12', 'E', '铂金结业', '输出你的系统文档', 'member'],
  // F 控局大师（钻石）：会员
  ['F1', 'F', '活过一轮牛熊', '周期里的仓位节奏', 'member'],
  ['F2', 'F', '熊市生存手册', '空仓也是操作', 'member'],
  ['F3', 'F', '牛市不止盈陷阱', '涨多了更要守线', 'member'],
  ['F4', 'F', '控局者的资金观', '把交易当长期生意', 'member'],
  ['F5', 'F', '从守护者到控局者', '身份升级的临界点', 'member'],
  ['F6', 'F', '带新手不踩坑', '把方法论传出去', 'member'],
  ['F7', 'F', '三年复盘回望', '看自己的成长曲线', 'member'],
  ['F8', 'F', '极端行情年鉴', '历史案例库', 'member'],
  ['F9', 'F', '终身风控习惯', '退休也在做的事', 'member'],
  ['F10', 'F', '控局者公约', '你给自己立的规矩', 'member'],
  ['F11', 'F', '钻石答辩', '向自己交卷', 'member'],
  ['F12', 'F', '结业：你是控局者', '走到这里你已不同', 'member']
];

// [熵盾 V2.1 · 技能:S04 学院 B–F 全文] Module C（实战演练·白银）12 课全文，沿用 A/B 格式 + 合规免责；批量生成（用户授权，生成完统一审）
const C_LESSONS = [
  {
    id: 'C1', moduleId: 'C', title: '模拟盘练手', subtitle: '不拿真钱先练一百笔',
    duration: 4, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '模拟盘练手' },
      { t: 'hook', text: '不拿真钱先练一百笔。模拟盘是零成本的军校，先把动作练成肌肉记忆。' },
      { t: 'card', title: '为什么先模拟', body: '真钱会放大情绪，模拟盘让你只练"动作"不练"心跳"。' },
      { t: 'card', title: '练什么', body: '计划→执行→复盘三件套，每笔都按真实流程走。' },
      { t: 'card', title: '毕业线', body: '连续 20 笔按计划执行（不论盈亏），动作才算合格。' },
      { t: 'story', title: '考驾照', body: '先在模拟机练，再上路。没人直接上高速。' },
      { t: 'quiz', q: '模拟盘最该练的是什么？', a: '把计划-执行-复盘的动作练成习惯，不被情绪带偏。' },
      { t: 'mnemonic', text: '口诀：先模拟后真金，百笔练动作；计划走，心不慌。' },
      { t: 'action', text: '今天：开一个模拟账户，用风控计算器生成你的第一张计划单。' },
      { t: 'disclaimer', text: '模拟盘为练习工具，结果不代表真实收益。' }
    ]
  },
  {
    id: 'C2', moduleId: 'C', title: '每日复盘三问', subtitle: '盘后固定三问',
    duration: 4, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '每日复盘三问' },
      { t: 'hook', text: '盘后三问，比看盘三小时更有用。固定动作，省脑子。' },
      { t: 'card', title: '问1 计划执行了吗', body: '是否按盘前计划单走，偏差在哪、为什么。' },
      { t: 'card', title: '问2 破戒了吗', body: '有没有追涨杀跌、报复交易、超仓、删止损。' },
      { t: 'card', title: '问3 学到了什么', body: '一条可复用的规律，或一条要改的毛病。' },
      { t: 'story', title: '运动员日志', body: '运动员天天写训练日志，你也是。复盘是交易的训练日志。' },
      { t: 'quiz', q: '复盘最核心问什么？', a: '计划执行没、破戒没、学到什么——对事不对盈亏。' },
      { t: 'mnemonic', text: '口诀：盘后三问不能省，执行破戒加一得。' },
      { t: 'action', text: '今天：写下你的第一份复盘三问。' },
      { t: 'disclaimer', text: '复盘为自我管理方法，非收益保证。' }
    ]
  },
  {
    id: 'C3', moduleId: 'C', title: '破戒信号识别', subtitle: '情绪/行为预警',
    duration: 4, unlock: 'free', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '破戒信号识别' },
      { t: 'hook', text: '破戒前身体会报警。识别你的专属信号，比任何指标都早。' },
      { t: 'card', title: '生理信号', body: '心跳快、手痒、反复刷新行情、出汗。' },
      { t: 'card', title: '行为信号', body: '加仓摊平、删止损、临时改计划、超仓。' },
      { t: 'card', title: '环境信号', body: '熬夜、喝酒、被消息刺激后下单。' },
      { t: 'story', title: '火警', body: '烟没起火先报警。破戒信号就是你的火警，亮了就停手。' },
      { t: 'quiz', q: '哪个是破戒行为信号？', a: '删止损 / 加仓摊平 / 临时改计划——纪律崩的前兆。' },
      { t: 'mnemonic', text: '口诀：手痒心跳快，信号亮；删止损，最危险。' },
      { t: 'action', text: '今天：列你自己的三条破戒信号，写进风控档案。' },
      { t: 'disclaimer', text: '信号为自我观察，非医学诊断。' }
    ]
  },
  {
    id: 'C4', moduleId: 'C', title: '亏损心理复位', subtitle: '不报复交易',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '亏损心理复位' },
      { t: 'hook', text: '亏了想马上赢回来，是账户最大的敌人。复位，不是报复。' },
      { t: 'card', title: '为什么报复亏更多', body: '情绪单没有计划，破戒叠加，越补越深。' },
      { t: 'card', title: '复位三步', body: '停手→深呼吸→写"为什么亏"（计划内/外）。' },
      { t: 'card', title: '冷却期', body: '单笔超预算，强制离场 30 分钟再评估。' },
      { t: 'story', title: '拳手读秒', body: '被击中先护住，不急着反扑。复位也是护住。' },
      { t: 'quiz', q: '亏后最该做的？', a: '停手冷却、写原因，绝不立刻报复开仓。' },
      { t: 'mnemonic', text: '口诀：亏了不报复，冷却三十分；原因写清楚，再上阵。' },
      { t: 'action', text: '今天：给自己定一条"亏后冷却"规则。' },
      { t: 'disclaimer', text: '心理方法为通用建议，非投资建议。' }
    ]
  },
  {
    id: 'C5', moduleId: 'C', title: '周计划用计算器', subtitle: '一周一计划单',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '周计划用计算器' },
      { t: 'hook', text: '一周一计划单，比每天瞎猜稳。用风控计算器把周预算变股数。' },
      { t: 'card', title: '定周预算', body: '本周最多亏多少（如账户 1%），先设上限。' },
      { t: 'card', title: '拆到交易', body: '周预算÷计划笔数=单笔风险，每笔不超。' },
      { t: 'card', title: '生成计划', body: '计算器输入预算与持仓，自动出股数与止损价。' },
      { t: 'story', title: '周菜单', body: '一周吃啥先列好，不饿昏了乱点。计划也是。' },
      { t: 'quiz', q: '周计划第一步？', a: '先定周最大回撤预算，再拆单笔风险。' },
      { t: 'mnemonic', text: '口诀：周预算，先定亏；拆单笔，算股数。' },
      { t: 'action', text: '今天：用计算器生成你这周的计划单。' },
      { t: 'disclaimer', text: '工具输出为参考，决策由你做。' }
    ]
  },
  {
    id: 'C6', moduleId: 'C', title: '黑天鹅预案', subtitle: '极端行情应对卡',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '黑天鹅预案' },
      { t: 'hook', text: '极端行情不可预测，但可准备。预案写好了，慌的是别人。' },
      { t: 'card', title: '什么是黑天鹅', body: '极低概率、极大冲击：闪崩 / 停摆 / 突发政策。' },
      { t: 'card', title: '预案内容', body: '仓位上限、是否暂停开仓、止损是否前置。' },
      { t: 'card', title: '平时准备', body: '预案卡存风控档案，雷来直接执行，不临时想。' },
      { t: 'story', title: '消防演习', body: '没火也练，火来不慌。预案就是你的演习。' },
      { t: 'quiz', q: '黑天鹅最该准备什么？', a: '提前写好的仓位上限与暂停规则，遇事直接执行。' },
      { t: 'mnemonic', text: '口诀：黑天鹅，不可测；预案卡，提前写。' },
      { t: 'action', text: '今天：写一张你的黑天鹅预案卡。' },
      { t: 'disclaimer', text: '预案为风险管理方法，非对市场的预测。' }
    ]
  },
  {
    id: 'C7', moduleId: 'C', title: '仓位睡眠测试', subtitle: '仓位不影响睡眠',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '仓位睡眠测试' },
      { t: 'hook', text: '仓位大到让你睡不着，就是太大。这条测试比任何公式都准。' },
      { t: 'card', title: '测试法', body: '睡前问自己：这仓位我安心吗？不安心就减。' },
      { t: 'card', title: '为什么准', body: '睡眠反映真实风险承受，公式算的是纸面。' },
      { t: 'card', title: '调整', body: '减到能睡着的量级，长期反而赚得稳。' },
      { t: 'story', title: '鞋合脚', body: '别人说合脚没用，自己走两步知道。仓位也一样。' },
      { t: 'quiz', q: '仓位判据谁最准？', a: '你的睡眠——睡不着的仓位就是过大。' },
      { t: 'mnemonic', text: '口诀：仓位大，睡不着；减到安，才能久。' },
      { t: 'action', text: '今天：用睡眠测试核对你当前最大持仓。' },
      { t: 'disclaimer', text: '主观测试，非量化标准。' }
    ]
  },
  {
    id: 'C8', moduleId: 'C', title: '止盈的纪律', subtitle: '不贪最后一段',
    duration: 4, unlock: 'member', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '止盈的纪律' },
      { t: 'hook', text: '不止盈，盈利会变亏损。落袋的才是你的。' },
      { t: 'card', title: '为什么难', body: '想吃掉最后一段，往往吐回全部利润。' },
      { t: 'card', title: '怎么做', body: '计划里写好目标价/移动止盈，到点机械执行。' },
      { t: 'card', title: '分批落袋', body: '到目标先走一半，剩的用移动止损跟。' },
      { t: 'story', title: '摘果子', body: '果子熟了先摘，别等全树掉。盈利也是。' },
      { t: 'quiz', q: '止盈核心？', a: '计划内机械执行，不贪最后一段。' },
      { t: 'mnemonic', text: '口诀：盈要落袋，莫贪尾；计划到，机械走。' },
      { t: 'action', text: '今天：给你一只盈利票设止盈规则。' },
      { t: 'disclaimer', text: '止盈为技术方法，非收益承诺。' }
    ]
  },
  {
    id: 'C9', moduleId: 'C', title: '复盘模板进阶', subtitle: '从差异里提炼规律',
    duration: 4, unlock: 'member', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '复盘模板进阶' },
      { t: 'hook', text: '从"发生了什么"到"规律是什么"。进阶复盘提炼可复用打法。' },
      { t: 'card', title: '初级复盘', body: '记执行与偏差，对事不对盈亏。' },
      { t: 'card', title: '进阶复盘', body: '归类（计划内赢/计划外亏），找高频模式。' },
      { t: 'card', title: '输出', body: '一条写进风控档案的"下次这么做"。' },
      { t: 'story', title: '矿石炼金', body: 'raw 数据→提炼→可用规律。进阶复盘就是炼金。' },
      { t: 'quiz', q: '进阶复盘产出？', a: '可复用的规律，或一条"下次这么做"的规则。' },
      { t: 'mnemonic', text: '口诀：复盘进阶层，提炼规律；一次一得，长期富。' },
      { t: 'action', text: '今天：把本周复盘归成一条规律。' },
      { t: 'disclaimer', text: '模板为自我管理，非投资建议。' }
    ]
  },
  {
    id: 'C10', moduleId: 'C', title: '交易日志系统', subtitle: '用熵盾长期档案沉淀',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '交易日志系统' },
      { t: 'hook', text: '熵盾长期档案是你的第二大脑。日志系统让成长看得见。' },
      { t: 'card', title: '记什么', body: '计划 / 实际 / 偏差 / 情绪 / 复盘结论。' },
      { t: 'card', title: '怎么用', body: '每月回看，找重复毛病与重复赢法。' },
      { t: 'card', title: '和熵盾', body: '打卡与档案自动沉淀，少手写多对照。' },
      { t: 'story', title: '年轮', body: '树靠年轮记岁月，你靠日志记成长。' },
      { t: 'quiz', q: '日志最核心价值？', a: '长期沉淀，让你看见自己的重复模式。' },
      { t: 'mnemonic', text: '口诀：日志是第二脑，月月看；毛病现，赢法显。' },
      { t: 'action', text: '今天：建你的日志模板（或启用熵盾档案）。' },
      { t: 'disclaimer', text: '日志为记录工具，非收益保证。' }
    ]
  },
  {
    id: 'C11', moduleId: 'C', title: '压力测试你的计划', subtitle: '最坏情况能扛住吗',
    duration: 4, unlock: 'member', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '压力测试你的计划' },
      { t: 'hook', text: '计划没被压力测过，等于没穿盔甲上阵。' },
      { t: 'card', title: '测什么', body: '连亏 5 笔、单笔触止损、黑天鹅三种情景。' },
      { t: 'card', title: '怎么测', body: '在模拟盘或纸面跑一遍，看账户与心态扛得住吗。' },
      { t: 'card', title: '红线', body: '任一情景让你爆仓/睡不着，计划重做。' },
      { t: 'story', title: '抗震演练', body: '楼不震也测，震时才立。计划也先压后上。' },
      { t: 'quiz', q: '压力测试目的？', a: '在真金前暴露计划薄弱点，提前加固。' },
      { t: 'mnemonic', text: '口诀：计划先受压，薄弱现；三情景，过关再上。' },
      { t: 'action', text: '今天：给你的计划做连亏 5 笔的压力测试。' },
      { t: 'disclaimer', text: '压力测试为风控方法，非对收益的预测。' }
    ]
  },
  {
    id: 'C12', moduleId: 'C', title: '白银结业实战', subtitle: '模拟一轮完整交易',
    duration: 4, unlock: 'member', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '白银结业实战' },
      { t: 'hook', text: '模拟一轮完整交易，从计划到复盘全走通，才算白银毕业。' },
      { t: 'card', title: '毕业动作', body: '选一只票，写计划单→模拟执行→复盘三问→归档。' },
      { t: 'card', title: '验收', body: '全程按纪律、无破戒，写清学到的一条。' },
      { t: 'card', title: '下一站', body: '白银之后进黄金（交易心法），练的是"人"。' },
      { t: 'story', title: '毕业考', body: '不是考你会不会，是考你稳不稳。' },
      { t: 'quiz', q: '白银毕业标准？', a: '一轮完整交易按计划走完、无破戒、有可复用的一得。' },
      { t: 'mnemonic', text: '口诀：白银毕，一轮通；计划走，无破戒。' },
      { t: 'action', text: '今天：完成你的白银毕业实战并归档。' },
      { t: 'disclaimer', text: '结业为学习里程碑，非投资能力认证。' }
    ]
  }
];


const D_LESSONS = [
  {
    id: 'D1', moduleId: 'D', title: '亏损人格画像', subtitle: '你是哪一种亏法',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '亏损人格画像' },
      { t: 'hook', text: '亏钱的方式比赚钱更固定。看清你是哪一种，才能对症下药。' },
      { t: 'card', title: '摊平型', body: '一跌就加仓想摊平，越摊越深。' },
      { t: 'card', title: '扛单型', body: '小亏不砍，等回本，结果熬成巨亏。' },
      { t: 'card', title: '追涨型', body: '涨了才敢买，买在情绪高点。' },
      { t: 'story', title: '照镜子', body: '亏损像指纹，每个人都有固定形状；先认再看改。' },
      { t: 'quiz', q: '哪种人格最危险？', a: '没有最危险，不认自己那一种才最危险；先画像再克制。' },
      { t: 'mnemonic', text: '口诀：亏法即性格；先画像，再修正。' },
      { t: 'action', text: '今天：翻三笔亏损，标出你属于哪一类。' },
      { t: 'disclaimer', text: '人格归类为通用行为观察，非诊断结论。' },
    ]
  },
  {
    id: 'D2', moduleId: 'D', title: '恐惧与贪婪的开关', subtitle: '识别你的两个按钮',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '恐惧与贪婪的开关' },
      { t: 'hook', text: '两个按钮藏在每个人身上，行情一波动就被按下。先认出它们。' },
      { t: 'card', title: '恐惧', body: '一下跌就怕，怕就砍在最低；恐惧让你卖在错的地方。' },
      { t: 'card', title: '贪婪', body: '一上涨就想要更多，破线也舍不得走；贪婪让你扛到爆。' },
      { t: 'card', title: '识别信号', body: '心跳加速、手痒想操作、睡不着——都是开关被按下的身体警报。' },
      { t: 'story', title: '红绿按钮', body: '行情就是不停闪的红绿灯，你一慌就乱按。' },
      { t: 'quiz', q: '身体给你的最快警报是什么？', a: '心跳加速、手痒、失眠，先于脑子提醒你情绪上头。' },
      { t: 'mnemonic', text: '口诀：怕则砍底，贪则扛爆；身体先报警，手慢半拍。' },
      { t: 'action', text: '今天：给自己的恐惧键和贪婪键各写一句提醒语。' },
      { t: 'disclaimer', text: '情绪识别为通用方法，非心理诊疗建议。' },
    ]
  },
  {
    id: 'D3', moduleId: 'D', title: '连续盈利后的膨胀', subtitle: '顺境最容易翻车',
    duration: 4, unlock: 'paid', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '连续盈利后的膨胀' },
      { t: 'hook', text: '顺境最会骗人。连赚几笔，你会觉得自己无所不能——翻车往往从这里开始。' },
      { t: 'card', title: '放松风控', body: '赚了就觉得规则多余，止损越设越宽。' },
      { t: 'card', title: '加大仓位', body: '信心爆棚加杠杆加仓，一次回撤吞光利润。' },
      { t: 'card', title: '忽视计划', body: '凭感觉下单，脱离计划单，错误无法复盘。' },
      { t: 'story', title: '温水煮蛙', body: '膨胀是慢慢热的水，等烫到已跳不出。' },
      { t: 'quiz', q: '连赚后最先该守住什么？', a: '守计划与仓位纪律，越顺越要原样执行，不放松。' },
      { t: 'mnemonic', text: '口诀：顺境防膨胀；赚越多，纪律越要原样。' },
      { t: 'action', text: '今天：连赚时在计划单写“禁止加仓”自戒。' },
      { t: 'disclaimer', text: '风控提示，非收益承诺。' },
    ]
  },
  {
    id: 'D4', moduleId: 'D', title: '连续亏损后的报复', subtitle: '怎么按下暂停键',
    duration: 4, unlock: 'paid', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '连续亏损后的报复' },
      { t: 'hook', text: '连亏最想一把赢回来。报复性交易是账户杀手一号。' },
      { t: 'card', title: '加注回本', body: '亏了加大注想速回，波动一反更惨。' },
      { t: 'card', title: '频繁下手', body: '不停操作证明自己，手续费和错误双杀。' },
      { t: 'card', title: '暂停机制', body: '连亏两笔强制停手，冷却后再评估。' },
      { t: 'story', title: '赌徒谬误', body: '以为该我赢了是错觉，市场不欠你。' },
      { t: 'quiz', q: '连亏后第一动作该是什么？', a: '停手冷却，不加大注；回本靠纪律不靠报复。' },
      { t: 'mnemonic', text: '口诀：连亏先停手；回本靠纪律，不靠赌。' },
      { t: 'action', text: '今天：设一条连亏2笔即停的硬规矩。' },
      { t: 'disclaimer', text: '止损与暂停为通用风控动作，非投资建议。' },
    ]
  },
  {
    id: 'D5', moduleId: 'D', title: '纪律的正向强化', subtitle: '用积分养出成就感',
    duration: 4, unlock: 'member', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '纪律的正向强化' },
      { t: 'hook', text: '坚持不靠意志力，靠奖励。把做到变成甜头，习惯才养得成。' },
      { t: 'card', title: '积分正反馈', body: '熵盾打卡发分，完成即见奖励，正向循环。' },
      { t: 'card', title: '可视化连续', body: '连续天数、等级进度环，看得见的成长最激励。' },
      { t: 'card', title: '小目标拆解', body: '每天只守一个小纪律，达成即夸，不贪大。' },
      { t: 'story', title: '游戏化养成', body: '像养宠物，每天喂一点，它就会跟着你。' },
      { t: 'quiz', q: '为什么奖励要及时？', a: '即时正反馈强化行为，延迟奖励难养成习惯。' },
      { t: 'mnemonic', text: '口诀：纪律靠奖励养；小成即夸，习惯自长。' },
      { t: 'action', text: '今天：完成打卡后给自己一句具体肯定。' },
      { t: 'disclaimer', text: '行为方法，非收益承诺。' },
    ]
  },
  {
    id: 'D6', moduleId: 'D', title: '社群并肩打卡', subtitle: '有人一起更坚持',
    duration: 4, unlock: 'member', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '社群并肩打卡' },
      { t: 'hook', text: '一个人容易松懈，一群人互相看见，坚持变简单。' },
      { t: 'card', title: '同伴压力', body: '看到别人在打卡，你也不好意思断。' },
      { t: 'card', title: '经验互鉴', body: '别人踩的坑你提前避，别人之法你可借。' },
      { t: 'card', title: '守护者身份', body: '在社群里帮新手，自己反而更稳。' },
      { t: 'story', title: '结伴登山', body: '独自爬易放弃，有人同行到顶。' },
      { t: 'quiz', q: '社群最大的价值？', a: '把坚持变社交承诺，断签有成本，也更易坚持。' },
      { t: 'mnemonic', text: '口诀：独行易断，结伴易久；互助即互稳。' },
      { t: 'action', text: '今天：在社群发一条你的今日打卡。' },
      { t: 'disclaimer', text: '社群为辅助氛围，决策仍由你做。' },
    ]
  },
  {
    id: 'D7', moduleId: 'D', title: '损失厌恶的利用', subtitle: '让断签可惜帮你',
    duration: 4, unlock: 'paid', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '损失厌恶的利用' },
      { t: 'hook', text: '人怕失去胜过爱得到。把这点变成坚持打卡的燃料。' },
      { t: 'card', title: '断签可惜', body: '连续21天快到手，断一天全没——舍不得断就天天来。' },
      { t: 'card', title: '沉没成本', body: '已投入的时间精力，让你更不愿荒废。' },
      { t: 'card', title: '健康用法', body: '用可惜推动行动，而非用亏了逼赌。' },
      { t: 'story', title: '存钱罐', body: '每天投一枚，罐快满时你最舍不得打破。' },
      { t: 'quiz', q: '损失厌恶用错会变什么？', a: '变成报复性补仓；只用于坚持好行为，不用于翻本。' },
      { t: 'mnemonic', text: '口诀：惜断签，不惜本；厌恶只推好习惯。' },
      { t: 'action', text: '今天：把连续天数当成快满的存钱罐，护住它。' },
      { t: 'disclaimer', text: '心理机制说明，非投资建议。' },
    ]
  },
  {
    id: 'D8', moduleId: 'D', title: '冥想与交易', subtitle: '3 分钟清空杂念',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '冥想与交易' },
      { t: 'hook', text: '盘前 3 分钟清空杂念，下单质量立刻不同。' },
      { t: 'card', title: '呼吸锚定', body: '数呼吸把注意力拉回当下，不被行情拽走。' },
      { t: 'card', title: '情绪降温', body: '怒或怕时先冥想，等平复再决定。' },
      { t: 'card', title: '盘前仪式', body: '固定动作触发进入状态，像运动员热身。' },
      { t: 'story', title: '擦镜子', body: '情绪是雾，冥想是擦，擦净才看得清。' },
      { t: 'quiz', q: '冥想对交易最直接的好处？', a: '降低冲动，让决定来自计划而非情绪。' },
      { t: 'mnemonic', text: '口诀：盘前三分钟，呼吸定心神；雾散镜自清。' },
      { t: 'action', text: '今天：盘前做一次 3 分钟呼吸冥想。' },
      { t: 'disclaimer', text: '放松练习，非交易建议。' },
    ]
  },
  {
    id: 'D9', moduleId: 'D', title: '睡眠与决策', subtitle: '熬夜下单必亏',
    duration: 4, unlock: 'points', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '睡眠与决策' },
      { t: 'hook', text: '熬夜后下单，错的概率是清醒时的两倍。睡眠是风控第一关。' },
      { t: 'card', title: '认知下降', body: '缺觉判断力钝，止损该砍却拖。' },
      { t: 'card', title: '情绪放大', body: '疲劳让人更怕更贪，反应过度。' },
      { t: 'card', title: '硬规矩', body: '凌晨不下单，累了先睡，单等清醒做。' },
      { t: 'story', title: '雾天开车', body: '缺觉像雾天，看不清还踩油门。' },
      { t: 'quiz', q: '什么时候绝对不下单？', a: '熬夜后、极度疲惫时；先睡，决策留清醒时。' },
      { t: 'mnemonic', text: '口诀：累了不操作；睡眠是首道风控。' },
      { t: 'action', text: '今天：定23点后不交易的规矩。' },
      { t: 'disclaimer', text: '作息建议，非医疗建议。' },
    ]
  },
  {
    id: 'D10', moduleId: 'D', title: '黄金心态清单', subtitle: '盘前盘中各念一遍',
    duration: 4, unlock: 'member', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '黄金心态清单' },
      { t: 'hook', text: '把该想的事写成清单，盘前盘中各念一遍，避免临场乱。' },
      { t: 'card', title: '盘前查', body: '计划单在否、止损设否、仓位按计划否。' },
      { t: 'card', title: '盘中守', body: '只执行不预测、破线即走、不加注回本。' },
      { t: 'card', title: '盘后省', body: '哪笔偏离计划、为何、明天改什么。' },
      { t: 'story', title: '飞行员检查单', body: '再熟也念一遍，漏一项就出事。' },
      { t: 'quiz', q: '清单最大的作用？', a: '把临场决策变固定动作，减少情绪干扰。' },
      { t: 'mnemonic', text: '口诀：盘前查，盘中守，盘后省；清单不靠脑。' },
      { t: 'action', text: '今天：抄一份心态清单贴屏幕边。' },
      { t: 'disclaimer', text: '清单为通用自省工具，非买卖建议。' },
    ]
  },
  {
    id: 'D11', moduleId: 'D', title: '从亏损中学费', subtitle: '把每笔亏变成资产',
    duration: 4, unlock: 'paid', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '从亏损中学费' },
      { t: 'hook', text: '每笔亏都是交的学费，关键是你有没有拿走教训。' },
      { t: 'card', title: '归因', body: '是计划错、执行错、还是行情错？分清楚。' },
      { t: 'card', title: '记录', body: '亏因写进档案，下次同类信号先想这句。' },
      { t: 'card', title: '转化', body: '把又亏了变学会了一招，心理负担轻。' },
      { t: 'story', title: '交学费', body: '学校交钱学知识，市场交亏学纪律；不记白交。' },
      { t: 'quiz', q: '亏损后最该做？', a: '归因并记录，把亏变成可复用的教训。' },
      { t: 'mnemonic', text: '口诀：亏即是学；归因记档，学费不白交。' },
      { t: 'action', text: '今天：给最近一笔亏写一句教训存档。' },
      { t: 'disclaimer', text: '复盘方法，非收益承诺。' },
    ]
  },
  {
    id: 'D12', moduleId: 'D', title: '黄金结业', subtitle: '心法总测验',
    duration: 4, unlock: 'member', schemaVersion: SCHEMA_VERSION,
    blocks: [
      { t: 'hero', text: '黄金结业' },
      { t: 'hook', text: '走到黄金，说明你把情绪当对手研究了。最后用12题验自己。' },
      { t: 'card', title: '自检', body: '能说出自己的亏损人格、两个情绪开关吗？' },
      { t: 'card', title: '机制', body: '会用奖励养纪律、用可惜护连续、用清单降冲动吗？' },
      { t: 'card', title: '归宿', body: '心法不是不亏，是亏时少亏、赚时守线。' },
      { t: 'story', title: '拿到镜子', body: '黄金级不是无敌，是终于看清自己。' },
      { t: 'quiz', q: '心法修炼的终点？', a: '情绪可控、纪律自运行，亏赢都按系统走。' },
      { t: 'mnemonic', text: '口诀：黄金看自己；情绪可控，纪律自转。' },
      { t: 'action', text: '今天：做一套心法自测，标出最弱一项去练。' },
      { t: 'disclaimer', text: '课程为通用心法，非投资建议。' },
    ]
  },
];

const STUB_LESSONS_FULL = STUB_LESSONS.map(([id, moduleId, title, subtitle, unlock]) => ({
  id, moduleId, title, subtitle, duration: 4, unlock, schemaVersion: SCHEMA_VERSION, blocks: null
}));

const LESSONS = A_LESSONS.concat(B_LESSONS).concat(C_LESSONS).concat(D_LESSONS).concat(STUB_LESSONS_FULL);

function getModule(id) {
  return MODULES.find((m) => m.id === id) || null;
}
function getLesson(id) {
  return LESSONS.find((l) => l.id === id) || null;
}
function lessonsOfModule(moduleId) {
  return LESSONS.filter((l) => l.moduleId === moduleId);
}
function unlockLabel(unlock) {
  if (unlock === 'free') return '免费';
  if (unlock === 'points') return '积分兑换';
  if (unlock === 'paid') return '付费解锁';
  if (unlock === 'member') return '会员通看';
  return '免费';
}

module.exports = {
  SCHEMA_VERSION,
  MODULES,
  LESSONS,
  A_LESSONS,
  getModule,
  getLesson,
  lessonsOfModule,
  unlockLabel
};
