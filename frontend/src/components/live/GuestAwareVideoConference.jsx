import { useState } from 'react'
import { Track } from 'livekit-client'
import { useTranslation } from 'react-i18next'
import {
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks,
} from '@livekit/components-react'
import useLiveRoomSignals from '../../hooks/useLiveRoomSignals'
import LiveInCallChat from './LiveInCallChat'
import LiveReactionPicker from './LiveReactionPicker'
import LiveReactionsOverlay from './LiveReactionsOverlay'

function isGuestParticipant(participant) {
  if (!participant?.metadata) return false
  try {
    return JSON.parse(participant.metadata).guest === true
  } catch {
    return false
  }
}

function MentorixParticipantTile({ trackRef, ...props }) {
  const { t } = useTranslation()
  const participant = trackRef?.participant
  const guest = isGuestParticipant(participant)
  return (
    <div className="relative h-full w-full min-h-0">
      <ParticipantTile trackRef={trackRef} {...props} />
      {guest ? (
        <span className="absolute top-2 left-2 z-20 rounded-md bg-gray-600/90 px-1.5 py-0.5 text-[10px] font-bold text-gray-100 border border-gray-500/50 pointer-events-none">
          {t('live.guestLabel')}
        </span>
      ) : null}
    </div>
  )
}

/** LiveKit konfrans — qonaq badge, reaksiya və otaq çatı. */
export default function GuestAwareVideoConference() {
  const { t } = useTranslation()
  const [chatOpen, setChatOpen] = useState(false)
  const { reactions, messages, sendReaction, sendChat } = useLiveRoomSignals()
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
        <GridLayout tracks={tracks} className="h-full min-h-0">
          <MentorixParticipantTile />
        </GridLayout>
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
      <ControlBar />
    </div>
  )
}
