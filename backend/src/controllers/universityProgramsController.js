const {
  searchPrograms,
  getProgramById,
  upsertApplicantProfile,
  saveSearch,
  MVP_COUNTRIES,
  FIELD_GROUPS,
  flatFieldOptions,
} = require('../services/universityProgramService');
const { buildMockSearchResponse } = require('../constants/universityMockPrograms');

const getPrograms = async (req, res) => {
  try {
    const result = await searchPrograms(req.query);
    return res.json(result);
  } catch (err) {
    console.error('[programs] GET /programs failed:', err?.message || err);
    const filters = require('../services/universityProgramService').normalizeFilters(req.query);
    return res.json(buildMockSearchResponse(filters));
  }
};

const getProgram = async (req, res, next) => {
  try {
    const program = await getProgramById(req.params.id);
    if (!program) {
      return res.status(404).json({ success: false, message: 'Proqram tapılmadı' });
    }
    return res.json({ success: true, program });
  } catch (err) {
    return next(err);
  }
};

const getProgramMeta = async (_req, res) => {
  res.json({
    success: true,
    countries: MVP_COUNTRIES,
    degree_levels: ['BSc', 'MSc', 'PhD'],
    field_groups: FIELD_GROUPS,
    fields: flatFieldOptions(),
    sort_options: [
      { value: 'ranking', label: 'Reytinq' },
      { value: 'tuition_asc', label: 'Ödəniş (aşağı)' },
      { value: 'tuition_desc', label: 'Ödəniş (yuxarı)' },
      { value: 'deadline', label: 'Son tarix' },
    ],
  });
};

const postWizardProfile = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Giriş tələb olunur' });
    }

    const body = req.body || {};
    const profile = await upsertApplicantProfile(userId, body.profile || body);

    const filters = body.filters || {
      degree_level: body.degree_level,
      field: body.field,
      countries: body.preferred_countries || body.countries,
      max_tuition: body.max_tuition,
      min_gpa: body.gpa,
      scholarship: body.scholarship,
    };

    const searchResult = await searchPrograms(filters);

    let savedSearch = null;
    if (body.save_search !== false) {
      const rows = searchResult.data || searchResult.programs || [];
      savedSearch = await saveSearch(userId, filters, rows.slice(0, 12));
    }

    return res.json({
      success: true,
      profile,
      saved_search: savedSearch,
      ...searchResult,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getPrograms,
  getProgram,
  getProgramMeta,
  postWizardProfile,
};
