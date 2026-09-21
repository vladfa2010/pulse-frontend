/**
 * =============================================================================
 * PULSE — Радио: тексты эфира (ТЗ-44, задача 2)
 * =============================================================================
 *
 * Порт radio-app/src/lib/scripts.ts с заменами по ТЗ-44:
 *   - reflection() → buildReflectReasoning() из ТЗ-43 (реальный reasoning из
 *     tag_impact / sentiment_reasoning, НЕ шаблонные пулы по тегам);
 *   - scorePhrase — только число «Оценка N и N из десяти» (без словесных
 *     категорий), score = 0 → фраза пропускается;
 *   - severity (критично/важно/фон) → числовые пороги score: ≥8.5 / ≥7 / иначе
 *     (severity в Pulse не существует, каскадные поля — не для этого);
 *   - item.summary → item.text, источник перепечатки — item.source.
 *
 * Структуры сегментов и реплики ведущего — 1:1 из прототипа.
 */
import type { RadioNewsItem, RadioReadMode, RadioSegment, RadioSpeaker } from '@/types/radio'

export type { RadioSegment, RadioSpeaker }

/**
 * «Оценка N и N из десяти» — число прописью для голоса (8.5 → «8 и 5»).
 * Только число, без словесных категорий (RADIO.md). score = 0 → null:
 * фразу не выдумываем (LLM-фолбэк пайплайна — не оценка).
 */
export function scorePhrase(score: number): string | null {
  if (score <= 0) return null
  return `Оценка ${String(score).replace('.', ' и ')} из десяти`
}

/* ---------- подкаст: диктор + аналитик ---------- */
// Открывающие реплики ведущего — по числовому score (бывший severity):
// ≥8.5 — «critical», ≥7 — «high», иначе «normal». Наборы фраз — 1:1 прототип.
const HOST_OPEN: Record<'critical' | 'high' | 'normal', string[]> = {
  critical: [
    'Внимание, срочная новость, наш аналитик уже на связи. Давайте по порядку.',
    'Так, это важное, прерываем обычный эфир. Что случилось?',
  ],
  high: [
    'Заметная новость, обсудим с аналитиком. Слушаем.',
    'Есть тема для разговора. Передаю слово.',
  ],
  normal: [
    'Короткая заметка из ленты. Прокомментируешь?',
    'И ещё одна новость, буквально в двух словах.',
  ],
}

const HOST_ASK = [
  'Что это меняет на практике?',
  'Хорошо. И к чему готовиться трейдеру?',
  'Понятно. А дальше что смотреть?',
]

const HOST_OUT = [
  'Принято. Следим за развитием.',
  'Спасибо. Держим в фокусе.',
  'Зафиксировали. Идём дальше.',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** числовой bucket по score (бывший severity) */
function scoreBucket(score: number): 'critical' | 'high' | 'normal' {
  if (score >= 8.5) return 'critical'
  if (score >= 7) return 'high'
  return 'normal'
}

/**
 * Строит реплики эфира для новости в заданном режиме.
 * reflectReasoning — результат buildReflectReasoning() (ТЗ-43): реальный
 * reasoning по цепочке теги юзера → чужие теги → sentiment_reasoning → дефолт.
 */
export function buildSegments(
  item: RadioNewsItem,
  mode: RadioReadMode,
  reflectReasoning: string
): RadioSegment[] {
  const core = `${item.title}. ${item.text}`
  const scoreLine = scorePhrase(item.score)
  const reprintNote = item.reprint
    ? 'Это перепечатка сюжета, который уже звучал в эфире, от источника ' + item.source + '. '
    : ''

  if (mode === 'text') {
    return [
      {
        role: 'single',
        text: `${reprintNote}${item.title}. ${item.text}${scoreLine ? ` ${scoreLine}` : ''}`,
      },
    ]
  }

  if (mode === 'reflect') {
    return [
      { role: 'single', text: `${reprintNote}${core}${scoreLine ? ` ${scoreLine}` : ''}` },
      { role: 'single', text: reflectReasoning },
    ]
  }

  // podcast
  return [
    { role: 'host', text: pick(HOST_OPEN[scoreBucket(item.score)]) },
    {
      role: 'guest',
      text: `${reprintNote}${item.title}. ${item.text}${scoreLine ? ` ${scoreLine}` : ''}`,
    },
    { role: 'host', text: pick(HOST_ASK) },
    { role: 'guest', text: reflectReasoning.replace(/^Размышление\.\s*/, '') },
    { role: 'host', text: pick(HOST_OUT) },
  ]
}
