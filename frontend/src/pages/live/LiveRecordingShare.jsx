import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'

export default function LiveRecordingShare() {
  const { shareToken } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(null)

  const token = String(shareToken || '').trim()
  const downloadUrl = token ? `/api/public/live-recording/${encodeURIComponent(token)}` : null

  useEffect(() => {
    if (!token) {
      setError('Link düzgün deyil')
      setLoading(false)
      return
    }

    axios
      .get(`/api/public/live-recording/${encodeURIComponent(token)}/info`)
      .then((res) => {
        setInfo(res.data?.recording || null)
      })
      .catch(() => {
        setError('Yazı tapılmadı və ya link etibarsızdır')
      })
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#141414] p-6 text-center space-y-4">
        <p className="text-xs uppercase tracking-wider text-red-400 font-bold">Mentorix Live</p>
        {loading ? (
          <p className="text-sm text-gray-400">Yüklənir…</p>
        ) : error ? (
          <>
            <p className="text-amber-300 text-sm">{error}</p>
            <Link to="/" className="text-primary text-sm hover:underline">
              Ana səhifə
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display font-bold text-lg">{info?.title || 'Canlı dərs yazısı'}</h1>
            <p className="text-xs text-gray-500 font-mono">{info?.room_code}</p>
            {downloadUrl ? (
              <a
                href={downloadUrl}
                className="inline-flex justify-center rounded-xl bg-primary text-black font-semibold py-2.5 px-4 text-sm w-full"
              >
                ⬇ Yazını yüklə (.webm)
              </a>
            ) : null}
            <Link to="/" className="block text-xs text-gray-500 hover:text-gray-300">
              mentorix.io
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
