import { createContext, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'sigap:theme'

function temaInicial() {
  if (typeof window === 'undefined') return 'light'
  const guardado = localStorage.getItem(STORAGE_KEY)
  if (guardado === 'light' || guardado === 'dark') return guardado
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const ThemeContext = createContext(null)

// Contexto de tema claro/oscuro -- pensado para usarse primero en
// InicioPublico.jsx y extenderse después al resto de la app. Aplica la clase
// `dark` en <html> (Tailwind darkMode: 'class'), así que cualquier pantalla
// que empiece a usar clases `dark:` queda cubierta sola.
//
// Tiene que ser un Context (no un useState suelto dentro de cada componente):
// con useState local, InicioPublico y ThemeToggle -- que llaman este hook por
// separado -- terminaban cada uno con su propio estado aislado. El botón sí
// cambiaba su propio ícono y el efecto secundario (clase en <html>,
// localStorage), pero la página nunca se enteraba del cambio porque leía SU
// PROPIA instancia del estado, no la del botón. Un solo Provider en la raíz
// resuelve esto: todos los que llamen useTheme() comparten el mismo valor.
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(temaInicial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  function toggleTheme() {
    setTheme((actual) => (actual === 'dark' ? 'light' : 'dark'))
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme debe usarse dentro de <ThemeProvider>')
  return context
}
