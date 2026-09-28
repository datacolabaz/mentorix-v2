const FEATURE_FLAGS = Object.freeze({
  UNIVERSITY_SEARCH: 'feature.university_search.enabled',
  MARKETPLACE: 'feature.marketplace.enabled',
  MENTOR_SERVICES: 'feature.mentor_services.enabled',
  LIVE_ROOM: 'feature.live_room.enabled',
  EXAM_RESULT_MODES: 'feature.exam_result_modes.enabled',
  PROCTORING: 'feature.proctoring.enabled',
});

/** DB oxunmasa (məs. migration hələ işləməyib) bu dəyərlər tətbiq olunur. */
const FEATURE_FLAG_DEFAULTS = Object.freeze({
  [FEATURE_FLAGS.UNIVERSITY_SEARCH]: false,
  [FEATURE_FLAGS.MARKETPLACE]: false,
  [FEATURE_FLAGS.MENTOR_SERVICES]: false,
  [FEATURE_FLAGS.LIVE_ROOM]: false,
  [FEATURE_FLAGS.EXAM_RESULT_MODES]: true,
  [FEATURE_FLAGS.PROCTORING]: false,
});

const FEATURE_DISABLED_MESSAGE = 'Bu funksiya hazırda aktiv deyil';

module.exports = { FEATURE_FLAGS, FEATURE_FLAG_DEFAULTS, FEATURE_DISABLED_MESSAGE };
