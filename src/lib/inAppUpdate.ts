import { registerPlugin } from '@capacitor/core'

export interface InAppUpdater {
  downloadAndInstall(options: { url: string }): Promise<{ started: boolean }>
}

export const InAppUpdater = registerPlugin<InAppUpdater>('InAppUpdater')
