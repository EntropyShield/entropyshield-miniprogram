// utils/subscribeTemplates.js
// 订阅消息模板配置 · 一次性订阅
//
// 【两类来源并存】
// - 公共模板库现成模板：直接用「我的模板」拿到的 ID（如 order_paid_success）
// - 自定义场景：原计划走「帮忙我们完善模板库」申请自定义模板
//   （daily_temperature / evening_checkin / position_alert / watchlist_signal / grade_upgrade）
//   当前未申请，字段空——保留场景定义便于将来补。
//
// 【字段映射铁律（9/7 落库）】
// 公共模板的真实字段编号由 MP 后台决定，写代码时只能按「我的模板 → 详情」显示的占位符填：
//   thing1.DATA / time2.DATA / amount3.DATA / character_string5.DATA ...
// buildPayload() 只负责拼 template_id + 透传 data，调用方（后端）按真实编号填 data。
//
// 【流程】
// 1. 在 MP 后台「订阅消息 → 公共模板库」选用 → 拿到 template_id → 填进 TEMPLATE_ID
// 2. 前端 sub.request() 在用户意愿最高点（支付成功）调起授权
// 3. 后端拿用户 openid + template_id + data 调微信 subscribeMessage.send 下发
// 4. 用户授权状态由 reportGranted() 上报到后端 recalled subscribedTemplates 白名单

const SCENES = {
  daily_temperature: {
    name: '今日风险温度',
    desc: '订阅后每个交易日早间推送当日市场风险温度分值与提示',
    fields: { 温度分值: 'thing', 风险陈述: 'thing' },
    prompt: '开启每日风险温度提醒'
  },
  evening_checkin: {
    name: '晚间打卡提醒',
    desc: '订阅后当日尚未完成风控打卡时的晚间提醒',
    fields: { 连续天数: 'thing', 升级提示: 'thing' },
    prompt: '开启晚间打卡提醒'
  },
  position_alert: {
    name: '持仓止损预警',
    desc: '订阅后持仓距止损边界的触发式预警',
    fields: { 持仓标的: 'thing', 距止损百分比: 'thing' },
    prompt: '开启持仓止损预警'
  },
  watchlist_signal: {
    name: '监控池新信号',
    desc: '订阅后监控池新标的进入结构区间的提醒',
    fields: { 标的代码: 'thing', 结构区间: 'thing' },
    prompt: '开启监控信号提醒'
  },
  grade_upgrade: {
    name: '风控等级升级',
    desc: '订阅后风控等级提升的通知',
    fields: { 新等级名: 'thing', 解锁权益: 'thing' },
    prompt: '开启等级升级通知'
  }
};

const http = require('./http.js');
const clientId = require('./clientId.js');

/**
 * 上报授权结果到后端（best-effort：任何失败一律静默，绝不阻断打卡/支付主流程）
 *
 * 【为什么必须有这一步 · 9/1 排查结论】
 * 后端 entropy-api src/routes/recall.js:74 的 subscribedTemplates 字段，
 * 唯一写入者就是本上报；而 recall.js:206 下发前用该字段做白名单校验：
 *     allowed.indexOf(tplId) === -1 → TEMPLATE_NOT_AUTHORIZED
 * 前端原先只在本地调起 wx.requestSubscribeMessage 后把结果丢弃，
 * 导致后端永远不知道谁授权了哪个模板 → 订阅消息主通道 100% 不通（空跑）。
 *
 * 后端契约（src/routes/recall.js:63）：
 *   POST /api/recall/subscribe  body: { clientId, granted: { <模板ID>: 'accept'|'reject' } }
 */
function reportGranted(granted) {
  try {
    return clientId.ensureClientId()
      .then((cid) => {
        if (!cid) return null;
        return http.post('/api/recall/subscribe', { clientId: cid, granted: granted || {} });
      })
      .then((res) => {
        // http.post resolve 的是完整 res，业务体在 res.data
        const body = res && res.data;
        const ok = !!(body && body.ok);
        if (!ok) console.warn('[subscribe] 授权状态上报失败（已忽略，不阻断主流程）', body);
        return ok;
      })
      .catch((err) => {
        console.warn('[subscribe] 授权状态上报异常（已忽略，不阻断主流程）', err);
        return false;
      });
  } catch (e) {
    return Promise.resolve(false);
  }
}

module.exports = {
  TEMPLATE_ID: {
    order_paid_success: 'Kmn7KwzQUq_sIwn7TUsnJmpl_Ofvk5MqcZz2xvKwpnU', // 场景0 · 订单支付成功通知（9/7 落库）
    daily_temperature: '',  // 场景1 · 今日风险温度 9:15
    evening_checkin: '',    // 场景2 · 收盘复盘/晚间打卡提醒
    position_alert: '',     // 场景3 · 持仓止损预警
    watchlist_signal: '',   // 场景4 · 监控池新信号
    grade_upgrade: ''       // 场景5 · 风控等级升级
  },

  SCENES,

  // 取已配置模板 ID（未填则跳过，避免调起空授权 / 微信报错）
  getTmplIds(scenes) {
    const keys = scenes || Object.keys(this.TEMPLATE_ID);
    return keys.map(k => this.TEMPLATE_ID[k]).filter(Boolean);
  },

  // 调起授权（前端，用户意愿最高点调用，如打卡成功回调）
  // 入参：场景 key（单/数组）；返回 Promise<res>
  request(sceneKeys) {
    const tmplIds = this.getTmplIds(sceneKeys);
    if (!tmplIds.length) {
      console.warn('[subscribe] 未配置模板 ID，跳过授权（见 34 号手册申请自定义模板）');
      return Promise.resolve({});
    }
    return new Promise(resolve => {
      wx.requestSubscribeMessage({
        tmplIds,
        success: res => {
          resolve(res);
          // 只挑本次申请的模板，剔除 errMsg 等非模板键，避免污染后端白名单
          const granted = {};
          tmplIds.forEach((id) => {
            if (res && res[id]) granted[id] = res[id];
          });
          reportGranted(granted);
        },
        fail: err => {
          console.warn('[subscribe] 用户拒收或系统异常', err);
          resolve({});
        }
      });
    });
  },

  // 后端下发载荷构造（后端调微信 subscribeMessage.send 时按此填 data）
  // 入参：场景 key + 已按「我的模板」真实字段编号组织的 data
  // 返回 { template_id, data } 交给后端 POST 微信
  buildPayload(sceneKey, data) {
    const templateId = this.TEMPLATE_ID[sceneKey];
    if (!templateId) throw new Error(`[subscribe] 模板未配置: ${sceneKey}`);
    if (!this.SCENES[sceneKey]) throw new Error(`[subscribe] 场景缺失: ${sceneKey}`);
    return { template_id: templateId, data };
  },

  // 导出便于设置页/脚本单独触发一次上报（如用户换机后重新同步）
  reportGranted
};
