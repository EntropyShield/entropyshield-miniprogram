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

/**
 * 统一生成 / 读取 clientId（与其它模块保持一致）
 */
function ensureClientId() {
  const app = getApp && getApp();
  let cid =
    (app && app.globalData && app.globalData.clientId) ||
    wx.getStorageSync('clientId');

  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    wx.setStorageSync('clientId', cid);
    if (app && app.globalData) {
      app.globalData.clientId = cid;
    }
    console.log('[course/detail] new clientId generated:', cid);
  } else {
    if (app && app.globalData) {
      app.globalData.clientId = cid;
    }
    console.log('[course/detail] use existing clientId:', cid);
  }
  return cid;
}

// 状态文案
function statusText(status) {
  if (status === 'draft') return '待发布';
  if (status === 'published') return '报名中';
  if (status === 'closed') return '已结束';
  if (status === 'finished') return '已完成';
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

        // 原始类型字段（可能是 public / experience / risk / salon / controller 等）
        const rawType =
          raw.type ||
          raw.courseType ||
          raw.course_type ||
          raw.category ||
          '';

        // 统一课程类型映射
        const typeMeta = getCourseTypeMeta(rawType);

        const course = {
          id: raw.id,
          title: raw.title || '未命名课程',

          // 课程类型（统一映射后的字段）
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
          statusText: statusText(raw.status || 'draft'),

          // 授课形式 & 适合人群：可以根据类型轻微区分
          modeText:
            raw.modeText ||
            (typeMeta.key === 'SALON'
              ? '线下 · 沙龙 / 来访'
              : '线上 / 线下结合'),
          targetText:
            raw.targetText ||
            (typeMeta.key === 'PUBLIC'
              ? '适合第一次接触熵盾、想先建立正确风险观的交易者。'
              : typeMeta.key === 'EXPERIENCE'
              ? '适合已经有实盘记录，愿意拿自己的账户来做一次体检与体验的交易者。'
              : typeMeta.key === 'RISK'
              ? '适合已经意识到“风控才是第一生产力”的交易者，想系统搭建风控框架。'
              : typeMeta.key === 'CONTROLLER'
              ? '适合希望长期在市场活下去，并用一套可复制的系统放大资金的控局者候选。'
              : '适合所有认真对待资金安全的交易者。'),

          // 控局路径中的位置（来自类型元数据）
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
        wx.hideLoading();

        const data = res.data || {};
        console.log('[course/detail] join resp:', data);

        if (!data.ok) {
          wx.showToast({
            title: data.message || '报名失败',
            icon: 'none'
          });
          return;
        }

        // 从后端取出 mode：insert / update
        const mode = data.mode || 'insert';

        funnel.log('COURSE_JOIN', {
          courseId: course.id,
          from: 'detail',
          mode
        });

        // 成功提示：第一次加入 / 再次更新
        wx.showToast({
          title: mode === 'insert' ? '已加入课程进度' : '进度已更新',
          icon: 'success',
          duration: 1500
        });

        // 只有第一次加入时弹出“去查看进度”的引导弹窗
        if (mode === 'insert') {
          setTimeout(() => {
            wx.showModal({
              title: '已加入课程进度',
              content:
                '你可以在「控局者 → 我的课程进度」页面持续查看与更新本课的完成情况。',
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
          }, 400);
        }
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({
          title: '网络异常，稍后重试',
          icon: 'none'
        });
      }
      // complete 不再额外 hideLoading，避免重复调用
    });
  },

  // 底部次按钮：直接跳转我的课程进度
  goProgress() {
    wx.navigateTo({
      url: '/pages/course/progress'
    });
  }
});
