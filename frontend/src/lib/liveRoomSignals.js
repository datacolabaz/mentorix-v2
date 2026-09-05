export const LIVE_REACTION_TOPIC = 'mx-reaction'
export const LIVE_CHAT_TOPIC = 'mx-chat'
export const LIVE_MEDIA_TOPIC = 'mx-media'

export const LIVE_REACTION_EMOJIS = ['👍', '👏', '❤️', '😂', '😍', '😮', '🎉', '🔥', '💯', '🙌', '✨', '😎']

const ALLOWED = new Set(LIVE_REACTION_EMOJIS)

export function isAllowedReaction(emoji) {
  return ALLOWED.has(String(emoji || ''))
}

export function parseLiveDataPayload(payload) {
  try {
    const raw = typeof payload === 'string' ? payload : new TextDecoder().decode(payload)
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return null
    return data
  } catch {
    return null
  }
}
