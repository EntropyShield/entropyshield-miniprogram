// pages/fissionTask/index.js 
const app = getApp();
const { API_BASE } = require('../../config.js'); // ✅ 统一从 config.js 读取 API_BASE
// [MOD-OPENID-20251230] 改用 utils/clientId.js 的 openid 方案
const clientIdUtil = require('../../utils/clientId.js');

// 本地“待绑定的邀请码”的 key
const PENDING_INVITE_KEY = 'pendingInviteCode';
// 本地缓存：自己的专属邀请码 & 已绑定的邀请人邀请码
const FISSION_MY_INVITE_KEY = 'fissionMyInviteCode';
const FISSION_INVITED_BY_KEY = 'fissionInvitedByCode';

Page({
  data: {
    loading: true,

    // [MOD-OPENID-20251230] 当前用户唯一 ID：openid（由 /api/wx/login 换取）
    clientId: '',

    // 我的专属邀请码
    myInviteCode: '',

    // 绑定好友邀请码输入框
    bindInviteCodeInput: '',
    hasBoundInviter: false,
    invitedByCode: '',

    // 后端统计的总奖励次数
    totalRewardTimes: 0,

    // 奖励日志列表（后端返回 + 本地加工）
    rewardLogs: [],

    // 奖励统计 & 文案
    rewardStats: {
      total: 0,
      fromInviteBind: 0,
      fromCampD1: 0,
      fromCampFinish: 0,
      fromOther: 0
    },
    rewardSummaryText: ''
  },

  onShow() {
    // [MOD-OPENID-20251230] initPage 改为 async；这里直接触发即可
    this.initPage();
  },

  /**
   * 整体初始化流程：
   * 1）确保有 clientId(openid)
   * 2）调用 /api/fission/init，保证后端有 fission_user
   * 3）获取 profile（邀请码、累计奖励次数等）
   * 4）获取 reward-log，生成统计信息 + 展示文案
   */
  async initPage() {
    this.setData({ loading: true });

    // [MOD-OPENID-20251230] 用 openid 作为 clientId
    let clientId = '';
    try {
      clientId = await clientIdUtil.ensureClientId();
    } catch (e) {
      console.error('[fissionTask] ensureClientId(openid) failed:', e);
      wx.showToast({
        title: '登录态获取失败，请稍后重试',
        icon: 'none',
        duration: 2000
      });
      this.setData({ loading: false });
      return;
    }

    // 同步到 globalData，便于其他页面复用
    try {
      if (app && app.globalData) app.globalData.clientId = clientId;
    } catch (e) {}

    console.log('[fissionTask] clientId(openid)=', clientId);

    this.setData({
      clientId,
      loading: true
    });

    this.initFissionUser(clientId, () => {
      this.fetchProfile(clientId, () => {
        this.fetchRewardLog(clientId);
      });
    });
  },

  /**
   * 调用 /api/fission/init，确保后端有这条 fission_user 记录
   */
  initFissionUser(clientId, cb) {
    wx.request({
      url: `${API_BASE}/api/fission/init`, // ✅ 使用生产环境的 API 地址
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        clientId
      },
      timeout: 10000, // 设置请求超时为 10 秒
      success: res => {
        console.log('[fissionTask] fission init result:', res.data);
      },
      fail: err => {
        console.error('[fissionTask] fission init failed:', err);
        wx.showToast({
          title: '网络错误，请稍后再试',
          icon: 'none'
        });
      },
      complete: () => {
        typeof cb === 'function' && cb();
      }
    });
  },

  /**
   * 获取自己的裂变信息（邀请码、绑定关系、累计奖励次数）
   */
  fetchProfile(clientId, cb) {
    wx.request({
      url: `${API_BASE}/api/fission/profile`, // ✅ 使用生产环境的 API 地址
      method: 'GET',
      data: {
        clientId
      },
      timeout: 10000, // 设置请求超时为 10 秒
      success: res => {
        console.log('[fissionTask] profile:', res.data);

        // [MOD-20260212-PROFILE-COMPAT] 兼容后端返回：{ ok, user } 或 { ok, profile, total_reward_times }
        const data = res.data || {};
        if (!data.ok) {
          return;
        }

        const u = data.user || data.profile;
        if (!u) {
          return;
        }

        // 兼容字段：inviteCode / invite_code
        const myInviteCode = (u.inviteCode || u.invite_code || '').toString();
        // 兼容字段：invitedByCode / invited_by_code
        const invitedByCode = (u.invitedByCode || u.invited_by_code || '').toString();
        const hasBoundInviter = !!invitedByCode;

        // 兼容 totalRewardTimes / total_reward_times（优先用顶层 total_reward_times，其次 profile 内）
        const totalRewardTimes = Number(
          data.total_reward_times ||
          data.totalRewardTimes ||
          u.totalRewardTimes ||
          u.total_reward_times ||
          0
        );

        this.setData({
          myInviteCode,
          hasBoundInviter,
          invitedByCode,
          totalRewardTimes
        });

        // 把邀请码信息写入本地缓存，训练营页会读取
        try {
          wx.setStorageSync(
            FISSION_MY_INVITE_KEY,
            (myInviteCode || '').toUpperCase()
          );
          wx.setStorageSync(
            FISSION_INVITED_BY_KEY,
            (invitedByCode || '').toUpperCase()
          );
        } catch (e) {
          console.error(
            '[fissionTask] save invite info to storage error',
            e
          );
        }

        // [MOD-20260212-UR-SYNC] 同步“累计奖励次数”到本地 userRights.freeCalcTimes（增量同步，不覆盖已消耗）
        // 同时兼容 membership 字段（不影响你原逻辑）
        const membershipName =
          (u.membershipName || u.membership_level || u.membershipLevel || 'FREE')
            .toString();

        this.syncRewardsToUserRights(totalRewardTimes, membershipName);

        // 尝试用 pendingInviteCode / globalData 邀请码自动填入绑定框
        this.prefillInviteCode(hasBoundInviter, myInviteCode);
      },
      fail: err => {
        console.error('[fissionTask] profile failed:', err);
        wx.showToast({
          title: '网络错误，请稍后再试',
          icon: 'none'
        });
      },
      complete: () => {
        typeof cb === 'function' && cb();
      }
    });
  },

  /**
   * 根据后端 total_reward_times，把“可用完整方案次数”同步到本地 userRights
   * - userRights.freeCalcTimes       当前小程序本地记录的剩余完整方案次数
   * - userRights.fissionSyncedTimes  上次已经同步过的“累计奖励次数”（兼容旧字段）
   * - userRights.serverTotalRewardTimes 上次同步的服务器累计奖励次数（新字段）
   */
  syncRewardsToUserRights(totalRewardTimes, membershipName) {
    try {
      const userRights = wx.getStorageSync('userRights') || {};

      // [MOD-20260212-UR-SYNC] 优先使用 serverTotalRewardTimes，其次兼容旧字段 fissionSyncedTimes
      const alreadySynced = Number(
        userRights.serverTotalRewardTimes || userRights.fissionSyncedTimes || 0
      );
      const oldFreeTimes = Number(userRights.freeCalcTimes || 0);

      // 写入 membershipName（不改变你原结构；用于前端显示“当前权益：FREE/会员”等）
      if (membershipName) {
        userRights.membershipName = membershipName;
      }

      if (!totalRewardTimes || totalRewardTimes <= alreadySynced) {
        console.log('[fissionTask] syncRewardsToUserRights 无新增奖励', {
          totalRewardTimes,
          alreadySynced,
          delta: 0,
          newFreeTimes: oldFreeTimes
        });

        // [MOD-20260212-UR-SYNC] 仍然把 serverTotalRewardTimes 固化下来（避免首次为 0 的边界）
        if (totalRewardTimes && totalRewardTimes > 0) {
          userRights.serverTotalRewardTimes = totalRewardTimes;
          userRights.fissionSyncedTimes = totalRewardTimes; // 兼容
          wx.setStorageSync('userRights', userRights);
        }
        return;
      }

      const delta = totalRewardTimes - alreadySynced;

      // 增量加到本地剩余次数，不会覆盖你本地已消耗的次数
      const newFreeTimes = oldFreeTimes + delta;

      userRights.freeCalcTimes = newFreeTimes;
      userRights.serverTotalRewardTimes = totalRewardTimes; // 新字段
      userRights.fissionSyncedTimes = totalRewardTimes;     // 兼容旧字段
      wx.setStorageSync('userRights', userRights);

      console.log('[fissionTask] syncRewardsToUserRights', {
        totalRewardTimes,
        alreadySynced,
        delta,
        newFreeTimes
      });

      wx.showToast({
        title: `裂变奖励到账：新增完整方案 ${delta} 次`,
        icon: 'none',
        duration: 2000
      });
    } catch (e) {
      console.error('[fissionTask] syncRewardsToUserRights error', e);
    }
  },

  /**
   * 从 pendingInviteCode / globalData 中，自动填充绑定邀请码输入框
   */
  prefillInviteCode(hasBoundInviter, myInviteCode) {
    try {
      // 已经绑定过邀请人，就不需要 pending 了，顺便清理
      if (hasBoundInviter) {
        wx.removeStorageSync(PENDING_INVITE_KEY);
        return;
      }

      // 1）本地 pendingInviteCode
      const fromStorage =
        (wx.getStorageSync(PENDING_INVITE_KEY) || '')
          .toUpperCase()
          .trim();

      // 2）全局 inviteCode（有些入口可能先写在 globalData 里）
      const appInstance = getApp && getApp();
      const fromGlobal =
        (appInstance &&
          appInstance.globalData &&
          appInstance.globalData.inviteCode) ||
        '';
      const fromGlobalUpper = fromGlobal.toUpperCase().trim();

      // 优先用本地 pending，其次 global
      let code = fromStorage || fromGlobalUpper;
      if (!code) return;

      // 防止填成自己的邀请码
      if (myInviteCode && code === String(myInviteCode).toUpperCase()) {
        return;
      }

      // 把 code 写入输入框
      this.setData({
        bindInviteCodeInput: code
      });

      console.log('[fissionTask] prefillInviteCode 使用 code =', code);
    } catch (e) {
      console.error('[fissionTask] prefillInviteCode error', e);
    }
  },

  /**
   * 获取奖励日志，并生成统计信息 + 展示文案
   */
  fetchRewardLog(clientId) {
    wx.request({
      url: `${API_BASE}/api/fission/reward-log`, // ✅ 使用生产环境的 API 地址
      method: 'GET',
      data: {
        clientId
      },
      timeout: 10000, // 设置请求超时为 10 秒
      success: res => {
        console.log('[fissionTask] reward-log:', res.data);

        if (!res.data || !res.data.ok) {
          const emptyStats = this.buildRewardStats([]);
          this.setData({
            rewardLogs: [],
            rewardStats: emptyStats,
            rewardSummaryText: this.buildRewardSummary(emptyStats),
            loading: false
          });
          return;
        }

        // [MOD-20260212-REWARDLOG-COMPAT] 兼容后端返回：{ ok, logs } 或 { ok, list }
        const rawLogs = res.data.logs || res.data.list || [];

        // 给每条日志加上标题 & 日期，方便 WXML 显示
        const enhancedLogs = rawLogs.map(row => {
          const title = this.mapEventTypeToTitle(row.event_type);
          const dateStr = row.created_at
            ? String(row.created_at).slice(5, 16)
            : '';
          return {
            ...row,
            _title: title,
            _date: dateStr
          };
        });

        let stats = this.buildRewardStats(enhancedLogs);

        // 以 profile 里的 totalRewardTimes 为准，防止日志截断
        const totalFromProfile = Number(this.data.totalRewardTimes || 0);
        if (totalFromProfile && totalFromProfile > stats.total) {
          stats.total = totalFromProfile;
        }

        const summaryText = this.buildRewardSummary(stats);

        this.setData({
          rewardLogs: enhancedLogs,
          rewardStats: stats,
          rewardSummaryText: summaryText,
          loading: false
        });
      },
      fail: err => {
        console.error('[fissionTask] reward-log failed:', err);
        this.setData({
          loading: false
        });
      }
    });
  },

  /**
   * 把 event_type 映射成一行友好的标题
   */
  mapEventTypeToTitle(eventType) {
    switch (eventType) {
      case 'INVITE_BIND':
        return '好友成功绑定你的邀请码';
      case 'CAMP_D1':
        return '好友完成 D1 风控打卡';
      case 'CAMP_FINISH':
        return '好友完成 7 天训练营';
      default:
        return '裂变奖励';
    }
  },

  /**
   * 根据日志列表，统计各类型奖励次数
   */
  buildRewardStats(logs) {
    const stats = {
      total: 0,
      fromInviteBind: 0,
      fromCampD1: 0,
      fromCampFinish: 0,
      fromOther: 0
    };

    (logs || []).forEach(log => {
      const times = Number(log.reward_times || 0);
      if (!times) return;

      stats.total += times;

      switch (log.event_type) {
        case 'INVITE_BIND':
          stats.fromInviteBind += times;
          break;
        case 'CAMP_D1':
          stats.fromCampD1 += times;
          break;
        case 'CAMP_FINISH':
          stats.fromCampFinish += times;
          break;
        default:
          stats.fromOther += times;
          break;
      }
    });

    return stats;
  },

  /**
   * 根据统计结果，拼出顶部一句话总结文案
   */
  buildRewardSummary(stats) {
    if (!stats || !stats.total) {
      return '暂时还没有获得裂变奖励，可以先邀请 1 位好友体验 7 天风控训练营。';
    }

    const parts = [];

    if (stats.fromCampD1) {
      parts.push(`好友完成 D1 奖励 ${stats.fromCampD1} 次`);
    }
    if (stats.fromCampFinish) {
      parts.push(`好友完成 7 天训练营奖励 ${stats.fromCampFinish} 次`);
    }
    if (stats.fromInviteBind) {
      parts.push(`填写邀请码绑定奖励 ${stats.fromInviteBind} 次`);
    }
    if (stats.fromOther) {
      parts.push(`其他奖励 ${stats.fromOther} 次`);
    }

    const detail = parts.join('，');

    return `累计获得完整风控方案 ${stats.total} 次（${detail}）。`;
  },

  // -------------------- 交互：复制邀请码 & 绑定邀请码 --------------------
  // 输入框
  onInputBindCode(e) {
    const value = (e.detail.value || '').toUpperCase().trim();
    this.setData({
      bindInviteCodeInput: value
    });
  },

  // 复制自己的邀请码
  onCopyMyInviteCode() {
    const code = this.data.myInviteCode;
    if (!code) {
      wx.showToast({
        title: '邀请码暂未生成',
        icon: 'none'
      });
      return;
    }

    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({
          title: '邀请码已复制',
          icon: 'success',
          duration: 1200
        });
      }
    });
  },

  // 绑定好友的邀请码：确保使用 openid
  async onBindInviteCode() {
    if (this.data.hasBoundInviter) {
      wx.showToast({
        title: '已绑定邀请人',
        icon: 'none'
      });
      return;
    }

    const inviteCode = (this.data.bindInviteCodeInput || '')
      .toUpperCase()
      .trim();
    if (!inviteCode) {
      wx.showToast({
        title: '请先填写好友的邀请码',
        icon: 'none'
      });
      return;
    }

    let clientId = this.data.clientId;

    // 若 data 里没有（极少数），再确保一次
    if (!clientId) {
      try {
        clientId = await clientIdUtil.ensureClientId();
        this.setData({ clientId });
      } catch (e) {
        wx.showToast({
          title: '登录态获取失败，请重试',
          icon: 'none'
        });
        return;
      }
    }

    wx.request({
      url: `${API_BASE}/api/fission/bind`,  // ✅ 使用生产环境的 API 地址
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        clientId,
        inviteCode
      },
      success: res => {
        console.log('[fissionTask] bind result:', res.data);

        const data = res.data || {};
        if (!data.ok) {
          wx.showToast({
            title: data.message || '绑定失败',
            icon: 'none'
          });
          return;
        }

        // 绑定成功后，清理 pendingInviteCode，避免下次再带出来
        wx.removeStorageSync(PENDING_INVITE_KEY);

        // 同步“已绑定的邀请码”到本地缓存，训练营页可以读取
        try {
          wx.setStorageSync(
            FISSION_INVITED_BY_KEY,
            inviteCode.toUpperCase()
          );
        } catch (e) {
          console.error(
            '[fissionTask] save invitedByCode after bind error',
            e
          );
        }

        wx.showToast({
          title: '绑定成功',
          icon: 'success',
          duration: 1500
        });

        // 重新拉取一次 profile + reward-log
        this.initPage();
      },
      fail: err => {
        console.error('[fissionTask] bind request failed:', err);
        wx.showToast({
          title: '网络错误，请稍后再试',
          icon: 'none'
        });
      }
    });
  },

  // -------------------- 跳转：使用风控计算器 / 返回首页 --------------------
  goUseCalc() {
    console.log('[fissionTask] 立即使用风控计算器按钮被点击');
    wx.navigateTo({
      url: '/pages/riskCalculator/index',
      success: () => {
        console.log(
          '[fissionTask] 跳转到 /pages/riskCalculator/index 成功'
        );
      }
    });
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  },

  /**
   * 顶部右上角“转发”时，自动带上我的邀请码
   */
  onShareAppMessage() {
    let code = (this.data.myInviteCode || '').toUpperCase();
    if (!code) {
      try {
        code = (
          wx.getStorageSync(FISSION_MY_INVITE_KEY) || ''
        )
          .toUpperCase()
          .trim();
      } catch (e) {
        console.error(
          '[fissionTask] read myInviteCode from storage error',
          e
        );
      }
    }

    const path = code
      ? `/pages/campIntro/index?inviteCode=${code}`
      : '/pages/campIntro/index';

    return {
      title: '7 天风控训练营｜先控亏，再谈收益',
      path
    };
  }
});
