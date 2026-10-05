import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { FileText, Inbox, Link2, Newspaper } from 'lucide-react'
import { fetchMySubmissions } from '@/lib/educationApi'
import type { MySubmission, SubmissionStatus } from '@/lib/educationApi'

// Секция «Мои предложения» личного кабинета (ТЗ-102): предложенные учеником
// материалы/новости по курсам со статусами модерации. Бейджи: на проверке —
// amber, принято — green, отклонено — red (+ причина отказа текстом).

const STATUS_META: Record<SubmissionStatus, { label: string; color: string; bg: string; border: string }> = {
  pending: {
    label: 'На проверке',
    color: '#FBBF24',
    bg: 'rgba(251,191,36,.1)',
    border: 'rgba(251,191,36,.3)',
  },
  approved: {
    label: 'Принято',
    color: '#34D399',
    bg: 'rgba(52,211,153,.1)',
    border: 'rgba(52,211,153,.3)',
  },
  rejected: {
    label: 'Отклонено',
    color: '#F87171',
    bg: 'rgba(239,68,68,.1)',
    border: 'rgba(239,68,68,.3)',
  },
}

function submissionTitle(s: MySubmission): string {
  if (s.title) return s.title
  if (s.news_title) return s.news_title
  if (s.type === 'news') return 'Новость PULSE'
  return 'Материал'
}

function kindLabel(s: MySubmission): { icon: typeof Link2; label: string } {
  const t = s.type || (s.kind === 'news-suggestion' ? 'news' : 'link')
  if (t === 'news') return { icon: Newspaper, label: 'Новость' }
  if (t === 'file') return { icon: FileText, label: 'Файл' }
  return { icon: Link2, label: 'Ссылка' }
}

export default function SubmissionsTab() {
  const [items, setItems] = useState<MySubmission[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMySubmissions()
      .then(list => setItems(Array.isArray(list) ? list : []))
      .catch((err) => { setError(err?.message || 'Не удалось загрузить предложения'); setItems([]) })
  }, [])

  return (
    <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}>
      <div className="flex items-center gap-3 mb-6">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0, 212, 255, 0.08)', border: '1px solid rgba(0, 212, 255, 0.15)' }}
        >
          <Inbox size={18} style={{ color: '#00D4FF' }} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Мои предложения</h2>
          <p className="text-xs text-[#6B7280]">
            Материалы и новости, предложенные курсам — со статусом проверки редакцией
          </p>
        </div>
      </div>

      {items === null ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-8">
          <Inbox size={32} className="mx-auto mb-3 text-[#4B5563]" />
          {error ? (
            <p className="text-[#F87171] text-sm">{error}</p>
          ) : (
            <p className="text-[#6B7280] text-sm">
              Пока нет предложений. Открывайте курс, на который записаны, и предлагайте полезные материалы.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(s => {
            const st = STATUS_META[s.status] || STATUS_META.pending
            const kind = kindLabel(s)
            const KindIcon = kind.icon
            return (
              <div
                key={s.id}
                className="px-4 py-3.5 rounded-xl"
                style={{ background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.05)' }}
              >
                <div className="flex items-start gap-3">
                  <KindIcon size={15} className="mt-0.5 flex-none" style={{ color: '#00D4FF' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{submissionTitle(s)}</span>
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                        style={{ color: '#9CA3AF', border: '1px solid rgba(255,255,255,.12)' }}
                      >
                        {kind.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-1.5 text-[12px] text-[#6B7280]">
                      <span>
                        курс:{' '}
                        <Link to={`/education/${s.course.slug}`} className="text-[#00D4FF] hover:underline">
                          {s.course.title}
                        </Link>
                      </span>
                      <span>{new Date(s.created_at).toLocaleDateString('ru-RU')}</span>
                    </div>
                    {s.status === 'rejected' && s.reject_reason && (
                      <div
                        className="mt-2 px-3 py-2 rounded-lg text-[12px] leading-relaxed"
                        style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)', color: '#FCA5A5' }}
                      >
                        Причина отказа: {s.reject_reason}
                      </div>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-none"
                    style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}` }}
                  >
                    {st.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
