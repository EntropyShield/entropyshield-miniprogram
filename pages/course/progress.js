// pages/course/progress/index.js
// 我的课程进度列表页

const funnel = require('../../utils/funnel.js');

const app = getApp();
const API_BASE =
  (app &&
    app.globalData &&
    (app.globalData.API_BASE || app.globalData.apiBase)) ||
  'http://localhost:3000';

// 和其它模块统一的 clientId 生成 / 读取规则
function ensureClientId() {
  const appInst = getApp && getApp();
  let cid =
    (appInst && appInst.globalData && appInst.globalData.clientId) ||
    wx.getStorageSync('clientId');

  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    wx.setStorageSync('clientId', cid);
    console.log('[course/progress] new clientId generated:', cid);
    if (appInst && appInst.globalData) {
      appInst.globalData.clientId = cid;
    }
  } else {
    console.log('[course/progress] use existing clientId:', cid);
    if (appInst && appInst.globalData) {
      appInst.globalData.clientId = cid;
    }
  }
  return cid;
}

// [P2-PROGRESS-PERCENT-NORMALIZE] 兼容 0~1 / 0~100，输出 0~100 整数
function normalizePercent(v) {
  let n = Number(v);
  if (isNaN(n)) n = 0;

  // 如果不小心传了 0~1（例如 0.68），转成百分比
  if (n > 0 && n <= 1) n = n * 100;

  n = Math.max(0, Math.min(100, n));
  return Math.round(n);
}

