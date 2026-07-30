import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import { useBrokerKeyMutations } from '@/hooks/useBrokerKeys'
import GlassModal, { ModalField, ModalActions, GradientButton, GhostButton, ModalInput, ModalSelect } from '@/components/GlassModal'
import { BROKER_META, BROKER_ORDER, type Broker } from '@/types/portfolio'
import type { BrokerKey } from '@/types/portfolio'

interface BrokerKeyModalProps {
  open: boolean
  onClose: () => void
  keyToEdit?: BrokerKey | null
}

export default function BrokerKeyModal({ open, onClose, keyToEdit }: BrokerKeyModalProps) {
  const [broker, setBroker] = useState<Broker>('finam')
  const [label, setLabel] = useState('')
  const [token, setToken] = useState('')
  const { toastError } = useToast()
  const { createBrokerKey, updateBrokerKey } = useBrokerKeyMutations()

  const isEdit = !!keyToEdit
  const loading = createBrokerKey.isPending || updateBrokerKey.isPending

  useEffect(() => {
    if (!open) return
    if (keyToEdit) {
      setBroker(keyToEdit.broker)
      setLabel(keyToEdit.label || '')
      setToken('')
    } else {
      setBroker('finam')
      setLabel('')
      setToken('')
    }
  }, [open, keyToEdit])

  const handleClose = () => {
    if (!loading) onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanLabel = label.trim() || `Ключ ${BROKER_META[broker].label}`
    const cleanToken = token.trim()
    if (!isEdit && cleanToken.length < 8) {
      toastError('Вставьте API-ключ брокера')
      return
    }
    if (isEdit) {
      await updateBrokerKey.mutateAsync({
        id: keyToEdit!.id,
        body: { label: cleanLabel, ...(cleanToken ? { token: cleanToken } : {}) },
      })
    } else {
      await createBrokerKey.mutateAsync({ broker, label: cleanLabel, token: cleanToken })
    }
    onClose()
  }

  return (
    <GlassModal
      open={open}
      onClose={handleClose}
      title={isEdit ? 'Редактировать ключ' : 'Добавить API-ключ'}
    >
      <form onSubmit={handleSubmit}>
        <ModalField label="Брокер">
          <ModalSelect value={broker} onChange={v => setBroker(v as Broker)} disabled={isEdit}>
            {BROKER_ORDER.map(b => (
              <option key={b} value={b}>{BROKER_META[b].label}</option>
            ))}
          </ModalSelect>
        </ModalField>

        <ModalField label="Название ключа">
          <ModalInput
            value={label}
            onChange={setLabel}
            placeholder="Основной счёт"
          />
        </ModalField>

        <ModalField
          label={
            <span>
              API-ключ <span className="text-[#34D399] normal-case">· только чтение</span>
            </span>
          }
          hint={BROKER_META[broker].hint}
        >
          <ModalInput
            value={token}
            onChange={setToken}
            placeholder={isEdit ? `••••${keyToEdit?.tail} — оставьте пустым, чтобы не менять` : 'Вставьте токен'}
          />
        </ModalField>

        <ModalActions>
          <GradientButton loading={loading} disabled={loading}>
            {isEdit ? 'Сохранить' : 'Проверить и сохранить'}
          </GradientButton>
          <GhostButton onClick={handleClose} type="button">Отмена</GhostButton>
        </ModalActions>
      </form>
    </GlassModal>
  )
}
