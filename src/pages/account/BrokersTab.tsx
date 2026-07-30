import { useState } from 'react'
import { motion } from 'framer-motion'
import { useBrokerKeys, useBrokerKeyMutations } from '@/hooks/useBrokerKeys'
import GlassCard from '@/components/GlassCard'
import BrokerKeyModal from '@/components/portfolio/BrokerKeyModal'
import DeleteKeyConfirm from '@/components/portfolio/DeleteKeyConfirm'
import { Key, Plus, Pencil, Trash2, Landmark, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { BROKER_META, BROKER_ORDER, type Broker, type BrokerKey } from '@/types/portfolio'

const easeOutExpo: [number, number, number, number] = [0.16, 1, 0.3, 1]

export default function BrokersTab() {
  const { data: keys, isLoading } = useBrokerKeys()
  const { deleteBrokerKey, testBrokerKey } = useBrokerKeyMutations()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<BrokerKey | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const openAdd = () => {
    setEditingKey(null)
    setModalOpen(true)
  }

  const openEdit = (k: BrokerKey) => {
    setEditingKey(k)
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    await deleteBrokerKey.mutateAsync(id)
    setConfirmDeleteId(null)
  }

  return (
    <motion.div
      key="brokers"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.3, ease: easeOutExpo }}
      className="space-y-6"
    >
      <div
        className="rounded-xl p-4 flex items-start gap-3 text-[11px] leading-relaxed"
        style={{
          background: 'rgba(52, 211, 153, 0.05)',
          border: '1px solid rgba(52, 211, 153, 0.15)',
          color: '#6B7280',
        }}
      >
        <span className="text-[#34D399] text-base">🔒</span>
        <span>
          Подключение — только по <strong>REST API</strong>, принимаем один <strong>токен</strong> —{' '}
          <strong className="text-[#34D399]">только чтение</strong>: доступа к деньгам и торговле у него нет.
          Храним зашифрованным, показываем только последние 4 символа. Удалить ключ можно в любой момент.
          Синхронизация портфеля — каждые 15 минут.
        </span>
      </div>

      <GlassCard accentColor="#60A5FA">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(96, 165, 250, 0.1)',
              border: '1px solid rgba(96, 165, 250, 0.2)',
            }}
          >
            <Key size={18} style={{ color: '#60A5FA' }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">API-ключи брокеров</h3>
            <p className="text-xs text-[#6B7280]">Автосинхронизация портфелей</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-14 rounded-xl bg-white/5" />
            <div className="h-14 rounded-xl bg-white/5" />
          </div>
        ) : !keys || keys.length === 0 ? (
          <p className="text-[#6B7280] text-sm mb-5">Ключей пока нет — добавьте первый, и портфель начнёт синхронизироваться сам.</p>
        ) : (
          <div className="space-y-2.5 mb-5">
            {keys.map(k => {
              const meta = BROKER_META[k.broker as Broker] ?? BROKER_META.finam
              const isOk = k.status === 'ok'
              return (
                <div
                  key={k.id}
                  className="flex items-center flex-wrap gap-3 px-4 py-3.5 rounded-xl transition-colors hover:border-[#2a2a2a]"
                  style={{ background: '#0A0A0A', border: '1px solid #1a1a1a' }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: meta.color, boxShadow: `0 0 10px ${meta.color}55` }}
                  />
                  <div className="flex-1 min-w-[140px]">
                    <div className="text-[13.5px] font-semibold text-white">
                      {meta.label} · {k.label}
                    </div>
                    <div className="text-[10.5px] text-[#6B7280] mt-0.5" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      ••••{k.tail} · портфель «{k.portfolioName || '—'}»
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        color: isOk ? '#34D399' : '#EF4444',
                        background: isOk ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${isOk ? 'rgba(52, 211, 153, 0.25)' : 'rgba(239, 68, 68, 0.3)'}`,
                      }}
                    >
                      {isOk ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                      {isOk ? 'активен' : k.lastError || 'ошибка'}
                      {k.lastSyncedAt && ` · ${formatTime(k.lastSyncedAt)}`}
                    </span>
                    <button
                      onClick={() => testBrokerKey.mutate(k.id)}
                      disabled={testBrokerKey.isPending}
                      className="w-8 h-8 rounded-lg border border-[#222] text-[#9CA3AF] hover:text-white hover:border-[#3a3a3a] hover:bg-[#161616] transition-colors flex items-center justify-center"
                      title="Проверить подключение"
                    >
                      <RefreshCw size={14} className={testBrokerKey.isPending ? 'animate-spin' : ''} />
                    </button>
                    <button
                      onClick={() => openEdit(k)}
                      className="w-8 h-8 rounded-lg border border-[#222] text-[#9CA3AF] hover:text-white hover:border-[#3a3a3a] hover:bg-[#161616] transition-colors flex items-center justify-center"
                      title="Редактировать"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(k.id)}
                      className="w-8 h-8 rounded-lg border border-[#222] text-[#9CA3AF] hover:text-[#EF4444] hover:border-[rgba(239,68,68,0.4)] hover:bg-[rgba(239,68,68,0.15)] transition-colors flex items-center justify-center"
                      title="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {confirmDeleteId === k.id && (
                    <DeleteKeyConfirm
                      tail={k.tail}
                      onCancel={() => setConfirmDeleteId(null)}
                      onConfirm={() => handleDelete(k.id)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}

        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-bold transition-all hover:brightness-115"
          style={{ background: 'linear-gradient(135deg, #00D4FF, #0099CC)', color: '#060606' }}
        >
          <Plus size={16} />
          Добавить ключ
        </button>
        <p className="text-[10px] text-[#6B7280] mt-3">
          Удаление ключа не трогает портфель и позиции — останавливается только автосинхронизация (позиции остаются снимком на момент последнего синка).
        </p>
      </GlassCard>

      <GlassCard accentColor="#00D4FF">
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              backgroundColor: 'rgba(0, 212, 255, 0.08)',
              border: '1px solid rgba(0, 212, 255, 0.15)',
            }}
          >
            <Landmark size={18} style={{ color: '#00D4FF' }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Где взять ключ</h3>
            <p className="text-xs text-[#6B7280]">Инструкции по брокерам</p>
          </div>
        </div>
        <div className="space-y-2 text-[12px] text-[#9CA3AF]">
          {BROKER_ORDER.filter(b => b !== 'inside').map(b => (
            <p key={b}>
              • <strong style={{ color: BROKER_META[b].color }}>{BROKER_META[b].label}</strong> — {BROKER_META[b].hint}
            </p>
          ))}
          <p className="pt-1">
            • <strong style={{ color: BROKER_META.inside.color }}>{BROKER_META.inside.label}</strong> — {BROKER_META.inside.hint}
          </p>
        </div>
      </GlassCard>

      <BrokerKeyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        keyToEdit={editingKey}
      />
    </motion.div>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}
