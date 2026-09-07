import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import PhoneVerificationGate from '../../components/auth/PhoneVerificationGate'
import { useToast } from '../../components/common/Toast'
import { presentationFileOpenUrl } from '../../lib/presentationFileUrl'
import usePdfDocument from '../../hooks/usePdfDocument'
import usePresentationAnnotations from '../../hooks/usePresentationAnnotations'
import PresentationStage from '../../components/presentations/PresentationStage'
import PresentationToolbar from '../../components/presentations/PresentationToolbar'

export default function InstructorPresentationPresent() {
  const { id } = useParams()
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const rootRef = useRef(null)

  const [meta, setMeta] = useState(null)
  const [initialAnnotations, setInitialAnnotations] = useState({})
  const [page, setPage] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get(`/presentations/${id}`)
        if (cancelled) return
        if (res?.success) {
          setMeta(res.presentation)
          setInitialAnnotations(res.annotations || {})
        }
      } catch (e) {
        if (!cancelled) {
          toast(e?.message || t('presentations.toasts.loadFailed'), 'error')
          navigate('/instructor/presentations')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, navigate, t, toast])

  const fileUrl = useMemo(() => (meta?.file_url ? presentationFileOpenUrl(meta.file_url) : ''), [meta])
  const { pdf, pageCount, loading: pdfLoading, error: pdfError } = usePdfDocument(fileUrl)
  const annotations = usePresentationAnnotations(id, initialAnnotations)

  const go = useCallback((next) => {
    if (!pageCount) return
    setPage(Math.min(pageCount, Math.max(1, next)))
  }, [pageCount])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        go(page + 1)
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(page - 1)
      if (e.key === 'Escape') navigate(`/instructor/presentations/${id}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, page, id, navigate])

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {})
      return
    }
    rootRef.current?.requestFullscreen?.().catch(() => {})
  }

  const slideIndex = page - 1

  return (
    <div ref={rootRef} className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <PhoneVerificationGate />
      <div className="flex-1 min-h-0 px-3 sm:px-6 pt-4 pb-20">
        {pdfError ? (
          <div className="h-full flex items-center justify-center text-sm text-red-300/90">
            {t('presentations.viewer.loadFailed')}
          </div>
        ) : pdfLoading || !pdf ? (
          <div className="h-full flex items-center justify-center text-sm text-white/60">
            {t('presentations.viewer.loadingPdf')}
          </div>
        ) : (
          <PresentationStage
            pdf={pdf}
            page={page}
            fit
            zoom={1}
            strokes={annotations.strokesFor(slideIndex)}
            tool={annotations.tool}
            defaults={annotations.defaults}
            onCommit={(next) => annotations.setSlideStrokes(slideIndex, next)}
            className="h-[calc(100vh-6.5rem)]"
          />
        )}
      </div>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(96vw,920px)]">
        <PresentationToolbar
          mode="present"
          page={page}
          pageCount={pageCount}
          tool={annotations.tool}
          onTool={annotations.setTool}
          onPrev={() => go(page - 1)}
          onNext={() => go(page + 1)}
          onUndo={() => annotations.undo(slideIndex)}
          onRedo={() => annotations.redo(slideIndex)}
          canUndo={annotations.canUndo(slideIndex)}
          canRedo={annotations.canRedo(slideIndex)}
          onClear={() => annotations.clearSlide(slideIndex)}
          onFullscreen={toggleFullscreen}
          fullscreen={fullscreen}
          onExit={() => navigate(`/instructor/presentations/${id}`)}
        />
      </div>
    </div>
  )
}
