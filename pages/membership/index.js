// pages/membership/index.js

Page({
  data: {
    // 入口类型：steady = 稳健版；advanced = 加强版
    type: 'steady',
    balance: '',
    price: '',
    code: '',

    planLabel: '',
    plans: [],

    // 当前权益展示
    freeCalcTimes: 0,
    membershipNameDisplay: ''
  },

  onLoad(options) {
    const type = options.type || 'steady';

    const balance = options.balance ? decodeURIComponent(options.balance) : '';
    const price = options.price ? decodeURIComponent(options.price) : '';
    const code = options.code ? decodeURIComponent(options.code) : '';

    const isAdvanced = type === 'advanced';
    const planLabel = isAdvanced ? '加强版 · 高阶风控方案' : '稳健版风控方案';

    const plans = [
      {
        id: 'trial14',
        name: '14 天体验会员',
        priceText: '¥99',
        unitText: '14 天',
        desc: '先体验一轮完整风控流程，14 天内专注养成风控习惯。',
        grantTimes: 6,
        durationDays: 14
      },
      {
        id: 'month',
        name: '月度会员',
        priceText: '¥999',
        unitText: '每月',
        desc: '适合高频复盘者，30 天内反复使用控局方案训练执行力。',
        grantTimes: 20,
        durationDays: 30
      },
      {
        id: 'quarter',
        name: '季度会员',
        priceText: '¥2999',
        unitText: '每季度',
        desc: '季度周期控局者，90 天内配合多轮训练营强化秩序感。',
        grantTimes: 70,
        durationDays: 90
      },
      {
        id: 'year',
        name: '年度会员',
        priceText: '¥9999',
        unitText: '每年',
        desc: '适合长期秩序架构师，一年内持续用控局方案约束自己。',
        grantTimes: 300,
        durationDays: 365
      }
    ];

    this.setData({
      type,
      balance,
      price,
      code,
      planLabel,
      plans
    });

    this.refreshRights();
  },

  onShow() {
    this.refreshRights();
  },

  // 刷新当前权益（从 userRights 读取）
  refreshRights() {
    const userRights = wx.getStorageSync('userRights') || {};
    const freeCalcTimes = Math.max(0, Number(userRights.freeCalcTimes || 0));

    const rawName = userRights.membershipName || '';
    const expireAt = Number(userRights.membershipExpireAt || 0);

    let membershipNameDisplay = rawName;
    if (rawName && expireAt) {
      const now = Date.now();
      if (now > expireAt) membershipNameDisplay = rawName + '（已到期）';
    }

    this.setData({
      freeCalcTimes,
      membershipNameDisplay
    });
  },

  // ===== API 基础能力 =====
  getApiBase() {
    try {
      const cfg = require('../../config.js') || {};
      return (
        cfg.API_BASE ||
        cfg.API_BASE_URL ||
        cfg.PROD_API_BASE ||
        'https://api.entropyshield.com'
      );
    } catch (e) {
      return 'https://api.entropyshield.com';
    }
  },

  ensureOpenid(cb) {
    const openid = wx.getStorageSync('openid');
    if (openid) return cb(openid);

    wx.login({
      success: (r) => {
        const code = r.code;
        wx.request({
          url: this.getApiBase() + '/api/wx/login',
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          data: { code },
          success: (res) => {
            if (res.data && res.data.ok && res.data.openid) {
              wx.setStorageSync('openid', res.data.openid);
              cb(res.data.openid);
            } else {
              wx.showToast({ title: '获取 openid 失败', icon: 'none' });
              console.log('[B] /api/wx/login res =>', res.data);
            }
          },
          fail: (err) => {
            wx.showToast({ title: '请求 wx/login 失败', icon: 'none' });
            console.error(err);
          }
        });
      },
      fail: (err) => {
        wx.showToast({ title: 'wx.login 失败', icon: 'none' });
        console.error(err);
      }
    });
  },

  planIdToProductCode(planId) {
    if (planId === 'trial14') return 'VIP_TRIAL14';
    if (planId === 'month') return 'VIP_MONTH';
    if (planId === 'quarter') return 'VIP_QUARTER';
    if (planId === 'year') return 'VIP_YEAR';
    return 'VIP_TRIAL14';
  },

  // ===== B：jsapi 下单（mock） =====
  callPayJsapi(openid, productCode) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.getApiBase() + '/api/pay/jsapi',
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: { openid, productCode },
        success: (res) => {
          if (res.data && res.data.ok) resolve(res.data);
          else reject(res.data || { message: 'jsapi 返回异常' });
        },
        fail: (err) => reject(err)
      });
    });
  },

  // ===== B2：notify mock 回调发权益 =====
  callPayNotifyMock(openid, productCode, outTradeNo) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.getApiBase() + '/api/pay/notify',
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: { mock: 1, openid, productCode, outTradeNo },
        success: (res) => {
          if (res.data && res.data.ok) resolve(res.data);
          else reject(res.data || { message: 'notify 返回异常' });
        },
        fail: (err) => reject(err)
      });
    });
  },

  // ===== A：保留 mock/paid 兜底（避免你服务器没更新时卡死） =====
  callMockPaid(openid, productCode, plan, type) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.getApiBase() + '/api/pay/mock/paid',
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: { openid, productCode },
        success: (res) => {
          if (res.data && res.data.ok) {
            const rights = wx.getStorageSync('userRights') || {};
            rights.freeCalcTimes = Number(res.data.freeCalcTimes || 0);
            rights.membershipName = res.data.membershipName || plan.name;
            rights.membershipPlan = plan.id;
            rights.membershipEntryType = type;
            rights.membershipProductCode = productCode;

            if (plan.durationDays) {
              const now = Date.now();
              rights.membershipExpireAt = now + plan.durationDays * 24 * 60 * 60 * 1000;
            }
            wx.setStorageSync('userRights', rights);
            resolve(res.data);
          } else {
            reject(res.data || { message: 'mock/paid 返回异常' });
          }
        },
        fail: (err) => reject(err)
      });
    });
  },

  // 选择某个会员方案
  onSelectPlan(e) {
    const planId = e.currentTarget.dataset.planId;
    const { type, balance, price, code, plans, planLabel } = this.data;

    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      wx.showToast({ title: '无法识别的会员方案', icon: 'none' });
      return;
    }

    if (type === 'advanced' && plan.id !== 'year') {
      wx.showToast({ title: '高阶方案仅支持年度会员，请选择年度会员', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '开通会员（测试环境）',
      content: `当前为演示环境：将走 B 链路（jsapi 下单 → notify mock 回调）开通「${plan.name}」。`,
      confirmText: '确认开通',
      cancelText: '再想想',
      success: (res) => {
        if (!res.confirm) return;

        const productCode = this.planIdToProductCode(plan.id);

        this.ensureOpenid((openid) => {
          // B1：jsapi 下单
          this.callPayJsapi(openid, productCode)
            .then((jsapi) => {
              const outTradeNo = jsapi.outTradeNo || ('MOCK' + Date.now());

              // B2：mock notify 发权益
              return this.callPayNotifyMock(openid, productCode, outTradeNo)
                .then((notify) => ({ jsapi, notify }));
            })
            .then(({ notify }) => {
              // 写入本地权益（以 notify 返回为准）
              const old = wx.getStorageSync('userRights') || {};
              const next = {
                ...old,
                membershipName: notify.membershipName || plan.name,
                freeCalcTimes: Math.max(0, Number(notify.freeCalcTimes || plan.grantTimes || 0)),
                membershipPlan: plan.id,
                membershipEntryType: type,
                membershipProductCode: productCode
              };

              if (notify.membershipExpireAt) {
                next.membershipExpireAt = Number(notify.membershipExpireAt);
              } else if (plan.durationDays) {
                const now = Date.now();
                next.membershipExpireAt = now + plan.durationDays * 24 * 60 * 60 * 1000;
              }

              wx.setStorageSync('userRights', next);
              this.refreshRights();

              wx.showToast({ title: '开通成功（B链路mock）', icon: 'success', duration: 1500 });

              const membershipTypeText = `${next.membershipName} · ${planLabel}`;
              const query =
                `?balance=${encodeURIComponent(balance)}` +
                `&price=${encodeURIComponent(price)}` +
                `&code=${encodeURIComponent(code || '')}` +
                `&membershipType=${encodeURIComponent(membershipTypeText)}`;

              if (type === 'steady') {
                wx.navigateTo({ url: '/pages/planSteady/index' + query });
              } else {
                wx.navigateTo({ url: '/pages/planAdvanced/index' + query });
              }
            })
            .catch((err) => {
              console.error('[B] jsapi/notify failed =>', err);

              // 兜底：走 A 的 mock/paid，保证不阻塞你测试
              this.callMockPaid(openid, productCode, plan, type)
                .then(() => {
                  this.refreshRights();
                  wx.showToast({ title: '已兜底开通（A mock/paid）', icon: 'success', duration: 1500 });
                })
                .catch((e2) => {
                  console.error('[A] mock/paid failed =>', e2);
                  wx.showToast({
                    title: (e2 && e2.message) ? e2.message : '开通失败',
                    icon: 'none'
                  });
                });
            });
        });
      }
    });
  },

  goCamp() {
    wx.navigateTo({ url: '/pages/campIntro/index' });
  },

  goBackCalc() {
    wx.navigateBack();
  }
});
