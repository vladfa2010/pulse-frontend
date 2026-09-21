/** «пилик» через WebAudio — обычная новость; тройной сигнал при score ≥ 8.5.
 *  Порт radio-app/src/lib/sound.ts без правок (ТЗ-44: триггер beepCritical —
 *  score ≥ 8.5, severity больше нет — решает вызывающий код). */

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      ctx = new AC()
    }
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
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
  osc.connect(g).connect(c.destination)
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
