// pages/fissionTask/index.js

// [PATCH-B1] 引入 userRights
const userRights = require('../../utils/userRights');

// [ADD] 规范化邀请码
function normInviteCode(v) {
  return String(v || '').trim().toUpperCase();
}

// [ADD] 获取 API_BASE（你 Storage 里已有 API_BASE/apiBaseUrl）
function getApiBase() {
  return wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '';
}

// [ADD] POST /api/fission/bind（最小实现：直接 wx.request）
// 说明：这里用 Storage 里的 API_BASE，确保走你 app.js 强制写入的线上域名
function postBindInvite({ clientId, inviteCode }) {
  return new Promise((resolve, reject) => {
    const base = getApiBase();
    wx.request({
      url: `${base}/api/fission/bind`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { clientId, inviteCode },
      success: (res) => resolve(res.data || {}),
      fail: reject
    });
  });
}

// [CHANGE] unify userRights writes
const { mergeUserRights } = require('../../utils/userRights')

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


// [PATCH-FISSIONTASK-FINAL-20260224] global helpers: reward sync + modal gating + api base
function __es_getApiBase() {
  try {
    return wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') ||
      ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '');
  } catch(e) { return ''; }
}

function __es_syncRewards(total, clientId, ctx) {
  try {
    var RIGHTS_KEY = 'userRights';
    var cid = clientId || (ctx && ctx.data && ctx.data.clientId) || wx.getStorageSync('clientId') || '';
    var SYNC_KEY = 'fission_total_reward_times_synced_' + cid;

    // 兼容旧 key（不再用，但用于迁移）
    var legacy = Number(wx.getStorageSync('fission_total_reward_times_synced') || 0) || 0;

    var rights = wx.getStorageSync(RIGHTS_KEY) || {};
    var cur = Number(rights.freeCalcTimes || 0) || 0;
    var last = Number(wx.getStorageSync(SYNC_KEY) || 0) || 0;
    if (!last && legacy) last = legacy;

    var t = Number(total || 0) || 0;
    var delta = Math.max(t - last, 0);

    if (delta > 0) {
      rights.freeCalcTimes = cur + delta;
      if (!rights.membershipName) rights.membershipName = 'FREE';
      wx.setStorageSync(RIGHTS_KEY, rights);
    }
    wx.setStorageSync(SYNC_KEY, t);
    try { wx.removeStorageSync('fission_total_reward_times_synced'); } catch(e) {}

    try {
      ctx && ctx.setData && ctx.setData({
        userRights: rights,
        freeCalcTimes: Number(rights.freeCalcTimes||0)||0,
        membershipName: rights.membershipName || ''
      });
    } catch(e) {}

    return { delta: delta, after: Number(rights.freeCalcTimes||0)||0, total: t, last: last, syncKey: SYNC_KEY };
  } catch(e) {
    return { delta: 0, after: 0, total: Number(total||0)||0, last: 0, syncKey: '' };
  }
}

// 兼容你之前散落的调用（彻底不再报 ReferenceError）


// [PATCH-SYNCREWARDS2-GLOBAL] stable global syncRewards2 (no ctx needed)
function syncRewards2(total, clientId) {
  try {
    var RIGHTS_KEY = 'userRights';
    var cid = String(clientId || wx.getStorageSync('clientId') || '').trim();
    var SYNC_KEY = 'fission_total_reward_times_synced_' + cid;
    var rights = wx.getStorageSync(RIGHTS_KEY) || {};
    var cur = Number(rights.freeCalcTimes || 0) || 0;
    var last = Number(wx.getStorageSync(SYNC_KEY) || 0) || 0;
    var t = Number(total || 0) || 0;
    var delta = Math.max(t - last, 0);

    if (delta > 0) {
      rights.freeCalcTimes = cur + delta;
      if (!rights.membershipName) rights.membershipName = 'FREE';
      wx.setStorageSync(RIGHTS_KEY, rights);
    }
    wx.setStorageSync(SYNC_KEY, t);

    return { delta: delta, after: Number(rights.freeCalcTimes||0)||0, total: t, last: last, syncKey: SYNC_KEY };
  } catch(e) {
    return { delta: 0, after: 0, total: Number(total||0)||0, last: 0, syncKey: '' };
  }
}

