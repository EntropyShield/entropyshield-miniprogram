// utils/mainchainApi.js
const store = require('./mainchainStore.js');

let API_BASE_FROM_CONFIG = '';
try {
  const cfg = require('../config');
  API_BASE_FROM_CONFIG = String(cfg.API_BASE || cfg.API_BASE_URL || '').trim();
} catch (e) {}

const SYNC_KEYS = {
  LAST_MAP: 'mainchainLastSyncMap',
  HISTORY: 'mainchainSyncHistory',
  QUEUE: 'mainchainSyncQueue',
  MODE: 'mainchainApiMode',
  BASE: 'mainchainApiBase'
};

const ALLOWED_MODES = ['local-only', 'api-ready'];
const DEFAULT_MODE = 'local-only';

function getClientId() {
  return String(wx.getStorageSync('clientId') || '').trim();
}

function normalizeMode(mode) {
  const m = String(mode || '').trim();
  return ALLOWED_MODES.includes(m) ? m : DEFAULT_MODE;
}

function getApiMode() {
  const storageMode = wx.getStorageSync(SYNC_KEYS.MODE);
  return normalizeMode(storageMode);
}

function setApiMode(mode) {
  const next = normalizeMode(mode);
  wx.setStorageSync(SYNC_KEYS.MODE, next);
  return next;
}

function getApiBase() {
  const storageBase = String(wx.getStorageSync(SYNC_KEYS.BASE) || '').trim();
  return storageBase || API_BASE_FROM_CONFIG || '';
}

function setApiBase(base) {
  const next = String(base || '').trim();
  wx.setStorageSync(SYNC_KEYS.BASE, next);
  return next;
}

function buildEnvelope(entityType, payload) {
  return store.buildSyncPayload(entityType, payload, getClientId());
}

function extractEntityId(entityType, payload = {}) {
  const p = payload || {};
  switch (String(entityType || '')) {
    case 'riskCalcDraft':
      return p.draftId || '';
    case 'riskPlanResult':
      return p.resultId || '';
    case 'riskTradeRecord':
      return p.recordId || p.resultId || '';
    case 'riskReport':
      return p.reportId || p.resultId || '';
    case 'riskLongArchive':
      return p.archiveId || p.reportId || '';
    default:
      return p.id || p.resultId || p.reportId || p.recordId || p.archiveId || p.draftId || '';
  }
}

function buildEntityKey(entityType, payload = {}) {
  const entityId = extractEntityId(entityType, payload) || `temp_${Date.now()}`;
  return `${String(entityType || '')}:${entityId}`;
}

function getLastSyncMap() {
  return wx.getStorageSync(SYNC_KEYS.LAST_MAP) || {};
}

function getSyncHistory() {
  return Array.isArray(wx.getStorageSync(SYNC_KEYS.HISTORY))
    ? wx.getStorageSync(SYNC_KEYS.HISTORY)
    : [];
}

function getSyncQueue() {
  return Array.isArray(wx.getStorageSync(SYNC_KEYS.QUEUE))
    ? wx.getStorageSync(SYNC_KEYS.QUEUE)
    : [];
}


function clearSyncState(options = {}) {
  const keepMode = options.keepMode !== false;
  const keepBase = options.keepBase !== false;

  wx.removeStorageSync(SYNC_KEYS.LAST_MAP);
  wx.removeStorageSync(SYNC_KEYS.HISTORY);
  wx.removeStorageSync(SYNC_KEYS.QUEUE);

  if (!keepMode) {
    wx.removeStorageSync(SYNC_KEYS.MODE);
  }
  if (!keepBase) {
    wx.removeStorageSync(SYNC_KEYS.BASE);
  }

  return {
    keepMode,
    keepBase
  };
}

function saveSyncReceipt(entityType, receipt) {
  const map = getLastSyncMap();
  map[String(entityType || '')] = receipt;
  wx.setStorageSync(SYNC_KEYS.LAST_MAP, map);

  const history = getSyncHistory();
  history.unshift(receipt);
  wx.setStorageSync(SYNC_KEYS.HISTORY, history.slice(0, 300));

  return receipt;
}

