// pages/membership/index.js
const { PLAN_LIST, getPlanByKey } = require('../../utils/plans');
const { getUserRights, getMembershipLabel } = require('../../utils/userRights');

function formatExpire(rights) {
  const expireAt = Number(rights.membershipExpireAt || 0);
  if (!expireAt) return '';
  try {
    const d = new Date(expireAt);
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch (e) {
    return '';
  }
}

function buildCurrentRights() {
  const rights = getUserRights();
  const label = getMembershipLabel();

  if (!label || !label.membershipName || label.membershipName === '未开通会员') {
    return {
      isMember: false,
      name: '未开通会员',
      levelText: '稳健版可用免费测算次数',
      expireText: '',
      advancedEnabled: false
    };
  }

  return {
    isMember: true,
    name: label.membershipName,
    levelText: label.label,
    expireText: formatExpire(rights),
    advancedEnabled: !!rights.advancedEnabled ||
      label.productCode === 'VIP_QUARTER' ||
      label.productCode === 'VIP_YEAR' ||
      label.productCode === 'LIFETIME'
  };
}

Page({
  data: {
    from: '',
    plans: PLAN_LIST,
    current: {
      isMember: false,
      name: '未开通会员',
      levelText: '稳健版可用免费测算次数',
      expireText: '',
      advancedEnabled: false
    }
  },

  onLoad(options) {
    this.setData({
      from: (options && options.from) || ''
    });
  },

  onShow() {
    this.setData({ current: buildCurrentRights() });
  },

  onChoosePlan(e) {
    const ds = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const key = String(ds.key || '');
    if (!key) return;

    const plan = getPlanByKey(key);
    if (!plan) return;

    wx.navigateTo({
      url: '/pages/pay/index?planKey=' + encodeURIComponent(plan.key) + '&from=membership'
    });
  },

  goCalculator() {
    wx.navigateTo({
      url: '/pages/riskCalculator/index'
    });
  },

  goBack() {
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: '/pages/index/index' });
      }
    });
  }
});
