/** Avropa üzrə universitet axtarışı ölkələri (backend ilə uyğun) */

export const UNIVERSITY_COUNTRIES = [
  'Almaniya',
  'Polşa',
  'İtaliya',
  'Macarıstan',
  'Türkiyə',
  'Litva',
  'Latviya',
  'Estoniya',
  'Çexiya',
  'Slovakiya',
  'Rumıniya',
  'Bolqarıstan',
  'Hollandiya',
  'Belçika',
  'Avstriya',
  'Fransa',
  'İspaniya',
  'Portuqaliya',
  'İsveç',
  'Finlandiya',
  'Norveç',
  'Danimarka',
  'İrlandiya',
]

export const MVP_COUNTRIES = UNIVERSITY_COUNTRIES

export const COUNTRY_FLAGS = {
  Almaniya: '🇩🇪',
  Polşa: '🇵🇱',
  İtaliya: '🇮🇹',
  Macarıstan: '🇭🇺',
  Türkiyə: '🇹🇷',
  Litva: '🇱🇹',
  Latviya: '🇱🇻',
  Estoniya: '🇪🇪',
  Çexiya: '🇨🇿',
  Slovakiya: '🇸🇰',
  Rumıniya: '🇷🇴',
  Bolqarıstan: '🇧🇬',
  Hollandiya: '🇳🇱',
  Belçika: '🇧🇪',
  Avstriya: '🇦🇹',
  Fransa: '🇫🇷',
  İspaniya: '🇪🇸',
  Portuqaliya: '🇵🇹',
  İsveç: '🇸🇪',
  Finlandiya: '🇫🇮',
  Norveç: '🇳🇴',
  Danimarka: '🇩🇰',
  İrlandiya: '🇮🇪',
}

const COUNTRY_SEARCH_ALIASES = {
  Almaniya: ['germany', 'deutschland', 'almanya'],
  Polşa: ['poland', 'polska', 'polsa'],
  İtaliya: ['italy', 'italiya'],
  Macarıstan: ['hungary', 'magyar', 'macaristan'],
  Türkiyə: ['turkey', 'turkiye', 'turkiyə'],
  Litva: ['lithuania', 'lietuva', 'litva'],
  Latviya: ['latvia', 'latvija'],
  Estoniya: ['estonia', 'eesti', 'est'],
  Çexiya: ['czech', 'czechia', 'cechia', 'çex'],
  Slovakiya: ['slovakia', 'slovensko'],
  Rumıniya: ['romania', 'românia'],
  Bolqarıstan: ['bulgaria', 'bolqaristan'],
  Hollandiya: ['netherlands', 'holland', 'nederland'],
  Belçika: ['belgium', 'belgie', 'belçika'],
  Avstriya: ['austria', 'österreich', 'osterreich'],
  Fransa: ['france', 'fransa'],
  İspaniya: ['spain', 'espana', 'españa', 'ispaniya'],
  Portuqaliya: ['portugal', 'portuqaliya'],
  İsveç: ['sweden', 'sverige', 'isvec'],
  Finlandiya: ['finland', 'suomi'],
  Norveç: ['norway', 'norge', 'norvec'],
  Danimarka: ['denmark', 'danmark'],
  İrlandiya: ['ireland', 'eire', 'irlandiya'],
}

function foldAz(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
}

export function countryFlag(country) {
  return COUNTRY_FLAGS[country] || '🌍'
}

export function countryMatchesQuery(country, query) {
  const q = foldAz(query).trim()
  if (!q) return true
  if (foldAz(country).includes(q)) return true
  const aliases = COUNTRY_SEARCH_ALIASES[country] || []
  return aliases.some((alias) => foldAz(alias).includes(q) || q.includes(foldAz(alias)))
}

export function filterCountriesByQuery(query) {
  return UNIVERSITY_COUNTRIES.filter((country) => countryMatchesQuery(country, query))
}
