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
      membershipName: rights.membershipName || rights.membership_name || '未开通会员',
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