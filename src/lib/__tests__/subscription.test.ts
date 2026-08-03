import { describe, it, expect } from 'vitest'
import {
  getEffectivePlanId, isPaidFeatureAccessible, isInGrace,
  isExpiredPaidPlan, isPremiumUser, getEffectiveTagLimit,
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
