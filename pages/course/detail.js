// pages/course/detail.js
// 课程详情页：展示课程信息 + 加入我的课程进度
const funnel = require('../../utils/funnel.js');
const { getCourseTypeMeta } = require('../../utils/courseType.js');

const app = getApp();
const API_BASE =
  (app &&
    app.globalData &&
    (app.globalData.API_BASE || app.globalData.apiBase)) ||
  'http://localhost:3000';

// 和其它模块统一的 clientId 生成规则
function ensureClientId() {
  let cid = wx.getStorageSync('clientId');
  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    wx.setStorageSync('clientId', cid);
    console.log('[course/detail] new clientId generated:', cid);
  } else {
    console.log('[course/detail] use existing clientId:', cid);
  }
  return cid;
}

/**
 * 将后端原始类型映射为「控局 5 大课」统一枚举
 * PUBLIC / EXPERIENCE / RISK / SALON / CONTROLLER
 */
function normalizeCourseType(rawType) {
  const t = (rawType || '').toLowerCase();

  if (t === 'promo' || t === 'public' || t === 'open') return 'PUBLIC';
  if (t === 'lead' || t === 'experience' || t === 'trial') return 'EXPERIENCE';
  if (t === 'risk' || t === 'calc' || t === 'system') return 'RISK';
  if (t === 'salon' || t === 'offline') return 'SALON';
  if (t === 'paid' || t === 'controller' || t === 'pro') return 'CONTROLLER';

  return '';
}

/**
 * 针对 5 大课类型，给出“控局路径中的位置”说明
 */
function buildPathMeta(typeKey) {
  const key = (typeKey || '').toUpperCase();

  if (key === 'PUBLIC') {
    return {
      title: '第 1 步：公开课 / 认知破冰',
      desc:
        '通过公开课快速建立对「熵盾风控体系」的整体认知，判断自己是否适合继续深入学习。',
      next:
        '建议完成 1–2 场公开课后，正式加入「7 天风控训练营」，开始有节奏地练习。'
    };
  }

  if (key === 'EXPERIENCE') {
    return {
      title: '第 2 步：体验课 / 账户体检',
      desc:
        '结合你的真实交易记录做一次系统的账户体检，看清亏损结构和典型错误模式。',
      next:
        '建议在体验课后，用「风控计算器」给至少 1 个标的跑出完整方案，并配合 7 天训练营执行。'
    };
  }

  if (key === 'RISK') {
    return {
      title: '第 3 步：风控课 / 盈利系统搭建',
      desc:
        '围绕止损、仓位、盈亏结构，搭建属于你的盈利系统雏形，把风控规则真正落在数字上。',
      next:
        '建议在风控课后，结合训练营打卡，将规则固化到「每一笔下单前后的固定动作」。'
    };
  }

  if (key === 'SALON') {
    return {
      title: '第 4 步：线下沙龙 / 深度诊断',
      desc:
        '在线下场景中，结合账户流水做更细致的一对一诊断，同时建立更稳定的信任关系。',
      next:
        '建议完成线下沙龙后，与顾问一起评估是否进入「控局者系统课」与更高阶的实战训练。'
    };
  }

  if (key === 'CONTROLLER') {
    return {
      title: '第 5 步：成为控局者 / 系统课',
      desc:
        '系统完成从「会亏钱」到「有系统」的升级，成为能自驱执行风控规则的控局者。',
      next:
        '建议同步使用「风控计算器」+「7 天训练营」+「实盘记录」，用 3–6 个月把系统练到肌肉记忆。'
    };
  }

  // 默认兜底文案
  return {
    title: '控局路径：风控训练 → 盈利系统 → 控局者',
    desc:
      '每一门课都在帮你从「随机出手」走向「有章可循」的交易方式，请按顾问建议合理排布节奏。',
    next:
      '建议先完成一轮「7 天风控训练营」，再按当前阶段选择合适的课程组合。'
  };
}

// 状态文案
function statusText(status) {
  if (status === 'draft') return '待发布';
  if (status === 'published') return '报名中';
  if (status === 'closed') return '已结束';
  return '进行中';
}

