-- SIGA - Geolocalizacion de zonas de evangelismo y congregaciones.
-- El usuario pidio poder ver, en mapa, cuantas personas se alcanzan por
-- barrio/zona (Misiones y Evangelismo) y donde quedan las congregaciones
-- (para agruparlas por ciudad a nivel nacional, ej. cuantas hay en Cali).
--
-- No se guardan poligonos de barrio (no existen esos datos oficiales) --
-- se guarda una direccion en texto, y un punto aproximado (lat/lon)
-- obtenido por geocodificacion (Nominatim/OpenStreetMap) desde el
-- frontend al guardar. Las filas sin direccion simplemente no aparecen
-- en el mapa (no se adivina ubicacion).

alter table zonas add column if not exists direccion text;
alter table zonas add column if not exists latitud numeric;
alter table zonas add column if not exists longitud numeric;

alter table congregaciones add column if not exists direccion text;
alter table congregaciones add column if not exists latitud numeric;
alter table congregaciones add column if not exists longitud numeric;
