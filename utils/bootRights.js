// utils/bootRights.js —— 会员权益本地缓存清理 + 服务端权威同步
const { appDebug } = require('./bootDebug');

function clearLocalMembershipCache() {
  let current = {};
  try {
    current = wx.getStorageSync('userRights') || {};
  } catch (e) {}

  const cleaned = Object.assign({}, current);
  const membershipKeys = [
    'membership', 'calculator', 'membershipName', 'currentMembershipName',
    'membershipPlan', 'currentMembershipType', 'membershipType', 'membershipLevel',
    'membershipProductCode', 'membershipProduct', 'productCode',
    'membershipExpireAt', 'membershipExpireText', 'membershipExpireAtText',
    'membership_name', 'membership_level', 'membership_expire_at', 'membership_active',
    'trialActive', 'trialExpireAt', 'advancedEnabled', 'advanced_enabled',
    'isMemberActive', 'membershipActive', 'is_member_active',
    'canUseCalculator', 'can_use_calculator', 'needsPay', 'needs_pay', 'effectiveRights'
  ];
  membershipKeys.forEach((key) => { delete cleaned[key]; });

  try {
    wx.setStorageSync('userRights', cleaned);
    wx.removeStorageSync('effectiveRights');
    wx.removeStorageSync('lastEffectiveRightsSyncAt');
  } catch (e) {}

  try {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.userRights = cleaned;
      app.globalData.effectiveRights = {};
    }
  } catch (e) {}

  return cleaned;
}

function syncServerAuthoritativeRights(clientId, scene) {
  const cid = String(clientId || '').trim();
  if (!cid) {
    return Promise.resolve({ ok: false, code: 'CLIENT_ID_EMPTY' });
  }
  if (wx.__authoritativeRightsClientId === cid && wx.__authoritativeRightsPromise) {
    return wx.__authoritativeRightsPromise;
  }

  try {
    const { syncEffectiveRights } = require('./rightsSync');
    let task = null;

    const clearTask = () => {
      if (wx.__authoritativeRightsClientId === cid && wx.__authoritativeRightsPromise === task) {
        wx.__authoritativeRightsClientId = '';
        wx.__authoritativeRightsPromise = null;
      }
    };

    task = syncEffectiveRights({ clientId: cid, scene: scene || 'app_launch' }).then(
      (result) => {
        appDebug('[BOOT][RIGHTS] authoritative sync:', {
          ok: !!(result && result.ok),
          code: (result && result.code) || '',
          scene: scene || 'app_launch'
        });
        clearTask();
        return result;
      },
      (error) => {
        appDebug('[BOOT][RIGHTS] authoritative sync fail:', String((error && error.message) || error || ''));
        clearTask();
        return { ok: false, code: 'RIGHTS_SYNC_EXCEPTION' };
      }
    );

    wx.__authoritativeRightsClientId = cid;
    wx.__authoritativeRightsPromise = task;
    return task;
  } catch (error) {
    appDebug('[BOOT][RIGHTS] module load fail:', String((error && error.message) || error || ''));
    return Promise.resolve({ ok: false, code: 'RIGHTS_SYNC_MODULE_ERROR' });
  }
}

module.exports = { clearLocalMembershipCache, syncServerAuthoritativeRights };
