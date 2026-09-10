/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#141B2E',
          800: '#1B2A4A',
          700: '#28395F',
          600: '#3A4D75',
        },
        surface: {
          DEFAULT: '#F5F6F8',
          card: '#FFFFFF',
          border: '#E3E6EC',
        },
        teal: {
          DEFAULT: '#0F7A6B',
          dark: '#0B5D52',
          light: '#E4F3F0',
        },
        amber: {
          DEFAULT: '#C77D22',
          light: '#FBEEDD',
        },
        danger: {
          DEFAULT: '#C4453D',
          light: '#FBEAE9',
        },
        muted: '#667085',
      },
      fontFamily: {
        head: ['Manrope', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
      },
    },
  },
  plugins: [],
}
