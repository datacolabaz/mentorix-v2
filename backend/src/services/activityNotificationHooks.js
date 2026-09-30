/**
 * Phase F notification hook points for activity events.
 *
 * Phase C deliberately sends NO notifications and never inserts into `notifications`:
 * Phase A builds `notificationService` (dedupe keys, preferences, email outbox) in parallel.
 * Every hook below is a no-op today. Phase F wires each one to `notificationService.createNotification`
 * with the dedupe key noted next to it (audit plan §10.10). Callers invoke hooks only after the
 * database transaction has committed, and a hook must never throw into the request path.
 */

function safe(fn) {
  return (payload) => {
    try {
      return fn(payload || {});
    } catch (e) {
      console.error('[activity-hooks]', e.message);
      return undefined;
    }
  };
}

/** TODO(Phase F): notify the teacher. dedupe_key `exam_submitted:{examResultId}`. */
const onAssessmentSubmitted = safe(() => undefined);

/** TODO(Phase F): notify the teacher that time ran out and answers were auto-submitted. dedupe_key `exam_expired:{examResultId}`. */
const onAssessmentAutoSubmitted = safe(() => undefined);

/** TODO(Phase F): optional teacher summary only (no per-student email). dedupe_key `exam_expired:{examResultId}`. */
const onAssessmentExpiredNoAnswers = safe(() => undefined);

/** TODO(Phase F): notify the student (and parent where configured). dedupe_key `result_released:{examId}:{studentId}`. */
const onResultReleased = safe(() => undefined);

/**
 * TODO(Phase F): notify the teacher; replaces the direct insert in taskController.submitMyAssignment.
 * dedupe_key `assignment_submitted:{studentAssignmentId}:{submissionCount}`; payload.late marks a late submission.
 */
const onAssignmentSubmitted = safe(() => undefined);

/** TODO(Phase F): notify the student. dedupe_key `assignment_returned:{studentAssignmentId}:{returnedAtEpoch}`. */
const onAssignmentReturnedForRevision = safe(() => undefined);

module.exports = {
  onAssessmentSubmitted,
  onAssessmentAutoSubmitted,
  onAssessmentExpiredNoAnswers,
  onResultReleased,
  onAssignmentSubmitted,
  onAssignmentReturnedForRevision,
};
