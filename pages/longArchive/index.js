// pages/longArchive/index.js
const mainchainAi = require('../../utils/mainchainAi.js');
const store = require('../../utils/mainchainStore.js');
const linkage = require('../../utils/mainchainLinkage.js');

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

function normalizeArchive(item = {}) {
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
  const disciplineTips = normalizeTags(item.disciplineTips);

  return {
    ...item,
    stopLossPrice: stopLossPrice || '—',
    maxLossAmount: maxLossAmount || '—',
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
    disciplineTips,
    timeText: fmtTime(item.archivedAt || item.savedAt || item.createdAt || item.generatedAt || 0),
    reportId: safeText(item.reportId, ''),
    archiveId: safeText(item.archiveId, '')
  };
}

function resolveArchive(reportId, archiveId) {
  const rid = safeText(reportId, '');
  const aid = safeText(archiveId, '');

  if (aid && store.getLongArchiveById) {
    const byId = store.getLongArchiveById(aid);
    if (byId) return byId;
  }

  const list = store.getLongArchivesSorted ? store.getLongArchivesSorted() : [];
  if (rid) {
    const hit = safeList(list).find(item => safeText(item.reportId, '') === rid);
    if (hit) return hit;
  }

  return safeList(list)[0] || null;
}

Page({
  data: {
    from: '',
    focus: '',
    reportId: '',
    archiveId: '',
    archive: null,
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
    emptyText: '暂无长期档案',
    aiReviewLoading: false,
    aiReviewError: '',
    aiReview: null
  },

  onLoad(options = {}) {
    this.setData({
      from: safeText(options.from, ''),
      focus: safeText(options.focus, ''),
      reportId: safeText(options.reportId, ''),
      archiveId: safeText(options.archiveId, '')
    });
    this.loadArchive();
  },

  onShow() {
    this.loadArchive();
  },

  setEvaluationForm(entity = {}) {
    this.setData(buildEvalForm(entity));
  },

  loadArchive() {
    const archive = resolveArchive(this.data.reportId, this.data.archiveId);
    const normalized = archive ? normalizeArchive(archive) : null;
    this.setData({ archive: normalized });

    if (normalized) {
      this.setEvaluationForm(normalized);
    }
  },

  getCurrentReportId() {
    return safeText(this.data.reportId || (this.data.archive && this.data.archive.reportId), '');
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
    const reportId = this.getCurrentReportId();
    if (!reportId) {
      wx.showToast({ title: '当前档案没有关联报告', icon: 'none' });
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

      this.loadArchive();
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (err) {
      console.error('[longArchive] saveEvaluation error', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ savingEvaluation: false });
    }
  },

  goTradeRecord() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/tradeRecord/index', {
        from: 'longArchive',
        focus: reportId ? 'reportId' : 'latest',
        reportId
      })
    });
  },

  goRiskReport() {
    const reportId = this.getCurrentReportId();
    if (!reportId) {
      wx.showToast({ title: '暂无风控报告', icon: 'none' });
      return;
    }
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/riskReport/index', {
        from: 'longArchive',
        focus: 'reportId',
        reportId
      })
    });
  },

  goMainchainOverview() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pages/mainchainOverview/index', {
        from: 'longArchive',
        focus: reportId ? 'reportId' : 'latest',
        reportId
      })
    });
  },

  // ====== [MOD:LONGARCHIVE_AI_REVIEW_20260330] START ======
  getActiveArchive() {
    return this.data.currentArchive || this.data.latestArchive || this.data.archive || {};
  },

  buildAiReviewContext() {
    return {
      archive: this.getActiveArchive()
    };
  },

  getAiArchiveReportId() {
    const archive = this.getActiveArchive();
    return String(
      archive.reportId ||
      this.data.reportId ||
      ''
    ).trim();
  },

  async runAiReview() {
    const archive = this.getActiveArchive();
    if (!archive || !Object.keys(archive).length) {
      wx.showToast({ title: '暂无长期档案', icon: 'none' });
      return;
    }

    const clientId = String(wx.getStorageSync('clientId') || '').trim();
    const reportId = this.getAiArchiveReportId();

    this.setData({
      aiReviewLoading: true,
      aiReviewError: '',
      aiReview: null
    });

    try {
      const res = await mainchainAi.runArchiveReview({
        clientId,
        reportId,
        sourcePage: 'longArchive',
        entryVersion: String(archive.entryVersion || 'V1.4'),
        context: this.buildAiReviewContext()
      });

      const data = (res && res.data) || {};
      this.setData({
        aiReview: {
          summary: String(data.summary || ''),
          disciplineReview: String(data.disciplineReview || ''),
          recurringBiases: Array.isArray(data.recurringBiases) ? data.recurringBiases : [],
          nextCycleChecklist: Array.isArray(data.nextCycleChecklist) ? data.nextCycleChecklist : []
        }
      });
    } catch (err) {
      console.error('[longArchive] runAiReview error', err);
      this.setData({
        aiReviewError: 'AI 复盘暂时不可用'
      });
    } finally {
      this.setData({
        aiReviewLoading: false
      });
    }
  },
  // ====== [MOD:LONGARCHIVE_AI_REVIEW_20260330] END ======

  goRiskCalculator() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index?from=longArchive'
    });
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});