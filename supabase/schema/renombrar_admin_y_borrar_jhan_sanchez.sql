-- SIGAP - Puerto Tejada: renombrar la ficha de super_admin para que
-- no se vea como una cuenta de sistema en el censo, y borrar por
-- completo la ficha de prueba de Jhan Sanchez (pueba691@gmail.com).
--
-- Confirmado: Jhan Sanchez ya no tiene nada mas que su rol local (los
-- 2 seguimientos pastorales que tenia ya se borraron con
-- limpiar_accesos_prueba_puerto_tejada.sql) -- borrar su ficha no deja
-- a nadie sin acceso (es la unica cosa que depende de esa persona).
--
-- Renombrar la ficha de super_admin es solo cosmetico: no toca
-- roles_sistema ni auth_user_id, asi que su acceso de super_admin
-- sigue exactamente igual.

begin;

-- Solo renombra -- no toca el rol ni el acceso.
update personas
set nombres = 'Jhan Carlos', apellidos = 'Sanchez Banguero'
where id = '2e1b6cf8-09f5-41da-ac1e-cb92310a60eb';

-- Borra por completo a Jhan Sanchez (pueba691@gmail.com).
delete from roles_sistema where persona_id = '2c622693-efa1-40b9-a207-4d67a9c4a217';
delete from seguimientos_pastorales where persona_id = '2c622693-efa1-40b9-a207-4d67a9c4a217';
delete from personas where id = '2c622693-efa1-40b9-a207-4d67a9c4a217';

commit;

-- Nota: pueba691@gmail.com queda sin ningun rol asignado -- sigue
-- existiendo como cuenta de Authentication, pero ya no sirve para
-- entrar a SIGAP con ningun acceso. Si en el futuro hace falta una
-- cuenta de prueba, se usa la demo publica (/demo) ya existente.

-- Verificacion sugerida (correr aparte, de solo lectura):
-- select p.nombres, p.apellidos, r.nivel from roles_sistema r join personas p on p.id = r.persona_id where r.congregacion_id = 'a9420cae-cacd-4484-875f-f54548f9f639' and r.fecha_fin is null;
-- Deberia devolver solo 2 filas: Jhan Carlos Sanchez Banguero (super_admin) y Damil Lerma (pastor).
