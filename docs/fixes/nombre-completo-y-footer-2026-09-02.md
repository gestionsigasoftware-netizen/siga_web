# Nombre completo en el Sidebar y footer institucional (2026-09-02)

## Decisión de diseño

El usuario pidió que el nombre completo "Sistema Integrado de Gestión y
Analítica Pastoral" apareciera, y preguntó si en el Sidebar o en un
footer. Recomendación aplicada: el Sidebar es un espacio angosto (248px,
texto de 10px bajo el logo) — meter la frase completa ahí se vería
apretado. Se dejó algo corto pero real ("Gestión y Analítica Pastoral",
antes decía solo "Sistema integrado") y el nombre completo, con el
aviso de derechos de autor, va en un footer nuevo, reutilizado en toda
la app.

## `src/components/Footer.jsx` (nuevo)

Un solo componente usado en:
- **Páginas públicas**: `InicioPublico.jsx` (reemplazó su footer viejo,
  que solo decía "IPUC · Gestión pastoral"), `Ayuda.jsx`, `Legal.jsx`
  (antes ninguna de las dos tenía footer).
- **Dentro de la app**: `MainLayout.jsx` (antes no existía ningún
  footer autenticado).

Contenido:
```
SIGAP — Sistema Integrado de Gestión y Analítica Pastoral
© {año actual} IPUC. Todos los derechos reservados. · By Jormelia Soft
```
más los enlaces a Privacidad y términos / Ayuda. El año se calcula con
`new Date().getFullYear()`, no queda escrito a mano — no se desactualiza.

## Acción requerida del usuario

Ninguna — cambio de frontend puro, sin migraciones SQL.
