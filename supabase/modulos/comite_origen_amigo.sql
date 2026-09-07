-- SIGA - Comite de origen/seguimiento de un amigo (conversion intramural).
--
-- Hasta ahora, alguien que entregaba su vida en un culto normal (no via
-- un modulo extramural aislado como Mision Juvenil u Obra Carcelaria)
-- quedaba registrado como "amigo" sin ningun comite visible desde el
-- primer momento -- el comite solo aparecia hasta que la persona
-- llegaba a REFAM/ESFOB/Discipulado (responsable_comite_id en
-- ruta_procesos). El usuario senalo que esto hace que se pierda gente:
-- en la practica se sigue anotando en papel en vez de en el sistema.
-- Esta columna deja constancia, desde el dia uno, de que comite lo
-- recibio y le hara seguimiento -- sin reemplazar el responsable
-- individual de Uno Mas/BIS ni el responsable-comite de las estaciones
-- siguientes, que siguen funcionando igual.

alter table amigos add column if not exists comite_origen_id uuid references comites(id) on delete set null;

create index if not exists amigos_comite_origen_idx on amigos (comite_origen_id) where comite_origen_id is not null;
