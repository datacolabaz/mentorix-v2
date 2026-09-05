import { useCallback, useEffect, useRef, useState } from 'react'
import { RoomEvent } from 'livekit-client'
import { useRoomContext } from '@livekit/components-react'
import {
  LIVE_CHAT_TOPIC,
  LIVE_REACTION_TOPIC,
  isAllowedReaction,
  parseLiveDataPayload,
} from '../lib/liveRoomSignals'

const encoder = new TextEncoder()

function participantLabel(participant) {
  return String(participant?.name || participant?.identity || '').trim()
}

export default function useLiveRoomSignals() {
  const room = useRoomContext()
  const [reactions, setReactions] = useState([])
  const [messages, setMessages] = useState([])
  const lastReactionAt = useRef(0)

  const localName = participantLabel(room?.localParticipant)

  const pushReaction = useCallback((emoji, name) => {
    if (!isAllowedReaction(emoji)) return
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const item = {
      id,
      emoji,
      name: name || '',
      left: 10 + Math.random() * 80,
    }
    setReactions((prev) => [...prev.slice(-18), item])
    window.setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id))
    }, 2800)
  }, [])

  const publish = useCallback(
    async (topic, payload, reliable) => {
      if (!room?.localParticipant) return
      await room.localParticipant.publishData(encoder.encode(JSON.stringify(payload)), {
        reliable,
        topic,
      })
    },
    [room],
  )

  const sendReaction = useCallback(
    async (emoji) => {
      if (!isAllowedReaction(emoji)) return
      const now = Date.now()
      if (now - lastReactionAt.current < 350) return
      lastReactionAt.current = now
      pushReaction(emoji, localName)
      try {
        await publish(LIVE_REACTION_TOPIC, { t: 'reaction', e: emoji }, false)
      } catch {
        /* room may already be disconnected */
      }
    },
    [localName, publish, pushReaction],
  )

  const sendChat = useCallback(
    async (text) => {
      const clean = String(text || '').trim().slice(0, 240)
      if (!clean) return false
      const msg = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: clean,
        name: localName,
        local: true,
        at: Date.now(),
      }
      setMessages((prev) => [...prev.slice(-79), msg])
      try {
        await publish(LIVE_CHAT_TOPIC, { t: 'chat', m: clean }, true)
      } catch {
        /* ignore */
      }
      return true
    },
    [localName, publish],
  )

  useEffect(() => {
    if (!room) return undefined
    const onData = (payload, participant, _kind, topic) => {
      if (participant?.identity && participant.identity === room.localParticipant?.identity) return
      const data = parseLiveDataPayload(payload)
      if (!data) return
      const name = participantLabel(participant)
      if (topic === LIVE_REACTION_TOPIC || data.t === 'reaction') {
        pushReaction(data.e, name)
        return
      }
      if (topic === LIVE_CHAT_TOPIC || data.t === 'chat') {
        const text = String(data.m || '').trim().slice(0, 240)
        if (!text) return
        setMessages((prev) => [
          ...prev.slice(-79),
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            text,
            name,
            local: false,
            at: Date.now(),
          },
        ])
      }
    }
    room.on(RoomEvent.DataReceived, onData)
    return () => {
      room.off(RoomEvent.DataReceived, onData)
    }
  }, [room, pushReaction])

  return { reactions, messages, sendReaction, sendChat }
}
