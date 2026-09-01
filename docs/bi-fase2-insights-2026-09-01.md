# BI de la IPUC — Fase 2: insights de decisión

Fecha: 1 de septiembre de 2026

## Contexto

Sobre los datos de la Fase 1 (sellados, estudios REFAM individuales,
madurez de sede, movimientos de membresía) y lo que ya existía (Ruta
Evangelística, `amigos`), se construyeron cinco insights en el Dashboard
distrital — sin módulos nuevos, solo lectura interpretada de datos ya
capturados. Cada insight sigue el criterio pedido: no solo el número, una
frase que interprete y empuje a decidir.

## Construido (`supabase/bi_fase2_insights.sql`, nuevo)

`resumen_distrital()` se amplió (hubo que recrearla — `create or replace
function` no permite cambiar la lista de columnas de una función
`returns table`) con: `sellados`, `madurez`, `altas_3m`, `bajas_3m`,
`bautismos_3m`, `estudios_refam_3m`, `funnel_uno_mas`, `funnel_refam`,
`funnel_bautizados`.

En el Dashboard distrital (`DashboardDistrital`, `src/pages/Dashboard.jsx`):

- **Brecha de llenura**: % de bautizados del distrito sin sellar con el
	Espíritu Santo. Sugiere una vigilia/campamento si supera el 30%.
- **Eficacia de REFAM**: estudios entregados por cada bautismo en los
	últimos 3 meses.
- **Embudo Uno Más → REFAM**: cuántos de los que están en Uno Más avanzan a
	REFAM, y cuántos amigos ya se bautizaron en el distrito.
- **Movimiento de membresía**: balance de altas menos bajas en 3 meses,
	alerta si las bajas superan a las altas.
- **Madurez de la obra**: % de congregaciones ya constituidas como Iglesia
	Local, y el desglose completo por nivel.

La tabla comparativa por congregación ganó columnas de Sellados (con aviso
de cuántos faltan por sellar) y Madurez, y una opción más de orden
(bajas en 3 meses).

## Validación ejecutada

- `npm run build`: correcto.
- Playwright con la cuenta de prueba distrital: los 5 insights renderizan
	con datos reales y frases de interpretación coherentes (100% de brecha
	de llenura con 0 sellados de 3 bautizados, balance de membresía +2,
	madurez desglosada 2/0/0). Sin errores de consola.
- Se encontraron y limpiaron datos residuales de pruebas anteriores
	(una congregación y sus movimientos de membresía de prueba) que se
	habían quedado a medias en sesiones previas — ya depurados.

## Pendiente

- Fase 3: Escuela Dominical (Misión Infantil) y Damas/Dorcas, con ficha
	individual completa y consolidado distrital — el trabajo más grande del
	plan BI, al nivel de esfuerzo de Misión Juvenil.
