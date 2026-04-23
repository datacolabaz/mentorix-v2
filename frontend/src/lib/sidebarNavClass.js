/** Ağ sidebar: mətn #003366; aktiv — göy→yaşıl gradient, ağ yazı */
export function sidebarNavClass(isActive) {
  const base =
    'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all'
  if (isActive) {
    return `${base} text-white bg-gradient-to-r from-[#003366] to-[#22e088] shadow-sm`
  }
  return `${base} text-[#003366] hover:bg-gray-100 hover:text-[#00264d]`
}
