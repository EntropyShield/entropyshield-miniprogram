// pages/course/progress.js
// MOD: CLEAN_HARDCODED_API_BASE_20260103
// 我的课程进度列表页

const funnel = require('../../utils/funnel.js');
const { API_BASE } = require('../../config'); // ✅ 确保 API_BASE 从 config.js 引入

function ensureClientId() {
  const appInst = getApp && getApp();
  let cid =
    (appInst && appInst.globalData && appInst.globalData.clientId) ||
    wx.getStorageSync('clientId');

  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    wx.setStorageSync('clientId', cid);
    console.log('[course/progress] new clientId generated:', cid);
    if (appInst && appInst.globalData) appInst.globalData.clientId = cid;
  } else {
    console.log('[course/progress] use existing clientId:', cid);
    if (appInst && appInst.globalData) appInst.globalData.clientId = cid;
  }
  return cid;
}

function getBaseUrl() {
  return String(API_BASE || '').replace(/\/$/, ''); // ✅ 使用 API_BASE 确保请求 URL 动态获取
}

function requestJson(url, method = 'GET', data) {
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
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  return (
    payload.list ||
    payload.rows ||
    payload.items ||
    (payload.data && (payload.data.list || payload.data.rows || payload.data.items)) ||
    []
  );
}

function normalizePercent(v) {
  let n = Number(v);
  if (isNaN(n)) n = 0;
  if (n > 0 && n <= 1) n = n * 100;
  n = Math.max(0, Math.min(100, n));
  return Math.round(n);
}

function safeTimeText(startTime, endTime) {
  if (!startTime && !endTime) return '时间待定';
  const s = String(startTime || '').replace('T', ' ').replace(/\.000Z$/, '');
  const e = String(endTime || '').replace('T', ' ').replace(/\.000Z$/, '');
  if (s && e) {
    try {
      const datePart = s.slice(5, 10);
      const sTime = s.slice(11, 16);
      const eTime = e.slice(11, 16);
      if (datePart && sTime && eTime) return `${datePart} ${sTime} - ${eTime}`;
    } catch (err) {}
    return `${s} ~ ${e}`;
  }
  if (s && !e) return `开始时间：${s}`;
  if (!s && e) return `结束时间：${e}`;
  return '时间待定';
}

