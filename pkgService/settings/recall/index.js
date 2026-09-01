// pkgService/settings/recall/index.js
// [V2.0-J3] 强提醒设置页：微信订阅 + 服务号订阅通知（主召回）+ 外部强召回（短信/语音兜底）偏好与手机号绑定
const recall = require('../../../utils/recall.js');
const sub = require('../../../utils/subscribeTemplates.js');
const oa = require('../../../utils/oaRecall.js');

function canUseGetPhone() {
  try {
    return typeof wx.canIUse === 'function' && wx.canIUse('button.open-type.getPhoneNumber');
  } catch (e) {
    return false;
  }
}

Page({
  data: {
    pref: { sms: false, voice: false, consent: false, phoneBound: false, phoneMask: '', status: 'init' },
    canGetPhone: false,
    oa: { name: '熵盾智能', followed: false, configured: false, showQR: false }
  },

  onLoad() {
    this.setData({
      pref: recall.getPref(),
      canGetPhone: canUseGetPhone(),
      oa: { name: oa.SERVICE_ACCOUNT.name, followed: oa.getFollowed(), configured: oa.isConfigured(), showQR: false }
    });
  },

  onShow() {
    this.setData({
      pref: recall.getPref(),
      oa: { name: oa.SERVICE_ACCOUNT.name, followed: oa.getFollowed(), configured: oa.isConfigured(), showQR: this.data.oa.showQR }
    });
  },

  onToggleSms(e) {
    const next = recall.setChannels({ sms: e.detail.value, voice: this.data.pref.voice });
    this.setData({ pref: next });
  },

  onToggleVoice(e) {
    const next = recall.setChannels({ sms: this.data.pref.sms, voice: e.detail.value });
    this.setData({ pref: next });
  },

  onConsent(e) {
    const checked = !!e.detail.value;
    if (checked) {
      recall.grantConsent();
      this.setData({ pref: recall.getPref() });
    } else {
      // 撤回同意 → 清本地真实同意位 + 删除手机号，并通知服务器删除数据、加入退订名单
      // 【9/2 Bug4】原先这里只改本地展示位：consent 模块真实同意位没清、服务器也没收到通知，
      // 而后端护栏读的正是服务器那两个字段 → 用户点了撤回，服务器仍照发短信/语音（违反 PIPL 15 条）
      wx.showLoading({ title: '处理中' });
      recall.revokeConsent()
        .then(r => {
          wx.hideLoading();
          this.setData({ pref: (r && r.pref) || recall.getPref() });
          wx.showToast({
            title: r && r.pending ? '已撤回，待同步服务器' : '已撤回同意并删除手机号',
            icon: 'none'
          });
        })
        .catch(() => {
          wx.hideLoading();
          this.setData({ pref: recall.getPref() });
          wx.showToast({ title: '本地已撤回', icon: 'none' });
        });
    }
  },

  onGetPhone(e) {
    const d = e.detail || {};
    if (d.errMsg && d.errMsg.indexOf('ok') < 0) {
      wx.showToast({ title: '已取消授权', icon: 'none' });
      return;
    }
    if (!this.data.pref.consent) {
      wx.showToast({ title: '请先开启单独同意', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '绑定中' });
    recall.bindPhone(d).then(r => {
      wx.hideLoading();
      if (r.ok) {
        wx.showToast({ title: r.pending ? '已记录，待后端联调' : '手机号已绑定', icon: 'none' });
      } else {
        wx.showToast({ title: r.message || '绑定失败', icon: 'none' });
      }
      this.setData({ pref: recall.getPref() });
    });
  },

  onUnbind() {
    // 解除绑定同样走 revokeConsent：手机号一旦删除就不该再有任何外部触达，
    // 且必须让服务器同步删除，否则后端护栏（读 piplConsentToken + recallPhoneMasked）仍会照发
    wx.showLoading({ title: '处理中' });
    recall.revokeConsent()
      .then(r => {
        wx.hideLoading();
        this.setData({ pref: (r && r.pref) || recall.getPref() });
        wx.showToast({
          title: r && r.pending ? '已解除，待同步服务器' : '已解除绑定',
          icon: 'none'
        });
      })
      .catch(() => {
        wx.hideLoading();
        this.setData({ pref: recall.getPref() });
        wx.showToast({ title: '本地已解除', icon: 'none' });
      });
  },

  onAuthSub() {
    if (sub && typeof sub.request === 'function') {
      const keys = (sub.TEMPLATE_ID && Object.keys(sub.TEMPLATE_ID)) || [];
      sub.request(keys);
    }
  },

  // —— 服务号关注引导（Layer3 主召回）——
  onOAComponentLoad() { /* official-account 组件成功渲染（仅特定场景值可见） */ },
  onOAComponentError(e) {
    // 组件不可见（场景值不符/未配置）时，引导用户走二维码/搜索兜底
    console.warn('[oaRecall] official-account 组件未展示:', e && e.detail);
  },
  onToggleQR() {
    this.setData({ 'oa.showQR': !this.data.oa.showQR });
  },
  onConfirmFollow() {
    oa.setFollowed(true);
    wx.showLoading({ title: '记录中' });
    oa.reportFollow().then(r => {
      wx.hideLoading();
      wx.showToast({ title: r.pending ? '已记录，待后端联调' : '已记录关注', icon: 'none' });
      this.setData({ 'oa.followed': true });
    });
  },

  // —— 人工协助（客服辅助层，非下发通道）——
  // bindcontact 在用户进入/离开客服会话时回调（detail 含 path/query，仅当用户在客服消息内点击小程序卡片时）。仅做埋点。
  // 客服消息规范禁止诱导触发、禁止主动下发提醒——本入口只作人工引导转化层，不下发任何提醒。
  onContact() {
    try {
      const funnel = require('../../../utils/funnel.js');
      if (funnel && typeof funnel.log === 'function') {
        funnel.log('recall_contact_open', { source: 'recall_settings' });
      }
    } catch (err) {}
  }
});
