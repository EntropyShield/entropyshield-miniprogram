// pages/courses/index.js 课程日历列表页逻辑
const funnel = require('../../utils/funnel.js');
const { getCourseTypeMeta } = require('../../utils/courseType.js');

const app = getApp();
const API_BASE =
  (app &&
    app.globalData &&
    (app.globalData.API_BASE || app.globalData.apiBase)) ||
  'http://localhost:3000';

/**
 * 将后端原始类型映射为「控局 5 大课」的统一枚举：
 * PUBLIC / EXPERIENCE / RISK / SALON / CONTROLLER
 */
function normalizeCourseType(rawType) {
  const t = (rawType || '').toLowerCase();

  if (t === 'promo' || t === 'public' || t === 'open') return 'PUBLIC';          // 公开课
  if (t === 'lead' || t === 'experience' || t === 'trial') return 'EXPERIENCE';  // 体验课
  if (t === 'risk' || t === 'calc' || t === 'system') return 'RISK';             // 风控课
  if (t === 'salon' || t === 'offline') return 'SALON';                          // 线下沙龙
  if (t === 'paid' || t === 'controller' || t === 'pro') return 'CONTROLLER';    // 成为控局者

  // 未配置的类型，交给 courseType.js 默认处理
  return '';
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
        const data = res.data || {};

        if (!data.ok) {
          this.setData({
            loading: false,
            errorMsg: data.message || '课程数据获取失败'
          });
          done && done();
          return;
        }

        // 兼容 courses / list 两种返回字段
        const list = data.courses || data.list || [];
        const normalized = list.map((item) => this.normalizeCourse(item));

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
      fail: () => {
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

  // 标准化后端课程字段
  normalizeCourse(item) {
    const date =
      item.date ||
      (item.startTime ? item.startTime.slice(0, 10) : '') ||
      item.course_date ||
      '';

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

    const rawStatus = item.status || '';
    const progress =
      typeof item.progress === 'number' ? item.progress : 0;

    const status = this.calcStatus(rawStatus, progress);
    const statusText = this.getStatusText(status);

    // 统一课程类型（底层原始值 → 控局 5 大课类型）
    const rawType =
      item.courseType || item.type || item.category || '';
    const typeKey = normalizeCourseType(rawType);
    const typeMeta = getCourseTypeMeta(typeKey);
    const courseTypeText =
      (typeMeta && (typeMeta.shortTag || typeMeta.name)) || '课程';

    return {
      id: item.id || item.course_id,
      title: item.title || item.name || '未命名课程',

      // 日期与时间
      date,
      dateDisplay: this.formatDateDisplay(date),
      timeText: timeText || '时间待定',

      // 原始等级 / 分类
      level: item.level || item.level_name || '',
      category: rawType,

      // 控局 5 大课类型（归一后）
      typeKey,
      courseTypeText,

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
          dateDisplay: c.dateDisplay || key,
          list: []
        };
      }
      groupsMap[key].list.push(c);
    });

    const courseGroups = Object.keys(groupsMap)
      .sort((a, b) => (a > b ? 1 : -1))
      .map((k) => groupsMap[k]);

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
