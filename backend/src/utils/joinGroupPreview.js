const {
  billingTypeLabel,
  paymentTimingLabel,
  paymentTimingShort,
} = require('./groupPaymentTerms');

const WEEKDAY_SHORT_AZ = {
  1: 'B.e.',
  2: 'Ç.a.',
  3: 'Ç.',
  4: 'C.a.',
  5: 'C.',
  6: 'Ş.',
  7: 'B.',
};

const DELIVERY_LABELS = {
  online: 'Onlayn',
  teacher_place: 'Müəllimin yanında',
  student_place: 'Tələbənin evində',
};

function formatScheduleSummary(defaults) {
  const lwd = Array.isArray(defaults?.lesson_weekdays) ? defaults.lesson_weekdays : [];
  const lt = defaults?.lesson_times && typeof defaults.lesson_times === 'object' ? defaults.lesson_times : {};
  if (!lwd.length) return '';
  return lwd
    .map((d) => {
      const short = WEEKDAY_SHORT_AZ[d] || `Gün ${d}`;
      const t = lt[String(d)] || lt[d];
      return t ? `${short} ${t}`.trim() : short;
    })
    .filter(Boolean)
    .join(' · ');
}

function lessonFormatFromDeliveryFormats(formats) {
  const list = Array.isArray(formats) ? formats.map((f) => String(f || '').trim().toLowerCase()) : [];
  const hasOnline = list.includes('online');
  const hasPlace = list.includes('teacher_place') || list.includes('student_place');
  if (hasOnline && hasPlace) return 'Hibrid (onlayn + yerində)';
  if (hasOnline) return 'Onlayn';
  if (hasPlace) return 'Yerində (offline)';
  if (list.length) {
    const labels = list.map((f) => DELIVERY_LABELS[f] || f).filter(Boolean);
    return labels.join(' · ') || null;
  }
  return null;
}

function buildGroupTermsPreview(defaults, packageOffer) {
  if (!defaults) return null;
  const billing_timing = defaults.billing_timing || 'postpaid';
  const payment_plan = defaults.payment_plan || 'full';
  const schedule_summary = formatScheduleSummary(defaults);
  const hasSchedule = Boolean(schedule_summary);
  const hasBilling = Boolean(defaults.billing_type);
  if (!hasSchedule && !hasBilling && !packageOffer) return null;

  return {
    billing_type: defaults.billing_type || null,
    billing_type_label: defaults.billing_type ? billingTypeLabel(defaults.billing_type) : null,
    payment_timing: billing_timing,
    payment_plan,
    payment_timing_short: paymentTimingShort(billing_timing, payment_plan),
    payment_timing_label: paymentTimingLabel(billing_timing, payment_plan),
    lesson_weekdays: defaults.lesson_weekdays || [],
    lesson_times: defaults.lesson_times || {},
    schedule_summary,
    package_fee: packageOffer?.final_price ?? defaults.package_fee ?? null,
    package_complete: Boolean(packageOffer),
    has_schedule: hasSchedule,
  };
}

module.exports = {
  DELIVERY_LABELS,
  lessonFormatFromDeliveryFormats,
  buildGroupTermsPreview,
  formatScheduleSummary,
};
