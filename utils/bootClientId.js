// utils/bootClientId.js —— 启动时确保 clientId 存在且有效
function ensureClientId() {
  try {
    let cid = wx.getStorageSync('clientId');
    if (typeof cid === 'string') cid = cid.trim();
    if (cid) return cid;

    const keys = ['openid', 'OPENID', 'fissionClientId', 'wx_openid', 'userOpenid'];
    for (const k of keys) {
      const v = wx.getStorageSync(k);
      if (v && String(v).trim()) { cid = String(v).trim(); break; }
    }

    if (!cid) {
      const p = wx.getStorageSync('fissionProfile') || {};
      const v = p.clientId || p.openid || p.openId || p.client_id;
      if (v && String(v).trim()) cid = String(v).trim();
    }

    if (!cid) cid = 'ST-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
    wx.setStorageSync('clientId', cid);
    return cid;
  } catch (e) {
    const cid = 'ST-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
    try { wx.setStorageSync('clientId', cid); } catch (e2) {}
    return cid;
  }
}

module.exports = { ensureClientId };
