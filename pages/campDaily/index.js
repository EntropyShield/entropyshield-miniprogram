// pages/campDaily/index.js

const app = getApp();
const API_BASE = 'http://localhost:3000'; // 本地调试用后端地址

Page({
  data: {
    // 当前是哪一天：D1~D7
    day: 'D1',
    dayName: '',

    // 四个模块的文本
    dailyNote: '',
    practiceNote: '',
    reviewNote: '',
    homeworkNote: '',

    // 本条记录的得分（用于 7 日等级）
    score: 0,

    // 是否已经完成（用于按钮文案/状态）
    finished: false
  },

  onLoad(options) {
    const day = options.day || 'D1';
    const dayName = options.dayName || '';

    // ★ 进入打卡页时，先确保有 clientId，并向后端做一次初始化
    this.ensureClientIdAndInit();

    // 从本地读取所有日志
    const logs = wx.getStorageSync('campDailyLogs') || {};
    const log = logs[day] || {};

    console.log('[campDaily] onLoad 使用对象结构读取日志:', logs, log);

    this.setData({
      day,
      dayName,
      dailyNote: log.dailyNote || '',
      practiceNote: log.practiceNote || '',
      reviewNote: log.reviewNote || '',
      homeworkNote: log.homeworkNote || '',
      score: typeof log.score === 'number' ? log.score : 0,
      finished: !!log.finished
    });
  },

  /**
   * ★★ 核心：保证每个用户都有一个唯一 clientId，并且在后端有一条 fission_user 记录
   */
  ensureClientIdAndInit() {
    let clientId =
      (app.globalData && app.globalData.clientId) ||
      wx.getStorageSync('clientId');

    // 如果本地没有，就临时生成一个（以后可以换成真正的 openid）
    if (!clientId) {
      clientId =
        'ST-' +
        Date.now() +
        '-' +
        Math.floor(Math.random() * 1000000);

      wx.setStorageSync('clientId', clientId);
      if (app.globalData) {
        app.globalData.clientId = clientId;
      }

      console.log('[campDaily] 生成新的 clientId:', clientId);
    } else {
      console.log('[campDaily] 使用已有 clientId:', clientId);
      if (app.globalData) {
        app.globalData.clientId = clientId;
      }
    }

    // 调用后端 /api/fission/init，确保 fission_user 里有这条记录
    wx.request({
      url: `${API_BASE}/api/fission/init`,
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        clientId
        // 这里暂时不传昵称/头像，后面你要做裂变任务页时可以补充
      },
      success: res => {
        console.log('[campDaily] fission init result:', res.data);
      },
      fail: err => {
        console.error('[campDaily] fission init failed:', err);
      }
    });
  },

  /**
   * 通用输入处理
   * 在 wxml 里通过 data-field 传入：dailyNote / practiceNote / reviewNote / homeworkNote
   */
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;

    if (!field) return;

    this.setData({
      [field]: value
    });
  },

  /**
   * 计算一个简单的评分，用于 7 日等级统计：
   * - 填写的模块越多，得分越高
   */
  calcScore(dailyNote, practiceNote, reviewNote, homeworkNote) {
    const notes = [
      dailyNote || '',
      practiceNote || '',
      reviewNote || '',
      homeworkNote || ''
    ];
    const filledCount = notes.filter(n => n.trim().length > 0).length;

    if (filledCount === 0) return 0;
    if (filledCount === 1) return 60;
    if (filledCount === 2) return 70;
    if (filledCount === 3) return 80;
    return 90; // 四项都填
  },

  /**
   * 保存日志到本地 storage
   * @param {boolean} isFinished 本次是否标记为“已完成”
   * @returns {Object} { finishedDays, alreadyFinished }
   */
  saveLog(isFinished) {
    const {
      day,
      dayName,
      dailyNote,
      practiceNote,
      reviewNote,
      homeworkNote
    } = this.data;

    const logs = wx.getStorageSync('campDailyLogs') || {};
    const finishedMap = wx.getStorageSync('campFinishedMap') || {};

    const prevLog = logs[day] || {};
    const alreadyFinished = !!finishedMap[day];

    // 计算评分
    const score = this.calcScore(
      dailyNote,
      practiceNote,
      reviewNote,
      homeworkNote
    );

    // 简单标签占位（后面可以按内容再细化）
    const tags = [];
    const textAll =
      (dailyNote || '') +
      (practiceNote || '') +
      (reviewNote || '') +
      (homeworkNote || '');
    if (textAll.length >= 40) tags.push('记录较完整');
    if (textAll.length >= 120) tags.push('表达很详细');

    logs[day] = {
      day,
      dayName,
      dailyNote,
      practiceNote,
      reviewNote,
      homeworkNote,
      score,
      tags,
      finished: isFinished || alreadyFinished // 只要完成过一次就算已完成
    };

    // 标记“该天已完成”
    if (isFinished) {
      finishedMap[day] = true;
    }

    wx.setStorageSync('campDailyLogs', logs);
    wx.setStorageSync('campFinishedMap', finishedMap);

    console.log('[campDaily] saveLog 写入后的 campDailyLogs:', logs);

    const finishedDays = Object.keys(finishedMap).length;

    this.setData({
      score,
      finished: logs[day].finished
    });

    return {
      finishedDays,
      alreadyFinished
    };
  },

  /** 先保存为草稿 */
  onSaveDraft() {
    this.saveLog(false);
    wx.showToast({
      title: '草稿已保存',
      icon: 'success',
      duration: 1000
    });
  },

  /** 提交并完成今日打卡 */
  onSubmit() {
    const {
      dailyNote,
      practiceNote,
      reviewNote,
      homeworkNote,
      day
    } = this.data;

    // 至少写一项再允许提交
    const hasContent =
      (dailyNote && dailyNote.trim()) ||
      (practiceNote && practiceNote.trim()) ||
      (reviewNote && reviewNote.trim()) ||
      (homeworkNote && homeworkNote.trim());

    if (!hasContent) {
      wx.showToast({
        title: '至少填写一条记录再提交',
        icon: 'none'
      });
      return;
    }

    const { finishedDays, alreadyFinished } = this.saveLog(true);

    // —— 新增逻辑：D1 首次完成时，上报后端奖励 ——
    if (day === 'D1' && !alreadyFinished) {
      this.notifyCampD1Reward();
    }

    // 如果之前已经是“已完成”，这次视为修改记录，不再重复弹引导
    if (alreadyFinished) {
      wx.showToast({
        title: '修改已保存',
        icon: 'success',
        duration: 800
      });
      setTimeout(() => {
        this.goCampIntro();
      }, 600);
      return;
    }

    // 第 1 天首次完成：温和引导去看进阶服务
    if (finishedDays === 1) {
      wx.showModal({
        title: '已完成第 1 天 · 止亏觉醒',
        content:
          '你已经迈出了“先控亏”的第一步。\n建议继续完成 3 天训练，再考虑是否开通完整风控方案。\n也可以现在先看看进阶服务介绍。',
        confirmText: '继续训练',
        cancelText: '看看进阶服务',
        success: res => {
          if (res.cancel) {
            // 去进阶服务介绍页
            wx.navigateTo({
              url: '/pages/payIntro/index'
            });
          } else {
            // 回训练营日历
            this.goCampIntro();
          }
        }
      });
      return;
    }

    // 第 3 天首次完成：强一点的会员引导
    if (finishedDays === 3) {
      wx.showModal({
        title: '已连续完成 3 天训练',
        content:
          '你已经完成“止亏觉醒、账户体检、仓位框架”三大模块。\n现在开通稳健版风控方案，可以把训练成果直接落到实盘方案里。',
        confirmText: '开通会员解锁方案',
        cancelText: '稍后再说',
        success: res => {
          if (res.confirm) {
            // 这里默认引导到稳健版入口；也可以根据实际情况带上 balance/price/code
            wx.navigateTo({
              url: '/pages/membership/index?type=steady'
            });
          } else {
            this.goCampIntro();
          }
        }
      });
      return;
    }

    // 第 7 天首次完成：鼓励查看 7 日报告
    if (finishedDays === 7) {
      wx.showModal({
        title: '恭喜完成 7 天风控训练营',
        content:
          '你已经完整走完 7 天训练流程。\n建议先查看你的 7 日风控执行报告，再决定下一步要不要放大资金和使用高阶方案。',
        confirmText: '查看 7 日报告',
        cancelText: '先返回训练营',
        success: res => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/campReport/index'
            });
          } else {
            this.goCampIntro();
          }
        }
      });
      return;
    }

    // 其它天数：正常提示 + 回训练营日历
    wx.showToast({
      title: '已提交今日打卡',
      icon: 'success',
      duration: 800
    });

    setTimeout(() => {
      this.goCampIntro();
    }, 600);
  },

  /**
   * 上报 D1 打卡奖励（只在 D1 首次完成时调用）
   */
  notifyCampD1Reward() {
    wx.showToast({
      title: '正在上报D1奖励',
      icon: 'none',
      duration: 1000
    });

    const clientId =
      (app.globalData && app.globalData.clientId) ||
      wx.getStorageSync('clientId');

    if (!clientId) {
      console.warn('缺少 clientId，无法上报 D1 打卡奖励');
      wx.showToast({
        title: '缺少ID，先完成裂变初始化',
        icon: 'none',
        duration: 1500
      });
      return;
    }

    wx.request({
      url: `${API_BASE}/api/fission/camp/d1`,
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        clientId
      },
      success: res => {
        console.log('[campDaily] D1 reward result:', res.data);

        if (!res.data || !res.data.ok) {
          wx.showToast({
            title: 'D1奖励上报失败',
            icon: 'none',
            duration: 1500
          });
          return;
        }

        if (res.data.alreadyRewarded) {
          wx.showToast({
            title: 'D1奖励已发过',
            icon: 'none',
            duration: 1500
          });
        } else if (res.data.hasInviter) {
          wx.showToast({
            title: '已为好友解锁奖励',
            icon: 'success',
            duration: 1500
          });
        } else {
          wx.showToast({
            title: '无邀请人，仅记录打卡',
            icon: 'none',
            duration: 1500
          });
        }
      },
      fail: err => {
        console.error('[campDaily] D1 reward request failed:', err);
        wx.showToast({
          title: 'D1奖励网络错误',
          icon: 'none',
          duration: 1500
        });
      }
    });
  },

  /** 返回训练营日历（从打卡页回日历） */
  goCampIntro() {
    // 一般是从训练营日历进入的，这里直接返回上一页就够了
    wx.navigateBack({
      delta: 1
    });
  },

  /** 兼容 wxml 中 bindtap="goBackCamp" 的按钮 */
  goBackCamp() {
    this.goCampIntro();
  },

  /** 返回熵盾首页 */
  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});
