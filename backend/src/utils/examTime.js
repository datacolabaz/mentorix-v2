/**
 * JSON-dan gələn start_time (ISO və ya tarix string) — pg üçün vahid UTC ISO.
 * Frontend artıq yerli vaxtı ISO-ya çevirir; burada təkrar parse təhlükəsizdir.
 */
function normalizeExamStartTime(input) {
  if (input == null || input === '') return input;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return input;
  return d.toISOString();
}

module.exports = { normalizeExamStartTime };
