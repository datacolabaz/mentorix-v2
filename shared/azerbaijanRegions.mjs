/** Azərbaycan şəhər/rayonları — müəllim axtarışı və profil üçün (ESM) */

export const BAKU = 'Bakı';

export const AZ_REGIONS = [
  'Abşeron',
  'Ağcabədi',
  'Ağdam',
  'Ağdaş',
  'Ağstafa',
  'Ağsu',
  'Astara',
  'Babək',
  'Balakən',
  BAKU,
  'Beyləqan',
  'Bərdə',
  'Biləsuvar',
  'Cəbrayıl',
  'Cəlilabad',
  'Culfa',
  'Daşkəsən',
  'Füzuli',
  'Gədəbəy',
  'Gəncə',
  'Goranboy',
  'Göyçay',
  'Göygöl',
  'Hacıqabul',
  'Xaçmaz',
  'Xızı',
  'Xocalı',
  'Xocavənd',
  'İmişli',
  'İsmayıllı',
  'Kəlbəcər',
  'Kəngərli',
  'Kürdəmir',
  'Laçın',
  'Lerik',
  'Lənkəran',
  'Masallı',
  'Mingəçevir',
  'Naftalan',
  'Naxçıvan',
  'Neftçala',
  'Oğuz',
  'Ordubad',
  'Qax',
  'Qazax',
  'Qəbələ',
  'Qobustan',
  'Quba',
  'Qubadlı',
  'Qusar',
  'Saatlı',
  'Sabirabad',
  'Salyan',
  'Samux',
  'Sədərək',
  'Siyəzən',
  'Sumqayıt',
  'Şabran',
  'Şahbuz',
  'Şamaxı',
  'Şəki',
  'Şəmkir',
  'Şərur',
  'Şirvan',
  'Şuşa',
  'Tərtər',
  'Tovuz',
  'Ucar',
  'Yardımlı',
  'Yevlax',
  'Zaqatala',
  'Zəngilan',
  'Zərdab',
];

export const BAKU_DISTRICTS = [
  'Badamdar',
  'Binəqədi',
  'Nizami',
  'Nərimanov',
  'Nəsimi',
  'Pirallahı',
  'Qaradağ',
  'Sabunçu',
  'Səbail',
  'Suraxanı',
  'Xətai',
  'Xəzər',
  'Yasamal',
];

export const BAKU_DISTRICT_NEIGHBORS = {
  Badamdar: ['Qaradağ', 'Səbail'],
  Binəqədi: ['Nəsimi', 'Yasamal', 'Xəzər'],
  Nizami: ['Yasamal', 'Xətai', 'Səbail'],
  Nərimanov: ['Yasamal', 'Nəsimi', 'Xətai'],
  Nəsimi: ['Yasamal', 'Nərimanov', 'Binəqədi'],
  Pirallahı: ['Suraxanı', 'Sabunçu', 'Xəzər'],
  Qaradağ: ['Badamdar', 'Səbail'],
  Sabunçu: ['Suraxanı', 'Xəzər', 'Pirallahı'],
  Səbail: ['Nizami', 'Xətai', 'Yasamal', 'Qaradağ'],
  Suraxanı: ['Xəzər', 'Sabunçu', 'Pirallahı'],
  Xətai: ['Nərimanov', 'Nizami', 'Səbail'],
  Xəzər: ['Binəqədi', 'Suraxanı', 'Sabunçu'],
  Yasamal: ['Nəsimi', 'Nərimanov', 'Nizami', 'Binəqədi'],
};

export function isBakuRegion(region) {
  return String(region || '').trim() === BAKU;
}

export function normalizeRegionName(name) {
  return String(name || '').trim();
}

export function resolveBakuDistrictsForSearch(bakuDistrict, includeNeighbors) {
  const district = normalizeRegionName(bakuDistrict);
  if (!district) return null;
  if (!includeNeighbors) return [district];
  const neighbors = BAKU_DISTRICT_NEIGHBORS[district] || [];
  return [...new Set([district, ...neighbors])];
}

export function formatLocationLabel(region, bakuDistrict) {
  const r = normalizeRegionName(region);
  const d = normalizeRegionName(bakuDistrict);
  if (!r) return '';
  if (isBakuRegion(r) && d) return `${d} rayonu`;
  if (isBakuRegion(r)) return BAKU;
  return r;
}

export function formatResultsLocationPhrase(region, bakuDistrict) {
  const r = normalizeRegionName(region);
  const d = normalizeRegionName(bakuDistrict);
  if (!r) return '';
  if (isBakuRegion(r) && d) return `${d} rayonunda`;
  if (isBakuRegion(r)) return `${BAKU} şəhərində`;
  return `${r} rayonunda`;
}

export function instructorLocationBadge(region, bakuDistrict) {
  const r = normalizeRegionName(region);
  const d = normalizeRegionName(bakuDistrict);
  if (isBakuRegion(r) && d) return d;
  if (r) return r;
  return null;
}

export function isValidRegion(region) {
  const r = normalizeRegionName(region);
  return AZ_REGIONS.includes(r);
}

export function isValidBakuDistrict(district) {
  const d = normalizeRegionName(district);
  return BAKU_DISTRICTS.includes(d);
}
