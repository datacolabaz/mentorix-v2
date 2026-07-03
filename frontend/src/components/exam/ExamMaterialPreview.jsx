import { useState } from 'react'
import ExamMaterialLightbox from './ExamMaterialLightbox'

/**
 * İmtahan PDF/şəkil önizləməsi — kliklə tam ekran böyütmə.
 */
export default function ExamMaterialPreview({
  material,
  mediaSrc,
  showPdfFrame,
  openInNewTabUrl,
  compact = false,
  loading = false,
  failed = false,
}) {
  const [lightbox, setLightbox] = useState(false)
  const name = material?.name || 'Fayl'

  const boxClass = compact
    ? 'min-h-[140px] max-h-[280px]'
    : showPdfFrame
      ? 'min-h-[200px] lg:min-h-[280px] max-h-[min(38vh,420px)] lg:max-h-[calc(100vh-220px)]'
      : 'flex flex-col min-h-[120px] sm:min-h-[180px] lg:min-h-[260px] max-h-[min(34svh,360px)] sm:max-h-[min(38vh,420px)] lg:max-h-[calc(100vh-220px)] min-w-0'

  return (
    <>
      <div className="rounded-xl border border-indigo-500/20 overflow-hidden bg-black/20 flex flex-col">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-indigo-500/10">
          <p className="text-xs text-gray-500 truncate flex-1" title={name}>
            {name}
          </p>
          <button
            type="button"
            onClick={() => mediaSrc && setLightbox(true)}
            disabled={!mediaSrc}
            className="shrink-0 text-[11px] font-semibold text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded-lg border border-indigo-500/30 hover:bg-white/5 disabled:opacity-40"
          >
            🔍 Böyüt
          </button>
        </div>
        <button
          type="button"
          onClick={() => mediaSrc && setLightbox(true)}
          disabled={!mediaSrc}
          className={`${boxClass} w-full text-left cursor-zoom-in disabled:cursor-wait relative group`}
          aria-label={`${name} — böyüt`}
        >
          {!mediaSrc ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[120px] text-xs text-gray-500 gap-2 px-3">
              {loading ? (
                'Yüklənir…'
              ) : failed ? (
                <>
                  <span>Fayl yüklənmədi</span>
                  {openInNewTabUrl ? (
                    <a
                      href={openInNewTabUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 font-semibold"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Yeni pəncərədə aç
                    </a>
                  ) : null}
                </>
              ) : (
                'Yüklənir…'
              )}
            </div>
          ) : showPdfFrame ? (
            <iframe
              title={name}
              src={mediaSrc}
              className="w-full h-full min-h-[inherit] bg-white/5 border-0 pointer-events-none"
            />
          ) : (
            <img
              src={mediaSrc}
              alt={name}
              loading="eager"
              decoding="async"
              className="h-auto w-full max-h-full min-h-[96px] flex-1 object-contain object-top bg-black/30"
            />
          )}
          {mediaSrc ? (
            <span className="absolute bottom-2 right-2 rounded-lg bg-black/70 text-[10px] text-white px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Böyütmək üçün toxun
            </span>
          ) : null}
        </button>
      </div>

      <ExamMaterialLightbox
        open={lightbox}
        onClose={() => setLightbox(false)}
        title={name}
        src={mediaSrc}
        isPdf={showPdfFrame}
        openInNewTabUrl={openInNewTabUrl}
      />
    </>
  )
}
