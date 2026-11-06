-- SIGAP - Diagnostico de solo lectura: estas 4 personas, tienen algun
-- rol en OTRA congregacion o a otro nivel (distrital/nacional), no
-- solo el local de Puerto Tejada? No borra nada.

select p.nombres, p.apellidos, r.nivel, r.congregacion_id, c.nombre as congregacion, r.distrito_id, r.fecha_fin
from roles_sistema r
join personas p on p.id = r.persona_id
left join congregaciones c on c.id = r.congregacion_id
where r.persona_id in (
  'bd1747fc-5d73-47d1-8e0d-bc45ec09ddea',
  '9387b3b4-929c-4e89-91f9-82ec7c09699e',
  '2c622693-efa1-40b9-a207-4d67a9c4a217',
  '86eccab6-cd99-45cb-842f-6019d83fa0ec'
)
order by p.nombres, r.fecha_fin nulls first;
