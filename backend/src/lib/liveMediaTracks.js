function isMicTrack(track) {
  const source = String(track?.source ?? '').toLowerCase();
  const type = String(track?.type ?? '').toLowerCase();
  return source.includes('microphone') || source === '2' || type === 'audio' || type === '1';
}

function isCameraTrack(track) {
  const source = String(track?.source ?? '').toLowerCase();
  const type = String(track?.type ?? '').toLowerCase();
  if (source.includes('screen')) return false;
  return source.includes('camera') || source === '1' || type === 'video' || type === '2';
}

module.exports = { isMicTrack, isCameraTrack };
