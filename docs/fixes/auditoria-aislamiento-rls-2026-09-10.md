# Auditoría de aislamiento entre congregaciones — RLS (2026-09-10)

El usuario pidió una prueba controlada de aislamiento entre
congregaciones antes de arrancar con clientes reales de la IPUC. Como
paso previo (mientras se resolvía un bloqueo del correo de invitación
que impedía crear una segunda identidad de prueba real), se hizo una
auditoría estática de las 235 políticas RLS del proyecto (38 archivos
SQL) para descartar huecos antes de la prueba en vivo.

## Metodología

Un agente de exploración escaneó cada `create policy` del proyecto
buscando cualquiera que no filtrara correctamente por
congregación/distrito (usando `mis_congregaciones()`, `mis_distritos()`,
`tiene_permiso()`, `es_lider_distrital()`, `es_nacional()`/
`es_super_admin()`, o un join válido a alguno de estos). Cada hallazgo
reportado como "confirmado" se verificó de forma independiente leyendo
el archivo real antes de aceptarlo o corregirlo — ninguno se tomó por
buena fe del agente.

## Hallazgos confirmados y corregidos

1. **`rotar_asignacion_cargo()` sin ningún control de permiso**
   (`supabase/schema/schema.sql:133`). Es `security definer` (bypasea
   RLS de `asignaciones_cargo`) pero no validaba nada adentro, y nunca
   se le revocó el `EXECUTE` por defecto a `PUBLIC` -- a diferencia de
   cada otra función privilegiada del proyecto. Cualquier cuenta
   autenticada podía llamarla con un `cargo_id` de OTRA congregación y
   reescribir su asignación operativa, sin pasar por ninguna política.
   Confirmado que no se usa desde ningún frontend (web ni PWA) --
   riesgo real igual, expuesto directo vía la API REST de Supabase.
   **Corregido**: `supabase/schema/fix_rotar_asignacion_cargo_sin_permiso.sql`
   (exige la misma condición que ya exige la política RLS directa sobre
   `asignaciones_cargo`, y revoca `public`/`anon`).
2. **Auto-aprobación en SEPRI** (`supabase/modulos/sepri.sql:91`). La
   política de UPDATE tenía `with check (true)` -- el `using` exigía
   `estado = 'pendiente'` para que el creador editara su propia
   solicitud, pero nada impedía que, en esa misma edición, cambiara el
   `estado` a `'aprobado'` él mismo, saltándose la aprobación distrital
   que es la razón de ser de SEPRI. **Corregido**:
   `supabase/modulos/fix_sepri_autoaprobacion.sql` (política separada
   para el creador, que exige que el resultado siga en `'pendiente'`; y
   bloqueo a nivel de columna para que nadie pueda reescribir
   `congregacion_id`/`distrito_id` después de creada la solicitud).
3. **Reescritura de tenant en Solicitudes internas**
   (`supabase/soporte/solicitudes_jerarquicas.sql:74`). Mismo patrón:
   `with check (true)` permitía, a quien pudiera tocar un ticket,
   reescribir `congregacion_id`/`distrito_id`/`nivel_origen`/
   `nivel_destino`/`creado_por` -- reetiquetando un ticket hacia otro
   tenant, donde se volvería visible para usuarios de esa otra
   congregación/distrito. **Corregido**:
   `supabase/soporte/fix_solicitudes_reescritura_tenant.sql` (el
   `with check` ahora repite el mismo alcance que el `using`, más
   bloqueo a nivel de columna de los campos de identidad).
4. **`obra_carcelaria_reinsercion_insert` confiaba en `distrito_id` sin
   verificar** (`supabase/modulos/obra_carcelaria.sql:293`) que
   `congregacion_origen_id` de verdad perteneciera a ese distrito.
   Impacto limitado (exige ya tener una cuenta distrital legítima) pero
   se cerró por defensa en profundidad, ya que el flujo real
   (`asignar_reinsercion()`, que sí valida esto y es `security definer`
   con su propio revoke) queda intacto. **Corregido**:
   `supabase/modulos/fix_reinsercion_distrito_no_verificado.sql`.
5. **7 funciones usadas dentro de políticas RLS sin `search_path`
   fijo** (`tengo_cargo_activo_congregacion`, `tengo_cargo_activo`,
   `tengo_cargo_en_modulo_congregacion`, `tengo_cargo_obra_carcelaria`,
   `mis_congregaciones_via_cargo`, `mis_distritos_via_cargo`,
   `tengo_este_cargo`) -- a diferencia del set base
   (`tiene_permiso`/`mis_congregaciones`/etc.) que sí se endureció en
   `seguridad_produccion.sql`, estas 7 se agregaron después y nunca
   recibieron el mismo tratamiento. **Corregido**:
   `supabase/pwa/fix_search_path_funciones_cargo.sql`.

## Revisado, sin cambios necesarios

- `distritos_select_authenticated` (`using (true)`): confirmado que la
  tabla solo tiene `id`/`nombre`/`created_at` -- sin datos sensibles,
  necesario para selectores de distrito. Está bien como está.
- `congregaciones_insert_self_register` (`with check (true)`, la
  política original que permitía crear una congregación libremente):
  confirmado que `supabase/schema/migracion_produccion.sql` la elimina
  (`drop policy if exists ...`) y ninguna migración posterior la vuelve
  a crear. Segura, **siempre que `migracion_produccion.sql` ya se haya
  ejecutado en el proyecto real** (todo indica que sí, dado que el
  resto de políticas endurecidas de ese mismo archivo ya estaban
  activas al probar otras piezas de la app en sesiones anteriores).

## Todo lo demás: sin huecos

El resto de las 235 políticas (todas las tablas de
`modulos/`, `distrital/`, `pwa/`, `catalogos/` -- feligresía,
evangelismo, ruta evangelística y sus 5 estaciones, escuela dominical/
damas dorcas, conquistadores/obra social, obra carcelaria, música/
artística/teológica, red de familias, SEPRI (fuera del punto 2), gestión
pastoral distrital, licencias, formación, traslados, suscripciones,
hitos espirituales, notas de lección) usa consistentemente
`congregacion_id in (select mis_congregaciones())`, un join válido a un
padre con esa condición, `tiene_permiso(...)`,
`es_lider_distrital(distrito_id)`, o `es_nacional()`/`es_super_admin()`,
con `with check` correspondiente en cada política de escritura.

## Qué falta todavía

Esta auditoría es estática (lectura de las políticas), no reemplaza la
prueba en vivo con dos identidades reales y JWT separados que pide
`docs/arquitectura/matriz-pruebas-rls.md` -- esa prueba sigue pendiente,
bloqueada temporalmente porque crear una segunda identidad de prueba
requiere completar una invitación por correo, y el envío de correo de
confirmación falló al probarlo en esta sesión (ver
`docs/pendientes.md`, sección de seguridad). En cuanto ese bloqueo se
resuelva, retomar con la matriz completa.

**Acción requerida del usuario**: ejecutar los 5 archivos `fix_*.sql`
nuevos listados arriba en el SQL Editor (orden entre ellos no importa,
son independientes entre sí; cada uno depende solo del archivo que ya
existía para ese mismo módulo).
