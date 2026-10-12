/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        word: {
          blue: '#2B579A',
          darkblue: '#1F3F70',
          lightblue: '#D6E4F7',
          ribbon: '#F3F3F3',
          ribbonDark: '#1e1e1e'
        }
      },
      fontFamily: {
        segoe: ['"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif']
      }
    }
  },
  plugins: []
}
