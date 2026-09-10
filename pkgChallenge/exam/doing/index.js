// pkgChallenge/exam/doing/index.js —— A-1 统考答题页（20 题，服务端算分 + 防作弊）
const examApi = require('../../utils/examApi.js');

const MIN_VALID_MS = 60 * 1000; // 与服务端防作弊阈值一致（仅用于前端提示，判定仍由后端做）

Page({
  data: {
    questions: [],
    loading: true,
    answeredCount: 0,
    total: 0,
    elapsed: 0,
    elapsedText: '00:00',
    submitting: false
  },

  onLoad() {
    examApi.ensureLocalClientId();
    this._startTs = Date.now();
    this._timer = null;
    this.loadQuestions();
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },

  async loadQuestions() {
    try {
      const res = examApi.questions();
      const d = (res && res.ok && res.questions) || [];
      const questions = d.map((q) => ({
        id: q.id,
        dim: q.dim,
        dimName: q.dimName || '',
        stem: q.stem,
        options: (q.options || []).map((o) => ({ key: o.key, text: o.text })),
        selected: null
      }));
      this.setData({ questions, total: questions.length, loading: false });
      this.startTimer();
    } catch (e) {
      this.setData({ loading: false });
      wx.showToast({ title: '题目加载失败', icon: 'none' });
    }
  },

  startTimer() {
    this._timer = setInterval(() => {
      const ms = Date.now() - this._startTs;
      const s = Math.floor(ms / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      this.setData({ elapsed: ms, elapsedText: `${mm}:${ss}` });
    }, 1000);
  },

  onSelect(e) {
    const { qindex, key } = e.currentTarget.dataset;
    if (this.data.submitting) return;
    const questions = this.data.questions;
    const q = questions[qindex];
    if (!q) return;
    const firstAnswer = q.selected === null;
    q.selected = key;
    questions[qindex] = q;
    this.setData({
      questions,
      answeredCount: firstAnswer ? this.data.answeredCount + 1 : this.data.answeredCount
    });
  },

  onSubmit() {
    if (this.data.submitting) return;
    if (this.data.answeredCount < this.data.total) {
      wx.showToast({ title: `还有 ${this.data.total - this.data.answeredCount} 题未作答`, icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    const durationMs = Date.now() - this._startTs;
    const answers = this.data.questions.map((q) => ({ qid: q.id, opt: q.selected }));

    examApi.submit(answers, durationMs).then((res) => {
      if (!res || !res.ok) {
        this.setData({ submitting: false });
        wx.showToast({ title: '交卷失败，请重试', icon: 'none' });
        return;
      }
      const data = res.data || {};
      try {
        wx.setStorageSync('examLastResult', {
          score: data.score,
          levelTag: data.levelTag,
          correct: data.correct,
          total: data.total,
          dimStat: data.dimStat,
          valid: data.valid,
          counted: data.counted
        });
      } catch (e) {}
      if (this._timer) clearInterval(this._timer);
      wx.redirectTo({ url: '/pkgChallenge/exam/result/index' });
    }).catch(() => {
      this.setData({ submitting: false });
      wx.showToast({ title: '交卷失败，请重试', icon: 'none' });
    });
  },

  onBack() {
    wx.navigateBack({ delta: 1 });
  }
});
