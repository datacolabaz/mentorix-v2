-- İctimai müəllim profili: təhsil və sertifikatlar
ALTER TABLE instructor_profiles
  ADD COLUMN IF NOT EXISTS discover_education TEXT,
  ADD COLUMN IF NOT EXISTS discover_certifications TEXT;
