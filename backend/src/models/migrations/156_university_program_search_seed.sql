-- MVP universitet və proqram seed (Almaniya, Polşa, Türkiyə, Macarıstan, İtaliya)

BEGIN;

INSERT INTO universities (id, name, country, city, world_ranking, logo_url, housing_info, funding_info, slug)
VALUES
  ('a1000001-0000-4000-8000-000000000001', 'Technical University of Munich', 'Almaniya', 'Münhen', 28, NULL, 'Tələbə yataqxanaları mövcuddur', 'DAAD və universitet təqaüdləri', 'tum-munich'),
  ('a1000001-0000-4000-8000-000000000002', 'Warsaw University of Technology', 'Polşa', 'Varşava', 501, NULL, 'Kampus yataqxanaları', 'NAWA və Erasmus+', 'warsaw-tech'),
  ('a1000001-0000-4000-8000-000000000003', 'Boğaziçi University', 'Türkiyə', 'İstanbul', 404, NULL, 'Kampus və şəhər mənzilləri', 'YÖK və universitet bursları', 'bogazici'),
  ('a1000001-0000-4000-8000-000000000004', 'Eötvös Loránd University', 'Macarıstan', 'Budapeşt', 601, NULL, 'ELTE yataqxanaları', 'Stipendium Hungaricum', 'elte-budapest'),
  ('a1000001-0000-4000-8000-000000000005', 'Politecnico di Milano', 'İtaliya', 'Milan', 123, NULL, 'DSU yataqxana dəstəyi', 'Invest Your Talent in Italy', 'polimi-milan'),
  ('a1000001-0000-4000-8000-000000000006', 'Heidelberg University', 'Almaniya', 'Heidelberg', 87, NULL, 'Studierendenwerk yataqxanaları', 'Deutschlandstipendium', 'heidelberg'),
  ('a1000001-0000-4000-8000-000000000007', 'Jagiellonian University', 'Polşa', 'Krakow', 371, NULL, 'Mieszkanie dla studentów', 'Polish National Agency scholarships', 'jagiellonian'),
  ('a1000001-0000-4000-8000-000000000008', 'Middle East Technical University', 'Türkiyə', 'Ankara', 336, NULL, 'METU yataqxanaları', 'TÜBİTAK və universitet bursları', 'metu-ankara')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO programs (
  id, uni_id, degree_level, name, field, duration_years, tuition_fee,
  scholarship_available, language, intake_months, deadline_dates, requirements, apply_link, portal_source
)
VALUES
  (
    'b2000001-0000-4000-8000-000000000001',
    'a1000001-0000-4000-8000-000000000001',
    'MSc', 'Computer Science', 'CS', 2, 0,
    true, 'English', ARRAY['October'], ARRAY['2026-07-15']::date[],
    '{"min_gpa": 3.0, "min_language": {"ielts": 6.5}, "documents": ["CV", "Transcript", "Motivation letter"]}'::jsonb,
    'https://www.tum.de/en/studies/application', 'uni-assist'
  ),
  (
    'b2000001-0000-4000-8000-000000000002',
    'a1000001-0000-4000-8000-000000000001',
    'BSc', 'Informatics', 'CS', 3, 0,
    false, 'German', ARRAY['October'], ARRAY['2026-07-15']::date[],
    '{"min_gpa": 2.8, "min_language": {"ielts": 6.0}, "documents": ["Transcript", "Language certificate"]}'::jsonb,
    'https://www.tum.de/en/studies/application', 'uni-assist'
  ),
  (
    'b2000001-0000-4000-8000-000000000003',
    'a1000001-0000-4000-8000-000000000002',
    'MSc', 'Data Science', 'CS', 2, 4500,
    true, 'English', ARRAY['October'], ARRAY['2026-06-30']::date[],
    '{"min_gpa": 3.2, "min_language": {"ielts": 6.5}, "documents": ["CV", "Transcript", "Recommendation"]}'::jsonb,
    'https://www.pw.edu.pl/engpw', 'direct'
  ),
  (
    'b2000001-0000-4000-8000-000000000004',
    'a1000001-0000-4000-8000-000000000003',
    'BSc', 'Computer Engineering', 'CS', 4, 12000,
    true, 'English', ARRAY['September'], ARRAY['2026-05-31']::date[],
    '{"min_gpa": 3.0, "min_language": {"ielts": 6.0, "toefl": 80}, "documents": ["Transcript", "Passport", "Motivation letter"]}'::jsonb,
    'https://www.boun.edu.tr/en', 'direct'
  ),
  (
    'b2000001-0000-4000-8000-000000000005',
    'a1000001-0000-4000-8000-000000000004',
    'MSc', 'Business Informatics', 'Business', 2, 3200,
    true, 'English', ARRAY['September', 'February'], ARRAY['2026-04-30']::date[],
    '{"min_gpa": 2.9, "min_language": {"ielts": 6.0}, "documents": ["CV", "Transcript"]}'::jsonb,
    'https://www.elte.hu/en', 'direct'
  ),
  (
    'b2000001-0000-4000-8000-000000000006',
    'a1000001-0000-4000-8000-000000000005',
    'MSc', 'Management Engineering', 'Business', 2, 3893,
    true, 'English', ARRAY['September'], ARRAY['2026-03-15']::date[],
    '{"min_gpa": 3.1, "min_language": {"ielts": 6.5}, "documents": ["Transcript", "Portfolio", "Motivation letter"]}'::jsonb,
    'https://www.polimi.it/en', 'direct'
  ),
  (
    'b2000001-0000-4000-8000-000000000007',
    'a1000001-0000-4000-8000-000000000006',
    'PhD', 'Molecular Biology', 'Life Sciences', 3, 0,
    true, 'English', ARRAY['October', 'April'], ARRAY['2026-08-01']::date[],
    '{"min_gpa": 3.5, "min_language": {"ielts": 7.0}, "documents": ["Research proposal", "CV", "Publications"]}'::jsonb,
    'https://www.uni-heidelberg.de/en', 'direct'
  ),
  (
    'b2000001-0000-4000-8000-000000000008',
    'a1000001-0000-4000-8000-000000000007',
    'MSc', 'International Management', 'Business', 2, 2800,
    true, 'English', ARRAY['October'], ARRAY['2026-07-01']::date[],
    '{"min_gpa": 3.0, "min_language": {"ielts": 6.5}, "documents": ["Transcript", "CV"]}'::jsonb,
    'https://en.uj.edu.pl', 'direct'
  ),
  (
    'b2000001-0000-4000-8000-000000000009',
    'a1000001-0000-4000-8000-000000000008',
    'BSc', 'Electrical Engineering', 'Engineering', 4, 8000,
    false, 'English', ARRAY['September'], ARRAY['2026-06-15']::date[],
    '{"min_gpa": 2.8, "min_language": {"toefl": 75}, "documents": ["Transcript", "Math scores"]}'::jsonb,
    'https://www.metu.edu.tr', 'direct'
  ),
  (
    'b2000001-0000-4000-8000-000000000010',
    'a1000001-0000-4000-8000-000000000005',
    'BSc', 'Computer Science and Engineering', 'CS', 3, 3893,
    true, 'English', ARRAY['September'], ARRAY['2026-03-15']::date[],
    '{"min_gpa": 3.0, "min_language": {"ielts": 6.0}, "documents": ["Transcript", "Motivation letter"]}'::jsonb,
    'https://www.polimi.it/en', 'direct'
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
