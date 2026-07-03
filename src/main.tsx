import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import { queryClient } from './lib/queryClient'
import { initAnalytics } from './lib/analytics'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </HashRouter>
  </React.StrictMode>,
)

// Initialize Firebase Analytics for web
initAnalytics().catch(() => {})

// Register Firebase messaging service worker for web push ONLY
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/firebase-messaging-sw.js')
    .catch((err) => console.warn('[SW] Registration failed:', err))
}

// build: 1779918000
// trigger deploy 1780427478
// deploy trigger 1780431417
