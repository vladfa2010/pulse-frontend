interface DeleteKeyConfirmProps {
  onConfirm: () => void
  onCancel: () => void
  tail: string
}

export default function DeleteKeyConfirm({ onConfirm, onCancel, tail }: DeleteKeyConfirmProps) {
  return (
    <div
      className="flex items-center gap-3 w-full mt-3 px-3 py-2.5 rounded-[10px] text-[12px]"
      style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#FCA5A5' }}
    >
      <span className="flex-1">
        Удалить ключ …{tail}? Портфель останется, синхронизация остановится.
      </span>
      <button
        onClick={onConfirm}
        className="h-7 px-3 rounded-lg text-[11px] font-bold text-white bg-[#EF4444] hover:bg-[#f87171] transition-colors"
      >
        Удалить
      </button>
      <button
        onClick={onCancel}
        className="h-7 px-3 rounded-lg text-[11px] font-bold text-[#9CA3AF] bg-[#222] hover:bg-[#333] transition-colors"
      >
        Отмена
      </button>
    </div>
  )
}
