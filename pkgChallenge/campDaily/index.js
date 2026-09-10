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

    // [Phase 2] 周末降级为复盘日：隐藏实盘演练，只做 daily/review/homework
    let sc = null;
    try { sc = require('../../utils/seasonConfig.js'); } catch (e) { sc = null; }
    const isRestDay = !!(sc && sc.isWeekend(sc.dateStr()));

    this.ensureClientIdAndInit();

    const logs = wx.getStorageSync('campDailyLogs') || {};
    const log = logs[day] || {};

    console.log('[campDaily] onLoad 使用对象结构读取日志:', logs, log);

    this.setData({
      day,
      dayName,
      dayLabel: dayName ? (day + ' · ' + dayName) : day,
      isRestDay,
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

  // -------------------------------------------------------------------------
  // [Phase 2] 赛季守纪自评 + 豁免日
  //
  // 设计：赛季成绩不能只靠"打了卡就算守纪"。提交后询问当日是否守住承诺；
  //       未守住时若还有豁免日，可消耗一个 —— 不达成、也不算破戒（借鉴达目标休假天）。
  //       周末/休市由后端直接 skipped，此处不打扰用户。
  // -------------------------------------------------------------------------
  askSeasonCheck() {
    try {
      if (wx.getStorageSync('campMode') !== 'season') return;
      let seasonApi = null;
      let sc = null;
      try { seasonApi = require('../../utils/seasonApi.js'); } catch (e) { return; }
      try { sc = require('../../utils/seasonConfig.js'); } catch (e) { sc = null; }

      // 休市日：后端会自动 skipped，静默上报即可，不弹窗打扰
      if (sc && sc.isWeekend && sc.isWeekend(sc.dateStr())) {
        seasonApi.check(true, '', false).then(() => {});
        return;
      }

      const P = { A: '不留裸单', B: '止损 48 小时内记录', C: '单笔风险不超过 2%' };
      const pid = wx.getStorageSync('seasonPromise') || '';
      const pname = P[pid] || '今天的守纪承诺';

      wx.showModal({
        title: '今日守纪确认',
        content: '今天你做到了「' + pname + '」吗？',
        confirmText: '守住了',
        cancelText: '没守住',
        success: (res) => {
          if (res.confirm) {
            seasonApi.check(true, '', false).then((r) => this.onSeasonChecked(r));
          } else {
            this.askUseExempt(seasonApi);
          }
        }
      });
    } catch (e) { /* 赛季接口不可用时不影响打卡 */ }
  },

  /** 未守住 → 询问是否消耗豁免日（仅在仍有余额时询问） */
  askUseExempt(seasonApi) {
    seasonApi.progress().then((p) => {
      const left = p && p.exemptLeft != null ? Number(p.exemptLeft) : 0;
      if (!left) {
        seasonApi.check(false, '', false).then((r) => this.onSeasonChecked(r));
        return;
      }
      wx.showModal({
        title: '使用豁免日？',
        content: '本赛季还剩 ' + left + ' 个豁免日。使用豁免日：今天不计达成，也不算破戒，不影响执行率。',
        confirmText: '用掉 1 个',
        cancelText: '记为未守纪',
        success: (r2) => {
          seasonApi.check(false, '', !!r2.confirm).then((r) => this.onSeasonChecked(r));
        }
      });
    });
  },

  onSeasonChecked(r) {
    if (!r || r.skipped) return;   // 休市日静默
    const txt = r.passed
      ? '已记录：今日守纪达成'
      : (r.exemptUsed ? '已记录：使用豁免日' : '已记录：今日未守纪');
    wx.showToast({ title: txt, icon: 'none', duration: 1500 });
  },

  calcScore(dailyNote, practiceNote, reviewNote, homeworkNote, isRestDay) {
    // [Phase 2] 周末复盘日只有 3 项（无实盘演练），3 项全填同样计满分
    const notes = isRestDay
      ? [dailyNote || '', reviewNote || '', homeworkNote || '']
      : [dailyNote || '', practiceNote || '', reviewNote || '', homeworkNote || ''];
    const filledCount = notes.filter((n) => n.trim().length > 0).length;

    if (isRestDay) return [0, 60, 78, 90][filledCount] || 0;

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

    const score = this.calcScore(dailyNote, practiceNote, reviewNote, homeworkNote, this.data.isRestDay);

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
    // [PATCH-D1-AUTO-REWARD] 被邀请人 D1 打卡成功后，自动通知后端给邀请人发奖励（幂等）
    try {
      const _day =
        ((typeof dayKey !== 'undefined') && dayKey) ||
        ((typeof day !== 'undefined') && day) ||
        (this.data && (this.data.dayKey || this.data.day || this.data.currentDay)) ||
        '';
    
      if (String(_day).toUpperCase() === 'D1') {
        const _apiBase =
          wx.getStorageSync('API_BASE') ||
          wx.getStorageSync('apiBaseUrl') ||
          ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '');
    
        const _clientId = wx.getStorageSync('clientId') || '';
        const _invitedBy =
          (wx.getStorageSync('fissionInvitedByCode') ||
           wx.getStorageSync('pendingInviteCode') ||
           wx.getStorageSync('fissionInvitedBy') ||
           wx.getStorageSync('invitedByCode') ||
           '') + '';
    
        const _sentKey = _clientId ? ('campD1InviteRewardSent_' + _clientId) : 'campD1InviteRewardSent';
        const _sent = Number(wx.getStorageSync(_sentKey) || 0) || 0;
    
        if (_apiBase && _clientId && _invitedBy && !_sent) {
          wx.request({
            url: _apiBase + '/api/camp/finish-day',
            method: 'POST',
            data: { clientId: _clientId, day: 'D1', invitedByCode: _invitedBy },
            success: (res) => {
              const d = res && res.data;
              console.log('[D1-AUTO-REWARD] resp=', d);
              // 后端 ok=true 即视为已触发（credited 可能为 0 也算触达）
              if (d && d.ok) wx.setStorageSync(_sentKey, 1);
            },
            fail: (e) => console.warn('[D1-AUTO-REWARD] fail=', e)
          });
        } else {
          console.log('[D1-AUTO-REWARD] skip', { hasApiBase: !!_apiBase, hasClientId: !!_clientId, hasInvitedBy: !!_invitedBy, sent: _sent });
        }
      }
    } catch (e) { console.warn('[D1-AUTO-REWARD] err', e); }

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

    // [Phase 2] 赛季模式：提交后做当日守纪自评（后端未上线时静默跳过）
    this.askSeasonCheck();

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
          '你已经迈出了“先控亏”的第一步。\\n不妨继续完成 3 天训练，也可以先查看熵盾会员方案。',
        confirmText: '继续训练',
        cancelText: '查看会员方案',
        success: (res) => {
          if (res.cancel) {
            wx.navigateTo({
              url: '/pages/membership/index?from=campDaily&stage=D1'
            });
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
            wx.navigateTo({ url: '/pages/pay/index?type=steady&from=campDaily' });
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
          '你已经完整走完 7 天训练流程。\n不妨先查看你的 7 日风控执行报告，再决定下一步要不要放大资金和使用高阶方案。',
        confirmText: '查看 7 日报告',
        cancelText: '先返回训练营',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pkgChallenge/campReport/index' });
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

