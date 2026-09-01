// pages/riskReport/index.js
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

function normalizeReport(item = {}) {
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

  const displaySteps = steps.map((step, index) => {
    return {
      index: index + 1,
      displayText: `建仓价 ${safeText(step.buyPrice, '—')} / 数量 ${safeText(step.buyShares, '—')} / 止损价 ${safeText(step.stopPrice, '—')} / 止损额 ${safeText(step.stopAmount, '—')}`
    };
  });

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
    timeText: fmtTime(item.createdAt || item.generatedAt || 0),
    displaySteps
  };
}

Page({
  data: {
    from: '',
    focus: '',
    reportId: '',
    report: null,
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
    emptyText: '暂无风控报告'
  },

  onLoad(options = {}) {
    this.setData({
      from: safeText(options.from, ''),
      focus: safeText(options.focus, ''),
      reportId: safeText(options.reportId, '')
    });
    this.loadReport();
  },

  onShow() {
    this.loadReport();
  },

  setEvaluationForm(entity = {}) {
    this.setData(buildEvalForm(entity));
  },

  loadReport() {
    const reportId = safeText(this.data.reportId, '');
    let report = null;

    if (store.getResolvedRiskReport) {
      report = store.getResolvedRiskReport(reportId);
    } else if (store.getLatestRiskReport) {
      report = store.getLatestRiskReport();
    }

    const normalized = report ? normalizeReport(report) : null;
    this.setData({ report: normalized });

    if (normalized) {
      this.setEvaluationForm(normalized);
    }
  },

  getCurrentReportId() {
    return safeText(this.data.reportId || (this.data.report && this.data.report.reportId), '');
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
      wx.showToast({ title: '没有可回写的报告', icon: 'none' });
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

      this.loadReport();
      wx.showToast({ title: '已保存', icon: 'success' });
    } catch (err) {
      console.error('[riskReport] saveEvaluation error', err);
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ savingEvaluation: false });
    }
  },

  // ====== [MOD:RISKREPORT_AI_EXPLAIN_20260330] START ======
  buildAiExplainContext() {
    return {
      report: this.data.report || {}
    };
  },

  async runAiExplain() {
    const report = this.data.report || {};
    if (!report || !Object.keys(report).length) {
      wx.showToast({ title: '暂无风控报告', icon: 'none' });
      return;
    }

    const reportId = typeof this.getCurrentReportId === 'function'
      ? this.getCurrentReportId()
      : String(this.data.reportId || report.reportId || '').trim();

    const clientId = String(wx.getStorageSync('clientId') || '').trim();

    this.setData({
      aiExplainLoading: true,
      aiExplainError: ''
    });

    try {
      const res = await mainchainAi.runReportExplain({
        clientId,
        reportId,
        sourcePage: 'riskReport',
        entryVersion: String(report.entryVersion || 'V1.4'),
        context: this.buildAiExplainContext()
      });

      const data = (res && res.data) || {};
      this.setData({
        aiExplain: {
          summary: String(data.summary || ''),
          riskFocus: Array.isArray(data.riskFocus) ? data.riskFocus : [],
          scoreInterpretation: String(data.scoreInterpretation || ''),
          nextActions: Array.isArray(data.nextActions) ? data.nextActions : []
        }
      });
    } catch (err) {
      this.setData({
        aiExplainError: 'AI 解读暂时不可用'
      });
    } finally {
      this.setData({
        aiExplainLoading: false
      });
    }
  },
  // ====== [MOD:RISKREPORT_AI_EXPLAIN_20260330] END ======
  saveLongArchive() {
    const report = this.data.report;
    if (!report) {
      wx.showToast({ title: '暂无风控报告', icon: 'none' });
      return;
    }

    try {
      const archive = store.saveLongArchiveFromReport
        ? store.saveLongArchiveFromReport(report)
        : null;

      if (!archive) {
        wx.showToast({ title: '加入档案失败', icon: 'none' });
        return;
      }

      wx.redirectTo({
        url: linkage.buildNavUrl('/pkgReport/longArchive/index', {
          from: 'riskReport',
          focus: 'reportId',
          reportId: archive.reportId || report.reportId,
          archiveId: archive.archiveId || ''
        })
      });
    } catch (err) {
      console.error('[riskReport] saveLongArchive error', err);
      wx.showToast({ title: '加入档案失败', icon: 'none' });
    }
  },

  goTradeRecord() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pkgReport/tradeRecord/index', {
        from: 'riskReport',
        focus: reportId ? 'reportId' : 'latest',
        reportId
      })
    });
  },

  goLongArchive() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pkgReport/longArchive/index', {
        from: 'riskReport',
        focus: reportId ? 'reportId' : 'latest',
        reportId
      })
    });
  },

  goMainchainOverview() {
    const reportId = this.getCurrentReportId();
    wx.redirectTo({
      url: linkage.buildNavUrl('/pkgService/mainchainOverview/index', {
        from: 'riskReport',
        focus: reportId ? 'reportId' : 'latest',
        reportId
      })
    });
  },

  goRiskCalculator() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index?from=riskReport'
    });
  },

  goHome() {
    wx.reLaunch({
      url: '/pages/index/index'
    });
  }
});