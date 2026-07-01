/** @type {import('tailwindcss').Config} */
// Palette is driven by CSS variables (see src/styles/index.css) so themes can be
// swapped at runtime via a `data-theme` attribute on <html>. Values are RGB
// channel triplets to keep Tailwind's `/<alpha-value>` opacity utilities working.
const p = (v) => `rgb(var(${v}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: {
          50:  p('--p-50'),
          100: p('--p-100'),
          200: p('--p-200'),
          300: p('--p-300'),
          400: p('--p-400'),
          500: p('--p-500'),
          600: p('--p-600'),
          700: p('--p-700'),
          800: p('--p-800'),
          900: p('--p-900'),
        },
        dungeon: {
          800: p('--d-800'),
          900: p('--d-900'),
        },
      },
      fontFamily: {
        serif: ['"Palatino Linotype"', 'Palatino', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}
