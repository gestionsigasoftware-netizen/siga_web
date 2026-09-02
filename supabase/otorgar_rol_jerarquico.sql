-- SIGA - Cierra el vacio de como se otorga acceso a SIGAP en los niveles
-- distrital y nacional. Hasta ahora, "distrital crea congregacion +
-- invita a su primer pastor" ya existia (gestion_distrital_congregaciones.sql,
-- 2026-08-31), pero no habia ningun camino en la app para el escalon
-- siguiente: nacional dando de alta a un nuevo lider distrital, ni
-- super_admin dando de alta a un nuevo lider nacional. Sin esto, la unica
-- forma de crear esos roles era entrando directo a Supabase -- lo mismo
-- que ya se habia identificado como incorrecto para el caso local.
--
-- Solo valida permisos (quien puede otorgar que nivel); el alta real de
-- la cuenta de Auth y el insert en roles_sistema los hace la Edge
-- Function otorgar-acceso-jerarquico, igual que invitar-usuario separa
-- "verificar permiso" (via RPC) de "ejecutar con el service role".

create or replace function puede_otorgar_rol_jerarquico(p_nivel text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when p_nivel = 'nacional' then es_super_admin()
    when p_nivel = 'distrital' then es_super_admin() or es_nacional()
    else false
  end;
$$;

revoke all on function puede_otorgar_rol_jerarquico(text) from public, anon;
grant execute on function puede_otorgar_rol_jerarquico(text) to authenticated;
