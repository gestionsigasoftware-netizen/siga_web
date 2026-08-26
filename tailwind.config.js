/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta validada en el preview interactivo con el usuario.
        ink: '#0B0B0B',
        surface: '#FCFCFB',
        'surface-1': '#F4F3F1',
        'surface-2': '#FFFFFF',
        border: '#E1E0D9',
        muted: '#898781',
        secondary: '#52514E',

        accent: '#2A78D6',
        'accent-bg': '#E6F1FB',
        'accent-dark': '#0C447C',

        success: '#008300',
        'success-bg': '#EAF3DE',
        'success-dark': '#173404',

        warning: '#C98500',
        'warning-bg': '#FAEEDA',
        'warning-dark': '#412402',

        danger: '#D03B3B',
        'danger-bg': '#FCEBEB',
        'danger-dark': '#501313',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        card: '12px',
      },
    },
  },
  plugins: [],
}
