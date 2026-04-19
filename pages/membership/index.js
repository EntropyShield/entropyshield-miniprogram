Page({
  data: {
    membershipName: '未开通会员',
    freeCalcTimes: 0,
    inviteCode: '',
    membershipExpireText: ''
  },

  onShow() {
    this.syncFromStorage();
  },

  toTsMs(v) {
    if (v === null || typeof v === 'undefined' || v === '') return 0;

    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return 0;
      if (v > 1e12) return Math.floor(v);
      if (v > 1e9) return Math.floor(v * 1000);
      return Math.floor(v);
    }

    const s = String(v).trim();
    if (!s) return 0;

    if (/^\d+$/.test(s)) {
      const n = Number(s);
      if (!Number.isFinite(n)) return 0;
      if (n > 1e12) return Math.floor(n);
      if (n > 1e9) return Math.floor(n * 1000);
      return Math.floor(n);
    }

    const t = Date.parse(s.replace(' ', 'T'));
    return Number.isFinite(t) ? Math.floor(t) : 0;
  },

  normalizeMembershipName(rights = {}) {
    const rawName = String(rights.membershipName || rights.membership_name || '').trim();
    const rawPlan = String(rights.membershipPlan || rights.membership_plan || '').trim().toLowerCase();
    const freeCalcTimes = Number(rights.freeCalcTimes || 0) || 0;
    const expireAt = this.toTsMs(
      rights.membershipExpireAt ||
      rights.membership_expire_at ||
      0
    );

    if (
      rawPlan === 'trial3' ||
      rawPlan === 'times3' ||
      rawName.includes('体验') ||
      rawName.includes('3天') ||
      rawName.includes('9.9')
    ) return '9.9体验·3天';

    if (rawPlan === 'month') return '控局者·月卡';
    if (rawPlan === 'quarter') return '控局者·季卡';
    if (rawPlan === 'year') return '控局者·年卡';

    if (rawName.includes('月卡') || rawName.includes('月会员')) return '控局者·月卡';
    if (rawName.includes('季卡') || rawName.includes('季度')) return '控局者·季卡';
    if (rawName.includes('年卡') || rawName.includes('年度')) return '控局者·年卡';
    if (rawName.includes('终身')) return '终身会员';

    if (!rawName && !expireAt && freeCalcTimes > 0) return '任务奖励用户';

    return rawName || '未开通会员';
  },

  syncFromStorage() {
    const rights = wx.getStorageSync('userRights') || {};
    const expireAt = this.toTsMs(
      rights.membershipExpireAt ||
      rights.membership_expire_at ||
      0
    );

    let membershipExpireText = '';
    if (expireAt && !Number.isNaN(expireAt)) {
      try {
        const d = new Date(expireAt);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        membershipExpireText = `${y}-${m}-${day} ${hh}:${mm}`;
      } catch (e) {
        membershipExpireText = '';
      }
    }

    this.setData({
      membershipName: this.normalizeMembershipName(rights),
      freeCalcTimes: Number(rights.freeCalcTimes || 0) || 0,
      inviteCode: rights.inviteCode || '',
      membershipExpireText
    });
  },

  goBack() {
    wx.navigateBack({
      delta: 1,
      fail() {
        wx.switchTab({
          url: '/pages/profile/index'
        });
      }
    });
  }
});