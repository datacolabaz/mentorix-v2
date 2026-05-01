const { recomputeAllInstructorsUsage } = require('../services/resourceUsageService');

async function reconcileStorageUsage() {
  // Best-effort reconciliation: ensures storage_used_mb doesn't drift upward forever.
  return await recomputeAllInstructorsUsage({ persist: true });
}

module.exports = { reconcileStorageUsage };

