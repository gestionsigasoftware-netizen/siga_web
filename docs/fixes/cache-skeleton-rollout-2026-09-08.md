# Rollout de caché entre navegaciones a 33 páginas más — 2026-09-08

## Contexto

El patrón de caché-entre-navegaciones (evita el "Cargando..." bloqueante
de página completa en cada visita repetida, mostrando el dato de la
visita anterior mientras se refresca en segundo plano) solo estaba en 3
páginas (`Dashboard.jsx`, `FeligresiaAdmin.jsx`,
`MisionesEvangelismo.jsx`, ver `docs/fixes/cache-skeleton-2026-08-31.md`).
El pendiente original decía "replicar al resto de ~17 módulos" -- al
revisar el código real se encontraron **33 páginas** más usando el
bloqueo `module-loading`, no 17 -- la estimación original se quedó
corta.

## Diseño (sin cambios respecto al patrón ya probado)

Por página: un `Map` a nivel de módulo (`xCache`, fuera del componente,
sobrevive entre montajes/desmontajes de React); al inicio de `load()`,
si existe una entrada para la `cacheKey` de ese momento, se restauran
todos los `setX(...)` desde el objeto cacheado y se pone `loading` en
`false` de inmediato (la página se ve al instante con el dato de la
última visita); la carga real a Supabase sigue exactamente igual que
antes (nunca se salta), y al terminar se guarda el resultado fresco en
el `Map` para la próxima vez (stale-while-revalidate). No se tocó
ninguna lógica de negocio, permisos, ni orden de consultas -- solo se
envolvió el `load()` ya existente.

La `cacheKey` varía según de qué depende el contenido de cada página
(la mayoría: `congregacionId`; algunas con período/filtros:
`` `${congregacionId}:${periodo}` ``; páginas nacionales/globales sin
filtro por congregación: `'global'`/`'todas'`; páginas con varias
ramas de nivel: `` `${nivel}:${id}` ``, igual criterio que
`dashboardCache`).

Se construyó en 5 lotes paralelos, cada uno verificado con
`npm run build` antes de reportar, y una vez juntos los 5 lotes se
volvió a compilar todo el proyecto completo para confirmar que no hay
conflictos entre lotes.

## Páginas cubiertas (33)

Aprobaciones, RutaFormacion (ESFOB y Discipulado), EstacionRefam,
Amigos, ObraCarcelaria, MisionJuvenil, Modulos, EstacionBis,
EstacionUnoMas, PastoralDistrital, Sepri, AuditoriaFeligresia,
EscuelaDominical, EducacionArtistica, Musica, EducacionTeologica,
ObraSocial, RedFamilias, RegistrarAsistencia, Suscripciones,
ImpactoMisionero, Evangelismo, EquipoCongregacion, DamasDorcas,
Conquistadores, Configuracion, GestionDistritos, ComitesNacional,
GestionPastoralNacional, ConfiguracionSistema, Soporte, SaludDatos,
Solicitudes.

Quedan sin este patrón (a propósito, ver debajo): las 3 páginas que ya
lo tenían desde antes, y algunas subpantallas/paneles de detalle que
cargan bajo demanda (ej. detalle de un grupo REFAM al hacer clic) que
no producen el bloqueo de página completa -- esas no eran el problema
que se quería resolver.

## Verificación

`npm run build` sin errores, tanto por lote como del proyecto completo
junto (935 líneas agregadas, 220 eliminadas en 33 archivos, revisado
con `git diff --stat`). **Limitación explícita**: no se verificó
visualmente en navegador el "salta directo sin spinner" en cada una de
las 33 páginas -- es una mejora de rendimiento percibido, de bajo
riesgo funcional (no toca datos ni permisos), pero si alguna página se
comporta distinto a lo esperado al navegar hacia/desde ella
repetidamente, conviene reportarlo para revisar ese archivo puntual.

## Pendiente

Ninguna de las 33 páginas se convirtió a un skeleton visual dedicado
(solo se agregó el caché) -- se priorizó cubrir todas las páginas sobre
pulir la animación de carga de cada una, ya que el caché es la mejora
real (evita el bloqueo en visitas repetidas); el spinner de
`module-loading` solo se sigue viendo en la primera visita real de
cada página.
