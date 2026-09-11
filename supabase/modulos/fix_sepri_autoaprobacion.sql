-- SIGA - Corrige un hueco real de seguridad encontrado en la auditoria de
-- aislamiento entre congregaciones (2026-09-10): la politica
-- sepri_solicitudes_update tenia `with check (true)` -- el `using`
-- exigia `estado = 'pendiente'` para que el creador pudiera editar su
-- propia solicitud, pero al no repetir esa condicion en el `with check`,
-- nada impedia que el creador cambiara el `estado` el mismo a 'aprobado'
-- o 'rechazado' via una peticion directa a la API, saltandose por
-- completo la aprobacion distrital que es la razon de ser de SEPRI.
--
-- Se separa en dos politicas: el creador solo puede seguir editando
-- mientras el resultado siga en 'pendiente' (no puede el mismo mover el
-- estado); el distrital de ese distrito (o nacional/super_admin) sigue
-- pudiendo aprobar/rechazar sin restriccion de estado, que es su rol.
-- Ejecutar despues de sepri.sql. Es repetible.

drop policy if exists sepri_solicitudes_update on sepri_solicitudes_evento;

create policy sepri_solicitudes_update_creador on sepri_solicitudes_evento
for update to authenticated
using (creado_por = auth.uid() and estado = 'pendiente')
with check (creado_por = auth.uid() and estado = 'pendiente');

create policy sepri_solicitudes_update_distrital on sepri_solicitudes_evento
for update to authenticated
using (distrito_id in (select mis_distritos()) or es_nacional() or es_super_admin())
with check (distrito_id in (select mis_distritos()) or es_nacional() or es_super_admin());

-- Ademas, ni el creador ni el distrital deberian poder reescribir a que
-- congregacion/distrito pertenece una solicitud ya creada (evita
-- reasignar o esconder una solicitud cambiandola de tenant despues de
-- creada) -- solo el INSERT original (o una operacion de servidor) fija
-- esos dos campos.
revoke update (congregacion_id, distrito_id) on sepri_solicitudes_evento from authenticated;
