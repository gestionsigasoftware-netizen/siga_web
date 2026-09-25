# Traducción del chrome de la app: Sidebar, header y footer

**Fecha:** 2026-09-25
**Archivos:** `src/components/layout/Sidebar.jsx`,
`src/components/layout/MainLayout.jsx`,
`src/components/layout/RoleChooser.jsx`, `src/components/Footer.jsx`,
`src/i18n/locales/{es,en,pt}.json`.

## Contexto

Continuación de las Fases 1 y 2 (tema día/noche + i18n en Inicio, modo
oscuro en toda la app). El usuario pidió avanzar con la traducción
del resto de la app a inglés/portugués. Se empezó por el "chrome" --
lo que cualquier usuario ve siempre, sin importar en qué pantalla
esté ni su rol: el menú lateral completo, el encabezado superior, y
el pie de página compartido.

## Qué se tradujo

- **Sidebar.jsx**: los 34 ítems de navegación (uno por módulo), las 5
  etiquetas de grupo (Feligresía, Evangelismo y misión, Comités y
  ministerios, Administración, Información y soporte), los 4 niveles
  de rol (Super Admin/Nacional/Distrital/Congregación), "Tu acceso",
  "Acceso general", "Pastor:", "Distrito N", "Cambiar de rol",
  "Cerrar sesión", el rótulo de carga, y los aria-label de
  abrir/cerrar el menú móvil.
- **MainLayout.jsx** (header de toda la app autenticada): "Panel de
  control", "Panel de gestión pastoral", "Notificaciones", "Mi
  perfil", los mensajes de carga (`Suspense` fallback + "Preparando
  tu espacio..."), y el diálogo completo de "¿Sigues ahí?" por
  inactividad.
- **Footer.jsx** (compartido en toda la app y en Ayuda/Legal):
  reutiliza las claves `common.footer.*` ya creadas en la Fase 1.
- **RoleChooser.jsx**: solo la función `describirAlcance()` (usada
  por el selector de rol del Sidebar) -- el resto de esa pantalla
  (solo se ve al iniciar sesión con una cuenta multi-rol) queda para
  una pasada posterior.

Nombres de ministerios/ramas traducidos con criterio (no
automático): "Escuela Dominical" → "Sunday School" (término
estándar en inglés), "Damas Dorcas" → "Dorcas Ladies", "Obra
Carcelaria" → "Prison Ministry", "Conquistadores Pentecostales" →
"Pentecostal Conquerors", "SEPRI" se dejó igual en los 3 idiomas
(es una sigla/nombre propio colombiano, no un término traducible).

## Detalle técnico

`describirAlcance()` es una función suelta (no un componente), así
que no puede usar el hook `useTranslation()` -- se le agregó
`import i18n from '../../i18n'` y usa `i18n.t(...)` directo (la
misma instancia de i18next, funciona igual fuera de React).

`formatDistrictLabel()` en Sidebar.jsx pasó a recibir `t` como primer
parámetro en vez de construir el texto a mano, para poder usar la
clave `sidebar.district` con interpolación (`"Distrito {{numero}}"`).

## Verificación

1. `npm run build` sin errores.
2. Playwright: se cambia el idioma a inglés desde el selector de
   Inicio (persiste en `localStorage`, compartido con toda la app),
   se inicia sesión real (rol local) y se confirma por captura de
   pantalla que TODO el Sidebar, el header y el pie de página quedan
   en inglés de una vez, sin mezclar español. Repetido cambiando a
   portugués directamente vía `localStorage` + recarga (confirmado
   "Resumo"/"Sair" presentes). Cero errores de consola.

## Pendiente

El resto del contenido de cada pantalla (Dashboard, Feligresía,
Reportes, y las ~40 pantallas restantes) sigue en español fijo --
esta pasada fue solo el chrome compartido. Sigue como trabajo de
contenido pendiente, mejor abordado por grupos de módulos en
próximas sesiones. También queda pendiente traducir el resto de
`RoleChooser.jsx` (la pantalla de selección de rol al iniciar
sesión).
