# Nuevo módulo: Obra Carcelaria (2026-09-01)

## Qué es

Módulo completo para el comité de Obra Carcelaria de la IPUC (evangelismo y
discipulado en centros de reclusión), a solicitud explícita del usuario:
"que se gestione todo lo que se hace de evangelismo en la cárcel por medio
de este comité". Cubre el ciclo completo, con el mismo estándar "avanzado"
(ficha individual, gráficos, métricas, insights) que Misión Juvenil,
Escuela Dominical y Damas Dorcas:

- **Asistencia interna** (dentro del centro): ficha individual por interno,
  cultos con asistencia (agregada + individual para quienes tienen ficha),
  REFAM Carcelaria (estudios bíblicos entregados), bautismo y sellado con
  el Espíritu Santo.
- **Habilitación de voluntarios**: roster de delegados locales con permiso
  INPEC (vigente/vencimiento), con alerta visual cuando está vencido o
  vence en menos de 30 días.
- **Asistencia externa**: seguimiento al núcleo familiar del interno
  (visitas, consejería), con vínculo opcional a una familia ya censada.
- **Reinserción post-penitenciaria**: al liberarse, el coordinador
  distrital asigna al interno a una congregación local (no necesariamente
  del mismo distrito) para discipulado y evitar la reincidencia; la
  congregación destino reporta después si el liberado se integró.
- **Centros de reclusión**: catálogo por distrito (una cárcel puede ser
  atendida por varias congregaciones del distrito).

## Decisiones tomadas con el usuario antes de construir

1. **Nivel nacional**: alcance liviano. Nacional/super_admin ya tienen
   visibilidad total vía el motor de permisos existente
   (`mis_congregaciones()`/`es_nacional()`); no se construyó una pantalla
   nacional dedicada (no existe ninguna en el proyecto todavía, ni cuenta
   de prueba nacional real).
2. **Auditoría INPEC de delegados**: campos estructurados (checkbox +
   fecha de vencimiento + nota), no carga de documentos — el proyecto no
   usa Supabase Storage en ningún otro módulo.

## Arquitectura (reutiliza patrones existentes, no inventa nuevos)

- **Catálogo por distrito**: `centros_reclusion` sigue exactamente la
  forma de `pastores` (`pastoral_distrital.sql`) — tabla scoped por
  `distrito_id`, RLS con `es_lider_distrital()`, gestionada desde Pastoral
  Distrital.
- **Ficha individual + consolidado distrital**: `obra_carcelaria_internos`
  (ficha), `obra_carcelaria_cultos`/`_asistencia` (registro + asistencia
  individual) siguen la misma forma que `escuela_dominical_ninos`/
  `_lecciones`/`_asistencia`.
- **Vínculo con Red de Familias sin forzar su modelo**: se evaluó
  reutilizar `red_familias_casos` directamente, pero esa tabla exige
  `familia_id not null` (una familia ya censada). El núcleo familiar de un
  interno frecuentemente no está censado en ninguna congregación, así que
  se creó `obra_carcelaria_seguimiento_familiar` con sus propios campos y
  un `familia_id` **opcional** para cuando la familia sí está censada.
- **Reinserción (pieza nueva)**: `obra_carcelaria_reinsercion` es la única
  tabla del proyecto pensada para que dos congregaciones distintas
  interactúen sobre la misma fila — la de origen (donde se hizo el
  ministerio) y la de destino (donde el liberado se integra). Solo el
  coordinador distrital de origen puede crear la asignación (función
  `asignar_reinsercion()`, mismo patrón que `trasladar_pastor()`); el
  pastor de la congregación destino puede actualizar el `estado`
  (activo/inactivo/reincidencia) para alimentar el KPI de "eficacia de
  reinserción eclesial". La congregación destino puede ser de **cualquier
  distrito** (se asigna por cercanía a la residencia del liberado, no por
  jurisdicción territorial de la cárcel).
