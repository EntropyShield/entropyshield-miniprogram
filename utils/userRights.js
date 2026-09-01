// utils/userRights.js

const STORAGE_KEY = 'userRights'

const defaultRights = {
  freeCalcTimes: 0,          // 任务奖励次数：只用于 任务奖励 / 训练营奖励 / 邀请奖励
  membershipName: '',        // 当前会员名称
  membershipExpireAt: 0,     // 会员到期时间戳（毫秒）
  membershipPlan: '',        // trial3 / month / quarter / year / lifetime
  membershipProductCode: '', // VIP_ONCE3 / VIP_MONTH / VIP_QUARTER / VIP_YEAR / LIFETIME
  productCode: '',           // 兼容字段
  membershipLevel: '',       // LIFETIME / VIP_YEAR / VIP_QUARTER / VIP_MONTH ...
  advancedEnabled: false,    // 加强版权限开关（服务端返回为准）

  campRoundCount: 0,
  lastRewardRound: 0
}

function isPlainObject(obj) {
  return Object.prototype.toString.call(obj) === '[object Object]'
}

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
  if (v === null || typeof v === 'undefined' || v === '') return fallback

  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return fallback
    if (v > 1e12) return Math.max(0, Math.floor(v))       // ms
    if (v > 1e9) return Math.max(0, Math.floor(v * 1000)) // sec
    return Math.max(0, Math.floor(v))
  }

  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return fallback

    if (/^\d+$/.test(s)) {
      const n = Number(s)
      if (!Number.isFinite(n)) return fallback
      if (n > 1e12) return Math.max(0, Math.floor(n))
      if (n > 1e9) return Math.max(0, Math.floor(n * 1000))
      return Math.max(0, Math.floor(n))
    }

    const normalized = s.replace(' ', 'T')
    const t = Date.parse(normalized)
    if (Number.isFinite(t)) return Math.max(0, Math.floor(t))
  }

  return fallback
}

function sanitizeRights(r) {
  const next = Object.assign({}, r || {})

  next.freeCalcTimes = toNonNegInt(next.freeCalcTimes, 0)
  next.membershipExpireAt = toTsMs(next.membershipExpireAt, 0)
  next.advancedEnabled = !!next.advancedEnabled
  next.membershipName = String(next.membershipName || '')
  next.membershipPlan = String(next.membershipPlan || '')
  next.membershipProductCode = String(next.membershipProductCode || '')
  next.productCode = String(next.productCode || '')
  next.membershipLevel = String(next.membershipLevel || '')

  return next
}

function isLifetimeRights(rights) {
  const r = rights || {}
  const level = String(r.membershipLevel || '').toUpperCase()
  const name = String(r.membershipName || '')
  const productCode = String(r.productCode || r.membershipProductCode || '').toUpperCase()
  return level === 'LIFETIME' || name === '终身会员' || productCode === 'LIFETIME'
}

function normalizePlanValue(v) {
  const s = String(v || '').trim().toLowerCase()

  if (!s) return ''
  if (s === 'trial3' || s === 'times3' || s === 'vip_once3' || s === 'once3') return 'trial3'
  if (s === 'month' || s === 'vip_month') return 'month'
  if (s === 'quarter' || s === 'vip_quarter') return 'quarter'
  if (s === 'year' || s === 'vip_year') return 'year'
  if (s === 'lifetime') return 'lifetime'

  return s
}

function normalizeProductCode(rights) {
  const r = rights || getUserRights()

  if (isLifetimeRights(r)) return 'LIFETIME'

  const raw =
    r.productCode ||
    r.membershipProductCode ||
    r.membershipProduct ||
    r.membershipPlan ||
    ''

  const plan = normalizePlanValue(raw)
  if (plan === 'trial3') return 'VIP_ONCE3'
  if (plan === 'month') return 'VIP_MONTH'
  if (plan === 'quarter') return 'VIP_QUARTER'
  if (plan === 'year') return 'VIP_YEAR'
  if (plan === 'lifetime') return 'LIFETIME'

  const name = String(r.membershipName || '')
  if (name.includes('终身')) return 'LIFETIME'
  if (name.includes('体验') || name.includes('7天') || name.includes('3天') || name.includes('9.9')) return 'VIP_ONCE3'
  if (name.includes('年卡') || name.includes('年度') || name.includes('年会员')) return 'VIP_YEAR'
  if (name.includes('季卡') || name.includes('季度') || name.includes('季会员')) return 'VIP_QUARTER'
  if (name.includes('月卡') || name.includes('月会员')) return 'VIP_MONTH'

  return String(raw || '').trim().toUpperCase()
}

