-- SIGA - "Último contacto" calculado para amigos (ruta evangelística).
--
-- Pedido por un directivo nacional de la IPUC (via el usuario, 2026-09-23):
-- poder detectar a tiempo cuando un amigo (persona no convertida, en la
-- ruta evangelística) deja de tener contacto, igual que ya se hace con
-- feligresía via personas.fecha_ultima_asistencia.
--
-- Deliberadamente NO se agrega una columna nueva en `amigos` para escribir
-- a mano (repetiría la misma falla real que tiene fecha_ultima_asistencia
-- en personas: depende de que alguien se acuerde de teclearla, y en la
-- práctica casi nadie lo hace). En vez de eso, esta vista calcula la fecha
-- de contacto más reciente a partir de las actividades reales que el
-- personal YA registra como parte de su trabajo normal en cada estación de
-- la ruta (nota, visita BIS, lección ESFOB, compromiso de Uno Más, cambio
-- de estación) -- cero trabajo nuevo, solo se empieza a leer lo que ya se
-- guarda.
--
-- Limitación conocida y aceptada: REFAM no aporta a este cálculo. Sus
-- reuniones (`refam_reuniones`) son un conteo grupal de asistentes/
-- visitantes, sin lista de quién exactamente asistió, y su membresía
-- (`refam_participantes`) solo registra `fecha_ingreso` una sola vez al
-- grupo -- igual de "vencido" que fecha_primer_contacto. Un amigo que solo
-- pasa por REFAM sin visitas BIS ni notas puede verse "sin contacto
-- reciente" aunque esté asistiendo a las reuniones semanales. Cerrar esto
-- necesitaría rediseñar cómo REFAM registra asistencia individual -- no es
-- parte de este cambio.
--
-- Ejecutar después de ruta_evangelistica.sql, evangelismo.sql y
-- notas_leccion_ruta_evangelistica.sql. Es repetible.

create or replace view vw_ultimo_contacto_amigos with (security_invoker = true) as
select
  a.id as amigo_id,
  a.congregacion_id,
  greatest(
    a.fecha_primer_contacto,
    (select max(n.created_at)::date from amigos_notas n where n.amigo_id = a.id),
    (select max(ba.fecha_visita) from bis_atenciones ba where ba.amigo_id = a.id),
    (select max(enl.created_at)::date from esfob_notas_leccion enl
       join esfob_procesos ep on ep.id = enl.esfob_proceso_id where ep.amigo_id = a.id),
    (select max(umc.fecha_ultimo_contacto) from uno_mas_compromisos umc where umc.amigo_id = a.id),
    (select max(rp.fecha_inicio) from ruta_procesos rp where rp.amigo_id = a.id)
  ) as ultimo_contacto
from amigos a
where not a.convertido;
