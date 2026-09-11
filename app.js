// app.js - 启动入口（V2.1.8 重构版：行为等价，代码聚合）
const { API_BASE, ENV, PROD_API_BASE } = require('./config');
const { ensureClientId } = require('./utils/bootClientId');
const { appDebug } = require('./utils/bootDebug');
const { capturePendingInvite, tryBindInviteOnce } = require('./utils/bootInvite');
const { installGlobalShare } = require('./utils/bootShare');
const { clearLocalMembershipCache } = require('./utils/bootRights');
const { syncProfileAndRights } = require('./utils/bootProfileSync');
const { installCampNavHook } = require('./utils/bootNavHook');
const { resolveApiBase, healthCheck } = require('./utils/bootApiBase');
const { checkAgreementGate } = require('./utils/bootAgreement');
const { claimDailyPower } = require('./utils/bootPower'); // [2026-09-11 修复] 原未 require → ReferenceError

// 全局分享默认补丁：必须在 Page 被使用前安装
installGlobalShare();

App({
  onLaunch(options) {
    // A1: 合规协议门
    if (checkAgreementGate(options)) return;

    // 清理本地会员缓存，避免权益过期后仍被旧缓存误导
    clearLocalMembershipCache();

    // P0: 扫码进入即捕获邀请码，并在 clientId 就绪后多次尝试绑定
    capturePendingInvite(options);
    [300, 1200, 3000, 6000].forEach((ms) => {
      try { setTimeout(tryBindInviteOnce, ms); } catch (e) {}
    });

    // 确保身份 + 解析后端地址
    ensureClientId();
    const base = resolveApiBase(API_BASE);

    // 登录、权益、裂变档案一次性同步（内部幂等）
    syncProfileAndRights({ base, scene: 'app_launch' });

    // 安装训练营结营页导航钩子
    installCampNavHook();

    // 后端健康探测：非 2xx 自动回落生产地址
    healthCheck({ base, app: this });

    // 每日战力值（B 轨）自动领取：启动即领，零门槛（66 号 §2）
    // [2026-09-11 修复] 原为同步直接调用：① 未 require 抛 ReferenceError 打断后续初始化；
    //   ② 此刻 clientId 尚未就绪，函数内部必然早退，等于每天都没有真正领取。
    //   改为等身份就绪后再领，失败静默、不阻断启动。
    Promise.resolve()
      .then(() => ensureClientId())
      .then(() => claimDailyPower())
      .catch(() => {});

    // 初始化全局数据
    this.globalData = this.globalData || {};
    this.globalData.API_BASE = base;
    this.globalData.baseUrl = base;

    appDebug('[BOOT] ENV=', ENV, 'API_BASE=', base);
  },

  globalData: {
    API_BASE: String(API_BASE || '').trim().replace(/\/$/, ''),
    baseUrl: String(API_BASE || '').trim().replace(/\/$/, '')
  }
});

// 开发环境依赖分析占位（条件恒假，不会执行）
if (false) {
  require('./pkgService/visitAdmin/index.js');
}
