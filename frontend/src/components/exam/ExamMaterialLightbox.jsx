import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Rnd } from 'react-rnd'
import Button from '../common/Button'
import {
  applySnapToLeft,
  clampPanelToViewport,
  defaultPanelGeometry,
  getPanelMode,
  loadStoredPanel,
  maxContentHeight,
  maxPanelWidth,
  saveStoredPanel,
  totalPanelHeight,
} from './examMaterialPanelLayout'

const Z_INDEX = 5200

function measureIframeDocument(iframe) {
  if (!iframe) return null
  try {
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return null
    const root = doc.documentElement
    const body = doc.body
    const candidates = [
      root?.scrollHeight,
      root?.offsetHeight,
      body?.scrollHeight,
      body?.offsetHeight,
    ].filter((n) => Number.isFinite(n) && n > 0)
    if (!candidates.length) return null
    return Math.max(...candidates)
  } catch {
    return null
  }
}

function PanelMedia({ title, src, isPdf, panelWidth, contentMaxHeight, onContentHeight }) {
  const iframeRef = useRef(null)
  const [displayHeight, setDisplayHeight] = useState(() =>
    Math.min(Math.round((panelWidth || 400) * 1.35), contentMaxHeight),
  )

  const reportHeight = useCallback(
    (raw) => {
      if (!Number.isFinite(raw) || raw <= 0) return
      const next = Math.max(120, Math.min(Math.round(raw), contentMaxHeight))
      setDisplayHeight(next)
      onContentHeight(next)
    },
    [contentMaxHeight, onContentHeight],
  )

  useEffect(() => {
    const guess = Math.min(Math.round((panelWidth || 400) * 1.35), contentMaxHeight)
    setDisplayHeight(guess)
    onContentHeight(guess)
  }, [src, panelWidth, contentMaxHeight, onContentHeight])

  useEffect(() => {
    if (!isPdf || !src) return undefined
    let cancelled = false
    let attempts = 0

    const tryMeasure = () => {
      if (cancelled) return
      const measured = measureIframeDocument(iframeRef.current)
      if (measured) {
        reportHeight(measured)
        return true
      }
      return false
    }

    const timer = window.setInterval(() => {
      attempts += 1
      if (tryMeasure() || attempts >= 25) {
        window.clearInterval(timer)
      }
    }, 160)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [isPdf, src, panelWidth, reportHeight])

  if (isPdf) {
    return (
      <div
        className="shrink-0 overflow-y-auto overflow-x-hidden bg-black/40"
        style={{ maxHeight: contentMaxHeight }}
      >
        <iframe
          ref={iframeRef}
          title={title || 'PDF'}
          src={src || undefined}
          onLoad={() => {
            const measured = measureIframeDocument(iframeRef.current)
            reportHeight(measured ?? Math.min(Math.round((panelWidth || 400) * 1.35), contentMaxHeight))
          }}
          className="w-full block bg-white border-0"
          style={{ height: displayHeight, minHeight: 120 }}
        />
      </div>
    )
  }

  return (
    <div
      className="shrink-0 overflow-y-auto overflow-x-hidden bg-black/40"
      style={{ maxHeight: contentMaxHeight }}
    >
      <img
        src={src || undefined}
        alt={title || ''}
        loading="eager"
        decoding="async"
        onLoad={(e) => reportHeight(e.currentTarget.naturalHeight)}
        className="block w-full h-auto max-w-full object-contain object-top bg-black/30"
        style={{ maxHeight: contentMaxHeight }}
      />
    </div>
  )
}

export default function ExamMaterialLightbox({ open, onClose, title, src, isPdf, openInNewTabUrl }) {
  const [mode, setMode] = useState(() => getPanelMode())
  const [panel, setPanel] = useState(() => {
    const m = getPanelMode()
    return loadStoredPanel(m) || defaultPanelGeometry(m, window.innerWidth, window.innerHeight)
  })
  const [contentHeight, setContentHeight] = useState(null)
  const headerRef = useRef(null)
  const footerRef = useRef(null)
  const openRef = useRef(open)

  const chromeHeight =
    (headerRef.current?.offsetHeight ?? 0) + (footerRef.current?.offsetHeight ?? 0) || 120
  const contentMaxH = maxContentHeight(window.innerHeight, chromeHeight)

  const syncPanelHeightFromContent = useCallback(
    (mediaHeight) => {
      if (mode === 'mobile') return
      const headerH = headerRef.current?.offsetHeight ?? 72
      const footerH = footerRef.current?.offsetHeight ?? 0
      const chrome = headerH + footerH
      const nextHeight = totalPanelHeight(chrome, mediaHeight, window.innerHeight, panel.y)
      setPanel((prev) => clampPanelToViewport({ ...prev, height: nextHeight }, window.innerWidth, window.innerHeight))
    },
    [mode, panel.y],
  )

  const handleContentHeight = useCallback(
    (h) => {
      setContentHeight(h)
      syncPanelHeightFromContent(h)
    },
    [syncPanelHeightFromContent],
  )

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    if (!open) return
    const nextMode = getPanelMode(window.innerWidth)
    setMode(nextMode)
    setContentHeight(null)
    if (nextMode !== 'mobile') {
      const stored = loadStoredPanel(nextMode)
      setPanel(stored || defaultPanelGeometry(nextMode, window.innerWidth, window.innerHeight))
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open || mode === 'mobile' || contentHeight == null) return
    syncPanelHeightFromContent(contentHeight)
  }, [open, mode, contentHeight, syncPanelHeightFromContent, openInNewTabUrl])

  useEffect(() => {
    const onResize = () => {
      const nextMode = getPanelMode(window.innerWidth)
      setMode(nextMode)
      if (!openRef.current || nextMode === 'mobile') return
      setPanel((prev) => clampPanelToViewport(prev, window.innerWidth, window.innerHeight))
      if (contentHeight != null) {
        syncPanelHeightFromContent(contentHeight)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [contentHeight, syncPanelHeightFromContent])

  useEffect(() => {
    if (!open) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const persistPanel = useCallback(
    (next) => {
      if (mode === 'mobile') return
      saveStoredPanel(mode, next)
    },
    [mode],
  )

  const commitPanel = useCallback(
    (next) => {
      const clamped = clampPanelToViewport(next, window.innerWidth, window.innerHeight)
      const snapped = applySnapToLeft(clamped, mode)
      const finalPanel = clampPanelToViewport(snapped, window.innerWidth, window.innerHeight)
      setPanel(finalPanel)
      persistPanel(finalPanel)
      return finalPanel
    },
    [mode, persistPanel],
  )

  if (!open) return null

  const closeBtn = (
    <button
      type="button"
      onClick={onClose}
      className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 transition-colors"
      aria-label="Bağla"
    >
      <span aria-hidden>✕</span>
      <span>Bağla</span>
    </button>
  )

  if (mode === 'mobile') {
    const mobileNode = (
      <div
        className="fixed inset-0 flex flex-col bg-[#0a0818]/98 backdrop-blur-sm"
        style={{ zIndex: Z_INDEX }}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Material'}
      >
        <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-indigo-500/20 bg-[#13112e]/95 safe-area-top">
          <p className="text-sm font-semibold text-white truncate flex-1" title={title || 'Material'}>
            {title || 'Material'}
          </p>
          {closeBtn}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <PanelMedia
            title={title}
            src={src}
            isPdf={isPdf}
            panelWidth={window.innerWidth}
            contentMaxHeight={maxContentHeight(window.innerHeight, 72)}
            onContentHeight={() => {}}
          />
        </div>
        {openInNewTabUrl ? (
          <div className="shrink-0 px-4 py-3 border-t border-indigo-500/20 bg-[#13112e]/90 safe-area-bottom">
            <a href={openInNewTabUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="secondary" size="sm" className="w-full">
                Yeni pəncərədə aç
              </Button>
            </a>
          </div>
        ) : null}
      </div>
    )
    return typeof document !== 'undefined' ? createPortal(mobileNode, document.body) : mobileNode
  }

  const resizeHandleWidth = mode === 'tablet' ? 44 : 14
  const resizeHandleOffset = mode === 'tablet' ? -22 : -7

  const desktopNode = (
    <>
      <div
        className="fixed inset-0 bg-black/20 pointer-events-none"
        style={{ zIndex: Z_INDEX - 1 }}
        aria-hidden
      />
      <Rnd
        size={{ width: panel.width, height: panel.height }}
        position={{ x: panel.x, y: panel.y }}
        bounds="window"
        minWidth={320}
        maxWidth={maxPanelWidth(window.innerWidth)}
        minHeight={panel.height}
        maxHeight={panel.height}
        dragHandleClassName="exam-material-panel-drag-handle"
        enableResizing={{
          top: false,
          right: true,
          bottom: false,
          left: false,
          topRight: false,
          bottomRight: false,
          bottomLeft: false,
          topLeft: false,
        }}
        resizeHandleStyles={{
          right: {
            width: resizeHandleWidth,
            right: resizeHandleOffset,
            cursor: 'ew-resize',
            zIndex: 2,
          },
        }}
        resizeHandleClasses={{
          right: mode === 'tablet' ? 'exam-material-panel-resize-handle-tablet' : 'exam-material-panel-resize-handle',
        }}
        onDragStop={(_e, data) => {
          commitPanel({
            x: data.x,
            y: data.y,
            width: panel.width,
            height: panel.height,
          })
        }}
        onResizeStop={(_e, _dir, ref, _delta, position) => {
          const nextWidth = ref.offsetWidth
          commitPanel({
            x: position.x,
            y: position.y,
            width: nextWidth,
            height: panel.height,
          })
          if (contentHeight != null) {
            syncPanelHeightFromContent(contentHeight)
          }
        }}
        className="!fixed flex flex-col overflow-hidden rounded-2xl border border-indigo-500/30 bg-[#13112e] shadow-2xl shadow-black/50"
        style={{ zIndex: Z_INDEX }}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Material'}
      >
        <div
          ref={headerRef}
          className="exam-material-panel-drag-handle shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-indigo-500/20 bg-[#1a1740]/90 cursor-move select-none touch-none"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate" title={title || 'Material'}>
              {title || 'Material'}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5 hidden sm:block">Sürükləmək üçün tutun · ↔ eni dəyişin</p>
          </div>
          {closeBtn}
        </div>

        <PanelMedia
          title={title}
          src={src}
          isPdf={isPdf}
          panelWidth={panel.width}
          contentMaxHeight={contentMaxH}
          onContentHeight={handleContentHeight}
        />

        {openInNewTabUrl ? (
          <div
            ref={footerRef}
            className="shrink-0 px-3 py-2 border-t border-indigo-500/15 flex justify-end bg-[#13112e]"
          >
            <a href={openInNewTabUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm">
                Yeni pəncərədə aç
              </Button>
            </a>
          </div>
        ) : (
          <div ref={footerRef} className="hidden" aria-hidden />
        )}
      </Rnd>
      <style>{`
        .exam-material-panel-resize-handle-tablet {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .exam-material-panel-resize-handle-tablet::after {
          content: '↔';
          font-size: 14px;
          line-height: 1;
          color: rgba(147, 197, 253, 0.95);
          pointer-events: none;
        }
        .exam-material-panel-resize-handle::after {
          content: '';
          position: absolute;
          inset: 20% 40%;
          border-radius: 9999px;
          background: rgba(129, 140, 248, 0.55);
          pointer-events: none;
        }
      `}</style>
    </>
  )

  return typeof document !== 'undefined' ? createPortal(desktopNode, document.body) : desktopNode
}
