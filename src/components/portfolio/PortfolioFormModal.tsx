import { useState } from 'react'
import { useToast } from '@/hooks/useToast'
import { useCreateBrokerKeyForPortfolio, usePortfolioMutations } from '@/hooks/usePortfolio'
import GlassModal, { ModalField, ModalActions, GradientButton, GhostButton, ModalInput, ModalSelect } from '@/components/GlassModal'
import { BROKER_META, BROKER_ORDER, type Broker } from '@/types/portfolio'

interface PortfolioFormModalProps {
  open: boolean
  onClose: () => void
}

export default function PortfolioFormModal({ open, onClose }: PortfolioFormModalProps) {
  const [broker, setBroker] = useState<Broker>('finam')
  const [token, setToken] = useState('')
  const [name, setName] = useState('')
  const { toastError } = useToast()
  const createKey = useCreateBrokerKeyForPortfolio()
  const createPortfolio = usePortfolioMutations().createPortfolio

  const loading = createKey.isPending || createPortfolio.isPending

  const reset = () => {
    setBroker('finam')
    setToken('')
    setName('')
  }

  const handleClose = () => {
    if (!loading) {
      reset()
      onClose()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (token.trim().length < 8) {
      toastError('Вставьте API-ключ брокера')
      return
    }
    const meta = BROKER_META[broker]
    const label = name.trim() || `Портфель ${meta.label}`
    const keyRes = await createKey.mutateAsync({ broker, label, token: token.trim() })
    if (!keyRes?.id) return
    await createPortfolio.mutateAsync({
      broker,
      name: label,
      brokerKeyId: keyRes.id,
    })
    reset()
    onClose()
  }

  return (
    <GlassModal open={open} onClose={handleClose} title="Новый портфель">
      <form onSubmit={handleSubmit}>
        <ModalField label="Брокер">
          <ModalSelect value={broker} onChange={v => setBroker(v as Broker)}>
            {BROKER_ORDER.map(b => (
              <option key={b} value={b}>{BROKER_META[b].label}</option>
            ))}
          </ModalSelect>
        </ModalField>

        <ModalField
          label={
            <span>
              API-ключ <span className="text-[#34D399] normal-case">· только чтение · REST</span>
            </span>
          }
          hint={
            <>
              <span className="block mb-1">Где взять: {BROKER_META[broker].hint}</span>
              <span>🔒 Ключ read-only: доступа к деньгам и торговле у него нет. Храним зашифрованным, показываем только последние 4 символа. Удалить ключ можно в любой момент в профиле.</span>
            </>
          }
        >
          <ModalInput
            value={token}
            onChange={setToken}
            placeholder="Вставьте токен из личного кабинета брокера"
          />
        </ModalField>

        <ModalField
          label="Название"
          hint="Оставьте пустым — подставим «Портфель {брокер}»"
        >
          <ModalInput
            value={name}
            onChange={setName}
            placeholder={`Портфель ${BROKER_META[broker].label}`}
          />
        </ModalField>

        <ModalActions>
          <GradientButton loading={loading} disabled={loading}>
            Создать
          </GradientButton>
          <GhostButton onClick={handleClose} type="button">Отмена</GhostButton>
        </ModalActions>
      </form>
    </GlassModal>
  )
}
