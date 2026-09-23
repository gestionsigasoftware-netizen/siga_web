# Auditoría sistemática, lote distrital/nacional -- 2026-09-23

Última tanda de la auditoría sistemática pedida por el usuario tras
encontrar el mismo bug varias veces (ver los demás `docs/fixes/*multi-rol*2026-09-23.md`
de hoy). Cubre las pantallas más grandes: `Dashboard.jsx`,
`PastoralDistrital.jsx`, `ImpactoMisionero.jsx`,
`GestionPastoralNacional.jsx`, `GestionDistritos.jsx`,
`SaludDatos.jsx`, `ComitesNacional.jsx`, `Solicitudes.jsx`,
`Personas.jsx`, `RegistrarAsistencia.jsx`, `FeligresiaAdmin.jsx`.

## Confirmados sin problema (ya bien acotados)

`Dashboard.jsx`, `GestionPastoralNacional.jsx`, `SaludDatos.jsx`,
`ComitesNacional.jsx`, `Personas.jsx`, `RegistrarAsistencia.jsx` --
todos filtran explícito por `rolPrincipal` o bloquean el `useEffect`
de carga hasta confirmar el rol permitido.

## Corregidos

### 1. `FeligresiaAdmin.jsx` -- el más serio, dato visible en pantalla

Tres consultas del `Promise.all` principal (pantalla local, pero
igual expuesta a una cuenta multi-rol viendo "como" local) no
filtraban por congregación, confiando solo en RLS:

- **`vw_alertas_pastorales`** (línea ~600): sin ningún filtro, y su
  resultado se renderiza directo en la tarjeta "Alertas pendientes"
  (título/detalle de cada alerta, botón "Atender"). Era el único de
  los tres visible de inmediato en pantalla sin necesitar DevTools.
  Corregido: `.eq('congregacion_id', congregacionId)`.
- **`relaciones_familiares`** (línea ~592): sin filtro, alimenta el
  árbol familiar. La tabla tiene DOS FK a `personas` (`persona_id` y
  `relacionada_id`), así que el embed necesitó calificar la relación
  exacta (mismo patrón de la lección de FK ambigua del 2026-09-18):
  `personas!relaciones_familiares_persona_id_fkey!inner(congregacion_id)`
  + `.eq('personas.congregacion_id', congregacionId)`.
- **`historial_cargos`** (línea ~596): sin filtro, alimenta el
  historial de cargos por persona y el conteo de "Cargos vigentes".
  Solo tiene una FK a `personas`, sin ambigüedad: embed
  `personas!inner(congregacion_id)` + `.eq(...)`.

### 2. `Solicitudes.jsx`

La consulta principal (`solicitudes_jerarquicas`) no filtraba para
ningún nivel, confiando solo en la política RLS
(`creado_por = auth.uid() or congregacion_id in mis_congregaciones()
or distrito_id in mis_distritos() or es_nacional() or es_super_admin()`).
Corregido reflejando esa misma lógica pero fijada al rol activo:
local → `.or('creado_por.eq.<uid>,congregacion_id.eq.<propia>')`;
distrital → `.or('creado_por.eq.<uid>,distrito_id.eq.<propio>')`;
nacional/super_admin → sin filtro (su alcance legítimo). Se mantiene
`creado_por` en el OR para no perder de vista una solicitud que el
propio usuario creó antes de un cambio de congregación/distrito.

### 3. `ImpactoMisionero.jsx`

El helper `scoped()` solo distinguía `nivel === 'local'`; para
distrital caía al mismo camino sin filtro que nacional/super_admin,
mostrando el país entero rotulado como "tu distrito" en las 6
consultas (Obra Carcelaria, Misión Juvenil, Obra Social). Corregido
agregando la rama distrital con embed `congregaciones!inner(distrito_id)`
(o doble embed para `obra_social_ayudas`, que llega a congregación vía
`obra_social_casos`).

### 4. `PastoralDistrital.jsx`

`historial_licencias_pastorales` y `formacion_pastoral` no filtraban
en absoluto -- riesgo más sutil: no es el bug multi-rol clásico, sino
que un líder distrital con roles en **más de un distrito** vería el
historial de licencias/formación de pastores de TODOS sus distritos
mezclado, no solo el del distrito actualmente activo. Corregido con
embed `pastores!inner(distrito_id)` + `.eq('pastores.distrito_id', distritoId)`
(la tabla `pastores` tiene `distrito_id` propio, sin ambigüedad de FK).

### 5. `GestionDistritos.jsx`

Mismo patrón "fetch antes de gate" que `Suscripciones.jsx`/
`ErroresSistema.jsx` de la tanda anterior: el catálogo completo de
distritos y congregaciones del país se cargaba antes de confirmar que
el rol activo fuera nacional/super_admin -- no se mostraba en pantalla,
pero sí viajaba por la red. Corregido moviendo el chequeo de rol al
propio `useEffect`.

## Verificación

- `npm run build` sin errores.
- Confirmado en vivo contra producción real (cuenta
  `pueba691@gmail.com`) que las 7 consultas nuevas/modificadas con
  embeds (incluido el doble embed de `obra_social_ayudas` y el embed
  calificado de `relaciones_familiares`) no producen ningún error de
  PostgREST.
- No verificado con clics reales ningún caso distrital/nacional
  multi-rol ni multi-distrito exacto (no hay cuenta de prueba con esos
  roles).

## Cierre de la auditoría sistemática de hoy

Con este lote se completó la revisión de las 46 pantallas que usan
`useMiRol()`. Total de instancias reales encontradas y corregidas en
el día: `AuditoriaFeligresia.jsx`, `ReportesOptimizado.jsx`,
`Aprobaciones.jsx`, `GlobalSearch.jsx`, `Suscripciones.jsx`,
`ErroresSistema.jsx`, `FeligresiaAdmin.jsx` (x3), `Solicitudes.jsx`,
`ImpactoMisionero.jsx`, `PastoralDistrital.jsx` (x2),
`GestionDistritos.jsx` -- 13 consultas en 11 archivos.
