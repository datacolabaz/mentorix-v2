/** Amerika/Kanada seed datasetindən gələn əlavə ixtisas slug-ları */

const AMERICA_FIELD_GROUPS = [
  {
    id: 'media_arts',
    label: 'Media / İncəsənət',
    options: [
      { value: 'journalism', label: 'Jurnalistika (Journalism)' },
      { value: 'film', label: 'Kino (Film)' },
      { value: 'drama', label: 'Drama / Teatr' },
      { value: 'music', label: 'Musiqi (Music)' },
      { value: 'fine_arts', label: 'Təsviri İncəsənət (Fine Arts)' },
      { value: 'arts', label: 'İncəsənət (Arts)' },
    ],
  },
  {
    id: 'applied_professional',
    label: 'Tətbiqi / Peşə',
    options: [
      { value: 'forestry', label: 'Meşəçilik (Forestry)' },
      { value: 'hotel_management', label: 'Otelçilik (Hotel Management)' },
      { value: 'public_health', label: 'İctimai Səhiyyə (Public Health)' },
      { value: 'pharmacy', label: 'Farmakologiya (Pharmacy)' },
      { value: 'arts_sciences', label: 'İncəsənət və Elmlər (Arts & Sciences)' },
    ],
  },
];

const AMERICA_FIELD_MATCH_TERMS = {
  journalism: ['Journalism', 'Media', 'Communications'],
  film: ['Film', 'Cinema', 'Film Studies'],
  drama: ['Drama', 'Theatre', 'Theater', 'Performing Arts'],
  music: ['Music', 'Musical'],
  fine_arts: ['Fine Arts', 'Fine Art', 'Visual Arts'],
  arts: ['Arts', 'Liberal Arts'],
  forestry: ['Forestry', 'Forest', 'Wood Science'],
  hotel_management: ['Hotel Management', 'Hospitality', 'Hotel'],
  public_health: ['Public Health', 'Health Policy', 'Epidemiology'],
  pharmacy: ['Pharmacy', 'Pharmaceutical'],
  arts_sciences: ['Arts & Sciences', 'Arts and Sciences', 'Arts Sciences'],
};

const AMERICA_FIELD_RELATED_SLUGS = {
  journalism: ['journalism', 'social_sciences', 'communication'],
  film: ['film', 'arts', 'fine_arts'],
  drama: ['drama', 'arts', 'fine_arts'],
  music: ['music', 'arts', 'fine_arts'],
  fine_arts: ['fine_arts', 'arts', 'design', 'arts_design'],
  arts: ['arts', 'humanities', 'fine_arts'],
  forestry: ['forestry', 'agriculture', 'environmental_science'],
  hotel_management: ['hotel_management', 'business_administration', 'management'],
  public_health: ['public_health', 'medicine', 'life_sciences'],
  arts_sciences: ['arts_sciences', 'humanities', 'natural_sciences', 'social_sciences'],
};

module.exports = {
  AMERICA_FIELD_GROUPS,
  AMERICA_FIELD_MATCH_TERMS,
  AMERICA_FIELD_RELATED_SLUGS,
};
