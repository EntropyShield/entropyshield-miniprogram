// pages/courses/index.js 课程日历列表页逻辑
// MOD: CLEAN_HARDCODED_API_BASE_20260103

const { getCourseTypeMeta } = require('../../utils/courseType.js');
const funnel = require('../../utils/funnel.js');

// MOD: 统一从 config.js 读取 API_BASE，彻底移除 localhost 兜底
const { API_BASE } = require('../../config');  // ✅ 从 config.js 获取 API_BASE

// 统一生成 / 读取 clientId（和训练营、裂变那套保持一致）
function ensureClientId() {
  let cid = wx.getStorageSync('clientId');
  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    wx.setStorageSync('clientId', cid);
    console.log('[courses] generate clientId:', cid);
  } else {
    console.log('[courses] use existing clientId:', cid);
  }
  return cid;
}

Page({
  data: {
    loading: false,
    errorMsg: '',

    // 原始课程列表（带个人进度）
    coursesRaw: [],

    // [{ dateKey, date, dateText, list: [...] }]
    courseGroups: [],

    // 筛选类型：upcoming / all / ended
    filterType: 'upcoming'
  },

  onLoad() {
    funnel.log('COURSE_LIST_VIEW', {});
    this.__didLoadOnce = true;
    this.loadCourses();
  },

  // 返回该页面时刷新一次（保证从详情/进度页回来能看到最新进度）
  onShow() {
    if (this.__didLoadOnce) {
      // 避免首屏 onLoad + onShow 叠加请求：只在已经加载过且非 loading 时刷新
      if (!this.data.loading) {
        this.loadCourses();
      }
    }
  },

  onPullDownRefresh() {
    this.loadCourses(() => {
      wx.stopPullDownRefresh();
    });
  },

  // WXML 绑定的是 onTapFilter，这里提供同名方法
  onTapFilter(e) {
    this.onChangeFilter(e);
  },

  // 切换筛选
  onChangeFilter(e) {
    const type = e.currentTarget.dataset.type || 'upcoming';
    this.setData(
      {
        filterType: type
      },
      () => {
        this.applyFilter();
      }
    );
  },

  // 载入课程数据——优先走带个人进度的接口 /api/courses/progress
  loadCourses(done) {
    this.setData({
      loading: true,
      errorMsg: ''
    });

    const clientId = ensureClientId();

    // MOD: API_BASE 来自 config.js
    wx.request({
      url: `${API_BASE}/api/courses/progress`,  // ✅ 使用 API_BASE 动态构造请求的 URL
      method: 'GET',
      data: { clientId },
      success: (res) => {
        const data = res.data || {};

        if (!data.ok) {
          console.warn('[courses] /api/courses/progress not ok, fallback to /api/courses:', data);
          this.fetchCoursesFallback(done);
          return;
        }

        const list = data.list || [];
        const normalized = list.map((item) => this.normalizeCourse(item));

        this.setData(
          {
            loading: false,
            coursesRaw: normalized
          },
          () => this.applyFilter()
        );

        done && done();
      },
      fail: (err) => {
        console.error('[courses] /api/courses/progress request fail, fallback:', err);
        this.fetchCoursesFallback(done);
      }
    });
  },

  // 回退：仅获取课程基础信息（不含个人进度）
  fetchCoursesFallback(done) {
    // MOD: API_BASE 来自 config.js
    wx.request({
      url: `${API_BASE}/api/courses`,  // ✅ 使用 API_BASE 动态构造请求的 URL
      method: 'GET',
      success: (res) => {
        const data = res.data || {};

        if (!data.ok) {
          this.setData({
            loading: false,
            errorMsg: data.message || '课程数据获取失败'
          });
          done && done();
          return;
        }

        // 兼容 courses 和 list 两种写法
        const list = data.courses || data.list || [];
        const normalized = list.map((item) => this.normalizeCourse(item));

        this.setData(
          {
            loading: false,
            coursesRaw: normalized
          },
          () => this.applyFilter()
        );

        done && done();
      },
      fail: () => {
        this.setData({
          loading: false,
          errorMsg: '网络异常，请稍后重试'
        });
        done && done();
      }
    });
  },

  // 标准化后端课程字段（同时兼容进度接口 & 普通列表）
  normalizeCourse(item) {
    // 日期
    const date =
      item.date ||
      (item.startTime ? item.startTime.slice(0, 10) : '') ||
      item.course_date ||
      '';

    // 时间文本
    let timeText = '';
    if (item.timeText) {
      timeText = item.timeText;
    } else if (item.start_time && item.end_time) {
      timeText = `${item.start_time} - ${item.end_time}`;
    } else if (item.startTime && item.endTime) {
      const s = item.startTime.slice(11, 16);
      const e = item.endTime.slice(11, 16);
      timeText = `${s} - ${e}`;
    }

    // 课程类型（后端多种字段兼容）
    const courseType =
      item.category ||
      item.type ||
      item.courseType ||
      item.course_type ||
      item.typeCode ||
      '';

    // 类型文案：优先用工具映射，兜底用后端字段或“课程”
    let courseTypeText = item.courseTypeText || item.course_type_text || '';
    try {
      if (typeof getCourseTypeMeta === 'function') {
        const meta = getCourseTypeMeta(courseType);
        courseTypeText =
          (meta && (meta.text || meta.label || meta.name)) ||
          courseTypeText ||
          '课程';
      }
    } catch (e) {
      courseTypeText = courseTypeText || '课程';
    }

    // 进度：优先用 progressPercent，其次 progress
    // 注意：后端可能给 0~100，也可能给 0~1，这里统一成 0~1 的 progress
    let progress = 0;
    if (typeof item.progressPercent === 'number') {
      progress = item.progressPercent;
    } else if (typeof item.progress === 'number') {
      progress = item.progress;
    }

    if (progress > 1) progress = progress / 100;
    if (progress < 0) progress = 0;
    if (progress > 1) progress = 1;

    // 状态：优先用个人进度状态 progressStatus，其次课程状态 status
    const rawStatus = item.progressStatus || item.status || '';
    const status = this.calcStatus(rawStatus, progress);
    const statusText = this.getStatusText(status);

    // [P0-FIX-PROGRESS-WIDTH] 进度条宽度：必须是 “xx%” 字符串
    const percentNum = Math.round(progress * 100);
    const p = isNaN(percentNum) ? 0 : Math.max(0, Math.min(100, percentNum));
    const progressWidth = p + '%';
    const progressText = p > 0 ? `进度 ${p}%` : '';

    return {
      id: item.id || item.course_id,
      title: item.title || item.name || '未命名课程',

      date,
      dateText: this.formatDateDisplay(date), // 给 WXML 用 g.dateText
      timeText: timeText || '时间待定',

      category: courseType,
      courseTypeText,

      status,
      statusText,
      statusClass: `status-${status}`,

      progress,              // 0~1
      progressPercent: p,    // 0~100
      progressWidth,         // "68%"
      progressText           // "进度 68%"
    };
  },

  // 根据状态/进度推导展示状态
  calcStatus(rawStatus, progress) {
    // 后端直接给出标准状态时的优先级
    if (rawStatus === 'finished') return 'finished';
    if (rawStatus === 'in_progress') return 'in_progress';
    if (rawStatus === 'not_started') return 'not_started';

    // 兼容课程表里的状态
    if (rawStatus === 'closed') return 'finished';
    if (rawStatus === 'published') return 'not_started';
    if (rawStatus === 'draft') return 'not_started';

    // 根据进度兜底
    if (progress >= 1) return 'finished';
    if (progress > 0 && progress < 1) return 'in_progress';
    return 'not_started';
  },

  getStatusText(status) {
    if (status === 'finished') return '已完成';
    if (status === 'in_progress') return '进行中';
    return '未开始';
  },

  // 格式化日期：2025-12-08 -> 12-08 周一
  formatDateDisplay(dateStr) {
    if (!dateStr) return '日期待定';

    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;

    const month = parts[1];
    const day = parts[2];

    let weekday = '';
    try {
      const d = new Date(dateStr.replace(/-/g, '/'));
      const w = d.getDay();
      const map = ['日', '一', '二', '三', '四', '五', '六'];
      weekday = `周${map[w]}`;
    } catch (e) {
      return `${month}-${day}`;
    }

    return `${month}-${day} ${weekday}`;
  },

  // 按当前 filterType 重新分组
  applyFilter() {
    const { coursesRaw, filterType } = this.data;

    let filtered = coursesRaw.slice();

    if (filterType === 'upcoming') {
      // “即将开播”：未开始 + 进行中
      filtered = coursesRaw.filter(
        (c) => c.status === 'not_started' || c.status === 'in_progress'
      );
    } else if (filterType === 'ended') {
      // “已结束”：已完成
      filtered = coursesRaw.filter((c) => c.status === 'finished');
    }
    // filterType === 'all' 不做过滤

    filtered.sort((a, b) => {
      if (a.date === b.date) {
        return a.timeText > b.timeText ? 1 : -1;
      }
      return a.date > b.date ? 1 : -1;
    });

    const groupsMap = {};
    filtered.forEach((c) => {
      const key = c.date || '未知日期';
      if (!groupsMap[key]) {
        groupsMap[key] = {
          dateKey: key,        // 给 wx:key 用
          date: key,
          dateText: c.dateText || key,
          list: []
        };
      }
      groupsMap[key].list.push(c);
    });

    const courseGroups = Object.keys(groupsMap)
      .sort((a, b) => (a > b ? 1 : -1))
      .map((k) => groupsMap[k]);

    this.setData({ courseGroups });
  },

  // 点击课程卡片：直接跳转到课程详情页
  onTapCourse(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    funnel.log('COURSE_ITEM_CLICK', { courseId: id });

    wx.navigateTo({
      url: `/pages/course/detail?id=${id}&from=courses`
    });
  }
});
