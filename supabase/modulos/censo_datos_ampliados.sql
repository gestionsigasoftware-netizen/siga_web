-- SIGAP - Campos rápidos del censo pedidos por el usuario: documento de
-- identidad, nivel educativo, ocupación, contacto ampliado (tipo de
-- teléfono, WhatsApp, teléfono alterno, red social) y lugar/oficiante del
-- bautismo. "Cantidad de hijos" NO se agrega como columna -- se calcula
-- en el frontend contando familia_miembros con parentesco hijo/hija
-- dentro de la misma familia, para no duplicar un dato que ya existe y
-- que se desactualizaría si se guardara aparte.

-- personas (censo de creyentes)
alter table personas add column if not exists tipo_documento text
  check (tipo_documento in ('cedula_ciudadania', 'tarjeta_identidad', 'cedula_extranjeria', 'pasaporte', 'registro_civil', 'otro'));
alter table personas add column if not exists numero_documento text;
alter table personas add column if not exists nivel_educativo text
  check (nivel_educativo in ('ninguno', 'primaria_incompleta', 'primaria_completa', 'secundaria_incompleta', 'secundaria_completa', 'tecnico', 'tecnologo', 'universitario_incompleto', 'universitario_completo', 'posgrado'));
alter table personas add column if not exists ocupacion text;
alter table personas add column if not exists telefono_tipo text check (telefono_tipo in ('celular', 'fijo', 'ambos'));
alter table personas add column if not exists tiene_whatsapp boolean not null default false;
alter table personas add column if not exists telefono_alterno text;
alter table personas add column if not exists red_social text;
alter table personas add column if not exists pais_bautismo text;
alter table personas add column if not exists municipio_bautismo text;
alter table personas add column if not exists congregacion_bautismo_id uuid references congregaciones(id) on delete set null;
alter table personas add column if not exists congregacion_bautismo_nombre text;
alter table personas add column if not exists pastor_bautizo text;

comment on column personas.congregacion_bautismo_id is 'Congregación donde se bautizó, si existe en el sistema. Si no aparece en el listado, se usa congregacion_bautismo_nombre (texto manual) en su lugar.';
comment on column personas.pastor_bautizo is 'Nombre del pastor que ofició el bautismo -- texto libre, no un pastor_id, porque puede no existir en el sistema (bautismo antiguo, en otra congregación o país).';

-- amigos (simpatizantes / ruta evangelística) -- el usuario pidió
-- explícitamente que el contacto ampliado aplique también aquí, no solo
-- al censo de creyentes.
alter table amigos add column if not exists telefono_tipo text check (telefono_tipo in ('celular', 'fijo', 'ambos'));
alter table amigos add column if not exists tiene_whatsapp boolean not null default false;
alter table amigos add column if not exists telefono_alterno text;
alter table amigos add column if not exists red_social text;
