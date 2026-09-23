# Amigos: "último contacto" calculado (sin campo manual nuevo) -- 2026-09-23

## Contexto

Mismo pedido del directivo nacional que motivó
`docs/fixes/confirmar-contacto-feligresia-2026-09-23.md`: poder
detectar a tiempo cuando un amigo (persona no convertida, en ruta
evangelística) deja de tener contacto. A diferencia de feligresía,
`amigos` no tenía ningún campo ni alerta equivalente a
`fecha_ultima_asistencia`. El único intento parecido en el código
(`FriendInsights` en `Amigos.jsx`, "N personas llevan más de 30 días
desde el primer contacto") usaba `fecha_primer_contacto` -- un campo
que se fija una sola vez al crear el registro y nunca se actualiza,
así que queda permanentemente "vencido" para cualquiera en un proceso
de REFAM/ESFOB de varios meses. Mismo problema de fondo que el de
feligresía, ya manifestado dos veces en el código.

## Decisión de diseño

No se agregó una columna nueva en `amigos` para escribir una fecha a
mano -- repetiría exactamente la falla de `fecha_ultima_asistencia`
(depende de que alguien se acuerde de teclearla). En vez de eso, se
construyó una **vista calculada** que toma la fecha más reciente entre
las actividades reales que el personal ya registra como parte de su
trabajo normal en cada estación de la ruta.

## Corrección

**`supabase/reportes/fix_ultimo_contacto_amigos.sql`** (nuevo,
repetible, sigue la convención de
`fix_alertas_pastorales_gracia_ingreso.sql`: archivo nuevo con
`create or replace view`, no se edita ningún archivo histórico):

```sql
create or replace view vw_ultimo_contacto_amigos with (security_invoker = true) as
select
  a.id as amigo_id,
  a.congregacion_id,
  greatest(
    a.fecha_primer_contacto,
    (select max(n.created_at)::date from amigos_notas n where n.amigo_id = a.id),
    (select max(ba.fecha_visita) from bis_atenciones ba where ba.amigo_id = a.id),
    (select max(enl.created_at)::date from esfob_notas_leccion enl
       join esfob_procesos ep on ep.id = enl.esfob_proceso_id where ep.amigo_id = a.id),
    (select max(umc.fecha_ultimo_contacto) from uno_mas_compromisos umc where umc.amigo_id = a.id),
    (select max(rp.fecha_inicio) from ruta_procesos rp where rp.amigo_id = a.id)
  ) as ultimo_contacto
from amigos a
where not a.convertido;
```

`security_invoker = true` (mismo patrón que `vw_alertas_pastorales`)
hereda el alcance por congregación de la RLS de `amigos`, sin filtrar
nada a mano.

**Limitación conocida y aceptada, no bloqueante**: REFAM no aporta a
este cálculo. `refam_reuniones` es un conteo grupal (asistentes/
visitantes, sin lista de quién asistió) y `refam_participantes` solo
registra `fecha_ingreso` una sola vez al grupo -- igual de "vencido"
que `fecha_primer_contacto`. Un amigo que solo pasa por REFAM sin
visitas BIS ni notas puede verse "sin contacto reciente" aunque esté
yendo a las reuniones semanales. Cerrar esto necesitaría rediseñar
cómo REFAM registra asistencia individual -- no es parte de este
cambio, queda como seguimiento futuro.

**`src/pages/Amigos.jsx`**:
- Se agrega `vw_ultimo_contacto_amigos` a la carga inicial (scoped por
  congregación), guardado en un nuevo estado `ultimoContactoPorAmigo`
  (mapa `amigo_id → fecha`). Si la vista todavía no existe en
  producción (falta ejecutar el SQL), la pantalla no se rompe: se
  degrada a "sin datos" para ese mapa.
- `FriendInsights`: el cálculo de "sin contacto reciente" ahora usa
  `ultimo_contacto` en vez de `fecha_primer_contacto`, con un umbral de
  **21 días** (más corto que los 90 de feligresía -- una relación de
  ruta evangelística es más temprana y frágil; es un literal fácil de
  ajustar si se prefiere otro número).
- Badge "N días sin contacto" en la tarjeta de cada amigo de la lista
  (cuando supera el umbral) y en la ficha de detalle, mismo patrón
  visual que ya usa cada estación para "días en la estación actual"
  (`diasDesde()` de `src/lib/rutaEvangelistica.js`).
- Botón **"Marcar contacto hoy"** en la ficha (junto a "Notas de
  acompañamiento"): inserta una fila en `amigos_notas` (reutiliza la
  tabla existente, sin columna nueva) y actualiza el estado local al
  instante -- la próxima carga ya lo reflejará también en la vista.

## Verificación

- `npm run build` sin errores.
- Confirmado en vivo contra producción real (cuenta
  `pueba691@gmail.com`) que las 6 tablas/columnas que usa la vista
  existen tal como se asumió (consultas equivalentes a cada
  subconsulta del `greatest()`, sin errores de PostgREST).
- **Pendiente: falta ejecutar `fix_ultimo_contacto_amigos.sql` en el
  SQL Editor de Supabase (producción real)** -- no se pudo probar la
  vista en sí (no existe hasta que se cree). Una vez creada, verificar
  con un amigo de prueba: confirmar que `ultimo_contacto` arranca en
  `fecha_primer_contacto`, agregar una nota o marcar "contacto hoy", y
  confirmar que `ultimo_contacto` se actualiza al `greatest()`
  esperado. Limpiar los datos de prueba al terminar.
