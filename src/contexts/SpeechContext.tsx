/**
 * PULSE — Глобальный контекст для useSpeech() (ТЗ-67).
 *
 * До ТЗ-67 useSpeech() создавал свой Audio элемент и state в каждом компоненте,
 * который его вызывал. При навигации со страницы /radio Audio терялся — эфир
 * нельзя было слушать на других страницах.
 *
 * Теперь useSpeech() живёт ОДИН раз в SpeechProvider (App.tsx), Audio создаётся
 * при mount провайдера. Все потребители (GlobalPlayerBar, RadioPage и др.)
 * читают state через useSpeechContext().
 *
 * Опции useSpeech (onEntryStart, provider, голоса, tagMap) зависят от RadioPage
 * — провайдер создаёт хук БЕЗ опций, а RadioPage прокидывает их через
 * speech.updateOptions() (паттерн «latest ref» внутри useSpeech).
 */
import { createContext, useContext, ReactNode } from 'react'
import { useSpeech, UseSpeechReturn } from '@/hooks/useSpeech'

const SpeechContext = createContext<UseSpeechReturn | null>(null)

export function SpeechProvider({ children }: { children: ReactNode }) {
  const speech = useSpeech()

  return (
    <SpeechContext.Provider value={speech}>
      {children}
    </SpeechContext.Provider>
  )
}

/**
 * Хук для потребителей. Бросает если использован вне SpeechProvider —
 * это сигнал что App.tsx не обернул роуты.
 */
export function useSpeechContext(): UseSpeechReturn {
  const ctx = useContext(SpeechContext)
  if (!ctx) {
    throw new Error('useSpeechContext must be used inside <SpeechProvider>')
  }
  return ctx
}
