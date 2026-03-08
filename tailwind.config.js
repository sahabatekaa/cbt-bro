/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Mengaktifkan Dark Mode via class
  theme: {
    extend: {
      colors: {
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          800: '#065f46',
          900: '#064e3b',
        },
        gold: {
          400: '#fbbf24',
          500: '#f59e0b',
        }
      }
    },
  },
  plugins: [],
}