-- SIGA - Permite que el responsable de un proceso en la Ruta
-- Evangelistica sea un comite de Feligresia, ademas de una persona
-- individual.
--
-- Primera pieza del rediseno acordado con el usuario (2026-09-07):
-- Mision Juvenil y cualquier otro brazo extramural deben poder
-- entregar (hacer un relevo de) su poblacion a los comites locales
-- que le corresponden (Jovenes, Damas Dorcas, Escuela Dominical,
-- Caballeros, etc.), no solo a una persona individual -- porque una
-- vez la persona llega a la congregacion, es el comite completo quien
-- sigue el acompanamiento (visitas a hogares, continuidad), no un
-- solo voluntario. El ejemplo central: alguien que llega a Discipulado
-- deberia poder quedar a cargo del comite de poblacion que le
-- corresponde, no de la persona que hizo el contacto original en
-- Mision Juvenil.
--
-- Diseno: se agrega una columna alterna en vez de modificar
-- responsable_persona_id, para no romper nada de lo ya construido
-- (todo el codigo existente que solo conoce responsable_persona_id
-- sigue funcionando igual). Las dos columnas son mutuamente
-- excluyentes -- un proceso tiene responsable individual O comite,
-- nunca ambos.
--
-- Se agrega en las 3 tablas donde el responsable realmente se
-- muestra y se usa: ruta_procesos (registro maestro de las 5
-- estaciones), esfob_procesos.responsable_persona_id y
-- discipulado_procesos.mentor_persona_id (las fichas propias de esas
-- dos estaciones, que tienen su propia copia del responsable/mentor,
-- independiente de ruta_procesos). REFAM no tiene columna de
-- responsable en refam_participantes -- ya usa solo la de
-- ruta_procesos, asi que no necesita cambio aqui.
--
-- Ejecutar despues de ruta_evangelistica.sql y feligresia.sql.
-- Repetible.

alter table ruta_procesos add column if not exists responsable_comite_id uuid references comites(id) on delete set null;

-- ruta_procesos_responsable_obligatorio.sql (anterior a este rediseno)
-- endurecio responsable_persona_id a NOT NULL, cuando el unico tipo de
-- responsable posible era una persona. Se relaja a nullable de nuevo:
-- ahora una estacion puede exigir comite en vez de persona
-- (TIPO_RESPONSABLE_ESTACION en rutaEvangelistica.js), y al entrar a
-- una estacion de tipo distinto al que traia el proceso, ese
-- responsable incompatible se descarta -- puede quedar sin responsable
-- hasta que se le asigne uno del tipo correcto (igual filosofia que
-- REFAM ya usaba: "un traslado no exige responsable", solo el alta
-- nueva). No se agrega un check "debe haber alguno" -- bloquearia
-- exactamente esa transicion legitima.
alter table ruta_procesos alter column responsable_persona_id drop not null;
-- Limpia el check "debe haber alguno" que una corrida anterior de este
-- mismo archivo agrego por error (bloqueaba la transicion legitima
-- descrita arriba) -- este drop es un no-op si nunca se llego a crear.
alter table ruta_procesos drop constraint if exists ruta_procesos_responsable_alguno;

alter table ruta_procesos drop constraint if exists ruta_procesos_responsable_exclusivo;
alter table ruta_procesos add constraint ruta_procesos_responsable_exclusivo
  check (not (responsable_persona_id is not null and responsable_comite_id is not null));

alter table esfob_procesos add column if not exists responsable_comite_id uuid references comites(id) on delete set null;
alter table esfob_procesos drop constraint if exists esfob_procesos_responsable_exclusivo;
alter table esfob_procesos add constraint esfob_procesos_responsable_exclusivo
  check (not (responsable_persona_id is not null and responsable_comite_id is not null));

alter table discipulado_procesos add column if not exists mentor_comite_id uuid references comites(id) on delete set null;
alter table discipulado_procesos drop constraint if exists discipulado_procesos_mentor_exclusivo;
alter table discipulado_procesos add constraint discipulado_procesos_mentor_exclusivo
  check (not (mentor_persona_id is not null and mentor_comite_id is not null));

create index if not exists ruta_procesos_responsable_comite_idx on ruta_procesos (responsable_comite_id) where responsable_comite_id is not null;
create index if not exists esfob_procesos_responsable_comite_idx on esfob_procesos (responsable_comite_id) where responsable_comite_id is not null;
create index if not exists discipulado_procesos_mentor_comite_idx on discipulado_procesos (mentor_comite_id) where mentor_comite_id is not null;
