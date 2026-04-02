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

  normalizeMembershipName(rights = {}) {
    const rawName = String(rights.membershipName || rights.membership_name || '').trim();
    const rawPlan = String(rights.membershipPlan || rights.membership_plan || '').trim().toLowerCase();
    const freeCalcTimes = Number(rights.freeCalcTimes || 0) || 0;
    const expireAt = Number(
      rights.membershipExpireAt ||
      rights.membership_expire_at ||
      0
    );

    if (rawPlan === 'times3') return '3次方案';
    if (rawPlan === 'month') return '月会员';
    if (rawPlan === 'quarter') return '季度会员';
    if (rawPlan === 'year') return '年度会员';

    if (rawName.includes('3次')) return '3次方案';
    if (rawName.includes('月会员') || rawName.includes('月卡')) return '月会员';
    if (rawName.includes('季度会员') || rawName.includes('季卡')) return '季度会员';
    if (rawName.includes('年度会员') || rawName.includes('年卡')) return '年度会员';

    if (rawName.toLowerCase() === 'times3') return '3次方案';
    if (rawName.toLowerCase() === 'month') return '月会员';
    if (rawName.toLowerCase() === 'quarter') return '季度会员';
    if (rawName.toLowerCase() === 'year') return '年度会员';

    // 没有时效会员，但还有可用方案次数
    if (!rawName && !expireAt && freeCalcTimes > 0) return '方案次数用户';

    return rawName || '未开通会员';
  },

  syncFromStorage() {
    const rights = wx.getStorageSync('userRights') || {};
    const expireAt = Number(
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