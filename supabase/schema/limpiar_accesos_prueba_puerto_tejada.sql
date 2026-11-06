-- SIGAP - Limpiar accesos de prueba en PUERTO TEJADA CAUCA CENTRAL.
--
-- Confirmado con el usuario, con diagnosticos previos (sin esto no se
-- habria tocado nada): de los 6 roles 'local' activos en esta
-- congregacion real, solo deben quedar 2 -- super_admin
-- (gestionsigasoftware@gmail.com, siempre tiene acceso) y el pastor
-- real Damil Lerma (persona_id 454d7953-fc79-44da-99eb-b88dd3d3896b,
-- todavia sin cuenta de login -- eso se resuelve aparte con una
-- invitacion, ver paso siguiente).
--
-- Se confirmo con un diagnostico de solo lectura que NINGUNA de estas
-- 4 personas tiene rol en otro lado -- borrar su perfil no deja a
-- nadie sin acceso a SIGAP.
--
-- Usuario de Pruebas, Carlos Mina (cuenta personal del usuario) y
-- Natalia Guacha Noriega: se borran por completo (rol + seguimientos
-- + ficha de censo) -- ya contaban como feligreses "activos" reales
-- en las estadisticas de esta congregacion real, sin serlo.
--
-- Jhan Sanchez (pueba691@gmail.com): es la cuenta de prueba que se
-- sigue usando para verificar cambios con Playwright -- se decidio
-- CONSERVAR su rol y su ficha, solo limpiarle los datos que tenia
-- registrados (2 seguimientos pastorales), para que quede "en
-- blanco" lista para seguir usandola.

begin;

-- Los 3 que se borran por completo.
delete from roles_sistema where persona_id in (
  'bd1747fc-5d73-47d1-8e0d-bc45ec09ddea', -- Usuario de Pruebas
  '9387b3b4-929c-4e89-91f9-82ec7c09699e', -- Carlos Mina
  '86eccab6-cd99-45cb-842f-6019d83fa0ec'  -- Natalia Guacha Noriega
);

-- Seguimientos de los 3 que se borran Y de Jhan Sanchez (a el se le
-- limpian los datos pero se le deja el rol y la ficha).
delete from seguimientos_pastorales where persona_id in (
  'bd1747fc-5d73-47d1-8e0d-bc45ec09ddea',
  '9387b3b4-929c-4e89-91f9-82ec7c09699e',
  '86eccab6-cd99-45cb-842f-6019d83fa0ec',
  '2c622693-efa1-40b9-a207-4d67a9c4a217'  -- Jhan Sanchez -- solo esto, no se toca su rol ni su persona
);

-- Las fichas de censo de los 3 que se borran por completo.
delete from personas where id in (
  'bd1747fc-5d73-47d1-8e0d-bc45ec09ddea',
  '9387b3b4-929c-4e89-91f9-82ec7c09699e',
  '86eccab6-cd99-45cb-842f-6019d83fa0ec'
);

commit;

-- IMPORTANTE: esto NO borra las cuentas de Authentication
-- (pruebas@siga.local, ooslo0704@gmail.com, nataliaguacha1@gmail.com)
-- -- quedan sin ningun rol asignado, pero siguen existiendo como
-- login. Si quieres que tambien desaparezcan de Authentication >
-- Users, eso se hace a mano desde el panel de Supabase (SQL no puede
-- tocar esa tabla directamente). ooslo0704@gmail.com es tu propio
-- correo -- al quedar sin rol, ya no te sirve para entrar a SIGAP con
-- ese correo (sigues entrando normal con gestionsigasoftware@gmail.com).

-- Verificacion sugerida (correr aparte, de solo lectura):
-- select p.nombres, p.apellidos, r.nivel from roles_sistema r join personas p on p.id = r.persona_id where r.congregacion_id = 'a9420cae-cacd-4484-875f-f54548f9f639' and r.fecha_fin is null;
-- Deberia devolver solo 3 filas: super admin, Damil Lerma, Jhan Sanchez.
