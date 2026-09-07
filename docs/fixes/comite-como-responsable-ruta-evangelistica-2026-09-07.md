# Comité como responsable en la Ruta Evangelística — 2026-09-07

## Contexto

Primera pieza de un rediseño más grande que el usuario planteó: quiere
unificar Misión Juvenil, Obra Carcelaria y cualquier otro brazo
"extramural" bajo la misma Ruta Evangelística, con un mecanismo de
relevo hacia los comités locales de Feligresía (Jóvenes, Damas Dorcas,
Escuela Dominical, Caballeros, etc.) una vez la persona llega a la
congregación. Esa discusión más amplia sigue en curso; este fix es
solo la base técnica: que un proceso de la ruta pueda tener un comité
completo como responsable, no solo una persona.

## Corrección de alcance durante la construcción

La primera versión permitía elegir "Persona o Comité" por igual en
las 4 estaciones. El usuario corrigió esto: el responsable individual
debe reservarse para el acompañamiento personal en **Uno Más y BIS**
(un feligrés concreto visitando a un amigo) y para quien marca/enseña
una **lección** (ya existía, sin cambios). Para **REFAM, ESFOB y
Discipulado**, el responsable general de la estación debe ser
**siempre un comité**, no una persona suelta.

## Diseño final

`src/lib/rutaEvangelistica.js`:

- `TIPO_RESPONSABLE_ESTACION` -- mapa fijo: `uno_mas`/`bis` →
  `"persona"`, `refam`/`esfob`/`discipulado` → `"comite"`.
- `iniciarOMoverEstacion()` aplica ese tipo automáticamente: si el
  responsable que llega no coincide con el tipo de la estación
  destino, se descarta (nunca se guarda mal) -- por ejemplo, alguien
  que traía un responsable individual desde BIS y se traslada a ESFOB
  llega sin responsable, no con uno inválido. Esto reutiliza la misma
  filosofía que REFAM ya tenía ("un traslado no exige responsable",
  solo el alta nueva).
- Se corrigió de paso un bug real que apareció al construir esto:
  cuando alguien ya está activo en una estación (ej. llegó a REFAM por
  traslado) y se le "agrega" de nuevo ahí (ej. vía "agregar
  participante" en REFAM, para meterlo a un grupo), `iniciarOMoverEstacion`
  hacía un cortocircuito (`moved: false`) y el responsable elegido en
  ese segundo paso **nunca se guardaba**. Ahora, en ese caso, actualiza
  el registro existente en vez de ignorarlo.
- `getComitesActivos()` -- comités activos de una congregación, para
  los selectores.
- `getEstacionActivos()` ahora también trae `responsable_comite_id` y
  el nombre del comité.

`supabase/modulos/comite_responsable_ruta_evangelistica.sql`:

- `responsable_comite_id` en `ruta_procesos`/`esfob_procesos`,
  `mentor_comite_id` en `discipulado_procesos` -- columnas alternas,
  mutuamente excluyentes con las de persona (check constraint).
- **Hallazgo real durante la verificación**: `ruta_procesos.responsable_persona_id`
  tenía un `NOT NULL` puesto por una migración anterior a esta sesión
  (`ruta_procesos_responsable_obligatorio.sql`, de cuando el único
  tipo de responsable posible era una persona). Bloqueaba por completo
  el caso comité. Se relajó a nullable. Un primer intento de
  reemplazarlo por un check "debe haber persona O comité" también
  resultó incorrecto -- bloqueaba la transición legítima descrita
  arriba (llegar a una estación sin responsable válido, a la espera de
  que se le asigne uno del tipo correcto). Se quitó ese check también;
  solo queda la exclusividad mutua (nunca ambos a la vez).

`EstacionUnoMas.jsx` / `EstacionBis.jsx`: sin cambios funcionales al
final (se revirtió el intento inicial de agregar comité ahí).

`EstacionRefam.jsx`: "Agregar participante" ahora pide un comité
(selector único, obligatorio) en vez de persona.

`RutaFormacion.jsx` (ESFOB/Discipulado): "Iniciar proceso" ahora pide
un comité (selector único, obligatorio) en vez de persona. El botón
"Trasladar" de ESFOB conserva un selector opcional para reasignar el
comité en el momento del traslado.

## Verificación

Contra la base de datos real, con datos desechables:

1. Alta en BIS con persona → queda correcta.
2. Mover ese mismo proceso a ESFOB heredando la persona → la persona
   se descarta automáticamente (ESFOB exige comité), sin error.
3. Asignar un comité explícito a ese proceso en ESFOB → queda correcto.
4. Alta directa en REFAM con comité, y luego "reagregar" (simulando el
   flujo de "agregar participante" sobre alguien ya activo) con un
   comité distinto → el cortocircuito ya no ignora el cambio, el
   responsable se actualiza en la fila existente.
5. Intentar guardar persona y comité a la vez → la base de datos lo
   rechaza (constraint de exclusividad).

Todo limpiado sin residuos (dos corridas anteriores que fallaron a
mitad de camino, antes de las correcciones del SQL, dejaron 2 amigos
de prueba sueltos -- se limpiaron aparte). `npm run build` sin errores
en las tres rondas.

## Pendiente (fuera de alcance de este fix)

Este es solo el mecanismo base. Falta: el "Vincular" en Misión Juvenil
(replicando el patrón ya construido en Obra Carcelaria/reinserción),
el mismo para Obra Carcelaria en su punto de entrada inicial (no solo
reinserción), y cualquier mapeo automático de "qué comité le
corresponde a qué población" -- todo eso sigue en discusión con el
usuario.
