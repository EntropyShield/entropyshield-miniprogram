// pages/course/index.js 课程日历列表页逻辑（字段兼容 + 调试日志版）
const funnel = require('../../utils/funnel.js');
const { getCourseTypeMeta } = require('../../utils/courseType.js');

const app = getApp();
const API_BASE =
  (app &&
    app.globalData &&
    (app.globalData.API_BASE || app.globalData.apiBase)) ||
  'http://localhost:3000';

/**
 * 统一生成 / 读取 clientId，方便后面扩展埋点
 */
function ensureClientId() {
  const app = getApp && getApp();
  let clientId =
    (app && app.globalData && app.globalData.clientId) ||
    wx.getStorageSync('clientId');

  if (!clientId) {
    clientId =
      'ST-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
    wx.setStorageSync('clientId', clientId);
    if (app && app.globalData) {
      app.globalData.clientId = clientId;
    }
    console.log('[courses] generate new clientId:', clientId);
  } else {
    if (app && app.globalData) {
      app.globalData.clientId = clientId;
    }
    console.log('[courses] use existing clientId:', clientId);
  }

  return clientId;
}

Page({
  data: {
    loading: false,
    errorMsg: '',

    // 原始课程扁平列表（标准化之后的）
    coursesRaw: [],

    // 分组后的课程列表 [{ date, dateDisplay, list: [...] }]
    courseGroups: [],

    // 筛选类型：upcoming / all / finished
    filterType: 'upcoming'
  },

  onLoad() {
    ensureClientId();
    funnel.log('COURSE_LIST_VIEW', {});
    this.loadCourses();
  },

  onPullDownRefresh() {
    this.loadCourses(() => {
      wx.stopPullDownRefresh();
    });
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

  // 载入课程数据
  loadCourses(done) {
    this.setData({
      loading: true,
      errorMsg: ''
    });

    wx.request({
      url: `${API_BASE}/api/courses`,
      method: 'GET',
      success: (res) => {
        console.log('[courses] /api/courses resp raw:', res);

        const data = res.data || {};

        if (!data.ok) {
          this.setData({
            loading: false,
            errorMsg: data.message || '课程数据获取失败'
          });
          done && done();
          return;
        }

        // 兼容 courses / list / rows 三种返回字段
        let list = [];
        if (Array.isArray(data.courses)) {
          list = data.courses;
        } else if (Array.isArray(data.list)) {
          list = data.list;
        } else if (Array.isArray(data.rows)) {
          list = data.rows;
        }

        console.log(
          '[courses] source list length =',
          list.length,
          list
        );

        const normalized = list.map((item) => this.normalizeCourse(item));
        console.log(
          '[courses] normalized list length =',
          normalized.length,
          normalized
        );

        this.setData(
          {
            loading: false,
            coursesRaw: normalized
          },
          () => {
            this.applyFilter();
          }
        );
      },
      fail: (err) => {
        console.error('[courses] request fail:', err);
        this.setData({
          loading: false,
          errorMsg: '网络异常，请稍后重试'
        });
      },
      complete: () => {
        done && done();
      }
    });
  },

  // 标准化后端课程字段（兼容 startTime / start_time、courseType / course_type）
  normalizeCourse(item) {
    // 起止时间字段兼容
    const startTime = item.startTime || item.start_time || '';
    const endTime = item.endTime || item.end_time || '';

    // 日期：优先显式 date，其次从 startTime 截取
    const date =
      item.date ||
      (startTime ? startTime.slice(0, 10) : '') ||
      item.course_date ||
      '';

    // 时间文案
    let timeText = '';
    if (item.timeText) {
      timeText = item.timeText;
    } else if ((startTime && endTime) || startTime || endTime) {
      const s = startTime ? startTime.slice(11, 16) : '';
      const e = endTime ? endTime.slice(11, 16) : '';
      if (s && e) {
        timeText = `${s} - ${e}`;
      } else {
        timeText = s || e || '';
      }
    }

    const rawStatus = item.status || '';
    const progress =
      typeof item.progress === 'number' ? item.progress : 0;

    const status = this.calcStatus(rawStatus, progress);
    const statusText = this.getStatusText(status);

    // 统一课程类型（底层原始值 → 控局 5 大课类型）
    const rawType =
      item.courseType ||
      item.course_type ||
      item.type ||
      item.category ||
      '';

    const typeMeta = getCourseTypeMeta(rawType);

    return {
      id: item.id || item.course_id,
      title: item.title || item.name || '未命名课程',

      // 日期与时间
      date,
      dateDisplay: this.formatDateDisplay(date),
      timeText: timeText || '时间待定',

      // 课程类型（统一后，用于标签）
      typeKey: typeMeta.key,
      courseTypeText: typeMeta.shortTag || typeMeta.text,
      courseTypeClass: typeMeta.cssClass || 'tag-default',

      // 原始等级 / 分类
      level: item.level || item.level_name || '',
      category: rawType,

      // 状态 / 进度
      status,
      statusText,
      progress
    };
  },

  // 根据状态/进度推导展示状态
  calcStatus(rawStatus, progress) {
    if (rawStatus === 'finished') return 'finished';
    if (rawStatus === 'in_progress') return 'in_progress';
    if (rawStatus === 'not_started') return 'not_started';

    if (rawStatus === 'closed') return 'finished';
    if (rawStatus === 'published') return 'not_started';
    if (rawStatus === 'draft') return 'not_started';

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

    console.log(
      '[courses] applyFilter start, filterType =',
      filterType,
      ', raw length =',
      coursesRaw.length
    );

    let filtered = coursesRaw.slice();

    if (filterType === 'upcoming') {
      filtered = coursesRaw.filter(
        (c) =>
          c.status === 'not_started' || c.status === 'in_progress'
      );
    } else if (filterType === 'finished') {
      filtered = coursesRaw.filter((c) => c.status === 'finished');
    }
    // filterType === 'all' 时不过滤

    // 按日期 + 时间排序
    filtered.sort((a, b) => {
      if (a.date === b.date) {
        return a.timeText > b.timeText ? 1 : -1;
      }
      return a.date > b.date ? 1 : -1;
    });

    // 分组：按日期聚合
    const groupsMap = {};
    filtered.forEach((c) => {
      const key = c.date || '未知日期';
      if (!groupsMap[key]) {
        groupsMap[key] = {
          date: key,
          dateDisplay: c.dateDisplay || key || '日期待定',
          list: []
        };
      }
      groupsMap[key].list.push(c);
    });

    const courseGroups = Object.keys(groupsMap)
      .sort((a, b) => (a > b ? 1 : -1))
      .map((k) => groupsMap[k]);

    console.log('[courses] final courseGroups:', courseGroups);

    this.setData({
      courseGroups
    });
  },

  // 点击课程卡片：进入课程详情页
  onTapCourse(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    funnel.log('COURSE_ITEM_CLICK', {
      courseId: id
    });

    wx.navigateTo({
      url: `/pages/course/detail?id=${id}&from=courses`
    });
  }
});
