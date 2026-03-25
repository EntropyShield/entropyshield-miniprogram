// pages/paySuccess/index.js
function getPlanMeta(planKey, amountFen) {
  const map = {
    times3: { title: '9.9元 / 3次', rights: '稳健版', desc: '适合先体验风控计算器' },
    month: { title: '月卡 999', rights: '稳健版', desc: '适合短周期连续使用' },
    quarter: { title: '季卡 2999', rights: '稳健版 + 加强版', desc: '适合持续训练与复盘' },
    year: { title: '年卡 9999', rights: '稳健版 + 加强版', desc: '适合长期使用' }
  };
  if (map[planKey]) return map[planKey];

  const amount = Number(amountFen || 0);
  if (amount === 990) return map.times3;
  if (amount === 99900) return map.month;
  if (amount === 299900) return map.quarter;
  if (amount === 999900) return map.year;

  return { title: '购买成功', rights: '权益已开通', desc: '可返回使用风控计算器' };
}

Page({
  data: {
    title: '',
    rights: '',
    desc: '',
    amountText: ''
  },

  onLoad(options) {
    const opts = options || {};
    const planKey = String(opts.planKey || '').trim();
    const amountFen = Number(opts.amountFen || 0) || 0;
    const meta = getPlanMeta(planKey, amountFen);

    this.setData({
      title: meta.title,
      rights: meta.rights,
      desc: meta.desc,
      amountText: amountFen ? (amountFen / 100).toFixed(2) : ''
    });
  },

  goCalc() {
    wx.redirectTo({
      url: '/pages/riskCalculator/index',
      fail() {
        wx.navigateTo({ url: '/pages/riskCalculator/index' });
      }
    });
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});