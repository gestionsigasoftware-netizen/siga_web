-- SIGAP - Disciplina/suspensión de cargos (item 11 de los 13 pedidos por
-- WhatsApp). Mientras una persona tiene una disciplina activa (sin fecha
-- de restauración), queda bloqueada para asignarse a un cargo o comité
-- nuevo -- decisión explícita del usuario, igual de estricta que el
-- requisito de estar bautizado. Por ahora solo se expone a nivel local
-- (`nivel` queda listo en el esquema para distrital/nacional el día que
-- haya cuenta real de esos roles para probarlo).

create table if not exists disciplinas_pastorales (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas(id) on delete cascade,
  congregacion_id uuid not null references congregaciones(id) on delete cascade,
  nivel text not null default 'local' check (nivel in ('local', 'distrital', 'nacional')),
  motivo text not null,
  fecha_inicio date not null default current_date,
  fecha_fin_prevista date,
  fecha_restauracion date,
  notas_restauracion text,
  usuario_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (fecha_restauracion is null or fecha_restauracion >= fecha_inicio)
);

-- Una persona no puede tener dos disciplinas activas (sin restaurar) a la vez.
create unique index if not exists disciplinas_pastorales_activa_unica
  on disciplinas_pastorales (persona_id) where fecha_restauracion is null;

create table if not exists disciplinas_seguimiento (
  id uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references disciplinas_pastorales(id) on delete cascade,
  nota text not null,
  fecha date not null default current_date,
  usuario_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table disciplinas_pastorales enable row level security;
alter table disciplinas_seguimiento enable row level security;

drop policy if exists disciplinas_pastorales_read on disciplinas_pastorales;
drop policy if exists disciplinas_pastorales_write on disciplinas_pastorales;
create policy disciplinas_pastorales_read on disciplinas_pastorales for select to authenticated
  using (congregacion_id in (select mis_congregaciones()));
create policy disciplinas_pastorales_write on disciplinas_pastorales for all to authenticated
  using (puede_administrar_feligresia(congregacion_id))
  with check (puede_administrar_feligresia(congregacion_id));

drop policy if exists disciplinas_seguimiento_read on disciplinas_seguimiento;
drop policy if exists disciplinas_seguimiento_write on disciplinas_seguimiento;
create policy disciplinas_seguimiento_read on disciplinas_seguimiento for select to authenticated
  using (exists (select 1 from disciplinas_pastorales d where d.id = disciplinas_seguimiento.disciplina_id and d.congregacion_id in (select mis_congregaciones())));
create policy disciplinas_seguimiento_write on disciplinas_seguimiento for all to authenticated
  using (exists (select 1 from disciplinas_pastorales d where d.id = disciplinas_seguimiento.disciplina_id and puede_administrar_feligresia(d.congregacion_id)))
  with check (exists (select 1 from disciplinas_pastorales d where d.id = disciplinas_seguimiento.disciplina_id and puede_administrar_feligresia(d.congregacion_id)));
