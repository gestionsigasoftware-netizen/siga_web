# Botón "Vincular" en Misión Juvenil — 2026-09-07

## Contexto

Primer ítem (el más complejo) del plan de cierre del rediseño Ruta
Evangelística + comités acordado con el usuario. Misión Juvenil tenía
su propia tabla de población (`mision_estudiantes`), aislada, sin
ningún enlace a `amigos`/`personas`/`ruta_procesos` -- un estudiante
convertido no tenía ningún siguiente paso formal hacia la Ruta
Evangelística ni hacia Feligresía. Ya existía un precedente exacto:
Obra Carcelaria (commit `5677fa5`, 2026-09-05) resuelve el mismo
problema para internos liberados con un botón "Vincular" en
`ObraCarcelaria.jsx` (`vincularRutaEvangelistica`).

## Diseño

- `mision_estudiantes.estado` (`simpatizante | refam | discipulado |
  bautizado | inactivo`) **no mapea limpiamente** a las 5 estaciones de
  la Ruta -- "discipulado" en Misión Juvenil significa "en formación",
  no necesariamente bautizado, mientras que la estación Discipulado de
  la Ruta exige bautismo. Inventar ese mapeo habría sido un error de
  dominio. Se optó, igual que Obra Carcelaria, por usar el campo
  booleano `bautizado` (no el enum `estado`) como único criterio de
  ramificación:
  - Si `bautizado`: crea el `amigo` ya con
    `estado_espiritual: "bautizado", bautizado: true, fecha_bautismo`
    -- listo para incorporar a Feligresía desde Amigos, sin pasar por
    ninguna estación.
  - Si no: exige un responsable (persona) y agrega al amigo a **BIS**
    directamente (nunca Uno Más) -- "ya fue contactado", misma razón
    que usa Obra Carcelaria.

## Construido

- `supabase/modulos/vincular_mision_juvenil.sql`:
  `amigos.mision_juvenil_estudiante_id` (FK a `mision_estudiantes`,
  nullable, `on delete set null`) + índice parcial -- mismo patrón
  exacto que `amigos.obra_carcelaria_interno_id`.
- `src/pages/MisionJuvenil.jsx`:
  - Import de `getEstacion`/`iniciarOMoverEstacion` de
    `src/lib/rutaEvangelistica.js`.
  - Estado nuevo: `estudiantesVinculados` (Set, misma query-shape que
    `internosVinculados` en Obra Carcelaria), `vinculandoId`,
    `responsableVinculoId`.
  - `load()` extendido con una consulta más a `amigos` para poblar
    `estudiantesVinculados`.
  - `vincularRutaEvangelistica(student)`: réplica de la función de
    Obra Carcelaria adaptada a `mision_estudiantes`.
  - Columna nueva "Ruta Evangelística" en la tabla "Estudiantes por
    estado" -- mismo patrón de UI que la pestaña Reinserción de Obra
    Carcelaria (botón "Vincular" → si bautizado llama directo, si no
    abre selector inline de responsable + confirmar; "Vinculado" si ya
    se hizo).

## Verificación

Contra la base de datos real (congregación Puerto Tejada Cauca
Central), con el usuario de prueba `pueba691@gmail.com`:

1. Estudiante no bautizado → se crea el `amigo` con
   `mision_juvenil_estudiante_id` enlazado, y un `ruta_procesos` activo
   en la estación BIS con el responsable-persona elegido (y
   `responsable_comite_id` en null, correcto porque BIS es
   persona-only).
2. La consulta que arma `estudiantesVinculados` detecta correctamente
   al estudiante recién vinculado.
3. Estudiante ya bautizado → se crea el `amigo` con
   `bautizado/estado_espiritual/fecha_bautismo` ya establecidos y
   **sin** ninguna fila en `ruta_procesos` (no entra a ninguna
   estación, queda listo para incorporar a Feligresía).
4. Limpieza completa, sin residuos.

`npm run build` sin errores.

## Pendiente

Si más adelante se construye el motor de sugerencia de comités por
edad/sexo en pantallas de Ruta (ítem 2 del plan), el selector de
responsable de este botón podría enriquecerse con sugerencias -- no es
necesario para que esta pieza funcione.
