-- SIGA - Campo de genero en el censo, para poder armar la piramide
-- poblacional (edad x genero) en Feligresia.
-- Ejecutar despues de schema.sql. Es repetible.
--
-- Problema que resuelve: el censo ya tenia edad (fecha_nacimiento) pero
-- ningun campo de genero, asi que no se podia construir una piramide
-- poblacional real (solo el grafico de rangos de edad, sin desglose).
-- No es obligatorio (nullable) porque las personas ya registradas no
-- tienen este dato retroactivamente.

alter table personas add column if not exists genero text check (genero in ('masculino', 'femenino'));
