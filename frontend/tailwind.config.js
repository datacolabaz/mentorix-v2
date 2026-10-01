/** @type {import('tailwindcss').Config} */

/** Space-separated RGB CSS variable → Tailwind colour with alpha support. */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`

const FONT_STACK = ['Inter', 'Inter Fallback', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif']

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // `dark:` must follow the in-app theme toggle (class on <html>), not the OS preference.
  darkMode: ['selector', '.theme-dark'],
  theme: {
    extend: {
      keyframes: {
        'demo-enter': {
          '0%': { opacity: '0.35', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'demo-enter': 'demo-enter 0.45s ease-out both',
      },
      colors: {
        primary: 'rgb(var(--primary-accent) / <alpha-value>)',
        // Design tokens (see src/index.css). Prefer these over raw hex/slate utilities.
        canvas: {
          DEFAULT: token('mx-bg-primary'),
          subtle: token('mx-bg-secondary'),
        },
        surface: {
          DEFAULT: token('mx-surface'),
          elevated: token('mx-surface-elevated'),
          // Dark-only legacy steps (used in `isDark ? … : …` branches), aligned with the navy tokens.
          1: '#121B29',
          2: '#172131',
          3: '#1E2A3D',
        },
        line: {
          DEFAULT: token('mx-border'),
          strong: token('mx-border-strong'),
        },
        fg: {
          DEFAULT: token('mx-text-primary'),
          secondary: token('mx-text-secondary'),
          muted: token('mx-text-muted'),
        },
        brand: {
          DEFAULT: token('mx-brand'),
          hover: token('mx-brand-hover'),
          on: token('mx-on-brand'),
          text: token('mx-brand-text'),
          subtle: token('mx-brand-subtle'),
          navy: '#003366',
          sidebar: '#ffffff',
        },
        success: { DEFAULT: token('mx-success'), subtle: token('mx-success-subtle') },
        warning: { DEFAULT: token('mx-warning'), subtle: token('mx-warning-subtle') },
        error: { DEFAULT: token('mx-error'), subtle: token('mx-error-subtle') },
        info: { DEFAULT: token('mx-info'), subtle: token('mx-info-subtle') },
        focus: token('mx-focus-ring'),
        token: {
          surfaceMain: 'rgb(var(--surface-main) / <alpha-value>)',
          surfaceCard: 'rgb(var(--surface-card) / <alpha-value>)',
          surfaceCardHover: 'rgb(var(--surface-card-hover) / <alpha-value>)',
          textMain: 'rgb(var(--text-main) / <alpha-value>)',
          textMuted: 'rgb(var(--text-muted) / <alpha-value>)',
          borderSubtle: 'var(--border-subtle)',
          // Semantic design tokens (theme-aware, WCAG AA in Light Mode)
          textPrimary: 'rgb(var(--text-primary) / <alpha-value>)',
          textSecondary: 'rgb(var(--text-secondary) / <alpha-value>)',
          textDisabled: 'rgb(var(--text-disabled) / <alpha-value>)',
          headingPrimary: 'rgb(var(--heading-primary) / <alpha-value>)',
          headingSecondary: 'rgb(var(--heading-secondary) / <alpha-value>)',
          surfacePrimary: 'rgb(var(--surface-primary) / <alpha-value>)',
          surfaceSecondary: 'rgb(var(--surface-secondary) / <alpha-value>)',
          borderColor: 'var(--border-color)',
          // Aliases for class names already used in the app that previously resolved to nothing.
          bg: token('mx-bg-primary'),
          surface: token('mx-surface'),
          surfaceAlt: token('mx-bg-secondary'),
          text: token('mx-text-primary'),
        },
      },
      fontFamily: {
        sans: FONT_STACK,
        display: FONT_STACK,
        body: FONT_STACK,
      },
      // Typography scale: Display, H1, H2, H3, Body large, Body, Body small, Caption, Button.
      fontSize: {
        display: ['clamp(2.25rem, 1.55rem + 2.8vw, 3.5rem)', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        h1: ['clamp(2rem, 1.55rem + 1.9vw, 2.75rem)', { lineHeight: '1.15', letterSpacing: '-0.015em', fontWeight: '700' }],
        h2: ['clamp(1.5rem, 1.25rem + 1vw, 2.125rem)', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
        h3: ['clamp(1.125rem, 1.05rem + 0.3vw, 1.25rem)', { lineHeight: '1.35', fontWeight: '600' }],
        'body-lg': ['clamp(1.0625rem, 1rem + 0.25vw, 1.1875rem)', { lineHeight: '1.65' }],
        body: ['1rem', { lineHeight: '1.6' }],
        'body-sm': ['0.875rem', { lineHeight: '1.55' }],
        caption: ['0.8125rem', { lineHeight: '1.45' }],
        button: ['0.9375rem', { lineHeight: '1.25', fontWeight: '600' }],
      },
      maxWidth: {
        measure: '68ch',
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--mx-shadow-color) / 0.06), 0 1px 3px rgb(var(--mx-shadow-color) / 0.08)',
        elevated: '0 12px 32px -12px rgb(var(--mx-shadow-color) / 0.28)',
      },
      ringColor: {
        DEFAULT: token('mx-focus-ring'),
      },
    },
  },
  plugins: [],
}