function saveSyncQueueTask(task) {
  const queue = getSyncQueue();
  const entityKey = String(task.entityKey || '');
  const next = [task].concat(queue.filter(item => String(item.entityKey || '') !== entityKey));
  wx.setStorageSync(SYNC_KEYS.QUEUE, next.slice(0, 300));
  return task;
}

function updateSyncQueueTask(entityKey, patch = {}) {
  const queue = getSyncQueue();
  const next = queue.map(item => {
    if (String(item.entityKey || '') !== String(entityKey || '')) return item;
    return { ...item, ...patch };
  });
  wx.setStorageSync(SYNC_KEYS.QUEUE, next);
  return next.find(item => String(item.entityKey || '') === String(entityKey || '')) || null;
}

function buildQueueTask(entityType, payload) {
  const mode = getApiMode();
  const entityKey = buildEntityKey(entityType, payload);
  return {
    taskId: `sync_${Date.now()}`,
    entityType: String(entityType || ''),
    entityKey,
    entityId: extractEntityId(entityType, payload),
    mode,
    status: mode === 'local-only' ? 'synced' : 'queued',
    createdAt: Date.now(),
    syncedAt: mode === 'local-only' ? Date.now() : 0,
    envelope: buildEnvelope(entityType, payload)
  };
}

function buildReceiptFromTask(task, extra = {}) {
  return {
    ok: extra.ok !== undefined ? !!extra.ok : true,
    mode: task.mode,
    entityType: task.entityType,
    entityKey: task.entityKey,
    entityId: task.entityId,
    status: extra.status || task.status || 'synced',
    syncedAt: extra.syncedAt !== undefined ? extra.syncedAt : (task.syncedAt || 0),
    envelope: task.envelope,
    remote: extra.remote || null,
    error: extra.error || ''
  };
}

function requestSync(task) {
  const mode = String(task.mode || getApiMode());

  if (mode !== 'api-ready') {
    const syncedTask = updateSyncQueueTask(task.entityKey, {
      status: 'synced',
      syncedAt: Date.now()
    }) || { ...task, status: 'synced', syncedAt: Date.now() };

    return saveSyncReceipt(task.entityType, buildReceiptFromTask(syncedTask, {
      ok: true,
      status: 'synced',
      syncedAt: syncedTask.syncedAt
    }));
  }

  const apiBase = getApiBase();
  if (!apiBase) {
    const failedTask = updateSyncQueueTask(task.entityKey, {
      status: 'failed',
      failedAt: Date.now(),
      error: 'missing_api_base'
    }) || { ...task, status: 'failed', failedAt: Date.now(), error: 'missing_api_base' };

    return saveSyncReceipt(task.entityType, buildReceiptFromTask(failedTask, {
      ok: false,
      status: 'failed',
      error: 'missing_api_base'
    }));
  }

  wx.request({
    url: `${apiBase.replace(/\/$/, '')}/api/mainchain/sync`,
    method: 'POST',
    data: task.envelope,
    header: {
      'content-type': 'application/json'
    },
    success(res) {
      const ok = !!(res && res.statusCode >= 200 && res.statusCode < 300);
      if (ok) {
        const syncedAt = Date.now();
        const syncedTask = updateSyncQueueTask(task.entityKey, {
          status: 'synced',
          syncedAt,
          responseCode: res.statusCode
        }) || { ...task, status: 'synced', syncedAt, responseCode: res.statusCode };

        saveSyncReceipt(task.entityType, buildReceiptFromTask(syncedTask, {
          ok: true,
          status: 'synced',
          syncedAt,
          remote: {
            statusCode: res.statusCode
          }
        }));
      } else {
        const failedTask = updateSyncQueueTask(task.entityKey, {
          status: 'failed',
          failedAt: Date.now(),
          responseCode: res.statusCode,
          error: `http_${res.statusCode}`
        }) || { ...task, status: 'failed', failedAt: Date.now(), responseCode: res.statusCode, error: `http_${res.statusCode}` };

        saveSyncReceipt(task.entityType, buildReceiptFromTask(failedTask, {
          ok: false,
          status: 'failed',
          error: `http_${res.statusCode}`,
          remote: {
            statusCode: res.statusCode
          }
        }));
      }
    },
    fail(err) {
      const failedTask = updateSyncQueueTask(task.entityKey, {
        status: 'failed',
        failedAt: Date.now(),
        error: String((err && err.errMsg) || 'request_failed')
      }) || { ...task, status: 'failed', failedAt: Date.now(), error: String((err && err.errMsg) || 'request_failed') };

      saveSyncReceipt(task.entityType, buildReceiptFromTask(failedTask, {
        ok: false,
        status: 'failed',
        error: String((err && err.errMsg) || 'request_failed')
      }));
    }
  });

  return saveSyncReceipt(task.entityType, buildReceiptFromTask(task, {
    ok: true,
    status: 'queued',
    syncedAt: 0
  }));
}

