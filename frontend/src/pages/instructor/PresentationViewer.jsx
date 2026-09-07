import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { presentationFileOpenUrl } from '../../lib/presentationFileUrl'
import usePdfDocument from '../../hooks/usePdfDocument'
import usePresentationAnnotations from '../../hooks/usePresentationAnnotations'
import PresentationStage from '../../components/presentations/PresentationStage'
import PresentationToolbar from '../../components/presentations/PresentationToolbar'
import PdfThumbnails from '../../components/presentations/PdfThumbnails'

export default function InstructorPresentationViewer() {
  const { id } = useParams()
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const rootRef = useRef(null)

  const [meta, setMeta] = useState(null)
  const [initialAnnotations, setInitialAnnotations] = useState({})
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [fit, setFit] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await api.get(`/presentations/${id}`)
        if (cancelled) return
        if (res?.success) {
          setMeta(res.presentation)
          setInitialAnnotations(res.annotations || {})
        }
      } catch (e) {
        if (!cancelled) toast(e?.message || t('presentations.toasts.loadFailed'), 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id, t, toast])

  const fileUrl = useMemo(() => (meta?.file_url ? presentationFileOpenUrl(meta.file_url) : ''), [meta])
  const { pdf, pageCount, loading: pdfLoading, error: pdfError } = usePdfDocument(fileUrl)
  const annotations = usePresentationAnnotations(id, initialAnnotations)

  useEffect(() => {
    if (!pageCount || !id) return
    if (meta && Number(meta.slide_count) !== pageCount) {
      setMeta((prev) => (prev ? { ...prev, slide_count: pageCount } : prev))
      void api.patch(`/presentations/${id}`, { slide_count: pageCount }).catch(() => {})
    }
    if (page > pageCount) setPage(pageCount)
  }, [pageCount, id, meta, page])

  const go = useCallback((next) => {
    if (!pageCount) return
    setPage(Math.min(pageCount, Math.max(1, next)))
  }, [pageCount])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(page + 1)
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(page - 1)
      if (e.key === 'Escape' && fullscreen) {
        document.exitFullscreen?.().catch(() => {})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, page, fullscreen])

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

  if (loading) {
    return <div className="p-6 text-sm text-token-textMuted">{t('presentations.loading')}</div>
  }
  if (!meta) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-token-textMuted">{t('presentations.toasts.loadFailed')}</p>
        <Button variant="secondary" onClick={() => navigate('/instructor/presentations')}>
          {t('presentations.viewer.back')}
        </Button>
      </div>
    )
  }

  const slideIndex = page - 1

  return (
    <div ref={rootRef} className="p-4 sm:p-6 max-w-[1400px] mx-auto h-[calc(100vh-5.5rem)] flex flex-col gap-4 min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <Link to="/instructor/presentations" className="text-xs text-token-textMuted hover:text-primary">
            ← {t('presentations.viewer.back')}
          </Link>
          <h1 className="font-display font-bold text-xl text-token-textMain truncate">{meta.title}</h1>
        </div>
      </div>

      {pdfError ? (
        <p className="text-sm text-red-300/90">{t('presentations.viewer.loadFailed')}</p>
      ) : pdfLoading || !pdf ? (
        <div className="flex-1 flex items-center justify-center text-sm text-token-textMuted">
          {t('presentations.viewer.loadingPdf')}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex gap-4">
          <PdfThumbnails
            pdf={pdf}
            pageCount={pageCount}
            page={page}
            onSelect={setPage}
            title={t('presentations.viewer.thumbnails')}
          />
          <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-3">
            <PresentationStage
              pdf={pdf}
              page={page}
              fit={fit}
              zoom={zoom}
              strokes={annotations.strokesFor(slideIndex)}
              tool={annotations.tool}
              defaults={annotations.defaults}
              onCommit={(next) => annotations.setSlideStrokes(slideIndex, next)}
              className="flex-1 rounded-2xl border border-[color:var(--border-subtle)] bg-black/40"
            />
            <div className="shrink-0 flex justify-center">
              <PresentationToolbar
                mode="viewer"
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
                onFit={() => {
                  setFit(true)
                  setZoom(1)
                }}
                onZoomIn={() => {
                  setFit(false)
                  setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))
                }}
                onZoomOut={() => {
                  setFit(false)
                  setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))
                }}
                onFullscreen={toggleFullscreen}
                fullscreen={fullscreen}
                onPresent={() => navigate(`/instructor/presentations/${id}/present`)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
