/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './app.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: { 900: '#090A0C', 800: '#111318', 700: '#1A1D24', 600: '#262A34' },
        accent: { emerald: '#10B981', red: '#EF4444', amber: '#F59E0B' }
      }
    }
  },
  plugins: []
};