// pages/course/progress.js
// 我的课程进度：列表 + 按状态筛选 + 一键更新进度

const funnel = require('../../utils/funnel.js');

const app = getApp();
const API_BASE =
  (app &&
    app.globalData &&
    (app.globalData.API_BASE || app.globalData.apiBase)) ||
  'http://localhost:3000';

// 统一 clientId
function ensureClientId() {
  let cid = wx.getStorageSync('clientId');
  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    wx.setStorageSync('clientId', cid);
    console.log('[course/progress] new clientId:', cid);
  } else {
    console.log('[course/progress] use existing clientId:', cid);
  }
  return cid;
}

// 时间文案（和详情页保持风格一致）
function buildTimeText(startTime, endTime) {
  if (!startTime && !endTime) return '时间待定';
  if (!startTime) return `结束时间：${endTime}`;
  if (!endTime) return `开始时间：${startTime}`;

  try {
    const s = String(startTime).replace('T', ' ');
    const e = String(endTime).replace('T', ' ');
    const datePart = s.slice(5, 10); // MM-DD
    const sTime = s.slice(11, 16);
    const eTime = e.slice(11, 16);
    return `${datePart} ${sTime} - ${eTime}`;
  } catch (e) {
    return `${startTime} ~ ${endTime}`;
  }
}

// 课程类型文案
function courseTypeText(type) {
  if (type === 'promo') return '宣传课';
  if (type === 'lead') return '引流课';
  if (type === 'paid') return '收费课';
  if (type === 'camp') return '训练营';
  return '课程';
}

// 状态文案
function statusText(status) {
  if (status === 'finished') return '已完成';
  if (status === 'in_progress') return '进行中';
  if (status === 'not_started') return '未开始';
  return '未开始';
}

// 根据后端状态 + 进度 推导展示状态
function inferStatus(raw, progress) {
  let s = raw.progressStatus || raw.status || '';

  if (s === 'finished' || s === 'in_progress' || s === 'not_started') {
    // 已是标准值
  } else if (raw.status === 'closed') {
    s = 'finished';
  } else if (raw.status === 'published') {
    s = 'not_started';
  } else {
    s = 'not_started';
  }

  // 进度兜底（以进度为准）
  if (progress >= 1) {
    s = 'finished';
  } else if (progress > 0 && progress < 1 && s !== 'finished') {
    s = 'in_progress';
  }

  return s;
}

