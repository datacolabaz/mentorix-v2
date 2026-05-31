function padHHMM(v) {
  const s = String(v || '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function toMinutes(hhmm) {
  const p = padHHMM(hhmm);
  if (!p) return NaN;
  const [h, m] = p.split(':').map((x) => parseInt(x, 10));
  return h * 60 + m;
}

function addMinutesToHm(hhmm, minutes) {
  const start = toMinutes(hhmm);
  if (!Number.isFinite(start)) return null;
  const endMin = start + minutes;
  const eh = String(Math.floor(endMin / 60) % 24).padStart(2, '0');
  const em = String(endMin % 60).padStart(2, '0');
  return `${eh}:${em}`;
}

/** { "1": "16:00", ... } — yalnız seçilmiş günlər */
function parseLessonEndTimes(raw, lessonWeekdays, lessonTimes) {
  if (raw == null) return {};
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const days = Array.isArray(lessonWeekdays) ? lessonWeekdays : [];
  const starts = lessonTimes && typeof lessonTimes === 'object' ? lessonTimes : {};
  const out = {};
  for (const d of days) {
    const key = String(d);
    const start = padHHMM(starts[key] ?? starts[d]);
    let end = padHHMM(obj[d] ?? obj[key]);
    if (!start) continue;
    if (!end) end = addMinutesToHm(start, 60);
    if (!end || toMinutes(end) <= toMinutes(start)) continue;
    out[key] = end;
  }
  return out;
}

function endTimeForWeekday(lessonTimes, lessonEndTimes, weekday) {
  const key = String(weekday);
  const start = padHHMM(lessonTimes?.[key] ?? lessonTimes?.[weekday]);
  if (!start) return null;
  const end = padHHMM(lessonEndTimes?.[key] ?? lessonEndTimes?.[weekday]);
  if (end && toMinutes(end) > toMinutes(start)) return end;
  return addMinutesToHm(start, 60);
}

module.exports = {
  padHHMM,
  toMinutes,
  addMinutesToHm,
  parseLessonEndTimes,
  endTimeForWeekday,
};
