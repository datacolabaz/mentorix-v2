/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'rgb(var(--primary-accent) / <alpha-value>)',
        brand: {
          navy: '#003366',
          sidebar: '#ffffff',
        },
        token: {
          surfaceMain: 'rgb(var(--surface-main) / <alpha-value>)',
          surfaceCard: 'rgb(var(--surface-card) / <alpha-value>)',
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
