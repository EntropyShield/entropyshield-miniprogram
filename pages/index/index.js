// pages/index/index.js
// [V2.0-B2] 每日风控仪表盘首页骨架
// 说明：本文件为 V2.0 新骨架（取代原「计算器门面」旧逻辑，旧未提交改动不合并）。
// 保留：funnel 埋点、邀请码逻辑、会员权益快照、各页跳转、分享带邀请码。
// 新增：风险温度卡(B1/B2)、每日打卡(B3)、持仓诊断(B4)、风险体检测试入口(C1/C3)、每日箴言。

const funnel = require('../../utils/funnel.js');
const share = require('../../utils/share.js');
const messages = require('../../utils/messages.js');
const sub = require('../../utils/subscribeTemplates.js');
const CONFIG = require('../../config.js');
// [V2.0-接线] 打卡服务端权威化：本地 Storage 可篡改、不跨设备，后端是唯一权威源。
//   ensureClientId 命中缓存时零成本返回；未命中才走 wx.login，失败一律降级（见各调用处 try/catch）。
const clientIdUtil = require('../../utils/clientId.js');
const USER_RIGHTS_KEY = 'userRights';

// [V2.0-接线] 取 clientId，取不到返回空串（不抛错、不阻塞渲染）
// 未配置 WX_APPSECRET 时后端 /api/wx/login 不可用 → 此处必然失败 → 全部降级为本地数据。
async function safeClientId() {
  try {
    const cid = await clientIdUtil.ensureClientId();
    return cid ? String(cid) : '';
  } catch (e) {
    return '';
  }
}

// ===== 工具函数 =====
function safeTrack(step, ext = {}) {
  try {
    funnel.log(step, {
      page: 'index',
      ts: Date.now(),
      ...ext
    });
  } catch (e) {
    console.warn('[index] funnel log fail:', step, e);
  }
}

function getTapSource(e, fallback = 'unknown') {
  try {
    return (
      e &&
      e.currentTarget &&
      e.currentTarget.dataset &&
      e.currentTarget.dataset.source
    ) || fallback;
  } catch (err) {
    return fallback;
  }
}

function stepWithSource(base, source = 'unknown') {
  return `${base}_${String(source || 'unknown').toUpperCase()}`
    .replace(/[^A-Z0-9_]+/g, '_');
}

function toExpireMs(v) {
  if (v === null || typeof v === 'undefined' || v === '') return 0;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return 0;
    if (v > 1e12) return Math.floor(v);
    if (v > 1e9) return Math.floor(v * 1000);
    return Math.floor(v);
  }
  const s = String(v || '').trim();
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
}

