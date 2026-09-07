-- SIGA - Permite que CUALQUIER cargo activo (no solo pastores via
-- roles_sistema) pueda leer los comites de su propia congregacion y
-- registrar un amigo nuevo sin necesitar una zona asignada.
--
-- Necesario para habilitar "Registrar amigo nuevo" desde la PWA para
-- Ujieres (intramural: recibe/ubica personas en el salon de
-- predicacion, no administra poblacion por zona) -- hasta ahora esa
-- pantalla solo funcionaba para cargos con zona (Evangelismo, Mision
-- Juvenil), porque la RLS de `amigos` exige tengo_acceso_zona(zona_id)
-- y esa funcion nunca es verdadera con zona_id null. Lo mismo aplica
-- para leer `comites` (necesario para el selector opcional "comite
-- que lo recibio"), que hoy solo pueden leer los pastores.
--
-- Deliberadamente NO se tocan las politicas existentes
-- (amigos_write, comites_read) -- se agregan politicas NUEVAS y mas
-- estrechas (insert-only en amigos, select-only en comites) para no
-- ampliar de mas lo que un cargo puede leer/editar.

create or replace function tengo_cargo_activo_congregacion(p_congregacion_id uuid) returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from asignaciones_cargo ac
    join cargos c on c.id = ac.cargo_id
    join modulos m on m.id = c.modulo_id
    where ac.persona_id = mi_persona_id()
      and ac.fecha_fin is null
      and m.congregacion_id = p_congregacion_id
  );
$$;

drop policy if exists "amigos_insert_cargo" on amigos;
create policy "amigos_insert_cargo" on amigos for insert
with check (tengo_cargo_activo_congregacion(congregacion_id));

drop policy if exists "comites_read_cargo" on comites;
create policy "comites_read_cargo" on comites for select to authenticated
using (tengo_cargo_activo_congregacion(congregacion_id));
