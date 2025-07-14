/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  darkMode: 'class', // or 'media' if you prefer OS-level settings
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-selected': 'var(--color-surface-selected)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        border: 'var(--color-border)',
        input: 'var(--color-input)',
        hover: 'var(--color-hover)',
        purple: {
          'gradient-start': 'var(--color-purple-gradient-start)',
          'gradient-end': 'var(--color-purple-gradient-end)',
        },
        'user-bubble-background': 'var(--color-user-bubble-background)',
        'user-bubble-text': 'var(--color-user-bubble-text)',
        orange: '#F97316',
        blue: '#3B82F6',
        green: '#22C55E',
      },
      backgroundImage: {
        'purple-gradient': 'linear-gradient(to right, var(--color-purple-gradient-start), var(--color-purple-gradient-end))',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};