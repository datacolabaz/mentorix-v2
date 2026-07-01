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

export function fieldGroupLabel(groupId, lang) {
  const key = String(groupId || '').trim()
  if (!key) return ''
  const t = lang ? i18n.getFixedT(lang) : i18n.t.bind(i18n)
  return t(`universitySearch.catalog.groups.${key}`, {
    defaultValue: GROUP_FALLBACK.get(key) || key,
  })
}

export function fieldOptionLabel(value, lang) {
  const key = String(value || '').trim()
  if (!key) return ''
  const t = lang ? i18n.getFixedT(lang) : i18n.t.bind(i18n)
  return t(`universitySearch.catalog.fields.${key}`, {
    defaultValue: FIELD_FALLBACK.get(key) || key,
  })
}

export function localizedFieldLabel(slug, lang) {
  return fieldOptionLabel(slug, lang)
}
