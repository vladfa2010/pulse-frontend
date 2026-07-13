/**
 * =============================================================================
 * PULSE — Sound utility
 * =============================================================================
 *
 * Программно генерируемый «water drop» chime для новостей.
 * Web Audio API, без внешних файлов.
 */

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()

let lastChimeAt = 0
const CHIME_DEBOUNCE_MS = 3000

export function playNewsChime() {
  const now = Date.now()
  if (now - lastChimeAt < CHIME_DEBOUNCE_MS) return
  lastChimeAt = now

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }

  const t = audioCtx.currentTime
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()

  osc.type = 'sine'
  // Frequency glide: 600 → 1400 Hz (water drop character)
  osc.frequency.setValueAtTime(600, t)
  osc.frequency.exponentialRampToValueAtTime(1400, t + 0.09)

  // Envelope: 3ms attack, exponential decay over 180ms
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.25, t + 0.003)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)

  osc.connect(gain)
  gain.connect(audioCtx.destination)

  osc.start(t)
  osc.stop(t + 0.19)
}
