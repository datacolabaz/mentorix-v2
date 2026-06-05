const AZ_WEEKDAY_SHORT = {
  1: 'B.e.',
  2: 'Ç.a.',
  3: 'Ç.',
  4: 'C.a.',
  5: 'C.',
  6: 'Ş.',
  7: 'B.',
};

const AZ_WEEKDAY_FULL = {
  1: 'Bazar ertəsi',
  2: 'Çərşənbə axşamı',
  3: 'Çərşənbə',
  4: 'Cümə axşamı',
  5: 'Cümə',
  6: 'Şənbə',
  7: 'Bazar',
};

function parseWeekdays(raw) {
  if (raw == null || raw === '') return [];
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((x) => parseInt(String(x), 10)).filter((n) => n >= 1 && n <= 7))].sort(
    (a, b) => a - b,
  );
}

function parseLessonTimes(raw) {
  if (raw == null || raw === '') return {};
  let o = raw;
  if (typeof raw === 'string') {
    try {
      o = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return {};
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    const t = String(v || '').trim().slice(0, 5);
    if (/^\d{2}:\d{2}$/.test(t)) out[String(k)] = t;
  }
  return out;
}

function bakuNowParts() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Baku',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const wdMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const dow = wdMap[get('weekday')] || 1;
  const hour = parseInt(get('hour') || '0', 10) || 0;
  const minute = parseInt(get('minute') || '0', 10) || 0;
  return { dow, minutes: hour * 60 + minute };
}

/**
 * Növbəti potensial boş dərs vaxtı (qrup cədvəlindən).
 * @returns {{ label: string, iso_weekday: number, time: string } | null}
 */
function computeNextLessonSlot(weekdaysRaw, lessonTimesRaw) {
  const days = parseWeekdays(weekdaysRaw);
  if (!days.length) return null;
  const lt = parseLessonTimes(lessonTimesRaw);
  const now = bakuNowParts();
  const cur = (now.dow - 1) * 1440 + now.minutes;
  let best = { dist: Number.POSITIVE_INFINITY, dow: null, time: null };

  for (const d of days) {
    const t = lt[String(d)] ?? lt[d];
    const time = String(t || '').slice(0, 5);
    if (!/^\d{2}:\d{2}$/.test(time)) continue;
    const [hh, mm] = time.split(':').map((x) => parseInt(x, 10));
    const target = (d - 1) * 1440 + hh * 60 + mm;
    const dist = (target - cur + 10080) % 10080;
    if (dist < best.dist) best = { dist, dow: d, time };
  }

  if (!Number.isFinite(best.dist) || best.dow == null) return null;

  const dayLabel =
    best.dist < 1440 && best.dist > 0
      ? 'Bu gün'
      : best.dist >= 1440 && best.dist < 2880
        ? 'Sabah'
        : AZ_WEEKDAY_FULL[best.dow] || AZ_WEEKDAY_SHORT[best.dow] || '';

  return {
    label: `${dayLabel}, ${best.time}`,
    iso_weekday: best.dow,
    time: best.time,
  };
}

function shortAddress(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (s.length <= 48) return s;
  return `${s.slice(0, 47)}…`;
}

module.exports = {
  computeNextLessonSlot,
  shortAddress,
  parseWeekdays,
  parseLessonTimes,
};
