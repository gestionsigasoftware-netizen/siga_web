# SIGA — SaaS Nacional IPUC

Ver `siga-especificacion-maestra.md` (entregado aparte) para el contexto
completo de negocio. Este README es solo la guía técnica de arranque.

## Cómo arrancar en VS Code

```bash
npm install
cp .env.example .env
# Completa .env con tu URL y anon key de Supabase (Project Settings → API)
```

En el **SQL Editor** de Supabase, ejecuta en este orden exacto:
1. `supabase/schema.sql` — estructura completa + RLS
2. `supabase/vistas_dashboard.sql` — vistas que consume el Dashboard
3. `supabase/migracion_produccion.sql` — endurecimiento RLS + validaciones de datos
4. `supabase/notificaciones.sql` — centro de notificaciones realtime
5. `supabase/configuracion.sql` — preferencias personales y configuración por congregación
6. `supabase/feligresia.sql` — censo local, familias, comités e historial pastoral

```bash
npm run dev
```

Abre en `http://localhost:5173`.

## Primeros pasos después de instalar

El sistema no tiene nada útil que mostrar hasta que exista al menos:

1. Un **distrito** y una **congregación** con `estado = 'activa'` (o usa
   `select crear_congregacion_demo();` en el SQL Editor para generar una
   completa con datos de ejemplo — así puedes explorar el sistema de
   inmediato sin cargar nada a mano).
2. Una cuenta de Supabase Auth vinculada a una fila en `personas`
   (columna `auth_user_id`).
3. Una fila en `roles_sistema` para esa persona (nivel `local` apuntando a
   la congregación, o el nivel que corresponda).

Sin el paso 3, cualquier usuario que inicie sesión no verá nada — el
Sidebar y todas las páginas dependen de `useMiRol()` para saber qué mostrar.

## Contrato mínimo para la PWA

La PWA debe autenticarse con Supabase Auth y crear registros en
`registros_actividad`. El usuario autenticado debe tener una fila activa en
`roles_sistema` y una persona vinculada en `personas`.

Campos esperados al registrar una actividad:

```json
{
  "congregacion_id": "uuid",
  "modulo_id": "uuid",
  "tipo_actividad_id": "uuid",
  "zona_id": null,
  "responsable_persona_id": "uuid",
  "fecha": "2026-08-25",
  "novedades": "Texto opcional",
  "desglose": { "categoria_id": 12 }
}
```

`capturado_por` y `total_asistentes` se completan y validan en la base de
datos. La PWA debe conservar los registros pendientes cuando esté offline y
reintentarlos cuando vuelva la conexión.

## Estructura

```
src/
├── lib/supabase.js         → cliente + getMisRoles()
├── hooks/
│   ├── useAuth.js
│   └── useMiRol.js          → resuelve el nivel de rol más alto de la persona
├── components/layout/        → Sidebar (adaptable por rol), MainLayout, ProtectedRoute
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx          → se adapta según nivel: local/distrital/nacional
│   ├── RegistrarAsistencia.jsx → motor genérico, sirve para cualquier módulo
│   ├── Amigos.jsx               → pipeline de seguimiento, respeta RLS de privacidad
│   ├── Aprobaciones.jsx          → solo visible para Distrital/Nacional/Super Admin
│   ├── Configuracion.jsx          → catálogos y preferencias de congregación local
│   ├── Feligresia.jsx             → censo local, familias, bautismo y estados pastorales
└── App.jsx                    → router

supabase/
├── schema.sql                → estructura + RLS + función de congregación demo
└── vistas_dashboard.sql       → vw_tendencia_categoria, vw_alertas_pastorales
```

## Pendiente conocido (no está hecho todavía)

- **PWA de captura** separada — este proyecto es solo la plataforma web.
  La PWA sigue el mismo patrón de motor genérico; se construye como
  proyecto aparte (ver especificación maestra, sección 4).
- **Registro público de nueva congregación** — falta el formulario donde
  un rol Local se auto-registra eligiendo su distrito; hoy solo existe la
  tabla y la política RLS que lo permite (`congregaciones_insert_self_register`).
- **Tipos de actividad** dentro de Configuración — se pueden editar desde
  Supabase directamente por ahora, falta la UI.
- **Exportación PDF/Excel** de reportes.
- **Umbral de alerta configurable** — hoy está fijo en 15% en
  `vw_alertas_pastorales`, podría moverse a una tabla de configuración por
  congregación si se necesita ajustar por caso.
- **Modo demo activable desde la UI** — la función `crear_congregacion_demo()`
  existe en SQL pero no hay botón en la web todavía para dispararla.
