import LanguageSwitcher from './LanguageSwitcher'
import ThemeToggleIcon from './ThemeToggleIcon'

/** Dil dropdown + gecə/gündüz ikonu — desktop və mobil header. */
export default function LocaleThemeBar({ className = '', tone = 'auto', size = 'compact' }) {
  return (
    <div className={['inline-flex items-center gap-1.5 sm:gap-2 shrink-0', className].join(' ')}>
      <LanguageSwitcher tone={tone} size={size} />
      <ThemeToggleIcon tone={tone} />
    </div>
  )
}
