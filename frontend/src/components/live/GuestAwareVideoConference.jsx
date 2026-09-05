import { Track } from 'livekit-client'
import { useTranslation } from 'react-i18next'
import {
  ControlBar,
  ParticipantTile,
  useLocalParticipant,
  useTracks,
} from '@livekit/components-react'
import { useState } from 'react'
import useLiveRoomSignals from '../../hooks/useLiveRoomSignals'
import useLiveAdmissions from '../../hooks/useLiveAdmissions'
import { liveGridCountAttr, liveTileKey } from '../../lib/liveGrid'
import LiveInCallChat from './LiveInCallChat'
import LiveReactionPicker from './LiveReactionPicker'
import LiveReactionsOverlay from './LiveReactionsOverlay'
import LiveAdmissionPanel from './LiveAdmissionPanel'
import LiveTileMediaControls from './LiveTileMediaControls'

function isGuestParticipant(participant) {
  if (!participant?.metadata) return false
  try {
    return JSON.parse(participant.metadata).guest === true
  } catch {
    return false
  }
}

function MentorixParticipantTile({
  trackRef,
  isInstructor,
  roomCode,
  localParticipant,
  sendMediaCommand,
}) {
  const { t } = useTranslation()
  const participant = trackRef?.participant
  const guest = isGuestParticipant(participant)
  const isScreenShare = trackRef?.source === Track.Source.ScreenShare
  const label = participant?.name || participant?.identity || t('live.participant')
  return (
    <div className={`mx-live-tile${isScreenShare ? ' mx-live-tile--screen' : ''}`}>
      <ParticipantTile trackRef={trackRef} />
      {guest ? (
        <span className="absolute top-2 left-2 z-20 rounded-md bg-gray-600/90 px-1.5 py-0.5 text-[10px] font-bold text-gray-100 border border-gray-500/50 pointer-events-none">
          {t('live.guestLabel')}
        </span>
      ) : null}
      <span className="absolute bottom-2 left-2 z-20 max-w-[60%] truncate rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-medium text-white pointer-events-none">
        {participant?.isLocal ? t('live.youLabel') : label}
      </span>
      <LiveTileMediaControls
        participant={participant}
        localParticipant={localParticipant}
        isInstructor={isInstructor}
        roomCode={roomCode}
        sendMediaCommand={sendMediaCommand}
        isScreenShare={isScreenShare}
      />
    </div>
  )
}

/** LiveKit konfrans — bərabər pəncərələr, qəbul paneli, mikrofon/kamera. */
export default function GuestAwareVideoConference({ roomCode, isInstructor = false }) {
  const { t } = useTranslation()
  const [chatOpen, setChatOpen] = useState(false)
  const { localParticipant } = useLocalParticipant()
  const { reactions, messages, sendReaction, sendChat, sendMediaCommand } = useLiveRoomSignals()
  const admissions = useLiveAdmissions(roomCode, Boolean(isInstructor && roomCode))
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  return (
    <div className="lk-video-conference flex flex-col flex-1 min-h-0">
      <div className="relative flex-1 min-h-0">
        <div className="mx-live-stage">
          <div className="mx-live-grid" data-count={liveGridCountAttr(tracks.length)}>
            {tracks.map((trackRef) => (
              <MentorixParticipantTile
                key={liveTileKey(trackRef)}
                trackRef={trackRef}
                isInstructor={isInstructor}
                roomCode={roomCode}
                localParticipant={localParticipant}
                sendMediaCommand={sendMediaCommand}
              />
            ))}
          </div>
        </div>
        {isInstructor ? (
          <LiveAdmissionPanel
            pending={admissions.pending}
            busyId={admissions.busyId}
            onApprove={admissions.approve}
            onDeny={admissions.deny}
          />
        ) : null}
        <LiveReactionsOverlay reactions={reactions} />
        <LiveInCallChat
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          messages={messages}
          onSend={sendChat}
        />
      </div>
      <div className="shrink-0 flex flex-wrap items-center justify-center gap-2 px-3 py-2 border-t border-white/10 bg-[#111]">
        <LiveReactionPicker onSend={sendReaction} />
        <button
          type="button"
          aria-pressed={chatOpen}
          onClick={() => setChatOpen((v) => !v)}
          className={[
            'h-10 px-3 rounded-xl border text-sm font-semibold',
            chatOpen
              ? 'border-primary/40 bg-primary/15 text-primary'
              : 'border-white/15 bg-[#1a1a1a] text-gray-100 hover:bg-white/10',
          ].join(' ')}
        >
          {t('live.chatTitle')}
        </button>
      </div>
      <ControlBar controls={{ chat: false, leave: false }} />
    </div>
  )
}
