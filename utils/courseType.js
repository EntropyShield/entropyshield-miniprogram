// utils/courseType.js
// 统一管理「课程类型」的文案、样式 & 控局路径阶段说明

// 每种类型的元数据
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
  RISK: {
    key: 'RISK',
    text: '风控课',
    shortTag: '风控课',
    cssClass: 'tag-risk',
    pathStageTitle: '第 2 阶：搭建个人风控系统',
    pathStageDesc:
      '系统拆解止损、仓位、盈亏结构与复盘方法，把单次体验升级为可反复执行的风控系统。',
    pathNextStep:
      '课后建议：结合 7 天训练营，把这套风控系统写进自己的“交易前后必做动作清单”里。'
  },
  SALON: {
    key: 'SALON',
    text: '线下沙龙',
    shortTag: '线下沙龙',
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
    shortTag: '控局者课',
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

/**
 * 把后端传来的 courseType / type / category 等字段
 * 统一规整成我们内部使用的枚举 key
 */
function normalizeKey(rawType) {
  const raw = (rawType || '').toString().trim();
  if (!raw) return 'UNKNOWN';

  const upper = raw.toUpperCase();
  // 如果后端直接给的是 PUBLIC / EXPERIENCE 等
  if (TYPE_META[upper]) return upper;

  const t = raw.toLowerCase();

  // 公开课
  if (
    ['public', 'promo', 'open'].includes(t) ||
    t.indexOf('公开') !== -1
  ) {
    return 'PUBLIC';
  }

  // 体验课 / 引流课
  if (
    ['lead', 'experience', 'trial', 'exp'].includes(t) ||
    t.indexOf('体验') !== -1 ||
    t.indexOf('引流') !== -1
  ) {
    return 'EXPERIENCE';
  }

  // 风控课 / 系统课 / 计算器课
  if (
    ['risk', 'calc', 'system'].includes(t) ||
    t.indexOf('风控') !== -1
  ) {
    return 'RISK';
  }

  // 线下沙龙
  if (
    ['salon', 'offline'].includes(t) ||
    t.indexOf('沙龙') !== -1
  ) {
    return 'SALON';
  }

  // 控局者系统课 / 付费进阶课
  if (
    ['paid', 'controller', 'pro'].includes(t) ||
    t.indexOf('控局者') !== -1
  ) {
    return 'CONTROLLER';
  }

  return 'UNKNOWN';
}

/**
 * 对外暴露的获取元数据方法
 * @param {string} rawType 后端原始类型字段
 */
function getCourseTypeMeta(rawType) {
  const key = normalizeKey(rawType);
  return TYPE_META[key] || TYPE_META.UNKNOWN;
}

module.exports = {
  getCourseTypeMeta
};
