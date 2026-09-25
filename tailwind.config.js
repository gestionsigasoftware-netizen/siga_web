/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // 'class' en vez de 'media': el modo oscuro lo decide useTheme.js (con
  // persistencia propia en localStorage + arranque en el prefers-color-scheme
  // del sistema), no directamente la preferencia del SO -- así el usuario
  // puede anular esa preferencia con el interruptor. Empieza aplicado solo en
  // InicioPublico.jsx; el resto de la app no usa clases dark: todavía, así
  // que esto no cambia nada en ninguna otra pantalla.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Paleta validada en el preview interactivo con el usuario --
        // apunta a variables CSS (definidas en index.css, :root y
        // :root.dark) en vez de hex fijo, para que TODA pantalla que ya
        // usa estas clases (bg-surface-1, text-ink, border-border, etc.)
        // responda sola al modo oscuro sin tocar cada archivo de pagina.
        // Los valores hex siguen siendo los mismos de siempre en modo
        // claro -- esto no cambia nada visualmente hasta que exista un
        // modo oscuro real que los redefina.
        // rgb(var(--x-rgb) / <alpha-value>): la forma que Tailwind necesita
        // para que las utilidades con opacidad (bg-accent/10, ring-accent/30,
        // etc. -- usadas por toda la app) sigan funcionando con un color que
        // cambia por tema. Un var() directo con hex rompe esas utilidades
        // (Tailwind no puede calcular la opacidad sobre un valor opaco).
        ink: 'rgb(var(--color-ink-rgb) / <alpha-value>)',
        surface: 'rgb(var(--color-surface-rgb) / <alpha-value>)',
        'surface-1': 'rgb(var(--color-surface-1-rgb) / <alpha-value>)',
        'surface-2': 'rgb(var(--color-surface-2-rgb) / <alpha-value>)',
        border: 'rgb(var(--color-border-rgb) / <alpha-value>)',
        muted: 'rgb(var(--color-muted-rgb) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary-rgb) / <alpha-value>)',

        accent: 'rgb(var(--color-accent-rgb) / <alpha-value>)',
        'accent-bg': 'rgb(var(--color-accent-bg-rgb) / <alpha-value>)',
        'accent-dark': 'rgb(var(--color-accent-dark-rgb) / <alpha-value>)',

        success: 'rgb(var(--color-success-rgb) / <alpha-value>)',
        'success-bg': 'rgb(var(--color-success-bg-rgb) / <alpha-value>)',
        'success-dark': 'rgb(var(--color-success-dark-rgb) / <alpha-value>)',

        warning: 'rgb(var(--color-warning-rgb) / <alpha-value>)',
        'warning-bg': 'rgb(var(--color-warning-bg-rgb) / <alpha-value>)',
        'warning-dark': 'rgb(var(--color-warning-dark-rgb) / <alpha-value>)',

        danger: 'rgb(var(--color-danger-rgb) / <alpha-value>)',
        'danger-bg': 'rgb(var(--color-danger-bg-rgb) / <alpha-value>)',
        'danger-dark': 'rgb(var(--color-danger-dark-rgb) / <alpha-value>)',

        // Negro fijo (no se invierte en modo oscuro) -- ver la nota junto a
        // --color-night-rgb en index.css.
        night: 'rgb(var(--color-night-rgb) / <alpha-value>)',
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
