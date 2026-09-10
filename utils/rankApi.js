// utils/rankApi.js
// 活动排行榜通用封装（E3 排行榜引擎，62 号 Phase 0 基建）
//
// 设计原则：
// 1) 全部接口**静默失败**，后端未上线 / 网络异常一律返回 null。
// 2) 只接收分数 / 段位 / 脱敏昵称，绝不接收收益率或盈亏字段（合规红线）。
//
// /api/rank 返回结构：
//   { ok:true, data:{ activity, scope, period, list:[{rank,clientId,nickname,score,levelTag}], me } }

const { API_BASE } = require('./config.js');

function base() {
  return (typeof wx !== 'undefined' && wx.getStorageSync('API_BASE')) || API_BASE || '';
}

function req(url, method, data) {
  return new Promise((resolve) => {
    const b = base();
    if (!b) return resolve(null);
    wx.request({
      url: b + url,
      method: method || 'GET',
      data: data || {},
      timeout: 10000,
      header: { 'content-type': 'application/json' },
      success: (res) => resolve((res && res.data) || null),
      fail: () => resolve(null)
    });
  });
}

/**
 * 拉取榜单
 * @param {object} o
 * @param {string} o.activity  exam | season | season_streak | annual
 * @param {string} o.period    default | S1 | ...
 * @param {string} o.scope     global | relation | grade | region
 * @param {string} o.region    scope=region 时必填（省份名，如「广东」）
 * @param {number} o.limit
 */
function getRank({ activity, period, scope, region, limit } = {}) {
  let q =
    '?activity=' + encodeURIComponent(activity || 'exam') +
    '&period=' + encodeURIComponent(period || 'default') +
    '&scope=' + encodeURIComponent(scope || 'global') +
    '&limit=' + (limit || 100);
  if (region) q += '&region=' + encodeURIComponent(region);
  return req('/api/rank' + q, 'GET');
}

/**
 * 上报用户所在地区（用于地区榜，用户自主选择、不强采集）
 * @param {string} clientId
 * @param {string} regionCode  省份名，如「广东」
 */
function setRegion(clientId, regionCode) {
  return req('/api/activity/region', 'POST', { clientId, regionCode });
}

module.exports = { getRank, setRegion };
