// utils/plans.js
// 会员套餐单一真相源：membership 展示页与 pay 支付页共用，避免两处维护不同步。
// 注意：virtualProductId 必须与微信「虚拟支付」后台预置的商品 ID 完全一致。

const PLAN_LIST = [
  {
    key: 'times3',
    virtualProductId: 'es_trial_7d',
    title: '7天体验',
    amountFen: 990,
    amountText: '9.9',
    rights: 'steady',
    rightsText: '稳健版',
    desc: '9.9元 / 7天体验',
    cycleText: '7天',
    highlight: false
  },
  {
    key: 'month',
    virtualProductId: 'es_month_31d_single',
    title: '月度会员',
    amountFen: 99900,
    amountText: '999',
    rights: 'steady',
    rightsText: '稳健版',
    desc: '999元 / 月',
    cycleText: '31天',
    highlight: false
  },
  {
    key: 'quarter',
    virtualProductId: 'esquarter93dsingle',
    title: '季度会员',
    amountFen: 299900,
    amountText: '2999',
    rights: 'advanced',
    rightsText: '稳健版 + 加强版',
    desc: '2999元 / 季度',
    cycleText: '93天',
    highlight: true
  },
  {
    key: 'year',
    virtualProductId: 'es_year_372d_single',
    title: '年度会员',
    amountFen: 999900,
    amountText: '9999',
    rights: 'advanced',
    rightsText: '稳健版 + 加强版',
    desc: '9999元 / 年',
    cycleText: '372天',
    highlight: false
  }
];

function getPlanByKey(key) {
  return PLAN_LIST.find(item => item.key === key) || PLAN_LIST[0];
}

function buildOrderTitle(plan, options = {}) {
  const type = String(options.type || '').trim().toLowerCase();
  if (type === 'advanced') return `风控计算器-${plan.title}-加强版`;
  if (type === 'steady') return `风控计算器-${plan.title}-稳健版`;
  return `风控计算器-${plan.title}`;
}

module.exports = {
  PLAN_LIST,
  getPlanByKey,
  buildOrderTitle
};
