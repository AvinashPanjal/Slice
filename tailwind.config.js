/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f8f9ff',
          100: '#e5eeff',
          200: '#d3e4fe',
          300: '#bec6e0',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#1e293b',
          800: '#0f172a',
          900: '#090e1a',
          950: '#000000',
        },
        amoled: {
          bg: '#000000',
          surface: '#090e1a',
          card: '#0d1322',
          border: '#1e293b',
          muted: '#94a3b8',
        },
        financial: {
          paid: '#10b981',
          pending: '#f59e0b',
          overdue: '#f43f5e',
          waived: '#64748b',
        }
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
