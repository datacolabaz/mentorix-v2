const { normalizePlanSlug } = require('../config/plans');

/** Tək fayl üçün maksimum ölçü (25 MB) */
const MATERIALS_MAX_SINGLE_FILE_BYTES = 25 * 1024 * 1024;

/** Paket üzrə materiallar kitabxanası yaddaş limitləri */
const MATERIALS_PLAN_LIMITS = {
  basic: { storageBytes: 50 * 1024 * 1024, maxFiles: 5 },
  pro: { storageBytes: 2 * 1024 * 1024 * 1024, maxFiles: null },
  growth: { storageBytes: 5 * 1024 * 1024 * 1024, maxFiles: null },
  premium: { storageBytes: 20 * 1024 * 1024 * 1024, maxFiles: null },
};

const STORAGE_LIMIT_MESSAGE =
  'Yaddaş limitiniz dolub. Daha çox material yükləmək üçün paketinizi yeniləyin.';

function materialsLimitsForPlan(planSlug) {
  const slug = normalizePlanSlug(planSlug);
  return MATERIALS_PLAN_LIMITS[slug] || MATERIALS_PLAN_LIMITS.basic;
}

function formatBytesLabel(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * @returns {{ allowed: boolean, code?: string, message?: string }}
 */
function evaluateMaterialsUpload({ planSlug, usedBytes, fileCount, addBytes }) {
  const size = Number(addBytes) || 0;
  if (size > MATERIALS_MAX_SINGLE_FILE_BYTES) {
    return {
      allowed: false,
      code: 'MATERIALS_FILE_TOO_LARGE',
      message: 'Tək fayl ölçüsü 25 MB-dan çox ola bilməz.',
    };
  }

  const limits = materialsLimitsForPlan(planSlug);
  const nextBytes = (Number(usedBytes) || 0) + size;
  if (limits.storageBytes != null && nextBytes > limits.storageBytes) {
    return {
      allowed: false,
      code: 'MATERIALS_STORAGE_LIMIT',
      message: STORAGE_LIMIT_MESSAGE,
    };
  }

  if (limits.maxFiles != null && (Number(fileCount) || 0) + 1 > limits.maxFiles) {
    return {
      allowed: false,
      code: 'MATERIALS_FILE_COUNT_LIMIT',
      message: STORAGE_LIMIT_MESSAGE,
    };
  }

  return { allowed: true };
}

module.exports = {
  MATERIALS_MAX_SINGLE_FILE_BYTES,
  MATERIALS_PLAN_LIMITS,
  STORAGE_LIMIT_MESSAGE,
  materialsLimitsForPlan,
  formatBytesLabel,
  evaluateMaterialsUpload,
};
