const DEFAULT_API_BASE = 'https://api.entropyshield.com';

function safeGetApp() {
  try {
    return getApp();
  } catch (e) {
    return null;
  }
}

function getApiBase() {
  let base = '';

  try {
    base =
      wx.getStorageSync('API_BASE') ||
      wx.getStorageSync('apiBaseUrl') ||
      wx.getStorageSync('apiBase') ||
      '';
  } catch (e) {}

  if (!base) {
    try {
      const config = require('../config.js');
      base =
        config.API_BASE ||
        config.API_BASE_URL ||
        config.apiBaseUrl ||
        config.apiBase ||
        config.DEV_API_BASE ||
        config.PROD_API_BASE ||
        '';
    } catch (e) {}
  }

  if (!base) base = DEFAULT_API_BASE;

  return String(base).replace(/\/+$/, '');
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : (fallback || 0);
}

function toMs(value) {
  if (!value) return 0;

  if (typeof value === 'number') {
    if (value > 1000000000000) return value;
    if (value > 1000000000) return value * 1000;
    return value;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickFirst() {
  for (let i = 0; i < arguments.length; i++) {
    const v = arguments[i];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

function getClientId(input) {
  input = input || {};

  let clientId = pickFirst(
    input.clientId,
    input.client_id,
    input.openid,
    input.open_id
  );

  if (!clientId) {
    try {
      clientId = pickFirst(
        wx.getStorageSync('clientId'),
        wx.getStorageSync('openid'),
        wx.getStorageSync('openId')
      );
    } catch (e) {}
  }

  if (!clientId) {
    try {
      const app = safeGetApp();
      const gd = (app && app.globalData) || {};
      clientId = pickFirst(
        gd.clientId,
        gd.openid,
        gd.openId,
        gd.userInfo && gd.userInfo.openid
      );
    } catch (e) {}
  }

  if (!clientId) {
    try {
      const rights = wx.getStorageSync('userRights') || {};
      const identity = rights.identity || {};
      const effectiveRights = rights.effectiveRights || {};
      const effectiveIdentity = effectiveRights.identity || {};

      clientId = pickFirst(
        rights.clientId,
        rights.openid,
        identity.clientId,
        identity.openid,
        effectiveIdentity.clientId,
        effectiveIdentity.openid
      );
    } catch (e) {}
  }

  return String(clientId || '').trim();
}

function normalizeEffectiveRights(payload) {
  const effective =
    (payload && payload.effectiveRights) ||
    (payload && payload.rights && payload.rights.effectiveRights) ||
    payload ||
    {};

  const membership = effective.membership || {};
  const task = effective.task || {};
  const calculator = effective.calculator || {};
  const identity = effective.identity || {};
  const ai = effective.ai || {};

  const rewardTimes = toNumber(
    pickFirst(
      task.rewardTimes,
      task.freeCalcTimes,
      effective.rewardTimes,
      effective.freeCalcTimes
    ),
    0
  );

  const expireAt = toMs(
    pickFirst(
      membership.expireAt,
      effective.membershipExpireAt,
      effective.expireAt
    )
  );

  const membershipName = String(
    pickFirst(
      membership.name,
      effective.membershipName,
      effective.currentMembershipName,
      ''
    )
  );

  const membershipLevel = String(
    pickFirst(
      membership.level,
      effective.membershipLevel,
      ''
    )
  );

  const membershipPlan = String(
    pickFirst(
      membership.plan,
      effective.membershipPlan,
      ''
    )
  );

  const productCode = String(
    pickFirst(
      membership.productCode,
      effective.membershipProductCode,
      effective.productCode,
      ''
    )
  );

  const active = !!membership.active || (!!expireAt && expireAt > Date.now());

  const canUseCalculator =
    calculator.canUse === true ||
    effective.canUseCalculator === true ||
    active ||
    rewardTimes > 0;

  const needsPay =
    calculator.needsPay === true ||
    effective.needsPay === true ||
    !canUseCalculator;

  const upperLevel = membershipLevel.toUpperCase();
  const upperPlan = membershipPlan.toUpperCase();
  const upperProduct = productCode.toUpperCase();

  const trialActive =
    active &&
    (
      upperLevel === 'TRIAL3' ||
      upperPlan === 'TRIAL3' ||
      upperProduct === 'VIP_ONCE3'
    );

  const advancedEnabled =
    effective.advancedEnabled === true ||
    ['QUARTER', 'YEAR', 'LIFETIME', 'VIP_QUARTER', 'VIP_YEAR'].indexOf(upperLevel) >= 0 ||
    ['QUARTER', 'YEAR', 'LIFETIME'].indexOf(upperPlan) >= 0 ||
    ['VIP_QUARTER', 'VIP_YEAR'].indexOf(upperProduct) >= 0;

  const legacyRights = {
    effectiveRights: effective,

    identity,

    clientId: pickFirst(identity.clientId, identity.openid, ''),
    openid: pickFirst(identity.openid, identity.clientId, ''),

    rewardTimes,
    freeCalcTimes: rewardTimes,
    totalUsablePlanTimes: rewardTimes,
    fissionSyncedTimes: rewardTimes,

    membershipName,
    currentMembershipName: membershipName,
    membershipLevel,
    membershipPlan,
    membershipProductCode: productCode,
    productCode,
    membershipExpireAt: expireAt,
    membershipExpireText: expireAt || '',
    membershipExpireAtText: membership.expireAtText || effective.membershipExpireAtText || '',

    trialActive,
    trialExpireAt: trialActive ? expireAt : '',

    advancedEnabled,

    canUseCalculator,
    needsPay,

    aiReady: ai.standardPayloadReady === true,
    aiWorkflowVersion: ai.reservedVersion || ''
  };

  return {
    effectiveRights: effective,
    rights: legacyRights
  };
}

function persistRights(normalized) {
  const rights =
    normalized && normalized.rights
      ? normalized.rights
      : {};

  const effectiveRights =
    normalized && normalized.effectiveRights
      ? normalized.effectiveRights
      : {};

  let current = {};

  try {
    current = wx.getStorageSync('userRights') || {};
  } catch (e) {}

  /*
   * SERVER_MEMBERSHIP_AUTHORITATIVE
   *
   * 会员权益以服务端为准：本地任何会员字段都不再参与合并，
   * 只保留与会员无关的字段（如免费次数），避免本地旧状态覆盖服务端结果。
   *
   * 免费测算次数取本地与服务端的较大值，防止服务端延迟导致次数丢失。
   */
  const localOnly = Object.assign({}, current);

  const membershipKeys = [
    'membership',
    'calculator',
    'membershipName',
    'currentMembershipName',
    'membershipPlan',
    'currentMembershipType',
    'membershipType',
    'membershipLevel',
    'membershipProductCode',
    'membershipProduct',
    'productCode',
    'membershipExpireAt',
    'membershipExpireText',
    'membershipExpireAtText',
    'membership_name',
    'membership_level',
    'membership_expire_at',
    'membership_active',
    'trialActive',
    'trialExpireAt',
    'advancedEnabled',
    'advanced_enabled',
    'isMemberActive',
    'membershipActive',
    'is_member_active',
    'canUseCalculator',
    'can_use_calculator',
    'needsPay',
    'needs_pay',
    'effectiveRights'
  ];

  membershipKeys.forEach((key) => {
    delete localOnly[key];
  });

  const localFreeCalcTimes = Math.max(
    0,
    toNumber(
      pickFirst(
        current.freeCalcTimes,
        current.free_calc_times,
        current.rewardTimes,
        0
      ),
      0
    )
  );

  const serverFreeCalcTimes = Math.max(
    0,
    toNumber(
      pickFirst(
        rights.freeCalcTimes,
        rights.rewardTimes,
        rights.totalUsablePlanTimes,
        0
      ),
      0
    )
  );

  const finalRights = Object.assign(
    {},
    localOnly,
    rights,
    {
      freeCalcTimes: Math.max(
        localFreeCalcTimes,
        serverFreeCalcTimes
      ),
      effectiveRights
    }
  );

  try {
    wx.setStorageSync('userRights', finalRights);
    wx.setStorageSync(
      'effectiveRights',
      effectiveRights
    );
    wx.setStorageSync(
      'lastEffectiveRightsSyncAt',
      Date.now()
    );
  } catch (e) {}

  try {
    const app = safeGetApp();

    if (app && app.globalData) {
      app.globalData.userRights = finalRights;
      app.globalData.effectiveRights =
        effectiveRights;
    }
  } catch (e) {}

  return finalRights;
}

function requestJson(options) {
  options = options || {};

  return new Promise((resolve) => {
    wx.request({
      url: options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: Object.assign({
        'Content-Type': 'application/json'
      }, options.header || {}),
      success(res) {
        resolve({
          ok: true,
          statusCode: res.statusCode,
          data: res.data || {}
        });
      },
      fail(err) {
        resolve({
          ok: false,
          error: err,
          data: {}
        });
      }
    });
  });
}

async function getEffectiveRights(input) {
  input = input || {};

  const clientId = getClientId(input);

  if (!clientId) {
    return {
      ok: false,
      code: 'CLIENT_ID_EMPTY',
      message: 'clientId is empty',
      rights: wx.getStorageSync('userRights') || {},
      effectiveRights: wx.getStorageSync('effectiveRights') || {}
    };
  }

  const apiBase = getApiBase();
  const url = apiBase + '/api/rights/effective?clientId=' + encodeURIComponent(clientId);

  const res = await requestJson({
    url,
    method: 'GET'
  });

  if (!res.ok || !res.data || res.data.ok !== true) {
    return {
      ok: false,
      code: (res.data && res.data.code) || 'EFFECTIVE_RIGHTS_REQUEST_FAILED',
      message: (res.data && res.data.message) || '',
      raw: res.data || {},
      rights: wx.getStorageSync('userRights') || {},
      effectiveRights: wx.getStorageSync('effectiveRights') || {}
    };
  }

  const normalized = normalizeEffectiveRights(res.data);
  const rights = persistRights(normalized);

  return {
    ok: true,
    code: res.data.code || 'OK',
    raw: res.data,
    rights,
    effectiveRights: normalized.effectiveRights
  };
}

async function syncEffectiveRights(input) {
  input = input || {};

  const clientId = getClientId(input);

  if (!clientId) {
    return {
      ok: false,
      code: 'CLIENT_ID_EMPTY',
      message: 'clientId is empty',
      rights: wx.getStorageSync('userRights') || {},
      effectiveRights: wx.getStorageSync('effectiveRights') || {}
    };
  }

  const apiBase = getApiBase();
  const url = apiBase + '/api/rights/sync';

  const res = await requestJson({
    url,
    method: 'POST',
    data: Object.assign({}, input, {
      clientId
    })
  });

  if (!res.ok || !res.data || res.data.ok !== true) {
    return {
      ok: false,
      code: (res.data && res.data.code) || 'RIGHTS_SYNC_REQUEST_FAILED',
      message: (res.data && res.data.message) || '',
      raw: res.data || {},
      rights: wx.getStorageSync('userRights') || {},
      effectiveRights: wx.getStorageSync('effectiveRights') || {}
    };
  }

  const normalized = normalizeEffectiveRights(res.data);
  const rights = persistRights(normalized);

  return {
    ok: true,
    code: res.data.code || 'OK',
    raw: res.data,
    rights,
    effectiveRights: normalized.effectiveRights
  };
}

// 兼容旧调用：支付成功页现在用的就是 syncServerRights
function syncServerRights(input) {
  return syncEffectiveRights(input || {});
}

module.exports = {
  getEffectiveRights,
  syncEffectiveRights,
  syncServerRights,
  normalizeEffectiveRights,
  persistRights
};
