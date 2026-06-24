/** Landing bölmə və element görünürlüyü — admin paneldən idarə olunur. */

export function isMarketingSectionVisible(section) {
  return section?.section_enabled !== false
}

export function visibleWhyCards(cards) {
  if (!Array.isArray(cards)) return []
  return cards.filter((c) => c?.card_enabled !== false)
}

export function visibleMarketingItems(items) {
  if (!Array.isArray(items)) return []
  return items.filter((it) => it?.item_enabled !== false)
}
