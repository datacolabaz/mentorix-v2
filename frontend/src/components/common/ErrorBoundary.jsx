import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Keep console output for debugging in mobile WebView
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info)
    this.setState({ info })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const title = this.props.title || 'Xəta baş verdi'
    const msg = this.state.error?.message || String(this.state.error || 'Unknown error')
    const stack = this.state.error?.stack || ''

    return (
      <div className="min-h-screen w-full bg-token-surfaceMain text-token-textMain p-4 sm:p-6">
        <div className="max-w-2xl mx-auto w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
          <div className="font-display font-bold text-lg mb-2">{title}</div>
          <div className="text-sm break-words whitespace-pre-wrap">{msg}</div>
          {stack ? (
            <details className="mt-3">
              <summary className="text-xs text-token-textMuted cursor-pointer">Detallar</summary>
              <pre className="mt-2 text-[11px] leading-snug whitespace-pre-wrap break-words text-token-textMuted">
                {stack}
              </pre>
            </details>
          ) : null}
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              className="w-full sm:w-auto rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/70 hover:bg-token-surfaceCard/90 px-4 py-2 text-sm font-semibold"
              onClick={() => window.location.reload()}
            >
              Yenilə
            </button>
            <button
              type="button"
              className="w-full sm:w-auto rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/70 hover:bg-token-surfaceCard/90 px-4 py-2 text-sm font-semibold"
              onClick={() => {
                try {
                  navigator.clipboard?.writeText?.(msg + (stack ? `\n\n${stack}` : ''))
                } catch {}
              }}
            >
              Xətanı kopyala
            </button>
          </div>
        </div>
      </div>
    )
  }
}

