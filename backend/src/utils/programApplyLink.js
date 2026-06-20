/** Dərəcəyə görə universitet apply linkini seçir */

function resolveApplyLinkForDegree(degreeLevel, { undergrad_apply_link, graduate_apply_link, apply_link } = {}) {
  const level = String(degreeLevel || '').trim();
  if (level === 'BSc') {
    return undergrad_apply_link || apply_link || null;
  }
  if (level === 'MSc' || level === 'PhD') {
    return graduate_apply_link || apply_link || null;
  }
  return apply_link || undergrad_apply_link || graduate_apply_link || null;
}

function resolveProgramApplyLink(program) {
  if (!program) return null;
  const direct = String(program.apply_link || '').trim();
  if (direct) return direct;

  const uni = program.university || {};
  return resolveApplyLinkForDegree(program.degree_level, {
    undergrad_apply_link: uni.undergrad_apply_link,
    graduate_apply_link: uni.graduate_apply_link,
  });
}

module.exports = {
  resolveApplyLinkForDegree,
  resolveProgramApplyLink,
};
