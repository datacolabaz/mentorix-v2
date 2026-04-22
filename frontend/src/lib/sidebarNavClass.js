/** Aktiv menyu: loqodakı göy→yaşıl gradient üst xətt + primary vurğu */
export function sidebarNavClass(isActive) {
  const base =
    'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all overflow-hidden'
  if (isActive) {
    return `${base} text-primary bg-white/10 border border-primary/30 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-10 before:h-0.5 before:bg-gradient-to-r before:from-[#003366] before:to-[#22e088]`
  }
  return `${base} text-gray-300 hover:bg-white/10 hover:text-white`
}
