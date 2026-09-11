# "column reference congregacion_id is ambiguous" al crear congregación (2026-09-10)

Reportado en producción real por el usuario, en medio de estar dando de
alta un cliente real de la IPUC: al hacer clic en "Crear congregación e
invitar pastor" desde Pastoral Distrital, no pasaba nada visible; la
consola mostraba `400 Bad Request` en
`rpc/crear_congregacion_con_pastor`, y el mensaje real en pantalla era
`No se pudo crear la congregación: column reference "congregacion_id"
is ambiguous`.

## Causa

`crear_congregacion_con_pastor` (versión con `p_catalogo_id`, en
`supabase/catalogos/catalogo_congregaciones_ipuc.sql`) declara
`returns table (congregacion_id uuid, persona_id uuid)` -- eso
convierte `congregacion_id` en un parámetro de salida de la función.
Dentro del cuerpo, cuando se elige una sugerencia del catálogo oficial
(`p_catalogo_id is not null`), hay un UPDATE a
`catalogo_congregaciones_ipuc` (tabla que TAMBIÉN tiene su propia
columna `congregacion_id`) que referenciaba esa columna sin calificar:

```sql
update catalogo_congregaciones_ipuc
set congregacion_id = v_congregacion_id
where id = p_catalogo_id and distrito_numero = v_distrito_numero and congregacion_id is null;
```

Postgres no puede decidir si `congregacion_id` es el parámetro de
salida de la función o la columna de la tabla, y por defecto (regla
`#variable_conflict error` de PL/pgSQL) rechaza la llamada en vez de
adivinar. **Solo se disparaba al elegir una sugerencia del catálogo
oficial** -- por eso no se detectó en pruebas anteriores (que
probablemente escribieron el nombre libremente).

## Hallazgo relacionado (no es la causa de este bug, pero vale la pena anotarlo)

Existen **3 versiones históricas** de `crear_congregacion_con_pastor`
con distinta cantidad de parámetros (`gestion_distrital_congregaciones.sql`
5 params, `gestion_pastoral_distrital_v2.sql` 6 params,
`catalogo_congregaciones_ipuc.sql` 7 params). En Postgres,
`create or replace function` con una lista de parámetros DISTINTA no
reemplaza la función anterior -- crea una sobrecarga nueva. Si las 3 se
ejecutaron con el tiempo (lo más probable, siguiendo el orden de
construcción de cada feature), las 3 conviven hoy en la base real.
PostgREST resolvió correctamente la de 7 parámetros en este caso (el
error confirma que sí llegó a ejecutarse), así que esto NO causó el
bug reportado -- pero tener 3 sobrecargas de la misma función de
negocio conviviendo es un riesgo latente. **Recomendado, no urgente**:
en una sesión futura, hacer `drop function` explícito de las 2
versiones viejas (firmas de 5 y 6 parámetros) para dejar una sola.

## Corrección

`supabase/catalogos/fix_ambiguedad_congregacion_id_catalogo.sql` --
mismo cuerpo de función, con `#variable_conflict use_column` agregado
(le dice a PL/pgSQL que use siempre la columna de la tabla ante esta
ambigüedad puntual, que es el comportamiento correcto y esperado aquí).
Se revisó el resto del cuerpo de la función confirmando que ningún otro
punto se ve afectado por el cambio (los demás usos de `congregacion_id`
son listas de columnas de INSERT, donde no aplica ambigüedad). También
se revisó `registrar_pastor_con_acceso` (la función hermana para
asignar pastor a una congregación ya existente) -- no tiene el mismo
problema, no necesita cambios.

## Verificación

No se pudo reproducir en esta sesión con clics reales (la cuenta de
prueba solo tiene rol local, no distrital, en la base real) -- se
corrigió revisando cada línea del cuerpo de la función, confirmando que
`#variable_conflict use_column` resuelve exactamente el punto
reportado sin alterar ningún otro comportamiento. **Confirmado
resuelto por el usuario en producción real** (2026-09-10): tras
ejecutar el fix, creó una congregación nueva eligiendo una sugerencia
del catálogo oficial de la IPUC sin error.

**Acción ya ejecutada por el usuario**: corrió
`supabase/catalogos/fix_ambiguedad_congregacion_id_catalogo.sql` en el
SQL Editor y reintentar crear la congregación real que estaba
registrando.
