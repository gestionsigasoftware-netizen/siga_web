-- SIGA - Corrige un hueco real de seguridad encontrado en la auditoria de
-- aislamiento entre congregaciones (2026-09-10): la politica
-- solicitudes_update tenia `with check (true)` -- una vez el `using`
-- dejaba tocar la fila (por ser quien la creo, o estar en el alcance de
-- destino), no habia ninguna restriccion sobre el resultado. Eso permitia
-- reescribir congregacion_id/distrito_id/nivel_origen/nivel_destino/
-- creado_por de una solicitud ya creada -- re-etiquetarla hacia otro
-- tenant, donde se volveria visible para usuarios de esa otra
-- congregacion/distrito via solicitudes_select.
--
-- El `with check` ahora repite el mismo alcance que el `using` (nadie
-- puede "salirse" del alcance que ya tenia al entrar), y ademas se
-- bloquea a nivel de columna la reescritura de los campos de identidad
-- del tenant -- el flujo real (Solicitudes.jsx) solo actualiza `estado` y
-- `actualizado_en` para marcar en proceso/resuelto/cerrado, nunca esos
-- otros campos.
-- Ejecutar despues de solicitudes_jerarquicas.sql. Es repetible.

drop policy if exists solicitudes_update on solicitudes_jerarquicas;

create policy solicitudes_update on solicitudes_jerarquicas
for update to authenticated
using (
  creado_por = auth.uid()
  or (congregacion_id is not null and congregacion_id in (select mis_congregaciones()))
  or (distrito_id is not null and distrito_id in (select mis_distritos()))
  or es_nacional() or es_super_admin()
)
with check (
  creado_por = auth.uid()
  or (congregacion_id is not null and congregacion_id in (select mis_congregaciones()))
  or (distrito_id is not null and distrito_id in (select mis_distritos()))
  or es_nacional() or es_super_admin()
);

revoke update (creado_por, nivel_origen, nivel_destino, congregacion_id, distrito_id) on solicitudes_jerarquicas from authenticated;
