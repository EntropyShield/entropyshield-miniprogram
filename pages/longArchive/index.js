// pages/longArchive/index.js
const store = require('../../utils/mainchainStore.js');

function fmtTime(ts) {
  const n = Number(ts || 0);
  if (!n) return '';
  const d = new Date(n);
  if (isNaN(d.getTime())) return '';
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function safeList(v) {
  return Array.isArray(v) ? v : [];
}

function safeText(v, fallback = '') {
  if (v === undefined || v === null || v === '') return fallback;
  return String(v);
}

function buildAiReview(item = {}) {
  const steps = safeList(item.steps);
  const riskAmount = safeText(
    item.maxLossAmount || item.riskAmount || item.totalRisk || item.totalLoss,
    '已按方案约束'
  );
  const planTypeMap = {
    steady: '稳健版',
    advanced: '加强版'
  };
  const planTypeText = planTypeMap[item.planType] || safeText(item.planType, '当前方案');

  return {
    summary: `${planTypeText}已归档，重点是把一次性方案沉淀为可复盘的长期样本。`,
    mistakeReview: steps.length
      ? `本条档案包含 ${steps.length} 个执行步骤，复盘时重点检查是否按步骤执行，而不是只看盈亏结果。`
      : '本条档案未识别出明确步骤，后续需要重点补足执行过程记录。',
    disciplineReview: `本次方案的风险边界已锁定在 ${riskAmount} 的范围内，复盘时先检查是否严格遵守退出边界。`,
    behaviorReview: '优先复盘是否出现临时改规则、拖延止损、达到目标后继续恋战等行为偏差。',
    nextSuggestion: '建议把这条档案与交易记录、风控报告联合查看，形成下一轮固定执行模板。'
  };
}

Page({
  data: {
    list: [],
    totalCount: 0,
    latestTime: '',
    aiReviewMap: {},
    planTypeMap: {
      steady: '稳健版',
      advanced: '加强版'
    }
  },

  onShow() {
    this.loadList();
  },

  loadList() {
    const raw = store.getLongArchivesSorted();
    const list = safeList(raw).map(item => ({
      ...item,
      archivedTimeText: fmtTime(item.archivedAt || item.createdAt || item.generatedAt || 0)
    }));

    const aiReviewMap = {};
    list.forEach(item => {
      const key = item.archiveId || item.reportId || item.draftId || item.createdAt || Math.random();
      aiReviewMap[key] = buildAiReview(item);
    });

    this.setData({
      list,
      totalCount: list.length,
      latestTime: list.length ? list[0].archivedTimeText : '',
      aiReviewMap
    });
  },

  clearAll() {
    const list = this.data.list || [];
    if (!list.length) {
      wx.showToast({ title: '暂无长期档案', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认清空',
      content: '是否清空本地长期档案？此操作只影响当前设备缓存。',
      confirmText: '清空',
      cancelText: '取消',
      success: (r) => {
        if (!r.confirm) return;
        store.clearLongArchives();
        this.loadList();
        wx.showToast({ title: '已清空', icon: 'success' });
      }
    });
  },

  goRiskCalculator() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index?source=archive'
    });
  },

  goTradeRecord() {
    wx.navigateTo({
      url: '/pages/tradeRecord/index?from=longArchive'
    });
  },

  goLatestRiskReport() {
    const latest = store.getLatestRiskReport();
    if (!latest || !latest.reportId) {
      wx.showToast({ title: '暂无风控报告', icon: 'none' });
      return;
    }

    wx.navigateTo({
      url: '/pages/riskReport/index?reportId=' + encodeURIComponent(latest.reportId)
    });
  },

  goMainchainOverview() {
    wx.navigateTo({
      url: '/pages/mainchainOverview/index?from=longArchive'
    });
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});