# Dashboard Nacional (2026-09-01)

## Contexto

El usuario pidió un análisis de qué falta construir en distrital y
nacional para llegar a un "software pleno". Al revisar el código (no
solo la investigación de metodología IPUC ya hecha), se confirmó una
brecha real: **el nivel distrital ya tenía un dashboard propio y maduro**
(`DashboardDistrital` en `Dashboard.jsx`, con 5 insights BI construidos
en las fases 2 y 3 de esta sesión), **pero nacional y super_admin no
tenían ninguna vista propia** — caían al mismo dashboard genérico de
congregación local, sin `congregacion_id`, así que salía prácticamente
vacío. Tampoco existía ninguna función SQL que agregara métricas por
distrito a escala nacional (solo `resumen_distrital(p_distrito_id)`, que
agrega por congregación dentro de un solo distrito).

## Qué se construyó

- **`supabase/resumen_nacional.sql`**: función `resumen_nacional()`,
  análoga a `resumen_distrital()` pero agregando **por distrito** en vez
  de por congregación (una fila por distrito, no por congregación). Mismo
  patrón de seguridad (`security invoker` + `mis_congregaciones()`), para
  que un nacional/super_admin vea todos los distritos y cualquier otro
  rol solo vea agregados de su propio alcance.
- **`DashboardNacional`** (nuevo componente en `src/pages/Dashboard.jsx`,
  junto a `DashboardDistrital`): mismos 5 insights BI que el distrital
  (brecha de llenura, eficacia REFAM, embudo Uno Más→REFAM, movimiento de
  membresía, madurez de la obra) pero sumados a escala nacional, más una
  tabla "Comparativa por distrito" (máximo 36 filas, no necesita
  paginación) ordenable por los mismos criterios.
- **Aclaración explícita de escala**: el panel nacional ahora indica
  textualmente que sus cifras son de la IPUC en Colombia, distintas de
  las cifras globales de la UPCI (la comunión internacional de la que
  IPUC es la afiliada colombiana) — hallazgo de la investigación de
  metodología que hasta ahora no tenía dónde mostrarse porque no existía
  ninguna vista nacional.
- `Dashboard.jsx` ahora enruta: `distrital` → `DashboardDistrital`,
  `nacional`/`super_admin` → `DashboardNacional`, cualquier otro caso
  sigue con el dashboard de congregación local.

## Bug encontrado de paso

La tabla "Comparativa por congregación" del `DashboardDistrital` (la
misma que ya tiene los 5 insights de las fases 2/3) nunca se paginó en la
ronda de paginación de esta sesión — se pasó por alto porque vive dentro
de `Dashboard.jsx`, no en los archivos que se revisaron entonces. Ahora
pagina de a 50 con el mismo `Pager` reutilizable.

## Explícitamente pendiente

- El **informe estadístico nacional real** (formato exacto que usa la
  coordinación de estadística) sigue pendiente de que el usuario lo
  consiga — no se construyó nada basado en suposiciones al respecto.
- El **proveedor SMTP propio** en Supabase Auth sigue pendiente antes de
  producción real (bloqueante ya documentado, ver `docs/pendientes.md`).
- No se modeló la junta distrital de 5 cargos (Supervisor, Secretario, 2
  Presbíteros, Veedor) — decisión ya tomada por el usuario de mantener un
  solo rol `distrital`.

## Acción requerida del usuario

Ejecutar `supabase/resumen_nacional.sql` en el SQL Editor de Supabase
(después de `bi_fase2_insights.sql`, que ya debe estar aplicado). Sin
esto, el Dashboard Nacional mostrará el error "No se pudo cargar el
consolidado nacional."
