# Pendientes

## Prioridad critica antes de produccion

- Ejecutar y verificar `supabase/seguridad_produccion.sql`.
- Confirmar RLS en todas las tablas y vistas expuestas.
- Configurar HTTPS y dominio en el hosting.
- Activar confirmacion de correo, politica global de contrasenas y proteccion contra abuso en Supabase Auth.
- Activar MFA para administradores.
- Configurar backups/PITR y retencion.
- Configurar monitoreo, alertas y revision de logs.
- Configurar CSP, HSTS y anti-clickjacking.
- Verificar que todos los buckets de Storage sean privados.
- Ejecutar prueba de aislamiento entre dos congregaciones.
- Revisar variables de entorno y confirmar que no existe `service_role` en el bundle.

## Prioridad alta

- Prueba funcional completa de Evangelismo despues de aplicar su migracion correspondiente.
- Prueba funcional completa de Mision Juvenil con instituciones, estudiantes, grupos y filtros.
- Validar los registros provenientes de la PWA cuando ese proyecto vuelva a entrar en alcance.
- Documentar usuarios iniciales, responsables y procedimiento de baja de acceso.

## Mejoras funcionales pendientes

- Interfaz para registrar lecciones individuales de grupos en `mision_lecciones`.
- Asistencia individual por estudiante en `mision_asistencia_estudiante`.
- Registro y administracion de lideres de Mision Juvenil.
- Carga de documentos y certificados mediante Storage privado.
- Exportacion PDF de reportes, si el negocio la requiere.
- Registro publico controlado de nuevas congregaciones, si el negocio lo requiere.
- UI para administrar tipos de actividad desde Configuracion.
- Umbral de alertas configurable por congregacion.
- PWA movil separada para captura offline y sincronizacion.

## Mantenimiento

- Actualizar esta lista cuando se termine cada tarea.
- No volver a registrar como pendiente una funcion ya implementada.
- Antes de agregar un modulo, revisar `docs/arquitectura.md`, el codigo existente y las migraciones aplicadas.
