// utils/userRights.js

// 本地存储 key
const STORAGE_KEY = 'userRights';

// 默认结构
const defaultRights = {
  freeCalcTimes: 0,         // 剩余完整方案次数
  membershipName: '',       // 当前会员名称（或训练营奖励名称）
  membershipExpireAt: 0,    // 会员到期时间戳（毫秒）
  // 预留给训练营多轮使用（暂不强制使用）
  campRoundCount: 0,
  lastRewardRound: 0
};

// 读取用户权益（带默认值）
function getUserRights() {
  const raw = wx.getStorageSync(STORAGE_KEY);
  if (!raw || typeof raw !== 'object') {
    return { ...defaultRights };
  }
  return {
    ...defaultRights,
    ...raw
  };
}

// 保存（覆盖）用户权益
function saveUserRights(rights) {
  const merged = {
    ...defaultRights,
    ...rights
  };
  wx.setStorageSync(STORAGE_KEY, merged);
  return merged;
}

// 增加完整方案次数（统一入口）
function addFreeCalcTimes(delta) {
  const rights = getUserRights();
  rights.freeCalcTimes = (rights.freeCalcTimes || 0) + (delta || 0);
  return saveUserRights(rights);
}

// 设置会员信息（含有效期 + 次数）
function setMembership(options) {
  const { membershipName, days, addTimes } = options || {};
  if (!membershipName || !days) return getUserRights();

  const now = Date.now();
  const rights = getUserRights();

  rights.membershipName = membershipName;
  rights.membershipExpireAt = now + days * 24 * 60 * 60 * 1000;
  if (addTimes && addTimes > 0) {
    rights.freeCalcTimes = (rights.freeCalcTimes || 0) + addTimes;
  }

  return saveUserRights(rights);
}

// 获取用于 UI 展示的会员标签
function getMembershipLabel() {
  const rights = getUserRights();
  const now = Date.now();
  const { membershipName, membershipExpireAt } = rights;

  let label = '';
  let expired = false;

  if (membershipName) {
    if (membershipExpireAt && now > membershipExpireAt) {
      label = membershipName + '（已到期）';
      expired = true;
    } else {
      label = membershipName;
    }
  } else {
    label = '未开通会员';
  }

  return {
    label,
    expired,
    membershipName,
    membershipExpireAt
  };
}

module.exports = {
  STORAGE_KEY,
  defaultRights,
  getUserRights,
  saveUserRights,
  addFreeCalcTimes,
  setMembership,
  getMembershipLabel
};
