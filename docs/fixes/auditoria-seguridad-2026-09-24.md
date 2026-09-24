# Auditoría de seguridad y resistencia a DDoS/DoS (2026-09-24)

**Motivo:** el usuario preguntó directamente por huecos de seguridad reales,
resistencia a ataques DDoS/DoS, y qué reforzar dado que SIGAP custodia
información religiosa, familiar y de menores.

## Metodología

Auditoría real contra el código y el esquema SQL (no una lista genérica):
comparación de todas las tablas creadas contra las que tienen RLS
habilitado, búsqueda de políticas `using/with check (true)` sospechosas,
revisión de la función Edge con `service_role`, `npm audit`, y búsqueda
de secretos en todo el historial de git.

## Hallazgos

### 1. Resuelto: Política de privacidad afirmaba backups que no existen

`src/pages/Legal.jsx` (sección 7) decía "se mantienen copias de
seguridad periódicas" en tiempo presente. Confirmado con el usuario:
los backups siguen pospuestos a propósito hasta subir a Supabase Pro
(decisión de negocio de 2026-09-10, sin cambios desde entonces) --
el texto público estaba afirmando algo que todavía no es cierto.
Corregido a lenguaje que describe el proceso como "en curso" en vez de
ya completado, y actualizada la fecha de última modificación.
**No bloqueante para el usuario, ya corregido.**

### 2. Confirmado seguro, documentación corregida: alta de congregaciones

`supabase/schema/schema.sql` (fuente de verdad) todavía mostraba una
política vieja y peligrosa: `congregaciones_insert_self_register` con
`with check (true)` -- permitía a **cualquier usuario autenticado**
(incluso un pastor local cualquiera) insertar una fila en
`congregaciones` con `estado = 'activa'` directamente, saltándose por
completo la aprobación distrital construida el 2026-09-23. Esa política
ya había sido eliminada y reemplazada por `congregaciones_insert_distrital`
(`with check (distrito_id in (select mis_distritos()))`) en
`supabase/distrital/gestion_distrital_congregaciones.sql` -- el usuario
confirmó que ese archivo **ya se ejecutó en producción**, así que el
riesgo real ya estaba cerrado. El problema era solo que `schema.sql`
había quedado desactualizado y podía inducir a error a quien lo leyera
como "estado actual". Corregido: `schema.sql` ahora refleja la política
real vigente, con una nota explicando el reemplazo.

### 3. Verificado sin hallazgos: cobertura de RLS

Se comparó la lista completa de `CREATE TABLE` contra `ALTER TABLE ...
ENABLE ROW LEVEL SECURITY` en las 104 archivos `.sql` del repo: 116
tablas, 116 coincidencias exactas -- ninguna tabla queda sin RLS a
nivel de código. (Limitación: esto audita el código, no puede confirmar
por sí solo que cada archivo se haya ejecutado en producción -- el
patrón de "SQL pendiente de ejecutar" ya documentado en otras entradas
de `pendientes.md` sigue siendo el mecanismo real de seguimiento para eso).

### 4. Verificado sin hallazgos: políticas `using/with check (true)`

Se revisaron todas. Los casos reales encontrados son legítimos:
tablas de catálogo/permisos de solo lectura (`perfiles_acceso`,
`permisos_perfil`), un log de errores que necesita aceptar inserciones
anónimas (`errores_frontend`), una tabla singleton de config
(`metodos_pago_sigap`), y dos políticas de `update` donde el `using`
ya es el filtro real de acceso por fila (`sepri_solicitudes_evento`,
`solicitudes_jerarquicas`) -- patrón normal, el `with check(true)` solo
permite editar valores de una fila a la que ya se tiene acceso legítimo.

### 5. Verificado sin hallazgos: función Edge con `service_role`

`supabase/functions/invitar-usuario/index.ts` valida el JWT real del
llamante (`auth.getUser()`) y comprueba permisos (`tiene_permiso()` o
`distrital_puede_iniciar_congregacion()`) **antes** de usar el cliente
con `service_role` para cualquier operación. Todas las consultas
privilegiadas filtran además por `congregacion_id`. Sin problemas.

### 6. Verificado sin hallazgos: secretos filtrados

`.env`/`.env.local` nunca se comprometieron en el historial de git;
ninguna clave `service_role` ni credencial hardcodeada en el código
fuente. Coincide con la verificación de 2026-09-10 documentada en
`pendientes.md`.

### 7. Dependencias con vulnerabilidades conocidas (moderadas, no urgentes)

`npm audit` reporta 4 vulnerabilidades moderadas:
- **react-router 6.x**: CVE de open-redirect y de inyección en
  hidratación SSR. SIGAP es un SPA sin SSR (la segunda no aplica) y no
  existe en el código ningún redirect basado en parámetro de URL
  controlable por el usuario (la primera no es explotable hoy). El fix
  requiere migrar a react-router-dom v7 (cambio mayor/breaking).
- **uuid < 11.1.1** (vía `exceljs`): fallo de límites de buffer, riesgo
  práctico bajo en el uso actual (generación de Excel, sin buffers
  controlados por el usuario).

Ninguna de las dos es explotable hoy con el uso actual del código, pero
quedan como deuda técnica a resolver cuando se planifique una
actualización mayor de dependencias.

## Sobre DDoS/DoS específicamente (respuesta a la pregunta directa)

- **Ya cubierto automáticamente, sin configurar nada**: Cloudflare
  Pages está detrás de la red de Cloudflare, que da protección DDoS de
  capa 3/4 (volumétrica) de forma automática en cualquier plan,
  incluido el gratuito.
- **El riesgo real para SIGAP no es un DDoS volumétrico clásico**
  (perfil bajo, no es un blanco atractivo) sino dos escenarios más
  probables, ninguno "invisible" hoy pero sin una capa dedicada:
  1. Fuerza bruta / credential stuffing contra el login -- Supabase
     Auth ya tiene rate-limits propios (verificados 2026-09-10), pero
     no hay una regla de rate-limit adicional a nivel de borde
     (Cloudflare) sobre `/login`.
  2. Un usuario ya autenticado abusando de un endpoint costoso
     (reportes pesados, exportaciones) para agotar recursos del
     proyecto de Supabase -- RLS limita el alcance de los datos, pero
     no limita la frecuencia de las consultas.
- **Recomendaciones concretas, no implementadas en esta sesión**
  (requieren configuración en el panel de Cloudflare, no cambios de
  código):
  - Activar **Bot Fight Mode** (gratis, un toggle).
  - Configurar al menos una **regla de rate-limit** sobre `/login`.
  - Evaluar **Cloudflare Pro** para WAF con reglas administradas
    (OWASP) si el presupuesto lo permite, dado el tipo de datos que
    maneja SIGAP.

## Pendiente, ya documentado antes de hoy (recordatorio, no nuevo)

Backups/PITR siguen pospuestos a propósito hasta el plan Pro de
Supabase -- decisión de negocio ya aceptada el 2026-09-10, sin cambios.
Ver punto 1 arriba sobre la corrección del texto público mientras tanto.
