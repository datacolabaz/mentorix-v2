import { Track } from 'livekit-client'
import {
  ControlBar,
  GridLayout,
  ParticipantTile,
  useTracks,
} from '@livekit/components-react'

function isGuestParticipant(participant) {
  if (!participant?.metadata) return false
  try {
    return JSON.parse(participant.metadata).guest === true
  } catch {
    return false
  }
}

function MentorixParticipantTile({ trackRef, ...props }) {
  const participant = trackRef?.participant
  const guest = isGuestParticipant(participant)
  return (
    <div className="relative h-full w-full min-h-0">
      <ParticipantTile trackRef={trackRef} {...props} />
      {guest ? (
        <span className="absolute top-2 left-2 z-20 rounded-md bg-gray-600/90 px-1.5 py-0.5 text-[10px] font-bold text-gray-100 border border-gray-500/50 pointer-events-none">
          Qonaq
        </span>
      ) : null}
    </div>
  )
}

/** LiveKit konfrans — qonaq iştirakçılar üçün badge. */
export default function GuestAwareVideoConference() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  )

  return (
    <div className="lk-video-conference flex flex-col flex-1 min-h-0">
      <GridLayout tracks={tracks} className="flex-1 min-h-0">
        <MentorixParticipantTile />
      </GridLayout>
      <ControlBar />
    </div>
  )
}
