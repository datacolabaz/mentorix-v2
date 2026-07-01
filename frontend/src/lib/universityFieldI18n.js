import { FIELD_GROUPS } from './universityFieldCatalog'
import { universityCatalogAz, universityCatalogRu } from '../locales/universityCatalog'
import { readStoredLocale } from '../i18n'

const GROUP_FALLBACK = new Map()
const FIELD_FALLBACK = new Map()

for (const group of FIELD_GROUPS) {
  GROUP_FALLBACK.set(group.id, group.label)
  for (const opt of group.options) {
    FIELD_FALLBACK.set(opt.value, opt.label)
  }
}

export function resolveCatalogLocale(lang) {
  return String(lang || 'az').toLowerCase().startsWith('ru') ? 'ru' : 'az'
}

function catalogFor(lang) {
  return resolveCatalogLocale(lang) === 'ru' ? universityCatalogRu : universityCatalogAz
}

export function fieldGroupLabel(groupId, lang = 'az') {
  const key = String(groupId || '').trim()
  if (!key) return ''
  const cat = catalogFor(lang)
  return cat.groups[key] || GROUP_FALLBACK.get(key) || key
}

export function fieldOptionLabel(value, lang = 'az') {
  const key = String(value || '').trim()
  if (!key) return ''
  const cat = catalogFor(lang)
  return cat.fields[key] || FIELD_FALLBACK.get(key) || key
}

export function localizedFieldLabel(slug, lang) {
  const lng = lang ?? readStoredLocale()
  return fieldOptionLabel(slug, lng)
}
