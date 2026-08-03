/**
 * PULSE — Subscription helpers (frontend)
 *
 * Единая точка для вычисления effective-тарифа и проверки прав.
 * Все компоненты должны использовать эти функции вместо прямого чтения
 * user.subscription.plan / user.subscription.active.
 *
 * Канон жизненного цикла подписки:
 *   pulse/PRODUCT_CONTEXT.md → раздел «Тарифы и жизненный цикл подписки»
 */

import type { User } from '@/hooks/useAuth'

export interface PlanRef {
  id: string
  tagLimit: number
  name?: string
}

export function getEffectivePlanId(user?: User | null): string {
  const sub = user?.subscription
  if (!sub) return 'free'
  // effective plan = план только при активной подписке (в грейсе active === true)
  return sub.active ? (sub.plan || 'free') : 'free'
}

export function isPaidPlan(user?: User | null): boolean {
  return getEffectivePlanId(user) !== 'free'
}

export function isPaidFeatureAccessible(user?: User | null): boolean {
  const sub = user?.subscription
  return !!sub?.active && sub.plan !== 'free'
}

export function isPremiumUser(user?: User | null): boolean {
  const sub = user?.subscription
  return !!sub?.active && !sub.inGracePeriod && sub.plan !== 'free'
}

export function isInGrace(user?: User | null): boolean {
  const sub = user?.subscription
  return !!sub?.active && !!sub?.inGracePeriod
}

export function isExpiredPaidPlan(user?: User | null): boolean {
  const sub = user?.subscription
  return (
    !sub?.active &&
    !sub?.inGracePeriod &&
    !!sub?.plan &&
    sub.plan !== 'free'
  )
}

/**
 * Возвращает effective-лимит тегов из каталога планов.
 * @param plans — список планов (минимум id + tagLimit). Если каталог не загружен,
 *   возвращает null, чтобы вызывающий код не принимал решения на хардкоде.
 */
export function getEffectiveTagLimit(
  user?: User | null,
  plans?: PlanRef[] | null
): number | null {
  if (!user) return null

  const freePlan = plans?.find(p => p.id === 'free')
  const planId = getEffectivePlanId(user)

  if (planId === 'free') {
    if (!freePlan) {
      if (import.meta.env.DEV) {
        console.warn('[subscription] getEffectiveTagLimit: free plan not found in catalog, returning null')
      }
      return null
    }
    return freePlan.tagLimit
  }

  const plan = plans?.find(p => p.id === planId)
  if (!plan) {
    if (import.meta.env.DEV) {
      console.warn(`[subscription] getEffectiveTagLimit: plan "${planId}" not in catalog, falling back to free limit`)
    }
    return freePlan?.tagLimit ?? null
  }

  return plan.tagLimit
}

/** Бейдж для профиля/тарифов: текущий план + грейс, если активен. */
export function getSubscriptionBadge(user?: User | null): string {
  const sub = user?.subscription
  const plan = sub?.plan || 'free'
  if (isInGrace(user)) {
    return `${plan} · грейс ${sub?.daysLeft ?? 0} дн.`
  }
  return plan
}
