// pages/campDaily/index.js
// MOD: STABILIZE_APP_INSTANCE_20260103

const { API_BASE } = require('../../config');  // 确保从 config.js 中导入 API_BASE

const app = getApp && getApp();

Page({
  data: {
    day: 'D1',
    dayName: '',

    dailyNote: '',
    practiceNote: '',
    reviewNote: '',
    homeworkNote: '',

    score: 0,
    finished: false
  },

  onLoad(options) {
    const day = options.day || 'D1';
    const dayName = options.dayName || '';

    this.ensureClientIdAndInit();

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

  ensureClientIdAndInit() {
    const appInst = app || (getApp && getApp());
    let clientId =
      (appInst && appInst.globalData && appInst.globalData.clientId) ||
      wx.getStorageSync('clientId');

    if (!clientId) {
      clientId = `ST-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      wx.setStorageSync('clientId', clientId);
      if (appInst && appInst.globalData) appInst.globalData.clientId = clientId;
      console.log('[campDaily] 生成新的 clientId:', clientId);
    } else {
      console.log('[campDaily] 使用已有 clientId:', clientId);
      if (appInst && appInst.globalData) appInst.globalData.clientId = clientId;
    }

    // 确保请求的 URL 使用正确的生产环境地址
    wx.request({
      url: `${API_BASE}/api/fission/init`,  // 这里确保 URL 使用的是生产环境的 API_BASE
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { clientId },
      success: (res) => {
        console.log('[campDaily] fission init result:', res.data);
      },
      fail: (err) => {
        console.error('[campDaily] fission init failed:', err);
      }
    });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    if (!field) return;
    this.setData({ [field]: value });
  },

  calcScore(dailyNote, practiceNote, reviewNote, homeworkNote) {
    const notes = [dailyNote || '', practiceNote || '', reviewNote || '', homeworkNote || ''];
    const filledCount = notes.filter((n) => n.trim().length > 0).length;

    if (filledCount === 0) return 0;
    if (filledCount === 1) return 60;
    if (filledCount === 2) return 70;
    if (filledCount === 3) return 80;
    return 90;
  },

  saveLog(isFinished) {
    const { day, dayName, dailyNote, practiceNote, reviewNote, homeworkNote } = this.data;

    const logs = wx.getStorageSync('campDailyLogs') || {};
    const finishedMap = wx.getStorageSync('campFinishedMap') || {};

    const alreadyFinished = !!finishedMap[day];

    const score = this.calcScore(dailyNote, practiceNote, reviewNote, homeworkNote);

    const tags = [];
    const textAll = (dailyNote || '') + (practiceNote || '') + (reviewNote || '') + (homeworkNote || '');
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
      finished: isFinished || alreadyFinished
    };

    if (isFinished) finishedMap[day] = true;

    wx.setStorageSync('campDailyLogs', logs);
    wx.setStorageSync('campFinishedMap', finishedMap);

    console.log('[campDaily] saveLog 写入后的 campDailyLogs:', logs);

    const finishedDays = Object.keys(finishedMap).length;

    this.setData({
      score,
      finished: logs[day].finished
    });

    return { finishedDays, alreadyFinished };
  },

  onSaveDraft() {
    this.saveLog(false);
    wx.showToast({ title: '草稿已保存', icon: 'success', duration: 1000 });
  },

  onSubmit() {
    const { dailyNote, practiceNote, reviewNote, homeworkNote, day } = this.data;

    const hasContent =
      (dailyNote && dailyNote.trim()) ||
      (practiceNote && practiceNote.trim()) ||
      (reviewNote && reviewNote.trim()) ||
      (homeworkNote && homeworkNote.trim());

    if (!hasContent) {
      wx.showToast({ title: '至少填写一条记录再提交', icon: 'none' });
      return;
    }

    const { finishedDays, alreadyFinished } = this.saveLog(true);

    if (day === 'D1' && !alreadyFinished) {
      this.notifyCampD1Reward();
    }

    if (alreadyFinished) {
      wx.showToast({ title: '修改已保存', icon: 'success', duration: 800 });
      setTimeout(() => this.goCampIntro(), 600);
      return;
    }

    if (finishedDays === 1) {
      wx.showModal({
        title: '已完成第 1 天 · 止亏觉醒',
        content:
          '你已经迈出了“先控亏”的第一步。\n建议继续完成 3 天训练，再考虑是否开通完整风控方案。\n也可以现在先看看进阶服务介绍。',
        confirmText: '继续训练',
        cancelText: '看看进阶服务',
        success: (res) => {
          if (res.cancel) {
            wx.navigateTo({ url: '/pages/payIntro/index' });
          } else {
            this.goCampIntro();
          }
        }
      });
      return;
    }

    if (finishedDays === 3) {
      wx.showModal({
        title: '已连续完成 3 天训练',
        content:
          '你已经完成“止亏觉醒、账户体检、仓位框架”三大模块。\n现在开通稳健版风控方案，可以把训练成果直接落到实盘方案里。',
        confirmText: '开通会员解锁方案',
        cancelText: '稍后再说',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/membership/index?type=steady' });
          } else {
            this.goCampIntro();
          }
        }
      });
      return;
    }

    if (finishedDays === 7) {
      wx.showModal({
        title: '恭喜完成 7 天风控训练营',
        content:
          '你已经完整走完 7 天训练流程。\n建议先查看你的 7 日风控执行报告，再决定下一步要不要放大资金和使用高阶方案。',
        confirmText: '查看 7 日报告',
        cancelText: '先返回训练营',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/campReport/index' });
          } else {
            this.goCampIntro();
          }
        }
      });
      return;
    }

    wx.showToast({ title: '已提交今日打卡', icon: 'success', duration: 800 });
    setTimeout(() => this.goCampIntro(), 600);
  },

  notifyCampD1Reward() {
    wx.showToast({ title: '正在上报D1奖励', icon: 'none', duration: 1000 });

    const appInst = app || (getApp && getApp());
    const clientId =
      (appInst && appInst.globalData && appInst.globalData.clientId) ||
      wx.getStorageSync('clientId');

    if (!clientId) {
      console.warn('缺少 clientId，无法上报 D1 打卡奖励');
      wx.showToast({ title: '缺少ID，先完成裂变初始化', icon: 'none', duration: 1500 });
      return;
    }

    wx.request({
      url: `${API_BASE}/api/fission/camp/d1`,  // 确保请求的 URL 使用正确的生产环境地址
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { clientId },
      success: (res) => {
        console.log('[campDaily] D1 reward result:', res.data);

        if (!res.data || !res.data.ok) {
          wx.showToast({ title: 'D1奖励上报失败', icon: 'none', duration: 1500 });
          return;
        }

        if (res.data.alreadyRewarded) {
          wx.showToast({ title: 'D1奖励已发过', icon: 'none', duration: 1500 });
        } else if (res.data.hasInviter) {
          wx.showToast({ title: '已为好友解锁奖励', icon: 'success', duration: 1500 });
        } else {
          wx.showToast({ title: '无邀请人，仅记录打卡', icon: 'none', duration: 1500 });
        }
      },
      fail: (err) => {
        console.error('[campDaily] D1 reward request failed:', err);
        wx.showToast({ title: 'D1奖励网络错误', icon: 'none', duration: 1500 });
      }
    });
  },

  goCampIntro() {
    wx.navigateBack({ delta: 1 });
  },

  goBackCamp() {
    this.goCampIntro();
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' });
  }
});
