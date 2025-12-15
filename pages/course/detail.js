// pages/course/detail.js
// 课程详情页：展示课程信息 + 加入我的课程进度
const funnel = require('../../utils/funnel.js');
const { getCourseTypeMeta } = require('../../utils/courseType.js');

function ensureClientId() {
  const app = getApp && getApp();
  let cid =
    (app && app.globalData && app.globalData.clientId) ||
    wx.getStorageSync('clientId');

  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    wx.getStorageSync('clientId', cid);
    wx.setStorageSync('clientId', cid);
    if (app && app.globalData) app.globalData.clientId = cid;
    console.log('[course/detail] new clientId generated:', cid);
  } else {
    if (app && app.globalData) app.globalData.clientId = cid;
    console.log('[course/detail] use existing clientId:', cid);
  }
  return cid;
}

function getBaseUrl() {
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
}

// [P0-FINAL] iOS 兼容时间解析：支持 MySQL "YYYY-MM-DD HH:mm:ss"
function parseDT(v) {
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
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function weekdayCN(d) {
  const map = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return map[d.getDay()] || '';
}

function fmtMDW(d) {
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${weekdayCN(d)}`;
}

function fmtHM(d) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function statusText(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'draft') return '待发布';
  if (s === 'published') return '报名中';
  if (s === 'closed' || s === 'ended') return '已结束';
  if (s === 'finished') return '已完成';
  return '进行中';
}

function statusClass(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'draft') return 'status-draft';
  if (s === 'published') return 'status-published';
  if (s === 'closed' || s === 'ended') return 'status-closed';
  if (s === 'finished') return 'status-finished';
  return 'status-default';
}

function buildTimeText(startRaw, endRaw) {
  const sd = parseDT(startRaw);
  const ed = parseDT(endRaw);
  if (!sd && !ed) return '时间待定';
  if (sd && !ed) return `${fmtMDW(sd)} ${fmtHM(sd)}（结束时间待定）`;
  if (!sd && ed) return `开始时间待定（结束：${fmtMDW(ed)} ${fmtHM(ed)}）`;
  return `${fmtMDW(sd)} ${fmtHM(sd)} - ${fmtHM(ed)}`;
}

function computeJoinable(statusRaw) {
  const s = String(statusRaw || '').toLowerCase();
  if (s === 'draft') return { canJoin: false, reason: '待发布' };
  if (s === 'closed' || s === 'ended') return { canJoin: false, reason: '已结束' };
  if (s === 'finished') return { canJoin: false, reason: '已完成' };
  return { canJoin: true, reason: '' };
}

/** [P1-ENT-20251215] 读取用户权益/会员信息（不存在也不报错） */
function getUserEntitlement() {
  const userRights = wx.getStorageSync('userRights') || {};
  const membershipName =
    userRights.membershipName ||
    wx.getStorageSync('membershipName') ||
    '';
  const isMember = !!membershipName;

  // 可选：若你未来加“课程权益次数”，这里直接兼容
  const freeCourseTimes = Number(
    userRights.freeCourseTimes ||
      userRights.freeJoinTimes ||
      0
  );

  // 我的邀请码（用于分享）
  const myInviteCode =
    wx.getStorageSync('inviteCode') ||
    userRights.inviteCode ||
    wx.getStorageSync('myInviteCode') ||
    '';

  return { userRights, membershipName, isMember, freeCourseTimes, myInviteCode };
}

/** [P1-ENT-20251215] 判断课程是否需要权益/付费（优先读后端字段，否则用 price>0 兜底） */
function computeRequireEntitlement(rawCourse, computedPrice) {
  const raw = rawCourse || {};
  const candidates = [
    raw.requireEntitlement,
    raw.requiresEntitlement,
    raw.requires_membership,
    raw.need_membership,
    raw.needMembership,
    raw.isPaid,
    raw.paid
  ];

  for (let i = 0; i < candidates.length; i++) {
    const v = candidates[i];
    if (v === true) return true;
    if (v === false) return false;
    if (v === 1) return true;
    if (v === 0) return false;
    if (typeof v === 'string') {
      const s = v.toLowerCase();
      if (s === 'true' || s === 'yes' || s === 'paid') return true;
      if (s === 'false' || s === 'no' || s === 'free') return false;
    }
  }

  // 兜底：价格大于 0 视为需要权益/付费
  return Number(computedPrice || 0) > 0;
}

/** [P1-SHARE-20251215] 处理分享进来的 inviteCode（作为“邀请人邀请码”存到 pendingInviteCode） */
function handleIncomingInviteCode(inviteCode) {
  const code = String(inviteCode || '').trim();
  if (!code) return;

  const { myInviteCode } = getUserEntitlement();
  // 避免自己分享给自己时覆盖
  if (myInviteCode && code === myInviteCode) return;

  wx.setStorageSync('pendingInviteCode', code);
}

Page({
  data: {
    loading: false,
    errorMsg: '',
    courseId: null,
    course: null,

    joining: false,
    joined: false,

    // [P1-ENT-20251215] 用于 UI/埋点展示（可选）
    membershipName: ''
  },

  onLoad(options) {
    // [P1-SHARE-20251215] 允许分享
    try {
      wx.showShareMenu({ withShareTicket: false });
    } catch (e) {}

    // [P1-SHARE-20251215] 处理分享参数 inviteCode
    if (options && options.inviteCode) {
      handleIncomingInviteCode(options.inviteCode);
    }

    const id = Number(options.id || 0);
    const clientId = ensureClientId();
    this.clientId = clientId;

    console.log('[course/detail] onLoad options:', options, 'id =', id);

    if (!Number.isFinite(id) || id <= 0) {
      this.setData({ errorMsg: '课程 ID 无效' });
      return;
    }

    // [P1-ENT-20251215] 读取会员名用于展示/埋点
    const ent = getUserEntitlement();
    this.setData({ membershipName: ent.membershipName || '' });

    this.setData({ courseId: id });

    funnel.log('COURSE_DETAIL_VIEW', {
      from: options.from || 'courses',
      courseId: id
    });

    const joinedMap = wx.getStorageSync('courseJoinedMap') || {};
    const joined = !!joinedMap[id];
    this.setData({ joined });

    this.fetchDetail(id);
  },

  onPullDownRefresh() {
    const id = this.data.courseId;
    if (id) this.fetchDetail(id, true);
  },

  onRetryDetail() {
    const id = this.data.courseId;
    if (id) this.fetchDetail(id, false);
  },

  fetchDetail(id, isPullDown = false) {
    const baseUrl = getBaseUrl();

    console.log('[course/detail] fetchDetail id =', id, 'baseUrl=', baseUrl);

    this.setData({
      loading: true,
      errorMsg: '',
      course: null
    });

    wx.request({
      url: `${baseUrl}/api/courses/detail/${id}`,
      method: 'GET',
      success: (res) => {
        const data = res.data || {};
        console.log('[course/detail] detail resp:', data);

        if (!data.ok || !data.course) {
          this.setData({
            loading: false,
            errorMsg: data.message || '课程不存在'
          });
          return;
        }

        const raw = data.course;

        const startTime = raw.startTime || raw.start_time || '';
        const endTime = raw.endTime || raw.end_time || '';
        const priceNum = Number(raw.price || 0);

        const rawType =
          raw.type ||
          raw.courseType ||
          raw.course_type ||
          raw.category ||
          '';

        const typeMeta = getCourseTypeMeta(rawType);

        const stText = statusText(raw.status || 'draft');
        const stClass = statusClass(raw.status || 'draft');

        const joinable = computeJoinable(raw.status || '');

        // [P1-ENT-20251215] 计算是否需要权益/付费
        const requireEntitlement = computeRequireEntitlement(raw, priceNum);

        const course = {
          id: raw.id,
          title: raw.title || '未命名课程',

          typeCode: typeMeta.key,
          courseTypeText: typeMeta.text,
          courseTypeClass: typeMeta.cssClass,

          description: raw.description || raw.description_text || '',
          startTime,
          endTime,
          timeText: buildTimeText(startTime, endTime),
          price: priceNum,
          priceText: priceNum > 0 ? `¥${priceNum}` : '免费',

          status: raw.status || 'draft',
          statusText: stText,
          statusClass: stClass,

          // CTA 可用性（状态层面）
          canJoin: joinable.canJoin,
          joinDisabledText: joinable.canJoin ? '' : `当前不可报名（${joinable.reason}）`,

          // [P1-ENT-20251215] 权益层面
          requireEntitlement,

          modeText:
            raw.modeText ||
            (typeMeta.key === 'SALON'
              ? '线下 · 沙龙 / 来访'
              : '线上 / 线下结合'),

          targetText:
            raw.targetText ||
            (typeMeta.key === 'PUBLIC'
              ? '适合第一次接触熵盾、想先建立正确风险观的控局者。'
              : typeMeta.key === 'EXPERIENCE'
              ? '适合已经有实操记录，愿意做一次账户体检与体验的控局者。'
              : typeMeta.key === 'CAMP'
              ? '适合希望用 7 天把“止损、仓位、复盘”固化为习惯的控局者。'
              : typeMeta.key === 'RISK'
              ? '适合想系统搭建风控框架，并长期执行的人。'
              : typeMeta.key === 'CONTROLLER'
              ? '适合希望进入长期控局体系、持续放大资金的控局者候选。'
              : '适合所有认真对待资金安全的控局者。'),

          pathStageTitle: typeMeta.pathStageTitle,
          pathStageDesc: typeMeta.pathStageDesc,
          pathNextStep: typeMeta.pathNextStep
        };

        this.setData({
          loading: false,
          course
        });
      },
      fail: (err) => {
        console.error('[course/detail] request fail:', err);
        this.setData({
          loading: false,
          errorMsg: '网络异常，请稍后重试'
        });
      },
      complete: () => {
        if (isPullDown) wx.stopPullDownRefresh();
      }
    });
  },

  onSalonBooking() {
    const { course } = this.data;
    if (!course) return;

    if (!course.canJoin && String(course.status || '').toLowerCase() === 'draft') {
      wx.showToast({ title: '该课程尚未发布', icon: 'none' });
      return;
    }

    wx.navigateTo({
      url: `/pages/visitBooking/index?from=courseDetail&courseId=${course.id}`
    });
  },

  /** [P1-ENT-20251215] 未满足权益时，引导去会员/付费页（尽量兼容你现有页面） */
  goEntitlementGuide(course) {
    const ent = getUserEntitlement();

    funnel.log('COURSE_JOIN_BLOCKED', {
      courseId: course.id,
      typeCode: course.typeCode,
      price: course.price || 0,
      membershipName: ent.membershipName || '',
      reason: 'requireEntitlement'
    });

    wx.showModal({
      title: '需要权益',
      content:
        `该课程需要权益后才可加入。\n` +
        (course.price > 0 ? `价格：${course.priceText}\n` : '') +
        `建议：开通会员或通过活动获得对应权益。`,
      confirmText: '去开通',
      cancelText: '我知道了',
      success: (r) => {
        if (!r.confirm) return;

        // 优先跳会员页（如存在）
        wx.navigateTo({
          url: `/pages/membership/index?from=courseDetail&courseId=${course.id}`
        });
      },
      fail: () => {}
    });
  },

  onJoinCourse() {
    const { course, joining, joined } = this.data;
    if (!course) return;

    // 已加入：直接去进度页
    if (joining || joined) {
      wx.navigateTo({ url: '/pages/course/progress' });
      return;
    }

    // 不可报名：提示
    if (!course.canJoin) {
      wx.showToast({ title: course.joinDisabledText || '当前不可报名', icon: 'none' });
      return;
    }

    // [P1-ENT-20251215] 权益拦截：需要权益且当前不是会员（也没有 freeCourseTimes）
    if (course.requireEntitlement) {
      const ent = getUserEntitlement();
      const allowByEnt = ent.isMember || ent.freeCourseTimes > 0;
      if (!allowByEnt) {
        this.goEntitlementGuide(course);
        return;
      }
    }

    const baseUrl = getBaseUrl();
    const clientId = this.clientId || ensureClientId();

    console.log('[course/detail] onJoinCourse tap, course =', course, 'baseUrl=', baseUrl);

    this.setData({ joining: true });

    wx.showLoading({ title: '正在加入…', mask: true });

    wx.request({
      url: `${baseUrl}/api/courses/progress/update`,
      method: 'POST',
      data: {
        clientId,
        courseId: course.id,
        progressPercent: 0,
        status: 'in_progress',
        lastLesson: ''
      },
      success: (res) => {
        wx.hideLoading();

        const data = res.data || {};
        console.log('[course/detail] join resp:', data);

        if (!data.ok) {
          this.setData({ joining: false });
          wx.showToast({ title: data.message || '报名失败', icon: 'none' });
          return;
        }

        const mode = data.mode || 'insert';

        const joinedMap = wx.getStorageSync('courseJoinedMap') || {};
        joinedMap[course.id] = true;
        wx.setStorageSync('courseJoinedMap', joinedMap);

        this.setData({ joining: false, joined: true });

        funnel.log('COURSE_JOIN', {
          courseId: course.id,
          from: 'detail',
          mode
        });

        wx.showToast({ title: '已加入课程进度', icon: 'success', duration: 1500 });

        if (mode === 'insert') {
          setTimeout(() => {
            wx.showModal({
              title: '已加入课程进度',
              content: '你可以在「控局者 → 我的课程进度」持续查看与更新本课完成情况。',
              confirmText: '去查看进度',
              cancelText: '留在本页',
              success: (r) => {
                if (r.confirm) {
                  wx.navigateTo({ url: '/pages/course/progress' });
                }
              }
            });
          }, 400);
        }
      },
      fail: () => {
        wx.hideLoading();
        this.setData({ joining: false });
        wx.showToast({ title: '网络异常，稍后重试', icon: 'none' });
      }
    });
  },

  goProgress() {
    wx.navigateTo({ url: '/pages/course/progress' });
  },

  /** [P1-SHARE-20251215] 分享：携带 courseId + 我的 inviteCode */
  onShareAppMessage() {
    const { courseId, course } = this.data;
    const ent = getUserEntitlement();
    const inviteCode = ent.myInviteCode || '';

    const title = (course && course.title) ? course.title : '熵盾控局课程';
    const path =
      `/pages/course/detail?id=${courseId || ''}` +
      `&from=share` +
      (inviteCode ? `&inviteCode=${inviteCode}` : '');

    funnel.log('COURSE_SHARE', {
      courseId: courseId || '',
      inviteCode: inviteCode ? 'Y' : 'N'
    });

    return { title, path };
  }
});
