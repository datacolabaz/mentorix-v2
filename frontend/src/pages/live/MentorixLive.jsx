import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { LiveKitRoom, RoomAudioRenderer, useRoomContext } from '@livekit/components-react'
import '@livekit/components-styles'
import api from '../../lib/api'
import useAuthStore from '../../hooks/useAuth'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import GuestAwareVideoConference from '../../components/live/GuestAwareVideoConference'
import LiveWaitingRoom from '../../components/live/LiveWaitingRoom'
import { useToast } from '../../components/common/Toast'
import { formatRecordingDuration, useLocalRecording, LIVE_MEDIA_RESTORE_EVENT } from '../../hooks/useLocalRecording'

function LiveMediaRestore() {
  const room = useRoomContext()

  useEffect(() => {
    const restore = () => {
      if (!room) return
      void room.localParticipant.setCameraEnabled(true)
      void room.localParticipant.setMicrophoneEnabled(true)
    }
    window.addEventListener(LIVE_MEDIA_RESTORE_EVENT, restore)
    return () => window.removeEventListener(LIVE_MEDIA_RESTORE_EVENT, restore)
  }, [room])

  return null
}

export default function MentorixLive() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuthStore()
  const joinedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [room, setRoom] = useState(null)
  const [token, setToken] = useState(null)
  const [wsUrl, setWsUrl] = useState(null)
  const [connectLiveKit, setConnectLiveKit] = useState(true)
  const [recordModalOpen, setRecordModalOpen] = useState(false)
  const [afterEndNavigate, setAfterEndNavigate] = useState(false)
  const [ending, setEnding] = useState(false)
  const [waitingAdmission, setWaitingAdmission] = useState(false)
  const [admissionDenied, setAdmissionDenied] = useState(false)

  const recording = useLocalRecording()
  const canRecord = recording.supported

  const isInstructor = Boolean(room?.is_instructor)

  const code = String(roomCode || '').trim().toUpperCase()

  const roomOptions = useMemo(
    () => ({
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }),
    [],
  )

  const leaveRoom = useCallback(async () => {
    if (!code || !joinedRef.current) return
    joinedRef.current = false
    try {
      await api.post(`/live/${encodeURIComponent(code)}/leave`)
    } catch {
      /* ignore */
    }
  }, [code])

  const disconnectLiveKit = useCallback(() => {
    setConnectLiveKit(false)
  }, [])

  const uploadRecording = useCallback(
    async (blob) => {
      if (!blob || !code) return null
      const form = new FormData()
      form.append('recording', blob, `mentorix-${code}.webm`)
      form.append('duration_sec', String(recording.durationSec || 0))
      const res = await api.post(`/live/${encodeURIComponent(code)}/recording`, form, {
        timeout: 300000,
      })
      return res?.recording || null
    },
    [code, recording.durationSec],
  )

  const finishRecording = useCallback(
    async (blob) => {
      if (!blob) return false
      try {
        await uploadRecording(blob)
        toast('Yazı platformada saxlanıldı')
        setRecordModalOpen(true)
        setAfterEndNavigate(true)
        return true
      } catch (e) {
        toast(e?.message || 'Yazı serverə yüklənmədi — kompüterə yükləyə bilərsiniz', 'error')
        setRecordModalOpen(true)
        return false
      }
    },
    [uploadRecording, toast],
  )

  const endRoom = useCallback(async () => {
    if (!code || !isInstructor) return
    setEnding(true)
    try {
      let blob = null
      if (canRecord && recording.isRecording) blob = await recording.stopRecording()
      else if (canRecord && recording.lastBlob) blob = recording.lastBlob

      if (blob) await finishRecording(blob)

      disconnectLiveKit()
      await api.post(`/live/${encodeURIComponent(code)}/end`)
      await leaveRoom()
      toast('Canlı dərs bitdi')

      if (!blob) {
        navigate('/instructor/live/history', { replace: true })
      }
    } catch (e) {
      toast(e?.message || 'Bitirmək alınmadı', 'error')
    } finally {
      setEnding(false)
    }
  }, [code, isInstructor, canRecord, recording, finishRecording, disconnectLiveKit, leaveRoom, navigate, toast])

  const exitRoom = useCallback(async () => {
    let blob = null
    if (canRecord && recording.isRecording) blob = await recording.stopRecording()
    else if (canRecord && recording.lastBlob) blob = recording.lastBlob

    if (blob) await finishRecording(blob)

    disconnectLiveKit()
    await leaveRoom()

    if (!blob) {
      navigate(user?.role === 'student' ? '/student' : '/instructor', { replace: true })
    }
  }, [canRecord, recording, finishRecording, disconnectLiveKit, leaveRoom, navigate, user?.role])

  useEffect(() => {
    if (!code) {
      setError('Otaq kodu düzgün deyil')
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const joinRes = await api.post(`/live/${encodeURIComponent(code)}/join`)
        if (cancelled) return
        if (joinRes?.room) setRoom(joinRes.room)

        if (joinRes?.pending) {
          setWaitingAdmission(true)
          setLoading(false)
          return
        }

        joinedRef.current = true
        const [roomRes, tokenRes] = await Promise.all([
          api.get(`/live/${encodeURIComponent(code)}`),
          api.get(`/live/${encodeURIComponent(code)}/token`),
        ])

        if (cancelled) return
        setRoom(roomRes.room)
        setToken(tokenRes.token)
        setWsUrl(tokenRes.wsUrl)
      } catch (e) {
        if (cancelled) return
        if (e?.code === 'ADMISSION_DENIED') {
          setAdmissionDenied(true)
          setWaitingAdmission(true)
        } else {
          setError(e?.message || 'Otağa qoşulmaq alınmadı')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      disconnectLiveKit()
      void leaveRoom()
    }
  }, [code, leaveRoom, disconnectLiveKit])

  useEffect(() => {
    if (!waitingAdmission || admissionDenied || !code || token) return undefined
    let cancelled = false
    const poll = async () => {
      try {
        const res = await api.get(`/live/${encodeURIComponent(code)}/admission`)
        if (cancelled) return
        if (res?.status === 'denied') {
          setAdmissionDenied(true)
          return
        }
        if (res?.status !== 'approved') return
        const joinRes = await api.post(`/live/${encodeURIComponent(code)}/join`)
        if (cancelled) return
        if (joinRes?.pending) return
        joinedRef.current = true
        const [roomRes, tokenRes] = await Promise.all([
          api.get(`/live/${encodeURIComponent(code)}`),
          api.get(`/live/${encodeURIComponent(code)}/token`),
        ])
        if (cancelled) return
        setRoom(roomRes.room)
        setToken(tokenRes.token)
        setWsUrl(tokenRes.wsUrl)
        setWaitingAdmission(false)
      } catch (e) {
        if (cancelled) return
        if (e?.code === 'ADMISSION_DENIED') setAdmissionDenied(true)
      }
    }
    void poll()
    const id = window.setInterval(() => void poll(), 2500)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [waitingAdmission, admissionDenied, code, token])

  const toggleRecording = async () => {
    if (!canRecord) return
    if (recording.isRecording) {
      const blob = await recording.stopRecording()
      if (blob) await finishRecording(blob)
      return
    }
    const result = await recording.startRecording()
    if (result?.status === 'started') {
      toast('Yazılış başladı — ekran/tab seçin')
    } else if (result?.status === 'error') {
      toast(result.message || 'Yazılış başlamadı', 'error')
    }
  }

  const closeRecordModal = () => {
    setRecordModalOpen(false)
    recording.clearRecordingUrl()
    if (afterEndNavigate) {
      setAfterEndNavigate(false)
      navigate(isInstructor ? '/instructor/live/history' : '/student', { replace: true })
    }
  }

  if (loading) {
    return (
      <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex items-center justify-center">
        <p className="text-gray-500">Mentorix Live yüklənir…</p>
      </div>
    )
  }

  if (waitingAdmission && !token) {
    return (
      <LiveWaitingRoom
        title={room?.title}
        denied={admissionDenied}
        onLeave={() => navigate(user?.role === 'student' ? '/student' : '/instructor', { replace: true })}
      />
    )
  }

  if (error) {
    return (
      <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-amber-300 text-center">{error}</p>
        <Link to="/" className="text-primary hover:underline text-sm">
          Ana səhifə
        </Link>
      </div>
    )
  }

  if (!token || !wsUrl) {
    return (
      <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex items-center justify-center">
        <p className="text-gray-500">Dərsə qoşulunur…</p>
      </div>
    )
  }

  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col">
      <header className="shrink-0 border-b border-white/10 bg-[#0f0f0f]/95 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-red-400">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Mentorix Live
            </span>
            <span className="text-xs text-gray-500 font-mono">{room?.room_code}</span>
          </div>
          <h1 className="font-display font-bold text-base sm:text-lg truncate mt-0.5">{room?.title}</h1>
          <p className="text-[11px] text-gray-500 mt-0.5">
            👥 {room?.participant_count || 0}
            {room?.max_participants != null ? ` / ${room.max_participants}` : ''} iştirakçı
            {room?.group_name ? ` · ${room.group_name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canRecord ? (
            <button
              type="button"
              onClick={() => void toggleRecording()}
              className={[
                'px-3 py-2 rounded-xl text-xs font-semibold border transition-colors',
                recording.isRecording
                  ? 'border-red-500/50 bg-red-500/15 text-red-300 animate-pulse'
                  : 'border-white/15 text-gray-200 hover:bg-white/5',
              ].join(' ')}
            >
              {recording.isRecording
                ? `⏺ Yazılır ${formatRecordingDuration(recording.durationSec)}`
                : '⏺ Record'}
            </button>
          ) : null}
          {isInstructor ? (
            <Button size="sm" variant="danger" onClick={() => void endRoom()} loading={ending}>
              Bitir
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => void exitRoom()}>
              Çıx
            </Button>
          )}
        </div>
      </header>

      {canRecord && !recording.isRecording ? (
        <div className="shrink-0 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-[11px] text-amber-200 text-center">
          <strong>Record</strong> ilə dərs yazısı platformaya yüklənir — «Canlı dərslər» səhifəsində saxlanılır.
        </div>
      ) : null}

      <div className="flex-1 min-h-0 flex flex-col">
        <LiveKitRoom
          token={token}
          serverUrl={wsUrl}
          connect={connectLiveKit}
          video={false}
          audio={false}
          options={roomOptions}
          data-lk-theme="default"
          className="flex-1 min-h-0 flex flex-col"
          onDisconnected={() => {
            void leaveRoom()
          }}
        >
          <LiveMediaRestore />
          <GuestAwareVideoConference roomCode={code} isInstructor={isInstructor} />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>

      <Modal open={recordModalOpen || Boolean(recording.recordingUrl)} onClose={closeRecordModal} title="Yazılış hazırdır" size="sm">
        <div className="space-y-4 text-center">
          <p className="text-sm text-gray-300">✅ Dərs uğurla yazıldı!</p>
          <p className="text-xs text-gray-500">Müddət: {formatRecordingDuration(recording.durationSec)}</p>
          <p className="text-xs text-gray-500">Yazı platformada saxlanıldı — «Canlı dərslər» səhifəsindən yükləyə və paylaşa bilərsiniz.</p>
          <div className="flex flex-col gap-2">
            {recording.recordingUrl ? (
              <a
                href={recording.recordingUrl}
                download={`mentorix-${code || 'ders'}.webm`}
                className="inline-flex justify-center rounded-xl bg-primary text-black font-semibold py-2.5 px-4 text-sm"
              >
                Kompüterə yüklə (.webm)
              </a>
            ) : (
              <Button className="w-full justify-center" onClick={() => recording.downloadRecording()}>
                Kompüterə yüklə (.webm)
              </Button>
            )}
            <Button className="w-full justify-center" variant="ghost" onClick={closeRecordModal}>
              Bağla
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