// 时间范围文案
function buildTimeText(startTime, endTime) {
  if (!startTime && !endTime) return '时间待定';
  if (!startTime) return `结束时间：${endTime}`;
  if (!endTime) return `开始时间：${startTime}`;

  try {
    const s = startTime.replace('T', ' ');
    const e = endTime.replace('T', ' ');
    const datePart = s.slice(5, 10); // MM-DD
    const sTime = s.slice(11, 16);
    const eTime = e.slice(11, 16);
    return `${datePart} ${sTime} - ${eTime}`;
  } catch (e) {
    return `${startTime} ~ ${endTime}`;
  }
}

Page({
  data: {
    loading: false,
    errorMsg: '',
    courseId: null,
    course: null // 标准化后的课程对象
  },

  onLoad(options) {
    const id = Number(options.id || 0);
    const clientId = ensureClientId();
    this.clientId = clientId;

    console.log('[course/detail] onLoad options:', options, 'id =', id);

    if (!Number.isFinite(id) || id <= 0) {
      this.setData({
        errorMsg: '课程 ID 无效'
      });
      return;
    }

    this.setData({ courseId: id });

    funnel.log('COURSE_DETAIL_VIEW', {
      from: options.from || 'courses',
      courseId: id
    });

    this.fetchDetail(id);
  },

  // 拉取课程详情
  fetchDetail(id) {
    console.log('[course/detail] fetchDetail id =', id);

    this.setData({
      loading: true,
      errorMsg: '',
      course: null
    });

    wx.request({
      url: `${API_BASE}/api/courses/detail/${id}`,
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

        // 原始课程类型值
        const rawType =
          raw.type || raw.courseType || raw.course_type || '';

        // 归一到控局 5 大课类型
        const typeKey = normalizeCourseType(rawType);
        const typeMeta = getCourseTypeMeta(typeKey);
        const pathMeta = buildPathMeta(typeKey);

        const course = {
          id: raw.id,
          title: raw.title || '未命名课程',

          // 课程类型（统一映射后的字段）
          typeCode: typeKey,
          courseTypeText:
            (typeMeta && (typeMeta.shortTag || typeMeta.name)) || '课程',
          courseTypeClass: (typeMeta && typeMeta.tagClass) || '',

          description: raw.description || raw.description_text || '',
          startTime,
          endTime,
          timeText: buildTimeText(startTime, endTime),
          price: priceNum,
          priceText: priceNum > 0 ? `¥${priceNum}` : '免费',
          status: raw.status || 'draft',
          statusText: statusText(raw.status || 'draft'),

          // 目前先简单写死展示文案，后面可以从后台字段扩展
          modeText: '线上 / 线下结合',
          targetText: '适合所有认真对待资金安全的交易者',

          // 控局路径相关文案（供 detail.wxml 使用）
          pathStageTitle: pathMeta.title,
          pathStageDesc: pathMeta.desc,
          pathNextStep: pathMeta.next
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
      }
    });
  },

  // 加入我的课程进度（报名）
  onJoinCourse() {
    const { course } = this.data;
    if (!course) return;

    const clientId = this.clientId || ensureClientId();

    console.log('[course/detail] onJoinCourse tap, course =', course);

    wx.showLoading({
      title: '正在加入…',
      mask: true
    });

    wx.request({
      url: `${API_BASE}/api/courses/progress/update`,
      method: 'POST',
      data: {
        clientId,
        courseId: course.id,
        progressPercent: 0,
        status: 'in_progress',
        lastLesson: ''
      },
      success: (res) => {
        const data = res.data || {};
        console.log('[course/detail] join resp:', data);

        if (!data.ok) {
          wx.showToast({
            title: data.message || '报名失败',
            icon: 'none'
          });
          return;
        }

        funnel.log('COURSE_JOIN', {
          courseId: course.id,
          from: 'detail'
        });

        wx.showModal({
          title: '已加入课程进度',
          content:
            '你可以在「我的课程进度」页面持续查看与更新本课的完成情况。',
          confirmText: '去查看进度',
          cancelText: '留在本页',
          success: (r) => {
            if (r.confirm) {
              wx.navigateTo({
                url: '/pages/course/progress'
              });
            }
          }
        });
      },
      fail: () => {
        wx.showToast({
          title: '网络异常，稍后重试',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 底部次按钮：直接跳转我的课程进度
  goProgress() {
    wx.navigateTo({
      url: '/pages/course/progress'
    });
  }
});
