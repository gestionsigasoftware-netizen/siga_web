# Resumen de super_admin orientado al negocio — 2026-09-12

## Contexto

El usuario pidió explícitamente: el rol super_admin no trabaja con
los datos pastorales de la IPUC (feligresía, comités, etc. — eso lo
usan local/distrital/nacional), sino con el negocio de SIGAP. Su
"Resumen" debería mostrar analítica del núcleo del negocio:
congregaciones activas/no activas, en mora, próximas a vencer, y
nuevas. Sigue directamente el principio ya establecido en
`feedback_super_admin_vs_nacional` (memoria de proyecto).

## Diagnóstico

`src/pages/Dashboard.jsx` enrutaba a super_admin exactamente al mismo
componente que nacional (`DashboardNacional`): pirámide poblacional,
sellados, comparativa de distritos por feligreses -- ninguna de esas
cifras es relevante para operar el negocio SIGAP.

## Construido

Nuevo componente `DashboardSuperAdmin()` en el mismo archivo
(`src/pages/Dashboard.jsx`), enrutado solo para `nivel === 'super_admin'`
(antes compartía rama con `'nacional'`). Reutiliza `calcularEstadoSuscripcion`
de `src/lib/suscripciones.js` (la misma lógica que ya usa
`Suscripciones.jsx`, nunca guardada, siempre calculada a partir de
fechas) y consulta `congregaciones` + `suscripciones` directamente
(RLS ya cubierto: `mis_congregaciones()` incluye todo para
super_admin, igual que en Suscripciones/Aprobaciones).

Contenido, deliberadamente SIN ninguna cifra pastoral:

- Tiles: congregaciones totales, activas, pendientes de aprobación,
  nuevas (últimos 30 días).
- Estado de suscripciones: al día / en periodo de gracia / bloqueadas
  (en mora) / sin configurar, con gráfico de barras de la
  distribución.
- Ingreso mensual estimado (suma de suscripciones al día, planes
  anuales prorrateados entre 12 -- no cuenta lo que está en gracia o
  bloqueado, para no sobreestimar).
- Tabla "Requieren atención pronto": bloqueadas, en gracia, o que
  vencen dentro de 7 días -- ordenadas por urgencia, con acceso directo
  a Suscripciones.
- Tabla "Nuevas, pendientes de aprobación" (solo si hay alguna), con
  acceso directo a Aprobaciones.

## Verificación

- `npm run build` sin errores.
- Verificado con Playwright que el rol `local`
  (`pueba691@gmail.com`) sigue viendo su propio Resumen sin ningún
  error de consola -- la rama que cambió (`super_admin`) no afecta a
  los demás roles.
- **No verificado visualmente el panel de super_admin en sí** -- no
  hay una cuenta de prueba con ese nivel disponible en este entorno.
  Falta que el usuario lo revise con su cuenta real.
