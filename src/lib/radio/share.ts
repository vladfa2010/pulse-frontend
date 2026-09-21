/** шеринг через системное меню, фолбэк — копирование в буфер.
 *  Порт radio-app/src/lib/share.ts; newsShareText адаптирован на Pulse-поля
 *  (text вместо summary). */

export type ShareResult = 'shared' | 'copied' | 'failed'

export async function shareText(title: string, text: string): Promise<ShareResult> {
  const url = window.location.href
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url })
      return 'shared'
    }
  } catch (e) {
    // пользователь отменил системное меню — не считаем ошибкой
    if ((e as Error).name === 'AbortError') return 'failed'
  }
  try {
    await navigator.clipboard.writeText(`${title}\n\n${text}\n${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export function newsShareText(item: { title: string; text: string; source: string; score: number }) {
  const score = item.score > 0 ? ` · оценка ${item.score}/10` : ''
  return {
    title: item.title,
    text: `${item.text}\n\nИсточник: ${item.source}${score} · via Радио PULSE`,
  }
}
