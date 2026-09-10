// pkgService/witnessWall/index.js
// 守纪公开围观墙：所有被见证的守纪者聚合展示（脱敏 + 段位/守纪/打卡，不含收益）
const sup = require('../../utils/supervisorApi.js');

Page({
  data: {
    list: [],
    page: 1,
    pageSize: 20,
    loading: false,
    finished: false
  },

  onLoad() {
    this.loadWall(true);
  },

  async loadWall(reset) {
    if (this.data.loading) return;
    if (!reset && this.data.finished) return;
    const base = sup.getApiBase();
    if (!base) return;
    const page = reset ? 1 : this.data.page;
    this.setData({ loading: true });
    try {
      const d = await sup.getWall(page, this.data.pageSize);
      if (d && d.ok) {
        const arr = (d.list || []).map((it) => ({
          id: it.id,
          gradeText: sup.gradeText(it.grade),
          supervisorCount: it.supervisorCount || 0,
          streakDays: it.streakDays || 0,
          totalDays: it.totalDays || 0
        }));
        const list = reset ? arr : this.data.list.concat(arr);
        this.setData({
          list,
          page: page + 1,
          finished: arr.length < this.data.pageSize
        });
      }
    } catch (e) {
      // 忽略网络错误，保留已加载内容
    } finally {
      this.setData({ loading: false });
    }
  },

  onReachBottom() {
    this.loadWall(false);
  }
});
