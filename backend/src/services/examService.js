const db = require('../utils/db');

const normType = (t) => String(t ?? '').trim().toLowerCase();

/** exam_results.answers obyektində sual id bəzən defisli/defissiz və ya tip fərqi ilə saxlanılır */
function normQuestionKey(id) {
  if (id == null) return '';
  return String(id).trim().toLowerCase().replace(/-/g, '');
}

function getAnswerRaw(answers, questionId) {
  if (!answers || typeof answers !== 'object') return undefined;
  if (questionId == null) return undefined;
  const idStr = String(questionId);
  if (Object.prototype.hasOwnProperty.call(answers, idStr)) return answers[idStr];
  if (answers[questionId] !== undefined) return answers[questionId];
  const want = normQuestionKey(questionId);
  if (!want) return undefined;
  for (const k of Object.keys(answers)) {
    if (normQuestionKey(k) === want) return answers[k];
  }
  return undefined;
}

function orderedExamQuestions(questions) {
  return [...(questions || [])].sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
}

function indexOfQuestionInExamOrder(ordered, q) {
  const want = normQuestionKey(q?.id);
  if (!want) return -1;
  for (let i = 0; i < ordered.length; i += 1) {
    if (normQuestionKey(ordered[i]?.id) === want) return i;
  }
  return -1;
}

/** Köhnə / müxtəlif klientlər: obyekt, FEFF və s. */
function normalizeAnswerPayload(raw) {
  if (raw == null) return '';
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw).replace(/\uFEFF/g, '').trim();
  }
  if (typeof raw === 'object') {
    for (const k of ['choice', 'key', 'value', 'answer', 'letter', 'text']) {
      if (raw[k] != null && String(raw[k]).trim() !== '') {
        return String(raw[k]).replace(/\uFEFF/g, '').trim();
      }
    }
  }
  return String(raw).replace(/\uFEFF/g, '').trim();
}

/**
 * Cavab obyekti: { [sual_uuid]: "A" } və ya { "3": "A" }, bəzən answers[] imtahan sual sırası ilə.
 */
function resolveAnswerRaw(answers, q, indexInFullOrder) {
  const idx = Number.isFinite(indexInFullOrder) && indexInFullOrder >= 0 ? indexInFullOrder : -1;
  const candidates = [];

  if (Array.isArray(answers)) {
    if (idx >= 0 && answers[idx] !== undefined) candidates.push(answers[idx]);
    if (q?.order_num != null) {
      const j = Number(q.order_num) - 1;
      if (Number.isFinite(j) && j >= 0 && j < answers.length) candidates.push(answers[j]);
    }
  }

  if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
    candidates.push(getAnswerRaw(answers, q.id));
    if (q?.order_num != null) {
      candidates.push(getAnswerRaw(answers, q.order_num));
      candidates.push(getAnswerRaw(answers, String(q.order_num)));
    }
  }

  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    if (normalizeAnswerPayload(c) !== '') return c;
  }
  if (!Array.isArray(answers) && answers && typeof answers === 'object') {
    return getAnswerRaw(answers, q.id);
  }
  return undefined;
}

/** Ardıcıllıq: müəllimin saxladığı açar (boşdursa köhnə sətirlər üçün template_hint) */
function sequenceEffectiveCorrect(q) {
  const ca = String(q?.correct_answer ?? '').trim();
  if (ca) return ca;
  return String(q?.template_hint ?? '').trim();
}

const SEQ_GRADE_DEBUG = process.env.SEQ_GRADE_DEBUG === '1';

/** Ardıcıllıq: yalnız whitespace + görünməyən boşluqlar silinir, sonra simvol-simvol müqayisə. */
function normSequenceIgnoreSpaces(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .replace(/[\s\u00A0\u200B\uFEFF\u200C\u200D]+/g, ''); // includes \s+ plus common invisible spaces
}

function sequenceAnswersEqual(givenRaw, correctRaw) {
  const rawStudent = String(givenRaw ?? '');
  const rawTeacher = String(correctRaw ?? '');

  // Exact requested comparison (strict string-only)
  const studentNorm = String(rawStudent).trim().replace(/\s+/g, '');
  const correctNorm = String(rawTeacher).trim().replace(/\s+/g, '');
  const isCorrect = studentNorm === correctNorm;

  if (SEQ_GRADE_DEBUG) {
    // Requested exact debug line
    console.log('DEBUG: Student:' + rawStudent + ' | Expected:' + rawTeacher);
    console.log(
      `Comparing Student: [${rawStudent}] with Teacher: [${rawTeacher}] for Question Type: Sequence`
    );
    // extra: show sanitized values to confirm hidden chars
    console.log(`Sequence norm (\\s+) → student:[${studentNorm}] teacher:[${correctNorm}] ok:${isCorrect}`);
  }

  return isCorrect;
}

