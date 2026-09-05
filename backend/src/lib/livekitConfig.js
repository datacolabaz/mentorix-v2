function getLiveKitConfig() {
  const apiKey = String(process.env.LIVEKIT_API_KEY || '').trim();
  const apiSecret = String(process.env.LIVEKIT_API_SECRET || '').trim();
  const wsUrl = String(
    process.env.LIVEKIT_WS_URL ||
      process.env.LIVEKIT_URL ||
      process.env.NEXT_PUBLIC_LIVEKIT_URL ||
      '',
  )
    .trim()
    .replace(/^https:\/\//i, 'wss://')
    .replace(/^http:\/\//i, 'ws://');

  if (!apiKey || !apiSecret || !wsUrl) {
    const err = new Error(
      'LiveKit konfiqurasiya olunmayıb. Backend service-də LIVEKIT_API_KEY, LIVEKIT_API_SECRET və LIVEKIT_WS_URL (wss://...) əlavə edin.',
    );
    err.status = 503;
    throw err;
  }
  return { apiKey, apiSecret, wsUrl };
}

function livekitHttpUrl(wsUrl) {
  return String(wsUrl || '')
    .trim()
    .replace(/^wss:/i, 'https:')
    .replace(/^ws:/i, 'http:');
}

module.exports = { getLiveKitConfig, livekitHttpUrl };
