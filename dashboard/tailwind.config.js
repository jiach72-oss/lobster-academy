/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0a0f',
          800: '#12121a',
          700: '#1a1a25',
          600: '#222230',
          500: '#2a2a3a',
          400: '#3a3a4f',
          300: '#5a5a7a',
          200: '#8a8aaa',
          100: '#b0b0cc',
        },
        accent: {
          blue: '#3b82f6',
          cyan: '#06b6d4',
          green: '#10b981',
          yellow: '#f59e0b',
          red: '#ef4444',
          purple: '#8b5cf6',
        }
      }
    },
  },
  plugins: [],
};
