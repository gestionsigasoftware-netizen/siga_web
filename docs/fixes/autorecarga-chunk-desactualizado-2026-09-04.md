# Auto-recarga cuando un despliegue deja una pestaña con archivos viejos (2026-09-04)

## El error reportado

```
Failed to load module script: Expected a JavaScript-or-Wasm module
script but the server responded with a MIME type of "text/html"...
TypeError: Failed to fetch dynamically imported module:
https://sigap.com.co/assets/Modulos-IoPotIkV.js
```

## Causa

Las rutas de la web se cargan con `lazy(() => import(...))` -- cada
página es un archivo aparte con un nombre que incluye un hash del
contenido (ej. `Modulos-IoPotIkV.js`). Cuando se hace un despliegue
nuevo, esos hashes cambian. Si alguien ya tenía la pestaña abierta
desde ANTES del despliegue y navega a una ruta que aún no había
cargado, el navegador pide el archivo con el hash viejo -- que ya no
existe en el servidor -- y Cloudflare Pages, al no encontrarlo, devuelve
el `index.html` de fallback (para que las rutas de React Router
funcionen al recargar directo). El navegador rechaza ese HTML porque
esperaba un módulo de JavaScript, y ahí sale el error.

## Corrección

**`src/main.jsx`**: se agregó un listener de `vite:preloadError` --el
evento que Vite dispara exactamente en este caso-- que recarga la
página una sola vez (con una bandera en `sessionStorage` para no entrar
en bucle si el problema fuera otro, ej. sin conexión). Al recargar, el
navegador trae el `index.html` actual con los hashes correctos, y el
error desaparece solo, sin que la persona tenga que saber que debía
refrescar manualmente.

## Verificación

`npm run build` corre limpio. El efecto real (que la pestaña se
recargue sola ante un chunk desactualizado) solo se puede confirmar
provocando el escenario en un despliegue real -- no se fuerza aquí para
no arriesgar nada en producción sin necesidad.

## Acción requerida del usuario

Ninguna en base de datos. La próxima vez que ocurra este error en una
pestaña ya abierta durante un despliegue, debería auto-recargarse sola.
