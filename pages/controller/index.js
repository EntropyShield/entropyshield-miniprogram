// pages/controller/index.js
const funnel = require('../../utils/funnel.js');

Page({
  data: {
    // 顶部展示用
    finishedDays: 0,
    stageText: '训练待开始',
    nextStepText: '',

    // 7 天训练营概要（从本地缓存里读）
    campSummary: {
      finishedDays: 0,
      rewardRounds: 0
    },

    // 课程日历（示例课表，按 5 类课来设计）
    courseSections: [
      {
        id: 'this-week',
        title: '本周课表',
        tag: '建议从这里选一节先体验',
        courses: [
          {
            id: 'C001',
            time: '每周二 20:00-21:30',
            title: '止亏觉醒：为什么 90% 的人输在风控？',
            typeText: '公开课',
            typeClass: 'tag-open', // 公开课（破冰）
            mode: '线上 · 直播',
            level: '适合所有交易者',
            highlight:
              '讲清亏损的根源和“熵智能”的底层逻辑，是第一次接触熵盾的首选入口。',
            ctaText: '添加顾问微信预约'
          },
          {
            id: 'C002',
            time: '每周三 20:00-21:30',
            title: '账户体检实战课：读懂你的亏损简历',
            typeText: '引流课',
            typeClass: 'tag-lead', // 引流课 / 账户体检
            mode: '线上 · 小班直播',
            level: '有实盘交易经验更佳',
            highlight:
              '带你用“体检表”梳理近 3-6 个月的回撤和错误模式，为训练营和系统课打基础。',
            ctaText: '添加顾问微信预约'
          },
          {
            id: 'C003',
            time: '每周四 20:00-22:00',
            title: '风控计算器实战：搭建你的分批进出场护栏',
            typeText: '体验课',
            typeClass: 'tag-calc', // 风控计算器体验课
            mode: '线上 · 实操演练',
            level: '已安装风控计算器或准备正式使用工具的用户',
            highlight:
              '一人一标的，现场帮你用风控计算器跑完一套完整方案，真正落地“先控亏，再谈收益”。',
            ctaText: '添加顾问微信预约'
          },
          {
            id: 'C004',
            time: '每周六 14:30-17:00',
            title: '控局者线下沙龙 + 账户体检',
            typeText: '线下沙龙',
            typeClass: 'tag-salon', // 线下沙龙
            mode: '线下 · 深圳 · 熵盾研究院',
            level: '有持续交易记录的控局者候选',
            highlight:
              '小范围线下交流 + 账户体检 + 个性化风控建议，是进入“控局者系统课”的重要前置环节。',
            ctaText: '查看来访预约入口'
          }
        ]
      },
      {
        id: 'next-week',
        title: '下周预告',
        tag: '时间可能微调，以顾问通知为准',
        courses: [
          {
            id: 'C005',
            time: '下周二 20:00-21:30',
            title: '从散户到控局者：熵盾研究院完整路径说明',
            typeText: '主题公开课',
            typeClass: 'tag-open', // 主题公开课
            mode: '线上 · 直播',
            level: '准备系统学习、想看全路径的用户',
            highlight:
              '把“风控计算器 + 7 天训练营 + 研究院 + 控局者系统课”打通，讲清每一步的门槛和收益。',
            ctaText: '添加顾问微信预约'
          }
        ]
      }
    ]
  },

  onShow() {
    // 埋点：用户浏览控局者页
    funnel.log('CONTROLLER_VIEW', {
      ts: Date.now()
    });

    // 刷新 7 天训练营概要
    this.refreshCampSummary();
  },

  // 从本地缓存读取 7 天训练营进度 + 阶段 & 下一步文案
  refreshCampSummary() {
    try {
      const finishedMap = wx.getStorageSync('campFinishedMap') || {};
      const finishedDays = Object.keys(finishedMap).length;

      const userRights = wx.getStorageSync('userRights') || {};
      const rewardRounds = Number(userRights.campRewardCount || 0);

      // 预留：是否已完成收费进阶课（后面课程模块打通时，可以写入这个标记）
      const hasPaidCourse = !!wx.getStorageSync('hasPaidCourse');

      let stageText = '';
      let nextStepText = '';

      if (hasPaidCourse) {
        // 第 4 阶段：控局者进阶中
        stageText = '控局者进阶中';
        nextStepText =
          '建议结合线下沙龙或一对一账户体检，为你的盈利系统做年度体检。';
      } else if (finishedDays >= 7) {
        // 第 3 阶段：完成至少一轮训练营
        stageText = '已完成一轮训练营';
        nextStepText =
          '建议从「会亏钱的交易课」或进阶课开始，把训练营体验升级成完整盈利系统。';
      } else if (finishedDays > 0) {
        // 第 2 阶段：训练进行中
        stageText = '训练进行中';
        nextStepText =
          '优先打完本轮 7 天训练营，再考虑体验课或账户体检课。';
      } else {
        // 第 1 阶段：尚未开始
        stageText = '训练待开始';
        nextStepText =
          '建议先用风控计算器跑 1 套方案，然后从 D1 开始 7 天风控训练营。';
      }

      this.setData({
        finishedDays,
        stageText,
        nextStepText,
        campSummary: {
          finishedDays,
          rewardRounds
        }
      });
    } catch (e) {
      console.error('[controller] refreshCampSummary error', e);
    }
  },

  // 进入 7 天风控训练营
  goCamp() {
    wx.navigateTo({
      url: '/pages/campIntro/index'
    });
  },

  // 兼容旧调用名（如果其它地方用到 goCampIntro）
  goCampIntro() {
    this.goCamp();
  },

  // 进入课程日历（新的课程页）
  goToCourseList() {
    wx.navigateTo({
      url: '/pages/courses/index'
    });
  },

  // 进入我的课程进度页
  goCourseProgress() {
    wx.navigateTo({
      url: '/pages/course/progress'
    });
  },

  // 去风控计算器
  goCalc() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index'
    });
  },

  // 点击某一门课程：按 5 类课给不同引导话术
  onCourseTap(e) {
    const id = String(e.currentTarget.dataset.id || '');

    // 线下沙龙：跳来访预约说明
    if (id === 'C004') {
      wx.showModal({
        title: '线下沙龙 / 来访预约',
        content:
          '线下沙龙与来访预约可在「个人中心 → 熵盾实验室 → 公司来访预约」中填写信息，或联系顾问确认具体场次。',
        showCancel: false
      });
      return;
    }

    // 其他课程，按类型引导
    let title = '';
    let content = '';

    switch (id) {
      case 'C001':
        // 公开课：破冰
        title = '公开课 · 止亏觉醒';
        content =
          '适合第一次接触熵盾的交易者，主要讲为什么大部分人输在风控，而不是输在“消息”。\n\n建议你：\n1）先参加本场公开课，建立正确的风险观；\n2）再用风控计算器跑出自己的第一套方案；\n3）然后进入 7 天风控训练营，把行为练扎实。';
        break;
      case 'C002':
        // 引流课：账户体检
        title = '引流课 · 账户体检实战';
        content =
          '适合已经有 3–6 个月交易记录的用户，我们会一起拆解你的“亏损简历”。\n\n建议你提前准备：\n1）最近几个月的交易截图或对账单；\n2）在课上完成一份【账户体检表】；\n3）体检结果将直接决定你在训练营和系统课中的训练重点。';
        break;
      case 'C003':
        // 体验课：风控计算器实战
        title = '体验课 · 风控计算器实战';
        content =
          '这是围绕风控计算器的一节实战课，一人一标的，现场帮你跑完整套分批进出场方案。\n\n建议你：\n1）提前选择一个自己最关心的标的；\n2）在小程序里先用风控计算器跑一次草稿；\n3）课堂上根据老师的指导，调整成可以直接拿去实战的版本，并带入 7 天训练营持续演练。';
        break;
      case 'C005':
        // 主题公开课：完整路径说明
        title = '主题公开课 · 从散户到控局者';
        content =
          '这一课会把“风控计算器 → 7 天训练营 → 熵盾研究院 → 控局者系统课 → 线下沙龙 / 合伙人”整条路径讲清楚。\n\n适合：\n1）已经体验过工具或训练营，想看全景规划的用户；\n2）准备长期在熵盾体系内搭建盈利系统的控局者候选。';
        break;
      default:
        title = '课程预约说明';
        content =
          '当前为内测阶段，课程名额通过顾问统一分配。你可以先添加熵盾顾问微信，由顾问为你安排具体场次。';
        break;
    }

    wx.showModal({
      title,
      content,
      showCancel: false
    });
  }
});
