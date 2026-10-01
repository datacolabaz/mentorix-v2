/**
 * AZ nömrəsinin 9 rəqəmli milli hissəsi: 994XXXXXXXXX, 00994XXXXXXXXX, 0XXXXXXXXX və ya XXXXXXXXX.
 * Tanınmayan format üçün null.
 */
function azNationalDigits(digits) {
  const d = String(digits || '');
  if (d.length === 14 && d.startsWith('00994')) return d.slice(5);
  if (d.length === 12 && d.startsWith('994')) return d.slice(3);
  if (d.length === 10 && d.startsWith('0')) return d.slice(1);
  if (d.length === 9) return d;
  return null;
}

/**
 * users.phone müxtəlif formatlarda saxlanıla bilər (+994…, 0…, 9 rəqəm); unikal indeks yalnız rəqəmlərə görədir.
 * Eyni AZ nömrəsinin bütün rəqəm variantlarını qaytarır (prioritet sırası ilə: kanonik 994 birinci).
 */
function phoneLookupCandidates(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d) return [];
  const national = azNationalDigits(d);
  if (!national) return [d];
  return [`994${national}`, `0${national}`, national];
}

/** /auth/login identifikatoru: «@» olan dəyər həmişə email-dir; qalanı ən azı 9 rəqəmlidirsə telefon. */
function classifyLoginIdentifier(value) {
  const s = value != null ? String(value).trim() : '';
  if (!s) return { kind: null, value: '' };
  if (s.includes('@')) return { kind: 'email', value: s };
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 9) return { kind: 'phone', value: digits, candidates: phoneLookupCandidates(digits) };
  return { kind: 'email', value: s };
}

/**
 * Telefon üzrə tapılan sətirlərdən (ən çox 3, unikal indeks sayəsində) birini seçir.
 * Bir neçə hesab eyni nömrənin fərqli formatına bağlıdırsa: yeganə admin seçilir; bir neçə admin varsa — qeyri-müəyyən (null).
 */
function pickPhoneLoginUser(rows, candidates) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length <= 1) return list[0] || null;
  const admins = list.filter((r) => r.role === 'admin');
  if (admins.length === 1) return admins[0];
  if (admins.length > 1) return null;
  const rank = (r) => {
    const i = candidates.indexOf(String(r.phone || '').replace(/\D/g, ''));
    return i === -1 ? candidates.length : i;
  };
  return [...list].sort((a, b) => rank(a) - rank(b))[0];
}

module.exports = { azNationalDigits, phoneLookupCandidates, classifyLoginIdentifier, pickPhoneLoginUser };