function getMembershipTier(rights) {
  const r = rights || getUserRights()

  if (isLifetimeRights(r)) return 'lifetime'

  const pc = normalizeProductCode(r)
  if (pc === 'VIP_ONCE3') return 'trial3'
  if (pc === 'VIP_MONTH') return 'month'
  if (pc === 'VIP_QUARTER') return 'quarter'
  if (pc === 'VIP_YEAR') return 'year'

  const plan = normalizePlanValue(r.membershipPlan)
  if (plan === 'trial3' || plan === 'month' || plan === 'quarter' || plan === 'year' || plan === 'lifetime') {
    return plan
  }

  const name = String(r.membershipName || '')
  if (name.includes('终身')) return 'lifetime'
  if (name.includes('体验') || name.includes('7天') || name.includes('3天') || name.includes('9.9')) return 'trial3'
  if (name.includes('年卡') || name.includes('年度') || name.includes('年会员')) return 'year'
  if (name.includes('季卡') || name.includes('季度') || name.includes('季会员')) return 'quarter'
  if (name.includes('月卡') || name.includes('月会员')) return 'month'

  return ''
}

function isNotExpired(rights) {
  if (isLifetimeRights(rights)) return true
  const r = rights || getUserRights()
  const expireAt = toTsMs(r.membershipExpireAt, 0)
  return !expireAt || Date.now() < expireAt
}

function getRemainingDays(rights) {
  const r = rights || getUserRights()
  const expireAt = toTsMs(r.membershipExpireAt, 0)
  if (!expireAt) return 0
  const leftMs = expireAt - Date.now()
  if (leftMs <= 0) return 0
  return Math.ceil(leftMs / (24 * 60 * 60 * 1000))
}

function isTimesProductCode(pc) {
  return false
}

function isMemberProductCode(pc) {
  const code = String(pc || '').toUpperCase()
  return code === 'VIP_ONCE3' || code === 'VIP_MONTH' || code === 'VIP_QUARTER' || code === 'VIP_YEAR'
}

function isAdvancedProductCode(pc) {
  const code = String(pc || '').toUpperCase()
  return code === 'VIP_QUARTER' || code === 'VIP_YEAR' || code === 'LIFETIME'
}

function isUnlimitedProductCode(pc) {
  const code = String(pc || '').toUpperCase()
  return code === 'LIFETIME'
}

function isUnlimitedMember(rights) {
  return isLifetimeRights(rights || getUserRights())
}

function hasRewardTimes(rights) {
  const r = rights || getUserRights()
  return (Number(r.freeCalcTimes || 0) || 0) > 0
}

function hasActiveMembership(rights) {
  const r = rights || getUserRights()
  const tier = getMembershipTier(r)
  if (!tier) return false
  if (tier === 'lifetime') return true
  return isNotExpired(r)
}

function canUseSteadyByMembership(rights) {
  return hasActiveMembership(rights)
}

function canUseAdvancedByMembership(rights) {
  const r = rights || getUserRights()
  const tier = getMembershipTier(r)

  if (!tier) return false
  if (tier === 'lifetime') return true
  if (!isNotExpired(r)) return false

  if (r.advancedEnabled === true) return true
  if (tier === 'quarter' || tier === 'year') return true

  const pc = normalizeProductCode(r)
  if (isAdvancedProductCode(pc)) return true

  return false
}

function getUserRights() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    const cur = (raw && typeof raw === 'object') ? raw : {}
    const next = sanitizeRights(Object.assign({}, defaultRights, cur))

    if (isLifetimeRights(next)) {
      next.membershipLevel = 'LIFETIME'
      next.membershipName = '终身会员'
      next.advancedEnabled = true
      if (!next.membershipPlan) next.membershipPlan = 'year'
      if (!next.productCode) next.productCode = 'LIFETIME'
      if (!next.membershipProductCode) next.membershipProductCode = 'LIFETIME'
      wx.setStorageSync(STORAGE_KEY, next)
    }

    return next
  } catch (e) {
    return Object.assign({}, defaultRights)
  }
}

