const store = require("../../utils/mainchainStore.js");
const mainchainApi = require("../../utils/mainchainApi.js");

function safeObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function safeList(v) {
  return Array.isArray(v) ? v : [];
}

function fmtTime(ts) {
  const n = Number(ts || 0);
  if (!n) return "Not synced";
  const d = new Date(n);
  if (isNaN(d.getTime())) return "Not synced";
  const pad = (x) => String(x).padStart(2, "0");
  return (
    d.getFullYear() + "-" +
    pad(d.getMonth() + 1) + "-" +
    pad(d.getDate()) + " " +
    pad(d.getHours()) + ":" +
    pad(d.getMinutes()) + ":" +
    pad(d.getSeconds())
  );
}

function buildSnapshot(note) {
  const overview = safeObject(store.getOverview ? store.getOverview() : {});
  const tradeRecords = safeList(store.getTradeRecords ? store.getTradeRecords() : []);
  const riskReport = store.getLatestRiskReport ? (store.getLatestRiskReport() || null) : null;
  const longtermProfile = store.getLatestLongArchive ? (store.getLatestLongArchive() || null) : null;

  const queue = safeList(mainchainApi.getSyncQueue ? mainchainApi.getSyncQueue() : []);
  const history = safeList(mainchainApi.getSyncHistory ? mainchainApi.getSyncHistory() : []);
  const lastSyncMap = safeObject(mainchainApi.getLastSyncMap ? mainchainApi.getLastSyncMap() : {});
  const mode = mainchainApi.getApiMode ? String(mainchainApi.getApiMode() || "") : "";
  const apiBase = mainchainApi.getApiBase ? String(mainchainApi.getApiBase() || "") : "";

  const failedCount = queue.filter((x) => x && x.status === "failed").length;
  const pendingCount = queue.filter((x) => x && x.status === "queued").length;

  let syncStatus = "idle";
  if (queue.length || history.length || Object.keys(lastSyncMap).length) {
    syncStatus = failedCount ? "fail" : (pendingCount ? "syncing" : "success");
  }

  const sourceStatus = {
    overview: "ready",
    tradeRecords: tradeRecords.length ? "has-data" : "empty",
    riskReport: riskReport ? "ready" : "empty",
    longtermProfile: longtermProfile ? "ready" : "empty",
    syncQueue: queue.length ? (failedCount ? "failed" : (pendingCount ? "pending" : "ready")) : "empty",
    syncHistory: history.length ? "has-data" : "empty",
    lastSyncMap: Object.keys(lastSyncMap).length ? "has-data" : "empty"
  };

  const now = Date.now();

  return {
    syncStatus,
    syncError: failedCount ? (String(failedCount) + " failed queue items") : "",
    lastSyncAt: now,
    sourceStatus,
    debugLogs: [
      {
        ts: now,
        level: failedCount ? "warn" : "info",
        message: note || "snapshot_built"
      }
    ],
    bundle: {
      overview,
      tradeRecords,
      riskReport,
      longtermProfile,
      meta: {
        syncAt: now,
        mode,
        apiBase,
        queueSize: queue.length,
        historySize: history.length,
        failedCount,
        pendingCount,
        lastSyncMap,
        sourceStatus
      }
    }
  };
}

Page({
  data: {
    showRaw: false,
    syncStatus: "idle",
    syncError: "",
    lastSyncAtText: "Not synced",
    sourceStatusList: [],
    summary: {
      draftCount: 0,
      tradeCount: 0,
      reportCount: 0,
      archiveCount: 0,
      queueSize: 0,
      historySize: 0,
      mode: "",
      apiBase: ""
    },
    debugLogs: [],
    rawText: ""
  },

  onShow() {
    this.refreshPage();
  },

  refreshPage(note) {
    const state = buildSnapshot(note);
    const bundle = safeObject(state.bundle);
    const overview = safeObject(bundle.overview);
    const meta = safeObject(bundle.meta);
    const sourceStatus = safeObject(state.sourceStatus);
    const sourceStatusList = Object.keys(sourceStatus).map((key) => ({
      key,
      value: String(sourceStatus[key])
    }));

    this.setData({
      syncStatus: state.syncStatus || "idle",
      syncError: state.syncError || "",
      lastSyncAtText: fmtTime(state.lastSyncAt || meta.syncAt || 0),
      sourceStatusList,
      summary: {
        draftCount: Number(overview.draftCount || 0),
        tradeCount: Number(overview.tradeCount || safeList(bundle.tradeRecords).length || 0),
        reportCount: Number(overview.reportCount || 0),
        archiveCount: Number(overview.archiveCount || 0),
        queueSize: Number(meta.queueSize || 0),
        historySize: Number(meta.historySize || 0),
        mode: meta.mode || "",
        apiBase: meta.apiBase || ""
      },
      debugLogs: safeList(state.debugLogs),
      rawText: JSON.stringify(state, null, 2)
    });
  },

  handleSyncMainchain() {
    try {
      if (mainchainApi.getApiMode && mainchainApi.getApiMode() === "api-ready" && mainchainApi.flushSyncQueue) {
        mainchainApi.flushSyncQueue();
      }
      this.refreshPage("sync_clicked");
      wx.showToast({ title: "Synced", icon: "success" });
    } catch (e) {
      const errMsg = String((e && e.message) || e || "sync_failed");
      this.setData({
        syncStatus: "fail",
        syncError: errMsg
      });
      wx.showToast({ title: "Sync failed", icon: "none" });
    }
  },

  handleResetState() {
    this.setData({ showRaw: false });
    this.refreshPage("reset_clicked");
    wx.showToast({ title: "Reset", icon: "success" });
  },

  handleToggleRaw() {
    this.setData({ showRaw: !this.data.showRaw });
  }
});