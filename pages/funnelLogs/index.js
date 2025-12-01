// pages/funnelLogs/index.js
const funnel = require('../../utils/funnel.js');

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function formatTime(ts) {
  if (!ts) {
    return '';
  }
  const d = new Date(ts);
  if (!d || isNaN(d.getTime())) {
    return '';
  }
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes()) +
    ':' +
    pad(d.getSeconds())
  );
}

Page({
  data: {
    logs: []
  },

  onShow: function () {
    this.loadLogs();
  },

  // 读取本地漏斗数据
  loadLogs: function () {
    let rawLogs = [];
    try {
      // 从 funnel 工具里取
      rawLogs = funnel.getLogs() || [];
    } catch (e) {
      console.error('[funnelLogs] getLogs error:', e);
      wx.showToast({
        title: '读取失败',
        icon: 'none',
        duration: 1200
      });
      rawLogs = [];
    }

    // 按时间倒序（最近的在最上面）
    const logs = rawLogs
      .slice()
      .reverse()
      .map(function (item, index) {
        return {
          id: index,
          step: item.step || 'UNKNOWN',
          ts: item.ts || 0,
          timeText: item.ts ? formatTime(item.ts) : '',
          extText: JSON.stringify(item.ext || {}, null, 2)
        };
      });

    this.setData({ logs: logs });
  },

  // 点击“刷新”按钮
  refreshLogs: function () {
    this.loadLogs();
    wx.showToast({
      title: '已刷新',
      icon: 'success',
      duration: 800
    });
  },

  // 点击“清空本机数据”
  onClearLogs: function () {
    const that = this;
    wx.showModal({
      title: '清空本机漏斗数据',
      content: '仅会清空当前设备小程序本地存储，不影响任何线上数据。',
      confirmText: '确认清空',
      cancelText: '再想想',
      success: function (res) {
        if (res.confirm) {
          try {
            funnel.clearLogs();
          } catch (e) {
            console.error('[funnelLogs] clearLogs error:', e);
          }
          that.setData({ logs: [] });
          wx.showToast({
            title: '已清空',
            icon: 'success',
            duration: 1000
          });
        }
      }
    });
  }
});