function mergeUserRights(patch) {
  const cur = getUserRights()
  const merged = deepMerge(cur, (patch && typeof patch === 'object') ? patch : {})
  const next = sanitizeRights(merged)

  if (isLifetimeRights(next)) {
    next.membershipLevel = 'LIFETIME'
    next.membershipName = '终身会员'
    next.advancedEnabled = true
    if (!next.membershipPlan) next.membershipPlan = 'year'
    if (!next.productCode) next.productCode = 'LIFETIME'
    if (!next.membershipProductCode) next.membershipProductCode = 'LIFETIME'
  }

  wx.setStorageSync(STORAGE_KEY, next)

  try {
    const app = getApp && getApp()
    if (app && app.globalData) app.globalData.userRights = next
  } catch (e) {}

  return next
}

function patchUserRights(patch) {
  return mergeUserRights(patch)
}

function saveUserRights(rights) {
  return mergeUserRights(rights)
}

function canUseSteady(rights) {
  return canUseSteadyByMembership(rights) || hasRewardTimes(rights)
}

function canUseAdvanced(rights) {
  return canUseAdvancedByMembership(rights)
}

function isAdvancedAllowed(rights) {
  return canUseAdvancedByMembership(rights)
}

function addFreeCalcTimes(delta) {
  const rights = getUserRights()
  const cur = Number(rights.freeCalcTimes || 0) || 0
  const add = Number(delta || 0) || 0
  const next = Math.max(0, cur + add)
  return mergeUserRights({ freeCalcTimes: next })
}

function setMembership(options) {
  const opt = options || {}
  const membershipName = String(opt.membershipName || '').trim()
  const days = Number(opt.days || 0)

  if (!membershipName || !days) return getUserRights()

  const now = Date.now()
  const expireAt = now + days * 24 * 60 * 60 * 1000

  const patch = {
    membershipName,
    membershipExpireAt: expireAt
  }

  if (typeof opt.membershipPlan !== 'undefined') patch.membershipPlan = opt.membershipPlan
  if (typeof opt.membershipProductCode !== 'undefined') patch.membershipProductCode = opt.membershipProductCode
  if (typeof opt.productCode !== 'undefined') patch.productCode = opt.productCode
  if (typeof opt.membershipLevel !== 'undefined') patch.membershipLevel = opt.membershipLevel
  if (typeof opt.advancedEnabled !== 'undefined') patch.advancedEnabled = !!opt.advancedEnabled

  return mergeUserRights(patch)
}

function getDefaultMembershipNameByTier(tier) {
  if (tier === 'trial3') return '9.9体验·7天'
  if (tier === 'month') return '控局者·月卡'
  if (tier === 'quarter') return '控局者·季卡'
  if (tier === 'year') return '控局者·年卡'
  if (tier === 'lifetime') return '终身会员'
  return ''
}

function getMembershipLabel() {
  const rights = getUserRights()
  const tier = getMembershipTier(rights)

  if (tier === 'lifetime') {
    return {
      label: '终身会员',
      expired: false,
      unlimited: true,
      remainingDays: 0,
      membershipName: '终身会员',
      membershipExpireAt: 0,
      productCode: 'LIFETIME'
    }
  }

  const membershipName = String(rights.membershipName || '').trim() || getDefaultMembershipNameByTier(tier)
  const expireAt = toTsMs(rights.membershipExpireAt, 0)
  const expired = !!expireAt && Date.now() > expireAt
  const remainingDays = getRemainingDays(rights)

  let label = membershipName || '未开通会员'
  if (membershipName && expired) {
    label = membershipName + '（已到期）'
  } else if (membershipName && remainingDays > 0 && tier) {
    label = `${membershipName}（剩余${remainingDays}天）`
  }

  return {
    label,
    expired,
    unlimited: false,
    remainingDays,
    membershipName,
    membershipExpireAt: expireAt,
    productCode: normalizeProductCode(rights)
  }
}

module.exports = {
  STORAGE_KEY,
  defaultRights,

  getUserRights,
  mergeUserRights,
  patchUserRights,
  saveUserRights,

  normalizeProductCode,
  getMembershipTier,
  isNotExpired,
  getRemainingDays,
  isUnlimitedProductCode,
  isTimesProductCode,
  isMemberProductCode,
  isAdvancedProductCode,
  isUnlimitedMember,

  hasRewardTimes,
  hasActiveMembership,
  canUseSteadyByMembership,
  canUseAdvancedByMembership,
  canUseSteady,
  canUseAdvanced,
  isAdvancedAllowed,

  addFreeCalcTimes,
  setMembership,
  getMembershipLabel
}