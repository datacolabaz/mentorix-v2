import { useTranslation } from 'react-i18next'

function ToolButton({ active, onClick, title, children, danger = false, disabled = false }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={[
        'h-9 min-w-9 px-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1 transition-colors',
        danger
          ? 'text-red-200 hover:bg-red-500/15'
          : active
            ? 'bg-primary text-[#041018]'
            : 'text-white/85 hover:bg-white/10',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default function PresentationToolbar({
  mode = 'viewer',
  page,
  pageCount,
  tool,
  onTool,
  onPrev,
  onNext,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
  onFit,
  onZoomIn,
  onZoomOut,
  onFullscreen,
  fullscreen,
  onPresent,
  onExit,
}) {
  const { t } = useTranslation()

  return (
    <div
      className={[
        'flex flex-wrap items-center justify-center gap-1 rounded-2xl border border-white/10 bg-black/70 backdrop-blur px-2 py-1.5',
        mode === 'present' ? 'shadow-[0_10px_30px_rgba(0,0,0,0.35)]' : '',
      ].join(' ')}
    >
      <ToolButton title={t('presentations.viewer.prev')} onClick={onPrev}>‹</ToolButton>
      <span className="px-2 text-[11px] text-white/80 tabular-nums min-w-[4.5rem] text-center">
        {t('presentations.viewer.slide', { current: page, total: pageCount || 0 })}
      </span>
      <ToolButton title={t('presentations.viewer.next')} onClick={onNext}>›</ToolButton>

      <span className="w-px h-5 bg-white/15 mx-1" />

      <ToolButton title={t('presentations.tools.pen')} active={tool === 'pen'} onClick={() => onTool('pen')}>
        ✎
      </ToolButton>
      <ToolButton title={t('presentations.tools.highlighter')} active={tool === 'highlighter'} onClick={() => onTool('highlighter')}>
        ▮
      </ToolButton>
      <ToolButton title={t('presentations.tools.eraser')} active={tool === 'eraser'} onClick={() => onTool('eraser')}>
        ⌫
      </ToolButton>
      <ToolButton title={t('presentations.tools.undo')} onClick={onUndo} disabled={!canUndo}>
        <span className={canUndo ? '' : 'opacity-40'}>↶</span>
      </ToolButton>
      <ToolButton title={t('presentations.tools.redo')} onClick={onRedo} disabled={!canRedo}>
        <span className={canRedo ? '' : 'opacity-40'}>↷</span>
      </ToolButton>
      <ToolButton title={t('presentations.tools.clear')} onClick={onClear} danger>
        {t('presentations.tools.clear')}
      </ToolButton>

      {mode === 'viewer' ? (
        <>
          <span className="w-px h-5 bg-white/15 mx-1" />
          <ToolButton title={t('presentations.viewer.zoomOut')} onClick={onZoomOut}>−</ToolButton>
          <ToolButton title={t('presentations.viewer.fit')} onClick={onFit}>
            {t('presentations.viewer.fit')}
          </ToolButton>
          <ToolButton title={t('presentations.viewer.zoomIn')} onClick={onZoomIn}>+</ToolButton>
        </>
      ) : null}

      <span className="w-px h-5 bg-white/15 mx-1" />
      <ToolButton
        title={fullscreen ? t('presentations.viewer.exitFullscreen') : t('presentations.viewer.fullscreen')}
        onClick={onFullscreen}
      >
        {fullscreen ? '⤢' : '⛶'}
      </ToolButton>

      {mode === 'viewer' && onPresent ? (
        <ToolButton title={t('presentations.viewer.present')} active onClick={onPresent}>
          {t('presentations.viewer.present')}
        </ToolButton>
      ) : null}

      {mode === 'present' && onExit ? (
        <ToolButton title={t('presentations.tools.exit')} onClick={onExit} danger>
          {t('presentations.tools.exit')}
        </ToolButton>
      ) : null}
    </div>
  )
}
