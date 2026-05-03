/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
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
        brand: {
          navy: '#003366',
          sidebar: '#ffffff',
        },
        token: {
          surfaceMain: 'rgb(var(--surface-main) / <alpha-value>)',
          surfaceCard: 'rgb(var(--surface-card) / <alpha-value>)',
          surfaceCardHover: 'rgb(var(--surface-card-hover) / <alpha-value>)',
          textMain: 'rgb(var(--text-main) / <alpha-value>)',
          textMuted: 'rgb(var(--text-muted) / <alpha-value>)',
          borderSubtle: 'var(--border-subtle)',
        },
        surface: {
          1: '#121212',
          2: '#1a1a1a',
          3: '#222222',
        },
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
