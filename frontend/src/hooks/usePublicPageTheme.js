import useUiStore from './useUi'

/**
 * Wrapper classes for public pages: token background plus the `.mx-public-page` bridge in index.css,
 * which maps legacy slate/white/emerald utilities onto the active theme's tokens.
 */
export default function usePublicPageTheme() {
  const theme = useUiStore((s) => s.theme)
  const isDark = theme === 'dark'
  return {
    isDark,
    theme: isDark ? 'dark' : 'light',
    className: `mx-public-page ${isDark ? 'theme-dark' : 'theme-light'} bg-canvas text-fg-secondary`,
  }
}
