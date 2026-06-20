-- Eyni ad + ölkə ilə təkrar universitet yaradılmasının qarşısını alır

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_universities_name_country_unique
  ON universities (name, country);

COMMIT;
