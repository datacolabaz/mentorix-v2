import { useCallback, useEffect, useRef, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { QRCodeCanvas } from 'qrcode.react'
import { useToast } from '../common/Toast'
import api from '../../lib/api'
import { materialPublicShareUrl } from '../../lib/materialShareUrl'

export default function MaterialQrModal({ open, onClose, material }) {
  const toast = useToast()
  const canvasRef = useRef(null)
  const [shareToken, setShareToken] = useState(material?.share_token || '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !material?.id) return
    if (material.share_token) {
      setShareToken(material.share_token)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await api.post(`/materials/${material.id}/share`)
        if (!cancelled && res?.success) {
          setShareToken(res.material?.share_token || '')
        }
      } catch (e) {
        if (!cancelled) toast(e?.message || 'Paylaşım aktivləşmədi', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, material?.id, material?.share_token, toast])

  const publicUrl = shareToken ? materialPublicShareUrl(shareToken) : ''

  const copyLink = useCallback(async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      toast('Link kopyalandı')
    } catch {
      toast(publicUrl, 'info')
    }
  }, [publicUrl, toast])

  const downloadPng = useCallback(() => {
    const canvas = canvasRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `mentorix-qr-${material?.title || 'material'}.png`.replace(/[^\w.-]+/g, '_')
    link.href = canvas.toDataURL('image/png')
    link.click()
  }, [material?.title])

  return (
    <Modal open={open} onClose={onClose} title="QR kod" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-400 text-center">
          {material?.title ? <span className="text-white font-medium">{material.title}</span> : 'Material'}
        </p>
        {loading ? (
          <p className="text-center text-sm text-gray-500 py-8">Hazırlanır…</p>
        ) : publicUrl ? (
          <>
            <div className="flex justify-center" ref={canvasRef}>
              <div className="bg-white rounded-2xl p-4">
                <QRCodeCanvas value={publicUrl} size={220} includeMargin />
              </div>
            </div>
            <p className="text-[11px] text-gray-500 text-center break-all font-mono">{publicUrl}</p>
            <div className="flex flex-col gap-2">
              <Button className="w-full justify-center" variant="secondary" onClick={() => void copyLink()}>
                Linki kopyala
              </Button>
              <Button className="w-full justify-center" variant="ghost" onClick={downloadPng}>
                PNG yüklə
              </Button>
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-amber-300">QR yaradılmadı</p>
        )}
      </div>
    </Modal>
  )
}
