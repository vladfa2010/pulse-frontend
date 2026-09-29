/**
 * PULSE — Радио: cross-tab синхронизация radio-flags (TZ-73 S-5).
 *
 * Админ меняет флаг в табе A (например /admin), юзер с открытым /radio в табе B
 * должен подхватить изменение раньше, чем истечёт staleTime (5 мин) кэша
 * useRadioConfig. Минимальное решение без бэкенда: localStorage 'storage'-событие
 * (стреляет в ДРУГИХ табах того же браузера) + CustomEvent для текущего таба.
 *
 * Полноценная замена — SSE flags-changed (TZ-72 P1-1); когда появится, этот
 * модуль можно оставить как мгновенный локальный слой (SSE + localStorage
 * не мешают друг другу: оба валидируют один и тот же query-кэш).
 *
 * Edge case: private mode — localStorage.setItem бросает, глотаем в try/catch.
 */
import { useEffect } from 'react'

const KEY = 'pulse_radio_flags_changetag'
const EVENT = 'pulse_radio_flags_changed'

/** Вызывается после PUT /api/admin/radio-flags (admin RadioTab/VoicePicker). */
export function broadcastRadioFlagsChange(): void {
  try {
    localStorage.setItem(KEY, String(Date.now()))
  } catch {
    // private mode — storage-событие не доставится, CustomEvent доставим ниже
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    // не критично
  }
}

/** Подписка на изменения флагов из другого таба/места. handler — стабильный callback. */
export function useRadioFlagsChange(handler: () => void): void {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) handler()
    }
    const onLocal = () => handler()
    window.addEventListener('storage', onStorage)
    window.addEventListener(EVENT, onLocal)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(EVENT, onLocal)
    }
  }, [handler])
}
