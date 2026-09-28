'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  matchSharePath,
  normalizeSharePath,
  buildSharePreview,
  clampText,
  formatAzDateTime,
  formatAzDay,
  materialTypeLabel,
} = require('./sharePreviewRules');
const { DEFAULT_BRAND, getBrand } = require('../config/brand');

const ORIGIN = 'https://resulio.example';
const BRAND = { ...DEFAULT_BRAND, name: 'Resulio' };
const NOW = new Date('2026-09-28T12:00:00Z');
const EXAM_ID = '7f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

function preview(path, data) {
  const m = matchSharePath(path);
  return buildSharePreview({ kind: m.kind, path: m.path, data, siteOrigin: ORIGIN, now: NOW, brand: BRAND });
}

test('routes are matched from the allowlist with specific patterns first', () => {
  assert.equal(matchSharePath('/library/material/abc').kind, 'material');
  assert.equal(matchSharePath('/library/abc').kind, 'group');
  assert.equal(matchSharePath('/join/ABC123').kind, 'group');
  assert.equal(matchSharePath('/m/tok_1').params.shareToken, 'tok_1');
  assert.equal(matchSharePath('/lr/tok').params.recordingToken, 'tok');
  assert.equal(matchSharePath('/sertifikatli-imtahanlar/it/python').params.examSlug, 'python');
  assert.equal(matchSharePath('/student/exams').kind, 'result');
  assert.equal(matchSharePath('/parent').kind, 'result');
  assert.equal(matchSharePath('/c/xyz').kind, 'certificate');
  assert.equal(matchSharePath('/instructor/exams').kind, 'home');
});

test('paths are normalized and unsafe input falls back to home', () => {
  assert.equal(normalizeSharePath('https://mentorix.io/exam/1?x=1#h'), '/exam/1');
  assert.equal(normalizeSharePath('/task/1/'), '/task/1');
  assert.equal(matchSharePath('/exam/../admin').kind, 'home');
  assert.equal(matchSharePath('//evil.com/x').kind, 'home');
  assert.equal(matchSharePath('x'.repeat(400)).kind, 'home');
  const bad = matchSharePath('/exam/%3Cscript%3E');
  assert.equal(bad.kind, 'exam');
  assert.equal(bad.invalid, true);
});

test('exam invite shows subject, question count, duration and a future start', () => {
  const p = preview(`/exam/${EXAM_ID}`, {
    title: 'Riyaziyyat — Faizlər',
    subject: 'Riyaziyyat',
    questionCount: 20,
    durationMinutes: 30,
    startsAt: '2026-09-29T15:00:00Z',
  });
  assert.equal(p.title, 'İmtahana dəvət — Riyaziyyat — Faizlər');
  assert.equal(p.description, 'Riyaziyyat · 20 sual · 30 dəqiqə');
  assert.equal(p.card.eyebrow, 'İmtahana dəvət');
  assert.deepEqual(p.card.lines, ['Riyaziyyat', '20 sual · 30 dəqiqə']);
  assert.equal(p.card.footnote, 'Başlama: 29 sentyabr, 19:00');
  assert.equal(p.url, `${ORIGIN}/exam/${EXAM_ID}`);
  assert.equal(p.site_name, 'Resulio');
});

test('past exam start is not advertised', () => {
  const p = preview(`/exam/${EXAM_ID}`, { title: 'Test', startsAt: '2026-01-01T10:00:00Z' });
  assert.equal(p.card.footnote, '');
});

test('missing entity yields a generic card for that kind', () => {
  const p = preview(`/exam/${EXAM_ID}`, null);
  assert.equal(p.card.eyebrow, 'İmtahana dəvət');
  assert.equal(p.title, 'İmtahana dəvət — Resulio');
});

test('result and certificate previews never contain personal data', () => {
  const leaky = { name: 'Aysel Məmmədova', title: 'Riyaziyyat', score: 92, percent: '92%', group: '11-A' };
  for (const path of ['/student/exams', '/parent/children', '/c/token123']) {
    const { url, canonical_path: canonicalPath, ...visible } = preview(path, leaky);
    assert.equal(url, `${ORIGIN}${path}`);
    assert.equal(canonicalPath, path);
    const text = JSON.stringify(visible);
    for (const secret of ['Aysel', 'Riyaziyyat', '92', '11-A', 'token123']) {
      assert.ok(!text.includes(secret), `${path} leaked ${secret}`);
    }
  }
  const r = preview('/student/exams', leaky);
  assert.equal(r.title, 'Resulio nəticəsi');
  assert.equal(r.description, 'Nəticənizi təhlükəsiz şəkildə görüntüləmək üçün linki açın.');
});

