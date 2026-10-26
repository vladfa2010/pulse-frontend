// TZ-197-club Задача 6 (v2): таба «Клуб» в админке — контроль доступа в закрытый
// Telegram-канал. Шапка со счётчиками (в канале/приглашены/исключены/ручные),
// форма ручной выдачи по email (404 → инлайн-ошибка), таблица членов с
// чипами-фильтрами по статусу, баннер-подсказка про ручные выдачи,
// danger-confirm на исключение и отзыв ручной выдачи (регламент: confirm на
// деструктив). Паттерн соседних таб — McpTab.tsx / CalendarTab.tsx.
import { useEffect, useState, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { useToast } from '@/hooks/useToast'
import { RefreshCw, UserPlus, UserX, ShieldAlert, Star, Loader2 } from 'lucide-react'

interface ClubMember {
  user_id: string
  email: string
  username: string | null
  subscription_plan: string | null
  subscription_expires_at: string | null
  status: 'invited' | 'member' | 'kicked' | 'left'
  is_manual: boolean
  manual_revoked_at: string | null
  tg_user_id: string | null
  invited_at: string | null
  joined_at: string | null
  kicked_at: string | null
  kick_reason: string | null
}

interface ClubCounters {
  members: number
  invited: number
  kicked: number
  manual: number
}

type ChipFilter = 'all' | 'member' | 'invited' | 'kicked' | 'manual'

const STATUS_STYLE: Record<ClubMember['status'], { color: string; bg: string; label: string }> = {
  member: { color: '#34D399', bg: '#34D39922', label: 'в канале' },
  invited: { color: '#F59E0B', bg: '#F59E0B22', label: 'приглашён' },
  kicked: { color: '#EF4444', bg: '#EF444422', label: 'исключён' },
  left: { color: '#9CA3AF', bg: '#9CA3AF22', label: 'вышел' },
}

const KICK_REASON_LABEL: Record<string, string> = {
  subscription_expired: 'кончился тариф',
  feature_disabled: 'фича отключена',
  manual_leave: 'вышел сам',
  admin: 'админ',
  no_access_at_join: 'нет доступа при вступлении',
  invite_expired: 'приглашение отозвано',
}

const CHIPS: Array<{ id: ChipFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'member', label: 'В канале' },
  { id: 'invited', label: 'Приглашённые' },
  { id: 'kicked', label: 'Исключённые' },
  { id: 'manual', label: 'Ручные' },
]

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isManualActive(m: ClubMember): boolean {
  return Boolean(m.is_manual) && !m.manual_revoked_at
}

