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
        blue: {
          DEFAULT: '#3B82F6', // Keep the original blue if needed, or remove if not used elsewhere
          // Tailwind's default blue shades are already available if not overridden
        },
        green: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E', // Original green
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#14532D',
          950: '#0F3D24',
        },
        red: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
          950: '#641B1B',
        },
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