function formatExpireDate(ms) {
  const t = toExpireMs(ms);
  if (!t) return '—';
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// 风控箴言（数据陈述/纪律向，不含投资咨询）
const DAILY_QUOTES = [
  '规则优先，先控风险再想收益。',
  '赚钱靠规则，守钱靠风控。',
  '先看最多亏多少，再决定是否参与。',
  '止损是纪律，不是认输。',
  '仓位管理比方向判断更决定生死。',
  '连续小亏好过一次大亏。',
  '情绪上头时，先离场再决策。',
  '你的对手不是市场，是自己的冲动。',
  '计划你的交易，交易你的计划。',
  '复盘比预测更能让你活得更久。'
];

// 5 个风险体检测试入口（C1/C3）
const RISK_TESTS = [
  { key: 'loss', title: '亏损人格', desc: '8 题看清你的亏损性格', path: '/pkgTest/testLossPersonality/index' },
  { key: 'market', title: '市场风险感知', desc: '测你对风险的感知灵敏度', path: '/pkgTest/testMarketRisk/index' },
  { key: 'score', title: '风控能力评分', desc: '4 维评分卡，看清短板', path: '/pkgTest/testRiskScore/index' },
  { key: 'emotion', title: '交易情绪指数', desc: '测你的交易情绪波动', path: '/pkgTest/testEmotionIndex/index' },
  { key: 'danger', title: '交易危险等级', desc: '测你的交易危险等级', path: '/pkgTest/testDangerLevel/index' }
];

// 风险温度颜色映射
// [VI V1.0 §11.2] 三档风险状态：红=高 / 琥珀=中 / 绿=低。
// ⚠️ 低档必须用 --es-safe（Stable Green 功能色），不能用 --es-green（该令牌现为品牌蓝 #00BFFF），
//    否则"安全/低风险"会被渲染成品牌色，语义反转。2026-09-07 修正。
function tempColor(score) {
  if (score >= 70) return 'var(--es-red, #FF4D5E)';
  if (score >= 40) return 'var(--es-amber, #FFB020)';
  return 'var(--es-safe, #00E5A0)';
}
function tempLevel(score) {
  if (score >= 70) return '偏高·谨慎';
  if (score >= 40) return '中性·留意';
  return '偏低·平稳';
}

Page({
  data: {
    inviteCode: '',
    today: todayStr(),
    homeMembershipLabel: '未开通会员',
    homeMembershipExpireText: '—',
    homeTaskRightsText: '0次',

    // B1/B2 风险温度卡（后端未就绪时显示兜底）
    riskTemp: {
      ready: false,
      score: 0,
      level: '—',
      verdict: '开盘前更新中',
      verdictSub: '数据生成后这里会显示今日市场风险温度。',
      updTime: '',
      color: 'var(--es-amber, #FFB020)',
      ringDash: 0
    },

    // B3 每日打卡
    checkIn: { streak: 0, todayDone: false },

    // B4 持仓诊断（纯数据陈述；"距止损边界%"需行情源 B6 补全）
    holdings: [],
    holdingsHint: '你还没有录入持仓记录',

    monitorCount: 0,

    // 每日箴言
    dailyQuote: DAILY_QUOTES[new Date().getDate() % DAILY_QUOTES.length],

    // C1/C3 测试入口
    riskTests: RISK_TESTS
  },

  onLoad(options) {
    const opts = options || {};
    console.log('[index] onLoad options:', opts);

    safeTrack('HOME_VIEW', { hasInviteParam: !!(opts.inviteCode || opts.invite) });

    const myInvite = ensureInviteCode();
    this.setData({ inviteCode: myInvite });

    this.refreshHomeSnapshot();
    handleInviteFromOptions(opts);
    this.loadDashboard();
  },

  onShow() {
    this.refreshHomeSnapshot();
    safeTrack('HOME_SHOW', {
      membershipLabel: this.data.homeMembershipLabel || '未开通会员',
      membershipExpireText: this.data.homeMembershipExpireText || '—',
      taskRightsText: this.data.homeTaskRightsText || '0次'
    });
    this.drawLogo2D();
    this.loadDashboard();
    messages.refreshBadge();
  },

  // ===== 仪表盘数据加载（B1/B3/B4）=====
  loadDashboard() {
    // async 方法：显式吞掉 rejection，避免未捕获异常
    this.loadRiskDigest().catch(() => {});
    this.loadCheckIn();
    this.loadHoldings();
    this.loadMonitorCount();
  },

  // B1 风险温度：优先后端 /api/daily/digest，失败显示兜底（不阻塞渲染）
  // [V2.0-接线] 带 clientId：后端据此识别用户，回传个人打卡状态（digest.checkin）。
  //   取不到 clientId 时降级为不带参数，温度渲染不受影响。
  async loadRiskDigest() {
    const self = this;
    const base = (CONFIG && CONFIG.API_BASE) ? CONFIG.API_BASE : '';
    if (!base) {
      this.setData({ riskTemp: this.buildTemp(false, 0, '开盘前更新中', '数据生成后这里会显示今日市场风险温度。', '') });
      return;
    }
    const cid = await safeClientId();
    wx.request({
      url: base + '/api/daily/digest' + (cid ? ('?clientId=' + encodeURIComponent(cid)) : ''),
      method: 'GET',
      timeout: 6000,
      success(res) {
        // 响应壳已统一为扁平 { ok, ...字段 }；保留 data 兼容仅作历史兜底
        const d = (res && res.data && res.data.data) ? res.data.data : (res && res.data) || {};
        const score = Number(d.marketRiskScore != null ? d.marketRiskScore : d.riskScore);
        if (!Number.isFinite(score)) {
          self.setData({ riskTemp: self.buildTemp(false, 0, '开盘前更新中', '数据生成后这里会显示今日市场风险温度。', '') });
          return;
        }
        self.setData({
          riskTemp: self.buildTemp(true, score, d.verdict || '', d.verdictSub || '今日温度已更新，按规则执行即可。', d.updTime || '')
        });
        messages.refreshBadge();
      },
      fail() {
        self.setData({ riskTemp: self.buildTemp(false, 0, '开盘前更新中', '数据生成后这里会显示今日市场风险温度。', '') });
        messages.refreshBadge();
      }
    });
  },

  buildTemp(ready, score, verdict, verdictSub, updTime) {
    const s = Math.max(0, Math.min(100, Number(score) || 0));
    const obj = {
      ready,
      score: s,
      level: tempLevel(s),
      verdict: verdict || (ready ? '今日温度已更新' : '开盘前更新中'),
      verdictSub: verdictSub || '',
      updTime: updTime || '',
      color: tempColor(s),
      ringDash: Math.round(289 * s / 100)
    };
    // [V2.0-A] 持久化温度快照，供消息中心生成本地"温度更新"提醒（不依赖额外后端调用）
    try { wx.setStorageSync('riskTempSnapshot', { ready: obj.ready, score: obj.score, level: obj.level, updTime: obj.updTime }); } catch (e) {}
    return obj;
  },

  // B3 每日打卡：本地先渲染（不阻塞），再用后端权威数据回填
  // [V2.0-接线] 本地 Storage 可篡改、不跨设备；后端 /api/daily/digest 才是权威源。
  //   TODO(B3): 连续 3/7/21 天奖励 —— 规则未定义，后端只标记不发权益，此处同样不做任何发放动作。
  loadCheckIn() {
    const streak = Number(wx.getStorageSync('checkinStreak') || 0) || 0;
    const last = wx.getStorageSync('checkinLastDate') || '';
    const today = todayStr();
    this.setData({ checkIn: { streak, todayDone: last === today } });
    this.pullCheckInFromServer().catch(() => {});
  },

  // [V2.0-接线] 拉后端权威打卡状态覆盖本地（跨设备一致、防本地篡改）
  async pullCheckInFromServer() {
    const base = (CONFIG && CONFIG.API_BASE) ? CONFIG.API_BASE : '';
    if (!base) return;
    const cid = await safeClientId();
    if (!cid) return; // 未登录 → 保留本地数据，不打扰用户
    const self = this;
    wx.request({
      url: base + '/api/daily/digest?clientId=' + encodeURIComponent(cid),
      method: 'GET',
      timeout: 6000,
      success(res) {
        const d = (res && res.data) || {};
        if (!d.ok || !d.checkin) return; // 后端无此用户记录 → 保留本地
        const ci = d.checkin;
        const s = Number(ci.streak) || 0;
        self.setData({ checkIn: { streak: s, todayDone: !!ci.today } });
        // 回写本地，使下次冷启动更快、离线时也有值
        try {
          wx.setStorageSync('checkinStreak', s);
          if (ci.today) wx.setStorageSync('checkinLastDate', todayStr());
        } catch (e) {}
      }
      // fail 静默：后端不可达时本地数据已渲染，无需提示
    });
  },

  async doCheckIn() {
    const self = this;
    const today = todayStr();
    const last = wx.getStorageSync('checkinLastDate') || '';
    if (last === today) {
      wx.showToast({ title: '今天已打卡', icon: 'none' });
      return;
    }
    const yest = new Date(Date.now() - 86400000);
    const yStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
    const prevStreak = Number(wx.getStorageSync('checkinStreak') || 0) || 0;
    const newStreak = (last === yStr) ? prevStreak + 1 : 1;
    wx.setStorageSync('checkinStreak', newStreak);
    wx.setStorageSync('checkinLastDate', today);
    this.setData({ checkIn: { streak: newStreak, todayDone: true } });

    safeTrack('HOME_CHECKIN', { streak: newStreak });
    // [A方案·召回通道] 打卡成功 = 用户意愿最高点，调起订阅授权攒发送机会
    // 已授权"总是保持"则不再弹框；未配置模板 ID 时 sub.request 自动跳过
    sub.request(['daily_temperature', 'evening_checkin', 'position_alert', 'grade_upgrade']).catch(() => {});
    // TODO(B3): 连续 3/7/21 天触发 rights 奖励（测算次数）—— 奖励规则未定义，
    //   后端只返回 rewardMilestone 标记不发放，前端同理不做任何发放动作。
    wx.showToast({ title: '打卡成功 +1', icon: 'success' });

    // [V2.0-接线] best-effort 同步后端：本地已先行渲染，此处失败不影响用户体验
    this.pushCheckInToServer(today, newStreak);
  },

  // [V2.0-接线] 打卡上报后端（服务端权威化 + 幂等：同日重复提交后端返回 duplicated）
  async pushCheckInToServer(date, localStreak) {
    const base = (CONFIG && CONFIG.API_BASE) ? CONFIG.API_BASE : '';
    if (!base) return;
    const cid = await safeClientId();
    if (!cid) return;
    const self = this;
    wx.request({
      url: base + '/api/daily/checkin',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { clientId: cid, date: date },
      timeout: 6000,
      success(res) {
        const r = (res && res.data) || {};
        if (!r.ok) return;
        // 后端 streak 可能与本地不同（跨设备补打、本地被篡改）→ 以后端为准
        const s = Number(r.streak);
        if (Number.isFinite(s) && s !== localStreak) {
          try { wx.setStorageSync('checkinStreak', s); } catch (e) {}
          self.setData({ checkIn: { streak: s, todayDone: true } });
        }
        safeTrack('HOME_CHECKIN_SYNCED', {
          streak: Number.isFinite(s) ? s : localStreak,
          duplicated: !!r.duplicated,
          // rewardMilestone 仅上报，不弹窗、不发权益（规则未定义，弹了等于误导）
          milestone: r.rewardMilestone || null
        });
      }
      // fail 静默：离线也能打卡，下次进首页 pullCheckInFromServer 会补齐
    });
  },

  // B4 持仓诊断：best-effort 读本地记录，纯数据陈述
  loadHoldings() {
    let list = [];
    try {
      const recs = wx.getStorageSync('tradeRecords');
      if (Array.isArray(recs) && recs.length) {
        list = recs.slice(0, 5).map((it, i) => {
          const nm = String(it.stockName || it.name || ('标的' + (i + 1)));
          return {
            name: nm,
            initial: nm.charAt(0),
            stop: String(it.stopLossPrice || it.stopPrice || '—'),
            // 距止损边界% 需行情源 B6；暂以"已设止损"陈述
            tag: it.stopLossPrice || it.stopPrice ? '已设止损' : '未设止损'
          };
        });
      }
    } catch (e) {}
    this.setData({
      holdings: list,
      holdingsHint: list.length ? '' : '你还没有录入持仓记录'
    });
  },

  loadMonitorCount() {
    // B6 监控池信号数：后端就绪后由 /api/daily/digest 提供，骨架先置 0
    this.setData({ monitorCount: 0 });
  },

  // ===== 权益快照（保留）=====
  refreshHomeSnapshot() {
    const rights = wx.getStorageSync(USER_RIGHTS_KEY) || {};
    const effectiveRights = rights.effectiveRights || wx.getStorageSync('effectiveRights') || {};
    const membership = effectiveRights.membership || {};
    const task = effectiveRights.task || {};

    const freeCalcTimes =
      Number(
        task.freeCalcTimes != null
          ? task.freeCalcTimes
          : (task.rewardTimes != null ? task.rewardTimes : (rights.freeCalcTimes || rights.free_calc_times || 0))
      ) || 0;

    const membershipName = String(
      membership.name ||
      rights.membershipName ||
      rights.membership_name ||
      rights.currentMembershipName ||
      ''
    ).trim();

    const expireAt = toExpireMs(
      membership.expireAt ||
      rights.membershipExpireAt ||
      rights.membership_expire_at ||
      rights.membershipExpireText ||
      ''
    );

    const membershipActive =
      membership.active === true ||
      (!!expireAt && expireAt > Date.now());

    let homeMembershipLabel = '未开通会员';
    let homeMembershipExpireText = '-';

    if (membershipName && membershipName !== '未开通' && membershipName !== '未开通会员') {
      homeMembershipLabel = membershipActive
        ? membershipName
        : membershipName + '（已到期）';
      homeMembershipExpireText = expireAt ? formatExpireDate(expireAt) : '-';
    }

    const homeTaskRightsText = `${Math.max(0, freeCalcTimes)}次`;

    this.setData({ homeMembershipLabel, homeMembershipExpireText, homeTaskRightsText });
  },

  // 绘制 LOGO（六边形 + ∞）
  drawLogo2D() {
    const q = wx.createSelectorQuery();
    q.select('#entropyLogo')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0]) return;
        const canvas = res[0].node;
        const w = res[0].width;
        const h = res[0].height;
        const sys = (wx.getWindowInfo && wx.getWindowInfo()) || wx.getSystemInfoSync();
        const dpr = sys.pixelRatio || 1;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        // [VI V1.0 2026-09-07] 与 components/logoShield 保持同一套品牌色（canvas 不支持 var()，只能写死）
        const GREEN1 = '#00BFFF';  // 外六边形渐变起：Electric Blue（原 #00E5A0）
        const GREEN2 = '#00E8FF';  // 外六边形渐变止：Energy Cyan（原 #21FF7A）
        const BLUE1 = '#00E8FF';   // 内部符号渐变起：Energy Cyan（原 #36CFFF）
        const BLUE2 = '#006CFF';   // 内部符号渐变止：Deep Energy Blue（原 #1E90FF）
        const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46;

        const hexLW = Math.max(1, w * 0.095);
        const gradG = ctx.createLinearGradient(0, 0, w, h);
        gradG.addColorStop(0, GREEN1); gradG.addColorStop(1, GREEN2);
        ctx.save();
        ctx.strokeStyle = gradG; ctx.lineWidth = hexLW; ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(0, 191, 255,0.35)'; ctx.shadowBlur = 2 * (w / 40);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = -Math.PI / 6 + (i * Math.PI) / 3;
          const x = cx + R * Math.cos(ang), y = cy + R * Math.sin(ang);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.stroke(); ctx.restore();

        const rx = R * 0.34, r = R * 0.35, infLW = Math.max(1, r * 0.5);
        const gradB = ctx.createLinearGradient(0, cy, w, cy);
        gradB.addColorStop(0, BLUE1); gradB.addColorStop(1, BLUE2);
        ctx.save();
        ctx.strokeStyle = gradB; ctx.lineWidth = infLW; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(0,108,255,0.35)'; ctx.shadowBlur = 1.5 * (w / 40);
        ctx.beginPath(); ctx.arc(cx - rx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + rx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      });
  },

  // ===== 跳转（保留全部既有入口）=====
  goCalc(e) {
    const source = getTapSource(e, 'unknown');
    safeTrack(stepWithSource('HOME_CTA_GO_CALC', source), { source });
    wx.navigateTo({ url: '/pages/riskCalculator/index' });
  },

  goCamp(e) {
    const source = getTapSource(e, 'unknown');
    safeTrack(stepWithSource('HOME_CTA_GO_CAMP', source), { source });
    wx.navigateTo({ url: '/pkgChallenge/campIntro/index' });
  },


  goController(e) {
    const source = getTapSource(e, 'unknown');
    safeTrack(stepWithSource('HOME_CTA_GO_CONTROLLER', source), { source });
    wx.switchTab({ url: '/pages/controller/index' });
  },

  goTradeRecord(e) {
    const source = getTapSource(e, 'unknown');
    safeTrack(stepWithSource('HOME_CTA_GO_TRADE_RECORD', source), { source });
    wx.navigateTo({ url: '/pkgReport/tradeRecord/index?from=home' });
  },

  goRiskReport(e) {
    const source = getTapSource(e, 'unknown');
    safeTrack(stepWithSource('HOME_CTA_GO_RISK_REPORT', source), { source });
    wx.navigateTo({ url: '/pkgReport/riskReport/index?from=home' });
  },

  goLongArchive(e) {
    const source = getTapSource(e, 'unknown');
    safeTrack(stepWithSource('HOME_CTA_GO_LONG_ARCHIVE', source), { source });
    wx.navigateTo({ url: '/pkgReport/longArchive/index?from=home' });
  },

  goMainchainOverview(e) {
    const source = getTapSource(e, 'unknown');
    safeTrack(stepWithSource('HOME_CTA_GO_MAINCHAIN', source), { source });
    wx.navigateTo({ url: '/pkgService/mainchainOverview/index?from=home' });
  },


  goMembership(e) {
    const source = getTapSource(e, 'unknown');
    safeTrack(stepWithSource('HOME_CTA_GO_MEMBERSHIP', source), { source });
    wx.navigateTo({ url: '/pages/membership/index' });
  },

  // C1/C3 风险体检测试入口
  goTest(e) {
    const path = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.path;
    const key = e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.key;
    if (!path) return;
    safeTrack('HOME_GO_TEST', { testKey: key || 'unknown' });
    wx.navigateTo({ url: path });
  },

  // 分享今日温度卡（带邀请码）
  onShareAppMessage() {
    const rights = wx.getStorageSync(USER_RIGHTS_KEY) || {};
    const inviteCode = rights.inviteCode || this.data.inviteCode || '';
    safeTrack('HOME_SHARE_APP_MESSAGE', { hasInviteCode: !!inviteCode });

    const st = (self && self.data && self.data.checkIn) || {};
    const rt = this.data.riskTemp;
    const title = (rt && rt.ready)
      ? `连续守纪 ${st.streak || 0} 天 · 今日风险温度 ${rt.score}，先看风险再交易`
      : `我已连续守纪 ${st.streak || 0} 天 · 熵盾帮你管住交易纪律`;
    const path = inviteCode
      ? `/pages/index/index?inviteCode=${encodeURIComponent(inviteCode)}`
      : '/pages/index/index';
    return { title, path };
  }
});

