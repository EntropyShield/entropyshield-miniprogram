const { saveUserRights } = require('./userRights');

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

function hasLocalPaidMembership(rights) {
  rights = rights || {};

  const expireAt = toMs(
    pickFirst(
      rights.membershipExpireAt,
      rights.trialExpireAt,
      rights.expireAt
    )
  );

  const now = Date.now();

  const name = String(
    pickFirst(
      rights.membershipName,
      rights.currentMembershipName,
      ''
    )
  ).trim();

  const plan = String(
    pickFirst(
      rights.membershipPlan,
      rights.currentMembershipType,
      ''
    )
  ).trim();

  const productCode = String(
    pickFirst(
      rights.membershipProductCode,
      rights.productCode,
      ''
    )
  ).trim();

  const level = String(
    pickFirst(
      rights.membershipLevel,
      ''
    )
  ).trim();

  const hasIdentity =
    !!name ||
    !!plan ||
    !!productCode ||
    !!level;

  const isNotFree =
    name !== '未开通' &&
    name !== '未开通会员' &&
    plan !== 'free' &&
    level.toUpperCase() !== 'FREE';

  return !!(hasIdentity && isNotFree && expireAt && expireAt > now);
}

function buildProtectedEffectiveRights(effectiveRights, localRights) {
  const next = Object.assign({}, effectiveRights || {});
  const membership = Object.assign({}, next.membership || {});
  const calculator = Object.assign({}, next.calculator || {});

  const expireAt = toMs(
    pickFirst(
      localRights.membershipExpireAt,
      localRights.trialExpireAt,
      0
    )
  );

  const name = String(
    pickFirst(
      localRights.membershipName,
      localRights.currentMembershipName,
      membership.name,
      '会员权益'
    )
  );

  const plan = String(
    pickFirst(
      localRights.membershipPlan,
      localRights.currentMembershipType,
      membership.plan,
      ''
    )
  );

  const productCode = String(
    pickFirst(
      localRights.membershipProductCode,
      localRights.productCode,
      membership.productCode,
      ''
    )
  );

  const level = String(
    pickFirst(
      localRights.membershipLevel,
      membership.level,
      ''
    )
  );

  const remainingDays = expireAt > Date.now()
    ? Math.ceil((expireAt - Date.now()) / 86400000)
    : 0;

  next.membership = Object.assign({}, membership, {
    active: true,
    name,
    level,
    plan,
    productCode,
    expireAt,
    expireAtText: membership.expireAtText || '',
    remainingMs: expireAt > Date.now() ? expireAt - Date.now() : 0,
    remainingDays
  });

  next.calculator = Object.assign({}, calculator, {
    canUse: true,
    needsPay: false,
    unlockReason: 'local_paid_membership_preserved'
  });

  next.membershipName = name;
  next.membershipLevel = level;
  next.membershipExpireAt = expireAt;
  next.canUseCalculator = true;
  next.needsPay = false;

  return next;
}

function persistRights(normalized) {
  let rights = normalized && normalized.rights ? normalized.rights : {};
  let effectiveRights = normalized && normalized.effectiveRights ? normalized.effectiveRights : {};

  let current = {};
  try {
    current = wx.getStorageSync('userRights') || {};
  } catch (e) {}

  const localHasPaid = hasLocalPaidMembership(current);
  const incomingHasPaid = hasLocalPaidMembership(rights);

  const localExpireAt = toMs(
    pickFirst(
      current.membershipExpireAt,
      current.trialExpireAt,
      0
    )
  );

  const incomingExpireAt = toMs(
    pickFirst(
      rights.membershipExpireAt,
      rights.trialExpireAt,
      0
    )
  );

  // 核心保护：
  // 如果本地刚支付成功已有有效会员权益，而服务端返回空权益、未开通、或更早到期时间，
  // 则不允许服务端旧状态覆盖本地刚支付成功状态。
  if (localHasPaid && (!incomingHasPaid || incomingExpireAt < localExpireAt)) {
    rights = Object.assign({}, rights, {
      currentMembershipType: current.currentMembershipType || rights.currentMembershipType || '',
      currentMembershipName: current.currentMembershipName || current.membershipName || rights.currentMembershipName || '',
      membershipName: current.membershipName || rights.membershipName || '',
      membershipPlan: current.membershipPlan || rights.membershipPlan || '',
      membershipLevel: current.membershipLevel || rights.membershipLevel || '',
      productCode: current.productCode || rights.productCode || '',
      membershipProductCode: current.membershipProductCode || rights.membershipProductCode || '',
      membershipExpireAt: localExpireAt,
      membershipExpireText: current.membershipExpireText || rights.membershipExpireText || localExpireAt,
      membershipExpireAtText: current.membershipExpireAtText || rights.membershipExpireAtText || '',
      trialActive: current.trialActive || rights.trialActive || false,
      trialExpireAt: current.trialExpireAt || rights.trialExpireAt || localExpireAt,
      advancedEnabled: current.advancedEnabled || rights.advancedEnabled || false,
      isMemberActive: true,
      canUseCalculator: true,
      needsPay: false
    });

    effectiveRights = buildProtectedEffectiveRights(effectiveRights, rights);

    try {
      console.log('[rightsSync] preserve local paid membership, block stale server overwrite =>', {
        localExpireAt,
        incomingExpireAt,
        membershipName: rights.membershipName,
        membershipPlan: rights.membershipPlan,
        membershipProductCode: rights.membershipProductCode
      });
    } catch (e) {}
  }

  let saved = {};

  try {
    saved = saveUserRights(rights) || {};
  } catch (e) {
    saved = rights;
  }

  let latest = {};
  try {
    latest = wx.getStorageSync('userRights') || {};
  } catch (e) {}

  const finalRights = Object.assign({}, latest, saved, rights, {
    effectiveRights
  });

  try {
    wx.setStorageSync('userRights', finalRights);
    wx.setStorageSync('effectiveRights', effectiveRights);
    wx.setStorageSync('lastEffectiveRightsSyncAt', Date.now());
  } catch (e) {}

  try {
    const app = safeGetApp();
    if (app && app.globalData) {
      app.globalData.userRights = finalRights;
      app.globalData.effectiveRights = effectiveRights;
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
