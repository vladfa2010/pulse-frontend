// ТЗ-123 (Android TV): глобальный стек открытых модалок.
// useModalFocusTrap пушит/попает id при открытии/закрытии; useBackButton
// смотрит hasOpenModal() — Back пульта закрывает верхнюю модалку вместо
// навигации назад. Модульный стек (не window.__openModals) — типобезопасно
// и не светится наружу.

const stack: symbol[] = []

export function pushModal(id: symbol): void {
  stack.push(id)
}

export function popModal(id: symbol): void {
  const idx = stack.lastIndexOf(id)
  if (idx >= 0) stack.splice(idx, 1)
}

export function hasOpenModal(): boolean {
  return stack.length > 0
}
