import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LiveKitRoom, RoomAudioRenderer } from '@livekit/components-react'
import '@livekit/components-styles'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import PhoneInput from '../../components/auth/PhoneInput'
import { canonicalAzPhoneE164 } from '../../lib/azPhone'
import GuestAwareVideoConference from '../../components/live/GuestAwareVideoConference'
import { useToast } from '../../components/common/Toast'

const inp =
  'w-full border border-white/15 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary/40 bg-white/[0.04] placeholder:text-gray-500'

function LiveGuestRoom({ session, onLeave }) {
  const [mediaReady, setMediaReady] = useState(false)
  const [mediaPreparing, setMediaPreparing] = useState(false)
  const [connectLiveKit, setConnectLiveKit] = useState(true)
  const toast = useToast()
  const leftRef = useRef(false)

  const leave = useCallback(async () => {
    if (leftRef.current) return
    leftRef.current = true
    setConnectLiveKit(false)
    try {
      await api.post(`/public/live-guest/${encodeURIComponent(session.inviteToken)}/leave`, {
        participantId: session.participantId,
      })
    } catch {
      /* ignore */
    }
    onLeave?.()
  }, [session.inviteToken, session.participantId, onLeave])

  useEffect(() => {
    return () => {
      void leave()
    }
  }, [leave])

  const prepareMedia = async () => {
    setMediaPreparing(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      stream.getTracks().forEach((t) => t.stop())
      setMediaReady(true)
    } catch {
      toast('Kamera və mikrofon icazəsi lazımdır', 'error')
    } finally {
      setMediaPreparing(false)
    }
  }

  if (!mediaReady) {
    return (
      <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col items-center justify-center gap-5 p-6 text-center">
        <div>
          <p className="text-xs uppercase tracking-wider text-primary font-bold">Mentorix Live — Qonaq</p>
          <h1 className="font-display font-bold text-xl mt-2">{session.room?.title}</h1>
          <p className="text-sm text-gray-400 mt-2 max-w-md">
            Dərsə qoşulmaq üçün kamera və mikrofon icazəsi lazımdır.
          </p>
        </div>
        <Button onClick={() => void prepareMedia()} loading={mediaPreparing} className="min-w-[220px] justify-center">
          Kamera və mikrofonu aktiv et
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col">
      <header className="shrink-0 border-b border-white/10 bg-[#0f0f0f]/95 px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Qonaq · {session.participantName}</p>
          <h1 className="font-display font-bold text-base truncate">{session.room?.title}</h1>
        </div>
        <Button size="sm" variant="secondary" onClick={() => void leave()}>
          Çıx
        </Button>
      </header>
      <div className="flex-1 min-h-0 flex flex-col">
        <LiveKitRoom
          token={session.token}
          serverUrl={session.wsUrl}
          connect={connectLiveKit}
          video
          audio
          data-lk-theme="default"
          className="flex-1 min-h-0 flex flex-col"
          onDisconnected={() => void leave()}
        >
          <GuestAwareVideoConference />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  )
}

export default function LiveGuestJoin() {
  const { token } = useParams()
  const toast = useToast()
  const inviteToken = useMemo(() => String(token || '').trim(), [token])

  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [joinBusy, setJoinBusy] = useState(false)
  const [liveSession, setLiveSession] = useState(null)

  useEffect(() => {
    if (!inviteToken) {
      setError('Link düzgün deyil')
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const d = await api.get(`/public/live-guest/${encodeURIComponent(inviteToken)}`)
        if (!cancelled) {
          setInfo(d)
          if (!d.valid) {
            if (d.expired) setError('Link vaxtı bitib')
            else if (d.revoked) setError('Link ləğv edilib')
            else if (d.ended) setError('Bu canlı dərs bitib')
            else setError('Link etibarsızdır')
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Link tapılmadı')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [inviteToken])

  const submit = async () => {
    const name = String(fullName).trim()
    if (name.length < 3) {
      toast('Ad Soyad ən azı 3 simvol olmalıdır', 'error')
      return
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast('Düzgün email daxil edin', 'error')
      return
    }
    const phoneCanon = canonicalAzPhoneE164(phone)
    if (!phoneCanon) {
      toast('Mobil nömrə düzgün deyil (+994)', 'error')
      return
    }
    setJoinBusy(true)
    try {
      const res = await api.post(`/public/live-guest/${encodeURIComponent(inviteToken)}/join`, {
        fullName: name,
        email: email.trim(),
        phoneNumber: phoneCanon,
      })
      setLiveSession({
        inviteToken,
        token: res.token,
        wsUrl: res.wsUrl,
        participantId: res.participant?.id,
        participantName: res.participant?.full_name || name,
        room: res.room,
      })
    } catch (e) {
      toast(e?.message || 'Qoşulma alınmadı', 'error')
    } finally {
      setJoinBusy(false)
    }
  }

  if (liveSession) {
    return <LiveGuestRoom session={liveSession} onLeave={() => setLiveSession(null)} />
  }

  if (loading) {
    return (
      <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex items-center justify-center">
        <p className="text-gray-500">Yüklənir…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-amber-300">{error}</p>
        <Link to="/" className="text-primary hover:underline text-sm">
          Ana səhifə
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#121212] p-5 sm:p-6 space-y-5">
        <div className="text-center space-y-1">
          <p className="text-xs uppercase tracking-wider text-primary font-semibold">Mentorix Live</p>
          <h1 className="font-display font-bold text-lg">Dərsə qoşulmaq üçün</h1>
          {info?.room?.title ? <p className="text-sm text-gray-400">{info.room.title}</p> : null}
          {info?.room?.instructor_name ? (
            <p className="text-xs text-gray-500">Müəllim: {info.room.instructor_name}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Ad Soyad</span>
            <input className={inp} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ad Soyad" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Gmail</span>
            <input
              className={inp}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-gray-400">Mobil nömrə</span>
            <PhoneInput value={phone} onChange={setPhone} />
          </label>
        </div>

        <Button className="w-full justify-center" loading={joinBusy} onClick={() => void submit()}>
          Dərsə qoşul →
        </Button>
      </div>
    </div>
  )
}
