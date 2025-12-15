// utils/clientId.js
// MOD: COURSE_CLIENTID_20251214 - stable clientId for progress

function getOrCreateClientId() {
  const key = 'clientId';
  let clientId = wx.getStorageSync(key);
  if (clientId) return clientId;

  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1000000);
  clientId = `ST-${ts}-${rand}`;
  wx.setStorageSync(key, clientId);
  return clientId;
}

module.exports = { getOrCreateClientId };
