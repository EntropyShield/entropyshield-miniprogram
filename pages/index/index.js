// pages/index/index.js

const USER_RIGHTS_KEY = 'userRights';

Page({
  data: {
    // 我的专属邀请码（用于分享时带参）
    inviteCode: ''
  },

  onLoad(options) {
    console.log('[index] onLoad options:', options || {});

    // 1）确保本机有自己的邀请码
    const myInvite = ensureInviteCode();
    this.setData({ inviteCode: myInvite });

    // 2）处理从别人分享链接进来的场景（带 inviteCode）
    handleInviteFromOptions(options || {});
  },

  onShow() {
    this.drawLogo2D();
  },

  // 绘制 LOGO（六边形 + ∞）
  drawLogo2D() {
    const q = wx.createSelectorQuery();
    q.select('#entropyLogo')
      .fields({ node: true, size: true })
      .exec(res => {
        if (!res || !res[0]) return;

        const canvas = res[0].node;
        const w = res[0].width;
        const h = res[0].height;

        const sys =
          (wx.getWindowInfo && wx.getWindowInfo()) ||
          wx.getSystemInfoSync();
        const dpr = sys.pixelRatio || 1;

        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);

        const GREEN1 = '#2AFF2A';
        const GREEN2 = '#21FF7A';
        const BLUE1 = '#36CFFF';
        const BLUE2 = '#1E90FF';

        const cx = w / 2;
        const cy = h / 2;
        const R = Math.min(w, h) * 0.46;

        // 六边形
        const hexLW = Math.max(1, w * 0.095);
        const gradG = ctx.createLinearGradient(0, 0, w, h);
        gradG.addColorStop(0, GREEN1);
        gradG.addColorStop(1, GREEN2);

        ctx.save();
        ctx.strokeStyle = gradG;
        ctx.lineWidth = hexLW;
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(42,255,42,0.35)';
        ctx.shadowBlur = 2 * (w / 40);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = -Math.PI / 6 + (i * Math.PI) / 3;
          const x = cx + R * Math.cos(ang);
          const y = cy + R * Math.sin(ang);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // 双环 ∞
        const rx = R * 0.34;
        const r = R * 0.35;
        const infLW = Math.max(1, r * 0.5);

        const gradB = ctx.createLinearGradient(0, cy, w, cy);
        gradB.addColorStop(0, BLUE1);
        gradB.addColorStop(1, BLUE2);

        ctx.save();
        ctx.strokeStyle = gradB;
        ctx.lineWidth = infLW;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(30,144,255,0.35)';
        ctx.shadowBlur = 1.5 * (w / 40);

        ctx.beginPath();
        ctx.arc(cx - rx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx + rx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      });
  },

  // 立即使用风控计算器
  goCalc() {
    console.log('立即使用风控计算器按钮被点击');

    wx.navigateTo({
      url: '/pages/riskCalculator/index',
      success() {
        console.log('跳转到 /pages/riskCalculator/index 成功');
      },
      fail(err) {
        console.error('跳转到 /pages/riskCalculator/index 失败', err);
      }
    });
  },

  // 亏损危险等级测试
  goLossTest() {
    wx.navigateTo({
      url: '/pages/testLossPersonality/index'
    });
  },

  // 风控能力评分
  goAbilityTest() {
    wx.navigateTo({
      url: '/pages/testRiskScore/index'
    });
  },

  // 7 天训练营
  goCamp() {
    wx.navigateTo({
      url: '/pages/campIntro/index'
    });
  },

  // 裂变任务中心
  goFission() {
    wx.navigateTo({
      url: '/pages/fissionTask/index'
    });
  },

  // 小程序转发带上我的邀请码
  onShareAppMessage() {
    const rights = wx.getStorageSync(USER_RIGHTS_KEY) || {};
    const inviteCode = rights.inviteCode || this.data.inviteCode || '';

    const path = inviteCode
      ? `/pages/index/index?inviteCode=${encodeURIComponent(inviteCode)}`
      : '/pages/index/index';

    return {
      title: '熵盾·风控卫士 —— 从会亏钱到会控亏',
      path
    };
  },

  // 登录请求处理：确保使用 POST 请求发送到后端
  handleLogin(username, password) {
    wx.request({
      url: 'https://api.entropyshield.com/api/wx/login',  // 确保正确的后端 API 路径
      method: 'POST',  // 使用 POST 请求
      data: { username, password },
      success(res) {
        console.log('Login successful:', res.data);
      },
      fail(err) {
        console.error('Login error:', err);
      }
    });
  }
});

/**
 * 确保本机有一个固定的邀请码 inviteCode
 * 存在 userRights.inviteCode 里
 */
function ensureInviteCode() {
  const rights = wx.getStorageSync(USER_RIGHTS_KEY) || {};
  let inviteCode = rights.inviteCode;

  if (!inviteCode) {
    inviteCode = genInviteCode();
    rights.inviteCode = inviteCode;
    wx.setStorageSync(USER_RIGHTS_KEY, rights);
    console.log('[index] 新生成 inviteCode =', inviteCode);
  } else {
    console.log('[index] 使用已有 inviteCode =', inviteCode);
  }

  return inviteCode;
}

/**
 * 处理从别人分享链接进入：
 * ?inviteCode=XXXX
 * - 如果本机已有自己的 inviteCode，且与传入的一样 → 认为是“自己点自己的链接”，不记录邀请关系
 * - 否则，在 userRights.invitedByCode 里记录邀请人
 */
function handleInviteFromOptions(options = {}) {
  const inviteCode = options.inviteCode || options.invite || '';
  if (!inviteCode) return;

  try {
    const rights = wx.getStorageSync(USER_RIGHTS_KEY) || {};

    // 自己打开自己的链接：直接忽略
    if (rights.inviteCode && rights.inviteCode === inviteCode) {
      console.log('[index] 自己打开自己的分享链接，不记录邀请关系');
      return;
    }

    if (!rights.invitedByCode) {
      rights.invitedByCode = inviteCode;
      rights.invitedAt = Date.now();
      wx.setStorageSync(USER_RIGHTS_KEY, rights);

      console.log('[index] 记录邀请关系成功 invitedByCode =', inviteCode);
      wx.showToast({
        title: '已记录邀请关系',
        icon: 'none',
        duration: 1500
      });
    } else {
      console.log(
        '[index] 已存在 invitedByCode，保持原值：',
        rights.invitedByCode
      );
    }
  } catch (e) {
    console.log('[index] 保存邀请关系失败', e);
  }
}

/**
 * 简单生成 6 位大写字母+数字的邀请码
 */
function genInviteCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    out += chars.charAt(idx);
  }
  return out;
}