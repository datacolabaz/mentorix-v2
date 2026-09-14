const { MentorixLiveProvider } = require('./MentorixLiveProvider');
const { GoogleMeetProvider } = require('./GoogleMeetProvider');
const { ZoomProvider } = require('./ZoomProvider');
const { TeamsProvider } = require('./TeamsProvider');

const PROVIDERS = {
  mentorix_live: new MentorixLiveProvider(),
  google_meet: new GoogleMeetProvider(),
  zoom: new ZoomProvider(),
  teams: new TeamsProvider(),
};

const PROVIDER_IDS = Object.keys(PROVIDERS);

function normalizeProviderId(raw) {
  const id = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (id === 'meet' || id === 'google') return 'google_meet';
  if (id === 'livekit' || id === 'mentorix' || id === 'live') return 'mentorix_live';
  return id;
}

function get(providerId) {
  const id = normalizeProviderId(providerId);
  const provider = PROVIDERS[id];
  if (!provider) {
    const err = new Error('Naməlum canlı dərs platforması');
    err.status = 400;
    err.code = 'UNKNOWN_PROVIDER';
    throw err;
  }
  return provider;
}

function listPublicProviders() {
  return [
    {
      id: 'mentorix_live',
      available: true,
      requiresConnection: false,
    },
    {
      id: 'google_meet',
      available: true,
      requiresConnection: true,
    },
    {
      id: 'zoom',
      available: false,
      requiresConnection: true,
      comingSoon: true,
    },
    {
      id: 'teams',
      available: false,
      requiresConnection: true,
      comingSoon: true,
    },
  ];
}

module.exports = {
  get,
  listPublicProviders,
  normalizeProviderId,
  PROVIDER_IDS,
};
