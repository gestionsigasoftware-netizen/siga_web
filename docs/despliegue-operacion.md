# Despliegue y operacion

## Requisitos locales

- Node.js compatible con Vite 5.
- Variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Proyecto Supabase configurado.

## Instalacion

```bash
npm install
npm run build
npm run dev
```

La aplicacion local se abre normalmente en `http://localhost:5173`.

## Orden recomendado de migraciones

Ejecutar en el SQL Editor de Supabase y revisar cada resultado:

1. `supabase/schema.sql`
2. `supabase/migracion_produccion.sql`
3. `supabase/accesos.sql`
4. `supabase/pastoral_distrital.sql`
5. `supabase/feligresia.sql`
6. `supabase/vistas_dashboard.sql`
7. `supabase/notificaciones.sql`
8. `supabase/configuracion.sql`
9. `supabase/evangelismo.sql`
10. `supabase/asistencia_web.sql`
11. `supabase/mision_juvenil.sql`
12. `supabase/actividad_personalizada.sql`
13. `supabase/estadisticas_movil.sql`
14. `supabase/dashboard_analytics.sql`
15. `supabase/reportes_analytics.sql`
16. `supabase/seguridad_produccion.sql`

`actividad_personalizada.sql` y `estadisticas_movil.sql` son migraciones de
compatibilidad con la captura movil y dependen de las tablas base y de acceso.
`seguridad_produccion.sql` debe ser la ultima migracion de endurecimiento.
Si una migracion ya fue ejecutada, verificar si es repetible antes de volver a
correrla. Hacer backup o confirmar PITR antes de aplicar cambios en datos reales.

## Datos de demostracion

Solo en una base de pruebas, ejecutar `supabase/seed_datos_prueba.sql` despues
de las migraciones. El seed elimina primero sus filas marcadas y vuelve a
generar datos para Feligresia, Reportes, Evangelismo, Mision Juvenil,
actividades personalizadas, configuracion y notificaciones. Para retirarlos,
usar `supabase/limpiar_datos_prueba.sql`; este limpiador no elimina las tablas,
columnas ni politicas creadas por las migraciones.

## Invitacion de usuarios

El alta de usuarios se realiza desde Equipo de trabajo. La Edge Function
`supabase/functions/invitar-usuario/index.ts` valida la sesion y el permiso
`usuarios.administrar`, invita el correo desde Supabase Auth, vincula
`personas.auth_user_id` y crea la asignacion de perfil.

Desplegarla con Supabase CLI desde la raiz del proyecto:

```bash
supabase functions deploy invitar-usuario
```

La funcion necesita `SUPABASE_SERVICE_ROLE_KEY` en los secretos del proyecto
Supabase. Esta clave nunca debe agregarse al archivo `.env` de Vite ni al
frontend. Configurar tambien `APP_ORIGIN` con el dominio real para restringir
las solicitudes CORS.

## Captura movil y auditoria

La persona que captura no ve quien hizo otros registros, pero la base de
datos conserva `capturado_por` para auditoria y administracion. La PWA puede
usar cultos del catalogo o guardar un nombre personalizado en
`registros_actividad.nombre_actividad`.

## Publicacion

1. Crear el proyecto de hosting.
2. Configurar las variables Vite como variables publicas del frontend; nunca incluir `service_role`.
3. Usar `npm run build` como comando de construccion.
4. Publicar la carpeta `dist`.
5. Configurar fallback SPA para que las rutas de React regresen a `index.html`.
6. Activar dominio, HTTPS y redireccion HTTP a HTTPS.
7. Configurar CSP, HSTS, `X-Frame-Options` o `frame-ancestors`, `Referrer-Policy` y `Permissions-Policy`.
8. Configurar Auth, MFA, correo, backups, logs y alertas en Supabase.
9. Ejecutar pruebas con usuarios de congregaciones distintas.

## Operacion diaria

- Revisar errores de autenticacion, RLS y funciones RPC.
- Revisar crecimiento de la base de datos y backups.
- Dar de baja usuarios y perfiles cuando termine su responsabilidad.
- Mantener dependencias actualizadas y volver a ejecutar el build.
- Documentar cada migracion aplicada y su fecha en el registro operativo del equipo.
