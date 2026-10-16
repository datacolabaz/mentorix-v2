const { randomUUID, randomInt } = require('node:crypto');

const TYPES = Object.freeze([
  'single_choice', 'multiple_choice', 'true_false', 'short_answer', 'numeric',
  'matching', 'ordering', 'open_answer', 'file_upload',
]);
const MANUAL = new Set(['open_answer', 'file_upload']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_ANSWERS_BYTES = 200 * 1024;

function fail(statusCode, code, message = code) {
  const e = new Error(message);
  Object.assign(e, { statusCode, code });
  throw e;
}
function check(ok, field) {
  if (!ok) fail(400, 'QB_INVALID_INPUT', `Düzgün olmayan sahə: ${field}`);
}
function object(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function id(v, field = 'id') {
  check(typeof v === 'string' && UUID.test(v), field);
  return v.toLowerCase();
}
function optionalId(v, field) {
  return v == null || v === '' ? null : id(v, field);
}
function text(v, field, max = 200, empty = false) {
  check(typeof v === 'string' && v.length <= max && (empty || v.trim().length > 0), field);
  return v.trim();
}
function bool(v, field) {
  check(typeof v === 'boolean', field);
  return v;
}
function cents(v, field = 'points', { zero = false, max = 999999.99 } = {}) {
  check((typeof v === 'number' || (typeof v === 'string' && /^\d+(?:\.\d{1,2})?$/.test(v))) &&
    Number.isFinite(Number(v)) && Number(v) >= (zero ? 0 : 0.01) && Number(v) <= max &&
    Math.abs(Number(v) * 100 - Math.round(Number(v) * 100)) < 0.000001, field);
  return Math.round(Number(v) * 100);
}
function number(v, field) {
  check((typeof v === 'number' || (typeof v === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim()))) &&
    Number.isFinite(Number(v)) && Math.abs(Number(v)) <= 1e12, field);
  return Number(v);
}
function ids(v, field, max = 500) {
  check(Array.isArray(v) && v.length <= max, field);
  const out = v.map(x => id(x, field));
  check(new Set(out).size === out.length, field);
  return out;
}
function jsonLimit(v, max = MAX_ANSWERS_BYTES) {
  check(Buffer.byteLength(JSON.stringify(v) || '', 'utf8') <= max, 'payload size');
}
function enumValue(v, values, field) {
  check(values.includes(v), field);
  return v;
}
function page(query = {}) {
  const limit = query.limit == null ? 25 : Number(query.limit);
  const offset = query.offset == null ? 0 : Number(query.offset);
  check(Number.isInteger(limit) && limit > 0 && limit <= 100, 'limit');
  check(Number.isInteger(offset) && offset >= 0 && offset <= 1000000, 'offset');
  return { limit, offset };
}
function date(v, field) {
  check(typeof v === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/i.test(v) && Number.isFinite(Date.parse(v)), field);
  return new Date(v).toISOString();
}
function sameSet(a, b) {
  return a.length === b.length && a.every(x => b.includes(x));
}
function normalizeQuestion(input) {
  check(object(input), 'question');
  jsonLimit(input);
  const q = {
    subject_id: id(input.subject_id, 'subject_id'),
    topic_id: optionalId(input.topic_id, 'topic_id'),
    source_pdf_id: optionalId(input.source_pdf_id, 'source_pdf_id'),
    source_page: input.source_page == null ? null : Number(input.source_page),
    question_text: text(input.question_text, 'question_text', 20000),
    question_type: enumValue(input.question_type, TYPES, 'question_type'),
    difficulty: enumValue(input.difficulty || 'medium', ['easy', 'medium', 'hard'], 'difficulty'),
    points: cents(input.points ?? 1) / 100,
    explanation: input.explanation == null ? null : text(input.explanation, 'explanation', 20000, true),
    status: enumValue(input.status || 'draft', ['draft', 'published', 'archived'], 'status'),
  };
  check(input.source_page == null || (['number', 'string'].includes(typeof input.source_page) && /^\d+$/.test(String(input.source_page))), 'source_page');
  check(q.source_page == null || (q.source_pdf_id && Number.isInteger(q.source_page) && q.source_page > 0), 'source_page');
  check(input.options == null || Array.isArray(input.options), 'options');
  check((input.options || []).length <= 100, 'options');
  q.options = (input.options || []).map((o, i) => {
    check(object(o), 'option');
    const side = q.question_type === 'matching' ? enumValue(o.metadata?.side, ['left', 'right'], 'option.side') : null;
    return {
      id: o.id ? id(o.id, 'option.id') : randomUUID(),
      option_text: text(o.option_text, 'option_text', 4000),
      order_num: i + 1, is_correct: o.is_correct === true,
      metadata: side ? { side } : {},
    };
  });
  const all = q.options.map(o => o.id);
  check(new Set(all).size === all.length, 'duplicate options');
  check(input.answer_key == null || object(input.answer_key), 'answer_key');
  const k = input.answer_key || {};
  const suppliedKey = Object.keys(k).length > 0;
  let key = {};
  // Drafts may omit the key, but any key supplied must be fully valid.
  if (q.status === 'published' || suppliedKey || MANUAL.has(q.question_type)) {
    switch (q.question_type) {
      case 'single_choice': {
        const correct = k.option_id || q.options.filter(o => o.is_correct).map(o => o.id)[0];
        if (!k.option_id) check(q.options.filter(o => o.is_correct).length === 1, 'single correct option');
        key = { option_id: id(correct, 'option_id') };
        check(all.includes(key.option_id), 'option_id');
        break;
      }
      case 'multiple_choice':
        key = { option_ids: ids(k.option_ids || q.options.filter(o => o.is_correct).map(o => o.id), 'option_ids', 100) };
        check(key.option_ids.length > 0 && key.option_ids.every(x => all.includes(x)), 'option_ids');
        break;
      case 'true_false':
        key = { value: bool(k.value, 'answer_key.value') };
        break;
      case 'short_answer':
        check(Array.isArray(k.accepted_answers) && k.accepted_answers.length > 0 && k.accepted_answers.length <= 100, 'accepted_answers');
        key = {
          accepted_answers: k.accepted_answers.map(x => text(x, 'accepted_answer', 2000)),
          case_sensitive: k.case_sensitive == null ? false : bool(k.case_sensitive, 'case_sensitive'),
        };
        break;
      case 'numeric':
        check(Array.isArray(k.accepted_values) && k.accepted_values.length > 0 && k.accepted_values.length <= 100, 'accepted_values');
        key = {
          accepted_values: k.accepted_values.map(x => number(x, 'accepted_value')),
          tolerance: k.tolerance == null ? 0 : number(k.tolerance, 'tolerance'),
        };
        check(key.tolerance >= 0 && key.tolerance <= 1e6, 'tolerance');
        break;
      case 'matching': {
        check(object(k.pairs), 'pairs');
        const left = q.options.filter(o => o.metadata.side === 'left').map(o => o.id);
        const right = q.options.filter(o => o.metadata.side === 'right').map(o => o.id);
        key = { pairs: Object.fromEntries(Object.entries(k.pairs).map(([l, r]) => [id(l), id(r)])) };
        check(left.length >= 2 && left.length === right.length &&
          sameSet(Object.keys(key.pairs), left) && sameSet(Object.values(key.pairs), right), 'complete one-to-one matching key');
        break;
      }
      case 'ordering':
        key = { order: ids(k.order, 'order', 100) };
        check(sameSet(key.order, all), 'complete ordering key');
        break;
      default:
        // Manual types never store an auto-grading rule/model answer.
        check(!suppliedKey, 'manual answer_key must be empty');
    }
  }
  const usesOptions = ['single_choice', 'multiple_choice', 'matching', 'ordering'].includes(q.question_type);
  check(usesOptions || all.length === 0, 'options not supported for this type');
  if (usesOptions && (q.status === 'published' || suppliedKey)) check(all.length >= 2, 'at least two options');
  q.options = q.options.map(o => ({
    ...o, is_correct: q.question_type === 'single_choice' ? o.id === key.option_id :
      q.question_type === 'multiple_choice' ? (key.option_ids || []).includes(o.id) : false,
  }));
  q.answer_key = key;
  return q;
}
function hasAnswer(v) {
  if (v == null || v === '') return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (object(v)) return Object.values(v).some(hasAnswer);
  return true; // false and numeric zero are meaningful answers.
}
function normalizeAnswer(q, value, fileIds = []) {
  if (q.question_type === 'file_upload') {
    if (value != null) check(object(value) && sameSet(ids(value.file_ids, 'file_ids', 1), fileIds), 'owned file_ids');
    return fileIds.length ? { file_ids: fileIds } : null;
  }
  if (value == null || value === '') return null;
  const all = q.options.map(o => o.id);
  switch (q.question_type) {
    case 'single_choice': {
      const v = id(value, 'answer');
      check(all.includes(v), 'answer option');
      return v;
    }
    case 'multiple_choice':
    case 'ordering': {
      const v = ids(value, 'answer', 100);
      check(v.every(x => all.includes(x)), 'answer options');
      return v;
    }
    case 'true_false': return bool(value, 'answer');
    case 'numeric': return number(value, 'answer');
    case 'short_answer': return text(value, 'answer', 2000, true) || null;
    case 'open_answer': return text(value, 'answer', 20000, true) || null;
    case 'matching': {
      check(object(value), 'answer pairs');
      const pairs = Object.fromEntries(Object.entries(value).map(([l, r]) => [id(l), id(r)]));
      const left = q.options.filter(o => o.metadata.side === 'left').map(o => o.id);
      const right = q.options.filter(o => o.metadata.side === 'right').map(o => o.id);
      check(Object.keys(pairs).every(x => left.includes(x)) && Object.values(pairs).every(x => right.includes(x)) &&
        new Set(Object.values(pairs)).size === Object.keys(pairs).length, 'answer pairs');
      return pairs;
    }
    default: fail(400, 'QB_INVALID_TYPE');
  }
}
function gradeAnswer(q, value) {
  if (MANUAL.has(q.question_type)) return { status: 'pending_review', awarded_points: null, is_correct: null };
  const k = q.answer_key;
  let correct = false;
  if (hasAnswer(value)) {
    switch (q.question_type) {
      case 'single_choice': correct = value === k.option_id; break;
      case 'multiple_choice': correct = sameSet(value, k.option_ids); break;
      case 'true_false': correct = value === k.value; break;
      case 'numeric':
        correct = k.accepted_values.some(n => Math.abs(n - value) <= k.tolerance +
          Number.EPSILON * Math.max(1, Math.abs(n), Math.abs(value)));
        break;
      case 'short_answer': {
        const norm = s => {
          const v = s.normalize('NFKC').trim().replace(/\s+/gu, ' ');
          return k.case_sensitive ? v : v.toLowerCase();
        };
        correct = k.accepted_answers.some(s => norm(s) === norm(value));
        break;
      }
      case 'matching':
        correct = sameSet(Object.keys(value), Object.keys(k.pairs)) &&
          Object.entries(k.pairs).every(([l, r]) => value[l] === r);
        break;
      case 'ordering': correct = value.length === k.order.length && value.every((x, i) => x === k.order[i]); break;
      default: fail(400, 'QB_INVALID_TYPE');
    }
  }
  return { status: 'auto_graded', awarded_points: correct ? Number(q.points) : 0, is_correct: correct };
}
function shuffled(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function publicQuestion(q, optionOrder = null) {
  const ordered = optionOrder || q.options.map(o => o.id);
  return {
    id: q.id, question_text: q.question_text, question_type: q.question_type, points: Number(q.points),
    options: ordered.map(oid => q.options.find(o => o.id === oid)).filter(Boolean).map(o => ({
      id: o.id, option_text: o.option_text,
      ...(q.question_type === 'matching' ? { side: o.metadata.side } : {}),
    })),
  };
}
function deadline(exam, attempt, assignment = null) {
  const personal = new Date(new Date(attempt.started_at).getTime() + Number(exam.duration_minutes) * 60000);
  if (exam.allow_finish_after_until !== false) return personal;
  const until = new Date(Math.max(Date.parse(exam.available_until), Date.parse(assignment?.late_access_until) || 0));
  return new Date(Math.min(personal.getTime(), until.getTime()));
}
module.exports = {
  TYPES, MANUAL, UUID, MAX_FILE_BYTES, MAX_ANSWERS_BYTES, fail, check, object, id, optionalId, text,
  bool, cents, number, ids, jsonLimit, enumValue, page, date, sameSet, normalizeQuestion,
  hasAnswer, normalizeAnswer, gradeAnswer, shuffled, publicQuestion, deadline,
};
