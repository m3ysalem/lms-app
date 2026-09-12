/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#111315',
          800: '#1A1D20',
          700: '#26292D',
          600: '#3D4148',
        },
        surface: {
          DEFAULT: '#F8F9FA',
          card: '#FFFFFF',
          border: '#E3E6EC',
        },
        teal: {
          DEFAULT: '#9E1B1B', // الأحمر الملكي للإسراء
          dark: '#801414',
          light: '#FDF2F2',
        },
      },
      fontFamily: {
        head: ['Manrope', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
      },
    },
  },
  plugins: [],
}
