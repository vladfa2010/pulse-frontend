import { useEffect, useState } from 'react'
import GlassModal from '@/components/GlassModal'
import { notifyEnroll } from './api'
import { Btn, C, Check } from './ui'
import type { EnrollNotifyChannels } from './api'
import type { UserSearchItem } from './types'

// ТЗ-186: модалка «Уведомить о записи» — после записи админом предлагает
// отправить пользователю «Вам предоставлен доступ к курсу …» по доступным
// каналам (почта / push / Telegram). Доступность — из notify_channels ответа
// записи; недоступный канал disabled с подписью «не подключён».

const CHANNELS: Array<{ key: keyof EnrollNotifyChannels; label: string }> = [
  { key: 'email', label: 'Почта' },
  { key: 'push', label: 'Push' },
  { key: 'telegram', label: 'Telegram' },
]

export default function NotifyEnrollModal({
  open,
  courseId,
  courseTitle,
  user,
  channels,
  onClose,
  toast,
}: {
  open: boolean
  courseId: string
  courseTitle: string
  user: UserSearchItem
  channels: EnrollNotifyChannels
  onClose: () => void
  toast: (msg: string, type?: 'info' | 'error' | 'success') => void
}) {
  // Предвыбраны доступные каналы (решение ТЗ); недоступные сняты и disabled.
  const [picked, setPicked] = useState<Set<keyof EnrollNotifyChannels>>(new Set())
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open) return
    setPicked(new Set(CHANNELS.filter(c => channels[c.key]).map(c => c.key)))
    setSending(false)
  }, [open, channels])

  const toggle = (key: keyof EnrollNotifyChannels) => {
    if (!channels[key]) return
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const send = async () => {
    if (picked.size === 0 || sending) return
    setSending(true)
    try {
      const res = await notifyEnroll(courseId, user.id, [...picked])
      const sentLabels = CHANNELS.filter(c => res.sent[c.key]).map(c => c.label.toLowerCase())
      const skipped = Object.entries(res.skipped)
        .map(([k, why]) => `${CHANNELS.find(c => c.key === k)?.label.toLowerCase() ?? k} (${why === 'channel_not_connected' ? 'канал не подключён' : why})`)
      const failed = Object.entries(res.failed)
        .map(([k, why]) => `${CHANNELS.find(c => c.key === k)?.label.toLowerCase() ?? k}${why ? ` (${why})` : ''}`)
      const parts: string[] = []
      if (sentLabels.length) parts.push(`отправлено: ${sentLabels.join(', ')}`)
      if (skipped.length) parts.push(`не доставлено: ${skipped.join(', ')}`)
      if (failed.length) parts.push(`ошибка: ${failed.join(', ')}`)
      toast(parts.length ? `Уведомление — ${parts.join('; ')}` : 'Ничего не отправлено', sentLabels.length ? 'success' : 'info')
      onClose()
    } catch (err: any) {
      // Запись на курс при этом уже существует — не откатываем.
      toast(err?.message || 'Не удалось отправить уведомление', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <GlassModal open={open} onClose={onClose} title="Пользователь записан. Уведомить?">
      <p style={{ fontSize: 12, color: C.textSecondary, margin: '0 0 14px', lineHeight: 1.6 }}>
        {user.username || user.email} — доступ к курсу «{courseTitle}» открыт.
        Отправить уведомление «Вам предоставлен доступ к курсу» с кнопкой «Изучить»?
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        {CHANNELS.map(c => (
          <Check
            key={c.key}
            on={picked.has(c.key)}
            disabled={!channels[c.key]}
            title={channels[c.key] ? undefined : 'Канал не подключён у пользователя'}
            onClick={() => toggle(c.key)}
          >
            {c.label}
            {!channels[c.key] && <span style={{ fontWeight: 400, color: C.textMuted }}> · не подключён</span>}
          </Check>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onClose}>Не отправлять</Btn>
        <Btn variant="accent" disabled={picked.size === 0 || sending} onClick={send}>
          {sending ? 'Отправляем…' : 'Отправить'}
        </Btn>
      </div>
    </GlassModal>
  )
}
