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
const activityApi = require('../../utils/activityApi.js'); // [2026-09-11] 首页活动 Banner 数据源
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
      // [2026-09-09] 数据归属：标题/时间戳/上一交易日对比（避免把昨日收盘当成今日）
      titleText: '今日市场风险温度',
      stampText: '开盘前更新中',
      prevText: '',
      color: 'var(--es-amber, #FFB020)',
      ringDash: 0
    },
    // [2026-09-09] 每日温度提醒（服务号模板消息，默认关闭，需用户主动开启）
    oaPush: { loaded: false, enabled: false, followed: false, hasOaOpenid: false, busy: false, tip: '' },

    // [2026-09-09] 温度分享卡入参（Canvas 组件 components/shareCard）
    tempCard: {
      visible: false,
      value: 0,
      tag: '',
      title: '今日市场风险温度',
      desc: '',
      qrcodeUrl: '',
      accent: '#FFB020'
    },

    // B3 每日打卡
    checkIn: { streak: 0, todayDone: false },

    // B4 持仓诊断（纯数据陈述；"距止损边界%"需行情源 B6 补全）
    holdings: [],
    holdingsTotal: 0,
    holdingsHint: '你还没有录入持仓记录',

    monitorCount: 0,

    // 每日箴言
    dailyQuote: DAILY_QUOTES[new Date().getDate() % DAILY_QUOTES.length],

    // C1/C3 测试入口
    riskTests: RISK_TESTS,

    // ③ 活动入口 Banner：来自 /api/activity/config（enabled 的活动才展示）
    activities: []
  },

  onLoad(options) {
    const opts = options || {};
    console.log('[index] onLoad options:', opts);

    safeTrack('HOME_VIEW', { hasInviteParam: !!(opts.inviteCode || opts.invite) });

    const myInvite = ensureInviteCode();
    this.setData({ inviteCode: myInvite });

    this.refreshHomeSnapshot();
    handleInviteFromOptions(opts);
    // [2026-09-09 修正] 去掉此处的 loadDashboard：onLoad 后必然触发 onShow，
    //   两处都调会导致首屏对 /api/daily/digest 发两次重复请求。统一由 onShow 加载。
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
    // [2026-09-09 修正] 打卡权威态与监控池数量已并入 loadRiskDigest（同一接口 /api/daily/digest），
    //   此前 loadCheckIn→pullCheckInFromServer 与 loadRiskDigest 会对同一接口发 2 次请求。
    this.loadCheckIn(); // 本地先渲染，网络回来后被权威值覆盖
    this.loadRiskDigest().catch(() => {});
    this.loadHoldings();
    this.loadOaPushStatus().catch(() => {});
    this.loadActivityConfig(); // [2026-09-11] 活动 Banner：此前从未调用，首页活动区恒为空
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

        // [2026-09-09] 同一响应里的打卡权威态与监控池数量一并消费（原为独立请求）
        self.applyCheckInFromDigest(d.checkin);
        const mc = Number(d.monitorCount);
        if (Number.isFinite(mc)) self.setData({ monitorCount: mc });

        const score = Number(d.marketRiskScore != null ? d.marketRiskScore : d.riskScore);
        if (!Number.isFinite(score)) {
          self.setData({ riskTemp: self.buildTemp(false, 0, '开盘前更新中', '数据生成后这里会显示今日市场风险温度。', '') });
          return;
        }
        self.setData({
          riskTemp: self.buildTemp(
            true,
            score,
            // 后端 2026-09-09 起由温度引擎返回：riskVerdict(陈述文案) / riskLevel(五档) / updTime
            d.riskVerdict || '今日温度已更新',
            self.buildFundSub(d),
            d.updTime || '',
            d.riskLevel || '',
            self.buildTempMeta(d)
          )
        });
        messages.refreshBadge();
      },
      fail() {
        self.setData({ riskTemp: self.buildTemp(false, 0, '开盘前更新中', '数据生成后这里会显示今日市场风险温度。', '') });
        messages.refreshBadge();
      }
    });
  },

  // [2026-09-09] 温度归属元信息
  //   背景：盘前（原 8:50 定时任务）拉到的是上一交易日收盘快照，用户看到的是历史值却以为是今天。
  //   现后端把「今日实时」与「上一交易日收盘」分开返回（tempIsLive / tempDate / prevCloseTemp），
  //   前端必须在标题和时间戳上写明归属，禁止把收盘值伪装成实时值。
  buildTempMeta(d) {
    const live = !!d.tempIsLive;
    const date = d.tempDate || '';
    const mmdd = date.length >= 10 ? date.slice(5).replace('-', '/') : '';
    const time = d.updTime || '';
    const stampText = live
      ? (mmdd ? mmdd + ' ' + time + ' 实时' : (time ? time + ' 实时' : '实时'))
      : (mmdd ? mmdd + ' ' + (time || '15:00') + ' 收盘' : '上一交易日收盘');
    const titleText = live
      ? '今日市场风险温度'
      : (mmdd ? mmdd + ' 收盘市场风险温度' : '上一交易日收盘温度');
    // 只有在显示今日实时值时，才额外给出上一交易日收盘做对比
    let prevText = '';
    if (live && d.prevCloseTemp != null) {
      const pd = d.prevCloseDate && d.prevCloseDate.length >= 10
        ? d.prevCloseDate.slice(5).replace('-', '/') : '上一交易日';
      prevText = pd + ' 收盘 ' + Number(d.prevCloseTemp) + '°' +
        (d.prevCloseLevel ? ' · ' + d.prevCloseLevel : '');
    }
    return { stampText, titleText, prevText };
  },

  buildTemp(ready, score, verdict, verdictSub, updTime, level, meta) {
    const s = Math.max(0, Math.min(100, Number(score) || 0));
    const obj = {
      ready,
      score: s,
      // [2026-09-09 修正] 未就绪时 level 应为占位 '—'：此前恒定返回「偏低·平稳」，
      //   导致分数显示 '--' 却判定为"偏低"，语义自相矛盾。
      // level 为后端五档（低/中/偏高…），优先于本地算法口径。
      level: ready ? (level || tempLevel(s)) : '—',
      verdict: verdict || (ready ? '今日温度已更新' : '开盘前更新中'),
      verdictSub: verdictSub || '',
      updTime: updTime || '',
      color: tempColor(s),
      ringDash: Math.round(289 * s / 100),
      titleText: (meta && meta.titleText) || (ready ? '今日市场风险温度' : '今日市场风险温度'),
      stampText: (meta && meta.stampText) ||
        (updTime ? updTime + ' 更新' : (ready ? '今日温度已更新' : '开盘前更新中')),
      prevText: (meta && meta.prevText) || ''
    };
    // [V2.0-A] 持久化温度快照，供消息中心生成本地"温度更新"提醒（不依赖额外后端调用）
    try { wx.setStorageSync('riskTempSnapshot', { ready: obj.ready, score: obj.score, level: obj.level, updTime: obj.updTime }); } catch (e) {}
    return obj;
  },

  // [2026-09-09] 温度副标题：优先展示资金类实时数据（涨停家数 / 主力净额）
  //   ★ 合规红线：免费源只能拿到「超大单」，无法区分游资/机构/量化，
  //     故对外一律称「主力资金」，禁止出现"游资"字样（虚假宣传 + 合规风险）
  buildFundSub(d) {
    const parts = [];
    if (d.limitUp != null) parts.push('涨停 ' + Number(d.limitUp) + ' 家');
    if (d.limitDown != null && Number(d.limitDown) > 0) parts.push('跌停 ' + Number(d.limitDown) + ' 家');
    if (d.netInflowYi != null) {
      const v = Number(d.netInflowYi);
      const abs = Math.abs(v).toFixed(2).replace(/\.00$/, '');
      parts.push((v >= 0 ? '主力净流入 ' : '主力净流出 ') + abs + ' 亿');
    }
    return parts.length ? parts.join(' · ') : '涨跌幅 · 振幅 · 量能 · 资金流 多维测算';
  },

  // ====== [2026-09-09] 温度分享卡：生成 → 预览 → 保存相册 ======
  // 复用主包 components/shareCard（Canvas 2D），小程序码走 /api/fission/qrcode。
  // 卡片只承载「市场状态陈述」，不含任何买卖建议（12 号合规报告红线）。
  onMakeTempCard() {
    const t = this.data.riskTemp || {};
    if (!t.ready) {
      wx.showToast({ title: '今日温度还没生成', icon: 'none' });
      return;
    }
    const desc = [t.stampText, t.verdictSub, t.prevText].filter(Boolean).join(' · ');
    this.setData({
      tempCard: {
        visible: true,
        value: t.score,
        tag: t.level || '',
        title: t.titleText || '今日市场风险温度',
        desc: desc,
        qrcodeUrl: this._buildTempCardQrUrl(),
        accent: this._tempAccentHex(t.score)
      }
    });
    safeTrack('HOME_TEMP_CARD_OPEN', { score: t.score, level: t.level || '' });
  },

  onTempCardClose() {
    this.setData({ 'tempCard.visible': false });
  },

  onTempCardSaved() {
    safeTrack('HOME_TEMP_CARD_SAVE', { score: (this.data.riskTemp || {}).score });
  },

  onTempCardError(e) {
    safeTrack('HOME_TEMP_CARD_FAIL', { reason: (e && e.detail && e.detail.err) || '' });
  },

  // Canvas 不认 var()，必须给十六进制；阈值与 tempColor() 保持一致（70 / 40）
  _tempAccentHex(score) {
    const s = Number(score) || 0;
    if (s >= 70) return '#FF4D5E';
    if (s >= 40) return '#FFB020';
    return '#00E5A0';
  },

  // 小程序码：复用既有 /api/fission/qrcode（不另造轮子）。
  // 官方规则（已核 wxacode.getUnlimited 文档）：
  //   · page 不能带参数，参数一律走 scene（后端已把 inviteCode 放进 scene）
  //   · page 根路径前不加 / ；后端正则只接受 pages/ 开头，分包路径会被拒并回落默认页
  //   · check_path=false，故体验版也能出码
  _buildTempCardQrUrl() {
    const base = String((CONFIG && CONFIG.API_BASE) || '').replace(/\/+$/, '');
    if (!base) return '';
    let code = String(this.data.inviteCode || '').trim();
    if (!code) {
      try {
        const rights = wx.getStorageSync(USER_RIGHTS_KEY) || {};
        code = String(rights.inviteCode || '').trim();
      } catch (e) {}
    }
    if (!code) return ''; // 无邀请码 → 卡片画占位框，不阻塞出图
    let env = 'release';
    try {
      const ai = wx.getAccountInfoSync && wx.getAccountInfoSync();
      env = (ai && ai.miniProgram && ai.miniProgram.envVersion) || 'release';
    } catch (e) {}
    return base +
      '/api/fission/qrcode?inviteCode=' + encodeURIComponent(code) +
      '&env_version=' + encodeURIComponent(env) +
      '&page=' + encodeURIComponent('pages/index/index') +
      '&t=' + Date.now();
  },

  // ====== [2026-09-09] 每日温度提醒（服务号模板消息）======
  // 合规口径（54 号施工图）：模板消息只能用于「重要服务通知」，日更温度有被判营销的风险
  // → 默认关闭，必须用户主动开启；且只有已关注服务号的用户才收得到。
  async loadOaPushStatus() {
    const base = (CONFIG && CONFIG.API_BASE) ? CONFIG.API_BASE : '';
    if (!base) return;
    const cid = await safeClientId();
    if (!cid) return;
    const self = this;
    wx.request({
      url: base + '/api/oa/push-status?clientId=' + encodeURIComponent(cid),
      method: 'GET',
      timeout: 6000,
      success(res) {
        const r = (res && res.data) || {};
        if (!r.ok) return;
        self.setData({
          oaPush: {
            loaded: true,
            enabled: !!r.pushEnabled,
            followed: !!r.followed,
            hasOaOpenid: !!r.hasOaOpenid,
            busy: false,
            tip: self._oaPushTip(!!r.pushEnabled, !!r.followed)
          }
        });
      }
    });
  },

  _oaPushTip(enabled, followed) {
    if (enabled && followed) return '已开启 · 每交易日 9:15 推送';
    if (enabled) return '已开启 · 还需关注服务号才能收到';
    return '开启后每交易日 9:15 推送今日温度';
  },

  async onOaPushChange(e) {
    const enabled = !!(e && e.detail && e.detail.value);
    const base = (CONFIG && CONFIG.API_BASE) ? CONFIG.API_BASE : '';
    const prev = this.data.oaPush || {};
    this.setData({ oaPush: Object.assign({}, prev, { enabled, busy: true }) });

    if (!base) { this.setData({ 'oaPush.busy': false }); return; }
    const cid = await safeClientId();
    if (!cid) {
      this.setData({ 'oaPush.busy': false, 'oaPush.enabled': false });
      wx.showToast({ title: '登录信息未就绪', icon: 'none' });
      return;
    }

    const self = this;
    wx.request({
      url: base + '/api/oa/push-toggle',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { clientId: cid, enabled },
      timeout: 6000,
      success(res) {
        const r = (res && res.data) || {};
        const followed = !!r.followed;
        if (!r.ok) {
          self.setData({ 'oaPush.enabled': !enabled });
          wx.showToast({ title: '设置失败，请重试', icon: 'none' });
          return;
        }
        self.setData({
          'oaPush.followed': followed,
          'oaPush.tip': self._oaPushTip(enabled, followed)
        });
        if (enabled && !followed) {
          // [2026-09-09] 未关联服务号身份 → 走网页授权静默绑定（不依赖开放平台/unionid）
          // 用户在 web-view 内静默授权拿到服务号 openid 后自动返回，无需任何操作
          try {
            wx.navigateTo({
              url: '/pages/oaBind/index?url=' + encodeURIComponent(
                base + '/api/oa/link?c=' + encodeURIComponent(cid))
            });
          } catch (err) {
            wx.showToast({ title: '请再点「去关注服务号」', icon: 'none' });
          }
        }
      },
      fail() {
        self.setData({ 'oaPush.enabled': !enabled });
        wx.showToast({ title: '网络异常', icon: 'none' });
      },
      complete() { self.setData({ 'oaPush.busy': false }); }
    });
    safeTrack('HOME_OA_PUSH_TOGGLE', { enabled });
  },

  // 小程序内无法直接跳关注页：有二维码就预览长按识别，没有就给文字引导（不报错）
  goFollowOa() {
    safeTrack('HOME_OA_FOLLOW_CLICK', { hasQr: !!CONFIG.OA_QR_URL });
    const fallback = () => {
      wx.showModal({
        title: '关注服务号',
        content: '请在微信搜索服务号「' + (CONFIG.OA_NAME || '熵盾') + '」并关注，即可收到每日温度提醒。',
        showCancel: false
      });
    };
    if (!CONFIG.OA_QR_URL) return fallback();
    wx.previewImage({
      urls: [CONFIG.OA_QR_URL],
      current: CONFIG.OA_QR_URL,
      // 后端还没生成 ticket 时这里是 404，不能让用户点了个寂寞
      fail: fallback
    });
  },

  // B3 每日打卡：本地先渲染（不阻塞），再用后端权威数据回填
  // [V2.0-接线] 本地 Storage 可篡改、不跨设备；后端 /api/daily/digest 才是权威源。
  //   TODO(B3): 连续 3/7/21 天奖励 —— 规则未定义，后端只标记不发权益，此处同样不做任何发放动作。
  loadCheckIn() {
    const streak = Number(wx.getStorageSync('checkinStreak') || 0) || 0;
    const last = wx.getStorageSync('checkinLastDate') || '';
    const today = todayStr();
    this.setData({ checkIn: { streak, todayDone: last === today } });
  },

  // [2026-09-09] 用 /api/daily/digest 同一响应里的 checkin 覆盖本地（跨设备一致、防本地篡改）
  //   取代原 pullCheckInFromServer：不再为此单独发一次网络请求。
  applyCheckInFromDigest(ci) {
    if (!ci) return; // 后端无此用户记录 → 保留本地值
    const s = Number(ci.streak) || 0;
    this.setData({ checkIn: { streak: s, todayDone: !!ci.today } });
    // 回写本地，使下次冷启动更快、离线时也有值
    try {
      wx.setStorageSync('checkinStreak', s);
      if (ci.today) wx.setStorageSync('checkinLastDate', todayStr());
    } catch (e) {}
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
    // [2026-09-10] 连续 3/7/21 天奖励由服务端在 /api/daily/checkin 发放（freeCalcTimes），
    // 客户端在 pushCheckInToServer 成功回调里同步本地缓存并刷新展示；本地离线态无 clientId 时不发。
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
        // [2026-09-10] 连续 3/7/21 天里程碑：后端已赠送高级测算次数，
        // 本地同步两份权益缓存并刷新展示，弹窗告知用户。
        if (r.rewardMilestone) {
          const ADD = { 3: 1, 7: 3, 21: 7 };
          const add = ADD[r.rewardMilestone] || 0;
          if (add > 0) {
            try {
              const rights = wx.getStorageSync(USER_RIGHTS_KEY) || {};
              rights.freeCalcTimes = (Number(rights.freeCalcTimes) || 0) + add;
              wx.setStorageSync(USER_RIGHTS_KEY, rights);
              const eff = wx.getStorageSync('effectiveRights') || {};
              if (eff.task) {
                eff.task.freeCalcTimes = (Number(eff.task.freeCalcTimes) || 0) + add;
                wx.setStorageSync('effectiveRights', eff);
              }
            } catch (e) {}
            self.refreshHomeSnapshot();
            wx.showToast({ title: `连续${r.rewardMilestone}天，赠送${add}次测算`, icon: 'none' });
          }
        }
        safeTrack('HOME_CHECKIN_SYNCED', {
          streak: Number.isFinite(s) ? s : localStreak,
          duplicated: !!r.duplicated,
          milestone: r.rewardMilestone || null,
          granted: r.rewardGranted || 0
        });
      }
      // fail 静默：离线也能打卡，下次进首页 loadRiskDigest 会用权威值补齐
    });
  },

  // B4 持仓诊断：best-effort 读本地记录，纯数据陈述
  loadHoldings() {
    let list = [];
    let total = 0;
    try {
      const recs = wx.getStorageSync('tradeRecords');
      if (Array.isArray(recs) && recs.length) {
        total = recs.length;
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
      // [2026-09-09] holdings 最多只放 5 条(展示用)，总数单独给四宫格，
      //   否则格子里的 "N 需关注" 恒等于展示条数，与实际持仓数不符。
      holdingsTotal: total,
      holdingsHint: list.length ? '' : '你还没有录入持仓记录'
    });
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

  // ③ 活动入口 Banner：读 /api/activity/list（activity_config 表），只展示 live 分组
  //   运营在 DB 加一条记录即可上下线首页活动，无需重新发版
  //   [2026-09-11 修复] 旧实现读已废弃的 /api/activity/config，且本函数从未被调用 → 首页活动区恒为空
  loadActivityConfig() {
    activityApi.getList().then((g) => {
      const live = (g && g.live) || [];
      const arr = live
        .filter((a) => a && a.key)
        .map((a) => ({
          key: a.key,
          tag: a.typeLabel || '活动',
          title: a.title || '风控活动',
          sub: a.sub || '',
          rewardText: a.rewardText || '',
          // 后端 action_path 优先；缺失时兜底到通用活动页
          path: a.path || ('/pkgService/activity/index?key=' + encodeURIComponent(a.key))
        }));
      this.setData({ activities: arr });
    }).catch(() => { this.setData({ activities: [] }); });
  },

  goActivity(e) {
    const ds = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const path = ds.path;
    const key = ds.key;
    if (!path) return;
    safeTrack('HOME_GO_ACTIVITY', { activity: key || 'unknown' });
    wx.navigateTo({ url: path, fail: (err) => console.error('[index] navigateTo activity fail:', err) });
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


  // [2026-09-09] 学院入口（首页补）：此前全库仅风控工作台可进入，72 课无首页可达路径
  goAcademy(e) {
    const source = getTapSource(e, 'unknown');
    safeTrack(stepWithSource('HOME_CTA_GO_ACADEMY', source), { source });
    wx.navigateTo({
      url: '/pkgAcademy/pages/index?from=home',
      fail: (err) => console.error('[index] navigateTo 学院 fail:', err)
    });
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
    // [2026-09-09] 页面内有两个分享按钮，此前共用同一份文案；
    //   按 data-share 区分：temp=今日温度卡 / streak=我的战绩 / 其余=右上角转发
    const kind = (res && res.target && res.target.dataset && res.target.dataset.share) || '';
    safeTrack('HOME_SHARE_APP_MESSAGE', { hasInviteCode: !!inviteCode, kind: kind || 'menu' });

    // [2026-09-09 修正] 原为 `self && self.data` —— self 在此作用域未定义，
    //   严格模式下会抛 ReferenceError 导致分享面板拉不起来。
    const st = this.data.checkIn || {};
    const rt = this.data.riskTemp || {};
    const streak = st.streak || 0;

    let title;
    if (kind === 'temp') {
      title = rt.ready
        ? `今日风险温度 ${rt.score}（${rt.level}）· 先看风险，再谈交易`
        : '熵盾每日风险温度 · 先看风险，再谈交易';
    } else if (kind === 'streak') {
      title = `我已连续守纪 ${streak} 天 · 熵盾帮我管住交易纪律`;
    } else if (rt.ready) {
      title = `连续守纪 ${streak} 天 · 今日风险温度 ${rt.score}（${rt.level}）`;
    } else {
      title = `我已连续守纪 ${streak} 天 · 熵盾帮我管住交易纪律`;
    }

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
  let inviteCode = options.inviteCode || options.invite || '';
  // [2026-09-09 补] 小程序码（wxacode.getUnlimited）的参数不落在 inviteCode 上：
  //   官方规则是「page 不能带参数，参数走 scene」，后端 /api/fission/qrcode 也确实把
  //   邀请码塞进了 scene。此前只读 inviteCode → 扫码进来的邀请关系全部丢失，裂变归因失效。
  //   scene 由微信原样回传，需 decodeURIComponent 还原。
  if (!inviteCode && options.scene) {
    try { inviteCode = decodeURIComponent(String(options.scene)); }
    catch (e) { inviteCode = String(options.scene); }
  }
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