test('group invite hides the teacher unless the profile is public', () => {
  const hidden = preview('/join/ABC', { name: '11-ci sinif', subject: 'Fizika', publicTeacherName: '' });
  assert.deepEqual(hidden.card.lines, ['Fizika']);
  assert.equal(hidden.description, '11-ci sinif qrupuna qoşulun');
  const shown = preview('/join/ABC', { name: '11-ci sinif', subject: 'Fizika', publicTeacherName: 'Telman Abdulla' });
  assert.deepEqual(shown.card.lines, ['Fizika', 'Müəllim: Telman Abdulla']);
  const { url, canonical_path: canonicalPath, ...visible } = shown;
  assert.equal(canonicalPath, '/join/ABC');
  assert.ok(!JSON.stringify(visible).includes('ABC'), 'invite code must not appear in preview copy');
});

test('teacher, task, material and live templates', () => {
  const t = preview(`/teachers/${EXAM_ID}`, { name: 'Günel Əliyeva', subjects: 'Kimya', headline: '8 il təcrübə' });
  assert.equal(t.title, 'Günel Əliyeva — Resulio müəllim profili');
  assert.equal(t.description, 'Kimya üzrə imtahanlar, materiallar və tapşırıqlar');
  assert.equal(t.og_type, 'profile');

  const task = preview(`/task/${EXAM_ID}`, { title: 'Esse yaz', dueDay: '2026-10-05' });
  assert.equal(task.description, 'Son tarix: 5 oktyabr');

  const m = preview(`/library/material/${EXAM_ID}`, { title: 'Düsturlar', fileType: 'application/pdf', subject: 'Cəbr' });
  assert.equal(m.description, 'PDF · Cəbr');
  assert.equal(m.card.eyebrow, 'Yeni tədris materialı');

  const live = preview('/live/join/tok', { title: 'Həndəsə', at: '2026-09-29T15:00:00Z' });
  assert.equal(live.description, '29 sentyabr · 19:00');
});

test('long Azerbaijani titles are clamped on a word boundary', () => {
  const long = 'Şagirdlər üçün çoxseçimli ğ ş ç ö ü ı ə testləri '.repeat(5);
  const out = clampText(long, 60);
  assert.ok(out.length <= 60);
  assert.ok(out.endsWith('…'));
  const p = preview(`/exam/${EXAM_ID}`, { title: long });
  assert.ok(p.title.length <= 95);
  assert.ok(p.card.title.length <= 80);
});

test('date helpers use Baku time and omit the current year', () => {
  assert.equal(formatAzDateTime('2026-12-31T21:30:00Z', NOW), '1 yanvar 2027, 01:30');
  assert.equal(formatAzDay('2026-02-03', NOW), '3 fevral');
});

test('material type labels', () => {
  assert.equal(materialTypeLabel('video/mp4'), 'Video');
  assert.equal(materialTypeLabel('', 'slides.pptx'), 'Təqdimat');
  assert.equal(materialTypeLabel('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), 'Sənəd');
  assert.equal(materialTypeLabel('application/octet-stream', 'x.bin'), 'Material');
});

test('version changes when card content changes', () => {
  const a = preview(`/task/${EXAM_ID}`, { title: 'A' });
  const b = preview(`/task/${EXAM_ID}`, { title: 'B' });
  assert.notEqual(a.version, b.version);
  assert.equal(a.version, preview(`/task/${EXAM_ID}`, { title: 'A' }).version);
});

test('brand name defaults to Mentorix and is switched only through env', () => {
  const saved = process.env.BRAND_NAME;
  delete process.env.BRAND_NAME;
  assert.equal(getBrand().name, 'Mentorix');
  const home = buildSharePreview({ kind: 'home', path: '/', data: null, siteOrigin: ORIGIN, now: NOW });
  assert.equal(home.site_name, 'Mentorix');
  assert.equal(home.title, 'Mentorix — İmtahan, qiymətləndirmə və nəticə analizi');
  assert.equal(home.description, 'Müəllim və təlimçilər üçün imtahan, qiymətləndirmə və nəticə analizi platforması.');
  process.env.BRAND_NAME = 'Resulio';
  const renamed = buildSharePreview({ kind: 'home', path: '/', data: null, siteOrigin: ORIGIN, now: NOW });
  assert.equal(renamed.site_name, 'Resulio');
  assert.notEqual(renamed.version, home.version, 'rename must bust image cache');
  if (saved == null) delete process.env.BRAND_NAME;
  else process.env.BRAND_NAME = saved;
});

test('preview copy avoids question-bank and marketplace positioning', () => {
  const kinds = ['home', 'exam', 'task', 'material', 'live', 'group', 'teacher', 'certified', 'certificate', 'result'];
  for (const kind of kinds) {
    const text = JSON.stringify(buildSharePreview({ kind, path: '/', data: null, siteOrigin: ORIGIN, now: NOW, brand: BRAND })).toLowerCase();
    for (const banned of ['sual bank', 'quiz', 'viktorina', 'sual-cavab', 'mentor', 'universitet', 'marketplace']) {
      assert.ok(!text.includes(banned), `${kind} contains "${banned}"`);
    }
  }
});
