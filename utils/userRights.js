// utils/userRights.js

// 本地存储 key
const STORAGE_KEY = 'userRights'

// 默认结构（只兜底你已知字段；不会强行清掉其它字段）
const defaultRights = {
  freeCalcTimes: 0,          // 剩余完整方案次数（只用于：9.9按次、训练营/邀请奖励）
  membershipName: '',        // 当前会员名称（或训练营奖励名称）
  membershipExpireAt: 0,     // 会员到期时间戳（毫秒）
  membershipPlan: '',        // 兼容：month/quarter/year/...
  membershipProductCode: '', // 关键：VIP_TRIAL14 / VIP_MONTH / VIP_QUARTER / VIP_YEAR / VIP_ONCE3 ...
  productCode: '',           // 兼容字段
  advancedEnabled: false,    // 加强版权限开关（服务端返回为准）

  // 预留给训练营多轮使用（暂不强制使用）
  campRoundCount: 0,
  lastRewardRound: 0
}

function isPlainObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]'
}

// 深合并：保证 patch 只覆盖传入字段，不会把嵌套对象整体覆盖掉
function deepMerge(base, patch) {
  const out = Object.assign({}, base || {})
  if (!patch || !isPlainObject(patch)) return out
  Object.keys(patch).forEach((k) => {
    const pv = patch[k]
    const bv = out[k]
    if (isPlainObject(bv) && isPlainObject(pv)) {
      out[k] = deepMerge(bv, pv)
    } else {
      out[k] = pv
    }
  })
  return out
}

function toNonNegInt(v, fallback = 0) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.floor(n))
}

function toTsMs(v, fallback = 0) {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.floor(n))
}

function sanitizeRights(r) {
  const next = Object.assign({}, r || {})

  // freeCalcTimes：非负整数
  if (typeof next.freeCalcTimes !== 'undefined') {
    next.freeCalcTimes = toNonNegInt(next.freeCalcTimes, 0)
  } else {
    next.freeCalcTimes = 0
  }

  // membershipExpireAt：时间戳毫秒，非法则归零
  if (typeof next.membershipExpireAt !== 'undefined') {
    next.membershipExpireAt = toTsMs(next.membershipExpireAt, 0)
  } else {
    next.membershipExpireAt = 0
  }

  // advancedEnabled：布尔
  if (typeof next.advancedEnabled !== 'undefined') {
    next.advancedEnabled = !!next.advancedEnabled
  } else {
    next.advancedEnabled = false
  }

  return next
}

// 读取用户权益（带默认值）
function getUserRights() {
  const raw = wx.getStorageSync(STORAGE_KEY)
  if (!raw || typeof raw !== 'object') {
    return Object.assign({}, defaultRights)
  }
  // 这里保留 raw 的所有额外字段（例如 inviteCode/openid/其他扩展字段）
  return sanitizeRights(Object.assign({}, defaultRights, raw))
}

/**
 * ✅ 统一修复标准：所有写 userRights 必须“合并写入”（且深合并）
 * - patch: 只提供要更新的字段
 * - 会与已有 userRights 合并，避免覆盖丢字段（例如 inviteCode / openid 等）
 * - 会带上 defaultRights 兜底，保证必需字段存在
 * - 会对关键数值字段做兜底（freeCalcTimes >= 0 等）
 */
function mergeUserRights(patch) {
  const cur = wx.getStorageSync(STORAGE_KEY)
  const curObj = (cur && typeof cur === 'object') ? cur : {}

  // 顺序：default -> curObj -> patch（深合并）
  const merged = deepMerge(deepMerge(defaultRights, curObj), (patch && typeof patch === 'object') ? patch : {})
  const next = sanitizeRights(merged)

  wx.setStorageSync(STORAGE_KEY, next)

  // 同步到全局（如果你项目有用 globalData.userRights）
  try {
    const app = getApp && getApp()
    if (app && app.globalData) app.globalData.userRights = next
  } catch (e) {}

  return next
}

// 别名：有些页面喜欢叫 patch（可读性更强）
function patchUserRights(patch) {
  return mergeUserRights(patch)
}

// 保存（兼容旧调用：仍然可传全量，但内部也做合并，避免丢字段）
function saveUserRights(rights) {
  return mergeUserRights(rights)
}

// ---- 辅助：产品/到期/剩余天数 ----
function normalizeProductCode(rights) {
  const r = rights || getUserRights()
  const raw =
    r.productCode ||
    r.membershipProductCode ||
    r.membershipProduct ||
    ''
  return String(raw || '').toUpperCase()
}

function isNotExpired(rights) {
  const r = rights || getUserRights()
  const expireAt = Number(r.membershipExpireAt || 0)
  // expireAt=0 视为“无到期”（沿用你原逻辑）
  return !expireAt || Date.now() < expireAt
}

