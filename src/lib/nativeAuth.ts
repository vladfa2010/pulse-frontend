import { Capacitor } from '@capacitor/core'

const TOKEN_KEY = 'pulse_token'

/**
 * Сохранить JWT в Capacitor Preferences (читается Kotlin VoteReceiver).
 * Вызывать после login / register / session restore.
 */
export async function saveTokenToNativeStorage(token: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { Preferences } = await import('@capacitor/preferences')
  await Preferences.set({ key: TOKEN_KEY, value: token })
}

/**
 * Удалить JWT из нативного хранилища (при logout).
 */
export async function clearNativeStorage(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { Preferences } = await import('@capacitor/preferences')
  await Preferences.remove({ key: TOKEN_KEY })
}
