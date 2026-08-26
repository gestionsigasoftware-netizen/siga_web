# Seguridad de produccion

## Advertencia de estado

No todo esta hecho todavia. La aplicacion tiene controles de seguridad
implementados en codigo y migraciones SQL, pero aun no debe considerarse
lista para produccion hasta completar las configuraciones externas y las
pruebas indicadas en este documento.

Lo implementado en el repositorio no activa automaticamente HTTPS, MFA,
backups, monitoreo ni encabezados HTTP. Esos controles deben configurarse y
verificarse en Supabase, el proveedor de hosting y el dominio de produccion.

## Estado por control

| Control | Estado | Responsable o ubicacion |
| --- | --- | --- |
| No usar `service_role` en frontend | Implementado | `src/lib/supabase.js`; solo usa URL y anon key |
| HTTPS | Pendiente de confirmar | Hosting y dominio |
| MFA para administradores | Pendiente | Supabase Auth |
| Confirmacion de correo | Pendiente de confirmar | Supabase Auth |
| Politica de contrasenas | Parcial | UI de cambio valida requisitos; falta politica global |
| Limites de intentos | Pendiente de confirmar | Supabase Auth o proveedor perimetral |
| RLS | Implementado en SQL; falta verificar ejecucion | `supabase/*.sql` |
| Storage privado | Pendiente si se habilitan documentos | Supabase Storage |
| Backups y PITR | Pendiente de confirmar | Plan y panel de Supabase |
| Monitoreo y alertas | Pendiente de confirmar | Supabase y hosting |
| Aislamiento entre congregaciones | Preparado en RLS; falta prueba formal | Usuarios de prueba y SQL |
| CSP, HSTS y anti-clickjacking | Pendiente | Encabezados del hosting o proxy |

## Migracion de endurecimiento

Ejecutar `supabase/seguridad_produccion.sql` despues de las migraciones base. Esta migracion:

- Restringe Mision Juvenil mediante permisos de negocio.
- Impide cruces de congregacion en asistencia individual.
- Fija `search_path` en funciones `SECURITY DEFINER`.
- Revoca la funcion de datos demo para usuarios del navegador.
- Mantiene el acceso del pastor local para los modulos existentes y nuevos.

## Reglas obligatorias

- Nunca colocar `service_role` en `.env` usado por Vite ni en codigo cliente.
- No confiar en validaciones de React para autorizar operaciones.
- Toda tabla expuesta por la API debe tener RLS y politicas revisadas.
- Todo bucket con documentos sensibles debe ser privado y usar URLs firmadas.
- No registrar contrasenas, tokens ni datos personales innecesarios en logs.
- Aplicar el principio de minimo privilegio a perfiles y funciones RPC.
- Mantener `capturado_por` para auditoria, sin exponerlo en las estadisticas
	de usuarios moviles.

## Prueba minima de aislamiento

1. Crear usuario A con acceso solo a congregacion A.
2. Crear usuario B con acceso solo a congregacion B.
3. Con A, intentar leer, insertar, actualizar y borrar filas de B usando la API.
4. Repetir con B hacia A.
5. Confirmar que todas las operaciones cruzadas son rechazadas o no devuelven filas.
6. Probar tambien vistas, reportes, Storage y funciones RPC.

La prueba debe ejecutarse despues de cada cambio importante de politicas.

## Criterio de salida

SIGA no debe declararse lista para datos reales hasta confirmar en el proveedor: HTTPS, Auth, backups, logs, Storage, encabezados y aislamiento con usuarios de prueba.