function getRemainingDays(rights) {
  const r = rights || getUserRights()
  const expireAt = Number(r.membershipExpireAt || 0)
  if (!expireAt) return 0
  const leftMs = expireAt - Date.now()
  if (leftMs <= 0) return 0
  return Math.ceil(leftMs / (24 * 60 * 60 * 1000))
}

function isUnlimitedProductCode(pc) {
  return (
    pc === 'VIP_TRIAL14' ||
    pc === 'VIP_MONTH' ||
    pc === 'VIP_QUARTER' ||
    pc === 'VIP_YEAR'
  )
}

function isTimesProductCode(pc) {
  return pc === 'VIP_ONCE3'
}

function isAdvancedProductCode(pc) {
  return (pc === 'VIP_QUARTER' || pc === 'VIP_YEAR')
}

function isUnlimitedMember(rights) {
  const r = rights || getUserRights()
  const pc = normalizeProductCode(r)
  return isUnlimitedProductCode(pc) && isNotExpired(r)
}

/**
 * 加强版是否允许：
 * - 未到期
 * - 且 advancedEnabled=true 或 产品=季/年 或 membershipPlan=quarter/year 或 名称含季卡/年卡
 */
function isAdvancedAllowed(rights) {
  const r = rights || getUserRights()
  if (!isNotExpired(r)) return false

  if (r.advancedEnabled === true) return true

  const pc = normalizeProductCode(r)
  if (isAdvancedProductCode(pc)) return true

  const plan = String(r.membershipPlan || '').toLowerCase()
  if (plan === 'quarter' || plan === 'year') return true

  const name = String(r.membershipName || '')
  if (name.includes('季卡') || name.includes('年卡')) return true

  return false
}

// 增加完整方案次数（统一入口：按次类/奖励类）
function addFreeCalcTimes(delta) {
  const rights = getUserRights()
  const cur = Number(rights.freeCalcTimes || 0)
  const add = Number(delta || 0)
  const next = Number.isFinite(cur + add) ? (cur + add) : cur
  return mergeUserRights({ freeCalcTimes: next })
}

/**
 * 设置会员信息（兼容旧逻辑：仅在你明确要加次数时才加）
 * options:
 *  - membershipName (必填)
 *  - days (必填)
 *  - addTimes (可选，增加次数；注意：无限制会员不要传 addTimes)
 *  - membershipPlan / membershipProductCode / productCode / advancedEnabled (可选)
 */
function setMembership(options) {
  const opt = options || {}
  const membershipName = opt.membershipName
  const days = Number(opt.days || 0)
  const addTimes = Number(opt.addTimes || 0)

  if (!membershipName || !days) return getUserRights()

  const now = Date.now()
  const expireAt = now + days * 24 * 60 * 60 * 1000

  const cur = getUserRights()
  const curTimes = Number(cur.freeCalcTimes || 0)

  const patch = {
    membershipName,
    membershipExpireAt: expireAt
  }

  if (addTimes > 0) {
    patch.freeCalcTimes = curTimes + addTimes
  }

  if (typeof opt.membershipPlan !== 'undefined') patch.membershipPlan = opt.membershipPlan
  if (typeof opt.membershipProductCode !== 'undefined') patch.membershipProductCode = opt.membershipProductCode
  if (typeof opt.productCode !== 'undefined') patch.productCode = opt.productCode
  if (typeof opt.advancedEnabled !== 'undefined') patch.advancedEnabled = !!opt.advancedEnabled

  return mergeUserRights(patch)
}

// 获取用于 UI 展示的会员标签（含剩余天数/是否无限）
function getMembershipLabel() {
  const rights = getUserRights()
  const now = Date.now()
  const { membershipName, membershipExpireAt } = rights

  let label = ''
  let expired = false

  if (membershipName) {
    if (membershipExpireAt && now > membershipExpireAt) {
      label = membershipName + '（已到期）'
      expired = true
    } else {
      label = membershipName
    }
  } else {
    label = '未开通会员'
  }

  const pc = normalizeProductCode(rights)
  const unlimited = isUnlimitedProductCode(pc) && !expired
  const remainingDays = getRemainingDays(rights)

  return {
    label,
    expired,
    unlimited,
    remainingDays,
    membershipName,
    membershipExpireAt,
    productCode: pc
  }
}

module.exports = {
  STORAGE_KEY,
  defaultRights,

  // read
  getUserRights,

  // ✅ merge-write 标准（全项目唯一写入口）
  mergeUserRights,
  patchUserRights,

  // compat
  saveUserRights,

  // helpers
  normalizeProductCode,
  isNotExpired,
  getRemainingDays,
  isUnlimitedProductCode,
  isTimesProductCode,
  isAdvancedProductCode,
  isUnlimitedMember,
  isAdvancedAllowed,

  addFreeCalcTimes,
  setMembership,
  getMembershipLabel
}
