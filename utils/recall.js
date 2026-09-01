// utils/recall.js
// [V2.0-J3] 外部强召回（短信/语音）前端契约（provider-agnostic）
//
// 职责（薄）：管理用户偏好 + 手机号绑定 + PIPL 单独同意。
// 实际下发由后端 /api/recall/* 完成（见 35 号方案 + 31 号工单 ⑦-c）。
//
// 本模块不感知任何供应商（腾讯云/阿里云/容联），供应商选择是后端的事。
// 关键合规：手机号属敏感个人信息，必须先取得「单独同意」(pipl_recall_phone) 才能上送。

const http = require('./http.js');
const consent = require('./consent.js');
const clientId = require('./clientId.js');

const KEY_PREF = 'entroRecallPref';

const DEFAULT_PREF = {
  sms: false,          // 外部：短信通道
  voice: false,        // 外部：语音播报通道
  consent: false,      // PIPL 单独同意（手机号用于风险提醒）
  phoneBound: false,   // 手机号是否已绑定（后端解密入库）
  phoneMask: '',       // 脱敏展示，如 138****8000
  status: 'init'       // init | pending(后端未就绪) | bound | unavailable
};

function getPref() {
  try {
    const v = wx.getStorageSync(KEY_PREF);
    return Object.assign({}, DEFAULT_PREF, v || {});
  } catch (e) {
    return Object.assign({}, DEFAULT_PREF);
  }
}

function setPref(patch) {
  const next = Object.assign({}, getPref(), patch);
  try { wx.setStorageSync(KEY_PREF, next); } catch (e) {}
  return next;
}

function hasConsent() {
  return consent.getConsent('recall_phone');
}

function grantConsent() {
  consent.setConsent('recall_phone');
}

// 至少开了一种外部通道 + 已同意 + 已绑手机 = 外部召回生效
function isActive() {
  const p = getPref();
  return (p.sms || p.voice) && p.consent && p.phoneBound;
}

function channelPrefFrom(p) {
  if (p.sms && p.voice) return 'both';
  if (p.voice) return 'voice';
  if (p.sms) return 'sms';
  return 'none';
}

function setChannels(patch) {
  return setPref({ sms: !!patch.sms, voice: !!patch.voice });
}

// 绑定手机号：将 getPhoneNumber 的加密结果上送后端解密
// detail 为 button open-type=getPhoneNumber 的 e.detail
//   新基础库返回 { code }（推荐路径），旧版返回 { encryptedData, iv }
// 二者都带上去，后端按需取用；前端不解密、不落明文。
async function bindPhone(detail) {
  if (!detail) return { ok: false, message: '缺少手机号授权结果' };
  if (!hasConsent()) {
    return { ok: false, message: '请先勾选同意将手机号用于风险提醒' };
  }

  let cid;
  try {
    cid = await clientId.ensureClientId();
  } catch (e) {
    return { ok: false, message: '登录态获取失败：' + e.message };
  }

  const payload = {
    clientId: cid,
    channelPref: channelPrefFrom(getPref()),
    piplConsent: true,
    code: detail.code || '',
    encryptedData: detail.encryptedData || '',
    iv: detail.iv || ''
  };

  try {
    const res = await http.post('/api/recall/bind', payload);
    const data = (res && res.data) || {};
    if (res && res.statusCode === 200 && data.ok) {
      const next = setPref({ phoneBound: true, phoneMask: data.phoneMask || '', status: 'bound' });
      return { ok: true, phoneMask: next.phoneMask };
    }
    // 后端未就绪（404/502 等）或接口未实现：降级为 pending，保留本地偏好，不阻塞用户
    if (res && (res.statusCode === 404 || res.statusCode === 502)) {
      setPref({ phoneBound: true, status: 'pending' });
      return { ok: true, pending: true, message: '已记录，等待后端 /api/recall/bind 联调' };
    }
    return { ok: false, message: data.message || ('绑定失败(' + (res && res.statusCode) + ')') };
  } catch (e) {
    // 网络层失败同样降级为 pending（后端就绪后会因登录态续传）
    setPref({ phoneBound: true, status: 'pending' });
    return { ok: true, pending: true, message: '网络异常，已记录，等待后端联调' };
  }
}

// 撤回「手机号单独同意」（PIPL 第 15 条：撤回后应及时删除或匿名化）
//
// 【9/2 Bug4 修复背景 —— 原先是三层断裂，逐条对应下面的 ①②③】
//   ① 本地真实同意位没清：utils/consent.js 只有 setConsent 没有 revoke，
//      设置页取消勾选只改了 pref 展示位，hasConsent() 依旧返回 true。
//   ② 服务器数据没清：前端从不调 /api/recall/consent/revoke，
//      后端 users 里的 recallPhoneMasked / piplConsentToken 原封不动。
//   ③ 后端护栏（src/routes/recall.js:195）判断的正是 ② 那两个字段，
//      于是「用户已点撤回，服务器仍认为他同意，照发短信/语音」——合规红线。
//
// 设计取舍：
//   - 顺序上先落本地再上报服务器。网络失败时停在「已撤回」这一侧，
//     宁可漏发也不可错发（合规优先于一致性）。
//   - 撤回是否连带加入退订名单由 REVOKE_ALSO_UNSUBSCRIBE 控制：
//     true = 撤回即彻底不再触达（默认，更安全）；false = 仅删除数据，保留召回资格。
//
// 返回 { ok, pending, pref } —— pending=true 表示本地已撤回、服务器待同步。
const REVOKE_ALSO_UNSUBSCRIBE = true;

async function revokeConsent() {
  // ① 本地：真实同意位 + 偏好（同步落，离线也立即生效）
  consent.revokeConsent('recall_phone');
  let next = setPref({
    consent: false, sms: false, voice: false,
    phoneBound: false, phoneMask: '', status: 'init'
  });

  // ②③ 服务器：删除手机号/令牌 + 入退订名单（best-effort，失败不回滚本地）
  let cid = '';
  try {
    cid = await clientId.ensureClientId();
  } catch (e) {
    cid = '';
  }
  if (!cid) {
    return { ok: true, pending: true, pref: next, message: '本地已撤回，待登录后同步服务器' };
  }

  try {
    await http.post('/api/recall/consent/revoke', { clientId: cid });
    if (REVOKE_ALSO_UNSUBSCRIBE) {
      await http.post('/api/recall/unsubscribe', { clientId: cid });
    }
    return { ok: true, pref: next };
  } catch (e) {
    // 网络失败：本地撤回已生效，仅标记待同步
    next = setPref({ status: 'pending' });
    return { ok: true, pending: true, pref: next, message: '本地已撤回，服务器同步待重试' };
  }
}

// 仅清空本地绑定态（不含撤回同意、不同步服务器）
// 【已不推荐直接调用】需要撤回/解绑请改用 revokeConsent()，否则服务器数据不会清。
function unbind() {
  return setPref({ phoneBound: false, phoneMask: '', status: 'init' });
}

module.exports = {
  getPref,
  setPref,
  hasConsent,
  grantConsent,
  revokeConsent,
  isActive,
  bindPhone,
  setChannels,
  unbind,
  channelPrefFrom,
  REVOKE_ALSO_UNSUBSCRIBE
};
