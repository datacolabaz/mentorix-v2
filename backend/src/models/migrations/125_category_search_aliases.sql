-- Axtarış sinonimləri (məs: "data analysis" → Data Analitika)
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS search_aliases TEXT DEFAULT NULL;

COMMENT ON COLUMN categories.search_aliases IS 'Vergüllə ayrılmış axtarış sinonimləri (EN və s.)';

-- Nümunə: data analysis axtarışı
UPDATE categories
SET name_az = 'Data Analitika',
    search_aliases = 'data analysis, data analitika, data analytics'
WHERE id = 'data-analysis';
