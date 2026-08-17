import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import { queryClient } from './lib/queryClient'
import { UnreadCountProvider } from './contexts/UnreadCountContext'
import { ToastProvider } from './components/Toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initAnalytics } from './lib/analytics'
import { initYandexMetrika } from './lib/thirdParty'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthProvider>
              <UnreadCountProvider>
                <App />
              </UnreadCountProvider>
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

// Initialize Firebase Analytics for web
initAnalytics().catch(() => {})

// Initialize Yandex.Metrika after page load without blocking it
initYandexMetrika(109728163)

// Register Firebase messaging service worker for web push ONLY
if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/firebase-messaging-sw.js')
    .catch((err) => console.warn('[SW] Registration failed:', err))
}

// build: 1779918000
// trigger deploy 1780427478
// deploy trigger 1780431417
