import { useState } from 'react'
import { Btn, C, Field, IconBtn, inputBlur, inputCls, inputFocus, inputStyle } from './ui'
import type { LessonTest, TestQuestion } from './types'

// Редактор теста урока (ТЗ-101): 1..20 вопросов, 2..6 вариантов, радио «правильный»,
// проходной балл %, чекбокс «Блокировать дальнейшее прохождение».
// Валидации дублируют бэкенд (PUT /lessons/:id/test → 400).

export default function TestEditor({
  initial,
  onSave,
  onDelete,
  onCancel,
  busy,
  toast,
}: {
  initial: LessonTest | null
  onSave: (data: { pass_score: number; is_blocking: boolean; questions: TestQuestion[] }) => void
  onDelete: () => void
  onCancel: () => void
  busy: boolean
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
}) {
  const [questions, setQuestions] = useState<TestQuestion[]>(
    initial?.questions?.length
      ? initial.questions.map(q => ({ q: q.q, options: [...q.options], correct: q.correct }))
      : [{ q: '', options: ['', ''], correct: 0 }],
  )
  const [passScore, setPassScore] = useState(String(initial?.pass_score ?? 70))
  const [isBlocking, setIsBlocking] = useState(initial?.is_blocking ?? false)

  const setQ = (i: number, patch: Partial<TestQuestion>) => {
    setQuestions(prev => prev.map((q, idx) => (idx === i ? { ...q, ...patch } : q)))
  }

  const setOption = (qi: number, oi: number, value: string) => {
    setQuestions(prev =>
      prev.map((q, idx) =>
        idx === qi ? { ...q, options: q.options.map((o, j) => (j === oi ? value : o)) } : q,
      ),
    )
  }

  const addOption = (qi: number) => {
    const q = questions[qi]
    if (q.options.length >= 6) return
    setQ(qi, { options: [...q.options, ''] })
  }

  const removeOption = (qi: number, oi: number) => {
    const q = questions[qi]
    if (q.options.length <= 2) return
    const options = q.options.filter((_, j) => j !== oi)
    setQ(qi, {
      options,
      correct: q.correct >= options.length ? 0 : q.correct > oi ? q.correct - 1 : q.correct,
    })
  }

  const validate = (): { pass_score: number; is_blocking: boolean; questions: TestQuestion[] } | string => {
    const ps = parseInt(passScore, 10)
    if (!Number.isInteger(ps) || ps < 1 || ps > 100) return 'Проходной балл — целое число 1..100'
    if (questions.length < 1 || questions.length > 20) return 'Вопросов должно быть от 1 до 20'
    const cleaned: TestQuestion[] = []
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      const text = q.q.trim()
      if (!text) return `У вопроса ${i + 1} нет текста`
      const options = q.options.map(o => o.trim())
      if (options.some(o => !o)) return `У вопроса ${i + 1} есть пустой вариант ответа`
      if (options.length < 2 || options.length > 6) return `У вопроса ${i + 1} должно быть 2..6 вариантов`
      if (q.correct < 0 || q.correct >= options.length) return `У вопроса ${i + 1} не отмечен правильный ответ`
      cleaned.push({ q: text, options, correct: q.correct })
    }
    return { pass_score: ps, is_blocking: isBlocking, questions: cleaned }
  }

  const handleSave = () => {
    const result = validate()
    if (typeof result === 'string') {
      toast(result, 'error')
      return
    }
    onSave(result)
  }

  return (
    <div
      style={{
        background: '#0a0a0a',
        border: `1px dashed ${C.border}`,
        borderRadius: '.5rem',
        padding: 16,
        marginTop: 12,
      }}
    >
      {questions.map((q, qi) => (
        <div key={qi} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: C.textMuted,
              }}
            >
              Вопрос {qi + 1}
            </label>
            {questions.length > 1 && (
              <IconBtn title="Удалить вопрос" danger onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qi))}>
                ✕
              </IconBtn>
            )}
          </div>
          <input
            type="text"
            value={q.q}
            onChange={e => setQ(qi, { q: e.target.value })}
            placeholder="Текст вопроса"
            className={inputCls}
            style={inputStyle}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 10, alignItems: 'center' }}>
            {q.options.map((o, oi) => (
              <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, gridColumn: '1 / -1' }}>
                <input
                  type="radio"
                  name={`correct-${qi}`}
                  title="Правильный ответ"
                  checked={q.correct === oi}
                  onChange={() => setQ(qi, { correct: oi })}
                  style={{ flex: 'none' }}
                />
                <input
                  type="text"
                  value={o}
                  onChange={e => setOption(qi, oi, e.target.value)}
                  placeholder={`Вариант ${oi + 1}`}
                  className={inputCls}
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
                {q.options.length > 2 && (
                  <IconBtn title="Убрать вариант" danger onClick={() => removeOption(qi, oi)}>
                    ✕
                  </IconBtn>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            {q.options.length < 6 && (
              <Btn sm onClick={() => addOption(qi)}>
                + Вариант
              </Btn>
            )}
            <span style={{ fontSize: 11, color: C.textMuted }}>
              Радио отмечает правильный ответ · вариантов 2..6
            </span>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {questions.length < 20 && (
          <Btn sm onClick={() => setQuestions(prev => [...prev, { q: '', options: ['', ''], correct: 0 }])}>
            + Вопрос
          </Btn>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <Field label="Проходной балл, %" hint="Целое 1..100.">
          <input
            type="number"
            value={passScore}
            min={1}
            max={100}
            onChange={e => setPassScore(e.target.value)}
            className={inputCls}
            style={inputStyle}
            onFocus={inputFocus}
            onBlur={inputBlur}
          />
        </Field>
        <Field label="Блокировка">
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 600,
              color: C.textPrimary,
              cursor: 'pointer',
              padding: '10px 0',
            }}
          >
            <input type="checkbox" checked={isBlocking} onChange={e => setIsBlocking(e.target.checked)} />
            Блокировать дальнейшее прохождение
          </label>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
            Не пройден тест — следующие уроки закрыты.
          </div>
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn variant="accent" sm disabled={busy} onClick={handleSave}>
          {busy ? 'Сохраняем…' : 'Сохранить тест'}
        </Btn>
        {initial && (
          <Btn variant="danger" sm disabled={busy} onClick={onDelete}>
            Удалить тест
          </Btn>
        )}
        <Btn sm disabled={busy} onClick={onCancel}>
          Отмена
        </Btn>
      </div>
    </div>
  )
}
