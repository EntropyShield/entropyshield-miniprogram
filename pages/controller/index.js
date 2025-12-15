// pages/controller/index.js
const funnel = require('../../utils/funnel.js');
const { getCourseTypeMeta } = require('../../utils/courseType.js'); // 统一类型口径

// [P1-SHARE-20251215] 安全开启分享菜单
function safeShowShareMenu() {
  try {
    wx.showShareMenu({ withShareTicket: false });
  } catch (e) {}
}

// [P1-SHARE-20251215] 获取我的邀请码（兼容多处存储）
function getMyInviteCode() {
  const userRights = wx.getStorageSync('userRights') || {};
  const code =
    wx.getStorageSync('inviteCode') ||
    wx.getStorageSync('myInviteCode') ||
    userRights.inviteCode ||
    '';
  return String(code || '').trim();
}

// [P1-SHARE-20251215] 保存邀请人邀请码到 pendingInviteCode（避免覆盖自己的邀请码）
function savePendingInviteCode(inCode) {
  const code = String(inCode || '').trim();
  if (!code) return;

  const my = getMyInviteCode();
  if (my && code === my) return;

  wx.setStorageSync('pendingInviteCode', code);
}

Page({
  data: {
    finishedDays: 0,
    stageText: '训练待开始',
    nextStepText: '',

    campSummary: {
      finishedDays: 0,
      rewardRounds: 0
    },

    bLoading: false,
    bErrorText: '',
    fixedEntries: [],
    baseUrl: ''
  },

  // [P1-SHARE-20251215] 接收分享参数
  onLoad(options) {
    safeShowShareMenu();

    if (options && options.inviteCode) {
      savePendingInviteCode(options.inviteCode);
    }
  },

  onShow() {
    funnel.log('CONTROLLER_VIEW', { ts: Date.now() });

    // [P1-SHARE-20251215] tabBar 页也确保开启分享
    safeShowShareMenu();

    this.refreshCampSummary();
    this.loadFixedEntries();
  },

  refreshCampSummary() {
    try {
      const finishedMap = wx.getStorageSync('campFinishedMap') || {};
      const finishedDays = Object.keys(finishedMap).length;

      const userRights = wx.getStorageSync('userRights') || {};
      const rewardRounds = Number(userRights.campRewardCount || 0);

      const hasPaidCourse = !!wx.getStorageSync('hasPaidCourse');

      let stageText = '';
      let nextStepText = '';

      if (hasPaidCourse) {
        stageText = '控局者进阶中';
        nextStepText = '建议结合线下沙龙或一对一账户体检，为你的盈利系统做年度体检。';
      } else if (finishedDays >= 7) {
        stageText = '已完成一轮训练营';
        nextStepText = '建议进入风控系统课/进阶课，把训练营体验升级成完整盈利系统。';
      } else if (finishedDays > 0) {
        stageText = '训练进行中';
        nextStepText = '优先打完本轮 7 天训练营，再考虑体验课或账户体检课。';
      } else {
        stageText = '训练待开始';
        nextStepText = '建议先用风控计算器跑 1 套方案，然后从 D1 开始 7 天风控训练营。';
      }

      this.setData({
        finishedDays,
        stageText,
        nextStepText,
        campSummary: { finishedDays, rewardRounds }
      });
    } catch (e) {
      console.error('[controller] refreshCampSummary error', e);
    }
  },

  goCamp() {
    wx.navigateTo({ url: '/pages/campIntro/index' });
  },

  goCampIntro() {
    this.goCamp();
  },

  // [P1-ROUTE-FINAL-FIX-20251215]
  // 修正课程日历跳转优先级：优先跳真实存在的 /pages/course/index，失败再兜底 /pages/courses/index
  // 目的：消除你控制台里“page not found”的失败日志
  goToCourseList() {
    console.log('[controller] goToCourseList tap');

    wx.navigateTo({
      url: '/pages/course/index?from=controller',
      success() {
        console.log('[controller] navigateTo /pages/course/index success');
      },
      fail(err1) {
        console.warn('[controller] /pages/course/index fail, fallback to /pages/courses/index', err1);

        wx.navigateTo({
          url: '/pages/courses/index?from=controller',
          success() {
            console.log('[controller] fallback navigateTo /pages/courses/index success');
          },
          fail(err2) {
            console.error('[controller] fallback navigateTo /pages/courses/index fail:', err2);
            wx.showToast({ title: '暂时无法打开控局日历', icon: 'none' });
          }
        });
      }
    });
  },

  goCourseProgress() {
    wx.navigateTo({ url: '/pages/course/progress' });
  },

  goCalc() {
    wx.navigateTo({ url: '/pages/riskCalculator/index' });
  },

  // =========================
  // B 区：固定入口（口径与课程日历一致）
  // =========================

  getBaseUrl() {
    const app = getApp && getApp();
    const base =
      (app &&
        app.globalData &&
        (app.globalData.API_BASE ||
          app.globalData.apiBase ||
          app.globalData.baseUrl ||
          app.globalData.apiBaseUrl)) ||
      wx.getStorageSync('apiBaseUrl') ||
      wx.getStorageSync('apiBase') ||
      'http://localhost:3000';
    return String(base).replace(/\/$/, '');
  },

  requestJson(url, method = 'GET', data) {
    return new Promise((resolve, reject) => {
      wx.request({
        url,
        method,
        data,
        header: { 'content-type': 'application/json' },
        success: (res) => resolve(res.data),
        fail: (err) => reject(err)
      });
    });
  },

  extractCourseList(payload) {
    const pickArr = (v) => (Array.isArray(v) ? v : null);
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];

    let list =
      pickArr(payload.courses) ||
      pickArr(payload.list) ||
      pickArr(payload.rows) ||
      pickArr(payload.items);
    if (list) return list;

    const d1 = payload.data;
    if (d1 && typeof d1 === 'object') {
      list =
        pickArr(d1.courses) ||
        pickArr(d1.list) ||
        pickArr(d1.rows) ||
        pickArr(d1.items);
      if (list) return list;

      const d2 = d1.data;
      if (d2 && typeof d2 === 'object') {
        list =
          pickArr(d2.courses) ||
          pickArr(d2.list) ||
          pickArr(d2.rows) ||
          pickArr(d2.items);
        if (list) return list;
      }
    }
    return [];
  },

  parseDT(v) {
    if (!v) return null;
    const raw = String(v).trim();
    if (!raw) return null;

    const tries = [];
    tries.push(raw);

    if (/^\d{4}-\d{2}-\d{2}\s/.test(raw)) {
      tries.push(raw.replace(/-/g, '/'));
    }

    if (raw.indexOf('T') >= 0) {
      tries.push(raw.replace('T', ' '));
      tries.push(raw.replace('T', ' ').replace(/-/g, '/'));
    }

    for (let i = 0; i < tries.length; i++) {
      const d = new Date(tries[i]);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  },

  pad2(n) {
    return n < 10 ? `0${n}` : `${n}`;
  },

  weekdayCN(d) {
    const map = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return map[d.getDay()] || '';
  },

  fmtMDW(d) {
    return `${this.pad2(d.getMonth() + 1)}/${this.pad2(d.getDate())} ${this.weekdayCN(d)}`;
  },

  fmtHM(d) {
    return `${this.pad2(d.getHours())}:${this.pad2(d.getMinutes())}`;
  },

  getRawType(x) {
    return (x.type || x.courseType || x.course_type || x.category || '');
  },

  typeUiMetaByKey(typeKey) {
    switch (typeKey) {
      case 'PUBLIC':
        return { typeLabel: '公开课', pillClass: 'pill-promo', stepLabel: '第一站', stepClass: 'step-1' };
      case 'EXPERIENCE':
        return { typeLabel: '体验课', pillClass: 'pill-experience', stepLabel: '第二站', stepClass: 'step-2' };
      case 'CAMP':
        return { typeLabel: '训练营', pillClass: 'pill-camp', stepLabel: '训练营', stepClass: 'step-camp' };
      case 'SALON':
        return { typeLabel: '线下', pillClass: 'pill-salon', stepLabel: '线下', stepClass: 'step-salon' };
      case 'RISK':
        return { typeLabel: '风控课', pillClass: 'pill-risk', stepLabel: '风控', stepClass: 'step-risk' };
      case 'CONTROLLER':
        return { typeLabel: '进阶', pillClass: 'pill-paid', stepLabel: '进阶', stepClass: 'step-paid' };
      default:
        return { typeLabel: '课程', pillClass: 'pill-default', stepLabel: '入口', stepClass: 'step-default' };
    }
  },

  statusMeta(statusRaw, startTs, endTs) {
    const s = String(statusRaw || '').toLowerCase();
    const now = Date.now();

    if (s === 'draft') {
      return { text: '待发布', badge: 'fixed-status-upcoming', isDraft: true, isEnded: false, isLive: false };
    }
    if (s === 'closed' || s === 'finished' || s === 'ended') {
      return { text: '已结束', badge: 'fixed-status-ended', isDraft: false, isEnded: true, isLive: false };
    }

    if (!startTs || !endTs) {
      return { text: '未开始', badge: 'fixed-status-upcoming', isDraft: false, isEnded: false, isLive: false };
    }
    if (now < startTs) {
      return { text: '未开始', badge: 'fixed-status-upcoming', isDraft: false, isEnded: false, isLive: false };
    }
    if (now >= startTs && now <= endTs) {
      return { text: '进行中', badge: 'fixed-status-live', isDraft: false, isEnded: false, isLive: true };
    }
    return { text: '已结束', badge: 'fixed-status-ended', isDraft: false, isEnded: true, isLive: false };
  },

  onRetryFixed() {
    this.loadFixedEntries();
  },

  loadFixedEntries() {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/api/courses`;

    console.log('[controller] loadFixedEntries url =', url);

    this.setData({ bLoading: true, bErrorText: '', baseUrl });

    this.requestJson(url, 'GET')
      .then((payload) => {
        const list = this.extractCourseList(payload);
        console.log('[controller] extracted course list length =', list.length);

        const normalized = (list || [])
          .map((x) => {
            const rawType = this.getRawType(x);
            const typeMeta = getCourseTypeMeta(rawType);
            const ui = this.typeUiMetaByKey(typeMeta.key);

            const startRaw = x.startTime || x.start_time || '';
            const endRaw = x.endTime || x.end_time || '';
            const startD = this.parseDT(startRaw);
            const endD = this.parseDT(endRaw);
            const startTs = startD ? startD.getTime() : 0;
            const endTs = endD ? endD.getTime() : 0;

            const st = this.statusMeta(x.status, startTs, endTs);

            const timeRange =
              startD && endD
                ? `${this.fmtMDW(startD)} ${this.fmtHM(startD)} - ${this.fmtHM(endD)}`
                : '时间待定';

            const desc = x.description_text || x.description || '';

            return {
              id: x.id,
              title: x.title || '',
              typeKey: typeMeta.key,
              status: x.status || '',
              startTs,
              endTs,
              timeRange,
              statusText: st.text,
              statusBadgeClass: st.badge,
              isDraft: st.isDraft,
              isEnded: st.isEnded,
              isLive: st.isLive,
              desc,
              ...ui
            };
          })
          .filter((c) => {
            // upcoming 口径：排除 draft、排除已结束；保留“未开始/进行中/时间待定”
            if (c.isDraft) return false;
            if (c.isEnded) return false;
            return true;
          })
          .sort((a, b) => {
            const at = a.startTs || Number.MAX_SAFE_INTEGER;
            const bt = b.startTs || Number.MAX_SAFE_INTEGER;
            return at - bt;
          });

        const pickFirstByKey = (k) => normalized.find((c) => c.typeKey === k) || null;

        const promo = pickFirstByKey('PUBLIC');
        const experience = pickFirstByKey('EXPERIENCE');
        const camp = pickFirstByKey('CAMP');
        const salon = pickFirstByKey('SALON');

        console.log('[controller] fixed pick =', {
          promo: promo ? promo.id : null,
          exp: experience ? experience.id : null,
          camp: camp ? camp.id : null,
          salon: salon ? salon.id : null
        });

        const defaults = [
          {
            key: 'promo',
            fallback: {
              title: '止亏觉醒：为什么 90% 的人输在风控？（公开课）',
              timeRange: '时间待定',
              desc: '先止亏，再谈盈利。用 60 分钟搭好你的风控框架。',
              statusText: '未开始',
              statusBadgeClass: 'fixed-status-upcoming',
              id: '',
              ...this.typeUiMetaByKey('PUBLIC')
            }
          },
          {
            key: 'experience',
            fallback: {
              title: '风控计算器实战：搭建你的分批进出场护栏（体验课）',
              timeRange: '时间待定',
              desc: '一人一标的，现场跑完完整方案，把“先控亏”落地。',
              statusText: '未开始',
              statusBadgeClass: 'fixed-status-upcoming',
              id: '',
              ...this.typeUiMetaByKey('EXPERIENCE')
            }
          },
          {
            key: 'camp',
            fallback: {
              title: '7天风控训练营 · 说明会（D0）',
              timeRange: '时间待定',
              desc: '讲清打卡方式、权益发放、控局者路径，适合准备入营用户。',
              statusText: '未开始',
              statusBadgeClass: 'fixed-status-upcoming',
              id: '',
              ...this.typeUiMetaByKey('CAMP')
            }
          },
          {
            key: 'salon',
            fallback: {
              title: '控局者线下沙龙 + 账户体检（来访）',
              timeRange: '时间待定',
              desc: '小范围线下交流 + 账户体检 + 下一步路径建议。',
              statusText: '未开始',
              statusBadgeClass: 'fixed-status-upcoming',
              id: '',
              ...this.typeUiMetaByKey('SALON')
            }
          }
        ];

        const fixedEntries = defaults.map((d) => {
          let real = null;
          if (d.key === 'promo') real = promo;
          if (d.key === 'experience') real = experience;
          if (d.key === 'camp') real = camp;
          if (d.key === 'salon') real = salon;

          const use = real || d.fallback;

          const brief = String(use.desc || '').trim();
          const brief2 = brief.length > 64 ? `${brief.slice(0, 64)}...` : brief;

          return {
            key: d.key,
            id: use.id,
            title: use.title,
            timeRange: use.timeRange,
            brief: brief2,

            courseType: d.key,
            typeLabel: use.typeLabel,
            pillClass: use.pillClass,
            stepLabel: use.stepLabel,
            stepClass: use.stepClass,
            statusText: use.statusText,
            statusBadgeClass: use.statusBadgeClass || 'fixed-status-upcoming',

            // [P0-FINAL] 轻量弱化未配置入口按钮
            isFallback: !use.id
          };
        });

        this.setData({ fixedEntries, bLoading: false, bErrorText: '' });
      })
      .catch((e) => {
        console.error('[controller] loadFixedEntries error', e);
        this.setData({
          bLoading: false,
          bErrorText: '课表加载失败（请确认后端已启动）'
        });
      });
  },

  onFixedCardTap(e) {
    const id = String(e.currentTarget.dataset.id || '');
    if (!id) {
      wx.showToast({ title: '该入口尚未配置真实课程', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/course/detail?id=${id}&from=controller` });
  },

  onFixedDetailTap(e) {
    const id = String(e.currentTarget.dataset.id || '');
    if (!id) {
      wx.showToast({ title: '该入口尚未配置真实课程', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/course/detail?id=${id}&from=controller` });
  },

  onFixedBookingTap(e) {
    const id = String(e.currentTarget.dataset.id || '');
    if (!id) {
      wx.showToast({ title: '该入口尚未配置真实课程', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/visitBooking/index?from=controller&courseId=${id}` });
  },

  // [P1-SHARE-20251215] 分享控局者入口（携带 inviteCode）
  onShareAppMessage() {
    const inviteCode = getMyInviteCode();
    const path =
      `/pages/controller/index?from=share` +
      (inviteCode ? `&inviteCode=${inviteCode}` : '');

    funnel.log('CONTROLLER_SHARE', {
      inviteCode: inviteCode ? 'Y' : 'N'
    });

    return {
      title: '熵盾研究院 · 控局者训练中枢',
      path
    };
  }
});
