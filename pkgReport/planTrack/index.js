// pkgReport/planTrack/index.js
// 方案存续跟踪（D-7，2026-09-10）：已落地方案对照当前参考价
// 行情源：复用腾讯财经 qt.gtimg.cn（与风险温度同源，免费无 key）；合规口径仅作参考价，不展示收益率/盈亏。
const mainchainStore = require('../../utils/mainchainStore.js');
const CONFIG = require('../../config.js');

Page({
  data: {
    plans: [],
    loading: true
  },

  onShow() {
    this.loadPlans();
  },

  loadPlans() {
    const raw = mainchainStore.getAllPlanResults() || [];
    const plans = raw
      .filter(p => p && p.code && p.firstPrice)
      .map((p, i) => ({
        key: String(p.draftId || p.resultId || ('p' + i)),
        code: String(p.code || ''),
        stockName: String(p.stockName || p.name || p.code || ''),
        entryPrice: Number(p.firstPrice) || 0,
        price: null,
        chgPct: null,
        devPct: null,
        loading: true,
        err: ''
      }));
    this.setData({ plans, loading: false });
    plans.forEach((pl, idx) => this.fetchQuote(pl.code, idx));
  },

  fetchQuote(code, idx) {
    const base = (CONFIG && CONFIG.API_BASE) ? CONFIG.API_BASE : '';
    if (!base) return;
    const self = this;
    wx.request({
      url: base + '/api/daily/quote?code=' + encodeURIComponent(code),
      method: 'GET',
      timeout: 6000,
      success(res) {
        const r = res && res.data;
        if (!r || !r.ok) {
          self.updatePlan(idx, { loading: false, err: '行情获取失败' });
          return;
        }
        const price = Number(r.price) || 0;
        const entry = self.data.plans[idx] ? self.data.plans[idx].entryPrice : 0;
        const dev = entry > 0 ? ((price - entry) / entry) * 100 : null;
        self.updatePlan(idx, {
          loading: false,
          price,
          chgPct: Number(r.chgPct) || 0,
          devPct: dev,
          stockName: r.name || self.data.plans[idx].stockName
        });
      },
      fail() {
        self.updatePlan(idx, { loading: false, err: '网络异常' });
      }
    });
  },

  updatePlan(idx, patch) {
    const plans = this.data.plans.slice();
    if (!plans[idx]) return;
    plans[idx] = Object.assign({}, plans[idx], patch);
    this.setData({ plans });
  },

  goPlan(e) {
    const draft = e.currentTarget.dataset.draft;
    if (draft) wx.navigateTo({ url: '/pkgReport/planSteady/index?draftId=' + draft });
  }
});
