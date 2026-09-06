/** Bakı metrosu — axtarış profili (backend). Frontend: shared/bakuMetroStations.mjs */

const BAKU_METRO_STATIONS = [
  { slug: 'iceriseher', name_az: 'İçərişəhər', lat: 40.3663, lng: 49.8351, district: 'Səbail' },
  { slug: 'sahil', name_az: 'Sahil', lat: 40.3708, lng: 49.8444, district: 'Səbail' },
  { slug: '28-may', name_az: '28 May', lat: 40.377, lng: 49.8519, district: 'Nəsimi' },
  { slug: 'genclik', name_az: 'Gənclik', lat: 40.3969, lng: 49.8478, district: 'Nərimanov' },
  { slug: 'nariman-narimanov', name_az: 'Nəriman Nərimanov', lat: 40.4028, lng: 49.8715, district: 'Nərimanov' },
  { slug: 'bakmil', name_az: 'Bakmil', lat: 40.4186, lng: 49.8778, district: 'Nərimanov' },
  { slug: 'ulduz', name_az: 'Ulduz', lat: 40.4147, lng: 49.8917, district: 'Nərimanov' },
  { slug: 'koroglu', name_az: 'Koroğlu', lat: 40.4208, lng: 49.9169, district: 'Nizami' },
  { slug: 'qara-qarayev', name_az: 'Qara Qarayev', lat: 40.4175, lng: 49.9342, district: 'Nizami' },
  { slug: 'neftciler', name_az: 'Neftçilər', lat: 40.4111, lng: 49.9436, district: 'Nizami' },
  { slug: 'xalqlar-dostlugu', name_az: 'Xalqlar Dostluğu', lat: 40.3969, lng: 49.9569, district: 'Xətai' },
  { slug: 'ahmadli', name_az: 'Əhmədli', lat: 40.3858, lng: 49.9564, district: 'Xətai' },
  { slug: 'hezi-aslanov', name_az: 'Həzi Aslanov', lat: 40.3725, lng: 49.9533, district: 'Xətai' },
  { slug: 'cefer-cabbarli', name_az: 'Cəfər Cabbarlı', lat: 40.3794, lng: 49.8486, district: 'Nəsimi' },
  { slug: 'nizami', name_az: 'Nizami', lat: 40.3786, lng: 49.8297, district: 'Nəsimi' },
  { slug: 'elmler-akademiyasi', name_az: 'Elmlər Akademiyası', lat: 40.375, lng: 49.8158, district: 'Yasamal' },
  { slug: 'insaatcilar', name_az: 'İnşaatçılar', lat: 40.3903, lng: 49.8031, district: 'Yasamal' },
  { slug: '20-yanvar', name_az: '20 Yanvar', lat: 40.4031, lng: 49.8072, district: 'Yasamal' },
  { slug: 'memar-acemi', name_az: 'Memar Əcəmi', lat: 40.4061, lng: 49.8133, district: 'Nəsimi' },
  { slug: 'nasimi', name_az: 'Nəsimi', lat: 40.4119, lng: 49.8211, district: 'Nəsimi' },
  { slug: 'azadliq', name_az: 'Azadlıq prospekti', lat: 40.4233, lng: 49.8414, district: 'Binəqədi' },
  { slug: 'dernegul', name_az: 'Dərnəgül', lat: 40.4272, lng: 49.8514, district: 'Binəqədi' },
  { slug: 'xetai', name_az: 'Xətai', lat: 40.3833, lng: 49.8714, district: 'Xətai' },
  { slug: 'avtovagzal', name_az: 'Avtovağzal', lat: 40.4214, lng: 49.7931, district: 'Binəqədi' },
  { slug: '8-noyabr', name_az: '8 Noyabr', lat: 40.4069, lng: 49.8078, district: 'Nəsimi' },
  { slug: 'khojasan', name_az: 'Xocəsən', lat: 40.4236, lng: 49.7619, district: 'Binəqədi' },
];

function bakuMetroBySlug(slug) {
  const key = String(slug || '').trim().toLowerCase();
  if (!key) return null;
  return BAKU_METRO_STATIONS.find((s) => s.slug === key) || null;
}

function isValidBakuMetro(slug) {
  return Boolean(bakuMetroBySlug(slug));
}

module.exports = {
  BAKU_METRO_STATIONS,
  bakuMetroBySlug,
  isValidBakuMetro,
};
