// pkgService/activity/index —— 通用活动页（波次 3）
// 公开课 / 体验课 / 沙龙见面会 / 训练营 / 其他活动 一律走这一页，内容全后端配。
// 加新活动 = 后端加一条 activity_config 记录，不用改代码、不用发版。

const activityApi = require('../../utils/activityApi.js');
const academyApi = require('../../utils/academyApi.js');

function fmt(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes());
}

function ts(v) {
  if (!v) return 0;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.replace(/-/g, '/')).getTime();
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

Page({
  data: {
    key: '',
    act: null,
    loading: true,
    timeText: '',
    joined: false,
    ctaText: '参加活动',
    ctaDisabled: false,
    showGift: false,
    giftLesson: ''
  },

  onLoad(options) {
    const key = String((options && options.key) || '').trim();
    this.setData({ key: key });
    if (!key) {
      this.setData({ loading: false });
      return;
    }
    this.load(key);
  },

  load(key) {
    activityApi.getDetail(key).then((act) => {
      if (!act) {
        this.setData({ loading: false, act: null });
        return;
      }
      const s = ts(act.startAt);
      const e = ts(act.endAt);
      let timeText = '';
      if (s && e) timeText = fmt(s) + ' — ' + fmt(e);
      else if (s) timeText = fmt(s) + ' 开始';
      else timeText = '长期开放';

      let ctaText = '参加活动';
      let ctaDisabled = false;
      if (act.phase === 'upcoming') { ctaText = '即将开始'; ctaDisabled = true; }
      else if (act.phase === 'replay') { ctaText = '看回放'; }
      else if (act.phase === 'past') { ctaText = '已结束'; ctaDisabled = true; }

      this.setData({
        act: act,
        loading: false,
        timeText: timeText,
        ctaText: ctaText,
        ctaDisabled: ctaDisabled
      });
      wx.setNavigationBarTitle({ title: act.title || '活动' });
    });
  },

  onJoin() {
    const act = this.data.act;
    if (!act) return;
    if (act.phase === 'replay') return this.openReplay();

    const cid = academyApi.ensureClientId();
    wx.showLoading({ title: '报名中', mask: true });
    activityApi.join(act.key, cid).then((r) => {
      wx.hideLoading();
      if (!r || !r.ok) {
        wx.showToast({ title: (r && r.message) || '报名失败', icon: 'none' });
        return;
      }
      const gift = (r.data && r.data.giftLesson) || '';
      this.setData({ joined: true, ctaText: '已报名', ctaDisabled: true, showGift: !!gift, giftLesson: gift });
      if (gift) {
        wx.showModal({
          title: '报名成功',
          content: '已赠送《' + gift + '》单课解锁券，去学院接着学？',
          confirmText: '去学院',
          cancelText: '稍后',
          success: (m) => { if (m.confirm) this.goAcademy(); }
        });
      } else {
        wx.showToast({ title: '报名成功', icon: 'success' });
      }
    });
  },

  openReplay() {
    const url = (this.data.act && this.data.act.replayUrl) || '';
    if (!url) return;
    if (/^https?:\/\//.test(url)) {
      wx.setClipboardData({ data: url, success: () => wx.showToast({ title: '回放链接已复制', icon: 'none' }) });
    } else {
      wx.navigateTo({ url: url });
    }
  },

  goAcademy() {
    wx.navigateTo({ url: '/pkgAcademy/pages/index' });
  },

  onShareAppMessage() {
    const act = this.data.act || {};
    return {
      title: act.title || '熵盾活动',
      path: '/pkgService/activity/index?key=' + (this.data.key || '')
    };
  }
});
