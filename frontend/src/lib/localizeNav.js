/** Sidebar və nav bölmələrini cari dilə uyğunlaşdırır. */

export function localizeInstructorNavSections(sections, t) {
  if (!Array.isArray(sections)) return []
  return sections.map((section) => ({
    ...section,
    title: t(`nav.sections.${section.id}`, { defaultValue: section.title }),
    items: (section.items || []).map((item) => ({
      ...item,
      label: item.labelKey
        ? t(item.labelKey, { defaultValue: item.label })
        : t(`nav.instructor.${item.key}`, { defaultValue: item.label }),
    })),
  }))
}

export function localizeNavSections(sections, t, { sectionPrefix = 'nav.sections', itemPrefix }) {
  if (!Array.isArray(sections)) return []
  return sections.map((section, idx) => ({
    ...section,
    title: section.titleKey
      ? t(section.titleKey, { defaultValue: section.title })
      : t(`${sectionPrefix}.${section.id || idx}`, { defaultValue: section.title }),
    items: (section.items || []).map((item) => ({
      ...item,
      label: item.labelKey
        ? t(item.labelKey, { defaultValue: item.label })
        : item.key && itemPrefix
          ? t(`${itemPrefix}.${item.key}`, { defaultValue: item.label })
          : item.label,
    })),
  }))
}

export function localizeFlatNav(items, t, itemPrefix) {
  if (!Array.isArray(items)) return []
  return items.map((item) => ({
    ...item,
    label: item.labelKey
      ? t(item.labelKey, { defaultValue: item.label })
      : item.key
        ? t(`${itemPrefix}.${item.key}`, { defaultValue: item.label })
        : item.label,
  }))
}
