import { useTranslation } from 'react-i18next'
import api from '../../lib/api'

function IconButton({ pressed, label, onClick, danger, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={[
        'h-9 w-9 rounded-full border flex items-center justify-center transition-colors',
        danger
          ? 'bg-red-600 border-red-400 text-white'
          : 'bg-black/70 border-white/20 text-white hover:bg-black/85',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function MicIcon({ off }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0" />
      <path d="M12 17v4" />
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  )
}

function CamIcon({ off }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="7" width="12" height="10" rx="2" />
      <path d="M15 11l6-3v8l-6-3z" />
      {off ? <path d="M3 3l18 18" /> : null}
    </svg>
  )
}

export default function LiveTileMediaControls({
  participant,
  localParticipant,
  isInstructor,
  roomCode,
  sendMediaCommand,
  isScreenShare,
}) {
  const { t } = useTranslation()
  if (!participant || isScreenShare) return null

  const isLocal =
    participant.isLocal ||
    (localParticipant && participant.identity === localParticipant.identity)
  const micOn = Boolean(participant.isMicrophoneEnabled)
  const camOn = Boolean(participant.isCameraEnabled)

  const setLocal = async (nextMic, nextCam) => {
    if (!localParticipant) return
    if (typeof nextMic === 'boolean') await localParticipant.setMicrophoneEnabled(nextMic)
    if (typeof nextCam === 'boolean') await localParticipant.setCameraEnabled(nextCam)
  }

  const setRemote = async (nextMic, nextCam) => {
    if (roomCode && participant.identity) {
      try {
        await api.post(
          `/live/${encodeURIComponent(roomCode)}/participants/${encodeURIComponent(participant.identity)}/media`,
          { microphone: nextMic, camera: nextCam },
        )
      } catch {
        /* data channel still applies */
      }
    }
    await sendMediaCommand?.({
      identity: participant.identity,
      microphone: nextMic,
      camera: nextCam,
    })
  }

  if (!isLocal && !isInstructor) return null

  const toggleMic = () => {
    const next = !micOn
    if (isLocal) void setLocal(next, undefined)
    else void setRemote(next, undefined)
  }
  const toggleCam = () => {
    const next = !camOn
    if (isLocal) void setLocal(undefined, next)
    else void setRemote(undefined, next)
  }

  return (
    <div className="absolute bottom-2 right-2 z-20 flex gap-1.5 pointer-events-auto">
      <IconButton
        pressed={micOn}
        danger={!micOn}
        label={micOn ? t('live.micOn') : t('live.micOff')}
        onClick={toggleMic}
      >
        <MicIcon off={!micOn} />
      </IconButton>
      <IconButton
        pressed={camOn}
        danger={!camOn}
        label={camOn ? t('live.cameraOn') : t('live.cameraOff')}
        onClick={toggleCam}
      >
        <CamIcon off={!camOn} />
      </IconButton>
    </div>
  )
}
