// pkgChallenge/pkDetail/index.js —— 盘口详情 + 下注（68 号）
// 围观者用 B 轨战力值押 Y/N（同注分彩，平台不抽水）；守纪者本人可看结算结果
const pkApi = require('../../utils/pkApi.js');

Page({
  data: {
    wardId: '',
    seasonNo: 'S1',
    isMine: false,
    pool: null,
    power: 0,
    side: 'Y',
    amount: 10,
    loading: true,
    submitting: false
  },

  onLoad(options) {
    const wardId = decodeURIComponent(options.wardId || '');
    const seasonNo = options.seasonNo || 'S1';
    const cid = pkApi.clientId() || '';
    this.setData({ wardId, seasonNo, isMine: wardId === cid });
    this.load();
  },

  onShow() { this.load(); },

  async load() {
    try {
      const cid = pkApi.clientId() || '';
      const [bal, p] = await Promise.all([
        pkApi.powerBalance(cid),
        pkApi.pool(this.data.wardId, cid)
      ]);
      const pool = (p && p.ok && p.exists) ? p : null;
      if (pool) pool.wardMask = '守纪者·' + String(this.data.wardId).slice(-4);
      this.setData({
        power: bal && bal.ok ? bal.balance : 0,
        pool,
        loading: false
      });
    } catch (e) {
      this.setData({ loading: false });
    }
  },

  onSide(e) {
    this.setData({ side: e.currentTarget.dataset.side });
  },

  onAmount(e) {
    const v = Number(e.detail.value) || 0;
    this.setData({ amount: v });
  },

  quick(e) {
    const v = Number(e.currentTarget.dataset.v);
    this.setData({ amount: v === -1 ? Math.max(0, Math.floor(this.data.power)) : v });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    const amt = Math.floor(Number(this.data.amount) || 0);
    if (amt <= 0) { wx.showToast({ title: '请输入下注额', icon: 'none' }); return; }
    if (amt > this.data.power) { wx.showToast({ title: '战力值不足', icon: 'none' }); return; }
    this.setData({ submitting: true });
    wx.showLoading({ title: '下注中' });
    const res = await pkApi.bet(this.data.wardId, this.data.side, amt);
    wx.hideLoading();
    this.setData({ submitting: false });
    if (res && res.ok) {
      wx.showToast({ title: '下注成功', icon: 'success' });
      this.load();
    } else {
      wx.showToast({ title: (res && res.msg) || '下注失败', icon: 'none' });
    }
  }
});
