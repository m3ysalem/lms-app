/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#111315', // درجة داكنة جداً للـ Dark Mode مع لمسة رمادي اللوجو
          800: '#1A1D20', // خلفيات العناصر الداكنة
          700: '#26292D',
          600: '#3D4148',
        },
        surface: {
          DEFAULT: '#F8F9FA',
          card: '#FFFFFF',
          border: '#E3E6EC',
        },
        teal: {
          DEFAULT: '#9E1B1B', // ألوان الإسراء: الأحمر الملكي الأساسي (بدل التيل القديم)
          dark: '#801414',    // درجة أغمق للـ Hover
          light: '#FDF2F2',   // خلفية فاتحة جداً للأحمر
        },
        amber: {
          DEFAULT: '#C77D22',
          light: '#FBEEDD',
        },
        danger: {
          DEFAULT: '#9E1B1B', // تم دمج درجات التنبيه مع لون الهوية
          light: '#FDF2F2',
        },
        muted: '#706F6F', // درجة الرمادي المميزة من كلمة Pharmaceuticals
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
