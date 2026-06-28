import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { materialPublicFileUrl } from '../../lib/materialShareUrl'
import { isMaterialPreviewable } from '../../lib/materialFileUrl'

export default function MaterialPublicPreview() {
  const { shareToken } = useParams()
  const token = useMemo(() => String(shareToken || '').trim(), [shareToken])
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState('')
  const [material, setMaterial] = useState(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError('Link düzgün deyil')
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const d = await api.get(`/public/material-preview/${encodeURIComponent(token)}`)
        if (!cancelled) setMaterial(d.material || null)
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Material tapılmadı')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const fileUrl = token ? materialPublicFileUrl(token) : ''
  const previewable = material ? isMaterialPreviewable(material.file_type, material.title) : false
  const isPdf = String(material?.file_type || '').toLowerCase().includes('pdf')
  const isImage = String(material?.file_type || '').toLowerCase().startsWith('image/')

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col">
      <header className="border-b border-white/10 bg-[#0f0f0f]/95">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">Mentorix · Material</p>
            <h1 className="font-display font-bold text-lg truncate">{material?.title || 'Material'}</h1>
            {material?.instructor_name ? (
              <p className="text-xs text-gray-500 mt-0.5">{material.instructor_name}</p>
            ) : null}
          </div>
          <Link to="/" className="text-sm text-primary hover:underline shrink-0">
            Ana səhifə
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {loading ? (
          <p className="text-center text-gray-500 py-16">Yüklənir…</p>
        ) : error ? (
          <Card className="p-8 text-center border border-white/10 bg-[#121212]/90">
            <p className="text-amber-300">{error}</p>
          </Card>
        ) : material ? (
          <div className="space-y-4">
            {material.tags?.length ? (
              <div className="flex flex-wrap gap-2">
                {material.tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-1 rounded-full bg-white/10 text-gray-300">
                    #{t}
                  </span>
                ))}
              </div>
            ) : null}

            {previewable && isPdf ? (
              <iframe title={material.title} src={fileUrl} className="w-full h-[75vh] rounded-xl border border-white/10 bg-white" />
            ) : previewable && isImage ? (
              <img src={fileUrl} alt={material.title} className="w-full max-h-[75vh] object-contain rounded-xl border border-white/10 bg-black/30" />
            ) : (
              <Card className="p-8 text-center border border-white/10 bg-[#121212]/90 space-y-4">
                <p className="text-gray-400 text-sm">Bu fayl növü brauzerdə önizlənmir.</p>
                <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
                  <Button>Yüklə</Button>
                </a>
              </Card>
            )}

            {material.view_count != null ? (
              <p className="text-[11px] text-gray-600 text-center">{material.view_count} baxış</p>
            ) : null}
          </div>
        ) : null}
      </main>
    </div>
  )
}
