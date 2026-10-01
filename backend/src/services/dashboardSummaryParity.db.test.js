const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

/**
 * Real-DB parity: müəllim dashboard rəqəmləri = Phase D kartlarının cəmi (eyni roster, eyni status qaydaları).
 * Tələbə xülasəsi əl ilə hesablanmış gözləntilərlə və enrollment filtri ilə yoxlanılır.
 *
 * Yalnız lokal atılacaq (throwaway) DB-də işləyir:
 *   TZ=UTC DASHBOARD_PARITY_DATABASE_URL=postgresql://...@localhost:PORT/db node --test --test-force-exit src/services/dashboardSummaryParity.db.test.js
 * Hər işə salınma yeni UUID-lərlə yazır; mövcud sətirlərə toxunmur. TZ=UTC: pg DATE sütunlarını lokal vaxtla oxuyur
 * (engagementRules.assignmentDueEnd), Railway də UTC-dədir.
 */

const URL = process.env.DASHBOARD_PARITY_DATABASE_URL || '';
const LOCAL = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL);
const skip = !URL ? 'DASHBOARD_PARITY_DATABASE_URL not set' : !LOCAL ? 'refusing non-local database' : false;

const NOW = new Date('2026-10-01T10:00:00Z');
const H = 3600000;
const D = 24 * H;
const at = (ms) => new Date(NOW.getTime() + ms);
const day = (offsetDays) => new Date(NOW.getTime() + offsetDays * D).toISOString().slice(0, 10);

let db;
let svc;
let engagement;
const ids = {};

