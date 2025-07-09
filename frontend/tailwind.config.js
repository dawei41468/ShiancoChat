/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          'background': '#151525',
          'card': '#20203A',
          'text-light': '#E0E0E0',
          'text-dark': '#CCCCCC',
          'border': '#2A2A4A',
          'input-bg': '#2A2A4A',
        },
        purple: {
          'gradient-start': '#6B46C1',
          'gradient-end': '#3B82F6',
        },
        orange: '#F97316',
        blue: '#3B82F6',
        green: '#22C55E',
      },
      backgroundImage: {
        'purple-gradient': 'linear-gradient(to right, #6B46C1, #3B82F6)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};