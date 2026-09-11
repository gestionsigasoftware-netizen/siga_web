-- SIGA - Conquistadores Pentecostales pasa del patron "solo servidores ya
-- bautizados" (persona_id obligatorio) al mismo patron que ya usan
-- Mision Juvenil / Escuela Dominical / Damas Dorcas / Obra Carcelaria:
-- censo propio (nombre directo, sin depender de `personas`), con
-- bautizado/sellado propios, y persona_id como enlace OPCIONAL para
-- cuando la persona ya esta en Feligresia.
--
-- Motivo (decision del usuario, 2026-09-11): en la IPUC hay dos tipos de
-- comite. Los que administran poblacion (Escuela Dominical, Jovenes/
-- Conquistadores, Damas Dorcas, Caballeros, DEFAM) dan seguimiento a
-- convertidos Y no convertidos -- son el punto de entrada real cuando
-- alguien nuevo llega a esa franja de edad/genero. Los de servicio local
-- (Ujieres, Musica, Artistica, Teologica) solo administran servidores ya
-- bautizados -- esos NO cambian. Conquistadores (jovenes adultos 18-40)
-- es del primer tipo, pero se habia construido como si fuera del
-- segundo -- este es el arreglo.
--
-- Ejecutar despues de conquistadores_obra_social.sql. Repetible.

-- 1) Censo propio: nombre directo + bautizado/sellado, igual que
-- mision_estudiantes/escuela_dominical_ninos/damas_dorcas_beneficiarias.
alter table conquistadores_miembros add column if not exists nombres text;
alter table conquistadores_miembros add column if not exists apellidos text;
alter table conquistadores_miembros add column if not exists telefono text;
alter table conquistadores_miembros add column if not exists bautizado boolean not null default false;
alter table conquistadores_miembros add column if not exists fecha_bautismo date;
alter table conquistadores_miembros add column if not exists sellado boolean not null default false;
alter table conquistadores_miembros add column if not exists fecha_sellado date;

-- Los miembros que ya existen hoy SIEMPRE tienen persona_id (era
-- obligatorio) -- se rellenan sus datos desde personas antes de que
-- nombres/apellidos pasen a ser obligatorios.
update conquistadores_miembros cm
set nombres = p.nombres,
    apellidos = p.apellidos,
    bautizado = p.bautizado,
    fecha_bautismo = p.fecha_bautismo,
    sellado = p.sellado_espiritu_santo,
    fecha_sellado = p.fecha_sellado
from personas p
where cm.persona_id = p.id and cm.nombres is null;

alter table conquistadores_miembros alter column persona_id drop not null;
alter table conquistadores_miembros alter column nombres set not null;
alter table conquistadores_miembros alter column apellidos set not null;

-- 2) Enlace para "Vincular a la Ruta Evangelistica" (mismo patron que
-- amigos.mision_juvenil_estudiante_id / amigos.obra_carcelaria_interno_id).
alter table amigos add column if not exists conquistadores_miembro_id uuid references conquistadores_miembros(id) on delete set null;
