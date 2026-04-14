-- Mark exam results lifecycle; submit should write completed immediately.
ALTER TABLE exam_results
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';

-- Backfill old rows
UPDATE exam_results SET status = COALESCE(status, 'completed');

