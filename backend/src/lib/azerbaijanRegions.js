/** Azərbaycan şəhər/rayonları — müəllim axtarışı və profil üçün (backend) */

const BAKU = 'Bakı';

const AZ_REGIONS = [
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

const BAKU_DISTRICTS = [
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

const BAKU_DISTRICT_NEIGHBORS = {
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

function isBakuRegion(region) {
  return String(region || '').trim() === BAKU;
}

function normalizeRegionName(name) {
  return String(name || '').trim();
}

function resolveBakuDistrictsForSearch(bakuDistrict, includeNeighbors) {
  const district = normalizeRegionName(bakuDistrict);
  if (!district) return null;
  if (!includeNeighbors) return [district];
  const neighbors = BAKU_DISTRICT_NEIGHBORS[district] || [];
  return [...new Set([district, ...neighbors])];
}

function formatLocationLabel(region, bakuDistrict) {
  const r = normalizeRegionName(region);
  const d = normalizeRegionName(bakuDistrict);
  if (!r) return '';
  if (isBakuRegion(r) && d) return `${d} rayonu`;
  if (isBakuRegion(r)) return BAKU;
  return r;
}

function formatResultsLocationPhrase(region, bakuDistrict) {
  const r = normalizeRegionName(region);
  const d = normalizeRegionName(bakuDistrict);
  if (!r) return '';
  if (isBakuRegion(r) && d) return `${d} rayonunda`;
  if (isBakuRegion(r)) return `${BAKU} şəhərində`;
  return `${r} rayonunda`;
}

function instructorLocationBadge(region, bakuDistrict) {
  const r = normalizeRegionName(region);
  const d = normalizeRegionName(bakuDistrict);
  if (isBakuRegion(r) && d) return d;
  if (r) return r;
  return null;
}

function isValidRegion(region) {
  const r = normalizeRegionName(region);
  return AZ_REGIONS.includes(r);
}

function isValidBakuDistrict(district) {
  const d = normalizeRegionName(district);
  return BAKU_DISTRICTS.includes(d);
}

/**
 * Single baku_district value for UPDATE SET.
 * Settings always sends region + baku_district together; if region is not Bakı
 * we clear the district once instead of emitting two assignments (Postgres 42601).
 */
function resolveBakuDistrictUpdate({ regionSpecified, region, districtSpecified, district }) {
  if (regionSpecified && !isBakuRegion(region)) {
    return { value: null };
  }
  if (!districtSpecified) return { skip: true };
  const normalized = district == null ? null : normalizeRegionName(district);
  if (normalized && !isValidBakuDistrict(normalized)) {
    return { error: 'Düzgün olmayan Bakı rayonu' };
  }
  return { value: normalized };
}

function applyInstructorRegionDistrictFields(sets, vals, startIndex, body = {}) {
  let i = startIndex;
  const regionSpecified = body.region !== undefined;
  const districtSpecified = body.baku_district !== undefined;
  let region;

  if (regionSpecified) {
    region = body.region == null ? null : normalizeRegionName(body.region);
    if (region && !isValidRegion(region)) {
      return { nextIndex: i, error: 'Düzgün olmayan region' };
    }
    sets.push(`region = $${i++}`);
    vals.push(region);
    sets.push(`region_user_set = $${i++}`);
    vals.push(Boolean(region));
  }

  const districtResult = resolveBakuDistrictUpdate({
    regionSpecified,
    region,
    districtSpecified,
    district: body.baku_district,
  });
  if (districtResult.error) {
    return { nextIndex: i, error: districtResult.error };
  }
  if (!districtResult.skip) {
    sets.push(`baku_district = $${i++}`);
    vals.push(districtResult.value);
  }

  return { nextIndex: i, error: null };
}

module.exports = {
  BAKU,
  AZ_REGIONS,
  BAKU_DISTRICTS,
  BAKU_DISTRICT_NEIGHBORS,
  isBakuRegion,
  normalizeRegionName,
  resolveBakuDistrictsForSearch,
  formatLocationLabel,
  formatResultsLocationPhrase,
  instructorLocationBadge,
  isValidRegion,
  isValidBakuDistrict,
  resolveBakuDistrictUpdate,
  applyInstructorRegionDistrictFields,
};
