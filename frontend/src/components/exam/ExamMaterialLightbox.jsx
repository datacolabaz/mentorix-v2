import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Rnd } from 'react-rnd'
import Button from '../common/Button'
import {
  applySnapToLeft,
  clampPanelToViewport,
  defaultPanelGeometry,
  getPanelMode,
  loadStoredPanel,
  maxPanelWidth,
  saveStoredPanel,
} from './examMaterialPanelLayout'

const Z_INDEX = 5200

function PanelMedia({ title, src, isPdf }) {
  return (
    <div className="flex-1 min-h-0 overflow-hidden bg-black/40">
      {isPdf ? (
        <iframe
          title={title || 'PDF'}
          src={src || undefined}
          className="w-full h-full min-h-[200px] bg-white border-0"
        />
      ) : (
        <img
          src={src || undefined}
          alt={title || ''}
          className="w-full h-full object-contain bg-black/50"
        />
      )}
    </div>
  )
}

export default function ExamMaterialLightbox({ open, onClose, title, src, isPdf, openInNewTabUrl }) {
  const [mode, setMode] = useState(() => getPanelMode())
  const [panel, setPanel] = useState(() => {
    const m = getPanelMode()
    return loadStoredPanel(m) || defaultPanelGeometry(m, window.innerWidth, window.innerHeight)
  })
  const openRef = useRef(open)

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    if (!open) return
    const nextMode = getPanelMode(window.innerWidth)
    setMode(nextMode)
    if (nextMode !== 'mobile') {
      const stored = loadStoredPanel(nextMode)
      setPanel(stored || defaultPanelGeometry(nextMode, window.innerWidth, window.innerHeight))
    }
  }, [open])

  useEffect(() => {
    const onResize = () => {
      const nextMode = getPanelMode(window.innerWidth)
      setMode(nextMode)
      if (!openRef.current || nextMode === 'mobile') return
      setPanel((prev) => clampPanelToViewport(prev, window.innerWidth, window.innerHeight))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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
      const snapped = applySnapToLeft(clamped, mode, window.innerHeight)
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
        <div className="flex-1 min-h-0 flex flex-col">
          <PanelMedia title={title} src={src} isPdf={isPdf} />
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
        minHeight={200}
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
          commitPanel({
            x: position.x,
            y: position.y,
            width: ref.offsetWidth,
            height: ref.offsetHeight,
          })
        }}
        className="!fixed flex flex-col overflow-hidden rounded-2xl border border-indigo-500/30 bg-[#13112e] shadow-2xl shadow-black/50"
        style={{ zIndex: Z_INDEX }}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Material'}
      >
        <div className="exam-material-panel-drag-handle shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-indigo-500/20 bg-[#1a1740]/90 cursor-move select-none touch-none">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate" title={title || 'Material'}>
              {title || 'Material'}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5 hidden sm:block">Sürükləmək üçün tutun · ↔ eni dəyişin</p>
          </div>
          {closeBtn}
        </div>

        <PanelMedia title={title} src={src} isPdf={isPdf} />

        {openInNewTabUrl ? (
          <div className="shrink-0 px-3 py-2 border-t border-indigo-500/15 flex justify-end">
            <a href={openInNewTabUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm">
                Yeni pəncərədə aç
              </Button>
            </a>
          </div>
        ) : null}
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
