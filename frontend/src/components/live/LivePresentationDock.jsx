import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PresentationStage from '../presentations/PresentationStage'
import PresentationToolbar from '../presentations/PresentationToolbar'
import LivePollOverlay, { LivePollComposer } from './LivePollOverlay'

export default function LivePresentationDock({ live, isInstructor }) {
  const { t } = useTranslation()
  const [askOpen, setAskOpen] = useState(false)
  const slideIndex = live.slideIndex
  const page = live.page

  const broadcastStrokes = (next) => {
    live.syncStrokes(next)
  }

  return (
    <div className="relative h-full min-h-0 flex flex-col bg-black/40">
      <div className="px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        <p className="text-xs text-white/80 truncate">{live.presentation?.title}</p>
        {isInstructor ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAskOpen(true)}
              className="h-8 px-2 rounded-lg text-[11px] font-semibold border border-white/15 text-white hover:bg-white/10"
            >
              {t('live.presentation.ask')}
            </button>
            <button
              type="button"
              onClick={() => void live.closePresentation()}
              className="h-8 px-2 rounded-lg text-[11px] font-semibold border border-red-400/30 text-red-200 hover:bg-red-500/10"
            >
              {t('live.presentation.stop')}
            </button>
          </div>
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-white/50">
            {t('live.presentation.liveBadge')}
          </span>
        )}
      </div>
      <div className="relative flex-1 min-h-0">
        {live.pdfLoading || !live.pdf ? (
          <div className="h-full flex items-center justify-center text-sm text-white/60">
            {t('presentations.viewer.loadingPdf')}
          </div>
        ) : (
          <PresentationStage
            pdf={live.pdf}
            page={page}
            fit
            strokes={live.annotations.strokesFor(slideIndex)}
            tool={isInstructor ? live.annotations.tool : 'pen'}
            defaults={live.annotations.defaults}
            onCommit={isInstructor ? live.commitStrokes : undefined}
            enabled={isInstructor}
            className="h-full"
          />
        )}
        <LivePollOverlay
          poll={live.poll}
          isInstructor={isInstructor}
          onVote={live.votePoll}
          onClose={live.closePoll}
        />
      </div>
      {isInstructor ? (
        <div className="shrink-0 flex justify-center p-2">
          <PresentationToolbar
            mode="present"
            page={page}
            pageCount={live.pageCount}
            tool={live.annotations.tool}
            onTool={live.annotations.setTool}
            onPrev={() => void live.goSlide(slideIndex - 1)}
            onNext={() => void live.goSlide(slideIndex + 1)}
            onUndo={() => broadcastStrokes(live.annotations.undo(slideIndex))}
            onRedo={() => broadcastStrokes(live.annotations.redo(slideIndex))}
            canUndo={live.annotations.canUndo(slideIndex)}
            canRedo={live.annotations.canRedo(slideIndex)}
            onClear={() => live.commitStrokes([])}
            onExit={() => void live.closePresentation()}
          />
        </div>
      ) : (
        <p className="shrink-0 text-center text-[11px] text-white/50 py-2">
          {t('presentations.viewer.slide', { current: page, total: live.pageCount || 0 })}
        </p>
      )}
      {isInstructor ? (
        <LivePollComposer open={askOpen} onClose={() => setAskOpen(false)} onSubmit={live.startPoll} />
      ) : null}
    </div>
  )
}
