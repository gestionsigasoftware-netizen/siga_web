# Acceso demo público — 2026-11-05

## Contexto

El botón "Ver demo en vivo" del Inicio público antes no existía --
solo había acceso real (con cuenta real) o la cotización por
WhatsApp. El usuario pidió un acceso de verdad: cualquier visitante
entra con un clic, ve una congregación de ejemplo con datos de
muestra, nunca toca datos reales, y todo se reinicia solo cada noche
-- patrón estándar de la industria (demo asistida por WhatsApp +
cuenta demo fija y compartida, conviviendo las dos).

Punto de partida real encontrado antes de construir nada: el proyecto
ya tenía `congregaciones.es_demo` y `crear_congregacion_demo()`
(`supabase/schema/schema.sql`), pero bloqueada para el navegador
(`seguridad_produccion.sql`) y sin ningún botón que la disparara --
`README.md` ya lo documentaba como pendiente conocido. Esta
funcionalidad completa esa pieza, no la reemplaza.

## Diseño

- **Una sola cuenta demo, compartida por todos los visitantes** (no
  auto-registro, no un tenant por visitante) -- reutiliza
  `useAuth().signIn()` tal cual, sin inventar un mecanismo de sesión
  aparte. `ProtectedRoute` y `MainLayout` no cambian en nada.
- **`mis_congregaciones()`** se actualizó para excluir
  `es_demo = true` de su rama nacional/super_admin -- sin esto, la
  congregación demo se mezclaría con el Dashboard nacional, el
  informe trimestral y la salud de datos reales.
- **`capturar_snapshot_negocio()`** (el snapshot diario de negocio de
  super_admin) también se corrigió -- contaba `congregaciones`
  directo, sin pasar por `mis_congregaciones()`, así que la demo
  habría inflado `total_congregaciones`/`activas` en las métricas de
  negocio reales.
- Se auditaron (grep dirigido) el resto de consultas nacionales/
  distritales consolidadas (`informe_trimestral.sql`,
  `bi_fase2_insights.sql`, `salud_datos.sql`,
  `resumen_ruta_distrital.sql`, `resumen_mision_juvenil_red_familias.sql`)
  -- todas ya filtran por `mis_congregaciones()`, así que quedaron
  cubiertas automáticamente por el cambio de arriba, sin tocarlas.
- **`supabase/qa_pruebas/*.sql`** ya usaba `es_demo = true` para sus
  propios datos de carga interna, buscando "la primera congregación
  demo que encuentre" -- en cuanto existiera la demo pública, esos
  scripts podían agarrarla por error (incluyendo
  `usuario_prueba_local.sql`, que ata la cuenta real
  `gestionsigasoftware@gmail.com` a esa congregación). Se corrigieron
  los 3 scripts afectados para filtrar también por el nombre exacto
  de su propia congregación de QA, nunca "la primera que encuentre".
- **Riesgo de cuenta compartida** (decidido con el usuario): un
  visitante podría cambiar el nombre o la contraseña de la cuenta
  demo desde "Mi perfil" y dejar a los demás sin poder entrar hasta
  el reinicio nocturno. Se optó por ocultar esos controles cuando el
  rol activo es la congregación demo (`Perfil.jsx`), en vez de
  construir un reseteo de contraseña a nivel de Auth por SQL. Riesgo
  residual aceptado: alguien lo fuerza por API directamente -- el
  reinicio nocturno lo resuelve en el peor caso.

## Qué se hizo (frontend, ya en main)

- `src/lib/supabase.js`: `getMisRoles()` agrega `es_demo` al select
  embebido de `congregaciones(...)`.
- `src/pages/DemoAcceso.jsx` (nuevo) + ruta pública `/demo` en
  `App.jsx`: hace `signIn()` con credenciales de
  `VITE_DEMO_EMAIL`/`VITE_DEMO_PASSWORD` (nunca hardcodeadas) y
  navega a `/app` -- si esas variables no están configuradas, muestra
  un error claro en vez de fallar en silencio.