Page({
  data: {
    loading: true,

    // [MOD-OPENID-20251230] 当前用户唯一 ID：openid（由 /api/wx/login 换取）
    clientId: '',

    // 我的专属邀请码
    myInviteCode: '',


    // [ADD-QR] 我的专属二维码（临时文件路径）
    myQrPath: '',
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

  // [ADD] 支持从分享/二维码入口带 inviteCode（app.js 已写 pending，这里再兜底一次）
  onLoad(options) {
    try {
      if (options && options.inviteCode) {
        wx.setStorageSync(PENDING_INVITE_KEY, normInviteCode(options.inviteCode));
      }
    } catch (e) {}
  
    // [FINAL-INJECT-CALL] ensure invite+qr
    try {
      this.__finalEnsureFission && this.__finalEnsureFission();
    } catch (e) {}
  },

  onShow() {
    console.log('[PATCH-FISSIONTASK-FINAL-20260224] onShow start');
    var self = this;
    try { self.setData && self.setData({ loading: true }); } catch(e) {}
    
    var apiBase = __es_getApiBase();
    if (!apiBase) {
      console.warn('[PATCH-FISSIONTASK-FINAL-20260224] API_BASE empty');
      try { self.setData && self.setData({ loading: false }); } catch(e) {}
      return;
    }
    
    var __initedOnce = false;
    
    function __showRewardModalOnce(r, cid) {
      try {
        if (!r || !r.delta || r.delta <= 0) return;
        var key = 'fission_reward_modal_total_' + cid;
        var shown = Number(wx.getStorageSync(key) || 0) || 0;
        if (shown >= r.total) return;
        wx.setStorageSync(key, r.total);
        wx.showModal({ title: '邀请奖励已到账', content: '本次 +' + r.delta + ' 次完整方案\n当前剩余：' + r.after + ' 次', showCancel: false });
      } catch(e) {}
    }
    
    function __afterProfile(cid, data) {
      var d = data || {};
      var p = d.profile || d.user || {};
      var total = Number(
        d.total_reward_times ?? d.totalRewardTimes ??
        p.total_reward_times ?? p.totalRewardTimes ?? p.totalRewardTimes ?? 0
      ) || 0;
    
      // inviteCode 兼容字段
      var invite =
        p.inviteCode || p.invite_code ||
        d.inviteCode || d.invite_code ||
        wx.getStorageSync('fissionMyInviteCode') || '';
    
      if (invite) {
        try { wx.setStorageSync('fissionMyInviteCode', invite); } catch(e) {}
        try { self.setData && self.setData({ myInviteCode: invite, inviteCode: invite, fissionMyInviteCode: invite }); } catch(e) {}
      }
    
      var r = __es_syncRewards(total, cid, self);
      __showRewardModalOnce(r, cid);
    
      // 没 invite 就 init 一次再拉
      if (!invite && !__initedOnce) {
        __initedOnce = true;
        wx.request({
          url: apiBase + '/api/fission/init',
          method: 'POST',
          data: { clientId: cid },
          success: function() {
            __fetchProfile(cid);
          },
          fail: function(e) {
            console.warn('[PATCH-FISSIONTASK-FINAL-20260224] init fail', e);
            try { self.setData && self.setData({ loading: false }); } catch(e2) {}
          }
        });
        return;
      }
    
      try {
        if (typeof self.refreshMyQr === 'function') self.refreshMyQr();
      } catch(e) {}
    
      try { self.setData && self.setData({ loading: false }); } catch(e) {}
    }
    
    function __fetchProfile(cid) {
      try { self.setData && self.setData({ clientId: cid }); } catch(e) {}
      wx.request({
        url: apiBase + '/api/fission/profile?_t=' + Date.now(),
        method: 'GET',
        data: { clientId: cid },
        success: function(res) {
          __afterProfile(cid, (res && res.data) || {});
        },
        fail: function(e) {
          console.error('[PATCH-FISSIONTASK-FINAL-20260224] profile fail', e);
          try { self.setData && self.setData({ loading: false }); } catch(e2) {}
        }
      });
    }
    
    var cid = '';
    try { cid = wx.getStorageSync('clientId') || ''; } catch(e) {}
    if (cid) {
      __fetchProfile(cid);
      return;
    }
    
    console.log('[PATCH-FISSIONTASK-FINAL-20260224] no clientId -> wx.login');
    wx.login({
      success: function(r) {
        if (!r || !r.code) {
          console.warn('[PATCH-FISSIONTASK-FINAL-20260224] wx.login no code');
          try { self.setData && self.setData({ loading: false }); } catch(e2) {}
          return;
        }
        wx.request({
          url: apiBase + '/api/wx/login',
          method: 'POST',
          data: { code: r.code },
          success: function(res) {
            var d = (res && res.data) || {};
            var openid = d.openid || d.clientId || (d.data && (d.data.openid || d.data.clientId)) || '';
            if (!openid) {
              console.warn('[PATCH-FISSIONTASK-FINAL-20260224] /api/wx/login openid empty');
              try { self.setData && self.setData({ loading: false }); } catch(e3) {}
              return;
            }
            try { wx.setStorageSync('clientId', openid); } catch(e4) {}
            __fetchProfile(openid);
          },
          fail: function(e) {
            console.error('[PATCH-FISSIONTASK-FINAL-20260224] /api/wx/login fail', e);
            try { self.setData && self.setData({ loading: false }); } catch(e2) {}
          }
        });
      },
      fail: function(e) {
        console.error('[PATCH-FISSIONTASK-FINAL-20260224] wx.login fail', e);
        try { self.setData && self.setData({ loading: false }); } catch(e2) {}
      }
    });
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
        /*[ADD-QR]CALL_REFRESH*/
        if (myInviteCode) { this.refreshMyQr(myInviteCode); }

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

        // [ADD] profile 就绪后自动绑定（闭环：无需手输/无需点绑定）
        this.autoBindPendingInvite(hasBoundInviter, myInviteCode);
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
          mergeUserRights(userRights); // [CHANGE] unify write
        }
        return;
      }

      const delta = totalRewardTimes - alreadySynced;

      // 增量加到本地剩余次数，不会覆盖你本地已消耗的次数
      const newFreeTimes = oldFreeTimes + delta;

      userRights.freeCalcTimes = newFreeTimes;
      userRights.serverTotalRewardTimes = totalRewardTimes; // 新字段
      userRights.fissionSyncedTimes = totalRewardTimes;     // 兼容旧字段
      mergeUserRights(userRights); // [CHANGE] unify write

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

  // [ADD] 自动绑定 pendingInviteCode（无需手输/无需点绑定按钮）
  async autoBindPendingInvite(hasBoundInviter, myInviteCode) {
    // 防止并发重复触发
    if (this._autoBinding) return;

    try {
      // 已绑定就不需要 pending 了
      if (hasBoundInviter) {
        wx.removeStorageSync(PENDING_INVITE_KEY);
        return;
      }

      const pending = normInviteCode(wx.getStorageSync(PENDING_INVITE_KEY));
      if (!pending) return;

      // 已经写过邀请人（本地）也不再绑
      const already = normInviteCode(wx.getStorageSync(FISSION_INVITED_BY_KEY));
      if (already) {
        wx.removeStorageSync(PENDING_INVITE_KEY);
        return;
      }

      // 防自邀：pending == myInviteCode
      const myCode = normInviteCode(
        myInviteCode ||
        this.data.myInviteCode ||
        wx.getStorageSync(FISSION_MY_INVITE_KEY)
      );
      if (myCode && pending === myCode) {
        wx.removeStorageSync(PENDING_INVITE_KEY);
        return;
      }

      const clientId = this.data.clientId || (app && app.globalData && app.globalData.clientId) || '';
      if (!clientId) return;

      this._autoBinding = true;

      const resp = await postBindInvite({ clientId, inviteCode: pending });
      console.log('[fissionTask] autoBind resp:', resp);

      // 兼容后端幂等返回（如果你后端加了 already_bound）
      if (resp && (resp.ok || resp.message === 'already_bound')) {
        try {
          wx.setStorageSync(FISSION_INVITED_BY_KEY, pending);
        } catch (e) {}

        wx.removeStorageSync(PENDING_INVITE_KEY);

        wx.showToast({ title: '自动绑定成功', icon: 'success', duration: 1200 });

        // 绑定后刷新 profile/reward-log（让“谁邀请了你”立即可见）
        this.initPage();
      } else {
        // 无效邀请码：清 pending，避免每次进来都弹
        wx.removeStorageSync(PENDING_INVITE_KEY);
        wx.showToast({ title: resp?.message || '自动绑定失败', icon: 'none', duration: 1500 });
      }
    } catch (e) {
      console.error('[fissionTask] autoBind error:', e);
      wx.showToast({ title: '自动绑定请求失败', icon: 'none', duration: 1500 });
      // 网络异常：不清 pending，允许下次重试
    } finally {
      this._autoBinding = false;
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
  // [ADD-QR] 拉取并展示我的专属二维码（后端返回 image/jpeg 或 image/png 都可）
  refreshMyQr(forceCode) {
    // [PATCH-REFRESHMYQR-FINAL] robust QR generation: apiBase from Storage, invite from multiple sources, single-flight
    var self = this;
    if (self.__qrInFlight) return;
    self.__qrInFlight = true;
    
    try { self.setData && self.setData({ loading: true }); } catch(e) {}
    
    var apiBase = wx.getStorageSync('API_BASE') || wx.getStorageSync('apiBaseUrl') || '';
    var rights = wx.getStorageSync('userRights') || {};
    var invite =
      (self.data && (self.data.myInviteCode || self.data.inviteCode || self.data.fissionMyInviteCode)) ||
      wx.getStorageSync('fissionMyInviteCode') ||
      rights.inviteCode || rights.invite_code || '';
    
    invite = String(invite || '').trim();
    
    if (!apiBase || !invite) {
      console.warn('[QRCODE] missing apiBase/invite', { apiBase: apiBase, invite: invite });
      try { self.setData && self.setData({ loading: false }); } catch(e) {}
      self.__qrInFlight = false;
      return;
    }
    
    var url = apiBase + '/api/fission/qrcode?inviteCode=' + encodeURIComponent(invite) + '&t=' + Date.now();
    
    wx.downloadFile({
      url: url,
      success: function(r) {
        if (r && r.statusCode === 200 && r.tempFilePath) {
          try { self.setData && self.setData({ myQrPath: r.tempFilePath, loading: false }); } catch(e) {}
          console.log('[QRCODE] OK', r.statusCode, r.tempFilePath);
        } else {
          console.warn('[QRCODE] bad', r && r.statusCode, r);
          try { self.setData && self.setData({ loading: false }); } catch(e) {}
        }
      },
      fail: function(e) {
        console.error('[QRCODE] download fail', e);
        try { self.setData && self.setData({ loading: false }); } catch(e2) {}
      },
      complete: function() {
        self.__qrInFlight = false;
      }
    });
  },

  // [ADD-QR] 点击二维码预览
  onPreviewQr() {
    const p = this.data.myQrPath;
    if (!p) return;
    wx.previewImage({ urls: [p] });
  },
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

    // [CHANGE] P0：落裂变任务页，进入即自动绑定（闭环最短、验收最快）
    // 说明：用户不需要手输邀请码；后续做二维码时，scene 也会携带同一个 code
    const path = code
      ? `/pages/fissionTask/index?inviteCode=${encodeURIComponent(code)}`
      : '/pages/fissionTask/index';

    return {
      title: '7 天风控训练营｜先控亏，再谈收益',
      path
    };
  }
,
  onShow() {
    // [PATCH-20260223-B1] 权益实时刷新：onShow 拉取 /api/fission/profile 并增量同步 freeCalcTimes\n    try {\n      const apiBase =\n        wx.getStorageSync('API_BASE') ||\n        wx.getStorageSync('apiBaseUrl') ||\n        ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '');\n      const clientId = wx.getStorageSync('clientId');\n      if (apiBase && clientId) {\n        wx.request({\n          url: `${apiBase}/api/fission/profile`,\n          method: 'GET',\n          data: { clientId },\n          success: (res) => {\n            const d = res && res.data;\n            if (!d || !d.ok) return;\n            const total = Number((d.total_reward_times ?? (d.profile && d.profile.total_reward_times) ?? 0)) || 0;\n    \n            const rights = wx.getStorageSync('userRights') || {};\n            const currentFree = Number(rights.freeCalcTimes || 0) || 0;\n            let lastSynced = Number(wx.getStorageSync('fission_total_reward_times_synced') || 0) || 0;\n    \n            // 初始化：如果之前已有 freeCalcTimes，但没记录 lastSynced，则直接对齐到服务端，避免重复加\n            if (lastSynced === 0 && currentFree > 0) {\n              wx.setStorageSync('fission_total_reward_times_synced', total);\n              lastSynced = total;\n            }\n    \n            const delta = total - lastSynced;\n            if (delta > 0) {\n              rights.freeCalcTimes = currentFree + delta;\n              if (!rights.membershipName) rights.membershipName = 'FREE';\n              wx.setStorageSync('userRights', rights);\n              wx.setStorageSync('fission_total_reward_times_synced', total);\n            }\n    \n            // 无论是否新增，都刷新一下 UI（不影响你现有骨架）\n            if (this && this.setData) {\n              this.setData({\n                userRights: rights,\n                freeCalcTimes: Number(rights.freeCalcTimes || 0) || currentFree,\n                membershipName: rights.membershipName || ''\n              });\n            }\n          }\n        });\n      }\n    } catch (e) {}
  
    // [FINAL-INJECT-CALL] ensure invite+qr
    try {
      this.__finalEnsureFission && this.__finalEnsureFission();
    } catch (e) {}
  }
,

  // ==============================
  // [PATCH-20260223-B2] fissionTask 权益短轮询（15s）
  // ==============================
  startRightsAutoSync() {
    if (this._rightsTimer) return;
    this._rightsTimer = setInterval(() => {
      try {
        const apiBase =
          wx.getStorageSync('API_BASE') ||
          wx.getStorageSync('apiBaseUrl') ||
          ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '');
        const clientId = wx.getStorageSync('clientId');
        if (!apiBase || !clientId) return;

        wx.request({
          url: `${apiBase}/api/fission/profile`,
          method: 'GET',
          data: { clientId },
          success: (res) => {
            const d = res && res.data;
            if (!d || !d.ok) return;

            const total = Number((d.total_reward_times ?? (d.profile && d.profile.total_reward_times) ?? 0)) || 0;

            const RIGHTS_KEY = 'userRights';
            const SYNC_KEY = 'fission_total_reward_times_synced';

            const rights = wx.getStorageSync(RIGHTS_KEY) || {};
            const currentFree = Number(rights.freeCalcTimes || 0) || 0;
            let lastSynced = Number(wx.getStorageSync(SYNC_KEY) || 0) || 0;

            // 初始化对齐：避免重复加
    // [PATCH-STAGEB-SYNC-FIX] removed: do NOT swallow first delta when user already has freeCalcTimes
const delta = total - lastSynced;
            if (delta > 0) {
              rights.freeCalcTimes = currentFree + delta;
              if (!rights.membershipName) rights.membershipName = 'FREE';
              wx.setStorageSync(RIGHTS_KEY, rights);
              wx.setStorageSync(SYNC_KEY, total);
            }

            // 无论是否新增，都刷新 UI
            if (this && this.setData) {
              this.setData({
                userRights: rights,
                freeCalcTimes: Number(rights.freeCalcTimes || 0) || currentFree,
                membershipName: rights.membershipName || ''
              });
            }
          }
        });
      } catch (e) {}
    }, 15000);
  },

  stopRightsAutoSync() {
    if (this._rightsTimer) {
      clearInterval(this._rightsTimer);
      this._rightsTimer = null;
    }
  },

  // [PATCH-20260223-B2] stop onHide
  onHide() {
    this.stopRightsAutoSync && this.stopRightsAutoSync();
  },

  // [PATCH-20260223-B2] stop onUnload
  onUnload() {
    this.stopRightsAutoSync && this.stopRightsAutoSync();
  },
  // [FINAL-ENSURE-FISSION] auto ensure openid/profile/invite/qr
  __finalEnsureFission() {
    if (this.__finalEnsuring) return;
    this.__finalEnsuring = true;

    const self = this;
    try { self.setData && self.setData({ loading: true }); } catch (e) {}

    const apiBase =
      wx.getStorageSync('API_BASE') ||
      wx.getStorageSync('apiBaseUrl') ||
      ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '');

    const finish = () => {
      self.__finalEnsuring = false;
      try { self.setData && self.setData({ loading: false }); } catch (e) {}
    };

    if (!apiBase) {
      console.log('[FINAL] API_BASE empty');
      return finish();
    }

    const setInvite = (inv) => {
      if (!inv) return;
      wx.setStorageSync('fissionMyInviteCode', inv);
      try {
        self.setData && self.setData({
          myInviteCode: inv,
          inviteCode: inv,
          fissionMyInviteCode: inv
        });
      } catch (e) {}
    };

    const genQr = () => {
      try {
        if (typeof self.refreshMyQr === 'function') self.refreshMyQr();
      } catch (e) {}

      // 2 秒内看见 myQrPath 就收口 loading
      let t = 0;
      const timer = setInterval(() => {
        t++;
        try {
          if (self.data && self.data.myQrPath) {
            clearInterval(timer);
            finish();
          }
        } catch (e) {}
        if (t >= 10) {
          clearInterval(timer);
          finish();
        }
      }, 200);
    };

    const fetchProfile = (clientId, cb) => {
      wx.request({
        url: `${apiBase}/api/fission/profile`,
        method: 'GET',
        data: { clientId },
        success: (res) => cb && cb(null, res && res.data),
        fail: (err) => cb && cb(err)
      });
    };

    const initFission = (clientId, cb) => {
      wx.request({
        url: `${apiBase}/api/fission/init`,
        method: 'POST',
        data: { clientId },
        success: (res) => cb && cb(null, res && res.data),
        fail: (err) => cb && cb(err)
      });
    };

    const ensureProfile = (clientId) => {
      console.log('[FINAL] ensure clientId=', clientId);
      try { self.setData && self.setData({ clientId }); } catch (e) {}

      fetchProfile(clientId, (err, d) => {
        if (err) {
          console.log('[FINAL] profile fail', err);
          return finish();
        }
        const data = d || {};
        const p = data.profile || {};

        const inv =
          p.inviteCode || p.invite_code || p.myInviteCode || p.my_invite_code ||
          data.inviteCode || data.invite_code ||
          wx.getStorageSync('fissionMyInviteCode') || '';

        if ((!data.profile && !data.user) || !inv) { // [PATCH-STAGEB-SYNC-FIX]
          console.log('[FINAL] missing invite -> init then refetch');
          initFission(clientId, () => {
            fetchProfile(clientId, (_e2, d2) => {
              const data2 = d2 || {};
              const p2 = data2.profile || {};
              const inv2 =
                p2.inviteCode || p2.invite_code || p2.myInviteCode || p2.my_invite_code ||
                data2.inviteCode || data2.invite_code ||
                inv || wx.getStorageSync('fissionMyInviteCode') || '';
              setInvite(inv2);
              genQr();
            });
          });
          return;
        }

        setInvite(inv);
        genQr();
      });
    };

    const cid = wx.getStorageSync('clientId');
    if (cid) return ensureProfile(cid);

    console.log('[FINAL] no clientId -> wx.login');
    wx.login({
      success: (r) => {
        if (!r || !r.code) {
          console.log('[FINAL] wx.login no code');
          return finish();
        }
        wx.request({
          url: `${apiBase}/api/wx/login`,
          method: 'POST',
          data: { code: r.code },
          success: (res) => {
            const d = (res && res.data) || {};
            const openid = d.openid || d.clientId || (d.data && (d.data.openid || d.data.clientId)) || '';
            console.log('[FINAL] /api/wx/login openid=', openid ? 'OK' : 'EMPTY');
            if (!openid) return finish();
            wx.setStorageSync('clientId', openid);
            ensureProfile(openid);
          },
          fail: (e) => {
            console.log('[FINAL] /api/wx/login fail', e);
            finish();
          }
        });
      },
      fail: (e) => {
        console.log('[FINAL] wx.login fail', e);
        finish();
      }
    });
  },

// [CLEAN-FISSIONTASK-FINAL-BEGIN]
  // 说明：本块是 fissionTask 的“唯一生效入口”，后续只维护这里即可。
  //      onShow/onHide/onUnload 统一收口；确保 openid→profile→invite→qr 自动完成。

  __finalEnsureFission() {
    if (this.__finalEnsuring) return;
    this.__finalEnsuring = true;

    const self = this;

    const apiBase =
      wx.getStorageSync('API_BASE') ||
      wx.getStorageSync('apiBaseUrl') ||
      ((getApp && getApp().globalData && getApp().globalData.API_BASE) || '');

    const finish = () => {
      self.__finalEnsuring = false;
      try { self.setData && self.setData({ loading: false }); } catch (e) {}
    };

    if (!apiBase) return finish();

    try { self.setData && self.setData({ loading: true }); } catch (e) {}

    const setInvite = (inv) => {
      if (!inv) return;
      wx.setStorageSync('fissionMyInviteCode', inv);
      try {
        self.setData && self.setData({
          myInviteCode: inv,
          inviteCode: inv,
          fissionMyInviteCode: inv
        });
      } catch (e) {}
    };

    const syncRewards = (total) => {
      try {
        const RIGHTS_KEY = 'userRights';
        const SYNC_KEY = 'fission_total_reward_times_synced';
        const rights = wx.getStorageSync(RIGHTS_KEY) || {};
        const currentFree = Number(rights.freeCalcTimes || 0) || 0;
        let lastSynced = Number(wx.getStorageSync(SYNC_KEY) || 0) || 0;

        // 初始化对齐：避免重复加
    // [PATCH-STAGEB-SYNC-FIX] removed: do NOT swallow first delta when user already has freeCalcTimes
const delta = total - lastSynced;
        if (delta > 0) {
          rights.freeCalcTimes = currentFree + delta;
          if (!rights.membershipName) rights.membershipName = 'FREE';
          wx.setStorageSync(RIGHTS_KEY, rights);
          wx.setStorageSync(SYNC_KEY, total);
        }

        try {
          self.setData && self.setData({
            userRights: rights,
            freeCalcTimes: Number(rights.freeCalcTimes || 0) || currentFree,
            membershipName: rights.membershipName || ''
          });
        } catch (e) {}
      } catch (e) {}
    };

    const genQr = () => {
      try {
        if (typeof self.refreshMyQr === 'function') self.refreshMyQr();
      } catch (e) {}

      // 2 秒内看到 myQrPath 就收口；否则超时也收口
      let t = 0;
      const timer = setInterval(() => {
        t++;
        try {
          if (self.data && self.data.myQrPath) {
            clearInterval(timer);
            finish();
          }
        } catch (e) {}
        if (t >= 10) {
          clearInterval(timer);
          finish();
        }
      }, 200);
    };

    const fetchProfile = (clientId, cb) => {
      wx.request({
        url: `${apiBase}/api/fission/profile`,
        method: 'GET',
        data: { clientId },
        success: (res) => cb && cb(null, res && res.data),
        fail: (err) => cb && cb(err)
      });
    };

    const initFission = (clientId, cb) => {
      wx.request({
        url: `${apiBase}/api/fission/init`,
        method: 'POST',
        data: { clientId },
        success: (res) => cb && cb(null, res && res.data),
        fail: (err) => cb && cb(err)
      });
    };

    const ensureProfile = (clientId) => {
      try { self.setData && self.setData({ clientId }); } catch (e) {}

      fetchProfile(clientId, (err, d) => {
        if (err) return finish();

        const data = d || {};
        const p = data.profile || {};

        const total = Number((data.total_reward_times ?? p.total_reward_times ?? 0)) || 0;
        syncRewards(total);

        const inv =
          p.inviteCode || p.invite_code || p.myInviteCode || p.my_invite_code ||
          data.inviteCode || data.invite_code ||
          wx.getStorageSync('fissionMyInviteCode') || '';

        if ((!data.profile && !data.user) || !inv) { // [PATCH-STAGEB-SYNC-FIX]
          initFission(clientId, () => {
            fetchProfile(clientId, (_e2, d2) => {
              const data2 = d2 || {};
              const p2 = data2.profile || {};
              const total2 = Number((data2.total_reward_times ?? p2.total_reward_times ?? total)) || total;
              syncRewards(total2);

              const inv2 =
                p2.inviteCode || p2.invite_code || p2.myInviteCode || p2.my_invite_code ||
                data2.inviteCode || data2.invite_code ||
                inv || wx.getStorageSync('fissionMyInviteCode') || '';

              setInvite(inv2);
              genQr();
            });
          });
          return;
        }

        setInvite(inv);
        genQr();
      });
    };

    const cid = wx.getStorageSync('clientId');
    if (cid) return ensureProfile(cid);

    wx.login({
      success: (r) => {
        if (!r || !r.code) return finish();
        wx.request({
          url: `${apiBase}/api/wx/login`,
          method: 'POST',
          data: { code: r.code },
          success: (res) => {
            const d = (res && res.data) || {};
            const openid = d.openid || d.clientId || (d.data && (d.data.openid || d.data.clientId)) || '';
            if (!openid) return finish();
            wx.setStorageSync('clientId', openid);
            ensureProfile(openid);
          },
          fail: () => finish()
        });
      },
      fail: () => finish()
    });
  },

  // 唯一生效入口：每次进入页都确保邀请码+二维码+权益同步
  onShow() {
    try { if (typeof this.startRightsAutoSync === 'function') this.startRightsAutoSync(); } catch (e) {}
    try { this.__finalEnsureFission && this.__finalEnsureFission(); } catch (e) {}
  },

  onHide() {
    try { this.stopRightsAutoSync && this.stopRightsAutoSync(); } catch (e) {}
  },

  onUnload() {
    try { this.stopRightsAutoSync && this.stopRightsAutoSync(); } catch (e) {}
  },
// [CLEAN-FISSIONTASK-FINAL-END]

});