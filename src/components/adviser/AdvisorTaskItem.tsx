import { useEffect, useState } from 'react'
import { Bell, BellOff, Calendar, Check, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { downloadTaskIcs } from './adviserActions'
import {
  formatMskDateTime,
  formatTaskDate,
  reminderPresetIso,
  type AdvisorTask,
} from './adviserTypes'

/**
 * ТЗ-183 v6 Задача 6 — строка задачи: чекбокс (оптимистичный PATCH is_done),
 * колокольчик (поповер напоминания: пресеты 09:00 мск от due_date, каналы
 * telegram/email) и иконка календаря (скачивание .ics через fetch + Blob).
 * Используется и в чек-листе карточки клиента, и в блоке «Мои задачи».
 */

const popoverStyle: React.CSSProperties = {
  background: '#141414',
  border: '1px solid #222',
  boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
}

function ChannelCheckbox({
  label,
  checked,
  disabled,
  disabledHint,
  onToggle,
}: {
  label: string
  checked: boolean
  disabled?: boolean
  disabledHint?: string
  onToggle: () => void
}) {
  return (
    <label
      className={`flex items-center gap-2 text-[12px] ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{ color: '#9CA3AF' }}
      title={disabled ? disabledHint : undefined}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="accent-[#00D4FF]"
      />
      {label}
      {disabled && disabledHint && <span className="text-[10px]" style={{ color: '#6B7280' }}>({disabledHint})</span>}
    </label>
  )
}

export default function AdvisorTaskItem({
  task,
  telegramLinked,
  onChanged,
}: {
  task: AdvisorTask
  telegramLinked: boolean
  /** вызывается после успешной мутации — родитель делает общий refetch */
  onChanged: () => void
}) {
  // Оптимистичное зачёркивание: сразу рисуем done, при ошибке откатываем
  const [done, setDone] = useState(task.is_done)
  const [donePending, setDonePending] = useState(false)
  const [popOpen, setPopOpen] = useState(false)
  const [channels, setChannels] = useState<('telegram' | 'email')[]>(task.remind_channels)
  const [remindAt, setRemindAt] = useState<string | null>(task.remind_at)
  const [remindSaving, setRemindSaving] = useState(false)
  const [remindError, setRemindError] = useState<string | null>(null)
  const [icsOk, setIcsOk] = useState(false)
  const [icsError, setIcsError] = useState(false)

  useEffect(() => {
    setDone(task.is_done)
    setChannels(task.remind_channels)
    setRemindAt(task.remind_at)
  }, [task])

  // Фидбек «скачано» — зелёный на 1,5 с
  useEffect(() => {
    if (!icsOk) return
    const t = setTimeout(() => setIcsOk(false), 1500)
    return () => clearTimeout(t)
  }, [icsOk])

  const toggleDone = async () => {
    if (donePending || done) return
    setDone(true)
    setDonePending(true)
    try {
      await api.patch(`/advisor/tasks/${task.id}`, { is_done: true })
      onChanged()
    } catch {
      setDone(false)
    } finally {
      setDonePending(false)
    }
  }

  const saveReminder = async (remind_at: string | null, chans: ('telegram' | 'email')[]) => {
    if (remindSaving) return
    setRemindSaving(true)
    setRemindError(null)
    try {
      await api.patch(`/advisor/tasks/${task.id}/reminder`, { remind_at, channels: chans })
      setRemindAt(remind_at)
      setChannels(remind_at ? chans : [])
      setPopOpen(false)
      onChanged()
    } catch (err: any) {
      if (err?.status === 400 && err?.data?.error === 'telegram_not_linked') {
        setRemindError('Telegram не привязан — привяжите его в «Расписание и доставка».')
      } else if (err?.status === 400 && err?.data?.error === 'remind_at_in_past') {
        setRemindError('Момент напоминания уже в прошлом — выберите другой пресет.')
      } else {
        setRemindError(err?.message || 'Не удалось сохранить напоминание.')
      }
    } finally {
      setRemindSaving(false)
    }
  }

  const applyPreset = (preset: 'day' | 'before') => {
    const at = reminderPresetIso(task.due_date, preset)
    if (!at) return
    // Оба канала по умолчанию (ТЗ-183 v6, мокап v13); TG отсекается при сохранении,
    // если не привязан — сервер вернёт 400 с подсказкой.
    const chans: ('telegram' | 'email')[] = ['email']
    if (telegramLinked) chans.unshift('telegram')
    void saveReminder(at, chans)
  }

  const toggleChannel = (ch: 'telegram' | 'email') => {
    setChannels(prev => (prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]))
  }

  const dueLabel = formatTaskDate(task.due_date)
  const remindTitle = remindAt ? formatMskDateTime(remindAt) : null

  return (
    <div className="flex items-center gap-2.5 py-1.5 group">
      <button
        role="checkbox"
        aria-checked={done}
        onClick={toggleDone}
        disabled={donePending}
        title={done ? 'Выполнено' : 'Отметить выполненным'}
        className="focusable w-[18px] h-[18px] rounded-[5px] shrink-0 flex items-center justify-center transition-colors disabled:opacity-60"
        style={{
          border: `1px solid ${done ? '#34D399' : '#3a3a3a'}`,
          backgroundColor: done ? 'rgba(52,211,153,0.15)' : 'transparent',
        }}
      >
        {donePending ? (
          <Loader2 size={11} style={{ color: '#34D399' }} className="animate-spin" />
        ) : (
          done && <Check size={12} style={{ color: '#34D399' }} />
        )}
      </button>

      <span
        className="text-[13px] min-w-0 truncate transition-all"
        style={{ color: done ? '#6B7280' : '#D1D5DB', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.55 : 1 }}
      >
        {task.title}
      </span>
      {dueLabel && (
        <span className="shrink-0 text-[11px]" style={{ color: '#6B7280' }}>· {dueLabel}</span>
      )}

      <span className="ml-auto flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
        {/* Колокольчик — напоминание */}
        <span className="relative">
          <button
            onClick={() => { setPopOpen(v => !v); setRemindError(null) }}
            title={remindTitle ? `Напомним: ${remindTitle}` : 'Напомнить о задаче'}
            aria-label="Напоминание"
            className="focusable w-[26px] h-[26px] rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ color: remindAt ? '#00D4FF' : '#6B7280', border: remindAt ? '1px solid rgba(0,212,255,0.25)' : '1px solid transparent' }}
          >
            <Bell size={14} />
          </button>
          {popOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setPopOpen(false) }} />
              <div className="absolute right-0 top-8 z-50 w-[250px] rounded-[14px] p-2.5" style={popoverStyle}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color: '#6B7280' }}>
                  Напоминание
                </p>
                <button
                  onClick={() => applyPreset('day')}
                  disabled={!task.due_date || remindSaving}
                  title={task.due_date ? undefined : 'У задачи нет дедлайна — пресет недоступен'}
                  className="focusable w-full text-left px-2.5 py-2 rounded-lg text-[12px] transition-colors hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: '#D1D5DB' }}
                >
                  В день дедлайна, 09:00 (мск)
                </button>
                <button
                  onClick={() => applyPreset('before')}
                  disabled={!task.due_date || remindSaving}
                  title={task.due_date ? undefined : 'У задачи нет дедлайна — пресет недоступен'}
                  className="focusable w-full text-left px-2.5 py-2 rounded-lg text-[12px] transition-colors hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ color: '#D1D5DB' }}
                >
                  За день до дедлайна, 09:00 (мск)
                </button>
                {remindAt && (
                  <>
                    <div className="flex flex-col gap-1.5 px-2.5 py-2">
                      <ChannelCheckbox
                        label="Telegram"
                        checked={channels.includes('telegram')}
                        disabled={!telegramLinked}
                        disabledHint={telegramLinked ? undefined : 'привяжите Telegram'}
                        onToggle={() => toggleChannel('telegram')}
                      />
                      <ChannelCheckbox
                        label="email"
                        checked={channels.includes('email')}
                        onToggle={() => toggleChannel('email')}
                      />
                    </div>
                    <button
                      onClick={() => {
                        const chans: ('telegram' | 'email')[] = channels.length ? channels : ['email']
                        void saveReminder(remindAt, chans)
                      }}
                      disabled={remindSaving || (!channels.includes('telegram') && !channels.includes('email'))}
                      className="focusable w-full px-2.5 py-2 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-40"
                      style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.25)' }}
                    >
                      {remindSaving ? 'Сохраняем…' : 'Сохранить каналы'}
                    </button>
                    <button
                      onClick={() => void saveReminder(null, [])}
                      disabled={remindSaving}
                      className="focusable w-full inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12px] transition-colors hover:bg-white/5 disabled:opacity-40"
                      style={{ color: '#9CA3AF' }}
                    >
                      <BellOff size={12} /> Выключить напоминание
                    </button>
                  </>
                )}
                {remindError && (
                  <p className="text-[11px] leading-relaxed px-1 pt-1.5" style={{ color: '#FBBF24' }}>{remindError}</p>
                )}
              </div>
            </>
          )}
        </span>

        {/* Календарь — .ics */}
        <button
          onClick={() => {
            if (icsOk) return
            setIcsError(false)
            downloadTaskIcs(task)
              .then(() => setIcsOk(true))
              .catch(() => setIcsError(true))
          }}
          title={icsError ? 'Не удалось скачать файл' : 'Сохранить в календарь (.ics)'}
          aria-label="Сохранить в календарь"
          className="focusable w-[26px] h-[26px] rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
          style={{ color: icsOk ? '#34D399' : '#6B7280', border: icsOk ? '1px solid rgba(52,211,153,0.25)' : '1px solid transparent' }}
        >
          <Calendar size={14} />
        </button>
      </span>
    </div>
  )
}
