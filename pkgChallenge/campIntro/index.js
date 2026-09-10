// [CHANGE] unify userRights writes
const { mergeUserRights } = require('../../utils/userRights')

// pages/campIntro/index.js
const { getLevelInfo } = require('../../utils/grade.js');
const { API_BASE } = require('../../config.js'); // ✅ 统一从 config 读取
const seasonConfig = require('../../utils/seasonConfig.js'); // [2026-09-10] 赛季化配置层

// ✅ 完成一轮 7 天训练营，赠送的完整风控方案使用次数
const CAMP_REWARD_TIMES = 4;

// ✅ 最多奖励的轮次（只奖励前三轮，从第四轮开始不再送）
const MAX_REWARD_ROUNDS = 3;

// 本地存放“待绑定邀请码”的 key
const PENDING_INVITE_KEY = 'pendingInviteCode';

// [2026-09-10 Phase 1] 守纪承诺展示名（与 utils/seasonConfig.js 的 promises 一致）
const PROMISE_NAME = {
  A: '不留裸单',
  B: '止损 48 小时内记录',
  C: '单笔风险不超过 2%'
};

Page({
  data: {
    days: [],               // 顶部 D1-D7 Tab 数据（含 finished 标记）
    activeDay: 'D1',        // 当前选中的 Day
    currentTask: {},        // 当前 Day 的详细内容
    finishedDays: 0,        // 已完成的天数（0~7）
    currentFinished: false, // 当前 Day 是否已完成

    // 控局者等级卡片
    grade: {
      ready: false,
      score: 0,
      levelText: '',
      levelShortTag: '',
      levelClass: '',
      badge: '',            // 徽章图片地址（/images/badges/xxx.png）
      tags: [],
      desc: ''
    },

    // 裂变 / 邀请关系展示用
    hasInviter: false,      // 是否已经绑定过邀请人
    invitedByCode: '',      // 绑定的邀请人邀请码（如 TEST01）
    myInviteCode: '',       // 我自己的专属邀请码（用于分享带码）
    entryInviteCode: '',    // 入口带来的邀请码（仅展示用）

    // [2026-09-10 Phase 1] 赛季化：模式与天数由配置驱动（默认 training = 原 7 天）
    campMode: 'training',
    campDays: 7,
    campTitle: '7 天风控训练营',
    campSubtitle: '先控亏，再谈收益',

    // [2026-09-10 Phase 1] 赛季状态（后端不可用时全部保持默认值，页面正常显示）
    seasonNo: 'S1',
    seasonDays: 30,
    seasonBonus: 50,
    seasonPassed: 0,
    seasonStreak: 0,
    seasonRate: 0,
    seasonPromise: '',
    seasonPromiseName: '不留裸单',

    // [Phase 2] 训练日历：30 自然日 ≈ 22 个交易日参与判定；每季 2 个豁免日
    seasonTradingTarget: 22,
    seasonExemptTotal: 2,
    seasonExemptLeft: 2,
    seasonDaysLeft: 0
  },

  /**
   * 支持带 inviteCode 的分享链接进入：
   * /pkgChallenge/campIntro/index?inviteCode=TEST01
   */
  onLoad(options) {
    // [2026-09-10 Phase 1] 解析模式：?mode=season → 30 天守纪挑战赛；缺省保持原 7 天
    // 模式写入 storage，保证从打卡页返回（跳转不带参）时不会退回 7 天模式
    let _cfg = seasonConfig.getMode(options);
    try {
      if (_cfg.key === 'season') {
        wx.setStorageSync('campMode', 'season');
      } else {
        const _saved = wx.getStorageSync('campMode');
        if (_saved === 'season') _cfg = seasonConfig.MODES.season;
      }
    } catch (e) { /* storage 不可用时按入参走 */ }

    this.campCfg = _cfg;
    // 赛季不限轮次时，总数文案走 wxml 的 wx:else 分支
    const _total = (_cfg.maxRewardRounds >= 99)
      ? 0
      : (_cfg.rewardTimes * _cfg.maxRewardRounds);

    this.setData({
      campMode: _cfg.key,
      campDays: _cfg.days,
      campTitle: _cfg.title,
      campSubtitle: _cfg.subtitle,
      campRewardTimes: _cfg.rewardTimes,
      campMaxRounds: _cfg.maxRewardRounds,
      campRewardTotal: _total
    });

    // 静态 json 的导航标题是「7 天风控训练营」，赛季模式下动态改写
    if (_cfg.key === 'season') {
      wx.setNavigationBarTitle({ title: _cfg.title });
    }

    try {
      const raw = (options && options.inviteCode) || '';
      const inviteCode = raw.toUpperCase().trim();

      if (inviteCode) {
        console.log('[campIntro] onLoad with inviteCode =', inviteCode);

        // 记录入口邀请码，用于页面展示
        this.setData({
          entryInviteCode: inviteCode
        });

        // 1）写入全局（可选）
        const app = getApp && getApp();
        if (app && app.globalData) {
          app.globalData.inviteCode = inviteCode;
        }

        // 2）写入本地“待绑定邀请码”
        const oldPending =
          (wx.getStorageSync(PENDING_INVITE_KEY) || '').toUpperCase().trim();

        // 只在本地还没有 pending 时写入，避免覆盖用户后来自己填写的
        if (!oldPending) {
          wx.setStorageSync(PENDING_INVITE_KEY, inviteCode);
          console.log('[campIntro] set pendingInviteCode =', inviteCode);
        }
      }
    } catch (e) {
      console.error('[campIntro] parse inviteCode error:', e);
    }

    this.initAll();
  },

  // 从打卡页返回时也要刷新等级和邀请关系
  onShow() {
    // 这里只做“刷新”，避免重复调用 /api/fission/init 导致 Duplicate entry 报错
    this.initCampAndGrade();
    this.initSeason(); // [2026-09-10 Phase 1] 赛季模式：配置/报名/进度（接口不可用时静默）

    const clientId = this.ensureClientId();
    if (!clientId) return;

    // 只拉取 profile，不再重复 init
    this.fetchFissionProfile(clientId);
  },

  /**
   * 统一初始化：训练营进度 + 等级 + 邀请关系
   */
  initAll() {
    this.initCampAndGrade();

    const clientId = this.ensureClientId();
    if (!clientId) return;

    this.initFissionUser(clientId, () => {
      this.fetchFissionProfile(clientId);
    });
  },

  /**
   * 初始化训练营任务 + 完成情况 + 等级信息
   */
  initCampAndGrade() {
    const tasks = this.buildTasks();
    const finishedMap = wx.getStorageSync('campFinishedMap') || {};

    const days = tasks.map(t => ({
      day: t.day,
      name: t.name,
      finished: !!finishedMap[t.day]
    }));

    const activeDay = this.data.activeDay || 'D1';
    const currentTask = tasks.find(t => t.day === activeDay) || tasks[0];
    const currentFinished = !!finishedMap[activeDay];
    const finishedDays = Object.keys(finishedMap).length;

    // ---------- 计算 7 日等级信息（基于 campDailyLogs） ----------
    const logs = wx.getStorageSync('campDailyLogs') || {};
    // [2026-09-10 Phase 1] 天数由配置驱动（7 天 / 30 天）
    const dayKeys = seasonConfig.dayKeysOf(
      this.campCfg || seasonConfig.MODES[this.data.campMode]
    );

    let totalScore = 0;
    let effectiveDays = 0;
    let goodDays = 0;
    let badDays = 0;
    const tagSet = new Set();

    dayKeys.forEach(day => {
      const log = logs[day] || {};
      const score = typeof log.score === 'number' ? log.score : 0;

      const hasContent = !!(
        log.dailyNote ||
        log.practiceNote ||
        log.reviewNote ||
        log.homeworkNote
      );

      if (hasContent) {
        effectiveDays += 1;
        totalScore += score;

        if (score >= 70) goodDays += 1;
        if (score > 0 && score < 40) badDays += 1;

        if (Array.isArray(log.tags)) {
          log.tags.forEach(t => t && tagSet.add(t));
        }
      }
    });

    let grade = {
      ready: false,
      score: 0,
      levelText: '',
      levelShortTag: '',
      levelClass: '',
      badge: '',
      tags: [],
      desc: ''
    };

    if (effectiveDays > 0) {
      const avgScore = Math.round(totalScore / effectiveDays);
      const allTags = Array.from(tagSet);

      const levelInfo = getLevelInfo(
        avgScore,
        effectiveDays,
        goodDays,
        badDays,
        allTags
      );

      const badge = levelInfo.badge
        ? `/images/badges/${levelInfo.badge}`
        : '';

      grade = {
        ready: true,
        score: avgScore,
        levelText: levelInfo.name,
        levelShortTag: levelInfo.tag,
        levelClass: levelInfo.toneClass,
        badge,
        tags: [
          levelInfo.tag,
          effectiveDays >= 5 ? '记录较稳定' : '记录有间断',
          goodDays >= 3 ? '优秀执行日较多' : ''
        ].filter(Boolean),
        desc: levelInfo.desc
      };
    }

    // ---------- 完成 7/7 天训练营 → 赠送风控计算器完整方案次数 ----------
    try {
      const userRights = wx.getStorageSync('userRights') || {};
      const hasRewarded = !!userRights.campRewardDone;  // 本轮是否已发过奖励
      const oldTimes = Number(userRights.freeCalcTimes || 0);

      let rewardRounds = Number(userRights.campRewardCount || 0);

      // [2026-09-10 Phase 1] 完成天数与奖励次数由模式配置决定
      const _cfg = this.campCfg || seasonConfig.MODES[this.data.campMode] || seasonConfig.MODES.training;
      const _needDays = _cfg.days;
      const _rewardTimes = _cfg.rewardTimes || CAMP_REWARD_TIMES;
      const _maxRounds = _cfg.maxRewardRounds || MAX_REWARD_ROUNDS;

      if (finishedDays === _needDays && !hasRewarded && rewardRounds < _maxRounds) {
        const newTimes = oldTimes + _rewardTimes;
        rewardRounds += 1;

        userRights.freeCalcTimes = newTimes;
        userRights.campRewardDone = true;
        userRights.campRewardCount = rewardRounds;
        mergeUserRights(userRights); // [CHANGE] unify write

        wx.showToast({
          title: `恭喜完成第 ${rewardRounds} 轮训练，获赠 ${_rewardTimes} 次完整方案`,
          icon: 'none',
          duration: 2500
        });
      }
    } catch (e) {
      console.log('[campIntro] reward calc times error', e);
    }

    this.tasks = tasks;

    this.setData({
      days,
      activeDay,
      currentTask,
      currentFinished,
      finishedDays,
      grade
    });
  },

  /**
   * 构造 7 天训练营脚本
   */
  /**
   * [2026-09-10 Phase 1] 赛季初始化：拉配置 → 确保已报名 → 拉进度
   * 后端未上线时每个接口都返回 null，页面保持默认显示，不影响训练流程。
   */
  initSeason() {
    if (this.data.campMode !== 'season') return;

    let seasonApi = null;
    try { seasonApi = require('../../utils/seasonApi.js'); } catch (e) { return; }

    seasonApi.current().then((cfg) => {
      if (cfg && cfg.season) {
        const days = cfg.season.days || 30;
        const et = cfg.season.exempt_days != null ? Number(cfg.season.exempt_days) : 2;
        this.setData({
          seasonNo: cfg.season.season_no || 'S1',
          seasonDays: days,
          seasonBonus: cfg.season.bonus_pct || 0,
          seasonExemptTotal: et,
          seasonTradingTarget:
            cfg.season.tradingTarget || seasonConfig.estimateTradingDays(days)
        });
      }
    });

    let saved = '';
    try { saved = wx.getStorageSync('seasonPromise') || ''; } catch (e) {}

    if (!saved) {
      seasonApi.join('A');
      try { wx.setStorageSync('seasonPromise', 'A'); } catch (e) {}
      this.setData({ seasonPromise: 'A', seasonPromiseName: '不留裸单' });
    } else {
      this.setData({ seasonPromise: saved, seasonPromiseName: PROMISE_NAME[saved] || '不留裸单' });
    }

    seasonApi.progress().then((p) => {
      if (p) {
        this.setData({
          seasonPassed: p.passedDays || 0,
          seasonStreak: p.streak || 0,
          seasonRate: p.execRate || 0,
          seasonExemptLeft: p.exemptLeft != null ? p.exemptLeft : this.data.seasonExemptTotal,
          seasonDaysLeft: p.daysLeft != null ? p.daysLeft : 0
        });
      }
    });
  },

  /**
   * 切换训练模式：7 天训练营 ⇄ 30 天守纪挑战赛
   * 用 ActionSheet 实现，不新增页面布局；模式写入 storage，后续进入保持。
   * 注：两种模式的完成记录共用 campFinishedMap，切换后按新模式天数重新统计（不清除历史数据）。
   */
  switchMode() {
    wx.showActionSheet({
      itemList: ['7 天风控训练营', '30 天守纪挑战赛'],
      success: (res) => {
        const key = res.tapIndex === 1 ? 'season' : 'training';
        const cfg = seasonConfig.MODES[key];
        if (!cfg) return;

        try { wx.setStorageSync('campMode', key); } catch (e) {}
        this.campCfg = cfg;

        const tasks = this.buildTasks();
        const finishedMap = wx.getStorageSync('campFinishedMap') || {};
        const days = tasks.map((t) => ({
          day: t.day,
          name: t.name,
          finished: !!finishedMap[t.day]
        }));

        this.setData({
          campMode: key,
          campDays: cfg.days,
          campTitle: cfg.title,
          campSubtitle: cfg.subtitle,
          campRewardTimes: cfg.rewardTimes,
          campMaxRounds: cfg.maxRewardRounds,
          campRewardTotal: cfg.maxRewardRounds >= 99 ? 0 : cfg.rewardTimes * cfg.maxRewardRounds,
          days,
          activeDay: tasks[0].day,
          currentTask: tasks[0],
          currentFinished: !!finishedMap[tasks[0].day],
          finishedDays: tasks.filter((t) => finishedMap[t.day]).length
        });

        wx.setNavigationBarTitle({ title: cfg.title });
        if (key === 'season') this.initSeason();
        wx.showToast({ title: '已切换为 ' + cfg.title, icon: 'none', duration: 1500 });
      },
      fail: () => {}
    });
  },

  /** 切换守纪承诺（用 ActionSheet，不新增页面布局） */
  switchPromise() {
    const keys = ['A', 'B', 'C'];
    const names = ['A · 不留裸单', 'B · 止损 48 小时内记录', 'C · 单笔风险不超过 2%'];

    wx.showActionSheet({
      itemList: names,
      success: (res) => {
        const k = keys[res.tapIndex];
        if (!k) return;
        try { wx.setStorageSync('seasonPromise', k); } catch (e) {}
        this.setData({
          seasonPromise: k,
          seasonPromiseName: names[res.tapIndex].split(' · ')[1] || '不留裸单'
        });
        try { require('../../utils/seasonApi.js').join(k); } catch (e) {}
        wx.showToast({ title: '已切换守纪承诺', icon: 'none', duration: 1200 });
      },
      fail: () => {}
    });
  },

  buildTasks() {
    // [2026-09-10 Phase 1] 赛季模式走 30 天周期化脚本；训练模式保持原 7 天内容不变
    const _cfg = this.campCfg || seasonConfig.MODES[this.data.campMode] || seasonConfig.MODES.training;
    this.campCfg = _cfg;
    if (_cfg.key === 'season') return seasonConfig.buildSeasonTasks(_cfg);

    return [
      {
        day: 'D1',
        name: '止亏觉醒',
        title: '先把“会亏钱”停下来，认清自己的亏损模式',
        brief: '不急着赚钱，先搞清楚钱是怎么亏掉的。',
        daily: [
          '写下你最近 3 笔大亏损：买入原因 / 加仓节点 / 最终离场原因。',
          '只写事实，不解释、不辩解。'
        ],
        practice: [
          '今天不做任何新的高风险交易，只做小仓位或空仓观察。'
        ],
        review: [
          '复盘这 3 笔亏损里最共通的 1-2 个错误习惯。'
        ],
        homework: [
          '给自己写一条“底线宣言”：以后坚决不再重复哪 1-2 个错误。'
        ]
      },
      {
        day: 'D2',
        name: '账户体检',
        title: '给自己的账户做一次“健康体检”',
        brief: '先知道自己能承受多少伤，再谈如何上战场。',
        daily: [
          '统计近 3-6 个月账户最大回撤、最大单笔亏损、连续亏损次数。',
          '写下现在的资金规模与心理极限：最多能承受多少总回撤。'
        ],
        practice: [
          '今天只允许轻仓交易，观察自己在轻仓时的情绪变化。'
        ],
        review: [
          '对比「心理能接受的亏损」与「真实历史亏损」，看看差距有多大。'
        ],
        homework: [
          '写下 3 个数字：账户最大回撤、单日最大亏损、单笔最大亏损。'
        ]
      },
      {
        day: 'D3',
        name: '仓位框架',
        title: '用数字给自己设定一套「仓位天花板」',
        brief: '学会先定仓位，再决定敢不敢出手。',
        daily: [
          '设定普通市况、震荡市、极端行情下的三档仓位上限（例如 30% / 50% / 80%）。',
          '把这三档仓位写在纸上或记事本里，放在看盘最顺手的地方。'
        ],
        practice: [
          '用小资金演练一次「分批进场」：先用 30% 试探，再按计划加仓。'
        ],
        review: [
          '复盘今天是否有“冲动全仓”的冲动，如何被你自己拦下来的。'
        ],
        homework: [
          '用熵盾风控计算器，对一只你熟悉的标的，设计 4 次分批进场方案。'
        ]
      },
      {
        day: 'D4',
        name: '止损规则',
        title: '给每一笔交易配一把“安全降落伞”',
        brief: '没有止损的交易，都是裸奔的赌局。',
        daily: [
          '为你计划操作的每只标的，设定清晰的止损价与最大亏损金额。',
          '在下单前，把止损价写在订单旁边或备忘录里。'
        ],
        practice: [
          '今天至少执行一次“计划内止损”，不拖延、不找理由。'
        ],
        review: [
          '复盘这次止损：如果当时没有止损，现在会是什么结果？'
        ],
        homework: [
          '写下一个你最难忘的“该止损没止损”的案例，提醒自己不要再来一次。'
        ]
      },
      {
        day: 'D5',
        name: '盈利结构',
        title: '学会让盈利多待一会儿，让亏损早点离场',
        brief: '改变“赚小亏大”的老毛病，是风控的关键一跃。',
        daily: [
          '为每一笔计划交易设定目标价与期望盈亏比（例如 1:3 或 1:4）。',
          '只要没有触及止损，就尽量不要频繁在微利时提前离场。'
        ],
        practice: [
          '用极小仓位，完整执行一笔「目标价+止损价」同时设定的交易。'
        ],
        review: [
          '复盘最近 5 笔盈利交易：哪一笔是“过早卖飞”，损失了多少本可获得的利润。'
        ],
        homework: [
          '写下你理想中的“盈亏结构”，例如：平均盈利 > 平均亏损 2 倍以上。'
        ]
      },
      {
        day: 'D6',
        name: '情绪减震',
        title: '给交易情绪装一个「缓冲器」',
        brief: '不再让一时情绪，毁掉长期本金。',
        daily: [
          '给自己设定每天最多看盘次数，例如 3～5 次，其余时间不打开行情。'
        ],
        practice: [
          '今天刻意放慢决策速度：每次下单前，至少等待 3 分钟再确认。'
        ],
        review: [
          '记录今天最强烈的一次情绪波动，是因为什么行情触发的？'
        ],
        homework: [
          '写一句送给未来自己的“情绪提醒语”，放在交易记录最醒目的地方。'
        ]
      },
      {
        day: 'D7',
        name: '系统固化',
        title: '把这 7 天的训练，变成一套可重复执行的规则',
        brief: '从一次训练，升级为长期可以复用的风控系统。',
        daily: [
          '用一页纸，整理出你的「风控执行清单」：进场前 / 持仓中 / 离场后，各自检查什么。',
          '写下你愿意长期坚持的 3 条铁律，例如「单笔亏损不超 2%。」'
        ],
        practice: [
          '选一只熟悉的标的，用小仓位完整走一遍：规划 → 建仓 → 加减仓 → 止盈/止损 → 复盘。'
        ],
        review: [
          '复盘这 7 天中，自己变化最明显的 1-2 个地方。'
        ],
        homework: [
          '给未来 3 个月的自己写一封信：如果你坚持这些规则，账户会变成什么样？'
        ]
      }
    ];
  },

  // 切换顶部 Day Tab
  onSwitchDay(e) {
    const day = e.currentTarget.dataset.day;
    if (!day || day === this.data.activeDay) return;

    const task = this.tasks.find(t => t.day === day) || this.tasks[0];
    const finishedMap = wx.getStorageSync('campFinishedMap') || {};
    const currentFinished = !!finishedMap[day];

    this.setData({
      activeDay: day,
      currentTask: task,
      currentFinished
    });
  },

  /**
   * 去今日打卡
   */
  goToday() {
    const finishedMap = wx.getStorageSync('campFinishedMap') || {};
    const finishedDays = Object.keys(finishedMap).length;

    const tasks = this.tasks || this.buildTasks();

    let targetDay = '';
    let targetName = '';

    // [2026-09-10 Phase 1] 完成一轮的阈值由模式天数决定（7 天 / 30 天）
    if (finishedDays >= (this.campCfg ? this.campCfg.days : 7)) {
      // 👉 已完成一轮训练 → 清空本轮日志 & 完成标记，从 D1 重新开始
      wx.removeStorageSync('campDailyLogs');
      wx.removeStorageSync('campFinishedMap');

      const userRights = wx.getStorageSync('userRights') || {};
      const rewardRounds = Number(userRights.campRewardCount || 0);

      if (rewardRounds < MAX_REWARD_ROUNDS) {
        userRights.campRewardDone = false;
        mergeUserRights(userRights); // [CHANGE] unify write
      }

      const firstTask = tasks[0] || { day: 'D1', name: '止亏觉醒' };
      targetDay = firstTask.day;
      targetName = firstTask.name;

      const days = tasks.map(t => ({
        day: t.day,
        name: t.name,
        finished: false
      }));

      this.setData({
        days,
        activeDay: firstTask.day,
        currentTask: firstTask,
        currentFinished: false,
        finishedDays: 0,
        grade: {
          ready: false,
          score: 0,
          levelText: '',
          levelShortTag: '',
          levelClass: '',
          badge: '',
          tags: [],
          desc: ''
        }
      });
    } else {
      // 未完成 7 天 → 优先跳到第一个未完成的 Day
      const firstUnfinished =
        tasks.find(t => !finishedMap[t.day]) || tasks[0];

      targetDay = firstUnfinished.day;
      targetName = firstUnfinished.name;
    }

    console.log('[campIntro] goToday 点击', {
      finishedDays,
      targetDay,
      targetName
    });


    wx.navigateTo({
      url: `/pkgChallenge/campDaily/index?day=${targetDay}&dayName=${targetName}`
    });
  },

  /**
   * 查看 / 修改当前 Day 记录
   *（修复 “goCurrentDay 未定义” 的报错）
   */
  goCurrentDay() {
    const day = this.data.activeDay || 'D1';
    const tasks = this.tasks || this.buildTasks();
    const task = tasks.find(t => t.day === day) || tasks[0];

    wx.navigateTo({
      url: `/pkgChallenge/campDaily/index?day=${day}&dayName=${task.name}`
    });
  },

  // 查看 7 日风控执行报告
  goCampReport() {
    wx.navigateTo({
      url: '/pkgChallenge/campReport/index'
    });
  },

  // 去风控计算器
  goCalc() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index'
    });
  },

  // 返回首页
  goHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // ========== 邀请 / 裂变相关：clientId + profile ==========

  /**
   * 生成 / 读取 clientId（与裂变页保持一致）
   */
  ensureClientId() {
    const app = getApp && getApp();
    let clientId =
      (app && app.globalData && app.globalData.clientId) ||
      wx.getStorageSync('clientId');

    if (!clientId) {
      clientId =
        'ST-' +
        Date.now() +
        '-' +
        Math.floor(Math.random() * 1000000);

      wx.setStorageSync('clientId', clientId);
      if (app && app.globalData) {
        app.globalData.clientId = clientId;
      }
      console.log('[campIntro] 生成新的 clientId:', clientId);
    } else {
      if (app && app.globalData) {
        app.globalData.clientId = clientId;
      }
      console.log('[campIntro] 使用已有 clientId:', clientId);
    }

    return clientId;
  },

  /**
   * 调用 /api/fission/init，确保后端有这条 fission_user 记录
   */
  initFissionUser(clientId, cb) {
    wx.request({
      url: `${API_BASE}/api/fission/init`,  // 确保使用正确的生产环境 API_BASE
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        clientId
      },
      success: res => {
        console.log('[campIntro] fission init result:', res.data);
      },
      fail: err => {
        console.error('[campIntro] fission init failed:', err);
      },
      complete: () => {
        typeof cb === 'function' && cb();
      }
    });
  },

  /**
   * 获取自己的裂变信息（邀请码、绑定关系）
   */
  fetchFissionProfile(clientId) {
    wx.request({
      url: `${API_BASE}/api/fission/profile`,  // 确保使用正确的生产环境 API_BASE
      method: 'GET',
      data: {
        clientId
      },
      success: res => {
        console.log('[campIntro] fission profile:', res.data);
        // [ADD-BIND-SYNC] campIntro sync invited_by_code
        try {
          const data = (res && res.data) || {};
          const prof = data.profile || data.user || null;
          const code = prof ? String((prof.invited_by_code || prof.invitedByCode || prof.invited_by_code || '')).trim().toUpperCase() : '';
          if (code) wx.setStorageSync('fissionInvitedByCode', code);
          // 多字段兼容：防止 WXML 用的是不同字段名导致“未绑定”
          if (this && this.setData) {
            this.setData({
              invitedByCode: code,
              invited_by_code: code,
              hasInviter: !!code,
              hasBoundInviter: !!code,
              invitedBound: !!code
            });
          }
        } catch (e) {}


        if (!res.data || !res.data.ok || !res.data.user) {
          return;
        }

        const u = res.data.user;
        const myInviteCode = u.inviteCode || '';
        const hasInviter = !!u.invitedByCode;
        const invitedByCode = u.invitedByCode || '';

        this.setData({
          myInviteCode,
          hasInviter,
          invitedByCode
        });

        const app = getApp && getApp();
        if (app && app.globalData) {
          app.globalData.myInviteCode = myInviteCode;
        }
      },
      fail: err => {
        console.error('[campIntro] fission profile failed:', err);
      }
    });
  },

  /**
   * 顶部右上角“转发”时，自动带上我的邀请码
   */
  onShareAppMessage() {
    const app = getApp && getApp();
    const fromGlobal =
      (app && app.globalData && app.globalData.myInviteCode) || '';
    const code = (this.data.myInviteCode || fromGlobal || '').toUpperCase();

    // [2026-09-10 Phase 1] 赛季模式下分享路径带 mode，落地仍是赛季页
    const isSeason = this.data.campMode === 'season';
    const modeQs = isSeason ? '&mode=season' : '';
    const modeFirst = isSeason ? '?mode=season' : '';

    const path = code
      ? `/pkgChallenge/campIntro/index?inviteCode=${code}${modeQs}`
      : `/pkgChallenge/campIntro/index${modeFirst}`;

    const _t = this.data.campTitle || '7 天风控训练营';
    const _s = this.data.campSubtitle || '先控亏，再谈收益';

    return {
      title: `${_t}｜${_s}`,
      path
    };
  },

  /**
   * 「去绑定邀请码」按钮。
   *
   * 背景（代码事实）：邀请关系的绑定是**自动**的——onLoad 已把入口邀请码写入
   * pendingInviteCode，由 app.js 在 clientId 就绪后调 /api/fission/init 完成，
   * 无需用户手动输入。全库也不存在 C 端"手动绑定"页：
   * myInvite / inviteLookup 是运营查询工具（展示手机号、clientId、订单号），
   * 不能给 C 端跳转，否则泄露他人数据。
   * 因此该方法只做状态反馈，不做跳转。
   */
  goBindInvite() {
    const bound = String(this.data.invitedByCode || '').trim().toUpperCase();
    if (bound) {
      wx.showModal({
        title: '绑定状态',
        content: '你已绑定邀请人：' + bound,
        showCancel: false
      });
      return;
    }

    let pending = '';
    try {
      pending = String(wx.getStorageSync(PENDING_INVITE_KEY) || '').trim().toUpperCase();
    } catch (e) {
      pending = '';
    }

    if (pending) {
      wx.showModal({
        title: '绑定状态',
        content: '邀请码 ' + pending + ' 已记录，系统会自动完成绑定，无需手动操作。',
        showCancel: false
      });
      return;
    }

    wx.showModal({
      title: '绑定状态',
      content: '未识别到邀请码。可以让好友把训练营页面重新分享给你，打开后会自动记录。',
      showCancel: false
    });
  }
});


