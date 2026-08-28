# Auditoria funcional de SIGA

Fecha: 28 de agosto de 2026

## Conclusión

SIGA refleja su intención principal: administrar la información pastoral,
acompañar personas y convertir la actividad en información para decidir. La
aplicación compila y las rutas públicas y protegidas funcionan en una prueba
local. Todavía no debe declararse lista para producción porque faltan pruebas
reales de roles, aislamiento entre congregaciones, migraciones aplicadas y
operación con volúmenes grandes.

## Prioridad critica

### 1. Aislamiento de vistas y datos

Las vistas del Dashboard y Feligresía fueron actualizadas con
`security_invoker = true` y el Dashboard aplica filtro explícito para el nivel
local. Aun debe comprobarse el aislamiento con dos usuarios de congregaciones
distintas y JWT reales. Verificar también reportes, funciones RPC y Storage.

Criterio de cierre: un usuario de la congregación A no puede leer, modificar ni
inferir datos de la congregación B mediante tablas, vistas, reportes o RPC.

### 2. Migraciones y seguridad externa

Debe verificarse en Supabase el orden completo de migraciones y la aplicación
real de las políticas. También faltan HTTPS, MFA para administradores,
confirmación de correo, límites de intentos, backups/PITR, monitoreo,
encabezados de seguridad y revisión de secretos.

Criterio de cierre: migraciones registradas, prueba A/B aprobada y controles
externos configurados en el proveedor.

### 3. Invitación de usuarios

La Edge Function `invitar-usuario` debe estar desplegada, tener sus secretos
configurados y probarse con cuentas nuevas, existentes, duplicadas y errores
parciales.

Criterio de cierre: el administrador invita, vincula la persona y asigna el
perfil sin exponer `service_role` ni dejar asignaciones inconsistentes.

## Prioridad alta

### 4. Rendimiento y volumen

Feligresía administrativa, Personas y Amigos ya trabajan en páginas de 50.
Dashboard usa la RPC agregada `resumen_dashboard` y ya no calcula sus
indicadores sobre un límite de 500 registros descargados. Reportes y algunos
análisis de Feligresía todavía pueden descargar conjuntos completos y calcular
agregados en el navegador.

Criterio de cierre: los indicadores históricos se calculan con consultas
agregadas o paginadas, sin truncar silenciosamente los totales.

### 5. Permisos visibles

Misión Juvenil ya oculta sus formularios a perfiles sin
`mision_juvenil.editar`. Debe aplicarse la misma experiencia a Personas,
Amigos, Modulos, Configuración y Aprobaciones cuando corresponda. RLS debe
seguir siendo la autoridad final.

Criterio de cierre: los usuarios solo ven acciones que su permiso permite y las
operaciones no autorizadas siguen siendo rechazadas por RLS.

### 6. Corrección/contingencia

El formulario ya respeta `exigir_responsable` y `exigir_novedades`. Falta
probar responsable opcional, novedades obligatorias, duplicados, permisos de
estadísticas/pastor y registros de módulos o zonas cruzadas.

## Prioridad media

### 7. Feligresía y auditoría

El módulo cubre censo, familias, comités, cargos, seguimiento, alertas,
importación y auditoría. Faltan pruebas de importación con duplicados, errores
por fila, auditoría de cada mutación y exportación del conjunto filtrado
completo, no solo de la página visible.

### 8. Misión Juvenil

La web cubre instituciones, estudiantes, grupos y panel de asistencia. La
interfaz de lecciones individuales, asistencia individual y administración de
líderes sigue siendo limitada y requiere decisión funcional antes de producción.

### 9. Gestión pastoral distrital

El flujo de pastores y traslados existe. Debe probarse el fallo intermedio de
alta o traslado para evitar registros huérfanos y verificar la consistencia de
`congregaciones.pastor_id`.

## Prioridad baja / decisión de producto

- Definir si `Personas` debe mantenerse como directorio separado de Feligresía.
- Definir exportación PDF/Excel avanzada para Reportes.
- Completar los datos institucionales y la revisión jurídica de `/legal`.
- Construir la PWA móvil offline en una etapa posterior.

## Correcciones de código ya realizadas durante la auditoría

- `Resumen` del Sidebar apunta al Dashboard protegido `/app`.
- Las preferencias de captura se aplican en `RegistrarAsistencia`.
- Misión Juvenil oculta altas a perfiles sin permiso de edición mediante
   `mision_juvenil.editar`.
- Las listas de Personas y Amigos cargan bloques de 50.
- El Login tiene navegación explícita a la portada.

Estas correcciones fueron validadas con `npm run build` y diagnósticos del
editor en los archivos modificados.

## Plan de corrección

1. Aislamiento: probar y reforzar vistas, consultas y RPC con usuarios A/B.
2. Permisos visibles: completar guards de acciones en los módulos restantes.
3. Rendimiento: convertir análisis masivos en consultas agregadas o páginas de
   servidor sin alterar los totales.
4. Integridad: probar migraciones, invitaciones y flujos con errores.
5. Aceptación: ejecutar una matriz por rol, congregación y módulo; registrar
   evidencia antes de producción.

## Trabajo iniciado con código

- Corregido el destino de Resumen y el comportamiento de preferencias de
   captura.
- Corregida la visibilidad de altas en Misión Juvenil para perfiles de
   consulta.
- Reducida la carga de listados operativos a páginas de 50 en Personas y
   Amigos.
- Reportes usa resumen agregado para métricas y detalle de 50 filas por página.
- Resumen agrega estados de carga/reintento, contexto de rangos y variación
   absoluta; las acciones de alertas respetan `feligresia.editar`.
- Las vistas de resumen usan `security_invoker`; la vista de alertas no evalúa
   el mes calendario actual incompleto.

El siguiente bloque recomendado de código es ejecutar y verificar las RPC de
Dashboard y Reportes en Supabase. Después debe hacerse la prueba A/B de RLS
antes de modificar más pantallas.
