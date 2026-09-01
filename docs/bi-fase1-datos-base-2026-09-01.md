# BI de la IPUC — Fase 1: datos base

Fecha: 1 de septiembre de 2026

## Contexto

El usuario compartió los criterios reales de la Coordinación Nacional de la
IPUC para medir crecimiento y pidió tratar SIGA como un sistema de BI: cada
dato debe poder convertirse en un insight accionable. Antes de construir se
auditó el código para no duplicar lo que ya existía (bautismos, categorías
demográficas, tipos de comité, el patrón de Misión Juvenil). Ver el plan
completo (3 fases) para el detalle de la auditoría y lo que falta en las
fases 2 y 3.

## Construido en esta fase (`supabase/hitos_espirituales.sql`, nuevo)

- **Sellados con el Espíritu Santo**: `personas.sellado_espiritu_santo` +
	`fecha_sellado`, mismo patrón que `bautizado`/`fecha_bautismo`. Editable
	en la ficha de Población (Feligresía), sumado a `vw_resumen_feligresia`
	y al resumen de métricas.
- **Estudios REFAM entregados**: nueva tabla `refam_asistencia_participante`
	(reunión × participante, boolean `asistio`) — calco de
	`mision_asistencia_estudiante`. Se marca al registrar una reunión REFAM
	en Evangelismo, con un checklist de los participantes del grupo.
- **Madurez de la sede**: `congregaciones.madurez` (Misión Nacional / Lugar
	de Predicación / Iglesia Local Constituida), editable desde Gestión
	pastoral (distrital) y Aprobaciones (nacional/super_admin).
- **Movimientos de membresía**: nueva tabla `movimientos_membresia` (alta
	por bautismo/recibimiento, baja por traslado/disciplina/exclusión,
	reactivación), con su propia pestaña "Movimientos" en la ficha de
	Población — complementa, no reemplaza, el log genérico de auditoría.
- **Clasificación poblacional de zonas**: `zonas.tipo_poblacion` (general,
	carcelaria, salud, indígena), seleccionable al crear una zona en
	Evangelismo.

## Bug encontrado y corregido

`saveMovimiento` (el nuevo guardado de movimientos de membresía) accedía a
`event.currentTarget.reset()` después de un `await`, y React puede invalidar
esa referencia para entonces — se corrigió capturando el formulario en una
variable antes de la espera asíncrona.

## Bug crítico encontrado y corregido (no relacionado con esta fase, pero descubierto al probarla)

Al construir el selector de rol el 2026-08-31, `rolActivoId` en
`useMiRol.js` se inicializaba con un `useState` de evaluación única, pero
`useAuth()` resuelve la sesión de forma asíncrona — en cualquier recarga
completa de página, `user` era `null` en esa primera evaluación, así que el
rol activo guardado en `localStorage` se perdía siempre y el rol volvía al
de mayor prioridad (ej. "distrital" en vez de "local" recién elegido),
mezclando vistas entre roles. Corregido releyendo `localStorage` en un
efecto que depende de `user`. Verificado con navegación completa y recarga
forzada en ambos sentidos (local↔distrital).

## Validación ejecutada

- `npm run build`: correcto.
- Playwright con la cuenta de prueba dual-rol: marcar sellado en una
	persona real (verificado en el contador y revertido), registrar dos
	movimientos de membresía (verificados y limpiados), cambiar la madurez
	de una congregación (verificado y revertido a su valor por defecto),
	crear una zona con tipo de población carcelaria (verificada y borrada),
	y registrar una reunión REFAM con asistencia individual usando un grupo
	y participante de prueba (verificado en `refam_asistencia_participante`
	y todo limpiado).

## Pendiente

- Fase 2 (insights BI: brecha de llenura, eficacia REFAM, embudo de la
	Ruta, movimiento de membresía, madurez de la obra) — sobre estos mismos
	datos, sin módulos nuevos.
- Fase 3 (Escuela Dominical / Misión Infantil y Damas/Dorcas, con ficha
	individual completa y consolidado distrital) — el trabajo más grande,
	al nivel de esfuerzo de Misión Juvenil.
