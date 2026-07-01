import i18n from '../i18n'
import { FIELD_GROUPS } from './universityFieldCatalog'

const GROUP_FALLBACK = new Map()
const FIELD_FALLBACK = new Map()

for (const group of FIELD_GROUPS) {
  GROUP_FALLBACK.set(group.id, group.label)
  for (const opt of group.options) {
    FIELD_FALLBACK.set(opt.value, opt.label)
  }
}

function activeLang() {
  return String(i18n.resolvedLanguage || i18n.language || 'az')
}

export function fieldGroupLabel(groupId) {
  const key = String(groupId || '').trim()
  if (!key) return ''
  return i18n.t(`universitySearch.catalog.groups.${key}`, {
    lng: activeLang(),
    defaultValue: GROUP_FALLBACK.get(key) || key,
  })
}

export function fieldOptionLabel(value) {
  const key = String(value || '').trim()
  if (!key) return ''
  return i18n.t(`universitySearch.catalog.fields.${key}`, {
    lng: activeLang(),
    defaultValue: FIELD_FALLBACK.get(key) || key,
  })
}

export function localizedFieldLabel(slug) {
  return fieldOptionLabel(slug)
}
