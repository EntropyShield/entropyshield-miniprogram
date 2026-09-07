// pages/controller/index.js
// MOD: CLEAN_HARDCODED_API_BASE_20260103
const funnel = require('../../utils/funnel.js');
// [V2.0-接线] 本周 7 格改用后端权威数据 /api/discipline/weekly
const CONFIG = require('../../config.js');
const clientIdUtil = require('../../utils/clientId.js');

// [V2.0-接线] 取 clientId，取不到返回空串（不抛错、不阻塞渲染）
async function safeClientId() {
  try {
    const cid = await clientIdUtil.ensureClientId();
    return cid ? String(cid) : '';
  } catch (e) {
    return '';
  }
}

// [P1-SHARE-20251215] 安全开启分享菜单
function safeShowShareMenu() {
  try {
    wx.showShareMenu({ withShareTicket: false });
  } catch (e) {}
}

// [P1-SHARE-20251215] 获取我的邀请码（兼容多处存储）
function getMyInviteCode() {
  const userRights = wx.getStorageSync('userRights') || {};
  const code =
    wx.getStorageSync('inviteCode') ||
    wx.getStorageSync('myInviteCode') ||
    userRights.inviteCode ||
    '';
  return String(code || '').trim();
}

// [P1-SHARE-20251215] 保存邀请人邀请码到 pendingInviteCode（避免覆盖自己的邀请码）
function savePendingInviteCode(inCode) {
  const code = String(inCode || '').trim();
  if (!code) return;

  const my = getMyInviteCode();
  if (my && code === my) return;

  wx.setStorageSync('pendingInviteCode', code);
}

