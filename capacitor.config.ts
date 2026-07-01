import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.pulse.app',
  appName: 'PULSE',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    // Allow the WebView to call the production HTTPS API without mixed-content issues.
    androidScheme: 'https',
  },
}

export default config
