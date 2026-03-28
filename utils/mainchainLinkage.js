// utils/mainchainLinkage.js
function safeText(v, d = '') {
  if (v === undefined || v === null) return d;
  return String(v).trim();
}

function parseNavOptions(options = {}, defaultFrom = '') {
  return {
    from: safeText(options.from, defaultFrom),
    focus: safeText(options.focus, ''),
    reportId: safeText(options.reportId, '')
  };
}

function buildNavUrl(pagePath, payload = {}) {
  const q = [];
  if (payload.from) q.push('from=' + encodeURIComponent(payload.from));
  if (payload.focus) q.push('focus=' + encodeURIComponent(payload.focus));
  if (payload.reportId) q.push('reportId=' + encodeURIComponent(payload.reportId));
  return pagePath + (q.length ? ('?' + q.join('&')) : '');
}

function pickReportId(item = {}) {
  return safeText(item.reportId || item.resultId || item.id || '');
}

function locateTradeItem(list = [], reportId = '', focus = '') {
  const rid = safeText(reportId, '');
  if (!Array.isArray(list) || !list.length) {
    return { index: -1, item: null, reportId: '' };
  }

  let hitIndex = -1;

  if (rid) {
    hitIndex = list.findIndex(item => {
      return safeText(item.reportId) === rid
        || safeText(item.resultId) === rid
        || safeText(item.recordId) === rid
        || safeText(item.id) === rid;
    });
  }

  if (hitIndex < 0 && focus === 'latest') {
    hitIndex = 0;
  }

  if (hitIndex < 0) return { index: -1, item: null, reportId: '' };

  const item = list[hitIndex] || {};
  return {
    index: hitIndex,
    item,
    reportId: safeText(item.reportId || rid, rid)
  };
}

function locateArchiveItem(list = [], reportId = '', focus = '') {
  const rid = safeText(reportId, '');
  if (!Array.isArray(list) || !list.length) {
    return { index: -1, item: null, reportId: '' };
  }

  let hitIndex = -1;

  if (rid) {
    hitIndex = list.findIndex(item => {
      return safeText(item.reportId) === rid
        || safeText(item.archiveId) === rid
        || safeText(item.draftId) === rid
        || safeText(item.id) === rid;
    });
  }

  if (hitIndex < 0 && focus === 'latest') {
    hitIndex = 0;
  }

  if (hitIndex < 0) return { index: -1, item: null, reportId: '' };

  const item = list[hitIndex] || {};
  return {
    index: hitIndex,
    item,
    reportId: safeText(item.reportId || rid, rid)
  };
}

module.exports = {
  safeText,
  parseNavOptions,
  buildNavUrl,
  pickReportId,
  locateTradeItem,
  locateArchiveItem
};
