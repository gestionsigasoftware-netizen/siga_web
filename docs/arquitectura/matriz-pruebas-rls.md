# Matriz de pruebas RLS entre congregaciones

Fecha de preparación: 28 de agosto de 2026

## Objetivo

Comprobar que un usuario con acceso a la congregación A no puede leer ni
modificar información de la congregación B, y viceversa. La prueba debe usar
sesiones Auth reales: ejecutar consultas como propietario o administrador de
la base no prueba RLS porque esos roles pueden omitir las políticas.

## Preparación

1. Crear dos congregaciones de prueba activas, A y B.
2. Crear una persona y un usuario Auth con perfil `consulta` en A.
3. Crear una persona y un usuario Auth con perfil `consulta` en B.
4. Crear al menos un registro marcado o identificable en cada congregación.
5. Aplicar todas las migraciones, incluyendo `seguridad_produccion.sql`,
   `dashboard_analytics.sql` y `reportes_analytics.sql`.
6. Ejecutar las comprobaciones desde la API de Supabase usando el JWT de cada
   usuario o desde dos sesiones separadas de la aplicación.

## Matriz por operación

| Superficie | Usuario A sobre A | Usuario A sobre B | Resultado esperado |
| --- | --- | --- | --- |
| `personas` | SELECT permitido | SELECT sin filas | No hay datos cruzados |
| `familias`, `comites` | SELECT permitido | SELECT sin filas | No hay datos cruzados |
| `amigos` y `amigos_notas` | Solo según rol/zona | Rechazado o sin filas | Privacidad y tenant correctos |
| `registros_actividad` | SELECT permitido | SELECT sin filas | No hay asistencia cruzada |
| `mision_*` | SELECT permitido si tiene permiso | SELECT sin filas | Tenant y permiso correctos |
| `vw_alertas_pastorales` | Solo alertas de A | Nunca alertas de B | Vista no filtra otros tenants |
| `vw_resumen_feligresia` | Solo resumen de A | Nunca resumen de B | Resumen aislado |
| `resumen_dashboard` | Resultado de A | Vacío para B | RPC respeta alcance |
| `resumen_reportes` | Resultado de A | Vacío para B | RPC respeta alcance |
| INSERT/UPDATE/DELETE | Permitido solo según perfil | Rechazado | Política y permiso correctos |

Repetir la misma matriz con usuario B invirtiendo A y B. Repetir con perfiles
`estadisticas`, `pastor` y, cuando corresponda, un usuario distrital.

## Pruebas mínimas desde la web

- Iniciar sesión como A y confirmar nombre/distrito de A en Sidebar.
- Abrir Dashboard, Feligresía, Amigos, Evangelismo, Misión Juvenil y Reportes.
- Confirmar que ningún contador, alerta, opción o detalle muestra datos de B.
- Intentar abrir directamente rutas protegidas y modificar formularios sin
  permiso.
- Iniciar sesión como B y repetir.
- Suspender una congregación y confirmar que su acceso operativo queda
  bloqueado según la política institucional definida.

## Comprobaciones de inventario en SQL Editor

Estas consultas sirven para revisar configuración, pero no sustituyen la
prueba con JWT:

```sql
select schemaname, tablename, rowsecurity, forcerowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

select routine_schema, routine_name, routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('resumen_dashboard', 'resumen_reportes', 'tiene_permiso');
```

## Evidencia que debe guardarse

- Usuario, perfil y congregación usados en cada sesión.
- Fecha y hora de la prueba.
- Consulta o acción realizada.
- Resultado permitido, vacío o rechazado.
- Captura de errores cuando una escritura es rechazada.
- Resultado de las comprobaciones de tablas, políticas y funciones.

## Criterio de aprobación

La matriz se aprueba solo si no existe ninguna lectura, escritura, exportación,
alerta, vista o RPC que permita cruzar información entre A y B. Cualquier
resultado ambiguo bloquea la salida a producción hasta ser explicado y
corregido.
