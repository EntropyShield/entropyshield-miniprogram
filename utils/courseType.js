// utils/courseType.js
// 统一维护课程类型 & 不同类型对应的标签样式 + 行为映射

// 课程类型枚举
const COURSE_TYPES = {
  PUBLIC: 'PUBLIC',          // 公开课
  EXPERIENCE: 'EXPERIENCE',  // 体验课（围绕风控计算器）
  RISK: 'RISK',              // 风控课 / 盈利系统课
  SALON: 'SALON',            // 线下沙龙
  CONTROLLER: 'CONTROLLER'   // 成为控局者 / 高阶系统课
};

// 各类型的元数据：名称、标签、默认 CTA 文案、行为类型
// actionType 说明：
// - GO_CAMP      → 跳转 7 天风控训练营 campIntro
// - GO_CALC      → 跳转风控计算器首页 riskCalculator
// - GO_VISIT     → 跳转公司来访预约页 visitBooking
// - GO_PAY_INTRO → 跳转收费方案 / 成为控局者路径
// - GO_DETAIL    → 仅看详情或加入课程进度（默认）
//
// 具体跳转逻辑由页面里的 switch 统一处理。
const COURSE_TYPE_META = {
  [COURSE_TYPES.PUBLIC]: {
    type: COURSE_TYPES.PUBLIC,
    name: '公开课',
    shortTag: '公开课',
    tagClass: 'tag-public', // 具体样式在 wxss 里定义
    desc: '免费公开课，用于认知破冰与初步筛选。',
    actionType: 'GO_CAMP',
    actionButtonText: '进入 7 天训练营'
  },
  [COURSE_TYPES.EXPERIENCE]: {
    type: COURSE_TYPES.EXPERIENCE,
    name: '体验课',
    shortTag: '体验课',
    tagClass: 'tag-experience',
    desc: '围绕风控计算器的实战体验课。',
    actionType: 'GO_CALC',
    actionButtonText: '立即使用风控计算器'
  },
  [COURSE_TYPES.RISK]: {
    type: COURSE_TYPES.RISK,
    name: '风控课',
    shortTag: '风控课',
    tagClass: 'tag-risk',
    desc: '系统搭建盈利系统与风控体系的核心课程。',
    actionType: 'GO_CALC',
    actionButtonText: '用风控计算器实战'
  },
  [COURSE_TYPES.SALON]: {
    type: COURSE_TYPES.SALON,
    name: '线下沙龙',
    shortTag: '线下沙龙',
    tagClass: 'tag-salon',
    desc: '线下深度交流、诊断账户、建立信任。',
    actionType: 'GO_VISIT',
    actionButtonText: '预约到访'
  },
  [COURSE_TYPES.CONTROLLER]: {
    type: COURSE_TYPES.CONTROLLER,
    name: '成为控局者',
    shortTag: '成为控局者',
    tagClass: 'tag-controller',
    desc: '高阶控局者系统课，连接收费方案与合伙人路径。',
    actionType: 'GO_PAY_INTRO',
    actionButtonText: '成为控局者'
  }
};

// 默认元数据（兜底）
const DEFAULT_META = {
  type: 'UNKNOWN',
  name: '课程',
  shortTag: '课程',
  tagClass: 'tag-default',
  desc: '',
  actionType: 'GO_DETAIL',
  actionButtonText: '查看详情'
};

// 根据 type 拿一条完整配置
function getCourseTypeMeta(type) {
  if (!type) return DEFAULT_META;
  const key = String(type).toUpperCase();
  return COURSE_TYPE_META[key] || DEFAULT_META;
}

// 单独抽一份“行为配置”，方便页面里使用
function getCourseActionMeta(type) {
  const meta = getCourseTypeMeta(type);
  return {
    actionType: meta.actionType,
    actionButtonText: meta.actionButtonText
  };
}

module.exports = {
  COURSE_TYPES,
  COURSE_TYPE_META,
  getCourseTypeMeta,
  getCourseActionMeta
};
