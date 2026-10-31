import { describe, it, expect } from 'vitest'
import {
  getEffectivePlanId, isPaidFeatureAccessible, isInGrace,
  isExpiredPaidPlan, isPremiumUser, getEffectiveTagLimit, isFeatureAccessible,
} from '../subscription'

const plans = [
  { id: 'free', tagLimit: 3 },
  { id: 'base', tagLimit: 10 },
  { id: 'premium', tagLimit: 25 },
]
const customPlans = [{ id: 'free', tagLimit: 7 }, { id: 'premium', tagLimit: 25 }]

const U = (plan: string, active: boolean, grace = false): any => ({
  subscription: {
    plan, active, inGracePeriod: grace, daysLeft: 0,
    expiresAt: null, autoRenew: false, scheduledDowngrade: null,
  },
})

// ТЗ-208: хелпер U с фича-флагами плана
const UF = (plan: string, active: boolean, features?: Record<string, boolean>, grace = false): any => ({
  subscription: {
    plan, active, inGracePeriod: grace, daysLeft: 0,
    expiresAt: null, autoRenew: false, scheduledDowngrade: null,
    features,
  },
})

describe('getEffectivePlanId', () => {
  it('active premium → premium', () => expect(getEffectivePlanId(U('premium', true))).toBe('premium'))
  it('grace (active+inGrace) → premium', () => expect(getEffectivePlanId(U('premium', true, true))).toBe('premium'))
  it('TS-5: stuck premium (active=false) → free', () => expect(getEffectivePlanId(U('premium', false))).toBe('free'))
  it('no user → free', () => expect(getEffectivePlanId(null)).toBe('free'))
})

describe('grace доступ к фичам', () => {
  it('isPaidFeatureAccessible в грейсе → true', () =>
    expect(isPaidFeatureAccessible(U('premium', true, true))).toBe(true))
  it('isPaidFeatureAccessible после грейса → false', () =>
    expect(isPaidFeatureAccessible(U('premium', false))).toBe(false))
  it('isPremiumUser в грейсе → false (бейдж не голубой)', () =>
    expect(isPremiumUser(U('premium', true, true))).toBe(false))
  it('isInGrace в грейсе → true', () => expect(isInGrace(U('premium', true, true))).toBe(true))
  it('isExpiredPaidPlan для stuck → true', () => expect(isExpiredPaidPlan(U('premium', false))).toBe(true))
})

describe('isFeatureAccessible (ТЗ-208 — гейт по фича-флагу тарифа)', () => {
  it('активный с флагом factcheck → true', () =>
    expect(isFeatureAccessible(UF('premium', true, { factcheck: true }), 'factcheck')).toBe(true))
  it('активный без флага (features пустой) → false', () =>
    expect(isFeatureAccessible(UF('base', true, {}), 'factcheck')).toBe(false))
  it('активный, features не пришёл в payload (старый бэк) → false (консервативно)', () =>
    expect(isFeatureAccessible(UF('premium', true), 'factcheck')).toBe(false))
  it('free с флагом (владелец включил) → true', () =>
    expect(isFeatureAccessible(UF('free', true, { factcheck: true }), 'factcheck')).toBe(true))
  it('истёкшая подписка (active=false) с флагом → false', () =>
    expect(isFeatureAccessible(UF('premium', false, { factcheck: true }), 'factcheck')).toBe(false))
  it('грейс с флагом → true (grace-aware, как на бэке)', () =>
    expect(isFeatureAccessible(UF('premium', true, { factcheck: true }, true), 'factcheck')).toBe(true))
  it('аноним → false', () =>
    expect(isFeatureAccessible(null, 'factcheck')).toBe(false))
  it('другая фича не пересекается с factcheck', () =>
    expect(isFeatureAccessible(UF('premium', true, { ai_summary: true }), 'factcheck')).toBe(false))
})

describe('getEffectiveTagLimit — без хардкода', () => {
  it('free-лимит из каталога', () => expect(getEffectiveTagLimit(U('free', false), plans)).toBe(3))
  it('free-лимит 7 из изменённого каталога', () =>
    expect(getEffectiveTagLimit(U('free', false), customPlans)).toBe(7))
  it('TS-5: stuck premium → free-лимит каталога', () =>
    expect(getEffectiveTagLimit(U('premium', false), customPlans)).toBe(7))
  it('premium active → 25', () => expect(getEffectiveTagLimit(U('premium', true), plans)).toBe(25))
  it('grace → 25', () => expect(getEffectiveTagLimit(U('premium', true, true), plans)).toBe(25))
  it('каталог не загружен → null', () => expect(getEffectiveTagLimit(U('free', false), [])).toBeNull())
  it('аноним → null', () => expect(getEffectiveTagLimit(null, plans)).toBeNull())
})
