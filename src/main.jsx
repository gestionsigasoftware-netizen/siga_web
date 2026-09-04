import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Las rutas se cargan con lazy() -- si el navegador tenia la pagina
// abierta desde ANTES de un despliegue nuevo, el archivo que pide (con
// el hash viejo) ya no existe y el servidor devuelve el HTML de error en
// su lugar ("Expected a JavaScript-or-Wasm module script..."). Vite
// dispara este evento en ese caso especifico; en vez de dejar el error
// roto en pantalla, se recarga una sola vez para traer la version
// actual (el guard en sessionStorage evita un bucle si el problema es
// otro, ej. sin conexion).
window.addEventListener('vite:preloadError', () => {
  const yaIntento = sessionStorage.getItem('siga_reload_tras_preload_error')
  if (yaIntento) return
  sessionStorage.setItem('siga_reload_tras_preload_error', '1')
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Si llegamos hasta aca sin que saltara el listener de arriba, esta pestana
// ya esta en una version que carga bien -- se limpia el guard para que un
// proximo despliegue (mas adelante, en la misma pestana) tambien pueda
// autorecargarse si hace falta.
sessionStorage.removeItem('siga_reload_tras_preload_error')
