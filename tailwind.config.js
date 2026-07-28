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
          400: '#7c839b',
          500: '#565e74',
          600: '#3f465c',
          700: '#213145',
          800: '#131b2e',
          900: '#0b1c30',
          950: '#060e1a',
        },
        financial: {
          paid: '#10b981',
          pending: '#f59e0b',
          overdue: '#e11d48',
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