- **Hueco de RLS evitado desde el diseño**: se detectó que Escuela
  Dominical/Damas Dorcas (`escuela_dominical_damas_dorcas.sql`) solo
  conceden lectura vía `tiene_permiso()`, que no reconoce a
  distrital/nacional automáticamente — en la práctica, el consolidado
  distrital de esos dos módulos podría estar devolviendo ceros para
  congregaciones donde el distrital no tiene un grant manual en
  `asignaciones_acceso`. Para Obra Carcelaria se añadió explícitamente
  `or es_super_admin() or es_nacional() or (congregación en mi distrito)`
  a las políticas de lectura de las tablas locales, evitando heredar ese
  mismo hueco. **Pendiente para una próxima sesión**: confirmar si el
  hueco real existe en Escuela Dominical/Damas Dorcas y corregirlo igual.

## Archivos

- `supabase/obra_carcelaria.sql` (nuevo): tablas, RLS, `asignar_reinsercion()`,
  permisos, `resumen_carcelaria_distrital()`, `resumen_reinsercion_distrital()`,
  `internos_liberados_sin_asignar()`.
- `src/pages/ObraCarcelaria.jsx` (nuevo): pantalla local con 5 pestañas
  (Internos, Cultos y REFAM, Delegados, Seguimiento familiar, Reinserción),
  4 tarjetas KPI, gráfico de tendencia de asistencia y gráfico de
  "población flotante vs. membresía interna", alerta de delegados con
  permiso INPEC por revisar.
- `src/pages/PastoralDistrital.jsx`: secciones nuevas "Centros de
  reclusión" (CRUD), "Obra Carcelaria por congregación" (consolidado),
  "Reinserción post-penitenciaria" (lista + eficacia calculada en cliente
  + formulario "Asignar reinserción").
- `src/App.jsx`, `src/components/layout/Sidebar.jsx`: ruta `/obra-carcelaria`
  y entrada de navegación (ícono `LockKeyhole` — lucide-react no tiene un
  ícono literal de cárcel/prisión, es el más cercano conceptualmente).

## Verificación realizada

`npm run build` sin errores. Verificado en vivo con Playwright contra
`npm run dev`, usando la cuenta de prueba con doble rol (local + distrital):

1. Como distrital: se creó un centro de reclusión desde Pastoral Distrital.
2. Cambio a rol local: apareció el centro en el selector de Obra
   Carcelaria. Se registró un delegado (con permiso INPEC vigente — la
   alerta no se disparó, correcto), dos internos, un culto con asistencia
   individual marcada para ambos, se marcó un interno como bautizado y
   sellado, se registró seguimiento familiar, y se marcó al segundo
   interno como liberado.
3. Cambio a rol distrital: la tabla "Obra Carcelaria por congregación"
   mostró los números correctos (internos activos, bautizados, sellados,
   delegados hábiles). Se asignó la reinserción del interno liberado
   (`asignar_reinsercion()`) a una congregación destino — el interno pasó
   a estado `trasladado` automáticamente y dejó de contarse como activo.
4. Cambio a rol local (congregación destino): la pestaña Reinserción
   mostró el caso con el selector de estado habilitado (por ser la
   congregación receptora); se actualizó a "Activo" y el cambio se
   reflejó de inmediato en la tabla.
5. Todos los datos de prueba fueron eliminados al final (delegado,
   internos, culto, asistencia, seguimiento familiar, centros de
   reclusión) usando las mismas políticas RLS del cliente — no fue
   necesaria ninguna intervención manual en el SQL Editor para la
   limpieza. Nota técnica: `obra_carcelaria_reinsercion` no tiene política
   de `delete` (es un registro tipo histórico/auditoría, intencional,
   igual que `movimientos_membresia`); se limpió automáticamente vía
   cascade al borrar la ficha del interno padre.

## Pendiente

- Nivel nacional: si en el futuro se crea una cuenta nacional real, vale
  la pena una pantalla propia que recorra los 36 distritos (hoy nacional
  ya puede consultar cualquier distrito ejecutando las mismas RPCs
  distritales, pero no hay una vista agregada de "todo el país" en una
  sola pantalla).
- Revisar si Escuela Dominical/Damas Dorcas tienen el mismo hueco de RLS
  (lectura distrital/nacional dependiente de `tiene_permiso()`) que se
  evitó aquí desde el diseño.
- El selector de "Congregación destino" en el formulario de reinserción
  de Pastoral Distrital solo lista congregaciones del propio distrito del
  coordinador (aunque el backend permite cualquier congregación activa del
  país) — es una simplificación de UI, no una limitación del modelo de
  datos; ampliarlo a un buscador nacional si se necesita en la práctica.