async function ins(table, row) {
  const cols = Object.keys(row);
  const params = cols.map((_, i) => `$${i + 1}`);
  await db.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${params.join(', ')})`, Object.values(row));
  return row.id;
}

const id = (name) => {
  ids[name] = ids[name] || randomUUID();
  return ids[name];
};

async function seed() {
  // Users
  await ins('users', { id: id('T'), full_name: 'Müəllim Parity', role: 'instructor', email: `t-${id('T')}@x.local` });
  await ins('users', { id: id('O'), full_name: 'Başqa Müəllim', role: 'instructor', email: `o-${id('O')}@x.local` });
  for (const s of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8']) {
    await ins('users', { id: id(s), full_name: `Tələbə ${s}`, role: 'student', email: `${s}-${id(s)}@x.local` });
  }
  await ins('users', { id: id('SX'), full_name: 'Deaktiv', role: 'student', email: `sx-${id('SX')}@x.local`, is_active: false });

  // Subjects + groups
  await ins('instructor_subjects', { id: id('subT'), instructor_id: id('T'), name: 'Riyaziyyat' });
  await ins('instructor_subjects', { id: id('subO'), instructor_id: id('O'), name: 'Fizika' });
  await ins('instructor_groups', { id: id('G1'), instructor_id: id('T'), subject_id: id('subT'), name: '7A' });
  await ins('instructor_groups', { id: id('G2'), instructor_id: id('T'), subject_id: id('subT'), name: '7B' });
  await ins('instructor_groups', { id: id('GO'), instructor_id: id('O'), subject_id: id('subO'), name: 'F1' });

  // Enrollments: S1-S4 + SX → G1, S5/S6 → G2, S7 → T without group, S8 pending approval, S1 also with O.
  const enr = async (key, student, instructor, group, status = 'active') =>
    ins('enrollments', { id: id(key), student_id: id(student), instructor_id: id(instructor), group_id: group ? id(group) : null, status });
  await enr('e1', 'S1', 'T', 'G1');
  await enr('e2', 'S2', 'T', 'G1');
  await enr('e3', 'S3', 'T', 'G1');
  await enr('e4', 'S4', 'T', 'G1');
  await enr('ex', 'SX', 'T', 'G1');
  await enr('e5', 'S5', 'T', 'G2');
  await enr('e6', 'S6', 'T', 'G2');
  await enr('e7', 'S7', 'T', null);
  await enr('e8', 'S8', 'T', 'G1', 'pending_approval');
  await enr('e1o', 'S1', 'O', 'GO');
  await ins('instructor_group_members', { instructor_id: id('T'), student_id: id('S7'), group_id: id('G2') });
  await ins('student_join_requests', {
    id: id('jr8'),
    enrollment_id: id('e8'),
    instructor_id: id('T'),
    group_id: id('G1'),
    student_id: id('S8'),
    status: 'PENDING',
    created_at: at(-2 * H),
  });

  // Assignments (DATE due)
  const asg = async (key, instructor, group, dueOffsetDays) =>
    ins('assignments', { id: id(key), instructor_id: id(instructor), title: `Tapşırıq ${key}`, group_id: group ? id(group) : null, due_date: day(dueOffsetDays) });
  await asg('A1', 'T', 'G1', 4);
  await asg('A2', 'T', 'G2', -6);
  await asg('A3', 'T', null, 0); // bu gün: Bakı 23:59 hələ keçməyib
  await asg('A4', 'T', null, -1); // dünən: keçib
  await asg('A5', 'T', 'G1', 2);
  await asg('A6', 'T', 'G1', 5);
  await asg('AO', 'O', 'GO', 3);
  const sa = (assignment, student, extra = {}) =>
    ins('student_assignments', { id: randomUUID(), assignment_id: id(assignment), student_id: id(student), ...extra });
  await sa('A1', 'S1', { status: 'reviewed', submitted_at: at(-3 * D), reviewed_at: at(-2 * D), score: 9 });
  await sa('A1', 'S2', { status: 'submitted', submitted_at: at(-1 * D) });
  await sa('A1', 'S3', { status: 'returned', returned_at: at(-1 * D), first_submitted_at: at(-2 * D) });
  await sa('A1', 'S4', { status: 'pending' });
  await sa('A1', 'SX', { status: 'submitted', submitted_at: at(-1 * D) });
  await sa('A2', 'S1', { status: 'late', submitted_at: at(-5 * D) });
  await sa('A2', 'S5', { status: 'pending' });
  await sa('A2', 'S6', { status: 'late_rejected', submitted_at: at(-4 * D) });
  await sa('A3', 'S2', { status: 'pending' });
  await sa('A4', 'S3', { status: 'pending', reviewed_at: at(-1 * D) });
  await sa('A5', 'S1', { status: 'pending' });
  await sa('A5', 'S2', { status: 'pending', seen_at: at(-1 * H) });
  await sa('A6', 'S1', { status: 'returned', returned_at: at(-1 * D), first_submitted_at: at(-3 * D) });
  await sa('AO', 'S1', { status: 'submitted', submitted_at: at(-1 * D) });

  // Materials
  const mat = async (key, instructor, extra = {}) =>
    ins('course_materials', {
      id: id(key),
      instructor_id: id(instructor),
      title: `Material ${key}`,
      file_url: `/api/materials/file/${key}.pdf`,
      storage_filename: `${key}.pdf`,
      file_type: 'application/pdf',
      file_size: 1000,
      created_at: at(-2 * D),
      ...extra,
    });
  await mat('M1', 'T', { group_id: id('G1'), due_at: at(-1 * D) });
  await mat('M2', 'T', { created_at: at(-30 * D) });
  await ins('course_material_groups', { material_id: id('M2'), group_id: id('G2') });
  await mat('M3', 'T'); // qrupsuz: müəllimin bütün aktiv tələbələri
  await mat('M4', 'T');
  await ins('course_material_groups', { material_id: id('M4'), group_id: id('G2') });
  await ins('course_material_guest_students', { material_id: id('M4'), student_id: id('S1') });
  await mat('M5', 'T', { assignment_id: id('A1') });
  await mat('M6', 'T', { group_id: id('G1') });
  await ins('assignment_material_links', { assignment_id: id('A2'), material_id: id('M6') });
  await mat('MO', 'O', { group_id: id('GO') });
  const prog = (material, student, extra) => ins('material_assignments', { material_id: id(material), student_id: id(student), ...extra });
  await prog('M1', 'S1', { first_opened_at: at(-2 * D), first_viewed_at: at(-2 * D) });
  await prog('M1', 'S2', { completed_at: at(-2 * D) });
  await prog('M1', 'S3', { first_opened_at: at(-2 * D) });
  await prog('M2', 'S5', { download_count: 1, first_downloaded_at: at(-3 * D) });
  await prog('M3', 'S2', { first_viewed_at: at(-1 * D) });

  // Exams
  const exam = async (key, instructor, extra = {}) =>
    ins('exams', { id: id(key), instructor_id: id(instructor), title: `İmtahan ${key}`, slug: `p-${id(key)}`, duration_minutes: 60, ...extra });
  await exam('E1', 'T', { available_until: at(1 * D) });
  await exam('E2', 'T', { available_until: at(1 * D), is_deleted: true });
  await exam('E3', 'T', { available_until: at(-1 * D) });
  await exam('E4', 'T', { available_until: at(3 * D) });
  await exam('E5', 'T', { available_until: at(-1 * D) });
  await exam('E6', 'T', { available_until: at(-1 * D) });
  await exam('EO', 'O', { available_until: at(1 * D) });
  const assign = (examKey, student, extra = {}) => ins('exam_assignments', { exam_id: id(examKey), student_id: id(student), ...extra });
  const result = (examKey, student, extra) =>
    ins('exam_results', { id: randomUUID(), exam_id: id(examKey), student_id: id(student), started_at: at(-3 * H), ...extra });
  const progress = (examKey, student, extra) => ins('exam_student_progress', { exam_id: id(examKey), student_id: id(student), ...extra });
  for (const s of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'SX']) await assign('E1', s);
  await progress('E1', 'S1', { status: 'result_released', started_at: at(-3 * H), completed_at: at(-2 * H), result_released_at: at(-1 * D) });
  await result('E1', 'S1', { status: 'completed', submitted_at: at(-2 * H), score: 8 });
  await progress('E1', 'S2', { status: 'expired_auto_submitted', started_at: at(-3 * H), completed_at: at(-2 * H), expired_at: at(-2 * H) });
  await result('E1', 'S2', { status: 'completed', submitted_at: at(-2 * H), score: 4 });
  await progress('E1', 'S3', { status: 'expired_no_answers', started_at: at(-3 * H), expired_at: at(-2 * H) });
  await result('E1', 'S3', { status: 'expired' });
  await progress('E1', 'S4', { status: 'in_progress', started_at: at(-10 * 60000), latest_activity_at: at(-5 * 60000) });
  await progress('E1', 'S5', { status: 'pending_manual_grading', started_at: at(-3 * H), completed_at: at(-2 * H) });
  await result('E1', 'S5', { status: 'completed', submitted_at: at(-2 * H), score: 5 });
  await result('E1', 'S6', { status: 'expired' }); // aqreqat yoxdur → cəhddən ehtiyat
  await progress('E1', 'S7', { status: 'viewed', viewed_at: at(-1 * H) });
  await progress('E1', 'SX', { status: 'pending_manual_grading', completed_at: at(-2 * H) });
  await assign('E2', 'S1');
  await progress('E2', 'S1', { status: 'pending_manual_grading', completed_at: at(-2 * H) });
  await result('E3', 'S8', { status: 'completed', submitted_at: at(-26 * H) }); // təyinatsız, amma cəhdi var
  await progress('E3', 'S8', { status: 'pending_manual_grading', completed_at: at(-26 * H) });
  await result('E3', 'S2', { status: 'voided', submitted_at: at(-26 * H) });
  await assign('E4', 'S1');
  await assign('E5', 'S1');
  await assign('E6', 'S1', { late_access_until: at(2 * D) });
  await assign('EO', 'S1');
  await assign('EO', 'S2');
  await progress('EO', 'S2', { status: 'pending_manual_grading', completed_at: at(-2 * H) });

  // Notifications for T (unread submissions)
  const notif = (user, type, extra = {}) =>
    ins('notifications', { id: randomUUID(), user_id: id(user), title: 't', body: 'b', type, is_read: false, ...extra });
  await notif('T', 'assignment_submitted');
  await notif('T', 'exam_auto_submitted');
  await notif('T', 'assignment_submitted', { is_read: true });
  await notif('T', 'assignment_reminder');
  await notif('T', 'assignment_late_submitted', { meta: JSON.stringify({ silent: true }) });
  await notif('O', 'assignment_submitted');

  // Activity log
  const log = (student, instructor, entityType, entity, event, ms) =>
    ins('student_activity_log', {
      student_id: id(student),
      instructor_id: id(instructor),
      entity_type: entityType,
      entity_id: id(entity),
      event_type: event,
      created_at: at(ms),
    });
  await log('S2', 'T', 'assignment', 'A1', 'assignment_submitted', -1 * H);
  await log('S1', 'T', 'assignment', 'A2', 'assignment_submitted', -2 * H);
  await log('S1', 'T', 'material', 'M1', 'material_viewed', -3 * H);
  await log('S1', 'T', 'material', 'M1', 'reminder_sent', -30 * 60000);
  await log('S3', 'T', 'material', 'M1', 'material_viewed', -30 * H);
  await log('S1', 'O', 'material', 'MO', 'material_viewed', -1 * H);
}

const sum = (cards, field) => cards.reduce((s, c) => s + (Number(c[field]) || 0), 0);
const byKey = (summary) => Object.fromEntries(summary.items.map((i) => [i.key, i]));

test('dashboard summary parity against the real schema', { skip }, async (t) => {
  process.env.DATABASE_URL = URL;
  db = require('../utils/db');
  svc = require('./dashboardSummaryService');
  engagement = require('./engagementService');
  await seed();

  await t.test('teacher counts equal the summed Phase D cards', async () => {
    const [materials, assignments, exams, summary] = await Promise.all([
      engagement.getMaterialSummaries(id('T'), { now: NOW }),
      engagement.getAssignmentSummaries(id('T'), { now: NOW }),
      engagement.getExamSummaries(id('T'), { now: NOW }),
      svc.getTeacherSummary(id('T'), { now: NOW }),
    ]);
    const it = byKey(summary);
    for (const i of summary.items) assert.equal(i.available, true, `${i.key} available`);

    assert.equal(it.unviewed_materials.count, sum(materials, 'not_viewed'), 'not_viewed');
    assert.equal(it.unviewed_materials.detail.overdue, sum(materials, 'overdue'), 'material overdue');
    assert.equal(it.unviewed_materials.detail.materials, materials.filter((m) => m.not_viewed > 0).length);

    assert.equal(it.pending_grading.detail.assignments, sum(assignments, 'waiting_grading'), 'waiting_grading');
    assert.equal(it.overdue_assignments.count, sum(assignments, 'overdue'), 'assignment overdue');
    assert.equal(it.overdue_assignments.detail.assignments, assignments.filter((a) => a.overdue > 0).length);

    assert.equal(it.pending_grading.detail.exams, sum(exams, 'pending_manual_grading'), 'pending_manual_grading');
    assert.equal(it.assessment_expiry.detail.auto_submitted, sum(exams, 'auto_submitted'), 'auto_submitted');
    assert.equal(it.assessment_expiry.detail.expired_no_answers, sum(exams, 'expired_no_answers'), 'expired_no_answers');
    assert.equal(it.pending_grading.count, sum(assignments, 'waiting_grading') + sum(exams, 'pending_manual_grading'));

    // Seed-dən gözlənilən dəyərlər (kartların özü də düzgün qurulduğunu göstərir):
    assert.equal(sum(assignments, 'waiting_grading'), 2, 'A1/S2 submitted + A2/S1 late; SX inactive excluded');
    assert.equal(sum(assignments, 'overdue'), 3, 'A2/S5, A2/S6 late_rejected, A4/S3; A3 due today not overdue');
    assert.equal(sum(exams, 'pending_manual_grading'), 2, 'E1/S5 + E3/S8 (attempt only); E2 deleted, SX inactive excluded');
    assert.equal(sum(exams, 'auto_submitted'), 1);
    assert.equal(sum(exams, 'expired_no_answers'), 2, 'E1/S3 progress + E1/S6 attempt fallback');
    assert.ok(sum(materials, 'overdue') >= 2, 'M1 past due: S3 opened-only + S4 never opened');
  });

  await t.test('teacher unread submissions, join requests and recent activity', async () => {
    const summary = await svc.getTeacherSummary(id('T'), { now: NOW });
    const it = byKey(summary);
    assert.equal(it.unread_submissions.count, 2, 'unread assignment_submitted + exam_auto_submitted; read/reminder/silent excluded');
    assert.equal(it.join_requests.count, 1);
    const a = summary.recent_activity;
    assert.equal(a.counts.submissions, 2);
    assert.equal(a.counts.material_views, 1, '30h-old view and reminder_sent excluded');
    assert.equal(a.total, 3);
    assert.equal(a.latest[0].entity_title, 'Tapşırıq A1');
    assert.equal(a.latest[0].student_name, 'Tələbə S2');
  });

  await t.test('other teacher sees none of this teacher’s data', async () => {
    const it = byKey(await svc.getTeacherSummary(id('O'), { now: NOW }));
    assert.equal(it.pending_grading.detail.assignments, 1, 'AO/S1 only');
    assert.equal(it.pending_grading.detail.exams, 1, 'EO/S2 only');
    assert.equal(it.join_requests.count, 0);
    assert.equal(it.unread_submissions.count, 1);
  });

  await t.test('student summary: own data, enrollment filter limits to that teacher', async () => {
    const all = byKey(await svc.getStudentSummary(id('S1'), { now: NOW }));
    const onlyT = byKey(await svc.getStudentSummary(id('S1'), { instructorId: id('T'), now: NOW }));

    assert.equal(onlyT.new_assessments.count, 2, 'E4 + E6 (late access); E1 touched, E5 closed, E2 deleted');
    assert.equal(all.new_assessments.count, 3, '+ EO');
    assert.equal(onlyT.upcoming_deadlines.detail.assessments, 2);
    assert.equal(all.upcoming_deadlines.detail.next_at, at(1 * D).toISOString(), 'EO closes first');
    assert.equal(onlyT.upcoming_deadlines.detail.next_at, at(2 * D).toISOString(), 'E6 late access ends before A5 (Baku 23:59)');

    assert.equal(onlyT.new_assignments.count, 1, 'A5 pending + unseen');
    assert.equal(onlyT.upcoming_deadlines.detail.assignments, 2, 'A5 + A6 returned');
    assert.equal(onlyT.teacher_feedback.detail.graded, 1, 'A1 reviewed 2 days ago');
    assert.equal(onlyT.teacher_feedback.detail.returned, 1, 'A6');

    assert.equal(onlyT.new_materials.count, 4, 'M3 ungrouped, M4 guest, M5 via A1, M6 group; M1 viewed, M2 not visible');
    assert.equal(all.new_materials.count, 5, '+ MO');

    assert.equal(onlyT.released_results.count, 1);
    assert.equal(onlyT.released_results.detail.latest_at, at(-1 * D).toISOString());
  });

  await t.test('student join status and isolation between students', async () => {
    const s8 = await svc.getStudentSummary(id('S8'), { now: NOW });
    assert.equal(s8.group_join.pending, 1);
    assert.equal(s8.group_join.requests[0].group_name, '7A');
    const s1 = await svc.getStudentSummary(id('S1'), { now: NOW });
    assert.equal(s1.group_join.pending, 0, 'S8’s request is not visible to S1');
    const s4 = byKey(await svc.getStudentSummary(id('S4'), { now: NOW }));
    assert.equal(s4.teacher_feedback.count, 0);
    assert.equal(s4.released_results.count, 0);
  });

  await t.test('admin summary runs on the real schema and is aggregate only', async () => {
    const before = byKey(await svc.getAdminSummary(id('T'), { now: NOW }));
    await ins('partners', { id: randomUUID(), user_id: id('O'), status: 'pending', created_at: at(-3 * D) });
    await ins('notification_queue', {
      id: randomUUID(),
      channel: 'email',
      event_type: 'assignment_assigned',
      unique_key: `parity:${randomUUID()}`,
      status: 'failed',
      failed_at: at(-2 * H),
      error_code: 'smtp_error',
    });
    await ins('auth_events', { event: 'login_failed', created_at: at(-1 * H), metadata: JSON.stringify({ reason: 'bad_password' }) });
    const s = await svc.getAdminSummary(id('T'), { now: NOW });
    const it = byKey(s);
    for (const i of s.items) assert.equal(i.available, true, `${i.key} query works on the real schema`);
    assert.equal(it.partner_applications.count, before.partner_applications.count + 1);
    assert.equal(it.failed_email_deliveries.count, before.failed_email_deliveries.count + 1);
    assert.equal(it.security_events.detail.auth_failures_24h, before.security_events.detail.auth_failures_24h + 1);
    assert.doesNotMatch(JSON.stringify(s), /student_id|full_name|"email"/);
    const ops = await svc.getAdminOperations({ now: NOW });
    assert.ok(ops.security && ops.jobs, 'operations sections load');
    assert.ok(ops.security.groups.some((g) => g.event === 'login_failed' && g.reason === 'bad_password'));
  });
});
