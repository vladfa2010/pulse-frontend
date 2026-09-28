/**
 * =============================================================================
 * PULSE — Радио: общий WebAudio AudioContext (TZ71)
 * =============================================================================
 *
 * Один AudioContext на сессию с тремя GainNode:
 *
 *   music <audio> ─► MediaElementAudioSourceNode ─► musicGain (0.3) ─┐
 *   sfx   <audio> ─► MediaElementAudioSourceNode ─► sfxGain   (1.0) ─┤─► destination
 *   tts   <audio> ─► MediaElementAudioSourceNode ─► ttsGain   (1.0) ─┘
 *
 * Зачем: sample-precise fade'ы (linearRamp на audio thread вместо setInterval
 * по volume), SFX-cue поверх музыки, единый микс вместо разрозненных <audio>.
 *
 * Жизненный цикл:
 *   - ленивое создание (ensureAudio) — НЕ до первого user gesture: браузеры
 *     стартуют контекст в suspended; создать можно, звук пойдёт после resume;
 *   - AudioContextProvider вешает gesture-listeners (click/keydown/touchstart)
 *     и зовёт resumeAudio(); дополнительно resume на visibilitychange
 *     (Chrome суспендит контекст неактивной вкладки);
 *   - <audio>-элементы каналов персистентные (getMusicElement/getSfxElement/
 *     getTtsElement): один MediaElementAudioSourceNode на элемент, переиспользуем
 *     его меняя src. Создавать source на КАЖДЫй new Audio() утёк бы в узлы графа.
 *
 * Константы gain/fade — в @/lib/radio/config (PULSE_AUDIO_*).
 */

import {
  PULSE_AUDIO_GAIN_MUSIC,
  PULSE_AUDIO_GAIN_SFX,
  PULSE_AUDIO_GAIN_TTS,
  PULSE_AUDIO_MUSIC_FADE_IN_MS,
  MUSIC_FADE_OUT_MS,
} from '@/lib/radio/config'

let ctx: AudioContext | null = null
let musicGain: GainNode | null = null
let sfxGain: GainNode | null = null
let ttsGain: GainNode | null = null

let musicEl: HTMLAudioElement | null = null
let sfxEl: HTMLAudioElement | null = null
let ttsEl: HTMLAudioElement | null = null

/** Создать AudioContext и gain-каналы (idempotent). Вызывать лениво. */
export function ensureAudio(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) throw new Error('AudioContext не поддерживается')
    ctx = new AC()

    musicGain = ctx.createGain()
    musicGain.gain.value = PULSE_AUDIO_GAIN_MUSIC
    musicGain.connect(ctx.destination)

    sfxGain = ctx.createGain()
    sfxGain.gain.value = PULSE_AUDIO_GAIN_SFX
    sfxGain.connect(ctx.destination)

    ttsGain = ctx.createGain()
    ttsGain.gain.value = PULSE_AUDIO_GAIN_TTS
    ttsGain.connect(ctx.destination)
  }
  return ctx
}

/** Контекст создан (не обязательно running). */
export function hasAudio(): boolean {
  return ctx !== null
}

/** Разбудить контекст после user gesture / возврата во вкладку. */
export function resumeAudio(): void {
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume().catch(() => {})
  }
}

export function getMusicGain(): GainNode {
  ensureAudio()
  return musicGain!
}

export function getSfxGain(): GainNode {
  ensureAudio()
  return sfxGain!
}

/** Персистентный <audio> канала music, подключённый к musicGain. */
export function getMusicElement(): HTMLAudioElement {
  if (!musicEl) {
    const c = ensureAudio()
    musicEl = new Audio()
    musicEl.preload = 'none'
    musicEl.crossOrigin = 'anonymous'
    const source = c.createMediaElementSource(musicEl)
    source.connect(musicGain!)
  }
  return musicEl
}

/** Персистентный <audio> канала sfx, подключённый к sfxGain. */
export function getSfxElement(): HTMLAudioElement {
  if (!sfxEl) {
    const c = ensureAudio()
    sfxEl = new Audio()
    sfxEl.preload = 'none'
    sfxEl.crossOrigin = 'anonymous'
    const source = c.createMediaElementSource(sfxEl)
    source.connect(sfxGain!)
  }
  return sfxEl
}

/** Персистентный <audio> канала tts, подключённый к ttsGain. */
export function getTtsElement(): HTMLAudioElement {
  if (!ttsEl) {
    const c = ensureAudio()
    ttsEl = new Audio()
    ttsEl.preload = 'none'
    const source = c.createMediaElementSource(ttsEl)
    source.connect(ttsGain!)
  }
  return ttsEl
}

/**
 * Fade-out музыки до 0 за MUSIC_FADE_OUT_MS (sample-precise, audio thread).
 * onComplete — через то же время на main thread (для pause после нуля gain'а).
 */
export function fadeOutMusic(onComplete?: () => void): void {
  if (!ctx || !musicGain) return
  const now = ctx.currentTime
  const fadeSec = MUSIC_FADE_OUT_MS / 1000
  musicGain.gain.cancelScheduledValues(now)
  musicGain.gain.setValueAtTime(musicGain.gain.value, now)
  musicGain.gain.linearRampToValueAtTime(0, now + fadeSec)
  if (onComplete) setTimeout(onComplete, MUSIC_FADE_OUT_MS)
}

/** Fade-in музыки до target за PULSE_AUDIO_MUSIC_FADE_IN_MS. */
export function fadeInMusic(target = PULSE_AUDIO_GAIN_MUSIC): void {
  if (!ctx || !musicGain) return
  const now = ctx.currentTime
  const fadeSec = PULSE_AUDIO_MUSIC_FADE_IN_MS / 1000
  musicGain.gain.cancelScheduledValues(now)
  musicGain.gain.setValueAtTime(musicGain.gain.value, now)
  musicGain.gain.linearRampToValueAtTime(target, now + fadeSec)
}

/** Немедленный сброс gain'а музыки (без fade) — для выключения тумблером. */
export function stopMusicGain(): void {
  if (!ctx || !musicGain) return
  const now = ctx.currentTime
  musicGain.gain.cancelScheduledValues(now)
  musicGain.gain.setValueAtTime(0, now)
}
