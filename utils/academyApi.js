// utils/academyApi.js —— 控局者学院 · 单课解锁（58 号方案 波次1）
// 定位：课程不是商品，解锁是**成交引擎**——用 1 元首课制造微承诺、用积分路径保持活跃，
//       最终把人推向会员。所有文案与顺序都服务于这个目标。
const { API_BASE } = require('../config.js');

// 付费产品码与官方定价（分），必须与后端 PAID_PRODUCTS 一致
const PAID_AMOUNT = {
  course_first: 100, // 1 元首课特惠（每人限一次，微承诺钩子）
  course_one: 1990 // 19.9 元单课正价
};

const PAID_LABEL = {
  course_first: '1 元解锁首课',
  course_one: '19.9 元解锁本课'
};

function ensureClientId() {
  let cid = '';
  try {
    cid = wx.getStorageSync('clientId') || '';
  } catch (e) {}
  if (!cid) {
    cid = `ST-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    try {
      wx.setStorageSync('clientId', cid);
    } catch (e) {}
  }
  return cid;
}

function req(method, path, data) {
  return new Promise((resolve) => {
    wx.request({
      url: API_BASE + path,
      method,
      data,
      header: { 'content-type': 'application/json' },
      success: (r) => resolve((r && r.data) || {}),
      fail: () => resolve({})
    });
  });
}

// 我的解锁列表 + 会员状态 + 积分余额
function getEntitlements(clientId) {
  return req('GET', '/api/academy/entitlements?clientId=' + encodeURIComponent(clientId));
}

// 积分解锁
function unlockByPoints(clientId, lessonId) {
  return req('POST', '/api/academy/unlock', { clientId, lessonId, mode: 'points' });
}

// 付费解锁（持已支付订单号领取，后端校验订单归属/状态/金额）
function unlockByPaid(clientId, lessonId, orderNo) {
  return req('POST', '/api/academy/unlock', { clientId, lessonId, mode: 'paid', orderNo });
}

// 下单 → 拉起微信支付 → 支付成功自动解锁（走 JSAPI 普通支付，iOS 也可用）
function payAndUnlock(clientId, lessonId, productCode, description) {
  return new Promise((resolve) => {
    const amount = PAID_AMOUNT[productCode];
    if (!amount) return resolve({ ok: false, message: '未知商品' });

    wx.request({
      url: API_BASE + '/api/pay/jsapi',
      method: 'POST',
      data: {
        openid: clientId,
        amount,
        description: description || '控局者学院 · 单课解锁',
        productCode
      },
      header: { 'content-type': 'application/json' },
      success: (r) => {
        const d = (r && r.data) || {};
        if (!d || !d.ok) {
          return resolve({ ok: false, message: (d && (d.message || d.error)) || '下单失败' });
        }
        wx.requestPayment({
          timeStamp: d.timeStamp,
          nonceStr: d.nonceStr,
          package: d.package,
          signType: d.signType || 'RSA',
          paySign: d.paySign,
          success: () => {
            unlockByPaid(clientId, lessonId, d.outTradeNo).then((u) => {
              if (u && u.ok) resolve({ ok: true, source: 'paid', lessonId });
              else resolve({ ok: false, paid: true, message: (u && u.message) || '解锁失败，请联系客服', data: u });
            });
          },
          fail: (e) => {
            const msg = String((e && e.errMsg) || '');
            resolve({ ok: false, cancelled: /cancel/i.test(msg), message: /cancel/i.test(msg) ? '已取消' : '支付未完成' });
          }
        });
      },
      fail: () => resolve({ ok: false, message: '网络失败，请重试' })
    });
  });
}

// 是否可读：免费课 / 有效会员 / 已解锁 任一成立
function canRead(lesson, ent) {
  if (!lesson) return false;
  if (lesson.unlock === 'free') return true;
  if (ent && ent.isMember) return true;
  if (ent && Array.isArray(ent.list)) {
    return ent.list.some((x) => x.lessonId === lesson.id);
  }
  return false;
}

// 会员话术红线：课程只当赠品讲，主价值永远是测算次数
const MEMBER_PITCH = '开会员，每月享高级测算次数，72 门风控课免费看';

// ====== [波次2] 归因：记录"最近学过的课"，会员成交时回读 ======
// 目的只有一个：能回答「哪门课带来的会员最多」——这是课程团队的唯一 KPI 依据。
const LAST_LESSON_KEY = 'esLastLessonId';

function markLessonTouch(lessonId) {
  if (!lessonId) return;
  try {
    wx.setStorageSync(LAST_LESSON_KEY, String(lessonId));
  } catch (e) {}
}

// 读取并清空（一次成交只归因一次，避免后续成交重复挂到旧课）
function consumeLessonAttr() {
  try {
    const v = wx.getStorageSync(LAST_LESSON_KEY) || '';
    if (v) wx.removeStorageSync(LAST_LESSON_KEY);
    return v;
  } catch (e) {
    return '';
  }
}

module.exports = {
  PAID_AMOUNT,
  PAID_LABEL,
  MEMBER_PITCH,
  ensureClientId,
  getEntitlements,
  unlockByPoints,
  unlockByPaid,
  payAndUnlock,
  canRead,
  markLessonTouch,
  consumeLessonAttr
};
