/** «пилик» через WebAudio — обычная новость; тройной сигнал при score ≥ 8.5.
 *  Порт radio-app/src/lib/sound.ts (ТЗ-44: триггер beepCritical — score ≥ 8.5,
 *  severity больше нет — решает вызывающий код).
 *
 *  TZ71: единый AudioContext из services/audioContext.ts — тоны идут через
 *  sfxGain (default 1.0), а не в ctx.destination напрямую: синтетический
 *  «пилик» и файловые SFX из библиотеки звучат на одном уровне. */

import { ensureAudio, resumeAudio, getSfxGain } from '@/services/audioContext'

function getCtx(): AudioContext | null {
  try {
    const c = ensureAudio()
    resumeAudio()
    return c
  } catch {
    return null
  }
}

function tone(c: AudioContext, freq: number, start: number, dur: number, gain = 0.08) {
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  g.gain.setValueAtTime(0, c.currentTime + start)
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur)
  osc.connect(g).connect(getSfxGain())
  osc.start(c.currentTime + start)
  osc.stop(c.currentTime + start + dur + 0.02)
}

/** «пилик» — обычная новость */
export function beep() {
  const c = getCtx()
  if (!c) return
  tone(c, 880, 0, 0.12)
  tone(c, 1320, 0.13, 0.16)
}

/** тройной сигнал — важная новость (score ≥ 8.5) */
export function beepCritical() {
  const c = getCtx()
  if (!c) return
  tone(c, 660, 0, 0.11, 0.1)
  tone(c, 660, 0.15, 0.11, 0.1)
  tone(c, 990, 0.3, 0.22, 0.11)
}

/** разбудить аудиоконтекст жестом пользователя */
export function unlockAudio() {
  getCtx()
}
