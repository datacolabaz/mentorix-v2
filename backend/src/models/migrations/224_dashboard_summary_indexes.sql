-- Phase E: tələbə dashboard-u «yeni imtahan / yaxın son tarix» üçün öz təyinatlarını student_id ilə axtarır.
-- exam_assignments-da student_id ilə başlayan indeks yoxdur (yalnız (exam_id) və UNIQUE (exam_id, student_id)),
-- ona görə hər tələbə dashboard-u bütün cədvəli skan edirdi. Yalnız yeni indeks: cədvəl və sətirlər dəyişmir,
-- təkrar işlədilə bilər. Migrasiya tranzaksiyada işlədiyi üçün CONCURRENTLY mümkün deyil — indeks qurulana qədər
-- exam_assignments-a yazılar gözləyir (sətir sayı kiçikdir, bir neçə saniyədən az).
-- Rollback (əl ilə): backend/scripts/sql/rollback/224_dashboard_summary_indexes.rollback.sql

SET LOCAL lock_timeout = '10s';

CREATE INDEX IF NOT EXISTS idx_exam_assignments_student
  ON exam_assignments (student_id);