Page({
  data: {
    loading: false,
    errorMsg: '',
    // all / in_progress / finished
    filterType: 'all',
    // 原始进度列表（不带筛选）
    rawItems: [],
    // 当前展示列表（已按筛选过滤）
    items: []
  },

  onLoad() {
    funnel.log('COURSE_PROGRESS_VIEW', {});
    const clientId = ensureClientId();
    this.clientId = clientId;

    // [P2-PROGRESS-AVOID-DOUBLE-FETCH] 避免首次 onShow 再拉一遍
    this._firstShowSkip = true;

    this.fetchProgress();
  },

  onShow() {
    // [P2-PROGRESS-AVOID-DOUBLE-FETCH]
    if (this._firstShowSkip) {
      this._firstShowSkip = false;
      return;
    }
    // 从详情页返回时刷新
    this.fetchProgress();
  },

  onPullDownRefresh() {
    this.fetchProgress(() => wx.stopPullDownRefresh());
  },

  // 顶部筛选 Tab：全部 / 进行中 / 已完成
  onChangeFilter(e) {
    const type = e.currentTarget.dataset.type || 'all';
    this.setData({ filterType: type }, () => {
      this.applyFilter();
    });
  },

  // 拉取当前 clientId 的课程进度
  fetchProgress(done) {
    const clientId = this.clientId || ensureClientId();
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
          this.setData(
            {
              loading: false,
              errorMsg: data.message || '加载课程进度失败',
              rawItems: [],
              items: []
            },
            () => {
              done && done();
            }
          );
          return;
        }

        const list = data.list || [];
        const items = [];

        list.forEach((row) => {
          // 一行里既有课程字段，也有进度字段
          const courseIdRaw =
            row.course_id ??
            row.courseId ??
            row.courseid ??
            row.id; // 退化用 id 当作课程 id

          const courseId = Number(courseIdRaw);

          if (!Number.isFinite(courseId)) {
            console.warn('[course/progress] skip row without valid courseId:', row);
            return;
          }

          const startTime = row.startTime || row.start_time || '';
          const endTime = row.endTime || row.end_time || '';
          const timeText = this.buildTimeText(startTime, endTime);

          const status = row.status || 'in_progress';
          const statusText =
            status === 'finished'
              ? '已完成'
              : status === 'in_progress'
              ? '进行中'
              : '未开始';

          let progressPercentRaw = 0;
          if (typeof row.progress_percent === 'number') {
            progressPercentRaw = row.progress_percent;
          } else if (typeof row.progressPercent === 'number') {
            progressPercentRaw = row.progressPercent;
          } else if (typeof row.progress === 'number') {
            progressPercentRaw = row.progress;
          }

          // [P2-PROGRESS-PERCENT-NORMALIZE]
          const progressPercent = normalizePercent(progressPercentRaw);
          const progressWidth = `${progressPercent}%`;

          const updatedAtRaw = row.updated_at || row.updatedAt || '';
          const updatedAtText = updatedAtRaw
            ? String(updatedAtRaw).replace('T', ' ').slice(0, 16)
            : '';

          items.push({
            id: row.id,
            progressId: row.progress_id || row.progressId || row.id,
            courseId,
            title: row.title || '未命名课程',
            timeText,
            status,
            statusText,
            progressPercent,
            progressWidth,
            lastLesson: row.last_lesson || row.lastLesson || '',
            updatedAtText
          });
        });

        // 先存原始列表，再按当前筛选类型过滤
        this.setData(
          {
            loading: false,
            rawItems: items
          },
          () => {
            this.applyFilter();
            done && done();
          }
        );
      },
      fail: (err) => {
        console.error('[course/progress] request fail:', err);
        this.setData(
          {
            loading: false,
            errorMsg: '网络异常，请稍后重试',
            rawItems: [],
            items: []
          },
          () => {
            done && done();
          }
        );
      }
    });
  },

  // 根据 filterType 对 rawItems 做前端过滤
  applyFilter() {
    const { filterType, rawItems } = this.data;
    let items = rawItems || [];

    if (filterType === 'in_progress') {
      items = items.filter((x) => x.status === 'in_progress');
    } else if (filterType === 'finished') {
      items = items.filter((x) => x.status === 'finished');
    }
    // filterType === 'all' 时不过滤

    this.setData({ items });
  },

  // 时间范围文案（和详情页保持风格一致）
  buildTimeText(startTime, endTime) {
    if (!startTime && !endTime) return '时间待定';
    if (!startTime) return `结束时间：${endTime}`;
    if (!endTime) return `开始时间：${startTime}`;

    try {
      const s = (startTime || '').replace('T', ' ');
      const e = (endTime || '').replace('T', ' ');
      const datePart = s.slice(5, 10); // MM-DD
      const sTime = s.slice(11, 16);
      const eTime = e.slice(11, 16);
      return `${datePart} ${sTime} - ${eTime}`;
    } catch (e) {
      return `${startTime} ~ ${endTime}`;
    }
  },

  // 点击整张卡片：弹出当前进度摘要
  onTapItem(e) {
    const id = e.currentTarget.dataset.id;
    const item =
      this.data.items.find((x) => x.progressId === id) ||
      this.data.items.find((x) => x.id === id);
    if (!item) return;

    const content =
      `时间：${item.timeText}\n` +
      `状态：${item.statusText}\n` +
      `进度：${item.progressPercent || 0}%\n` +
      (item.lastLesson ? `最近学习：${item.lastLesson}\n` : '') +
      (item.updatedAtText ? `最近更新：${item.updatedAtText}` : '');

    wx.showModal({
      title: item.title,
      content,
      showCancel: false
    });
  },

  // 更新进度（弹出进度档位）
  onUpdateProgress(e) {
    const id = e.currentTarget.dataset.id;
    const item =
      this.data.items.find((x) => x.progressId === id) ||
      this.data.items.find((x) => x.id === id);
    if (!item) return;

    const that = this;

    console.log('[course/progress] onUpdateProgress item =', item);

    wx.showActionSheet({
      itemList: ['0%', '25%', '50%', '75%', '100%（标记完成）'],
      success(res) {
        const idx = res.tapIndex;
        const percentMap = [0, 25, 50, 75, 100];
        const progressPercent = percentMap[idx] || 0;
        const status = progressPercent === 100 ? 'finished' : 'in_progress';

        that.saveProgress(
          item.courseId,
          progressPercent,
          status,
          item.progressId
        );
      }
    });
  },

  // 直接标记为已完成
  onMarkFinished(e) {
    const id = e.currentTarget.dataset.id;
    const item =
      this.data.items.find((x) => x.progressId === id) ||
      this.data.items.find((x) => x.id === id);
    if (!item) return;

    console.log('[course/progress] onMarkFinished item =', item);

    wx.showModal({
      title: '标记为已完成',
      content: '确认将本课程标记为「已完成」吗？',
      success: (res) => {
        if (res.confirm) {
          this.saveProgress(item.courseId, 100, 'finished', item.progressId);
        }
      }
    });
  },

  // 保存进度到后端（调用 /api/courses/progress/update）
  saveProgress(courseId, progressPercent, status, progressId) {
    const clientId = this.clientId || ensureClientId();

    if (!clientId || !Number.isFinite(Number(courseId))) {
      console.error(
        '[course/progress] saveProgress 缺少关键参数',
        'clientId =',
        clientId,
        'courseId =',
        courseId
      );
      wx.showToast({
        title: '内部错误：缺少课程信息',
        icon: 'none'
      });
      return;
    }

    const payload = {
      clientId,
      courseId,
      progressPercent,
      status,
      lastLesson: ''
    };
    if (progressId) {
      payload.progressId = progressId;
    }

    console.log('[course/progress] saveProgress payload =', payload);

    wx.request({
      url: `${API_BASE}/api/courses/progress/update`,
      method: 'POST',
      data: payload,
      success: (res) => {
        const data = res.data || {};
        console.log('[course/progress] update resp:', data);

        if (!data.ok) {
          wx.showToast({
            title: data.message || '保存失败',
            icon: 'none'
          });
          return;
        }

        funnel.log('COURSE_PROGRESS_UPDATE', {
          courseId,
          progressPercent,
          status
        });

        wx.showToast({
          title: '已更新',
          icon: 'success',
          duration: 900
        });

        // 保存成功后重新拉一次列表（以服务端为准）
        this.fetchProgress();
      },
      fail: () => {
        wx.showToast({
          title: '网络异常，稍后重试',
          icon: 'none'
        });
      }
    });
  },

  // 占位，避免按钮点击冒泡到卡片 tap
  noop() {}
});
