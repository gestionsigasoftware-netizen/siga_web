# Quitar "IPUC" de Inicio y Login (2026-09-02)

## Contexto

El usuario pidió corregir la mención a IPUC en la app. En un primer
intento se interpretó como "quitar IPUC de todo el software" y se
neutralizó también el membrete de las exportaciones, el Dashboard, Ayuda,
Configuración, Comités Nacional, Catálogo de distritos, Manual, Pastoral
Distrital e Impacto Misionero. El usuario corrigió el alcance: **solo
pidió quitarlo de la página de Inicio y de Login** — el resto de la app
(incluyendo el membrete IPUC de las exportaciones) debía quedar igual.
Todo lo que se había cambiado fuera de esas dos pantallas se revirtió con
`git checkout` antes de que hubiera commit de por medio, así que no quedó
rastro del sobre-alcance.

## Qué quedó cambiado (solo estas dos pantallas)

- **`src/pages/InicioPublico.jsx`**: el eyebrow del hero decía
  "Inteligencia pastoral IPUC" → ahora "Inteligencia pastoral".
- **`src/pages/Login.jsx`**: el texto bajo el panel de acceso decía
  "IPUC · Gestión pastoral" → ahora "SIGAP · Gestión pastoral".

## Explícitamente NO tocado (se revirtió al intentarlo)

- El membrete de las exportaciones CSV/Excel/PDF (`src/lib/reportExport.js`,
  `src/components/ExportButtons.jsx`) sigue usando el logo, nombre y lema
  reales de la IPUC, sin cambios.
- El footer institucional (`Footer.jsx`), el Dashboard, Ayuda,
  Configuración, Comités Nacional, Catálogo de distritos, Manual,
  Pastoral Distrital, Impacto Misionero y `package.json` quedaron
  exactamente como estaban, con sus menciones a la IPUC intactas.
- Los comentarios internos en `supabase/*.sql` nunca se tocaron (son
  documentación de diseño, no texto visible).

## Verificación

`npm run build` corre limpio con este alcance reducido.

## Acción requerida del usuario

Ninguna.
