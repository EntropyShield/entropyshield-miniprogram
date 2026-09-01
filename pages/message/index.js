// pages/message/index.js
// [V2.0-A 消息中心 Layer1] 本地提醒列表 + 红点联动
const msg = require('../../utils/messages.js');

function fmtTime(ts) {
  const d = new Date(ts || Date.now());
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  let prefix = '';
  if (d.toDateString() === now.toDateString()) {
    prefix = '今天 ';
  } else {
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    prefix = `${mo}-${da} `;
  }
  return prefix + `${hh}:${mm}`;
}

function decorate(list) {
  return (list || []).map(m => Object.assign({}, m, { timeText: fmtTime(m.ts) }));
}

Page({
  data: { list: [] },

  onShow() {
    this.setData({ list: decorate(msg.getMessages()) });
    msg.refreshBadge();
  },

  onTap(e) {
    const ds = e.currentTarget.dataset;
    const id = ds.id;
    const target = ds.target;
    const tab = ds.tab === true || ds.tab === 'true';
    msg.markRead(id);
    this.setData({ list: decorate(msg.getMessages()) });
    msg.refreshBadge();
    if (tab) {
      wx.switchTab({ url: target });
    } else {
      wx.navigateTo({ url: target });
    }
  },

  onMarkAll() {
    msg.markAllRead();
    this.setData({ list: decorate(msg.getMessages()) });
    msg.refreshBadge();
  },

  onOpenSettings() {
    wx.navigateTo({ url: 'pkgService/settings/recall/index' });
  }
});
