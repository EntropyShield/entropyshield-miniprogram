// PIPL 敏感数据单独同意状态管理（A2 合规）
// 仅在用户主动录入并授权后，才允许持仓/交易等敏感个人信息落库与上报。
const KEY_PREFIX = 'pipl_consent_';

function getConsent(type) {
  try {
    return !!wx.getStorageSync(KEY_PREFIX + type);
  } catch (e) {
    return false;
  }
}

function setConsent(type) {
  try {
    wx.setStorageSync(KEY_PREFIX + type, 1);
  } catch (e) {}
}

function needConsent(type) {
  return !getConsent(type);
}

// 撤回同意（PIPL 第 15 条：撤回同意后应及时删除或匿名化）
// 【9/2 Bug4】本模块原先只有 setConsent 没有撤回，导致设置页取消勾选时只改了
// pref 里的展示位，真实同意位依旧是 1 —— hasConsent() 仍返回 true。
function revokeConsent(type) {
  try {
    wx.removeStorageSync(KEY_PREFIX + type);
  } catch (e) {}
}

module.exports = { getConsent, setConsent, needConsent, revokeConsent };
