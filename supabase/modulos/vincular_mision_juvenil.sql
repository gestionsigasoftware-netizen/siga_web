-- SIGA - Vincula a Mision Juvenil con la Ruta Evangelistica / Feligresia,
-- igual que ya se hizo con Obra Carcelaria (reinsercion_ruta_evangelistica.sql).
--
-- Un estudiante de Mision Juvenil (mision_estudiantes) vivia solo en su
-- propia tabla, sin ningun enlace a amigos/ruta_procesos ni, eventualmente,
-- a personas (feligresia). Se agrega una sola columna de trazabilidad; el
-- resto (crear el amigo, moverlo a BIS o marcarlo bautizado) lo hace el
-- frontend reutilizando iniciarOMoverEstacion(), sin mecanismos nuevos.

alter table amigos add column if not exists mision_juvenil_estudiante_id uuid references mision_estudiantes(id) on delete set null;

create index if not exists amigos_mision_juvenil_estudiante_idx on amigos (mision_juvenil_estudiante_id) where mision_juvenil_estudiante_id is not null;
