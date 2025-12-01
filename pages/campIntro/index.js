// pages/campIntro/index.js 
const { getLevelInfo } = require('../../utils/grade.js');
const app = getApp();
const API_BASE = 'http://localhost:3000';

// ✅ 完成一轮 7 天训练营，赠送的完整风控方案使用次数（给自己）
const CAMP_REWARD_TIMES = 4;

// ✅ 最多奖励的轮次（只奖励前三轮，从第四轮开始不再送）
const MAX_REWARD_ROUNDS = 3;

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
    }
  },

  onLoad() {
    this.initCampAndGrade();
  },

  // 从打卡页返回时也要刷新等级和进度
  onShow() {
    this.initCampAndGrade();
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
    const dayKeys = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'];

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

      // 从 grade.js 里拿到等级信息
      const levelInfo = getLevelInfo(
        avgScore,
        effectiveDays,
        goodDays,
        badDays,
        allTags
      );

      // 统一放在 /images/badges/ 下，例如 lv1.png
      const badge = levelInfo.badge
        ? `/images/badges/${levelInfo.badge}`
        : '';

      grade = {
        ready: true,
        score: avgScore,
        levelText: levelInfo.name,      // 例如：Lv.2 记录养成者
        levelShortTag: levelInfo.tag,   // 简短标签
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

    // ---------- 完成 7/7 天训练营 → 赠送风控计算器完整方案次数（给自己） ----------
    try {
      const userRights = wx.getStorageSync('userRights') || {};
      const hasRewarded = !!userRights.campRewardDone;  // 本轮是否已发过奖励
      const oldTimes = Number(userRights.freeCalcTimes || 0);

      // 已累计奖励的轮次（没有则从 0 开始）
      let rewardRounds = Number(userRights.campRewardCount || 0);

      // 只在「本轮第一次完成 7 天」且「累计奖励轮次 < MAX_REWARD_ROUNDS」时发奖励
      if (finishedDays === 7 && !hasRewarded && rewardRounds < MAX_REWARD_ROUNDS) {
        const newTimes = oldTimes + CAMP_REWARD_TIMES;
        rewardRounds += 1;

        userRights.freeCalcTimes = newTimes;
        userRights.campRewardDone = true;           // 标记本轮已奖励
        userRights.campRewardCount = rewardRounds;  // 记录已奖励轮次
        wx.setStorageSync('userRights', userRights);

        wx.showToast({
          title: `恭喜完成第 ${rewardRounds} 轮训练，获赠 ${CAMP_REWARD_TIMES} 次完整方案`,
          icon: 'none',
          duration: 2500
        });

        // ★ 新增：在此时顺便把“完成 7 天训练营”的奖励上报给后端
        //      若当前控局者是某人的被邀请人，则为“邀请人”增加裂变奖励次数
        this.notifyCampFinishReward();
      }
    } catch (e) {
      console.log('[campIntro] reward calc times error', e);
    }

    // 保存任务数组供其它函数使用
    this.tasks = tasks;

    // 更新页面数据
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
  buildTasks() {
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
   * 去今日打卡：
   * - 未完成 7 天：跳到第一个未完成的 Day
   * - 已完成 7 天：清空本轮打卡记录，从 D1 重新开始；
   *   如果累计奖励轮次 < MAX_REWARD_ROUNDS，则重置 campRewardDone
   */
  goToday() {
    const finishedMap = wx.getStorageSync('campFinishedMap') || {};
    const finishedDays = Object.keys(finishedMap).length;

    const tasks = this.tasks || this.buildTasks();

    let targetDay = '';
    let targetName = '';

    if (finishedDays >= 7) {
      // 👉 已完成一轮训练 → 清空本轮日志 & 完成标记，从 D1 重新开始
      wx.removeStorageSync('campDailyLogs');
      wx.removeStorageSync('campFinishedMap');

      // 读取并更新奖励状态
      const userRights = wx.getStorageSync('userRights') || {};
      const rewardRounds = Number(userRights.campRewardCount || 0);

      // 只有在累计奖励轮次小于上限时，才重置 campRewardDone
      if (rewardRounds < MAX_REWARD_ROUNDS) {
        userRights.campRewardDone = false;
        wx.setStorageSync('userRights', userRights);
      }

      const firstTask = tasks[0] || { day: 'D1', name: '止亏觉醒' };
      targetDay = firstTask.day;
      targetName = firstTask.name;

      const days = tasks.map(t => ({
        day: t.day,
        name: t.name,
        finished: false
      }));

      // 立即把当前页面上的进度清零（回来时 onShow 还会再计算一次）
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
      url: `/pages/campDaily/index?day=${targetDay}&dayName=${targetName}`
    });
  },

  /**
   * ★ 新增：查看 / 修改当前 activeDay 的打卡记录
   * （用于“已完成 D1 任务（查看 / 修改记录）”按钮）
   */
  goCurrentDay() {
    const activeDay = this.data.activeDay || 'D1';
    const tasks = this.tasks || this.buildTasks();
    const task = tasks.find(t => t.day === activeDay) || tasks[0];

    wx.navigateTo({
      url: `/pages/campDaily/index?day=${activeDay}&dayName=${task.name}`
    });
  },

  // 查看 7 日风控执行报告
  goCampReport() {
    wx.navigateTo({
      url: '/pages/campReport/index'
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

  /**
   * ★ 完成 7 天训练营时，上报给后端：
   * 若当前控局者是某人的「被邀请人」，则为邀请人增加裂变奖励次数
   */
  notifyCampFinishReward() {
    const clientId =
      (app.globalData && app.globalData.clientId) ||
      wx.getStorageSync('clientId');

    if (!clientId) {
      console.warn('[campIntro] 缺少 clientId，无法上报 7 天完成奖励');
      return;
    }

    wx.request({
      url: `${API_BASE}/api/fission/camp/finish`,
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        clientId
      },
      success: res => {
        console.log('[campIntro] camp finish reward result:', res.data);
      },
      fail: err => {
        console.error('[campIntro] camp finish reward request failed:', err);
      }
    });
  }
});
