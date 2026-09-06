-- SIGA - Vincula la reinsercion post-penitenciaria (Obra Carcelaria) con
-- la Ruta Evangelistica / Feligresia.
--
-- Hasta ahora, un interno liberado y asignado a una congregacion receptora
-- (obra_carcelaria_reinsercion) no tenia ningun siguiente paso una vez
-- contactado -- no habia forma de conectarlo con amigos/ruta_procesos ni,
-- eventualmente, con personas (feligresia). Se agrega una sola columna de
-- trazabilidad; el resto (crear el amigo, moverlo a BIS o marcarlo
-- bautizado) lo hace el frontend reutilizando iniciarOMoverEstacion() e
-- incorporar_amigo_bautizado(), sin mecanismos nuevos.

alter table amigos add column if not exists obra_carcelaria_interno_id uuid references obra_carcelaria_internos(id) on delete set null;

create index if not exists amigos_obra_carcelaria_interno_idx on amigos (obra_carcelaria_interno_id) where obra_carcelaria_interno_id is not null;
