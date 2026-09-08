# Humanizar datos técnicos crudos mostrados al usuario final — 2026-09-08

## Contexto

A raíz del hallazgo original en "Historial reciente" de Feligresía
(ver `docs/fixes/humanizar-historial-comites-2026-09-08.md`), se pidió
revisar el resto de la app por el mismo tipo de problema: datos crudos
de base de datos (nombres de tabla, acciones SQL, UUIDs, valores
`snake_case`) mostrados directamente a un pastor sin traducir.

Se investigó con un agente dedicado y se encontraron 8 casos, ordenados
de más a menos importante. Se corrigieron los 7 primeros; el 8vo se
deja pendiente aparte por ser una iniciativa mucho más grande.

## Construido

1. **`src/pages/Perfil.jsx`** (pantalla que visita cualquier usuario) --
   los "Permisos asignados" mostraban `role.nivel` crudo
   (`super_admin`, `distrital`, etc.). Ahora usa `NIVEL_LABEL` y
   `describirAlcance()` de `RoleChooser.jsx` (ya existían, correctos,
   solo no se usaban aquí -- se exportó `NIVEL_LABEL`, antes privado).

2. **`src/pages/AuditoriaFeligresia.jsx`** (pantalla de auditoría
   completa, local pastor/distrital/nacional) -- dos problemas:
   - La columna "Usuario" mostraba un fragmento de UUID
     (`a3f9c1e2...`). Ahora resuelve el `usuario_id` contra `personas`
     (por `auth_user_id`, solo de los usuarios que aparecen en la
     página actual, sin filtrar por congregación ya que esta pantalla
     puede cruzar varias) y muestra el nombre real, o "Cambio
     automático del sistema" / "Otro usuario" según corresponda.
   - "Ver cambios" mostraba el JSON crudo completo. Nuevo componente
     `DetalleCambioAuditoria`: en una edición, muestra solo los campos
     que de verdad cambiaron ("Fecha de bautismo: — → 2012-06-12"),
     con las claves traducidas vía un nuevo `COLUMN_LABELS` (~25
     columnas comunes); el JSON crudo completo queda disponible detrás
     de un botón "Ver dato técnico completo", ya no es lo primero que
     se ve.

3. **`src/pages/FeligresiaAdmin.jsx`** (`PastoralFollowupPanel`, ficha
   de seguimiento pastoral, uso diario) -- `item.tipo_alerta` se
   mostraba crudo (ej. `asistencia_persona`); ya existía
   `ALERT_TYPE_LABELS` en el mismo archivo, solo faltaba usarlo aquí.

4. **`src/pages/MisionJuvenil.jsx`** (tabla "Instituciones
   impactadas") -- `institution.nivel`/`.tipo` crudos
   (`bachillerato`/`publica`); el formulario de alta ya tenía las
   etiquetas bonitas, la tabla nunca las reutilizaba. Nuevos
   `NIVEL_INSTITUCION_LABELS`/`TIPO_INSTITUCION_LABELS`.

5. **`src/pages/Amigos.jsx`** (`FriendStageHistory`, ficha de cada
   amigo) -- mostraba el UUID completo de `usuario_id`, sin truncar ni
   resolver. Mismo patrón que el punto 2: nueva consulta a `personas`
   (`auth_user_id, nombres, apellidos`) scoped a la congregación,
   resuelta a nombre real o "Cambio automático del sistema"/"Otro
   usuario".

6. **`src/pages/EstacionRefam.jsx`** -- `item.estado` crudo
   (`activo`/`completado`/`retirado`) en la lista de participantes;
   nuevo `REFAM_ESTADO_LABELS`, mismo patrón que `EstacionUnoMas.jsx`.

7. **`src/pages/ObraSocial.jsx`** -- el selector "Vincular caso de Red
   de Familias" mostraba `item.estado` crudo; nuevo
   `CASO_RED_FAMILIAS_ESTADO_LABELS` (duplicado a propósito de
   `CASE_STATES` en `RedFamilias.jsx`, porque este archivo trae los
   casos por separado).

## Verificación

`npm run build` sin errores. Verificado contra la base real: la
resolución `auth_user_id → nombre` funciona (probado con la cuenta de
prueba, que sí tiene persona vinculada), la consulta `.in()` con
IDs mixtos (real + inexistente) devuelve solo la coincidencia real, el
`select` ampliado con `auth_user_id` en `FeligresiaAdmin.jsx` no rompe
RLS, y una muestra real de `auditoria_feligresia` confirma que el
detalle de cambios (antes/después) identifica correctamente solo los
campos que cambiaron.

## Pendiente (punto 8 del hallazgo original, fuera de esta pieza)

Mensajes de error que exponen `error.message` crudo de
Postgres/Supabase, repetido en **más de 20 archivos**. No es tan grave
(solo se ve cuando algo falla, no en el flujo normal) pero es
sistémico. Requiere un helper central (`mensajeErrorAmigable(error,
contexto)`) que traduzca los códigos Postgres más comunes (`23505`
duplicado, `23503` referencia inválida, `42501` sin permiso) y solo
caiga al mensaje crudo como último recurso -- se deja para una pieza
aparte, dado el tamaño.
