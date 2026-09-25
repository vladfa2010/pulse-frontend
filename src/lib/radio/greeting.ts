/** приветствие по времени суток — радио знает, когда юзер пришёл.
 *  Порт radio-app/src/lib/greeting.ts без правок (ТЗ-44, задача 2). */

export function timeOfDay(d = new Date()): 'night' | 'morning' | 'day' | 'evening' {
  const h = d.getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 18) return 'day'
  if (h >= 18 && h < 24) return 'evening'
  return 'night'
}

const HELLO: Record<string, string> = {
  morning: 'Доброе утро',
  day: 'Добрый день',
  evening: 'Добрый вечер',
  night: 'Доброй ночи',
}

const DAY_WORD: Record<string, string> = {
  morning: 'утро',
  day: 'день',
  evening: 'вечер',
  night: 'ночь',
}

const DOW = [
  'воскресенье',
  'понедельник',
  'вторник',
  'среда',
  'четверг',
  'пятница',
  'суббота',
]

const MOOD: Record<string, string[]> = {
  morning: [
    'Пока вы пили кофе, лента не спала.',
    'Рынки уже проснулись — давайте наверстаем.',
  ],
  day: ['Середина дня — самое время свериться с лентой.', 'Дневная смена эфира на месте.'],
  evening: [
    'Подводим итоги дня — собрал для вас главное.',
    'Вечерний эфир: пока вы были заняты, новости копились.',
  ],
  night: [
    'Ночной эфир — для тех, кто следит за рынками без пауз.',
    'Ночью лента тише, но важное всё равно случается.',
  ],
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** одно слово приветствия для вставки в реплики */
export function helloWord(d = new Date()): string {
  return HELLO[timeOfDay(d)]
}

/** короткое приветствие для шапки */
export function greetingShort(d = new Date()): string {
  return `${DAY_WORD[timeOfDay(d)]} · ${DOW[d.getDay()]}`
}

/** голосовое приветствие при запуске эфира */
export function buildGreeting(unreadCount: number, d = new Date()): string {
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  // ТЗ-62: «ПУЛЬС» кириллицей — TTS читает как русское слово; латиница PULSE
  // уезжала в англо-подобное прочтение.
  const hello = `${HELLO[timeOfDay(d)]}! С вами радио ПУЛЬС. Сегодня ${DOW[d.getDay()]}, на часах ${time}.`
  const mood = pick(MOOD[timeOfDay(d)])
  // ТЗ-62: при 0 непрочитанных эфир всё равно полезен (саммари, персональное,
  // календарь) — фраза перекидывает мост к диалогу о сводке рынка.
  const state =
    unreadCount > 0
      ? `У вас ${unreadCount} непрочитанных. Начну с самого важного.`
      : 'Нового для вас пока нет — можно расслабиться. Но мы обсудим, что происходит в мире.'
  return `${hello} ${mood} ${state}`
}