Page({
  data: {
    finishedDays: 0,
    stageText: '风险管理待启动',
    nextStepText: '',

    campSummary: {
      finishedDays: 0,
      rewardRounds: 0
    },


    // ===== [V2.0-G3] 风控工作台（24 号原型落地）=====
    // 数据策略：能本地推导的立刻可用；需后端的诚实占位，不编造数字。
    wbDateText: '',      // 头部日期文案
    wbDoneCount: 0,      // 今日清单完成数
    wbTotalCount: 0,
    wbStreak: 0,         // 连续守纪天数（本地打卡推导）
    wbWeekCells: [],     // 本周 7 格打卡状态
    wbRateReady: false,  // 后端 /api/discipline/weekly 已返事实计数后置 true
    wbRate: 0,           // 兼容旧字段（保留，不再使用百分比）
    wbCheckedCount: 0,   // 本周打卡天数
    wbTotalDays: 0,      // 累计打卡天数
    wbMaxStreak: 0,      // 最长连续
    todoList: [],        // 今日执行清单
    wbPlans: [],         // 存续方案（本地 tradeRecords 推导）
    wbRecords: [],       // 执行记录
    wbSeg: 0,            // 内部分段：0 方案 / 1 记录 / 2 报告
    wbReports: [],       // 报告入口
    wbHint: ''           // 空态提示
  },

  // [P1-SHARE-20251215] 接收分享参数
  onLoad(options) {
    safeShowShareMenu();

    if (options && options.inviteCode) {
      savePendingInviteCode(options.inviteCode);
    }
  },

  onShow() {
    funnel.log('CONTROLLER_VIEW', { ts: Date.now() });

    // [P1-SHARE-20251215] tabBar 页也确保开启分享
    safeShowShareMenu();

    this.refreshCampSummary();
    this.buildWorkbench(); // [V2.0-G3] 工作台数据（本地推导 + 后端就绪即接管）
  },

  // ===== [V2.0-G3] 风控工作台：把"门面"改成"每天要干活的地方" =====
  // 设计取舍：24 号原型里"周执行率/存续方案进度"本应由后端算，
  // 后端未就绪时**不编造数字** —— 能本地推导的（打卡、持仓）立刻可用，
  // 需要历史执行数据的诚实显示"数据积累中"。与 J1 站内消息同一降级原则。
  buildWorkbench() {
    try {
      const today = this._todayKey();
      const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date().getDay()];

      // --- 打卡（本地）---
      const streak = Number(wx.getStorageSync('checkinStreak') || 0) || 0;
      const lastDate = wx.getStorageSync('checkinLastDate') || '';
      const checkedToday = lastDate === today;

      // --- 持仓（复用首页 B4 同款兼容映射，不另造字段口径）---
      let recs = [];
      try {
        const raw = wx.getStorageSync('tradeRecords');
        if (Array.isArray(raw)) recs = raw;
      } catch (e) {}
      const hasHolding = recs.length > 0;
      const noStopCount = recs.filter(
        (it) => !(it.stopLossPrice || it.stopPrice)
      ).length;

      // --- 今日执行清单（5 项，全部可本地判定）---
      const todoList = [
        {
          key: 'checkin',
          name: '每日打卡',
          desc: checkedToday ? '已完成 · 连续守纪 ' + streak + ' 天' : '今天还没打卡',
          done: checkedToday,
          path: '/pages/index/index',
          tab: true
        },
        {
          key: 'holding',
          name: '检查持仓诊断',
          desc: hasHolding
            ? (noStopCount > 0 ? (noStopCount + ' 个标的未设止损') : '全部已设止损')
            : '你还没有录入持仓记录',
          done: hasHolding && noStopCount === 0,
          path: '/pkgReport/tradeRecord/index'
        },
        {
          key: 'stoploss',
          name: '确认持仓止损线',
          desc: noStopCount > 0 ? (noStopCount + ' 个标的待补止损') : '止损线已齐备',
          done: hasHolding && noStopCount === 0,
          path: '/pkgReport/tradeRecord/index'
        },
        {
          key: 'calc',
          name: '交易前的风控测算',
          desc: '开仓先过一遍，把最大风险写清楚',
          done: false,
          path: '/pages/riskCalculator/index'
        },
        {
          key: 'review',
          name: '写收盘复盘',
          desc: '沉淀进长期档案，是年报的原料',
          done: false,
          path: '/pkgReport/longArchive/index'
        }
      ];

      const doneCount = todoList.filter((i) => i.done).length;

      // --- 本周 7 格：先用本地数据渲染，随后由 loadWeekFromServer 用后端权威数据回填 ---
      // Q1 决策 A：只点亮已打卡（hit），未打卡一律中性态 —— 不加 miss 红态，零羞辱感。
      // 后端不可达时保持这里的本地结果（今天命中即亮），不伪装成"未执行"。
      const wbWeekCells = ['一', '二', '三', '四', '五', '六', '日'].map((label, idx) => {
        const isToday = idx === ((new Date().getDay() + 6) % 7);
        let state = 'idle';
        if (isToday) state = checkedToday ? 'hit' : 'idle';
        return { label: label, state: state, isToday: isToday };
      });

      // --- 存续方案 / 执行记录（同一份 tradeRecords 的两种视图）---
      const wbPlans = recs.slice(0, 10).map((it, i) => {
        const nm = String(it.stockName || it.name || ('标的' + (i + 1)));
        const hasStop = !!(it.stopLossPrice || it.stopPrice);
        return {
          name: nm,
          initial: nm.charAt(0) || '—',
          desc: hasStop ? '已设止损 · 规则已就位' : '未设止损 · 规则缺口',
          hasStop: hasStop,
          stopText: hasStop ? String(it.stopLossPrice || it.stopPrice) : '—'
        };
      });

      const wbRecords = recs.slice(0, 10).map((it, i) => {
        const nm = String(it.stockName || it.name || ('标的' + (i + 1)));
        const hasStop = !!(it.stopLossPrice || it.stopPrice);
        return {
          name: nm,
          desc: (it.createTime || it.createdAt || it.date || '近期记录') +
                (hasStop ? ' · 止损已设' : ' · 未设止损'),
          ok: hasStop
        };
      });

      // --- 报告入口（静态，长期有效）---
      const wbReports = [
        { name: '风控报告', desc: '风险重点、纪律提醒与待复核事项', path: '/pkgReport/riskReport/index' },
        { name: '长期档案', desc: '持续沉淀的风险管理记录与执行表现', path: '/pkgReport/longArchive/index' },
        { name: '亏损人格档案', desc: '亏损时更接近规则执行还是情绪驱动', path: '/pkgTest/testLossPersonality/index' }
      ];

      this.setData({
        wbDateText: this._todayMD() + ' ' + wd + ' · 你的规则，今天执行到哪了',
        wbStreak: streak,
        wbWeekCells: wbWeekCells,
        wbRateReady: false, // 后端 /api/discipline/weekly 就绪后改为 true 并填真实百分比
        todoList: todoList,
        wbDoneCount: doneCount,
        wbTotalCount: todoList.length,
        wbPlans: wbPlans,
        wbRecords: wbRecords,
        wbReports: wbReports,
        wbHint: recs.length ? '' : '还没有交易记录，先做一次测算并录入持仓，这里就会长出你的工作台'
      });

      // [V2.0-接线] 后端权威周数据回填（异步，失败静默保留上面的本地渲染）
      this.loadWeekFromServer().catch(() => {});
    } catch (e) {
      console.error('[controller] buildWorkbench error', e);
    }
  },

  // [V2.0-接线] 本周 7 格取自后端 /api/discipline/weekly
  // 响应：{ ok, weekStart, weekEnd, days:[{date,weekday,checked,isToday}], checkedCount, streak, ... }
  // Q1-A：只亮 hit（checked=true），其余 idle；后端 days 顺序与前端周一为首一致（WEEKDAY_CN[0]='一'）。
  // 注意：后端 weekStartOf 固定 Asia/Shanghai，前端 new Date().getDay() 取本地时区，
  //       跨时区/跨零点时"今天"可能错位 → 以服务端返回的 isToday 为准，不自行推算。
  async loadWeekFromServer() {
    const base = (CONFIG && CONFIG.API_BASE) ? CONFIG.API_BASE : '';
    if (!base) return;
    const cid = await safeClientId();
    if (!cid) return;
    const self = this;
    wx.request({
      url: base + '/api/discipline/weekly?clientId=' + encodeURIComponent(cid),
      method: 'GET',
      timeout: 6000,
      success(res) {
        const r = (res && res.data) || {};
        if (!r.ok || !Array.isArray(r.days) || r.days.length !== 7) return;
        const cells = r.days.map((d) => ({
          label: d.weekday,
          state: d.checked ? 'hit' : 'idle', // Q1-A：无 miss 态
          isToday: !!d.isToday
        }));
        const patch = { wbWeekCells: cells };
        // streak 以后端权威值为准（跨设备一致）
        const s = Number(r.streak);
        if (Number.isFinite(s)) patch.wbStreak = s;
        // wbRateReady 保持 false：执行率口径未定义，后端故意不返回 rate，不编造百分比
        self.setData(patch);
      }
      // fail 静默：保留本地渲染
    });
  },

  _todayKey() {
    const d = new Date();
    const p = (n) => (n < 10 ? '0' + n : '' + n);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  },

  _todayMD() {
    const d = new Date();
    const p = (n) => (n < 10 ? '0' + n : '' + n);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  },

  // 分段切换：0 存续方案 / 1 执行记录 / 2 报告
  onSegChange(e) {
    const seg = Number(e.currentTarget.dataset.seg || 0);
    this.setData({ wbSeg: seg });
  },

  // 清单项点击：tab 页用 switchTab，普通页用 navigateTo
  onTodoTap(e) {
    const item = e.currentTarget.dataset.item || {};
    if (!item.path) return;
    if (item.tab) {
      wx.switchTab({ url: item.path });
    } else {
      wx.navigateTo({ url: item.path });
    }
  },

  onPlanTap(e) {
    wx.navigateTo({ url: '/pkgReport/tradeRecord/index' });
  },

  onReportTap(e) {
    const path = e.currentTarget.dataset.path;
    if (path) wx.navigateTo({ url: path });
  },

  refreshCampSummary() {
    try {
      const finishedMap = wx.getStorageSync('campFinishedMap') || {};
      const finishedDays = Object.keys(finishedMap).length;

      const userRights = wx.getStorageSync('userRights') || {};
      const rewardRounds = Number(userRights.campRewardCount || 0);
      const hasPaidCourse = !!wx.getStorageSync('hasPaidCourse');

      let stageText = '';
      let nextStepText = '';

      if (hasPaidCourse) {
        stageText = '风控能力持续建设中';
        nextStepText = '结合交易记录、风控报告和长期档案，持续复盘每一笔交易的规则执行。';
      } else if (finishedDays >= 7) {
        stageText = '已完成一轮训练';
        nextStepText = '把训练中形成的仓位、退出和复盘动作应用到每一笔交易。';
      } else if (finishedDays > 0) {
        stageText = '训练进行中';
        nextStepText = '继续完成本轮训练，并在每次交易前先完成风险测算。';
      } else {
        stageText = '风险管理待启动';
        nextStepText = '先完成一次风险测算，再开始7天风控训练。';
      }

      this.setData({
        finishedDays,
        stageText,
        nextStepText,
        campSummary: { finishedDays, rewardRounds }
      });
    } catch (e) {
      console.error('[controller] refreshCampSummary error', e);
    }
  },

  goCamp() {
    wx.navigateTo({ url: '/pkgChallenge/campIntro/index' });
  },


  // [P1-ROUTE-FINAL-FIX-20251215]
  goToCourseList() {
    console.log('[controller] goToCourseList tap -> pkgAcademy');
    // 控局者学院（数据驱动，见 utils/courseManifest.js）：合并原 course/courses，沙龙留空接口待后续加
    wx.navigateTo({
      url: '/pkgAcademy/pages/index?from=controller',
      fail(err) {
        console.error('[controller] navigateTo /pkgAcademy/pages/index fail:', err);
        wx.showToast({ title: '暂时无法打开控局者学院', icon: 'none' });
      }
    });
  },


  goCalc() {
    wx.navigateTo({ url: '/pages/riskCalculator/index' });
  },

  goTradeRecord() {
    wx.navigateTo({ url: '/pkgReport/tradeRecord/index?from=controller' });
  },


  goLongArchive() {
    wx.navigateTo({ url: '/pkgReport/longArchive/index?from=controller' });
  },



  // =========================
  // B 区：固定入口（口径与课程日历一致）
  // =========================




  // [P1-SHARE-20251215] 分享守护者入口（携带 inviteCode）
  onShareAppMessage() {
    const inviteCode = getMyInviteCode();
    const path =
      `/pages/controller/index?from=share` +
      (inviteCode ? `&inviteCode=${inviteCode}` : '');

    funnel.log('CONTROLLER_SHARE', {
      inviteCode: inviteCode ? 'Y' : 'N'
    });

    return {
      title: '熵盾 · 风控中心',
      path
    };
  }
});
