-- Həftənin hansı günləri tələbəyə dərs təyin olunub (1=B.e. … 7=Bazar)
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS lesson_weekdays JSONB DEFAULT '[]'::jsonb;
