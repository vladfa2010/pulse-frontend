/**
 * =============================================================================
 * PULSE Frontend — Third-party script loader
 * =============================================================================
 *
 * Ленивая загрузка внешних скриптов (Telegram Login Widget, Yandex.Metrika и др.)
 * с защитой от зависания: если домен заблокирован/недоступен, промис режет
 * по таймауту, не блокируя событие window.load.
 */

const loadCache = new Map<string, Promise<void>>()

export function loadScript(src: string, timeoutMs = 10_000): Promise<void> {
  const cached = loadCache.get(src)
  if (cached) return cached

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.src = src

    const timeoutId = setTimeout(() => {
      cleanup()
      script.remove()
      reject(new Error(`Script load timeout: ${src}`))
    }, timeoutMs)

    const onLoad = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      script.remove()
      reject(new Error(`Failed to load script: ${src}`))
    }

    const cleanup = () => {
      clearTimeout(timeoutId)
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
    }

    script.addEventListener('load', onLoad)
    script.addEventListener('error', onError)

    document.head.appendChild(script)
  })

  loadCache.set(src, promise)
  return promise
}

/** Загрузка Telegram Login Widget (telegram.org). */
export function loadTelegramLoginWidget(timeoutMs = 10_000): Promise<void> {
  return loadScript('https://telegram.org/js/telegram-widget.js', timeoutMs)
}

/** Инициализация Yandex.Metrika с отложенным запуском после window.load. */
export function initYandexMetrika(counterId: number, timeoutMs = 10_000): void {
  if (typeof window === 'undefined') return

  // Инициализируем очередь вызовов заранее, чтобы хиты не терялись.
  // Стандартный сниппет Metrika: m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)}; m[i].l=Date.now();
  const w = window as any
  w.ym = w.ym || function () { (w.ym.a = w.ym.a || []).push(arguments) }
  w.ym.l = Date.now()

  // Инициализируем счётчик сразу — вызовы до загрузки tag.js накапливаются в очереди.
  w.ym(counterId, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: true })

  const run = () => {
    loadScript('https://mc.yandex.ru/metrika/tag.js', timeoutMs).catch(() => {
      // Метрика не критична; падаем тихо, чтобы не ломать пользовательский опыт.
    })
  }

  // Сначала ждём window.load, затем откладываем инициализацию, чтобы не влиять на LCP/TTFB.
  if (document.readyState === 'complete') {
    scheduleIdle(run, 2000)
  } else {
    window.addEventListener('load', () => scheduleIdle(run, 2000), { once: true })
  }
}

function scheduleIdle(callback: () => void, fallbackDelayMs: number): void {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(callback, { timeout: fallbackDelayMs })
  } else {
    setTimeout(callback, fallbackDelayMs)
  }
}
