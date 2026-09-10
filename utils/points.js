// utils/points.js —— 熵盾积分 + 控局者等级 请求封装
// [2026-09-10 全链路审计修复] 域名统一走 config.API_BASE：
//   此前本文件硬编码 api.entropyshield.com，导致 develop 环境无法切本地后端、也无法走
//   bootApiBase 的动态回落，是全项目唯一一处绕过统一配置的硬编码，已收敛。
const { API_BASE } = require('../config.js');
const API = API_BASE;

function postJson(path, data) {
  return new Promise((resolve) => {
    wx.request({
      url: API + path,
      method: 'POST',
      data,
      header: { 'content-type': 'application/json' },
      success: (r) => resolve((r && r.data) || {}),
      fail: () => resolve({}),
    });
  });
}

function getJson(path) {
  return new Promise((resolve) => {
    wx.request({
      url: API + path,
      method: 'GET',
      success: (r) => resolve((r && r.data) || {}),
      fail: () => resolve({}),
    });
  });
}

// 打卡发分（幂等，按日期）
function grantCheckin(clientId, date) {
  return postJson('/api/points/grant', { clientId, kind: 'checkin', date });
}
// 分享战绩卡发分（幂等，按日期）
function grantShare(clientId, date) {
  return postJson('/api/points/grant', { clientId, kind: 'share', date });
}
// 连续里程碑发分（3/7/21）
function grantMilestone(clientId, milestone) {
  return postJson('/api/points/grant', { clientId, kind: 'milestone', milestone });
}
// 学完一节控局者学院课程发分（幂等，按 lessonId）
function grantCourse(clientId, lessonId) {
  return postJson('/api/points/grant', { clientId, kind: 'course', date: lessonId });
}
// [2026-09-10 全链路审计] 删除 claimReward：
//   后端无 /api/points/claim 路由（实测 404），且 /api/points/me 也不返回 pendingRewards
//   字段 → 该能力从未接线，profile 页对应 UI 区块因 wx:if 恒假也从未渲染。
//   结论：A 轨积分走 /grant 直接发放，不存在"待领取"中间态。如后续要做待领，
//   需后端先建 pending 表 + /me 返回该字段 + /claim 领取，三件套齐了再接前端。
// 拉取积分/等级/连续
function getMe(clientId) {
  return getJson('/api/points/me?clientId=' + encodeURIComponent(clientId));
}

// [2026-09-10 全链路审计修复] 补导出 grantCourse：
//   pkgAcademy/pages/lesson.js:70 已在调用 points.grantCourse()，但此前未导出，
//   运行时会抛 "points.grantCourse is not a function" → 学完课程发分直接中断。
module.exports = { grantCheckin, grantShare, grantMilestone, grantCourse, getMe };
