# Migraciones SQL de SIGA

Todos estos archivos se ejecutan manualmente, completos, en el **SQL
Editor** de Supabase (no hay CLI de migraciones en este proyecto). Cada
uno indica en su propio encabezado de que otros depende -- este README
solo organiza la carpeta por tipo (reordenado el 2026-09-06 -- antes
eran ~70 archivos sueltos en un solo nivel) y da el orden general.

## Estructura

- **`schema/`**: la base de todo -- esquema completo + RLS
  (`schema.sql`), accesos/permisos/equipos (`accesos.sql`),
  configuracion por congregacion, y el endurecimiento de produccion.
  **Se ejecuta primero, en ese orden.**
- **`modulos/`**: cada comite/area funcional como unidad independiente
  -- Feligresía, Red de Familias, Evangelismo + Ruta Evangelistica,
  Misión Juvenil, Obra Carcelaria, Escuela Dominical/Damas Dorcas,
  Música/Ed. Artística/Ed. Teológica, Conquistadores/Obra Social,
  notificaciones, suscripciones. Se ejecutan despues de `schema/`,
  cada uno es razonablemente independiente de los demas salvo que su
  propio encabezado diga lo contrario.
- **`distrital/`**: todo lo que administra el rol distrital sobre sus
  congregaciones -- alta, traslados, licencias, cargos, continuidad
  pastoral.
- **`catalogos/`**: catalogos compartidos (congregaciones IPUC,
  ciudades, geolocalizacion) que alimentan formularios en toda la app.
- **`reportes/`**: vistas y funciones de solo lectura para dashboards
  y analitica (nacional, distrital, por modulo).
- **`soporte/`**: herramientas administrativas/soporte interno --
  otorgar roles, solicitudes jerarquicas, reportes de soporte.
- **`pwa/`**: lo que consume especificamente `siga-pwa-nacional`
  (asistencia movil, asignaciones por cargo, RLS especifico de la PWA).
- **`qa_pruebas/`**: seed y limpieza de datos de prueba/demo -- **nunca
  ejecutar contra una congregacion real** (ver el guard `es_demo=true`
  dentro de cada script).
- **`functions/`**: Edge Functions (Deno), se despliegan aparte con
  `npx supabase functions deploy <nombre>`, no desde el SQL Editor.

## Orden general para un proyecto nuevo

1. `schema/schema.sql`
2. `reportes/vistas_dashboard.sql`
3. `schema/accesos.sql`
4. `schema/migracion_produccion.sql`
5. `modulos/feligresia.sql`
6. `schema/configuracion.sql`
7. `modulos/notificaciones.sql`
8. `modulos/red_familias.sql`
9. El resto de `modulos/`, `distrital/`, `catalogos/`, `reportes/`,
   `soporte/`, `pwa/` -- revisar el encabezado de cada archivo por si
   declara una dependencia especifica antes de correrlo.

## Regla de mantenimiento

Un archivo nuevo va en la carpeta que corresponda a su tema (no en la
raiz de `supabase/`), y todo cambio relevante queda documentado en
`docs/pendientes.md` con la ruta completa (`supabase/carpeta/archivo.sql`).
