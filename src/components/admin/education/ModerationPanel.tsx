import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Download, FileText, Link2, Newspaper, ShieldAlert } from 'lucide-react'
import GlassModal from '@/components/GlassModal'
import { useToast } from '@/hooks/useToast'
import { API_BASE } from '@/lib/api'
import { approveModeration, fetchModeration, getAdminToken, rejectModeration } from './api'
import { Btn, C, OpenPill, TypePill, fmtDate } from './ui'
import type { ModerationItem, ModerationKind } from './types'

// Под-вкладка «На проверке (N)» — очередь модерации UGC (ТЗ-102, Задача 3):
// pending-материалы (ссылка/файл/новость) + pending-предложения новостей, FIFO
// (старые первыми). Принять — сразу в ленту; отклонить — только с обязательной
// причиной (юзер увидит её текстом в профиле, поэтому пишем по-человечески).
// av_unavailable (clamd мёртв) — янтарная плашка, файл не скачивается (423 на бэке).

export default function ModerationPanel({
  onCountChange,
}: {
  /** Счётчик pending на таб «Образование» (Admin.tsx) — обновляем без перезагрузки. */
  onCountChange?: (total: number) => void
}) {
  const { toast, toastError } = useToast()
  const [items, setItems] = useState<ModerationItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectItem, setRejectItem] = useState<ModerationItem | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)
  // ТЗ-142: «Очередь» (pending, FIFO) | «Обработанные» (история, read-only)
  const [tab, setTab] = useState<'pending' | 'all'>('pending')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Роут без параметров отдаёт очередь (FIFO, старые первыми); ?status=all —
      // история: свежие проверки сверху, LIMIT 200 на бэке.
      const data = await fetchModeration(tab)
      setItems(data.items || [])
      setTotal(data.total ?? (data.items || []).length)
      // Бейдж «Образование (N)» — только по живой очереди: история (all) его
      // не трогает, иначе вкладка админки показала бы сотни обработанных.
      if (tab === 'pending') onCountChange?.(data.total ?? (data.items || []).length)
    } catch (err: any) {
      toastError(err?.message || 'Не удалось загрузить очередь модерации')
    } finally {
      setLoading(false)
    }
  }, [onCountChange, toastError, tab])

  useEffect(() => {
    load()
  }, [load])

  const itemKey = (it: ModerationItem) => `${it.kind}:${it.id}`

  const removeItem = (it: ModerationItem, nextTotal: number) => {
    setItems(prev => prev.filter(x => itemKey(x) !== itemKey(it)))
    setTotal(nextTotal)
    onCountChange?.(nextTotal)
  }

  const handleApprove = async (it: ModerationItem) => {
    setBusyId(itemKey(it))
    try {
      await approveModeration(it.kind, it.id)
      removeItem(it, Math.max(0, total - 1))
      toast(it.kind === 'news-suggestion' ? 'Новость принята — привязана к курсу' : 'Материал принят — опубликован на странице курса', 'success')
    } catch (err: any) {
      toastError(err?.message || 'Не удалось принять')
      load()
    } finally {
      setBusyId(null)
    }
  }

  const openReject = (it: ModerationItem) => {
    setRejectItem(it)
    setRejectReason('')
  }

  const handleReject = async () => {
    if (!rejectItem) return
    setRejecting(true)
    try {
      await rejectModeration(rejectItem.kind, rejectItem.id, rejectReason.trim())
      removeItem(rejectItem, Math.max(0, total - 1))
      toast('Отклонено — автор увидит причину в профиле', 'success')
      setRejectItem(null)
    } catch (err: any) {
      toastError(err?.message || 'Не удалось отклонить')
    } finally {
      setRejecting(false)
    }
  }

  const handleDownload = async (it: ModerationItem) => {
    setBusyId(itemKey(it))
    try {
      // Download-эндпоинт материалов (ТЗ-100): 302 на signed URL; токен — в заголовке,
      // редирект fetch прозрачно следует в /media/* (signed — без заголовка).
      const res = await fetch(`${API_BASE}/education/materials/${it.id}/download`, {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || data.message || `Ошибка ${res.status}`)
      }
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = it.file_name || 'material'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objUrl)
    } catch (err: any) {
      // 423 — файл ещё на антивирусной проверке (scan_status != 'clean').
      toastError(err?.message || 'Не удалось скачать файл')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      {/* ТЗ-142: переключатель «Очередь / Обработанные» */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {([
          ['pending', `Очередь${tab === 'pending' && total ? ` · ${total}` : ''}`],
          ['all', 'Обработанные'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setTab(id)} style={{
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600, padding: '8px 16px',
            borderRadius: '.5rem', cursor: 'pointer', transition: 'all .2s',
            background: tab === id ? '#111111' : 'transparent',
            color: tab === id ? C.textPrimary : C.textMuted,
            border: `1px solid ${tab === id ? C.border : 'transparent'}`,
          }}>{label}</button>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.textPrimary, letterSpacing: '-.01em' }}>
            Модерация материалов сообщества
          </div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
            {total > 0
              ? `${total} предложений ждут проверки · старые — первыми`
              : 'Очередь пуста — предложения учеников появятся здесь'}
          </div>
        </div>
        <Btn sm onClick={load}>Обновить</Btn>
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
          Загружаем очередь…
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: C.textMuted,
            fontSize: 13,
            background: C.bgSurface,
            border: `1px dashed ${C.border}`,
            borderRadius: '.75rem',
          }}
        >
          <ShieldAlert size={28} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
          {tab === 'all' ? (
            <>История пуста — обработанные заявки появятся здесь после первой модерации.</>
          ) : (
            <>
              На проверку ничего не поступало.
              <br />
              Ученики предлагают материалы со страницы курса — кнопка «Предложить материал».
            </>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map(it => (
            <ModerationCard
              key={itemKey(it)}
              item={it}
              busy={busyId === itemKey(it)}
              readOnly={tab === 'all' && it.status !== 'pending'}
              onApprove={() => handleApprove(it)}
              onReject={() => openReject(it)}
              onDownload={() => handleDownload(it)}
            />
          ))}
        </div>
      )}

      {/* Модал отклонения: причина обязательна, юзер увидит её в профиле. */}
      <GlassModal
        open={!!rejectItem}
        onClose={() => !rejecting && setRejectItem(null)}
        title="Отклонить предложение"
      >
        <p style={{ fontSize: 13, color: C.textSecondary, marginBottom: 12, lineHeight: 1.6 }}>
          Причина увидит автор предложения — напишите её по-человечески: без внутренних терминов
          и без «отклонено по регламенту п. 3».
        </p>
        <textarea
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
          rows={4}
          autoFocus
          placeholder="Например: ссылка ведёт на платный ресурс без бесплатного доступа, или файл дублирует уже опубликованный материал."
          className="w-full rounded-[10px] px-3 py-2.5 text-sm text-white bg-[#161616] border border-[#222] outline-none focus:border-[rgba(0,212,255,0.5)] transition-colors resize-none"
        />
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={handleReject}
            disabled={rejecting || rejectReason.trim().length < 3}
            className="flex-1 h-11 rounded-xl text-[13px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: '#EF4444', color: '#fff' }}
          >
            {rejecting ? 'Отклоняем…' : 'Отклонить'}
          </button>
          <Btn onClick={() => setRejectItem(null)}>Отмена</Btn>
        </div>
      </GlassModal>
    </div>
  )
}

