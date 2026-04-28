import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './components/common/Toast'
import ErrorBoundary from './components/common/ErrorBoundary'
import './index.css'

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
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover')
  }
  ensureViewport()
} catch {}

// Surface runtime errors on mobile/WebView instead of a blank screen.
try {
  const showFatal = (label, err) => {
    // eslint-disable-next-line no-console
    console.error(label, err)
    const msg =
      (err && (err.message || err.reason?.message)) ||
      (typeof err === 'string' ? err : '') ||
      'Unknown error'
    const el = document.createElement('div')
    el.style.position = 'fixed'
    el.style.inset = '0'
    el.style.zIndex = '2147483647'
    el.style.background = 'rgba(0,0,0,0.88)'
    el.style.color = '#fff'
    el.style.padding = '16px'
    el.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial'
    el.style.overflow = 'auto'
    el.innerHTML = `<div style=\"max-width:720px;margin:0 auto;white-space:pre-wrap;word-break:break-word;\"><div style=\"font-weight:800;font-size:18px;margin-bottom:8px;\">Xəta (mobil debug)</div><div style=\"font-size:13px;opacity:0.9;\">${label}</div><div style=\"margin-top:12px;font-size:14px;\">${msg}</div></div>`
    document.body.appendChild(el)
  }
  window.addEventListener('error', (e) => showFatal('window.error', e?.error || e?.message || e))
  window.addEventListener('unhandledrejection', (e) => showFatal('unhandledrejection', e?.reason || e))
} catch {}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary title="Mentorix açılmadı">
      <BrowserRouter>
        <ToastProvider>
          <App />
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
)
