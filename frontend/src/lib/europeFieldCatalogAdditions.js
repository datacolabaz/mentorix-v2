/** Avropa seed datasetindən gələn əlavə ixtisas slug-ları (backend ilə uyğun) */

export const EUROPE_FIELD_GROUPS = [
  {
    id: 'general_studies',
    label: 'Ümumi / Interdisiplinar',
    options: [
      { value: 'all_fields', label: 'Bütün sahələr (All fields)' },
      { value: 'engineering', label: 'Mühəndislik (Engineering)' },
      { value: 'natural_sciences', label: 'Təbii Elmlər (Natural Sciences)' },
      { value: 'sciences', label: 'Elmlər (Sciences)' },
      { value: 'applied_sciences', label: 'Tətbiqi Elmlər (Applied Sciences)' },
    ],
  },
  {
    id: 'humanities_social',
    label: 'Humanitar / Sosial',
    options: [
      { value: 'humanities', label: 'Humanitar Elmlər (Humanities)' },
      { value: 'social_sciences', label: 'Sosial Elmlər (Social Sciences)' },
      { value: 'law', label: 'Hüquq (Law)' },
      { value: 'economics', label: 'İqtisadiyyat (Economics)' },
      { value: 'political_science', label: 'Siyasi Elmlər (Political Science)' },
    ],
  },
  {
    id: 'physical_formal',
    label: 'Fizika / Formal Elmlər',
    options: [
      { value: 'physics', label: 'Fizika (Physics)' },
      { value: 'mathematics', label: 'Riyaziyyat (Mathematics)' },
      { value: 'informatics', label: 'İnformatika (Informatics)' },
    ],
  },
  {
    id: 'life_applied',
    label: 'Həyat / Tətbiqi Elmlər',
    options: [
      { value: 'life_sciences', label: 'Həyat Elmləri (Life Sciences)' },
      { value: 'food_sciences', label: 'Qida Elmləri (Food Sciences)' },
      { value: 'veterinary', label: 'Baytarlıq (Veterinary)' },
      { value: 'dentistry', label: 'Stomatologiya (Dentistry)' },
    ],
  },
  {
    id: 'design_built',
    label: 'Dizayn / Memarlıq',
    options: [
      { value: 'architecture', label: 'Memarlıq (Architecture)' },
      { value: 'design', label: 'Dizayn (Design)' },
      { value: 'industrial_design', label: 'Sənaye Dizaynı (Industrial Design)' },
      { value: 'arts_design', label: 'İncəsənət və Dizayn (Arts & Design)' },
    ],
  },
  {
    id: 'other_studies',
    label: 'Digər',
    options: [
      { value: 'mining', label: 'Mədənçıxarma (Mining)' },
      { value: 'maritime', label: 'Dənizçilik (Maritime)' },
      { value: 'agriculture', label: 'Kənd Təsərrüfatı (Agriculture)' },
      { value: 'education', label: 'Təhsil (Education)' },
      { value: 'management', label: 'Menecment (Management)' },
    ],
  },
]

export const EUROPE_FIELD_MATCH_TERMS = {
  all_fields: ['All fields', 'All Fields', 'General', 'Interdisciplinary'],
  engineering: ['Engineering', 'Mühəndislik', 'Engineer'],
  natural_sciences: ['Natural Sciences', 'Natural Science', 'Science', 'Təbii Elmlər'],
  sciences: ['Sciences', 'Science', 'Elmlər'],
  applied_sciences: ['Applied Sciences', 'Applied Science'],
  humanities: ['Humanities', 'Humanity', 'Humanitar'],
  social_sciences: ['Social Sciences', 'Social Science', 'Sosial'],
  law: ['Law', 'Legal', 'Hüquq', 'Jurisprudence'],
  economics: ['Economics', 'Economy', 'İqtisadiyyat'],
  political_science: ['Political Science', 'Politics', 'Siyasi'],
  physics: ['Physics', 'Physical', 'Fizika'],
  mathematics: ['Mathematics', 'Math', 'Riyaziyyat'],
  informatics: ['Informatics', 'Information Systems', 'İnformatika', 'Computer Science'],
  life_sciences: ['Life Sciences', 'Life Science', 'Biological Sciences'],
  food_sciences: ['Food Sciences', 'Food Science', 'Nutrition'],
  veterinary: ['Veterinary', 'Vet', 'Baytarlıq'],
  dentistry: ['Dentistry', 'Dental', 'Stomatologiya'],
  architecture: ['Architecture', 'Architectural', 'Memarlıq'],
  design: ['Design', 'Dizayn'],
  industrial_design: ['Industrial Design', 'Product Design'],
  arts_design: ['Arts & Design', 'Arts and Design', 'Fine Arts', 'Art'],
  mining: ['Mining', 'Geology', 'Mineral'],
  maritime: ['Maritime', 'Marine', 'Naval'],
  agriculture: ['Agriculture', 'Agricultural', 'Kənd Təsərrüfatı'],
  education: ['Education', 'Pedagogy', 'Təhsil'],
  management: ['Management', 'Menecment', 'Business Administration'],
}

export const EUROPE_FIELD_RELATED_SLUGS = {
  chemistry: ['chemistry', 'natural_sciences', 'life_sciences', 'physics', 'biochemistry', 'sciences'],
  natural_sciences: ['natural_sciences', 'chemistry', 'physics', 'biology', 'mathematics', 'sciences'],
  sciences: ['sciences', 'natural_sciences', 'chemistry', 'physics', 'biology'],
  life_sciences: ['life_sciences', 'biology', 'biochemistry', 'chemistry', 'natural_sciences'],
  physics: ['physics', 'natural_sciences', 'mathematics', 'chemistry'],
  informatics: ['informatics', 'computer_science', 'software_engineering', 'information_technology'],
  engineering: ['engineering', 'mechanical_engineering', 'electrical_engineering', 'civil_engineering', 'computer_engineering'],
  all_fields: ['all_fields'],
  business_administration: ['business_administration', 'economics', 'finance', 'management'],
  economics: ['economics', 'finance', 'business_administration', 'social_sciences'],
}