function inferQuestionType(q) {
  const t = normType(q?.question_type);
  if (['closed', 'multiple', 'matching', 'open', 'sequence'].includes(t)) return t;
  // Legacy / inconsistent DB rows: infer from options shape
  let opts = q?.options;
  if (typeof opts === 'string') {
    try {
      opts = JSON.parse(opts);
    } catch {
      opts = null;
    }
  }
  if (Array.isArray(opts) && opts.some((r) => r && typeof r === 'object' && ('left' in r || 'right' in r))) {
    return 'matching';
  }
  return t || 'open';
}

/**
 * Qapalı sual: səhv cavab üçün sabit cərimə (default 0.25).
 * `exams.wrong_penalty_enabled === false` olanda 0; `negative_marking === 0` olan sualda 0.
 * Çoxseçimli suallarda cərimə yoxdur (səhv = 0 bal).
 */
function wrongSelectionPenaltyMagnitude(q, wrongPenaltyEnabled) {
  if (!wrongPenaltyEnabled) return 0;
  const t = inferQuestionType(q);
  if (t !== 'closed') return 0;
  const n = q.negative_marking;
  if (n === null || n === undefined || n === '') return 0.25;
  const v = Number(n);
  if (Number.isNaN(v)) return 0.25;
  if (v === 0) return 0;
  return Math.abs(v);
}

/** Çoxseçimli: yalnız rəqəmlər, ardıcıllıqdan asılı olmayaraq (23 = 32) */
function normDigits(str) {
  return String(str ?? '')
    .replace(/\D/g, '')
    .split('')
    .filter(Boolean)
    .sort()
    .join('');
}

