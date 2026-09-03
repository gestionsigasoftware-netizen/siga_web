# Catálogo de congregaciones reales de la IPUC, desde Debora (2026-09-03)

## Contexto

El usuario encontró que `https://debora.fecp.org.co/register` (el
sistema oficial de la IPUC) tiene un formulario público con un combo en
cascada País → Distrito → Congregación, con el censo real y completo de
la IPUC. Pidió que esa base la tuviera SIGAP.

## Extracción

El formulario usa 3 endpoints públicos (GET, sin autenticación) que
llama por AJAX (encontrados en el HTML de la página, no documentados
en ningún otro lado):

- `GET /rnation` → países.
- `GET /rcountries?country_id=1` → distritos de Colombia.
- `GET /rdistritos?district_id=N` → congregaciones de ese distrito.

Se recorrieron los 35 distritos (con una pausa breve entre cada
petición). Resultado: **35 distritos, 5,367 congregaciones**.

Dato importante que salió de aquí: la documentación de SIGAP asumía
**36 distritos** (`gestion_distrital_congregaciones.sql`); el usuario
confirmó que el número correcto es **35** (el de Debora).

## Decisión de diseño: catálogo de referencia, no 5,367 tenants activos

Se le presentaron 3 opciones al usuario (crear las 5,367 como
congregaciones reales / catálogo de referencia / solo comparar). El
usuario describió su propio caso de uso ("que esté precargado y pueda
elegir la congregación de su distrito para activarla"), que corresponde
exactamente a la opción de catálogo de referencia — se le explicó por
qué crear las 5,367 como filas reales en `congregaciones` sería
riesgoso (cada una es un tenant activo que aparece en dashboards,
`/suscripciones`, comités nacionales, etc. — miles de filas vacías para
siempre, sin que esté confirmada la adopción de SIGAP en toda la IPUC).

## Backend

- **`supabase/catalogo_congregaciones_ipuc.sql`** (nuevo): tabla
  `catalogo_congregaciones_ipuc` (`distrito_numero`, `nombre`,
  `id_debora`, `congregacion_id` nullable — se llena cuando se activa).
  RLS: un distrital solo ve el catálogo de su propio distrito (via
  `distritos.numero`); nacional/super_admin ven todo. Es de solo
  lectura desde la app.
- **`crear_congregacion_con_pastor`** (misma función que ya existía
  para el alta de congregaciones): se le agregó un parámetro opcional
  `p_catalogo_id`. Si se pasa, al crear la congregación real también
  liga esa fila del catálogo (`congregacion_id`) para que deje de
  aparecer como pendiente. Se eliminó el overload anterior de 6
  argumentos para no dejar dos versiones de la misma lógica.
- **`supabase/seed_catalogo_congregaciones_ipuc.sql`** (nuevo): el
  `insert` con las 5,367 filas reales extraídas de Debora. Idempotente
  (`on conflict do nothing`).

## Frontend — `src/pages/PastoralDistrital.jsx`

En "Registrar nueva congregación" (la sección donde un distrital da de
alta una congregación con su primer pastor):

- El campo "Nombre de la congregación" ahora es un buscador con
  autocompletado (mismo patrón ya usado en el buscador de persona de
  Equipo de trabajo): al escribir, sugiere nombres de la lista oficial
  de Debora para el propio distrito del usuario, excluyendo las que ya
  se activaron. Si no hay coincidencia, se puede seguir escribiendo
  libre (por si es una congregación nueva que Debora todavía no tiene).
- Un aviso arriba del formulario: "Te faltan X de Y congregaciones
  reales de tu distrito por registrar en SIGAP" — visible solo si el
  distrito tiene catálogo cargado.
- Al elegir una sugerencia y completar el alta, esa fila del catálogo
  queda marcada como activada (vía `p_catalogo_id`) y desaparece de la
  lista de pendientes.

## Verificación

`npm run build` corre limpio.

## Acción requerida del usuario

1. Ejecutar `supabase/catalogo_congregaciones_ipuc.sql`.
2. Ejecutar `supabase/seed_catalogo_congregaciones_ipuc.sql` (carga las
   5,367 filas, es una sola vez).
