// utils/share.js
// [V2.0-C2] 统一分享工具：让每一次分享都带上邀请码，且文案合规
//
// 背景（10 号代码体检）：resultCommon 结果页连 onShareAppMessage 都没写，
// 分享标题是兜底的"熵盾研究院"——不带分数、不带邀请码。**裂变链断在最后一厘米。**
//
// 设计原则：
// 1. 分享落地页 = 测试入口页（而非结果页）—— 新用户点开后是"自己测"，不是"看别人的结果"，
//    这才是能循环的裂变路径；邀请码交给 app.js 既有的 pendingInviteCode 机制自动绑定。
// 2. 文案只做数据陈述，不出现投资咨询类措辞（12 号合规报告红线）。
// 3. 邀请码同步读缓存、异步刷新 —— onShareAppMessage 必须同步返回，绝不能等网络。

const CONFIG = require('../config.js');

const INVITE_CACHE_KEY = 'myInviteCode';

// 测试类型 → 测试入口页
const TEST_PAGES = {
  loss: '/pkgTest/testLossPersonality/index',
  market: '/pkgTest/testMarketRisk/index',
  danger: '/pkgTest/testDangerLevel/index',
  emotion: '/pkgTest/testEmotionIndex/index',
  ability: '/pkgTest/testRiskScore/index',
  score: '/pkgTest/testRiskScore/index',
  camp: '/pkgChallenge/campIntro/index'
};

// 空壳拦截名单（兜底保护）
// 背景：2026-09-01 核查时发现 testLossPersonality / testRiskScore 在 pages/ 下是空壳
// （只有空的生命周期函数，无题目无计分无跳转），而其完整实现一直躺在 dev_pages/ 里从未注册。
// 已于同日把 dev_pages 完整版迁移至 pages/，两页均已可用，故本表清空。
// 保留机制：后续若某页面在开发期被清空，加入本表即可自动回退首页，避免用户点开空白页。
const SHELL_PAGES = [];
const FALLBACK_PAGE = '/pages/index/index';

// 测试类型 → 分享文案（数据陈述，不含任何诱导或承诺）
const SHARE_COPY = {
  loss: function (s) { return '我的亏损人格，测出来是「' + s.tag + '」'; },
  market: function (s) { return '我测了市场风险感知，得分 ' + s.score + ' 分'; },
  danger: function (s) { return '我的交易危险等级：' + s.tag; },
  emotion: function (s) { return '我的交易情绪指数 ' + s.score + ' 分'; },
  ability: function (s) { return '我的风控能力评分 ' + s.score + ' 分'; },
  score: function (s) { return '我的风控能力评分 ' + s.score + ' 分'; },
  camp: function (s) { return '熵盾 7 天训练营 · 我的战报出来了'; }
};

/**
 * 同步读取缓存的邀请码（可能为空 —— 首次进入尚未拉取属正常，下次分享会带上）
 */
function getInviteCode() {
  try {
    return String(wx.getStorageSync(INVITE_CACHE_KEY) || '').trim();
  } catch (e) {
    return '';
  }
}

/**
 * 异步拉取本人邀请码并缓存。推荐在页面 onLoad / onShow 调用一次。
 */
function refreshInviteCode() {
  try {
    if (getInviteCode()) return; // 已有缓存不重复请求
    const cid = wx.getStorageSync('clientId');
    if (!cid) return;
    wx.request({
      url: CONFIG.API_BASE + '/api/fission/profile?clientId=' + encodeURIComponent(cid),
      method: 'GET',
      timeout: 8000,
      success: function (res) {
        try {
          const d = (res && res.data && res.data.data) ? res.data.data : (res && res.data) || {};
          const code = d.my_invite_code || d.invite_code || d.inviteCode || d.myInviteCode || '';
          if (code) wx.setStorageSync(INVITE_CACHE_KEY, String(code).trim());
        } catch (e) {}
      }
    });
  } catch (e) {}
}

/**
 * 组装带邀请码的分享路径
 */
function buildPath(basePath, inviteCode) {
  const code = inviteCode || getInviteCode();
  if (!code) return basePath;
  return basePath + (basePath.indexOf('?') >= 0 ? '&' : '?') + 'inviteCode=' + encodeURIComponent(code);
}

/**
 * 生成测试结果页的分享配置
 * @param {string} type  测试类型 loss/market/danger/emotion/ability/score/camp
 * @param {number} score 分数
 * @param {string} level low/mid/high
 * @param {string} tag   结果标签（如"追高冲动型"），可选
 */
function buildTestShare(type, score, level, tag) {
  const t = (type || 'danger').toLowerCase();
  const s = { score: Number(score) || 0, tag: tag || '已出结果' };
  const maker = SHARE_COPY[t] || SHARE_COPY.danger;
  let title;
  try { title = maker(s); } catch (e) { title = '我的熵盾风控测试结果'; }

  // 落地页：目标页若是空壳则回退首页，绝不让用户点开空白页
  let target = TEST_PAGES[t] || TEST_PAGES.danger;
  if (SHELL_PAGES.indexOf(target) >= 0) target = FALLBACK_PAGE;

  return {
    title: title,
    path: buildPath(target),
    // 不传 imageUrl：由微信截取当前页面，避免出错；V2.0 后期接入 Canvas 定制卡片
  };
}

/**
 * 生成结果页分享配置的兜底版本（未知类型时使用）
 */
function buildDefaultShare() {
  return {
    title: '熵盾 · 每日风控仪表盘',
    path: buildPath('/pages/index/index')
  };
}

module.exports = {
  getInviteCode,
  refreshInviteCode,
  buildPath,
  buildTestShare,
  buildDefaultShare,
  TEST_PAGES
};
