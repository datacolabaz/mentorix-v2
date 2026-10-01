const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/**
 * The mentor role/section is retired; the only roles are Təlimçi (instructor), Tələbə, Valideyn and Admin.
 * Fails on standalone "mentor" wording (any language) in backend source: API messages, email and
 * notification templates, sitemap/SEO constants. The brand (Mentorix, MentorixAI, mentorix.io) is not a hit.
 */

const SRC = path.join(__dirname, '..');
const TERM_RE = /(?<![a-z])mentor(?!ix)|mentee|(?<!\p{L})(?:ментор|наставник|менти(?!\p{L}))/iu;
const TEXT_EXT = new Set(['.js', '.json', '.html', '.hbs', '.mjml', '.txt', '.md']);

/**
 * Lines allowed to keep the word, each with the reason it has to stay. `lines` limits the entry to
 * matching lines; nothing else in the file may mention mentor.
 */
const ALLOWLIST = [
  {
    file: 'config/personas.js',
    lines: /^\s*\*.*`mentor` was an instructor persona|^\s*mentor: PERSONAS\.TEACHER,/,
    reason: 'legacy alias: users stored with persona "mentor" are read as the trainer persona',
  },
  {
    file: 'app.js',
    lines: /app\.use\('\/api\/mentor', require\('\.\/routes\/legacyMentor'\)\)/,
    reason: 'old clients still call /api/mentor/*; the legacy router answers 410 or forwards to /api/assistant',
  },
  {
    file: 'routes/legacyMentor.js',
    lines: /^\s*\*/,
    reason: 'doc comment of the legacy /api/mentor router (internal path, never shown to users)',
  },
  {
    file: 'services/universityProgramIngestService.js',
    lines: /mentor_display_name, scrape_url/,
    reason: 'DB column name; renaming it would be a destructive migration, clients get contributor_display_name',
  },
  {
    file: 'services/universityProgramContributionService.js',
    lines: /mentor_display_name|mentor_notes|=== 'mentor' \? 'instructor'/,
    reason: 'maps the legacy column, JSON key and source value to contributor/instructor before responding',
  },
  {
    file: 'services/universityProgramService.js',
    lines: /p\.mentor_display_name AS contributor_display_name|=== 'mentor' \? 'instructor'/,
    reason: 'maps the legacy column and source value to contributor/instructor before responding',
  },
  {
    file: 'controllers/assistantController.js',
    lines: /'mentor-search': 'teacher-search'|ANTHROPIC_MENTOR_MODEL/,
    reason: 'saved tour progress uses the old step id; the old env var name keeps Railway config working',
  },
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      // Applied migrations are immutable history (234 is the one that retires the persona).
      if (name === 'node_modules' || name === 'migrations') continue;
      walk(full, out);
    } else if (TEXT_EXT.has(path.extname(name)) && !name.endsWith('.test.js')) {
      out.push(full);
    }
  }
  return out;
}

const rel = (f) => path.relative(SRC, f).replace(/\\/g, '/');

test('no standalone mentor wording in backend source outside the reasoned allowlist', () => {
  const files = walk(SRC);
  assert.ok(files.length > 100, 'scanned the backend source tree');
  const hits = [];
  for (const f of files) {
    const r = rel(f);
    const entry = ALLOWLIST.find((a) => a.file === r);
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
      if (!TERM_RE.test(line)) return;
      if (entry && entry.lines.test(line)) return;
      hits.push(`${r}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(hits, []);
});

test('every allowlist entry has a reason and still matches a real line', () => {
  for (const entry of ALLOWLIST) {
    assert.ok(entry.reason && entry.reason.length > 20, `${entry.file} needs a reason`);
    const code = fs.readFileSync(path.join(SRC, entry.file), 'utf8');
    assert.ok(code.split(/\r?\n/).some((l) => TERM_RE.test(l) && entry.lines.test(l)), `${entry.file}: stale allowlist entry`);
  }
});

test('the brand is not caught by the guard', () => {
  for (const brand of ['Mentorix', 'MentorixAI', 'mentorix.io', 'Mentorix — təlim platforması']) {
    assert.doesNotMatch(brand, TERM_RE, brand);
  }
  for (const term of ['mentor', 'Mentorluq', 'mentee', 'Ментор', 'наставник', 'менти']) {
    assert.match(term, TERM_RE, term);
  }
  assert.doesNotMatch('документирование', TERM_RE);
});

test('the retired mentorship modules are gone', () => {
  for (const f of [
    'routes/mentor.js',
    'controllers/mentorWorkspaceController.js',
    'controllers/mentorSessionAiController.js',
    'services/mentorSessionAiService.js',
    'controllers/mentorController.js',
    'mentor',
  ]) {
    assert.equal(fs.existsSync(path.join(SRC, f)), false, f);
  }
  const { FEATURE_FLAGS } = require('../constants/featureFlags');
  assert.equal(Object.values(FEATURE_FLAGS).some((k) => /mentor/i.test(k)), false);
});

test('the public sitemap lists no mentor URL', () => {
  const sitemapSrc = fs.readFileSync(path.join(SRC, 'constants', 'publicSitemapUrls.js'), 'utf8');
  assert.doesNotMatch(sitemapSrc, TERM_RE);
});