Page({
  data: {
    loading: false,
    errorMsg: '',

    filterType: 'all',

    rawItems: [],
    items: [],

    focusCourseId: ''
  },

  onLoad(options) {
    funnel.log('COURSE_PROGRESS_VIEW', { from: (options && options.from) || '' });

    const clientId = ensureClientId();
    this.clientId = clientId;

    const focusCourseId = (options && options.focusCourseId) ? String(options.focusCourseId) : '';
    this.setData({ focusCourseId });

    this._firstShowSkip = true;

    this.fetchProgress();
  },

  onShow() {
    if (this._firstShowSkip) {
      this._firstShowSkip = false;
      return;
    }
    this.fetchProgress();
  },

  onPullDownRefresh() {
    this.fetchProgress(() => wx.stopPullDownRefresh());
  },

  onChangeFilter(e) {
    const type = e.currentTarget.dataset.type || 'all';
    this.setData({ filterType: type }, () => this.applyFilter());
  },

  fetchProgress(done) {
    const clientId = this.clientId || ensureClientId();
    const baseUrl = getBaseUrl(); // ✅ 确保请求指向生产环境
    const url = `${baseUrl}/api/courses/progress?clientId=${encodeURIComponent(clientId)}`;

    console.log('[course/progress] fetchProgress clientId =', clientId, 'baseUrl=', baseUrl);

    this.setData({ loading: true, errorMsg: '' });

    requestJson(url, 'GET')
      .then((data) => {
        console.log('[course/progress] resp:', data);

        if (!data || !data.ok) {
          this.setData(
            {
              loading: false,
              errorMsg: (data && data.message) || '加载课程进度失败',
              rawItems: [],
              items: []
            },
            () => done && done()
          );
          return;
        }

        const list = extractList(data);
        const items = [];

        (list || []).forEach((row) => {
          const courseIdRaw =
            row.course_id ?? row.courseId ?? row.courseID ?? row.courseid ?? row.id;

          const courseId = Number(courseIdRaw);
          if (!Number.isFinite(courseId) || courseId <= 0) {
            console.warn('[course/progress] skip row without valid courseId:', row);
            return;
          }

          const progressIdRaw =
            row.progress_id ?? row.progressId ?? row.progressID ?? row.progressid ?? row.pid ?? row.id ?? courseId;

          const progressId = String(progressIdRaw);

          const startTime = row.startTime || row.start_time || '';
          const endTime = row.endTime || row.end_time || '';
          const timeText = safeTimeText(startTime, endTime);

          const status = row.status || 'in_progress';
          const statusText =
            status === 'finished'
              ? '已完成'
              : status === 'in_progress'
              ? '进行中'
              : '未开始';

          const progressPercentRaw =
            row.progress_percent ?? row.progressPercent ?? row.progress ?? row.percent ?? 0;

          const progressPercent = normalizePercent(progressPercentRaw);
          const progressWidth = `${progressPercent}%`;

          const updatedAtRaw = row.updated_at || row.updatedAt || '';
          const updatedAtText = updatedAtRaw
            ? String(updatedAtRaw).replace('T', ' ').slice(0, 16)
            : '';

          items.push({
            id: progressId,
            progressId,
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
      })
      .catch((err) => {
        console.error('[course/progress] request fail:', err);
        this.setData(
          {
            loading: false,
            errorMsg: '网络异常，请稍后重试',
            rawItems: [],
            items: []
          },
          () => done && done()
        );
      });
  },

  applyFilter() {
    const { filterType, rawItems, focusCourseId } = this.data;
    let items = (rawItems || []).slice();

    if (filterType === 'in_progress') {
      items = items.filter((x) => x.status === 'in_progress');
    } else if (filterType === 'finished') {
      items = items.filter((x) => x.status === 'finished');
    }

    if (focusCourseId) {
      const fid = Number(focusCourseId);
      items.sort((a, b) => {
        const aHit = Number(a.courseId) === fid ? -1 : 0;
        const bHit = Number(b.courseId) === fid ? -1 : 0;
        return aHit - bHit;
      });
    }

    this.setData({ items });
  },

  onTapItem(e) {
    const id = e.currentTarget.dataset.id;
    const item =
      this.data.items.find((x) => x.progressId === String(id)) ||
      this.data.items.find((x) => x.id === String(id));
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

  onUpdateProgress(e) {
    const id = e.currentTarget.dataset.id;
    const item =
      this.data.items.find((x) => x.progressId === String(id)) ||
      this.data.items.find((x) => x.id === String(id));
    if (!item) return;

    const that = this;

    wx.showActionSheet({
      itemList: ['0%', '25%', '50%', '75%', '100%（标记完成）'],
      success(res) {
        const idx = res.tapIndex;
        const percentMap = [0, 25, 50, 75, 100];
        const progressPercent = percentMap[idx] || 0;
        const status = progressPercent === 100 ? 'finished' : 'in_progress';
        that.saveProgress(item.courseId, progressPercent, status, item.progressId);
      }
    });
  },

  onMarkFinished(e) {
    const id = e.currentTarget.dataset.id;
    const item =
      this.data.items.find((x) => x.progressId === String(id)) ||
      this.data.items.find((x) => x.id === String(id));
    if (!item) return;

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

  saveProgress(courseId, progressPercent, status, progressId) {
    const clientId = this.clientId || ensureClientId();
    const baseUrl = getBaseUrl(); // ✅ 确保使用生产环境的 API 地址

    if (!clientId || !Number.isFinite(Number(courseId))) {
      console.error('[course/progress] saveProgress 缺少关键参数', { clientId, courseId });
      wx.showToast({ title: '内部错误：缺少课程信息', icon: 'none' });
      return;
    }

    const payload = {
      clientId,
      courseId: Number(courseId),
      progressPercent,
      status,
      lastLesson: ''
    };
    if (progressId) payload.progressId = progressId;

    console.log('[course/progress] saveProgress payload =', payload);

    requestJson(`${baseUrl}/api/courses/progress/update`, 'POST', payload) // ✅ 请求 URL 确保指向生产环境
      .then((data) => {
        console.log('[course/progress] update resp:', data);

        if (!data || !data.ok) {
          wx.showToast({ title: (data && data.message) || '保存失败', icon: 'none' });
          return;
        }

        funnel.log('COURSE_PROGRESS_UPDATE', { courseId, progressPercent, status });

        wx.showToast({ title: '已更新', icon: 'success', duration: 900 });

        this.fetchProgress();
      })
      .catch(() => {
        wx.showToast({ title: '网络异常，稍后重试', icon: 'none' });
      });
  },

  noop() {}
});
