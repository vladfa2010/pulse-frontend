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
  return user?.subscription?.plan || 'free'
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
 * Возвращает effective-лимит тегов.
 * @param plans — список планов (минимум id + tagLimit). Если не передан,
 *   и effective-план не free, в dev-режиме пишем warn, т.к. UI может показать
 *   неверный лимит.
 */
export function getEffectiveTagLimit(
  user?: User | null,
  plans?: PlanRef[] | null
): number {
  if (!user) return 3

  const planId = getEffectivePlanId(user)
  if (planId === 'free') return 3

  if (!plans || plans.length === 0) {
    if (import.meta.env.DEV) {
      console.warn(
        '[subscription] getEffectiveTagLimit: plan list is empty, falling back to 3. ' +
          'Pass plans from /api/plans to get the real limit.'
      )
    }
    return 3
  }

  const plan = plans.find(p => p.id === planId)
  if (!plan) {
    if (import.meta.env.DEV) {
      console.warn(
        `[subscription] getEffectiveTagLimit: plan "${planId}" not found in provided list, falling back to 3`
      )
    }
    return 3
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
