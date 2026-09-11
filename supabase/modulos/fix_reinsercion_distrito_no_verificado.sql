-- SIGA - Endurecimiento encontrado en la auditoria de aislamiento entre
-- congregaciones (2026-09-10): obra_carcelaria_reinsercion_insert
-- confiaba en la columna `distrito_id` de la fila que se intenta
-- insertar, sin confirmar que `congregacion_origen_id` de verdad
-- pertenezca a ese distrito -- una cuenta distrital ya legitima podia,
-- via un insert directo a la API (no a traves de la funcion
-- asignar_reinsercion(), que si valida esto), declarar `distrito_id`
-- como el propio mientras `congregacion_origen_id` fuera de otro
-- distrito. Impacto limitado (exige una cuenta distrital ya valida) pero
-- se cierra igual por defensa en profundidad.
-- Ejecutar despues de obra_carcelaria.sql. Es repetible.

drop policy if exists obra_carcelaria_reinsercion_insert on obra_carcelaria_reinsercion;
create policy obra_carcelaria_reinsercion_insert on obra_carcelaria_reinsercion for insert to authenticated
with check (
  es_super_admin() or es_nacional()
  or (
    es_lider_distrital(distrito_id)
    and exists (
      select 1 from congregaciones c
      where c.id = obra_carcelaria_reinsercion.congregacion_origen_id
        and c.distrito_id = obra_carcelaria_reinsercion.distrito_id
    )
  )
);
