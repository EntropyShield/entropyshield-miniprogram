// pages/tradeRecord/index.js
const store = require('../../utils/mainchainStore.js');
const linkage = require('../../utils/mainchainLinkage.js');
const consent = require('../../utils/consent.js');

const PLAN_TYPE_MAP = {
  steady: '稳健方案',
  advanced: '加强方案'
};

const EXECUTION_OPTIONS = [
  { value: 'pending', label: '待执行' },
  { value: 'planned', label: '已计划' },
  { value: 'partial', label: '部分执行' },
  { value: 'deviated', label: '已偏离' },
  { value: 'done', label: '已完成' },
  { value: 'archived', label: '已归档' }
];

const EXECUTION_STATUS_MAP = EXECUTION_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

const DISPLAY_SOURCE = '熵盾风控系统';
const DISPLAY_VERSION = 'RiskOS1.0';

function safeList(v) {
  return Array.isArray(v) ? v : [];
}

function safeText(v, d = '') {
  if (v === undefined || v === null) return d;
  const s = String(v).trim();
  return s ? s : d;
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function fmtTime(v) {
  const n = Number(v || 0);
  if (!n) return '';
  const d = new Date(n);
  if (isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map(item => safeText(item, '')).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[，,、|]/)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

function tagsToText(value) {
  const list = normalizeTags(value);
  return list.length ? list.join(' / ') : '无';
}

function normalizeExecutionStatus(value) {
  const raw = safeText(value, '').toLowerCase();
  return raw || 'pending';
}

function getExecutionIndex(status) {
  const key = normalizeExecutionStatus(status);
  const idx = EXECUTION_OPTIONS.findIndex(item => item.value === key);
  return idx >= 0 ? idx : 0;
}

function getPlanTypeText(v) {
  return PLAN_TYPE_MAP[v] || safeText(v, '当前方案');
}

function getExecutionStatusText(v) {
  const key = normalizeExecutionStatus(v);
  return EXECUTION_STATUS_MAP[key] || safeText(v, '待执行');
}

function buildEvalForm(entity = {}) {
  const status = normalizeExecutionStatus(entity.executionStatus);
  const index = getExecutionIndex(status);
  return {
    srrScoreInput: entity.srrScore === null || entity.srrScore === undefined || entity.srrScore === ''
      ? ''
      : String(entity.srrScore),
    executionStatus: status,
    executionStatusIndex: index,
    executionStatusText: EXECUTION_OPTIONS[index].label,
    deviationTagsInput: normalizeTags(entity.deviationTags).join('、'),
    groupTagInput: safeText(entity.groupTag, ''),
    stageTagInput: safeText(entity.stageTag, ''),
    archiveTagsInput: normalizeTags(entity.archiveTags).join('、')
  };
}

function normalizeRecord(item = {}) {
  const steps = safeList(item.steps);
  const firstStep = steps.find(step => step && (step.stopPrice || step.buyPrice)) || {};
  const stopAmounts = steps
    .map(step => safeNum(step && step.stopAmount))
    .filter(Number.isFinite);
  const negativeStops = stopAmounts.filter(v => v < 0);
  const derivedMaxLoss = negativeStops.length ? Math.abs(Math.min(...negativeStops)).toFixed(2) : '';

  const stopLossPrice = safeText(item.stopLossPrice || item.stopPrice || firstStep.stopPrice || '', '');
  const maxLossAmount = safeText(
    item.maxLossAmount || item.riskAmount || item.totalRisk || item.totalLoss || derivedMaxLoss,
    ''
  );

  const deviationTags = normalizeTags(item.deviationTags);
  const archiveTags = normalizeTags(item.archiveTags);

  return {
    ...item,
    stopLossPrice: stopLossPrice || '—',
    maxLossAmount: maxLossAmount || '—',
    riskAmount: maxLossAmount || '—',
    totalRisk: maxLossAmount || '—',
    totalLoss: maxLossAmount || '—',
    source: safeText(item.source, DISPLAY_SOURCE),
    entryVersion: safeText(item.entryVersion, DISPLAY_VERSION),
    planTypeText: getPlanTypeText(item.planType),
    executionStatus: normalizeExecutionStatus(item.executionStatus),
    executionStatusText: getExecutionStatusText(item.executionStatus),
    srrScoreText: item.srrScore === null || item.srrScore === undefined || item.srrScore === ''
      ? '待评分'
      : String(item.srrScore),
    deviationTags,
    deviationTagsText: deviationTags.length ? deviationTags.join(' / ') : '无',
    groupTag: safeText(item.groupTag, ''),
    stageTag: safeText(item.stageTag, ''),
    archiveTags,
    archiveTagsText: archiveTags.length ? archiveTags.join(' / ') : '无',
    timeText: fmtTime(item.savedAt || item.generatedAt || item.createdAt || 0),
    __activeKey: safeText(item.recordId || item.reportId || item.id, ''),
    reportId: safeText(item.reportId, ''),
    recordId: safeText(item.recordId, '')
  };
}

function moveHitToTop(list = [], hitIndex = -1) {
  if (!Array.isArray(list) || !list.length || hitIndex <= 0) return list;
  const hit = list[hitIndex];
  const next = list.slice();
  next.splice(hitIndex, 1);
  next.unshift(hit);
  return next;
}

Page({
  data: {
    list: [],
    currentItem: null,
    totalCount: 0,
    latestTime: '',
    planTypeMap: PLAN_TYPE_MAP,
    executionOptionLabels: EXECUTION_OPTIONS.map(item => item.label),
    executionStatus: 'pending',
    executionStatusIndex: 0,
    executionStatusText: EXECUTION_OPTIONS[0].label,
    srrScoreInput: '',
    deviationTagsInput: '',
    groupTagInput: '',
    stageTagInput: '',
    archiveTagsInput: '',
    savingEvaluation: false,
    from: '',
    focus: '',
    reportId: '',
    emptyText: '暂无交易记录'
  },

  onLoad(options = {}) {
    this.setData({
      from: safeText(options.from, ''),
      focus: safeText(options.focus, ''),
      reportId: safeText(options.reportId, ''),
      piplShow: consent.needConsent('portfolio')
    });
    this.loadList();
  },

  // A2：敏感数据（持仓/交易）单独同意 —— 同意回调
  onPiplAgree() {
    consent.setConsent('portfolio');
    this.setData({ piplShow: false });
  },

  // A2：敏感数据单独同意 —— 拒绝则退出录入（PIPL 要求授权后方可收集）
  onPiplDecline() {
    wx.showToast({ title: '需授权后方可录入', icon: 'none' });
    setTimeout(() => {
      wx.navigateBack({
        delta: 1,
        fail() { wx.reLaunch({ url: '/pages/index/index' }); }
      });
    }, 1200);
  },

  onShow() {
    this.loadList();
  },

  setEvaluationForm(entity = {}) {
    this.setData(buildEvalForm(entity));
  },

  loadList() {
    const raw = store.getTradeRecords ? store.getTradeRecords() : [];
    let list = safeList(raw).map(item => normalizeRecord(item));

    const reportId = safeText(this.data.reportId, '');
    let hitIndex = -1;

    if (reportId) {
      hitIndex = list.findIndex(item => safeText(item.reportId, '') === reportId);
      list = moveHitToTop(list, hitIndex);
    }

    const currentItem = list[0] || null;

    this.setData({
      list,
      currentItem,
      totalCount: list.length,
      latestTime: currentItem ? safeText(currentItem.timeText, '') : ''
    });

    if (currentItem) {
      this.setEvaluationForm(currentItem);
    }
  },

  getCurrentReportId() {
    const current = this.data.currentItem || {};
    const latest = store.getLatestRiskReport ? (store.getLatestRiskReport() || {}) : {};
    return safeText(this.data.reportId || current.reportId || latest.reportId || '', '');
  },

  onFormInput(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({
      [field]: safeText(e.detail && e.detail.value, '')
    });
  },

  onExecutionChange(e) {
    const index = Number(e.detail && e.detail.value);
    const next = EXECUTION_OPTIONS[index] || EXECUTION_OPTIONS[0];
    this.setData({
      executionStatusIndex: index,
      executionStatus: next.value,
      executionStatusText: next.label
    });
  },

  saveEvaluation() {
    // A2：敏感数据落库前必须已取得单独同意
    if (consent.needConsent('portfolio')) {
      this.setData({ piplShow: true });
      return;
    }
    const reportId = this.getCurrentReportId();
    if (!reportId) {
      wx.showToast({ title: '当前记录没有关联报告', icon: 'none' });
      return;
    }

    const scoreText = safeText(this.data.srrScoreInput, '');
    let srrScore = null;
    if (scoreText) {
      const num = Number(scoreText);
      if (!Number.isFinite(num)) {
        wx.showToast({ title: 'SRR 评分格式错误', icon: 'none' });
        return;
      }
      srrScore = num;
    }

    const patch = {
      srrScore,
      executionStatus: this.data.executionStatus || 'pending',
      deviationTags: normalizeTags(this.data.deviationTagsInput),
      groupTag: safeText(this.data.groupTagInput, ''),
      stageTag: safeText(this.data.stageTagInput, ''),
      archiveTags: normalizeTags(this.data.archiveTagsInput)
    };

    this.setData({ savingEvaluation: true });

    try {
      const updated = store.applyEvaluationToChain
        ? store.applyEvaluationToChain(reportId, patch)
        : null;

      if (!updated) {
        wx.showToast({ title: '回写失败', icon: 'none' });
        return;
      }

      this.loadList();
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (err) {
      console.error('[tradeRecord] saveEvaluation error', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ savingEvaluation: false });
    }
  },

  goRiskReport() {
    const reportId = this.getCurrentReportId();
    if (!reportId) {
      wx.showToast({ title: '暂无风控报告', icon: 'none' });
      return;
    }
    wx.redirectTo({
      url: linkage.buildNavUrl('/pkgReport/riskReport/index', {
        from: 'tradeRecord',
        focus: 'reportId',
        reportId
      })
    });
  },

  goLongArchive() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pkgReport/longArchive/index', {
        from: 'tradeRecord',
        focus: reportId ? 'reportId' : 'latest',
        reportId
      })
    });
  },

  goMainchainOverview() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pkgService/mainchainOverview/index', {
        from: 'tradeRecord',
        focus: reportId ? 'reportId' : 'latest',
        reportId
      })
    });
  },

  goRiskCalculator() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index?from=tradeRecord'
    });
  }
});