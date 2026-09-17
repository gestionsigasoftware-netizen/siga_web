-- SIGAP - Ficha de salud de emergencia (item 5 de los 13 pedidos por
-- WhatsApp). NO es una historia clínica formal ni autoriza a la
-- congregación a diagnosticar, prescribir ni administrar medicamentos --
-- es información de referencia para que quien atienda primero una
-- emergencia en un culto (paramédico, líder, ujier) sepa qué hacer y a
-- quién avisar, en vez de asumir que es un tema espiritual.
--
-- Aplica a personas (censo de creyentes) Y a amigos (simpatizantes ya en
-- seguimiento de la Ruta Evangelística) -- el usuario pidió explícitamente
-- que cubriera a ambos, porque un amigo recurrente en ruta puede sufrir
-- una emergencia igual que un creyente. Un visitante de un solo culto ni
-- siquiera suele tener un registro en `amigos` todavía, así que no hace
-- falta una bandera aparte para excluirlo.
--
-- Dato sensible bajo la Ley 1581 de 2012 (Habeas Data) -- se agrega un
-- consentimiento mínimo (autorizacion_datos_salud + fecha) como control
-- inicial mientras se construye el módulo completo de consentimiento con
-- archivo/firma (pendiente aparte). El frontend no debe guardar ningún
-- campo de salud si esta autorización no está marcada.

alter table personas add column if not exists tipo_sangre text
  check (tipo_sangre in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'));
alter table personas add column if not exists eps_nombre text;
alter table personas add column if not exists condiciones_medicas text;
alter table personas add column if not exists alergias text;
alter table personas add column if not exists medicamentos_actuales text;
alter table personas add column if not exists discapacidad text;
alter table personas add column if not exists embarazada boolean not null default false;
alter table personas add column if not exists fecha_probable_parto date;
alter table personas add column if not exists contacto_emergencia_nombre text;
alter table personas add column if not exists contacto_emergencia_telefono text;
alter table personas add column if not exists contacto_emergencia_parentesco text;
alter table personas add column if not exists autorizacion_datos_salud boolean not null default false;
alter table personas add column if not exists fecha_autorizacion_datos_salud date;

comment on column personas.medicamentos_actuales is 'Medicamentos que la persona toma bajo receta de su propio médico/EPS -- solo de referencia para un primer respondiente (paramédico, EPS). La congregación no medica ni administra nada de esto.';
comment on column personas.autorizacion_datos_salud is 'Consentimiento mínimo para guardar datos de salud (dato sensible, Ley 1581 de 2012). Control inicial mientras se construye el módulo completo de consentimiento con archivo/firma.';

alter table amigos add column if not exists tipo_sangre text
  check (tipo_sangre in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'));
alter table amigos add column if not exists eps_nombre text;
alter table amigos add column if not exists condiciones_medicas text;
alter table amigos add column if not exists alergias text;
alter table amigos add column if not exists medicamentos_actuales text;
alter table amigos add column if not exists discapacidad text;
alter table amigos add column if not exists embarazada boolean not null default false;
alter table amigos add column if not exists fecha_probable_parto date;
alter table amigos add column if not exists contacto_emergencia_nombre text;
alter table amigos add column if not exists contacto_emergencia_telefono text;
alter table amigos add column if not exists contacto_emergencia_parentesco text;
alter table amigos add column if not exists autorizacion_datos_salud boolean not null default false;
alter table amigos add column if not exists fecha_autorizacion_datos_salud date;
