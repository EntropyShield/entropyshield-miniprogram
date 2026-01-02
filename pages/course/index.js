// pages/course/index.js
// MOD: CLEAN_HARDCODED_API_BASE_20260103
const funnel = require('../../utils/funnel.js');
const { getCourseTypeMeta } = require('../../utils/courseType.js');
const { API_BASE } = require('../../config');

Page({
  data: {
    from: '',
    clientId: '',

    loading: false,
    errorText: '',

    filterType: 'upcoming',
    searchText: '',

    progressMap: {},

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

  // MOD: 统一 baseUrl 取值：config.js -> API_BASE
  getBaseUrl() {
    return String(API_BASE || '').replace(/\/$/, '');
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

  extractProgressList(payload) {
    const pickArr = (v) => (Array.isArray(v) ? v : null);
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];

    let list =
      pickArr(payload.list) ||
      pickArr(payload.rows) ||
      pickArr(payload.items) ||
      pickArr(payload.courses);
    if (list) return list;

    const d1 = payload.data;
    if (d1 && typeof d1 === 'object') {
      list =
        pickArr(d1.list) ||
        pickArr(d1.rows) ||
        pickArr(d1.items) ||
        pickArr(d1.courses);
      if (list) return list;

      const d2 = d1.data;
      if (d2 && typeof d2 === 'object') {
        list =
          pickArr(d2.list) ||
          pickArr(d2.rows) ||
          pickArr(d2.items) ||
          pickArr(d2.courses);
        if (list) return list;
      }
    }
    return [];
  },

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

  statusMeta(statusRaw, startTs, endTs) {
    const s = String(statusRaw || '').toLowerCase();
    const now = Date.now();

    if (s === 'draft') return { text: '待发布', cls: 'status-draft', isDraft: true, isEnded: false };
    if (s === 'closed' || s === 'finished' || s === 'ended') {
      return { text: '已结束', cls: 'status-ended', isDraft: false, isEnded: true };
    }

    if (!startTs || !endTs) return { text: '未开始', cls: 'status-upcoming', isDraft: false, isEnded: false };
    if (now < startTs) return { text: '未开始', cls: 'status-upcoming', isDraft: false, isEnded: false };
    if (now >= startTs && now <= endTs) return { text: '进行中', cls: 'status-live', isDraft: false, isEnded: false };
    return { text: '已结束', cls: 'status-ended', isDraft: false, isEnded: true };
  },

  progressMeta(progressRecord) {
    if (!progressRecord) return { joined: false, text: '', cls: '' };

    const status =
      String(
        progressRecord.progressStatus ??
          progressRecord.progress_status ??
          progressRecord.status ??
          ''
      ).toLowerCase();

    let percentRaw =
      progressRecord.progressPercent ??
      progressRecord.progress_percent ??
      progressRecord.progress ??
      progressRecord.percent ??
      0;

    let percent = Number(percentRaw);
    if (isNaN(percent)) percent = 0;
    if (percent > 0 && percent <= 1) percent = percent * 100;
    percent = Math.max(0, Math.min(100, percent));

    if (status === 'finished' || percent >= 100) {
      return { joined: true, text: '已完成', cls: 'pill-progress-finished', percent: 100, status: 'finished' };
    }
    if (status === 'in_progress' || status === 'in progress' || percent > 0) {
      const t = percent > 0 ? `进度${Math.round(percent)}%` : '进行中';
      return { joined: true, text: t, cls: 'pill-progress-doing', percent, status: 'in_progress' };
    }
    return { joined: true, text: '已加入', cls: 'pill-progress-joined', percent, status: status || 'joined' };
  },

  fetchProgressMap(clientId) {
    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/api/courses/progress?clientId=${encodeURIComponent(clientId || '')}`;
    console.log('[courses] fetchProgressMap url =', url);

    const looksLikeCourseMerged = (r) => {
      if (!r || typeof r !== 'object') return false;
      return !!(r.title || r.courseType || r.startTime || r.start_time || r.progressPercent || r.progressStatus);
    };

    return this.requestJson(url, 'GET')
      .then((payload) => {
        const list = this.extractProgressList(payload);
        const map = {};

        (list || []).forEach((r) => {
          const cid =
            r.courseId ??
            r.course_id ??
            r.courseID ??
            r.courseid ??
            '';

          const fallbackId = looksLikeCourseMerged(r) ? (r.id ?? '') : '';
          const key = String((cid || fallbackId) || '').trim();
          if (!key) return;

          map[key] = r;
        });

        console.log('[courses] progressMap size =', Object.keys(map).length);
        this.setData({ progressMap: map });
        return map;
      })
      .catch((e) => {
        console.warn('[courses] fetchProgressMap fail, use empty map', e);
        this.setData({ progressMap: {} });
        return {};
      });
  },

  loadCourses(isPullDown = false) {
    this.setData({ loading: true, errorText: '' });

    const baseUrl = this.getBaseUrl();
    const url = `${baseUrl}/api/courses`;
    const clientId = this.data.clientId || this.ensureClientId();

    console.log('[courses] loadCourses url =', url);

    this.fetchProgressMap(clientId)
      .then((pmap) => {
        return this.requestJson(url, 'GET').then((payload) => ({ payload, pmap }));
      })
      .then(({ payload, pmap }) => {
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

            const timeText = startD && endD ? `${this.fmtHM(startD)} - ${this.fmtHM(endD)}` : '时间待定';
            const st = this.statusMeta(x.status, startTs, endTs);

            const desc = x.description_text || x.description || '';
            const priceNum = Number(x.price || 0);
            const priceText = priceNum > 0 ? `¥${priceNum}` : '免费';

            const pr = (pmap || {})[String(x.id)];
            const pm = this.progressMeta(pr);

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

              joined: !!pm.joined,
              progressText: pm.text || '',
              progressPillClass: pm.cls || '',

              desc,
              priceText
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

    if (filterType === 'upcoming') {
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
      if (!map[key]) map[key] = { dateKey: key, dateLabel: c.dateLabel || '未定', items: [] };
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
    wx.navigateTo({ url: `/pages/course/detail?id=${id}&from=courses` });
  },

  onSalonBooking(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/visitBooking/index?from=course&courseId=${id || ''}` });
  },

  goCourseProgress(e) {
    const focusCourseId = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || '';
    wx.navigateTo({
      url: `/pages/course/progress?from=courses${focusCourseId ? `&focusCourseId=${focusCourseId}` : ''}`
    });
  },

  onGoProgress(e) {
    const id = e.currentTarget.dataset.id;
    this.goCourseProgress({ currentTarget: { dataset: { id } } });
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  }
});
