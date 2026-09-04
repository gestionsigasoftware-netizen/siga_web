-- SIGA - asignaciones_cargo ya tenia zona_id (para Evangelismo/Mision
-- Juvenil) pero no un equivalente para Obra Carcelaria. Se agrega
-- centro_id para poder asignar a quien recibe la responsabilidad
-- operativa de Obra Carcelaria a un centro de reclusion especifico,
-- igual que zona_id ya hace para las otras dos.
--
-- Repetible.

alter table asignaciones_cargo add column if not exists centro_id uuid references centros_reclusion(id) on delete set null;

create index if not exists asignaciones_cargo_centro_idx on asignaciones_cargo (centro_id);
