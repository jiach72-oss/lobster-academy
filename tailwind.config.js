/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        lobster: {
          red: '#c0392b',
          dark: '#2c3e50',
          light: '#ecf0f1',
        },
      },
    },
  },
  plugins: [],
};