Page({
  data: {
    loading: false,
    errorMsg: '',
    // all / in_progress / not_started / finished
    filterType: 'all',

    // 原始列表（全部课程进度）
    listRaw: [],

    // 按筛选后的展示列表
    list: []
  },

  onLoad() {
    funnel.log('COURSE_PROGRESS_VIEW', {});
  },

  onShow() {
    // 每次回到本页时刷新一次进度
    this.fetchProgress();
  },

  onPullDownRefresh() {
    this.fetchProgress(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 切换顶部标签
  onChangeFilter(e) {
    const type = e.currentTarget.dataset.type || 'all';
    this.setData(
      {
        filterType: type
      },
      () => {
        this.applyFilter();
      }
    );
  },

  // 拉取当前 clientId 的课程进度
  fetchProgress(done) {
    const clientId = ensureClientId();
    console.log('[course/progress] fetchProgress clientId =', clientId);

    this.setData({
      loading: true,
      errorMsg: ''
    });

    wx.request({
      url: `${API_BASE}/api/courses/progress`,
      method: 'GET',
      data: { clientId },
      success: (res) => {
        const data = res.data || {};
        console.log('[course/progress] resp:', data);

        if (!data.ok) {
          this.setData({
            loading: false,
            errorMsg: data.message || '课程进度获取失败'
          });
          done && done();
          return;
        }

        const listRaw = (data.list || []).map((item) =>
          this.normalizeCourse(item)
        );

        this.setData(
          {
            loading: false,
            listRaw
          },
          () => {
            this.applyFilter();
          }
        );

        done && done();
      },
      fail: (err) => {
        console.error('[course/progress] request fail:', err);
        this.setData({
          loading: false,
          errorMsg: '网络异常，请稍后重试'
        });
        done && done();
      }
    });
  },

  // 标准化单条课程记录
  normalizeCourse(raw) {
    const startTime = raw.startTime || raw.start_time || '';
    const endTime = raw.endTime || raw.end_time || '';
    const priceNum = Number(raw.price || 0);

    // 进度：后端是 0~1 的小数
    let progress = 0;
    if (typeof raw.progressPercent === 'number') {
      progress = raw.progressPercent;
    }
    if (!Number.isFinite(progress) || progress < 0) progress = 0;
    if (progress > 1 && progress <= 100) progress = progress / 100;
    if (progress > 1) progress = 1;

    const status = inferStatus(raw, progress);
    const statusLabel = statusText(status);

    const pct = Math.round(progress * 100);

    return {
      id: raw.id,
      title: raw.title || '未命名课程',
      courseType: raw.courseType || raw.course_type || '',
      courseTypeText: courseTypeText(
        raw.courseType || raw.course_type || ''
      ),
      description: raw.description || raw.description_text || '',
      startTime,
      endTime,
      timeText: buildTimeText(startTime, endTime),
      price: priceNum,
      priceText: priceNum > 0 ? `收费 · ¥${priceNum}` : '免费',
      status,
      statusText: statusLabel,
      progress, // 0~1
      progressPercent: pct // 0~100，用于展示
    };
  },

  // 根据 filterType 过滤出展示列表
  applyFilter() {
    const { listRaw, filterType } = this.data;
    let list = listRaw.slice();

    if (
      filterType === 'in_progress' ||
      filterType === 'not_started' ||
      filterType === 'finished'
    ) {
      list = listRaw.filter((item) => item.status === filterType);
    }

    this.setData({ list });
  },

  // 点击课程卡片：从“我的课程进度”跳回课程详情
  onTapCourse(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    funnel.log('COURSE_PROGRESS_ITEM_CLICK', {
      courseId: id
    });

    wx.navigateTo({
      url: `/pages/course/detail?id=${id}&from=progress`
    });
  },

  // 点击状态标签：弹出操作菜单，更新进度 / 标记完成
  onTapUpdateProgress(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;

    const { listRaw } = this.data;
    const target = listRaw.find((c) => c.id === id);
    if (!target) return;

    const that = this;

    wx.showActionSheet({
      itemList: ['标记为未开始 (0%)', '标记为进行中 (50%)', '标记为已完成 (100%)'],
      success(res) {
        let progress = target.progress;
        let status = target.status;

        if (res.tapIndex === 0) {
          progress = 0;
          status = 'not_started';
        } else if (res.tapIndex === 1) {
          progress = 0.5;
          status = 'in_progress';
        } else if (res.tapIndex === 2) {
          progress = 1;
          status = 'finished';
        } else {
          return;
        }

        funnel.log('COURSE_PROGRESS_UPDATE_CLICK', {
          courseId: id,
          toStatus: status,
          toProgress: progress
        });

        that.updateCourseProgress(id, progress, status);
      }
    });
  },

  // 调用后端接口，更新某门课的进度
  updateCourseProgress(courseId, progress, status) {
    const clientId = ensureClientId();

    wx.showLoading({
      title: '更新中…',
      mask: true
    });

    wx.request({
      url: `${API_BASE}/api/courses/progress/update`,
      method: 'POST',
      data: {
        clientId,
        courseId,
        progressPercent: progress, // 0~1
        status,
        lastLesson: ''
      },
      success: (res) => {
        const data = res.data || {};
        console.log('[course/progress] update resp:', data);

        if (!data.ok) {
          wx.showToast({
            title: data.message || '更新失败',
            icon: 'none'
          });
          return;
        }

        // 更新成功后，重新拉取一遍进度，确保和后端强一致
        this.fetchProgress();

        wx.showToast({
          title: '已更新',
          icon: 'success',
          duration: 800
        });
      },
      fail: (err) => {
        console.error('[course/progress] update fail:', err);
        wx.showToast({
          title: '网络异常，稍后重试',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  }
});
