// pages/course/index.js
const funnel = require('../../utils/funnel.js');
const { getCourseTypeMeta } = require('../../utils/courseType.js'); // [P0-FINAL] 统一类型口径

Page({
  data: {
    from: '',
    clientId: '',

    loading: false,
    errorText: '',

    // upcoming | all | ended
    filterType: 'upcoming',
    searchText: '',

    courses: [],
    courseGroups: []
  },

  onLoad(options) {
    const from = options.from || '';
    const clientId = this.ensureClientId();
    this.setData({ from, clientId });
    console.log('[courses] onLoad from =', from);
  },

  onShow() {
    funnel.log('COURSE_LIST_VIEW', { from: this.data.from, ts: Date.now() });
    this.loadCourses();
  },

  onPullDownRefresh() {
    this.loadCourses(true);
  },

  // ========== helpers ==========

  ensureClientId() {
    let clientId = wx.getStorageSync('clientId');
    if (!clientId) {
      clientId = `ST-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
      wx.setStorageSync('clientId', clientId);
      console.log('[courses] generate new clientId:', clientId);
    } else {
      console.log('[courses] use existing clientId:', clientId);
    }
    return clientId;
  },

  // [P0-FINAL] 与其它页面统一 baseUrl 读取口径
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

  // [P2-LIST-PROGRESS-20251215] 解析进度列表（兼容 payload.list / payload.courses / payload.items）
  extractProgressList(payload) {
    const pickArr = (v) => (Array.isArray(v) ? v : null);
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];

    let list =
      pickArr(payload.list) ||
      pickArr(payload.items) ||
      pickArr(payload.rows) ||
      pickArr(payload.courses);
    if (list) return list;

    const d1 = payload.data;
    if (d1 && typeof d1 === 'object') {
      list =
        pickArr(d1.list) ||
        pickArr(d1.items) ||
        pickArr(d1.rows) ||
        pickArr(d1.courses);
      if (list) return list;

      const d2 = d1.data;
      if (d2 && typeof d2 === 'object') {
        list =
          pickArr(d2.list) ||
          pickArr(d2.items) ||
          pickArr(d2.rows) ||
          pickArr(d2.courses);
        if (list) return list;
      }
    }
    return [];
  },

  // [P0-FINAL] iOS 兼容时间解析：支持 MySQL "YYYY-MM-DD HH:mm:ss"
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

  fmtDateKey(d) {
    return `${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}-${this.pad2(d.getDate())}`;
  },

  fmtHM(d) {
    return `${this.pad2(d.getHours())}:${this.pad2(d.getMinutes())}`;
  },

  weekdayCN(d) {
    const map = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return map[d.getDay()] || '';
  },

  // [P0-FINAL] 列表 UI pill 映射（统一 key）
  pillByTypeKey(typeKey) {
    switch (typeKey) {
      case 'PUBLIC':
        return { label: '公开课', pillClass: 'pill-promo' };
      case 'EXPERIENCE':
        return { label: '体验课', pillClass: 'pill-experience' };
      case 'CAMP':
        return { label: '训练营', pillClass: 'pill-camp' };
      case 'SALON':
        return { label: '线下', pillClass: 'pill-salon' };
      case 'RISK':
        return { label: '风控课', pillClass: 'pill-risk' };
      case 'CONTROLLER':
        return { label: '进阶', pillClass: 'pill-paid' };
      default:
        return { label: '课程', pillClass: 'pill-default' };
    }
  },

  // [P0-FINAL] 状态口径统一：优先后端 status，其次用时间推断
  // [P2-LIST-PROGRESS-20251215] 无起止时间时，状态文案改为“时间待定”，减少误导
  statusMeta(statusRaw, startTs, endTs) {
    const s = String(statusRaw || '').toLowerCase();
    const now = Date.now();

    if (s === 'draft') return { text: '待发布', cls: 'status-draft', isDraft: true, isEnded: false };
    if (s === 'closed' || s === 'finished' || s === 'ended') {
      return { text: '已结束', cls: 'status-ended', isDraft: false, isEnded: true };
    }

    if (!startTs || !endTs) return { text: '时间待定', cls: 'status-upcoming', isDraft: false, isEnded: false };
    if (now < startTs) return { text: '未开始', cls: 'status-upcoming', isDraft: false, isEnded: false };
    if (now >= startTs && now <= endTs) return { text: '进行中', cls: 'status-live', isDraft: false, isEnded: false };
    return { text: '已结束', cls: 'status-ended', isDraft: false, isEnded: true };
  },

  // ========== data flow ==========

  // [P2-LIST-PROGRESS-20251215] 拉取我的课程进度，映射到列表（失败不阻断主列表）
  fetchProgressMap(baseUrl, clientId) {
    const url = `${baseUrl}/api/courses/progress?clientId=${encodeURIComponent(clientId || '')}`;
    console.log('[courses] fetchProgressMap url =', url);

    return this.requestJson(url, 'GET')
      .then((payload) => {
        const list = this.extractProgressList(payload);
        const map = {};
        (list || []).forEach((it) => {
          const courseId = it.courseId || it.course_id || it.courseid || it.courseID;
          if (!courseId) return;

          const key = String(courseId);
          const percent = Number(it.progressPercent ?? it.progress_percent ?? it.percent ?? 0);
          const status = String(it.status || '').toLowerCase();

          map[key] = {
            progressPercent: isNaN(percent) ? 0 : percent,
            status
          };
        });

        console.log('[courses] progressMap size =', Object.keys(map).length);
        return map;
      })
      .catch((e) => {
        console.warn('[courses] fetchProgressMap fail (ignored):', e);
        return {};
      });
  },

  loadCourses(isPullDown = false) {
    this.setData({ loading: true, errorText: '' });

    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/api/courses`;
    const clientId = this.data.clientId || this.ensureClientId();

    console.log('[courses] loadCourses url =', url);

    // [P2-LIST-PROGRESS-20251215] 并行拉取：课程列表 + 我的进度
    Promise.all([
      this.requestJson(url, 'GET'),
      this.fetchProgressMap(baseUrl, clientId)
    ])
      .then(([payload, progressMap]) => {
        console.log('[courses] /api/courses resp raw:', payload);

        const list = this.extractCourseList(payload);
        console.log('[courses] source list length =', list.length, list);

        const normalized = (list || [])
          .map((x) => {
            const rawType = x.type || x.courseType || x.course_type || x.category || '';
            const typeMeta = getCourseTypeMeta(rawType);
            const pill = this.pillByTypeKey(typeMeta.key);

            const startRaw = x.startTime || x.start_time || '';
            const endRaw = x.endTime || x.end_time || '';
            const startD = this.parseDT(startRaw);
            const endD = this.parseDT(endRaw);

            const startTs = startD ? startD.getTime() : 0;
            const endTs = endD ? endD.getTime() : 0;

            const dateKey = startD ? this.fmtDateKey(startD) : '0000-00-00';
            const dateLabel = startD
              ? `${this.pad2(startD.getMonth() + 1)}/${this.pad2(startD.getDate())} ${this.weekdayCN(startD)}`
              : '未定';

            const timeText =
              startD && endD ? `${this.fmtHM(startD)} - ${this.fmtHM(endD)}` : '时间待定';

            const st = this.statusMeta(x.status, startTs, endTs);

            const desc = x.description_text || x.description || '';
            const priceNum = Number(x.price || 0);
            const priceText = priceNum > 0 ? `¥${priceNum}` : '免费';

            // [P2-LIST-PROGRESS-20251215] 合并进度信息
            const p = progressMap[String(x.id)] || null;
            const joined = !!p;
            const progressPercent = joined ? Number(p.progressPercent || 0) : 0;
            const progressStatus = joined ? String(p.status || '') : '';
            const progressText =
              joined && progressStatus === 'finished'
                ? '已完成'
                : joined
                  ? `进度 ${Math.max(0, Math.min(100, progressPercent))}%`
                  : '';

            return {
              id: x.id,
              title: x.title || '',

              typeKey: typeMeta.key,
              typeLabel: pill.label,
              pillClass: pill.pillClass,

              startRaw,
              endRaw,
              startTs,
              endTs,

              dateKey,
              dateLabel,
              timeText,

              statusText: st.text,
              statusClass: st.cls,
              isDraft: st.isDraft,
              isEnded: st.isEnded,

              desc,
              priceText,

              joined,
              progressPercent,
              progressStatus,
              progressText
            };
          })
          .sort((a, b) => {
            const at = a.startTs || Number.MAX_SAFE_INTEGER;
            const bt = b.startTs || Number.MAX_SAFE_INTEGER;
            return at - bt;
          });

        console.log('[courses] normalized list length =', normalized.length, normalized);

        this.setData({ courses: normalized }, () => {
          this.applyFilter();
        });
      })
      .catch((e) => {
        console.error('[courses] loadCourses error', e);
        this.setData({
          loading: false,
          errorText: '课程日历加载失败（请确认后端已启动）'
        });
      })
      .finally(() => {
        if (isPullDown) wx.stopPullDownRefresh();
      });
  },

  applyFilter() {
    const filterType = this.data.filterType;
    const q = String(this.data.searchText || '').trim().toLowerCase();

    console.log('[courses] applyFilter start, filterType =', filterType, ', raw length =', this.data.courses.length);

    let arr = (this.data.courses || []).slice();

    // [P0-FINAL] 口径统一：默认不展示 draft
    if (filterType === 'upcoming') {
      // 未开始 / 进行中 / 时间待定
      arr = arr.filter((c) => !c.isDraft && !c.isEnded);
    } else if (filterType === 'ended') {
      arr = arr.filter((c) => !c.isDraft && c.isEnded);
    } else {
      arr = arr.filter((c) => !c.isDraft);
    }

    if (q) {
      arr = arr.filter((c) => String(c.title || '').toLowerCase().includes(q));
    }

    const map = {};
    arr.forEach((c) => {
      const key = c.dateKey || '0000-00-00';
      if (!map[key]) {
        map[key] = { dateKey: key, dateLabel: c.dateLabel || '未定', items: [] };
      }
      map[key].items.push(c);
    });

    const groups = Object.keys(map)
      .sort((a, b) => {
        if (a === '0000-00-00') return 1;
        if (b === '0000-00-00') return -1;
        return a.localeCompare(b);
      })
      .map((k) => map[k]);

    this.setData({
      loading: false,
      courseGroups: groups
    });

    console.log('[courses] final courseGroups:', groups);
  },

  // ========== UI handlers ==========

  onTabTap(e) {
    const t = e.currentTarget.dataset.type;
    if (!t) return;
    this.setData({ filterType: t }, () => this.applyFilter());
  },

  onSearchInput(e) {
    const v = e.detail.value || '';
    this.setData({ searchText: v }, () => this.applyFilter());
  },

  onClearSearch() {
    this.setData({ searchText: '' }, () => this.applyFilter());
  },

  onRetry() {
    this.loadCourses(false);
  },

  onCourseTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({
      url: `/pages/course/detail?id=${id}&from=courses`
    });
  },

  onSalonBooking(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/visitBooking/index?from=course&courseId=${id || ''}`
    });
  },

  // [P2-LIST-UX-20251215] 入口：我的课程进度
  goMyProgress() {
    wx.navigateTo({ url: '/pages/course/progress?from=courses' });
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  }
});