function ModerationCard({
  item,
  busy,
  readOnly = false,
  onApprove,
  onReject,
  onDownload,
}: {
  item: ModerationItem
  busy: boolean
  /** ТЗ-142: карточка из истории — без кнопок, с пилюлей статуса. */
  readOnly?: boolean
  onApprove: () => void
  onReject: () => void
  onDownload: () => void
}) {
  const TypeIcon = item.type === 'news' ? Newspaper : item.type === 'file' ? FileText : Link2

  return (
    <div
      style={{
        background: C.bgSurface,
        border: `1px solid ${C.border}`,
        borderRadius: '.75rem',
        padding: '16px 18px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <TypePill color={item.kind === 'news-suggestion' ? C.violet : C.accent}>
          {item.type === 'news' ? 'Новость' : item.type === 'file' ? 'Файл' : 'Ссылка'}
        </TypePill>
        <span style={{ fontSize: 11, color: C.textMuted }}>
          {fmtDate(item.created_at)}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: C.textSecondary, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <TypeIcon size={13} style={{ color: C.textMuted }} />
          {item.course.title}
        </span>
      </div>

      {/* Содержимое */}
      <div style={{ marginBottom: 10 }}>
        {item.type === 'link' && item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 14, fontWeight: 600, color: C.accent, wordBreak: 'break-all' }}
          >
            {item.title || item.url}
          </a>
        ) : item.type === 'file' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{item.title}</span>
            {item.file_name && (
              <span style={{ fontSize: 11, color: C.textMuted }}>
                {item.file_name}
                {item.file_size ? ` · ${(item.file_size / 1024 / 1024).toFixed(1)} МБ` : ''}
              </span>
            )}
            {!readOnly && (
              <Btn sm onClick={onDownload} disabled={busy || !!item.av_unavailable}>
                <Download size={12} style={{ verticalAlign: -2, marginRight: 5 }} />
                Скачать
              </Btn>
            )}
          </div>
        ) : (
          <div>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{item.news_title || item.title}</span>
            {item.news_published_at && (
              <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>{fmtDate(item.news_published_at)}</span>
            )}
          </div>
        )}
        {item.type !== 'link' && item.title && item.type === 'news' && (
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{item.title}</div>
        )}
      </div>

      {/* av_unavailable (ТЗ-102 v2, S4): clamd недоступен — файл ещё не просканирован. */}
      {item.av_unavailable && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            color: C.amber,
            background: 'rgba(251,191,36,.07)',
            border: '1px solid rgba(251,191,36,.3)',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 10,
            lineHeight: 1.5,
          }}
        >
          <AlertTriangle size={14} style={{ flex: 'none' }} />
          Антивирус недоступен — файл на проверке. Скачивание закрыто до результата сканирования.
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderTop: `1px solid ${C.borderRow}`,
          paddingTop: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 12, color: C.textMuted }}>
          предложил <b style={{ color: C.textSecondary }}>@{item.author?.username || 'ученик'}</b>
        </span>
        <span style={{ flex: 1 }} />
        {readOnly ? (
          <>
            {item.status === 'approved' ? (
              <OpenPill color={C.success}>Одобрено</OpenPill>
            ) : item.status === 'rejected' ? (
              <OpenPill color={C.error}>Отклонено</OpenPill>
            ) : null}
          </>
        ) : (
          <>
            <Btn variant="danger" sm disabled={busy} onClick={onReject}>Отклонить</Btn>
            <Btn variant="accent" sm disabled={busy} onClick={onApprove}>Принять</Btn>
          </>
        )}
      </div>
      {/* ТЗ-142: в истории — кем/когда проверено и причина отклонения */}
      {readOnly && (
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8, lineHeight: 1.5 }}>
          {item.reviewed_by?.username || 'модератор'}
          {item.reviewed_at ? ` · ${fmtDate(item.reviewed_at)}` : ''}
          {item.reject_reason ? ` · причина: ${item.reject_reason}` : ''}
        </div>
      )}
    </div>
  )
}

// Переэкспорт типа — импортирующим файлам удобнее брать всё отсюда.
export type { ModerationItem, ModerationKind }
