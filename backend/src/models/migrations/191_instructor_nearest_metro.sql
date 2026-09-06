-- Müəllimin seçdiyi Bakı metro stansiyası + əlavə stansiyalar axtarış filterinə
ALTER TABLE instructor_profiles
  ADD COLUMN IF NOT EXISTS nearest_metro VARCHAR(80);

COMMENT ON COLUMN instructor_profiles.nearest_metro IS 'Bakı metro slug (məs. 28-may) — hazırlıq yeri / pin yaxınlığı';

INSERT INTO service_areas (id, slug, name_az, kind, sort_order, is_popular) VALUES
  ('metro-28-may', '28-may', '28 May', 'metro', 110, TRUE),
  ('metro-elmler', 'elmler-akademiyasi', 'Elmlər Akademiyası', 'metro', 120, TRUE),
  ('metro-nariman', 'nariman-narimanov', 'Nəriman Nərimanov', 'metro', 130, TRUE),
  ('metro-genclik', 'genclik', 'Gənclik', 'metro', 140, TRUE),
  ('metro-sahil', 'sahil', 'Sahil', 'metro', 150, FALSE),
  ('metro-iceriseher', 'iceriseher', 'İçərişəhər', 'metro', 160, FALSE),
  ('metro-azadliq', 'azadliq', 'Azadlıq prospekti', 'metro', 170, FALSE),
  ('metro-dernegul', 'dernegul', 'Dərnəgül', 'metro', 180, FALSE),
  ('metro-hezi-aslanov', 'hezi-aslanov', 'Həzi Aslanov', 'metro', 190, FALSE),
  ('metro-bakmil', 'bakmil', 'Bakmil', 'metro', 200, FALSE),
  ('metro-ulduz', 'ulduz', 'Ulduz', 'metro', 210, FALSE),
  ('metro-koroglu', 'koroglu', 'Koroğlu', 'metro', 220, FALSE),
  ('metro-qara-qarayev', 'qara-qarayev', 'Qara Qarayev', 'metro', 230, FALSE),
  ('metro-neftciler', 'neftciler', 'Neftçilər', 'metro', 240, FALSE),
  ('metro-xalqlar-dostlugu', 'xalqlar-dostlugu', 'Xalqlar Dostluğu', 'metro', 250, FALSE),
  ('metro-ahmadli', 'ahmadli', 'Əhmədli', 'metro', 260, FALSE),
  ('metro-cefer-cabbarli', 'metro-cefer-cabbarli', 'Cəfər Cabbarlı', 'metro', 270, FALSE),
  ('metro-nizami', 'metro-nizami', 'Nizami', 'metro', 280, FALSE),
  ('metro-insaatcilar', 'metro-insaatcilar', 'İnşaatçılar', 'metro', 290, FALSE),
  ('metro-20-yanvar', 'metro-20-yanvar', '20 Yanvar', 'metro', 300, FALSE),
  ('metro-memar-acemi', 'metro-memar-acemi', 'Memar Əcəmi', 'metro', 310, FALSE),
  ('metro-nasimi', 'metro-nasimi', 'Nəsimi', 'metro', 320, FALSE),
  ('metro-xetai', 'metro-xetai', 'Xətai', 'metro', 330, FALSE),
  ('metro-avtovagzal', 'avtovagzal', 'Avtovağzal', 'metro', 340, FALSE),
  ('metro-8-noyabr', '8-noyabr', '8 Noyabr', 'metro', 350, FALSE),
  ('metro-khojasan', 'khojasan', 'Xocəsən', 'metro', 360, FALSE)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name_az = EXCLUDED.name_az,
  kind = EXCLUDED.kind,
  sort_order = EXCLUDED.sort_order;
