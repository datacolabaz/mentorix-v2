import { useEffect, useRef } from 'react'
import Modal from '../common/Modal'
import { materialFileDownloadUrl, materialFileOpenUrl } from '../../lib/materialFileUrl'
import { clientMaterialKind, startActiveTimer, trackMaterialEvent } from '../../lib/materialTracking'

/** Serverdəki minimumdan bir az çox gözləyirik ki, «baxıldı» dəqiq qeydə alınsın. */
const VIEW_REPORT_AFTER_SECONDS = 12
const VIDEO_MILESTONES = [25, 50, 80]

export default function MaterialViewerModal({ material, onClose }) {
  const kind = clientMaterialKind(material?.file_type, material?.file_url)
  const reported = useRef(false)
  const videoState = useRef({ started: false, milestones: new Set() })

  useEffect(() => {
    if (!material?.id) return undefined
    reported.current = false
    videoState.current = { started: false, milestones: new Set() }
    trackMaterialEvent(material.id, 'material_opened')
    if (kind === 'video') return undefined

    const timer = startActiveTimer((secs) => {
      if (!reported.current && secs >= VIEW_REPORT_AFTER_SECONDS) {
        reported.current = true
        trackMaterialEvent(material.id, 'material_viewed', { active_seconds: secs })
      }
    })
    return () => {
      const secs = timer.stop()
      if (!reported.current && secs > 0) trackMaterialEvent(material.id, 'material_viewed', { active_seconds: secs })
    }
  }, [material?.id, kind])

  if (!material) return null
  const src = materialFileOpenUrl(material.file_url)

  const onVideoPlay = () => {
    if (videoState.current.started) return
    videoState.current.started = true
    trackMaterialEvent(material.id, 'video_started', { progress_pct: 0 })
  }

  const onVideoTime = (e) => {
    const v = e.currentTarget
    if (!v.duration || !Number.isFinite(v.duration)) return
    const pct = Math.floor((v.currentTime / v.duration) * 100)
    for (const m of VIDEO_MILESTONES) {
      if (pct >= m && !videoState.current.milestones.has(m)) {
        videoState.current.milestones.add(m)
        trackMaterialEvent(material.id, m >= 80 ? 'video_completed' : 'video_progressed', { progress_pct: m })
      }
    }
  }

  return (
    <Modal open onClose={onClose} title={material.title} size="xl" closeLabel="Bağla">
      <div className="space-y-3">
        {kind === 'video' ? (
          <video
            src={src}
            controls
            playsInline
            className="w-full max-h-[70vh] rounded-xl bg-black"
            onPlay={onVideoPlay}
            onTimeUpdate={onVideoTime}
          />
        ) : kind === 'image' ? (
          <img src={src} alt={material.title} className="w-full max-h-[70vh] object-contain rounded-xl" />
        ) : (
          <iframe src={src} title={material.title} className="w-full h-[70vh] rounded-xl bg-white" />
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-violet-500/30 text-violet-500 hover:bg-violet-500/10"
          >
            Yeni tabda aç
          </a>
          <a
            href={materialFileDownloadUrl(material.file_url)}
            className="text-xs font-semibold px-3 py-2 rounded-lg border border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
          >
            Yüklə
          </a>
        </div>
      </div>
    </Modal>
  )
}
