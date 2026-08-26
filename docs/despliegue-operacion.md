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
2. `supabase/vistas_dashboard.sql`
3. `supabase/accesos.sql`
4. `supabase/pastoral_distrital.sql`
5. `supabase/feligresia.sql`
6. `supabase/notificaciones.sql`
7. `supabase/configuracion.sql`
8. `supabase/asistencia_web.sql`
9. `supabase/migracion_produccion.sql`
10. `supabase/mision_juvenil.sql`
11. `supabase/seguridad_produccion.sql`

Si una migracion ya fue ejecutada, verificar si es repetible antes de volver a correrla. Hacer backup o confirmar PITR antes de aplicar cambios en datos reales.

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
