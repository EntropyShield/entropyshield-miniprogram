// utils/points.js —— 熵盾积分 + 控局者等级 请求封装
// 后端域名与项目其余接口一致（api.entropyshield.com）
const API = 'https://api.entropyshield.com';

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
// 领取待发奖励
function claimReward(clientId, rewardId) {
  return postJson('/api/points/claim', { clientId, rewardId });
}
// 拉取积分/等级/连续/待领
function getMe(clientId) {
  return getJson('/api/points/me?clientId=' + encodeURIComponent(clientId));
}

module.exports = { grantCheckin, grantShare, grantMilestone, claimReward, getMe };
