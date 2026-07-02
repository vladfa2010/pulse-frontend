import { registerPlugin, PluginListenerHandle } from '@capacitor/core'

export interface DownloadProgressEvent {
  progress: number
}

export interface InAppUpdater {
  downloadAndInstall(options: { url: string }): Promise<{ started: boolean }>
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: DownloadProgressEvent) => void
  ): Promise<PluginListenerHandle>
  removeAllListeners(): Promise<void>
}

export const InAppUpdater = registerPlugin<InAppUpdater>('InAppUpdater')
