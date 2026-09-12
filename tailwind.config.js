/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#9E1B1B',
          dark: '#801414',
          light: '#FDF2F2',
        },
        ink: {
          900: '#111315',
          800: '#14171A',
          700: '#26292D',
        },
        surface: '#f4f6f9',
      },
    },
  },
  plugins: [],
}