// ===== 邀请码逻辑（保留）=====
function ensureInviteCode() {
  const rights = wx.getStorageSync(USER_RIGHTS_KEY) || {};
  let inviteCode = rights.inviteCode;
  if (!inviteCode) {
    inviteCode = genInviteCode();
    rights.inviteCode = inviteCode;
    wx.setStorageSync(USER_RIGHTS_KEY, rights);
    console.log('[index] 新生成 inviteCode =', inviteCode);
  }
  return inviteCode;
}

function handleInviteFromOptions(options = {}) {
  const inviteCode = options.inviteCode || options.invite || '';
  if (!inviteCode) return;
  try {
    const rights = wx.getStorageSync(USER_RIGHTS_KEY) || {};
    if (rights.inviteCode && rights.inviteCode === inviteCode) {
      safeTrack('HOME_INVITE_SELF_OPEN');
      return;
    }
    if (!rights.invitedByCode) {
      rights.invitedByCode = inviteCode;
      rights.invitedAt = Date.now();
      wx.setStorageSync(USER_RIGHTS_KEY, rights);
      safeTrack('HOME_INVITE_BOUND', { hasInviteCode: true });
      wx.showToast({ title: '已记录邀请关系', icon: 'none', duration: 1500 });
    } else {
      safeTrack('HOME_INVITE_EXISTS');
    }
  } catch (e) {
    console.log('[index] 保存邀请关系失败', e);
  }
}

function genInviteCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    out += chars.charAt(idx);
  }
  return out;
}