- `src/pages/InicioPublico.jsx`: nuevo botón "Ver demo en vivo" junto
  al de "Entrar a SIGAP" en el hero, enlazando a `/demo`. El flujo de
  WhatsApp para cotización sigue intacto, ambos caminos conviven.
- `src/components/layout/MainLayout.jsx`: franja informativa (NO
  bloqueante, a diferencia del banner de congregación suspendida) que
  avisa "Estás viendo SIGAP en modo demostración" cuando
  `es_demo = true`, con link directo a WhatsApp para pedir acceso
  real.
- `src/pages/Perfil.jsx`: oculta la edición de nombre y contraseña
  cuando el rol activo es la congregación demo.
- i18n (`es`/`en`/`pt`): namespace `demo.*` nuevo + `inicio.hero.ctaDemo`
  + `perfil.sinEdicionDemo`. Verificado sin llaves faltantes en
  ningún idioma.
- `.env.example`: documenta `VITE_DEMO_EMAIL`/`VITE_DEMO_PASSWORD`.

`npm run build` limpio con todos estos cambios.

## Qué falta (SQL, requiere pasos manuales del usuario)

1. **Ejecutado por el usuario**:
   `supabase/schema/demo_publico_paso1_congregacion.sql` -- crea la
   congregación demo (reutiliza `crear_congregacion_demo()`). Guardar
   el `congregacion_demo_id` que devuelve.
2. **Ejecutado por el usuario**: crear la cuenta de login en
   Supabase > Authentication > Users (ej. `demo@sigap.com.co`, con
   una contraseña que el usuario elija) -- no hay forma de crear un
   usuario de Auth por SQL. Guardar el `auth_user_id` generado.
3. **Pendiente de mí**, una vez el usuario me pase esos dos IDs:
   - `supabase/schema/demo_publico_paso2_persona_y_seed.sql` -- crea
     la `personas`/`roles_sistema` de la cuenta demo y siembra
     contenido de ejemplo (censo, un par de comités, actividad
     reciente) para que la demo no se vea vacía.
   - `supabase/schema/demo_publico_paso3_reinicio_nocturno.sql` --
     `resetear_congregacion_demo()` + job `pg_cron` diario, mismo
     patrón exacto de `eliminacion_congregacion_periodo_gracia.sql`.
4. **Ejecutado ya, independiente de los IDs anteriores**:
   `supabase/schema/demo_excluir_reportes_nacionales.sql` y
   `supabase/schema/demo_excluir_snapshot_negocio.sql` -- ambos listos
   para correr en cuanto el usuario quiera, no dependen del paso 1/2.
5. **Antes de que el frontend quede expuesto de verdad**: agregar
   `VITE_DEMO_EMAIL`/`VITE_DEMO_PASSWORD` también en el panel de
   Cloudflare Pages del proyecto (no solo en `.env` local), o el build
   real los deja `undefined` sin avisar -- mismo patrón ya conocido
   para cualquier variable `VITE_*` nueva.
6. **Confirmar antes de pushear el frontend**: que `es_demo` ya existe
   en la tabla `congregaciones` de producción -- está en el schema
   base y los scripts de QA ya lo usan, así que casi con certeza ya
   está, pero se confirma igual (mismo criterio que con
   `eliminacion_programada_para`, que si rompió el login una vez por
   no verificarlo primero).

## Pendiente de verificación (una vez completados los pasos de arriba)

- Entrar por `/demo`, confirmar franja de modo demo visible, censo/
  comités/actividad con el seed de ejemplo (no vacío), y que en Perfil
  no aparecen los controles de nombre/contraseña.
- Confirmar con una cuenta nacional/super_admin real que la
  congregación demo NO aparece en el Dashboard nacional ni en el
  informe trimestral.
- Confirmar que el cron del reinicio nocturno quedó agendado
  (`select * from cron.job where jobname = 'resetear-demo-sigap';`).
