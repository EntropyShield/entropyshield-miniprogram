// pages/riskCalculator/index.js
const funnel = require('../../utils/funnel.js');
const UR = require('../../utils/userRights.js');

Page({
  data: {
    balance: '',        // 可用资金
    price: '',          // 首次买入价格
    code: '',           // 标的代码或名称

    freeCalcTimes: 0,   // 剩余按次/奖励次数（只有这类才扣减）
    membershipName: '', // 当前会员名称展示（可能含已到期）
    advancedEnabled: false, // 是否可用加强版
    remainingDays: 0,       // 会员剩余天数
    unlimitedActive: false  // 是否处于有效期内无限
  },

  onLoad() {
    this.refreshFreeTimes();
  },

  onShow() {
    this.refreshFreeTimes();
  },

  // 从本地存储读取权益信息
  refreshFreeTimes() {
    const rights = UR.getUserRights();

    const freeCalcTimes = Number(rights.freeCalcTimes || 0);

    const rawName = rights.membershipName || '';
    const expireAt = Number(rights.membershipExpireAt || 0);
    const expired = (expireAt && Date.now() > expireAt);

    const remainingDays = UR.getRemainingDays(rights);
    const unlimitedActive = UR.isUnlimitedMember(rights);

    let membershipName = rawName;
    if (rawName && expired) {
      membershipName = rawName + '（已到期）';
    } else if (rawName && unlimitedActive && remainingDays) {
      membershipName = `${rawName}（剩余${remainingDays}天 · 无限）`;
    }

    const advancedEnabled = UR.isAdvancedAllowed(rights);

    this.setData({
      freeCalcTimes,
      membershipName,
      advancedEnabled,
      remainingDays,
      unlimitedActive
    });
  },

  // ===== 加强版权限判断（只有季卡/年卡可用）=====
  getAdvancedAccessInfo() {
    const rights = UR.getUserRights();

    const productCode = UR.normalizeProductCode(rights);
    const expireAt = Number(rights.membershipExpireAt || 0);
    const notExpired = !expireAt || Date.now() < expireAt;

    const advancedEnabled = rights.advancedEnabled === true;
    const codeAllow = (productCode === 'VIP_QUARTER' || productCode === 'VIP_YEAR');

    const ok = (advancedEnabled || codeAllow) && notExpired;

    let reason = '';
    if (!notExpired) reason = 'EXPIRED';
    else if (!(advancedEnabled || codeAllow)) reason = 'NOT_ALLOWED';

    return { ok, reason, productCode, expireAt, advancedEnabled };
  },

  promptAdvancedBlocked() {
    const { balance, price, code } = this.data;

    wx.showModal({
      title: '加强版权限',
      content: '加强版仅对「季卡/年卡」开放。\n月卡/体验/9.9按次/训练营奖励仅支持稳健版。',
      confirmText: '去开通',
      cancelText: '用稳健版',
      success: (r) => {
        if (r.confirm) {
          wx.navigateTo({
            url:
              `/pages/membership/index?type=advanced` +
              `&balance=${encodeURIComponent(balance)}` +
              `&price=${encodeURIComponent(price)}` +
              `&code=${encodeURIComponent(code || '')}`
          });
        } else {
          this.handleGeneratePlan('steady');
        }
      }
    });
  },

  // 输入
  onBalanceInput(e) {
    this.setData({ balance: e.detail.value });
  },
  onPriceInput(e) {
    this.setData({ price: e.detail.value });
  },
  onCodeInput(e) {
    this.setData({ code: e.detail.value });
  },

  // 校验
  validateForm() {
    const { balance, price } = this.data;

    if (!balance) {
      wx.showToast({ title: '请输入可用资金', icon: 'none' });
      return false;
    }
    if (!price) {
      wx.showToast({ title: '请输入首次买入价格', icon: 'none' });
      return false;
    }
    return true;
  },

  // 点击：稳健版
  onClickSteady() {
    console.log('[riskCalculator] click steady');
    funnel.log('CALC_CLICK_STEADY', {});
    this.handleGeneratePlan('steady');
  },

  // 点击：加强版
  onClickAdvanced() {
    console.log('[riskCalculator] click advanced');
    funnel.log('CALC_CLICK_ADVANCED', {});
    this.handleGeneratePlan('advanced');
  },

  /**
   * 统一处理生成方案：
   * 1）加强版：先做权限边界校验（仅季卡/年卡可进）
   * 2）若处于“有效会员无限” -> 直接放行，不扣次数
   * 3）否则：若 freeCalcTimes>0 -> 扣一次并跳转
   * 4）否则弹出三选一下一步
   */
  handleGeneratePlan(planType) {
    if (!this.validateForm()) return;

    const { balance, price, code, freeCalcTimes } = this.data;

    // 1) 加强版强拦截（不允许用按次/奖励绕过）
    if (planType === 'advanced') {
      const adv = this.getAdvancedAccessInfo();
      if (!adv.ok) {
        console.log('[riskCalculator] advanced blocked =>', adv);
        funnel.log('CALC_ADV_BLOCK', {
          reason: adv.reason,
          productCode: adv.productCode,
          advancedEnabled: adv.advancedEnabled,
          expireAt: adv.expireAt
        });
        this.promptAdvancedBlocked();
        return;
      }
    }

    // 2) 有效会员无限：直接放行（99/999/2999/9999）
    const rights = UR.getUserRights();
    const pc = UR.normalizeProductCode(rights);
    const unlimitedActive = UR.isUnlimitedMember(rights);

    if (unlimitedActive) {
      const days = UR.getRemainingDays(rights);
      const name = rights.membershipName || '会员';
      const label = `${name}${days ? `（剩余${days}天）` : ''} · 无限使用`;

      funnel.log('CALC_MEMBER_UNLIMITED', { planType, productCode: pc, expireAt: rights.membershipExpireAt || 0 });

      this.gotoPlanResult(planType, {
        balance,
        price,
        code,
        membershipType: label
      });

      return;
    }

    // 3) 按次/奖励次数：扣减
    if (freeCalcTimes > 0) {
      const left = freeCalcTimes - 1;

      const name = rights.membershipName || '按次/奖励';
      const label = `${name} · 按次使用`;

      this.gotoPlanResult(
        planType,
        { balance, price, code, membershipType: label },
        {
          onSuccess: () => {
            UR.mergeUserRights({ freeCalcTimes: left });
            this.setData({ freeCalcTimes: left });

            funnel.log('CALC_TIMES_DEDUCT', { planType, leftFreeTimes: left });

            wx.showToast({
              title: `已使用 1 次，剩余 ${left} 次`,
              icon: 'none',
              duration: 2000
            });
          },
          onFail: (err) => {
            console.error('[riskCalculator] gotoPlanResult failed, will NOT deduct times:', err);
            wx.showToast({
              title: '页面跳转失败，请检查结果页是否已注册',
              icon: 'none',
              duration: 2000
            });
          }
        }
      );
      return;
    }

    // 4) 没有次数、也不是无限会员：弹出下一步
    this.chooseNextStep(planType);
  },

  // 跳转到方案结果页（稳健版 / 加强版）
  gotoPlanResult(planType, { balance, price, code, membershipType }, hooks = {}) {
    const base =
      `?balance=${encodeURIComponent(balance)}` +
      `&price=${encodeURIComponent(price)}` +
      `&code=${encodeURIComponent(code || '')}`;

    const mt = membershipType ? `&membershipType=${encodeURIComponent(membershipType)}` : '';

    const url =
      (planType === 'steady')
        ? ('/pages/planSteady/index' + base + mt)
        : ('/pages/planAdvanced/index' + base + mt);

    console.log('[riskCalculator] will navigate url=', url);

    wx.navigateTo({
      url,
      success: () => {
        console.log('[riskCalculator] navigate success', url);
        if (hooks && typeof hooks.onSuccess === 'function') hooks.onSuccess();
      },
      fail: (e) => {
        console.error('[riskCalculator] navigate fail', e);
        wx.showToast({
          title: (e && e.errMsg) ? `跳转失败：${e.errMsg}` : '跳转失败',
          icon: 'none',
          duration: 2500
        });
        if (hooks && typeof hooks.onFail === 'function') hooks.onFail(e);
      }
    });
  },

  // 下一步选择（会员 / 训练营 / 邀请好友）
  chooseNextStep(planType) {
    const { balance, price, code } = this.data;

    funnel.log('CALC_CHOOSE_NEXT', { planType, hasFreeTimes: false });

    wx.showActionSheet({
      itemList: [
        '直接开通会员，解锁完整方案',
        '先参加 7 天风控训练营',
        '邀请好友，免费获得使用次数'
      ],
      success: (res) => {
        const idx = res.tapIndex;

        funnel.log('CALC_CHOOSE_NEXT_RESULT', { planType, choiceIndex: idx });

        if (idx === 0) {
          wx.navigateTo({
            url:
              `/pages/membership/index?type=${planType}` +
              `&balance=${encodeURIComponent(balance)}` +
              `&price=${encodeURIComponent(price)}` +
              `&code=${encodeURIComponent(code || '')}`
          });
          return;
        }

        if (idx === 1) {
          wx.navigateTo({ url: '/pages/campIntro/index' });
          return;
        }

        if (idx === 2) {
          wx.navigateTo({ url: `/pages/fissionTask/index?fromPlan=${planType}` });
        }
      },
      fail: (err) => {
        console.log('[riskCalculator] actionSheet canceled or failed', err);
      }
    });
  },

  // 返回首页
  goHome() {
    wx.switchTab({ url: '/pages/index/index' });
  }
});
