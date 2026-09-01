// utils/messages.js
// [V2.0-A 消息中心 Layer1] 本地可算提醒 + 全局红点
// 设计原则（已与用户确认「不猜」）：
//   1. 所有提醒完全由本地存储推导，不依赖后端；
//   2. 后端相关（监控池"哪个标的进了哪个结构"）属于 Layer2，本文件不实现；
//   3. "距止损百分比"需要行情源 B6，本地没有，故持仓提醒只做"未设止损"的诚实陈述。
// 微信 tabBar 红点接口：wx.showTabBarRedDot / wx.hideTabBarRedDot（消息 tab index = 3）。

const STORAGE = {
  read: 'entroMsgRead',       // 已读消息 id 列表
  history: 'entroMsgHistory', // 历史消息（用于"更早"分组与已读持久）
  lastMember: 'entroLastMemberLabel' // 上次会员等级文案（变更检测）
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getStorage(key, fallback) {
  try {
    const v = wx.getStorageSync(key);
    return (v === '' || v === undefined || v === null) ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function setStorage(key, val) {
  try { wx.setStorageSync(key, val); } catch (e) {}
}

// 读取本地上下文（与首页同源，但各自独立读存储，避免页面间耦合）
function readContext() {
  const today = todayStr();
  const lastDate = getStorage('checkinLastDate', '');

  let records = [];
  try {
    const r = wx.getStorageSync('tradeRecords');
    if (Array.isArray(r)) records = r;
  } catch (e) {}

  const rights = getStorage('userRights', {}) || {};
  const effective = (rights && rights.effectiveRights) || getStorage('effectiveRights', {}) || {};
  const membership = effective.membership || {};
  const memberLabel = String(membership.name || rights.membershipName || rights.currentMembershipName || '').trim();

  const temp = getStorage('riskTempSnapshot', null);

  return { today, lastDate, records, memberLabel, temp };
}

// 推导当前应出现的提醒（纯函数，不写存储）
function computeMessages() {
  const ctx = readContext();
  const today = ctx.today;
  const list = [];

  // 1) 今日未打卡（本地：checkinLastDate）
  if (ctx.lastDate !== today) {
    list.push({
      id: `checkin_${today}`,
      type: 'checkin',
      title: '今日还没打卡',
      snippet: '开盘前看一眼，规则就养成了',
      target: '/pages/index/index',
      tab: true,
      ts: Date.now()
    });
  }

  // 2) 持仓未设止损（本地：tradeRecords，仅陈述"未设"，不编百分比）
  const noStop = (ctx.records || []).filter(it => !(it.stopLossPrice || it.stopPrice)).length;
  if (noStop > 0) {
    list.push({
      id: `stoploss_${today}`,
      type: 'stoploss',
      title: `${noStop} 个持仓还没设止损`,
      snippet: '设好止损，风险才有边界',
      target: '/pkgReport/tradeRecord/index?from=message',
      tab: false,
      ts: Date.now()
    });
  }

  // 3) 会员等级变更（本地：与上次存储的文案比对）
  const lastMember = getStorage(STORAGE.lastMember, '');
  if (ctx.memberLabel && ctx.memberLabel !== '未开通会员') {
    if (lastMember && lastMember !== ctx.memberLabel) {
      list.push({
        id: `levelup_${today}_${ctx.memberLabel}`,
        type: 'level',
        title: '会员等级已更新',
        snippet: `当前等级：${ctx.memberLabel}`,
        target: '/pages/membership/index',
        tab: false,
        ts: Date.now()
      });
    }
    setStorage(STORAGE.lastMember, ctx.memberLabel);
  }

  // 4) 风险温度更新（仅当后端已返回且 updTime 含今日日期）
  if (ctx.temp && ctx.temp.ready) {
    const upd = String(ctx.temp.updTime || '');
    if (upd.indexOf(today) >= 0) {
      list.push({
        id: `temp_${today}`,
        type: 'temp',
        title: '今日市场风险温度已更新',
        snippet: `温度 ${ctx.temp.score} · ${ctx.temp.level}`,
        target: '/pages/index/index',
        tab: true,
        ts: Date.now()
      });
    }
  }

  return list;
}

// 合并已读状态 + 持久化历史（保留最近 50 条）
function getMessages() {
  const current = computeMessages();
  const readSet = new Set(getStorage(STORAGE.read, []));

  let history = getStorage(STORAGE.history, []);
  if (!Array.isArray(history)) history = [];

  const curIds = new Set(current.map(m => m.id));
  const older = history.filter(m => !curIds.has(m.id));
  const merged = current.concat(older).map(m => Object.assign({}, m, { read: readSet.has(m.id) }));
  merged.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  setStorage(STORAGE.history, merged.slice(0, 50));
  return merged;
}

function getUnreadCount() {
  return getMessages().filter(m => !m.read).length;
}

function markRead(id) {
  const read = getStorage(STORAGE.read, []);
  if (!Array.isArray(read)) return;
  if (read.indexOf(id) < 0) {
    read.push(id);
    setStorage(STORAGE.read, read);
  }
  let history = getStorage(STORAGE.history, []);
  if (Array.isArray(history)) {
    history = history.map(m => (m.id === id ? Object.assign({}, m, { read: true }) : m));
    setStorage(STORAGE.history, history);
  }
}

function markAllRead() {
  const all = getMessages();
  setStorage(STORAGE.read, all.map(m => m.id));
  setStorage(STORAGE.history, all.map(m => Object.assign({}, m, { read: true })));
}

// 刷新消息 tab 红点（index = 3，见 app.json tabBar 顺序）
function refreshBadge() {
  try {
    const n = getUnreadCount();
    if (n > 0) wx.showTabBarRedDot({ index: 3 });
    else wx.hideTabBarRedDot({ index: 3 });
  } catch (e) {}
}

module.exports = {
  getMessages,
  getUnreadCount,
  markRead,
  markAllRead,
  refreshBadge,
  computeMessages
};
