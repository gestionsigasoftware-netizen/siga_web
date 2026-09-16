-- SIGAP - Matrimonio (vínculo real a otra persona del censo, no solo la
-- etiqueta estado_civil='casado') y defunción (fecha + notas, para poder
-- generar el certificado de defunción y saber desde cuándo alguien falta).
--
-- conyuge_id es intencionalmente simétrico: si A.conyuge_id = B, siempre
-- debe cumplirse B.conyuge_id = A. Esa simetría la mantiene el frontend
-- (dos updates explícitos, ver vincularConyuge/desvincularConyuge en
-- FeligresiaAdmin.jsx), no un trigger -- un trigger bidireccional sobre la
-- misma tabla con updates anidados es una fuente clásica de bugs de
-- recursión en Postgres, y aquí el único punto de escritura real es esa
-- pantalla, así que mantenerlo en la aplicación es más simple y más fácil
-- de depurar.
alter table personas add column if not exists conyuge_id uuid references personas(id) on delete set null;
alter table personas add column if not exists fecha_matrimonio date;
alter table personas add column if not exists fecha_fallecimiento date;
alter table personas add column if not exists notas_fallecimiento text;

comment on column personas.conyuge_id is 'Persona del censo con quien está casado/a. Simétrico -- mantenido por la aplicación, no por trigger.';
comment on column personas.fecha_fallecimiento is 'Obligatoria cuando estado_membresia = fallecido (ver "Registrar fallecimiento" en Feligresía). Se usa para el certificado de defunción.';

-- "baja_fallecimiento" no existía en el catálogo de movimientos de
-- membresía -- sin esto, un fallecimiento no quedaba registrado en el
-- historial de movimientos de la persona (a diferencia de traslados,
-- disciplina, exclusión, que sí quedan).
alter table movimientos_membresia drop constraint if exists movimientos_membresia_tipo_check;
alter table movimientos_membresia add constraint movimientos_membresia_tipo_check
  check (tipo in ('alta_bautismo', 'alta_recibimiento', 'baja_traslado', 'baja_disciplina', 'baja_exclusion', 'baja_fallecimiento', 'reactivacion'));
