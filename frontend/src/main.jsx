import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ToastProvider } from './components/common/Toast'
import ErrorBoundary from './components/common/ErrorBoundary'
import './index.css'
import './styles/livekit-override.css'
import 'leaflet/dist/leaflet.css'

// Some WebViews/devices can ignore static viewport; enforce on runtime too.
try {
  const ensureViewport = () => {
    const head = document.head || document.getElementsByTagName('head')[0]
    if (!head) return
    let meta = document.querySelector('meta[name="viewport"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'viewport')
      head.appendChild(meta)
    }
    meta.setAttribute(
      'content',
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover',
    )
  }
  ensureViewport()
} catch {}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 20000,
      gcTime: 5 * 60 * 1000,
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary title="Mentorix açılmadı">
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <App />
          </ToastProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