export default function ClubTab() {
  const { toast, toastError } = useToast()

  const [members, setMembers] = useState<ClubMember[]>([])
  const [counters, setCounters] = useState<ClubCounters | null>(null)
  const [loading, setLoading] = useState(true)
  const [chip, setChip] = useState<ChipFilter>('all')

  // Ручная выдача по email
  const [grantEmail, setGrantEmail] = useState('')
  const [granting, setGranting] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)

  // Danger-confirm: kick | revoke-manual
  const [confirmAction, setConfirmAction] = useState<{ type: 'kick' | 'revoke'; member: ClubMember } | null>(null)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.get('/api/admin/club/members')
      setMembers(data.members || [])
      setCounters(data.counters || null)
    } catch (err) {
      console.error('Club members load error:', err)
      toastError('Не удалось загрузить список членов клуба')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { load() }, [load])

  // Счётчики из ответа бэка; если бэк их не прислал — считаем из строк
  const derived: ClubCounters = counters || {
    members: members.filter(m => m.status === 'member').length,
    invited: members.filter(m => m.status === 'invited').length,
    kicked: members.filter(m => m.status === 'kicked').length,
    manual: members.filter(isManualActive).length,
  }

  const summaryTiles = [
    { label: 'В канале', value: derived.members, color: '#34D399' },
    { label: 'Приглашены', value: derived.invited, color: '#F59E0B' },
    { label: 'Исключены', value: derived.kicked, color: '#EF4444' },
    { label: 'Ручных выдач', value: derived.manual, color: '#A78BFA' },
  ]

  const filtered = members.filter(m => {
    if (chip === 'all') return true
    if (chip === 'manual') return isManualActive(m)
    return m.status === chip
  })

  // ── Ручная выдача ──
  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = grantEmail.trim()
    if (!email || granting) return
    setGranting(true)
    setGrantError(null)
    try {
      const data = await adminApi.post('/api/admin/club/grant', { email })
      toast(data?.alreadyMember ? `${email} уже имеет доступ` : `Доступ выдан: ${email}`)
      setGrantEmail('')
      await load()
    } catch (err: any) {
      if (err?.status === 404 || err?.data?.error === 'user_not_found') {
        // Инлайн-ошибка под полем (по ТЗ §6 — не toast)
        setGrantError('Пользователь с таким email не найден')
      } else {
        toastError(err?.message || 'Не удалось выдать доступ')
      }
    } finally {
      setGranting(false)
    }
  }

  // ── Исключение / отзыв ручной выдачи ──
  const handleConfirm = async () => {
    if (!confirmAction) return
    const { type, member } = confirmAction
    setActing(true)
    try {
      if (type === 'kick') {
        await adminApi.post(`/api/admin/club/members/${member.user_id}/kick`, {})
        toast(`${member.email} исключён из канала`)
      } else {
        await adminApi.post(`/api/admin/club/members/${member.user_id}/revoke-manual`, {})
        toast(`Ручная выдача отозвана: ${member.email}`)
      }
      setConfirmAction(null)
      await load()
    } catch (err: any) {
      toastError(err?.message || 'Действие не выполнено')
    } finally {
      setActing(false)
    }
  }

  return (
    <div>
      {/* Описание табы */}
      <p className="text-sm mb-4" style={{ color: '#9CA3AF' }}>
        Закрытый Telegram-канал «Клуб»: членство по тарифу с фичей club_access
        (контролируется ежедневным аудитом) и ручные выдачи администратора.
      </p>

      {/* ─── Счётчики ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {summaryTiles.map(tile => (
          <div
            key={tile.label}
            className="rounded-xl border p-4"
            style={{ backgroundColor: '#0a0a0a', borderColor: '#222222' }}
          >
            <p className="text-xs mb-1" style={{ color: '#6B7280' }}>{tile.label}</p>
            <p className="text-2xl font-semibold font-mono" style={{ color: tile.color }}>{tile.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Баннер-подсказка про ручные выдачи (ТЗ §6) ───────────── */}
      <div
        className="rounded-xl border p-4 mb-6 flex items-start gap-3"
        style={{ backgroundColor: 'rgba(167, 139, 250, 0.05)', borderColor: 'rgba(167, 139, 250, 0.2)' }}
      >
        <ShieldAlert size={16} className="shrink-0 mt-0.5" style={{ color: '#A78BFA' }} />
        <p className="text-xs leading-relaxed" style={{ color: '#9CA3AF' }}>
          Ручная выдача не снимается аудитом — снимается только кнопкой отзыва
          или исключением. Пользователь проходит обычный путь в ЛК: вкладка
          «Клуб» → привязка Telegram → персональная ссылка.
        </p>
      </div>

      {/* ─── Форма ручной выдачи ──────────────────────────────────── */}
      <form
        onSubmit={handleGrant}
        className="rounded-xl border p-4 mb-6 flex flex-wrap items-start gap-3"
        style={{ backgroundColor: '#0a0a0a', borderColor: '#222222' }}
      >
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs mb-1.5" style={{ color: '#6B7280' }}>
            Ручная выдача доступа (без тарифа)
          </label>
          <input
            type="email"
            value={grantEmail}
            onChange={e => { setGrantEmail(e.target.value); setGrantError(null) }}
            placeholder="email пользователя..."
            aria-label="Email для ручной выдачи"
            className="w-full px-3 py-2.5 rounded-lg text-sm border transition-all focus:outline-none focus:border-[#444444]"
            style={{ backgroundColor: '#111111', borderColor: grantError ? '#EF4444' : '#222222', color: '#FFFFFF' }}
          />
          {grantError && (
            <p className="text-xs mt-1.5" style={{ color: '#EF4444' }} role="alert">{grantError}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={granting || !grantEmail.trim()}
          className="flex items-center gap-2 px-4 py-2.5 mt-0 sm:mt-[22px] rounded-lg text-sm font-medium border transition-all hover:border-[#A78BFA66] disabled:opacity-50"
          style={{ backgroundColor: '#111111', borderColor: '#A78BFA44', color: '#A78BFA' }}
        >
          {granting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
          Выдать доступ
        </button>
      </form>

      {/* ─── Фильтры-чипы + обновление ────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        {CHIPS.map(c => (
          <button
            key={c.id}
            onClick={() => setChip(c.id)}
            className="px-3 py-1.5 rounded-full text-xs font-medium border transition-all"
            style={{
              backgroundColor: chip === c.id ? '#111111' : 'transparent',
              borderColor: chip === c.id ? '#444444' : '#222222',
              color: chip === c.id ? '#FFFFFF' : '#6B7280',
            }}
          >
            {c.label}
          </button>
        ))}
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 ml-auto rounded-full text-xs border transition-all hover:border-[#333333] disabled:opacity-50"
          style={{ backgroundColor: 'transparent', borderColor: '#222222', color: '#9CA3AF' }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {/* ─── Таблица ──────────────────────────────────────────────── */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#111111', borderColor: '#222222' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#0A0A0A' }}>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Пользователь</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Тариф</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Истекает</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Статус</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>TG id</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Вступил</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#6B7280' }}>Исключён</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider w-52" style={{ color: '#6B7280' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: '#6B7280' }}>
                    {loading ? 'Загрузка...' : 'Нет членов клуба по выбранному фильтру'}
                  </td>
                </tr>
              )}
              {filtered.map(m => {
                const st = STATUS_STYLE[m.status] || STATUS_STYLE.left
                return (
                  <tr key={m.user_id} className="transition-colors hover:bg-[#161616]" style={{ borderTop: '1px solid #1a1a1a' }}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{m.username || '—'}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{m.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>{m.subscription_plan || 'free'}</span>
                      {isManualActive(m) && (
                        <span
                          data-testid="manual-badge"
                          className="ml-2 text-xs px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                          style={{ backgroundColor: '#A78BFA22', color: '#A78BFA' }}
                        >
                          <Star size={10} />
                          ручной
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>{formatDate(m.subscription_expires_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        data-status={m.status}
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: st.bg, color: st.color }}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono" style={{ color: '#6B7280' }}>{m.tg_user_id || '—'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>{formatDate(m.joined_at)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>{formatDate(m.kicked_at)}</span>
                      {m.kick_reason && (
                        <p className="text-[10px]" style={{ color: '#6B7280' }}>
                          {KICK_REASON_LABEL[m.kick_reason] || m.kick_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {(m.status === 'member' || m.status === 'invited') && (
                          <button
                            onClick={() => setConfirmAction({ type: 'kick', member: m })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:border-[#EF4444]"
                            style={{ backgroundColor: '#111111', borderColor: '#EF444433', color: '#EF4444' }}
                          >
                            <UserX size={12} />
                            Исключить
                          </button>
                        )}
                        {isManualActive(m) && (
                          <button
                            onClick={() => setConfirmAction({ type: 'revoke', member: m })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all hover:border-[#444444]"
                            style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#9CA3AF' }}
                          >
                            Отозвать ручную выдачу
                          </button>
                        )}
                        {m.status !== 'member' && m.status !== 'invited' && !isManualActive(m) && (
                          <span className="text-xs" style={{ color: '#6B7280' }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Danger-confirm модалка (kick / revoke) ───────────────── */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => !acting && setConfirmAction(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border p-6"
            style={{ backgroundColor: '#0a0a0a', borderColor: '#222222' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EF444422' }}>
                <UserX size={18} style={{ color: '#EF4444' }} />
              </div>
              <h3 className="text-base font-semibold" style={{ color: '#FFFFFF' }}>
                {confirmAction.type === 'kick' ? 'Исключить из канала?' : 'Отозвать ручную выдачу?'}
              </h3>
            </div>
            <p className="text-sm mb-6" style={{ color: '#9CA3AF' }}>
              {confirmAction.type === 'kick'
                ? `Исключить ${confirmAction.member.email} из закрытого канала? Если у пользователя нет тарифа, он не сможет вернуться без новой выдачи.`
                : `Отозвать ручную выдачу у ${confirmAction.member.email}? Если у пользователя нет тарифа, следующий аудит снимет его из канала.`}
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={acting}
                className="px-4 py-2 rounded-lg text-sm border transition-all hover:border-[#444444] disabled:opacity-50"
                style={{ backgroundColor: '#111111', borderColor: '#222222', color: '#9CA3AF' }}
              >
                Отмена
              </button>
              <button
                onClick={handleConfirm}
                disabled={acting}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: confirmAction.type === 'kick' ? '#EF4444' : '#F59E0B',
                  color: '#FFFFFF',
                }}
              >
                {acting
                  ? 'Выполняем...'
                  : confirmAction.type === 'kick' ? 'Исключить' : 'Отозвать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
