# Auditoría de paginación en toda la web — 2026-11-08

## Origen

Después de agregar paginación a "Corrección y Contingencia", el
usuario pidió revisar **toda la app** con el mismo criterio: "esta
app web es de mucho dato... donde se almacena información debe haber
paginación porque si no se vuelve con cientos de registros en un
scroll infinito".

## Metodología

Barrido de `.limit(` y `.range(` en todo `src/pages/*.jsx`, triaje de
cada resultado:

- `.limit(1)`, `.limit(15)` en autocompletados/búsquedas: descartados,
  no son listados de registros.
- Consultas para gráficos (`registros_actividad` agregado por fecha,
  series de 180 días): descartadas, no son tablas paginables.
- Candidatos reales: cualquier `.limit(100-200)` que alimentara un
  `.map()` sin control de página, o sin ningún límite en absoluto.

## Hallazgos reales (4) — corregidos

Mismo patrón ya establecido en `Amigos.jsx`/`AuditoriaFeligresia.jsx`:
`.select(..., { count: 'exact' })` + `.range()` + botones
Anterior/Siguiente, página fija (no scroll infinito).

1. **Historial de comités** (`FeligresiaAdmin.jsx`,
   `CommitteeAnalytics`): ya traía hasta 100 cambios pero solo
   mostraba los primeros 12 sin ninguna forma de ver el resto.
   Paginación client-side sobre ese mismo bloque (12 por página).
2. **Solicitudes** (`Solicitudes.jsx`): traía hasta 200 de un tirón,
   filtradas solo por estado en el cliente. Filtro y paginación
   movidos al servidor (20 por página).
3. **Reportes de soporte** — vista "Todos los reportes", solo
   `super_admin` (`Soporte.jsx`): mismo patrón, 20 por página.
4. **Errores del sistema** — solo `super_admin` (`ErroresSistema.jsx`):
   mismo patrón; el filtro "mostrar solo sin revisar" también se
   movió al servidor, con un conteo aparte para el total sin revisar.

## Revisados y descartados (no tenían el problema)

- **Seguimiento pastoral** y **Movimientos de membresía**
  (`FeligresiaAdmin.jsx`): la consulta no tiene límite, pero la UI ya
  usa cajas de scroll interno acotado (`max-h-[...] overflow-y-auto`)
  con "ver historial"/"ver más" — nunca crecen la página completa. No
  se tocaron.
- **Traslados pendientes**: autolimitado por `.eq('estado',
  'pendiente')` — se vacía solo conforme se resuelven.
- **Disciplinas pastorales**: eventos poco frecuentes en la práctica,
  bajo riesgo real.

Commit `c8db0e8`, pusheado.
