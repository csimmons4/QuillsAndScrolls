/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: {
          50:  '#fdfaf3',
          100: '#faf3e0',
          200: '#f5e6c0',
          300: '#edd49a',
          400: '#e2bc6e',
          500: '#d4a44c',
          600: '#b8883a',
          700: '#956b2e',
          800: '#745228',
          900: '#5a4022',
        },
        dungeon: {
          800: '#1e1b18',
          900: '#141210',
        },
      },
      fontFamily: {
        serif: ['"Palatino Linotype"', 'Palatino', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
