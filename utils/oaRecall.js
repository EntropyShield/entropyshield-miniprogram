// utils/oaRecall.js
// [V2.0-J3] 服务号订阅通知（Layer3 主召回通道）前端侧
// 边界说明（已核实 2026-08-31 微信官方能力）：
//   1) 小程序内无法直接触发「服务号订阅通知」的订阅授权，该授权发生在服务号侧（图文/网页组件）。
//   2) 真正下发是服务端调 sendNewSubscribeMsg（bizsend），前端不可直调。
//   因此本模块只负责：记录用户「已关注服务号」状态 + 订阅意向（哪些场景走 OA）+ 上报后端做 unionid→OA openid 映射。
//   后端据此在事件触发时经服务号下发（详见 31 号工单 ⑦-d / 36 号方案）。
const http = require('./http.js');
const clientId = require('./clientId.js');

// 🟡 待你提供：认证服务号 AppID（与小程序同主体/关联主体），以及 MP 后台选用的 3 个订阅通知模板 ID。
//    这些为占位符，未填时 isConfigured()=false，设置页会提示先配置，不阻塞用户操作。
const SERVICE_ACCOUNT = {
  appId: 'PLACEHOLDER_OA_APPID',
  name: '熵盾智能', // 🟡 待确认公众号对外名称
  // 订阅通知模板（MP 后台「订阅通知」选用/申请，场景说明 ≤15 字）
  templates: {
    stopLoss: 'PLACEHOLDER_TPL_STOPLOSS',     // 持仓止损预警
    gradeUpgrade: 'PLACEHOLDER_TPL_GRADE',     // 会员等级升级
    monitorSignal: 'PLACEHOLDER_TPL_SIGNAL'   // 监控池新信号
  }
};

const K_FOLLOW = 'entroOaFollowed';
const K_INTENT = 'entroOaIntent'; // 用户希望走服务号的场景集合

function isConfigured() {
  return SERVICE_ACCOUNT.appId && SERVICE_ACCOUNT.appId.indexOf('PLACEHOLDER') < 0;
}

function getFollowed() {
  try { return !!wx.getStorageSync(K_FOLLOW); } catch (e) { return false; }
}

function setFollowed(v) {
  try { wx.setStorageSync(K_FOLLOW, !!v); } catch (e) {}
  return !!v;
}

// 订阅意向：默认 3 个关键场景都希望走服务号
function getIntent() {
  try {
    const v = wx.getStorageSync(K_INTENT);
    if (Array.isArray(v)) return v;
  } catch (e) {}
  return ['stopLoss', 'gradeUpgrade', 'monitorSignal'];
}

function setIntent(arr) {
  const safe = Array.isArray(arr) ? arr : [];
  try { wx.setStorageSync(K_INTENT, safe); } catch (e) {}
  return safe;
}

// 上报「已关注 + 意向」给后端，用于 unionid→OA openid 映射（后端经开放平台绑定同一主体）。
// 后端未就绪时自动降级 pending，不阻塞用户。
async function reportFollow() {
  const payload = {
    channel: 'oa_subscribe',
    appId: SERVICE_ACCOUNT.appId,
    followed: getFollowed(),
    intent: getIntent()
  };
  if (typeof http === 'undefined' || !http.post) {
    return { ok: true, pending: true, message: '本地已记录，待后端联调' };
  }

  // 后端 /api/oa/follow 以 clientId 为主键落 oa_mapping，缺失会直接返回「缺少 clientId」
  // （http.post 不会自动注入，必须显式带上）
  try {
    payload.clientId = await clientId.ensureClientId();
  } catch (e) {
    return { ok: false, pending: true, message: '登录态获取失败，已本地记录' };
  }

  return http.post('/api/oa/follow', payload)
    .then(r => ({ ok: true, pending: false, data: r }))
    .catch(err => ({ ok: false, pending: true, message: (err && err.message) || '上报失败，已本地记录' }));
}

module.exports = {
  SERVICE_ACCOUNT,
  isConfigured,
  getFollowed, setFollowed,
  getIntent, setIntent,
  reportFollow
};