function syncEntity(entityType, payload) {
  const task = buildQueueTask(entityType, payload);
  if (String(task.mode || '') === 'api-ready') {
    saveSyncQueueTask(task);
  }
  return requestSync(task);
}

function orchestratePersist(entityType, persistFn, payload) {
  const saved = persistFn(payload);
  const receipt = syncEntity(entityType, saved);
  return { saved, receipt };
}

function syncRiskCalcDraft(payload) {
  return syncEntity('riskCalcDraft', payload);
}

function syncPlanResult(payload) {
  return syncEntity('riskPlanResult', payload);
}

function syncTradeRecord(payload) {
  return syncEntity('riskTradeRecord', payload);
}

function syncRiskReport(payload) {
  return syncEntity('riskReport', payload);
}

function syncLongArchive(payload) {
  return syncEntity('riskLongArchive', payload);
}

function persistRiskCalcDraft(payload) {
  return orchestratePersist('riskCalcDraft', store.saveRiskCalcDraft, payload);
}

function persistPlanResult(payload) {
  return orchestratePersist('riskPlanResult', store.savePlanResult, payload);
}

function persistTradeRecord(payload) {
  return orchestratePersist('riskTradeRecord', store.saveTradeRecord, payload);
}

function persistRiskReport(payload) {
  return orchestratePersist('riskReport', store.saveRiskReport, payload);
}

function persistLongArchive(payload) {
  return orchestratePersist('riskLongArchive', store.saveLongArchive, payload);
}

function persistLongArchiveFromReport(report) {
  const saved = store.saveLongArchiveFromReport(report);
  const receipt = syncEntity('riskLongArchive', saved);
  return { saved, receipt };
}

function flushSyncQueue() {
  const queue = getSyncQueue();
  queue
    .filter(item => item && item.mode === 'api-ready' && (item.status === 'queued' || item.status === 'failed'))
    .forEach(item => requestSync(item));
  return getSyncQueue();
}

module.exports = {
  SYNC_KEYS,

  getClientId,
  getApiMode,
  setApiMode,
  getApiBase,
  setApiBase,

  buildEnvelope,
  extractEntityId,
  buildEntityKey,

  getLastSyncMap,
  getSyncHistory,
  getSyncQueue,
  clearSyncState,

  saveSyncReceipt,
  saveSyncQueueTask,
  updateSyncQueueTask,
  buildQueueTask,
  buildReceiptFromTask,
  requestSync,
  syncEntity,
  orchestratePersist,

  syncRiskCalcDraft,
  syncPlanResult,
  syncTradeRecord,
  syncRiskReport,
  syncLongArchive,

  persistRiskCalcDraft,
  persistPlanResult,
  persistTradeRecord,
  persistRiskReport,
  persistLongArchive,
  persistLongArchiveFromReport,

  flushSyncQueue
};