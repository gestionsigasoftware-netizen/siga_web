-- SIGAP - Tercera y última pieza de los 13 pedidos por WhatsApp:
-- consentimiento de datos (item 8), composición familiar mixta
-- creyentes+amigos (item 10) y acudiente obligatorio en Escuela
-- Dominical (item 13). Las tres viven en tablas distintas pero
-- comparten el mismo fin: alimentar la analítica de decisión pastoral
-- (cobertura de consentimiento, composición real de las familias,
-- niños sin acudiente) en vez de ser pantallas sueltas de captura.

-- Item 8: consentimiento general de datos, con firma dibujada en
-- pantalla (canvas) en vez de archivo subido a Storage -- decisión del
-- usuario para no depender de infraestructura nueva ni de un
-- dispositivo externo. La firma se guarda como imagen pequeña
-- (data URL base64) directamente en la fila, igual en personas y
-- amigos.
alter table personas add column if not exists consentimiento_datos_firma text;
alter table personas add column if not exists fecha_consentimiento_datos date;
alter table amigos add column if not exists consentimiento_datos_firma text;
alter table amigos add column if not exists fecha_consentimiento_datos date;

comment on column personas.consentimiento_datos_firma is 'Firma dibujada en pantalla (imagen PNG codificada en base64) autorizando el uso de sus datos -- alternativa sin Storage a subir un archivo firmado.';

-- Item 13: acudiente obligatorio en Escuela Dominical, distinguiendo
-- si el niño es hijo de un creyente del censo o de un amigo/
-- simpatizante en ruta evangelística. No se exige un vínculo real a
-- personas/amigos (el acudiente puede no tener su propio registro
-- todavía) -- se exige que el nombre y teléfono del acudiente estén
-- diligenciados, que es lo que "obligatorio" pedía resolver.
alter table escuela_dominical_ninos add column if not exists tipo_familia text
  check (tipo_familia in ('creyente', 'amigo_en_ruta'));

-- Item 10: familias con composición mixta (creyentes + amigos en
-- ruta). Se agrega una tabla nueva en vez de tocar familia_miembros
-- (que ya usan el árbol genealógico y las relaciones familiares de
-- personas) para no arriesgar esa funcionalidad existente.
create table if not exists familia_amigos (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references familias(id) on delete cascade,
  amigo_id uuid not null references amigos(id) on delete cascade,
  parentesco text not null default 'otro'
    check (parentesco in ('conyuge', 'hijo', 'hija', 'nieto', 'nieta', 'otro')),
  created_at timestamptz not null default now(),
  unique (familia_id, amigo_id)
);

alter table familia_amigos enable row level security;
drop policy if exists familia_amigos_read on familia_amigos;
drop policy if exists familia_amigos_write on familia_amigos;
create policy familia_amigos_read on familia_amigos for select to authenticated
  using (exists (select 1 from familias f where f.id = familia_amigos.familia_id and f.congregacion_id in (select mis_congregaciones())));
create policy familia_amigos_write on familia_amigos for all to authenticated
  using (exists (select 1 from familias f where f.id = familia_amigos.familia_id and puede_administrar_feligresia(f.congregacion_id)))
  with check (exists (select 1 from familias f where f.id = familia_amigos.familia_id and puede_administrar_feligresia(f.congregacion_id)));
