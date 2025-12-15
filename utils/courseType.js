// utils/courseType.js
// 统一管理「课程类型」的文案、样式 & 控局路径阶段说明

const TYPE_META = {
  PUBLIC: {
    key: 'PUBLIC',
    text: '公开课',
    shortTag: '公开课',
    cssClass: 'tag-public',
    pathStageTitle: '第 0 阶：第一次认识熵盾',
    pathStageDesc:
      '用于破冰和理念认同，让新用户知道“亏钱的根源在风控，而不是消息”，建立对熵盾方法论的第一印象。',
    pathNextStep:
      '课后建议：安装熵盾风控计算器，预约一次体验课或账户体检，把理念落到自己的账户上。'
  },

  EXPERIENCE: {
    key: 'EXPERIENCE',
    text: '体验课',
    shortTag: '体验课',
    cssClass: 'tag-experience',
    pathStageTitle: '第 1 阶：体验熵盾工具的效果',
    pathStageDesc:
      '围绕风控计算器、账户体检等实操，帮助用户真实感受到“先控亏，再谈赚”的落地效果。',
    pathNextStep:
      '课后建议：正式用风控计算器跑一套自己的完整方案，然后进入 7 天风控训练营做行为固化。'
  },

  CAMP: {
    key: 'CAMP',
    text: '训练营',
    shortTag: '训练营',
    cssClass: 'tag-camp',
    pathStageTitle: '第 1.5 阶：7 天行为固化训练',
    pathStageDesc:
      '通过 7 天打卡，把“止损、仓位、复盘”固化为交易前后自动会做的动作，让风控从认知变成习惯。',
    pathNextStep:
      '课后建议：进入风控系统课/进阶课，把训练营成果升级为可长期复用的控局体系。'
  },

  RISK: {
    key: 'RISK',
    text: '风控课',
    shortTag: '风控课',
    cssClass: 'tag-risk',
    pathStageTitle: '第 2 阶：搭建个人风控系统',
    pathStageDesc:
      '系统拆解止损、仓位、盈亏结构与复盘方法，把单次体验升级为可反复执行的风控系统。',
    pathNextStep:
      '课后建议：结合训练营，把这套风控系统写进自己的“交易前后必做动作清单”里。'
  },

  SALON: {
    key: 'SALON',
    text: '线下沙龙',
    shortTag: '线下',
    cssClass: 'tag-salon',
    pathStageTitle: '第 3 阶：线下深度交流与账户体检',
    pathStageDesc:
      '小范围线下沙龙 + 账户体检，为高意愿用户解决个性化问题，同时筛选控局者进阶与合伙人候选。',
    pathNextStep:
      '线下建议：根据账户体检结果，决定是否进入控局者系统课/进阶营，并与顾问讨论合伙人路径。'
  },

  CONTROLLER: {
    key: 'CONTROLLER',
    text: '控局者课',
    shortTag: '进阶',
    cssClass: 'tag-controller',
    pathStageTitle: '第 4 阶：成为控局者',
    pathStageDesc:
      '面向希望长期在市场活下去并实现资金稳步放大的用户，完整输出熵盾控局者的盈利与风控体系。',
    pathNextStep:
      '课后建议：配合风控工具 + 训练营 + 线下陪跑，进入长期控局体系，并视情况加入合伙人机制。'
  },

  UNKNOWN: {
    key: 'UNKNOWN',
    text: '课程',
    shortTag: '课程',
    cssClass: 'tag-default',
    pathStageTitle: '控局路径中的课程',
    pathStageDesc:
      '课程类型暂未归类，但仍然属于控局路径中的一环，可以作为你控局旅程的一部分。',
    pathNextStep:
      '建议与你的熵盾顾问确认这门课在控局路径中的具体位置，再决定下一步应该衔接哪一类课。'
  }
};

// [P1-NORM-20251215] 支持数字枚举（可选兼容）：0~5
function mapNumericKey(n) {
  switch (Number(n)) {
    case 0:
      return 'PUBLIC';
    case 1:
      return 'EXPERIENCE';
    case 2:
      return 'CAMP';
    case 3:
      return 'SALON';
    case 4:
      return 'RISK';
    case 5:
      return 'CONTROLLER';
    default:
      return 'UNKNOWN';
  }
}

function normalizeKey(rawType) {
  if (rawType === null || rawType === undefined) return 'UNKNOWN';

  // [P1-NORM-20251215] 兼容 number / string number
  if (typeof rawType === 'number') {
    return mapNumericKey(rawType);
  }

  const raw = String(rawType || '').trim();
  if (!raw) return 'UNKNOWN';

  if (/^\d+$/.test(raw)) {
    return mapNumericKey(raw);
  }

  const upper = raw.toUpperCase();
  if (TYPE_META[upper]) return upper;

  const t = raw.toLowerCase();

  // PUBLIC
  if (
    ['public', 'promo', 'open', 'free', 'public_course', 'open_course'].includes(t) ||
    t.indexOf('公开') !== -1 ||
    t.indexOf('公开课') !== -1
  ) {
    return 'PUBLIC';
  }

  // EXPERIENCE
  if (
    ['lead', 'experience', 'trial', 'exp', 'try', 'lead_course'].includes(t) ||
    t.indexOf('体验') !== -1 ||
    t.indexOf('引流') !== -1 ||
    t.indexOf('试听') !== -1
  ) {
    return 'EXPERIENCE';
  }

  // CAMP
  if (
    ['camp', 'bootcamp', 'training', 'train'].includes(t) ||
    t.indexOf('训练营') !== -1 ||
    t.indexOf('打卡') !== -1 ||
    t.indexOf('营') !== -1
  ) {
    return 'CAMP';
  }

  // RISK
  if (
    ['risk', 'calc', 'system', 'risk_system'].includes(t) ||
    t.indexOf('风控') !== -1 ||
    t.indexOf('系统') !== -1
  ) {
    return 'RISK';
  }

  // SALON / OFFLINE / VISIT
  if (
    ['salon', 'offline', 'visit', 'meeting'].includes(t) ||
    t.indexOf('沙龙') !== -1 ||
    t.indexOf('线下') !== -1 ||
    t.indexOf('来访') !== -1 ||
    t.indexOf('预约') !== -1
  ) {
    return 'SALON';
  }

  // CONTROLLER / PAID / PRO
  if (
    ['paid', 'controller', 'pro', 'advanced', 'vip'].includes(t) ||
    t.indexOf('控局者') !== -1 ||
    t.indexOf('进阶') !== -1 ||
    t.indexOf('会员') !== -1
  ) {
    return 'CONTROLLER';
  }

  return 'UNKNOWN';
}

function getCourseTypeMeta(rawType) {
  const key = normalizeKey(rawType);
  return TYPE_META[key] || TYPE_META.UNKNOWN;
}

module.exports = {
  getCourseTypeMeta
};
