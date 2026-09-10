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

/* ============================================================
 * 2026-09-10 新增（P1 主链数据后端化 · 读取方向）
 * 设计原则：
 *   1) mode !== 'api-ready' 时全部静默跳过（本地优先，零风险）
 *   2) 远端返回空列表时绝不覆盖本地 —— 防止"清空用户数据"事故
 *   3) 所有失败只记录不抛出 —— 同步是增强，永远是本地优先可用
 *   注：DEFAULT_MODE 已于 2026-09-10 切到 api-ready（后端已上线）
 * ============================================================ */

const PULL_TYPES = ['riskCalcDraft', 'riskPlanResult', 'riskTradeRecord', 'riskReport', 'riskLongArchive'];
const MIGRATE_FLAG = 'mainchainMigratedV1';

function apiUrl(path) {
  const base = String(getApiBase() || '').replace(/\/$/, '');
  return base ? `${base}${path}` : '';
}

function wxRequestPromise(options) {
  return new Promise(resolve => {
    wx.request(Object.assign({
      method: 'GET',
      header: { 'content-type': 'application/json' }
    }, options, {
      success: res => resolve(res || {}),
      fail: err => resolve({ statusCode: 0, errMsg: (err && err.errMsg) || 'request_failed' })
    }));
  });
}

/** 把远端列表写回本地（远端为空则跳过，绝不覆盖本地已有数据） */
function writeBackList(entityType, list) {
  if (!Array.isArray(list) || !list.length) return 0;
  const K = store.KEYS;

  if (entityType === 'riskTradeRecord') {
    wx.setStorageSync(K.TRADE_LIST, list.slice(0, 300));
    return list.length;
  }

  if (entityType === 'riskReport') {
    wx.setStorageSync(K.REPORT_HISTORY, list.slice(0, 300));
    const map = {};
    list.forEach(r => { if (r && r.reportId) map[String(r.reportId)] = r; });
    wx.setStorageSync(K.REPORT_BY_ID, map);
    wx.setStorageSync(K.REPORT_LATEST, list[0]);
    return list.length;
  }

  if (entityType === 'riskLongArchive') {
    wx.setStorageSync(K.ARCHIVE_LIST, list.slice(0, 300));
    const map = {};
    list.forEach(r => { if (r && r.archiveId) map[String(r.archiveId)] = r; });
    wx.setStorageSync(K.ARCHIVE_BY_ID, map);
    wx.setStorageSync(K.ARCHIVE_LATEST, list[0]);
    return list.length;
  }

  if (entityType === 'riskPlanResult') {
    wx.setStorageSync(K.PLAN_LATEST, list[0]);
    const map = {};
    list.forEach(r => { if (r && r.draftId) map[String(r.draftId)] = r; });
    wx.setStorageSync(K.PLAN_BY_DRAFT, map);
    return list.length;
  }

  if (entityType === 'riskCalcDraft') {
    wx.setStorageSync(K.DRAFT_LATEST, list[0]);
    return list.length;
  }

  return 0;
}

/** 拉取单类实体列表并回填本地 */
async function pullEntityList(entityType, limit = 300) {
  if (getApiMode() !== 'api-ready') return { ok: false, skipped: 'local-only', count: 0 };

  const url = apiUrl('/api/mainchain/list');
  const clientId = getClientId();
  if (!url) return { ok: false, error: 'missing_api_base', count: 0 };
  if (!clientId) return { ok: false, error: 'missing_client_id', count: 0 };

  const res = await wxRequestPromise({ url, method: 'GET', data: { clientId, entityType, limit } });
  const ok = !!(res && res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.ok);
  if (!ok) {
    return {
      ok: false,
      error: (res && res.data && res.data.error) || ('http_' + (res && res.statusCode)),
      count: 0
    };
  }

  const list = (res.data.data && res.data.data.list) || [];
  return { ok: true, count: writeBackList(entityType, list) };
}

/** 拉取全部 5 类（换设备后自动恢复数据） */
async function pullAll() {
  if (getApiMode() !== 'api-ready') return { ok: false, skipped: 'local-only', total: 0 };

  let total = 0;
  const detail = {};
  for (let i = 0; i < PULL_TYPES.length; i += 1) {
    const type = PULL_TYPES[i];
    const r = await pullEntityList(type);
    detail[type] = r.count || 0;
    total += (r.count || 0);
  }
  return { ok: true, total, detail };
}

/** 收集本地现存数据，构造迁移载荷 */
function collectLocalItems() {
  const K = store.KEYS;
  const items = [];
  const push = (type, payload) => { if (payload) items.push({ entityType: type, payload }); };

  push('riskCalcDraft', wx.getStorageSync(K.DRAFT_LATEST) || null);
  push('riskPlanResult', wx.getStorageSync(K.PLAN_LATEST) || null);
  store.getTradeRecords().forEach(x => push('riskTradeRecord', x));
  store.getRiskReportHistory().forEach(x => push('riskReport', x));
  store.getLongArchives().forEach(x => push('riskLongArchive', x));

  return items;
}

/** 首次迁移：把本地历史数据批量上传（幂等，仅执行一次） */
async function migrateLocalData(force = false) {
  if (getApiMode() !== 'api-ready') return { ok: false, skipped: 'local-only' };
  if (!force && wx.getStorageSync(MIGRATE_FLAG)) return { ok: true, skipped: 'already' };

  const url = apiUrl('/api/mainchain/migrate');
  const clientId = getClientId();
  if (!url) return { ok: false, error: 'missing_api_base' };
  if (!clientId) return { ok: false, error: 'missing_client_id' };

  const items = collectLocalItems();
  if (!items.length) {
    wx.setStorageSync(MIGRATE_FLAG, Date.now());
    return { ok: true, count: 0 };
  }

  // 单次上限 500，超出分批（当前本地上限 300/类，理论不会触发）
  const chunks = [];
  for (let i = 0; i < items.length; i += 500) chunks.push(items.slice(i, i + 500));

  let uploaded = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    const res = await wxRequestPromise({ url, method: 'POST', data: { clientId, items: chunks[i] } });
    const ok = !!(res && res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.ok);
    if (ok) uploaded += (res.data.data && res.data.data.ok) || chunks[i].length;
  }

  wx.setStorageSync(MIGRATE_FLAG, Date.now());
  return { ok: true, count: uploaded };
}

/** 清除云端数据（个人信息删除权，法规要求）——只清云端，本地保留，避免误删 */
async function purgeRemote() {
  if (getApiMode() !== 'api-ready') return { ok: false, skipped: 'local-only' };

  const url = apiUrl('/api/mainchain/purge');
  const clientId = getClientId();
  if (!url || !clientId) return { ok: false, error: 'missing_params' };

  const res = await wxRequestPromise({ url, method: 'POST', data: { clientId } });
  const ok = !!(res && res.statusCode >= 200 && res.statusCode < 300 && res.data && res.data.ok);
  return { ok, error: ok ? '' : ((res && res.data && res.data.error) || 'purge_failed') };
}

/** 启动引导：先补传本地历史，再拉远端回填 */
async function bootstrapSync() {
  if (getApiMode() !== 'api-ready') return { ok: false, skipped: 'local-only' };
  await migrateLocalData();
  return pullAll();
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

  flushSyncQueue,

  pullEntityList,
  pullAll,
  migrateLocalData,
  purgeRemote,
  bootstrapSync
};