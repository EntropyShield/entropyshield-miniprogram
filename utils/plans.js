// utils/plans.js
// 会员套餐单一真相源：membership 展示页与 pay 支付页共用，避免两处维护不同步。
//
// ⚠️ 字段分工铁律（线上 /var/www/my-app/index.js 实测，勿互换）：
//   key              = 后端产品码，必须 ∈ 线上三处白名单：
//                      行323 __officialAmountMap（定价）/ 行338 allowlist / 行855 computeGrant（发权益）
//                      当前合法值：times3 | month | quarter | year
//                      改 key 或新增套餐前，必须先让后端在三处同步加码，否则用户付款后权益发不出。
//   virtualProductId = 微信「虚拟支付」后台预置商品 ID，只用于虚拟支付通道，后端不认。
//   amountFen        = 单位「分」，必须与后端 __officialAmountMap 中该 key 的定价一致。
// 支付页 pages/pay/index.js 的 onPayPhysical 传 productCode 时用 plan.key，不是 virtualProductId。
// [熵盾 V2.1 · 技能:双通道支付] goodsType 区分虚拟(走虚拟支付)/实物(走常规微信支付)

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

// 双通道：实物商品走常规微信支付，其余走微信虚拟支付
function getPayChannel(plan) {
  return plan && plan.goodsType === 'physical' ? 'physical' : 'virtual';
}

// 双通道归一：未显式标 physical 的套餐一律按虚拟（走微信虚拟支付）
PLAN_LIST.forEach((p) => {
  if (!p.goodsType) p.goodsType = 'virtual';
});

module.exports = {
  PLAN_LIST,
  getPlanByKey,
  buildOrderTitle,
  getPayChannel
};