function parseAzNumber(str) {
  const s = String(str ?? '').trim();
  if (!s) return null;
  const normalized = s.replace(',', '.').replace(/\s+/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function openAutoKey(q) {
  if (inferQuestionType(q) !== 'open') return null;
  const hint = q.template_hint != null ? String(q.template_hint).trim() : '';
  const hn = parseAzNumber(hint);
  return hn == null ? null : hn;
}

/**
 * Uyğunluq cavabı üçün strict müqayisə:
 * - whitespace nəzərə alınmır
 * - böyük/kiçik hərf nəzərə alınmır
 * - qalan bütün simvollar simvol-simvol müqayisə olunur (order-sensitive)
 */
function normMatchStrict(str) {
  return String(str ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

/** Uyğunluq: "1b1c2a2e" və "1bc2ae" eyni məna → "1bc2ae" */
function matchingAnswerCanonical(raw) {
  const s = normMatchStrict(raw);
  if (!s) return '';
  const map = new Map();
  const re = /(\d+)([a-z]+)/gi;
  let m;
  while ((m = re.exec(s)) !== null) {
    const num = m[1];
    const letters = m[2].split('').filter((ch) => /[a-z]/.test(ch));
    const prev = map.get(num) || [];
    map.set(num, prev.concat(letters));
  }
  const nums = [...map.keys()].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  return nums
    .map((n) => {
      const letters = [...new Set(map.get(n) || [])].sort().join('');
      return letters ? `${n}${letters}` : '';
    })
    .filter(Boolean)
    .join('');
}

function deriveMatchingKeyFromOptions(options) {
  let opts = options;
  if (typeof opts === 'string') {
    try {
      opts = JSON.parse(opts);
    } catch {
      opts = null;
    }
  }
  if (!Array.isArray(opts)) return '';
  let key = '';
  for (let i = 0; i < opts.length; i++) {
    const row = opts[i];
    if (!row || typeof row !== 'object') continue;
    const L = String(row.left ?? '').trim();
    const R = String(row.right ?? '').trim();
    const num = (L.match(/\d+/) || [])[0] || String(i + 1);
    const letters = R.replace(/[^a-z]/gi, '').toLowerCase();
    if (letters) key += num + letters;
  }
  return matchingAnswerCanonical(key);
}

/**
 * Uyğunluq üçün düzgün açar: əvvəlcə müəllimin cədvəlindəki sol/sağ cütlər (options),
 * boşdursa DB-də saxlanmış `correct_answer`. Köhnə səhv: `template_hint` (1a2b3c) ayrıca
 * saxlanıb `correct_answer` kimi qalırdı və real cütləri kölgələyirdi.
 */
function matchingCanonicalCorrect(q) {
  const fromOpts = String(deriveMatchingKeyFromOptions(q?.options) ?? '').trim();
  if (fromOpts) return fromOpts;
  return matchingAnswerCanonical(q?.correct_answer ?? '');
}

function matchingPairCountFromOptions(options) {
  let opts = options;
  if (typeof opts === 'string') {
    try {
      opts = JSON.parse(opts);
    } catch {
      opts = [];
    }
  }
  if (!Array.isArray(opts)) return 0;
  return opts.filter((row) => row && typeof row === 'object').length;
}

/** Cüt sayına uyğun format nümunəsi (ümumi «1a2b3c» üç cütdür; iki cüt üçün 1a2b olmalıdır). */
function syntheticMatchingTemplateHint(pairCount) {
  const n = Math.min(Math.max(Number(pairCount) || 0, 1), 26);
  let s = '';
  for (let i = 1; i <= n; i += 1) {
    s += `${i}${String.fromCharCode(96 + i)}`;
  }
  return s;
}

/**
 * Tələbə tərəfində göstəriləcək uyğunluq format nümunəsi — yalnız cüt sayına görə sintetik.
 * DB-dəki `template_hint` / `correct_answer` heç vaxt ötürülmür (müəllim açarı sızdırılmasın).
 */
function matchingStudentTemplateHint(q) {
  const n = matchingPairCountFromOptions(q?.options);
  if (n > 0) return syntheticMatchingTemplateHint(n);
  return '1a2b3c';
}

/** Tələbə imtahanı: uyğunluq sualında options cütləri düzgün cavabı kodlayır — göndərilmir. */
function stripExamQuestionForStudent(q) {
  const { correct_answer: _ca, template_hint: _th, ...rest } = q;
  const type = inferQuestionType(rest);
  if (type === 'matching') {
    return {
      ...rest,
      options: null,
      template_hint: matchingStudentTemplateHint({ options: q?.options }),
    };
  }
  if (type === 'multiple') {
    return { ...rest, template_hint: '13' };
  }
  if (type === 'sequence') {
    return { ...rest, template_hint: '231' };
  }
  if (type === 'open') {
    return { ...rest };
  }
  // closed və digər: yalnız variantlar; düzgün hərf (A/B/…) göndərilmir
  return { ...rest };
}

function gradeMatching(given, correctStored, optionsForFallback) {
  const g = matchingAnswerCanonical(given);
  const c = matchingCanonicalCorrect({
    correct_answer: correctStored,
    options: optionsForFallback,
  });
  if (!g) return { status: 'pending', isCorrect: null };
  // tələbə cavabı var, amma açar tapılmadısa pending saxlamırıq (UI-da "Yoxlanılır" qalmasın)
  if (!c) return { status: 'incorrect', isCorrect: false };
  const ok = g === c;
  return { status: ok ? 'correct' : 'incorrect', isCorrect: ok };
}

/**
 * Submit-time auto-grading snapshot (DB üçün).
 * Hazırda ən kritik hissə: matching suallar dərhal correct/incorrect olsun.
 */
function buildAutoGradingMap(questions, answers) {
  const out = {};
  const fullOrder = orderedExamQuestions(questions);
  for (const q of questions || []) {
    if (!q?.id) continue;
    const type = inferQuestionType(q);
    const id = q.id;
    const iFull = indexOfQuestionInExamOrder(fullOrder, q);
    const raw = resolveAnswerRaw(answers, q, iFull);
    const given = normalizeAnswerPayload(raw);

    if (type === 'matching') {
      const correct = String(q.correct_answer ?? '');
      const g = gradeMatching(given, correct, q.options);
      const pts = Number(q.points || 0);
      out[id] = {
        type: 'matching',
        status: g.status,
        earned_points: g.status === 'correct' ? pts : 0,
      };
    }

    if (type === 'sequence') {
      const correct = sequenceEffectiveCorrect(q);
      const gStr = given == null || given === '' ? '' : String(given);
      const pts = Number(q.points || 0);
      const gNorm = normSequenceIgnoreSpaces(gStr);
      if (!gNorm) out[id] = { type: 'sequence', status: 'pending', earned_points: 0 };
      else if (!normSequenceIgnoreSpaces(correct)) {
        out[id] = { type: 'sequence', status: 'incorrect', earned_points: 0 };
      } else {
        const ok = sequenceAnswersEqual(gStr, correct);
        if (SEQ_GRADE_DEBUG) {
          console.log(
            `Comparing Student: [${String(gStr)}] with Teacher: [${String(correct)}] for Question Type: Sequence`
          );
          console.log(`Sequence normalized → student:[${normSequenceIgnoreSpaces(gStr)}] teacher:[${normSequenceIgnoreSpaces(correct)}] ok:${ok}`);
        }
        out[id] = { type: 'sequence', status: ok ? 'correct' : 'incorrect', earned_points: ok ? pts : 0 };
      }
    }
  }
  return out;
}

const TYPE_KEYS = ['closed', 'multiple', 'matching', 'open', 'sequence'];

function emptyTypeAgg() {
  return { correct: 0, wrong: 0, unanswered: 0, pending: 0, points: 0 };
}

/**
 * Hər sual üçün avtomatik bal hissəsi + xülasə üçün nəticə növü.
 * `wrongPenaltyEnabled` — `exams.wrong_penalty_enabled` (müəllim seçimi).
 */
function scoreQuestionForAuto(q, answers, wrongPenaltyEnabled, indexInFullOrder) {
  const type = inferQuestionType(q);
  const rawAns = resolveAnswerRaw(answers, q, indexInFullOrder);
  const given = normalizeAnswerPayload(rawAns);
  const pts = Number(q.points || 0);
  const pen = wrongSelectionPenaltyMagnitude(q, wrongPenaltyEnabled);

  if (!given) {
    return { type, delta: 0, outcome: 'unanswered' };
  }

  if (type === 'closed') {
    const correct = String(q.correct_answer ?? '').trim();
    if (!correct) return { type, delta: 0, outcome: 'pending' };
    const ok = given.toUpperCase() === correct.toUpperCase();
    if (ok) return { type, delta: pts, outcome: 'correct' };
    return { type, delta: -pen, outcome: 'wrong' };
  }

  if (type === 'multiple') {
    const ca = q.correct_answer;
    const caNorm = normDigits(ca);
    if (!caNorm) return { type, delta: 0, outcome: 'pending' };
    if (normDigits(given) === caNorm) return { type, delta: pts, outcome: 'correct' };
    return { type, delta: 0, outcome: 'wrong' };
  }

  if (type === 'matching') {
    const keyStored = String(q.correct_answer ?? '').trim();
    const g = gradeMatching(given, keyStored, q.options);
    if (g.status === 'correct') return { type, delta: pts, outcome: 'correct' };
    if (g.status === 'incorrect') return { type, delta: 0, outcome: 'wrong' };
    return { type, delta: 0, outcome: 'pending' };
  }

  if (type === 'open') {
    const key = openAutoKey(q);
    if (key == null) return { type, delta: 0, outcome: given ? 'pending' : 'unanswered' };
    const gn = parseAzNumber(given);
    if (gn == null) return { type, delta: 0, outcome: 'wrong' };
    const ok = Math.abs(gn - key) < 1e-9;
    if (ok) return { type, delta: pts, outcome: 'correct' };
    return { type, delta: 0, outcome: 'wrong' };
  }

  if (type === 'sequence') {
    const correct = sequenceEffectiveCorrect(q);
    if (!normSequenceIgnoreSpaces(correct)) return { type, delta: 0, outcome: 'pending' };
    const ok = sequenceAnswersEqual(given, correct);
    if (SEQ_GRADE_DEBUG) {
      console.log(
        `Comparing Student: [${String(given)}] with Teacher: [${String(correct)}] for Question Type: Sequence`
      );
      console.log(`Sequence normalized → student:[${normSequenceIgnoreSpaces(given)}] teacher:[${normSequenceIgnoreSpaces(correct)}] ok:${ok}`);
    }
    if (ok) return { type, delta: pts, outcome: 'correct' };
    return { type, delta: 0, outcome: 'wrong' };
  }

  return { type, delta: 0, outcome: 'unanswered' };
}

/**
 * Avtomatik bal: qapalı (səhvə cərimə, imtahan bayrağına görə), çoxseçimli, uyğunluq, açıq.
 */
const calculateScore = (questions, answers, opts = {}) => {
  const wrongPenaltyEnabled = opts.wrongPenaltyEnabled !== false;
  let earned = 0;
  const fullOrder = orderedExamQuestions(questions);
  const scored = fullOrder.filter((q) => TYPE_KEYS.includes(inferQuestionType(q)));

  for (const q of scored) {
    const idx = indexOfQuestionInExamOrder(fullOrder, q);
    const r = scoreQuestionForAuto(q, answers, wrongPenaltyEnabled, idx);
    earned += r.delta;
  }

  earned = Math.max(0, earned);
  return Math.round(earned * 100) / 100;
};

/**
 * Sual tipinə görə düzgün/səhv/cavabsız/yoxlanılır sayları və həmin tiplərdən toplanan avtomatik bal.
 */
const buildExamTypeSummary = (questions, answers, opts = {}) => {
  const wrongPenaltyEnabled = opts.wrongPenaltyEnabled !== false;
  const byType = Object.fromEntries(TYPE_KEYS.map((k) => [k, emptyTypeAgg()]));
  const fullOrder = orderedExamQuestions(questions);
  const scored = fullOrder.filter((q) => TYPE_KEYS.includes(inferQuestionType(q)));

  let rawSum = 0;
  for (const q of scored) {
    const idx = indexOfQuestionInExamOrder(fullOrder, q);
    const r = scoreQuestionForAuto(q, answers, wrongPenaltyEnabled, idx);
    rawSum += r.delta;
    const bucket = byType[r.type];
    if (r.outcome === 'correct') bucket.correct += 1;
    else if (r.outcome === 'wrong') bucket.wrong += 1;
    else if (r.outcome === 'pending') bucket.pending += 1;
    else bucket.unanswered += 1;
    bucket.points += r.delta;
  }

  const total = Math.max(0, Math.round(rawSum * 100) / 100);
  for (const k of TYPE_KEYS) {
    byType[k].points = Math.round(byType[k].points * 100) / 100;
  }

  return {
    by_type: byType,
    score: total,
    raw_sum: Math.round(rawSum * 100) / 100,
  };
};

/**
 * Tələbə UI: təqdimetmədən sonra hər sual üçün şablon vs yazılan cavab.
 */
const buildExamResultBreakdown = (questions, answers, opts = {}) => {
  const showCorrectAnswers = opts?.showCorrectAnswers === true;
  const order = orderedExamQuestions(questions);
  return order.map((q, idx) => {
    const raw = resolveAnswerRaw(answers, q, idx);
    const given = normalizeAnswerPayload(raw);
    const type = inferQuestionType(q);
    let correctDisplay = '';
    let correctLabel = '';
    let isCorrect = null;

    if (type === 'closed') {
      const c = String(q.correct_answer ?? '').trim();
      if (showCorrectAnswers && c) {
        correctLabel = 'Düzgün cavab';
        correctDisplay = c;
      } else {
        correctDisplay = '';
      }
      if (!given) isCorrect = null;
      else {
        isCorrect = c ? given.toUpperCase() === c.toUpperCase() : null;
      }
    } else if (type === 'multiple') {
      const ca = String(q.correct_answer ?? '').trim();
      const caNorm = normDigits(ca);
      const hint = String(q.template_hint || '').trim();
      if (showCorrectAnswers && caNorm) {
        correctLabel = 'Düzgün cavab';
        correctDisplay = caNorm;
      } else {
        correctLabel = 'Şablon / nümunə';
        correctDisplay = hint ? `Nümunə: ${hint}` : 'Nümunə: 13';
      }
      if (!given) isCorrect = null;
      else {
        isCorrect = caNorm ? normDigits(given) === caNorm : null;
      }
    } else if (type === 'matching') {
      const canonical = matchingCanonicalCorrect(q);
      if (showCorrectAnswers && canonical) {
        correctLabel = 'Düzgün cavab';
        correctDisplay = canonical;
      } else {
        // Düzgün açar gizlədiləndə format nümunəsi səhvən «düzgün cavab» kimi görünür — ikinci sütun göstərilmir.
        correctLabel = '';
        correctDisplay = '';
      }
      if (!given) isCorrect = null;
      else isCorrect = gradeMatching(given, q.correct_answer, q.options).isCorrect;
    } else if (type === 'open') {
      const ca = String(q.correct_answer ?? '').trim();
      const hint = String(q.template_hint || '').trim();
      if (showCorrectAnswers && ca) {
        correctLabel = 'Düzgün cavab';
        correctDisplay = ca;
      } else {
        correctLabel = 'Şablon / nümunə';
        correctDisplay = hint ? `Nümunə / gözlənti: ${hint}` : 'Müəllim qiymətləndirir';
      }
      const key = openAutoKey(q);
      if (!given) isCorrect = null;
      else if (key == null) isCorrect = null;
      else {
        const gn = parseAzNumber(given);
        isCorrect = gn == null ? false : Math.abs(gn - key) < 1e-9;
      }
    } else if (type === 'sequence') {
      const key = sequenceEffectiveCorrect(q);
      if (showCorrectAnswers && normSequenceIgnoreSpaces(key)) {
        correctLabel = 'Düzgün cavab';
        correctDisplay = key;
      } else {
        correctLabel = 'Şablon / nümunə';
        correctDisplay =
          'Format nümunəsi: bənd nömrələrini ardıcıllaqla bitişik yazın (boşluqsuz).';
      }
      if (!given) isCorrect = null;
      else {
        if (!normSequenceIgnoreSpaces(key)) isCorrect = false;
        else isCorrect = sequenceAnswersEqual(given, key);
        if (SEQ_GRADE_DEBUG) {
          console.log(
            `Comparing Student: [${String(given)}] with Teacher: [${String(key)}] for Question Type: Sequence`
          );
          console.log(`Sequence normalized → student:[${normSequenceIgnoreSpaces(given)}] teacher:[${normSequenceIgnoreSpaces(key)}] ok:${isCorrect}`);
        }
      }
    }

    let statusLabel = 'Manual qiymətləndirmə';
    if (type === 'open') {
      if (!given) statusLabel = 'Cavabsız';
      else if (isCorrect === true) statusLabel = 'Düzgün';
      else if (isCorrect === false) statusLabel = openAutoKey(q) == null ? 'Manual qiymətləndirmə' : 'Səhv';
      else statusLabel = 'Manual qiymətləndirmə';
    }
    else if (!given) statusLabel = 'Cavabsız';
    else if (isCorrect === true) statusLabel = type === 'matching' ? 'Doğru' : 'Düzgün';
    else if (isCorrect === false) statusLabel = 'Səhv';

    return {
      order: idx + 1,
      question_id: q.id,
      question_type: type,
      question_text: q.question_text || `Sual ${idx + 1}`,
      student_answer: given || '—',
      correct_display: correctDisplay,
      correct_label: correctLabel,
      is_correct: isCorrect,
      status_label: statusLabel,
    };
  });
};

// Neticeleri sirala
const rankResults = async (examId) => {
  const { rows } = await db.query(
    `SELECT er.*, u.full_name
     FROM exam_results er
     JOIN users u ON u.id = er.student_id
     WHERE er.exam_id = $1
     ORDER BY er.score DESC, er.duration_seconds ASC`,
    [examId]
  );
  return rows;
};

// Imtahan aktiv mi yoxla
const isExamActive = (exam) => {
  const now = new Date();
  const start = new Date(exam.start_time);
  const end = new Date(start.getTime() + exam.duration_minutes * 60000);
  return now >= start && now <= end;
};

const REMINDER_MINUTES_BEFORE = 5;

function buildStudentExamUrl(examId) {
  const base = String(process.env.FRONTEND_URL || process.env.FRONTEND_BASE_URL || '').replace(/\/+$/, '');
  if (!base || !examId) return null;
  return `${base}/student/exams?exam=${encodeURIComponent(String(examId))}`;
}

function formatExamScheduleAz(exam) {
  const fromRaw = exam?.available_from || exam?.start_time;
  const untilRaw = exam?.available_until;
  const opts = { timeZone: 'Asia/Baku', dateStyle: 'short', timeStyle: 'short' };
  const fromD = fromRaw ? new Date(fromRaw) : null;
  const untilD = untilRaw ? new Date(untilRaw) : null;
  if (fromD && !Number.isNaN(fromD.getTime())) {
    let s = fromD.toLocaleString('az-AZ', opts);
    if (untilD && !Number.isNaN(untilD.getTime())) {
      s += ` – ${untilD.toLocaleString('az-AZ', opts)}`;
    }
    return s;
  }
  return '—';
}

async function loadExamAssignmentContacts(examId) {
  const { rows } = await db.query(
    `SELECT ea.student_id, u.phone, u.email, u.full_name, u.is_verified,
            COALESCE(NULLIF(TRIM(sp.parent_phone), ''), pu.phone) AS parent_phone
     FROM exam_assignments ea
     JOIN users u ON u.id = ea.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = ea.student_id
     LEFT JOIN users pu ON pu.id = sp.parent_id
     WHERE ea.exam_id = $1`,
    [examId]
  );
  return rows || [];
}

async function insertStudentExamInAppNotification(studentId, exam, examLink) {
  const title = 'Yeni imtahan';
  const body = examLink
    ? `«${String(exam.title || 'İmtahan').trim()}» üçün təyin edildiniz. Link: ${examLink}`
    : `«${String(exam.title || 'İmtahan').trim()}» üçün təyin edildiniz. Mentorix → İmtahanlar.`;
  await db
    .query(
      `INSERT INTO notifications (user_id, title, body, type, is_read)
       VALUES ($1, $2, $3, 'exam', FALSE)`,
      [studentId, title, body]
    )
    .catch(() => {});
}

async function enqueueExamPlacedEmails(exam, assignments, examLink) {
  const { enqueueNotification } = require('./notificationQueueService');
  const when = formatExamScheduleAz(exam);
  const mins = Number(exam.duration_minutes) || 60;
  const title = String(exam.title || 'İmtahan').trim();
  const subject = `Mentorix — Yeni imtahan: ${title}`;
  let queued = 0;

  for (const s of assignments) {
    const email = s.email != null ? String(s.email).trim() : '';
    if (!email || !email.includes('@')) continue;
    const firstName = String(s.full_name || 'Tələbə').trim().split(/\s+/)[0] || 'Tələbə';
    const body =
      `Salam, ${firstName}!\n\n` +
      `«${title}» imtahanı sizin üçün planlaşdırılıb.\n` +
      `Aktivlik: ${when}\n` +
      `Müddət: ${mins} dəqiqə\n\n` +
      (examLink
        ? `İmtahana keçid (giriş tələb olunur):\n${examLink}\n\n`
        : `Mentorix tətbiqində «İmtahanlar» bölməsinə daxil olun.\n\n`) +
      `Hörmətlə,\nMentorix`;

    try {
      await enqueueNotification({
        channel: 'email',
        event_type: 'exam_placed',
        unique_key: `exam_placed_email_${exam.id}_${s.student_id}`,
        user_id: s.student_id,
        instructor_id: exam.instructor_id,
        to_addr: email,
        subject,
        body,
        context: { exam_id: exam.id, exam_link: examLink },
      });
      queued += 1;
    } catch (e) {
      console.error('exam placed email enqueue failed', s.student_id, e?.message);
    }
  }
  return queued;
}

/** İmtahan yerləşdirildikdə: tələbələrə WhatsApp/SMS, email (növbə) və panel bildirişi. */
const sendExamPlacedNotifications = async (examId, options = {}) => {
  const { sendStudentWhatsAppOrSms, pickStudentNotifyPhone } = require('./studentMessagingService');
  const { getWhatsAppConfig } = require('./whatsappService');
  const waCfg = getWhatsAppConfig();
  const filterIds = Array.isArray(options.studentIds)
    ? new Set(options.studentIds.map((x) => String(x)))
    : null;

  const { rows: [exam] } = await db.query(
    `SELECT id, instructor_id, title, duration_minutes, start_time, available_from, available_until, status, is_deleted
     FROM exams WHERE id = $1`,
    [examId]
  );
  if (!exam || exam.is_deleted || exam.status === 'cancelled') {
    return { sent: 0, skipped: 0, emails: 0 };
  }

  let assignments = await loadExamAssignmentContacts(examId);
  if (filterIds && filterIds.size) {
    assignments = assignments.filter((s) => filterIds.has(String(s.student_id)));
  }
  if (!assignments.length) return { sent: 0, skipped: 0, emails: 0 };

  const when = formatExamScheduleAz(exam);
  const mins = Number(exam.duration_minutes) || 60;
  const title = String(exam.title || 'İmtahan').trim();
  const examLink = buildStudentExamUrl(exam.id);
  const linkHint = examLink ? `\nLink: ${examLink}` : '';

  let sent = 0;
  let skipped = 0;

  for (const s of assignments) {
    await insertStudentExamInAppNotification(s.student_id, exam, examLink);

    const targetPhone = pickStudentNotifyPhone(s);
    if (!targetPhone) {
      skipped += 1;
      continue;
    }
    const firstName = String(s.full_name || 'Tələbə').trim().split(/\s+/)[0] || 'Tələbə';
    const msg =
      `Mentorix: Salam, ${firstName}! "${title}" imtahanı sizin üçün planlaşdırılıb.\n` +
      `Aktivlik: ${when}\n` +
      `Müddət: ${mins} dəqiqə.${linkHint}\n` +
      `Giriş edib imtahana başlayın.`;

    const examTpl = waCfg.examTemplateName;
    const r = await sendStudentWhatsAppOrSms({
      instructorId: exam.instructor_id,
      studentId: s.student_id,
      phone: targetPhone,
      message: msg,
      logType: 'exam_placed',
      templateNameOverride: examTpl,
      templateBodyParams: examTpl ? [firstName, title, when, String(mins)] : null,
    });
    if (r?.success) sent += 1;
    else {
      skipped += 1;
      console.error('exam placed notify failed', s.student_id, r?.error || r?.whatsapp_error);
    }
  }

  const emails = await enqueueExamPlacedEmails(exam, assignments, examLink);
  return { sent, skipped, emails };
};

/** İmtahan başlamasına ~5 dəq qalmış: əvvəlcə tələbə nömrəsi, yoxdursa valideyn. */
const sendExamStartReminderForExam = async (exam) => {
  const { sendStudentWhatsAppOrSms, pickStudentNotifyPhone } = require('./studentMessagingService');
  const assignments = await loadExamAssignmentContacts(exam.id);
  const startTime = formatExamScheduleAz(exam);

  for (const s of assignments) {
    const targetPhone = pickStudentNotifyPhone(s);
    if (!targetPhone) continue;

    const r = await sendStudentWhatsAppOrSms({
      instructorId: exam.instructor_id,
      studentId: s.student_id,
      phone: targetPhone,
      message: `Mentorix: "${exam.title}" imtahanı ${startTime} tarixində başlayacaq (~${REMINDER_MINUTES_BEFORE} dəq qalıb). Hazır olun!`,
      logType: 'exam_reminder',
    });
    if (!r?.success) console.error('exam reminder notify failed', targetPhone, r?.error);
  }
};

/**
 * Cron: vaxti catmis exam_reminder job-larini emal edir.
 */
const processExamNotificationJobs = async () => {
  const { rows } = await db.query(
    `SELECT nj.id AS job_id, e.id AS exam_id, e.instructor_id, e.title, e.start_time,
            e.notify_students, e.notify_enabled, e.status
     FROM notification_jobs nj
     INNER JOIN exams e ON e.id = nj.exam_id
     WHERE nj.processed_at IS NULL
       AND nj.job_type = 'exam_reminder'
       AND nj.run_at <= NOW()
     ORDER BY nj.run_at
     LIMIT 40`
  );

  for (const row of rows) {
    const skip =
      row.notify_students !== true ||
      row.notify_enabled !== true ||
      row.status !== 'scheduled';
    if (skip) {
      await db.query('UPDATE notification_jobs SET processed_at = NOW() WHERE id = $1', [row.job_id]);
      continue;
    }
    const exam = {
      id: row.exam_id,
      instructor_id: row.instructor_id,
      title: row.title,
      start_time: row.start_time,
    };
    try {
      await sendExamStartReminderForExam(exam);
    } catch (err) {
      console.error('exam reminder SMS', row.job_id, err.message);
    }
    await db.query('UPDATE notification_jobs SET processed_at = NOW() WHERE id = $1', [row.job_id]);
  }
};

/**
 * Yeni / yenilənmiş imtahan üçün tək exam_reminder job-u (başlamadan 5 dəq əvvəl).
 * İmtahan <5 dəq sonraya planlanıbsa, dərhal SMS (cron gözləmədən).
 */
const syncExamReminderJob = async (examId) => {
  await db.query(
    `DELETE FROM notification_jobs
     WHERE exam_id = $1 AND job_type = 'exam_reminder' AND processed_at IS NULL`,
    [examId]
  );

  const { rows: [exam] } = await db.query('SELECT * FROM exams WHERE id = $1', [examId]);
  if (!exam) return;

  const notifyOn =
    exam.notify_students === true &&
    exam.notify_enabled === true &&
    exam.status === 'scheduled';
  if (!notifyOn) return;

  const startMs = new Date(exam.start_time).getTime();
  const now = Date.now();
  if (Number.isNaN(startMs) || startMs <= now) return;

  const runAtMs = startMs - REMINDER_MINUTES_BEFORE * 60 * 1000;
  if (runAtMs > now) {
    await db.query(
      `INSERT INTO notification_jobs (exam_id, job_type, run_at) VALUES ($1, 'exam_reminder', $2)`,
      [examId, new Date(runAtMs)]
    );
  } else {
    await sendExamStartReminderForExam(exam);
  }
};

/** Tələbə təqdimetdikdən sonra valideynə (əvvəlcə profil valideyn nömrəsi, sonra valideyn user, sonra tələbə). */
const notifyParentExamResultAfterSubmit = async (examId, studentId, score) => {
  const { sendStudentWhatsAppOrSms } = require('./studentMessagingService');
  const { rows: [row] } = await db.query(
    `SELECT e.title, e.show_results, e.notify_students, e.notify_enabled, e.instructor_id, u.full_name AS student_name,
            COALESCE(NULLIF(TRIM(sp.parent_phone), ''), pu.phone, u.phone) AS notify_phone
     FROM exams e
     JOIN exam_assignments ea ON ea.exam_id = e.id AND ea.student_id = $2
     JOIN users u ON u.id = $2
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     LEFT JOIN users pu ON pu.id = sp.parent_id
     WHERE e.id = $1`,
    [examId, studentId]
  );
  if (!row?.notify_students || !row?.notify_enabled) return;
  if (!row?.notify_phone) return;

  const clean = String(row.notify_phone).replace(/\D/g, '');
  if (clean.length < 9) return;

  const name = row.student_name || 'Tələbə';
  const pts = Math.round(Number(score) * 100) / 100;
  const safePts = Number.isFinite(pts) ? pts : 0;
  const title = String(row.title || 'İmtahan').trim();
  const msg = `Mentorix: Salam, ${name}! "${title}" imtahanında ${safePts} bal toplayıb.`;

  const r = await sendStudentWhatsAppOrSms({
    instructorId: row.instructor_id,
    studentId,
    phone: row.notify_phone,
    message: msg,
    logType: 'exam_result',
  });
  if (!r?.success) console.error('exam result notify failed', r?.error);
};

module.exports = {
  calculateScore,
  buildExamTypeSummary,
  buildExamResultBreakdown,
  buildAutoGradingMap,
  matchingStudentTemplateHint,
  stripExamQuestionForStudent,
  matchingCanonicalCorrect,
  rankResults,
  isExamActive,
  processExamNotificationJobs,
  syncExamReminderJob,
  buildStudentExamUrl,
  sendExamPlacedNotifications,
  notifyParentExamResultAfterSubmit,
};
