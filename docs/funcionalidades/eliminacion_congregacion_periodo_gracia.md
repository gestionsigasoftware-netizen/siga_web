# Política de eliminación de congregaciones con periodo de gracia — 2026-11-05

## Contexto

Borrar una congregación real a mano por SQL (como se hizo con la
congregación de prueba "AGUA BONITA SUAREZ CAUCA", ver
`docs/mantenimiento/limpieza_datos_lanzamiento_2026_11_01.md`) es
delicado -- 17 tablas preservadas con relación `RESTRICT` hacia
`congregaciones`, sin backups configurados todavía. El usuario pidió
una política formal, responsable, nunca instantánea: solicitar
eliminación, un periodo de gracia de **30 días** durante el cual la
congregación queda bloqueada pero sus datos siguen intactos y la
solicitud se puede cancelar, y solo al vencer el plazo se borra de
verdad -- mismo patrón que "eliminar cuenta" en software serio.

## Diseño (por qué se hizo así, no de otra forma)

- **Se reutiliza `estado = 'suspendida'` para el bloqueo**, en vez de
  agregar un 4° valor a `congregaciones.estado`. Se investigó la
  alternativa y se descartó: un estado nuevo habría tocado
  `Dashboard.jsx` (5 lugares que cuentan activas/pendientes/
  suspendidas), `capturar_snapshot_negocio()` (mismo conteo, para el
  historial de negocio), `MainLayout.jsx` y `GlobalSearch.jsx` -- mucha
  superficie para un estado que en la práctica ya se comporta
  exactamente como "suspendida" (bloqueado, datos intactos). El
  bloqueo mismo ya existía y se reutiliza tal cual
  (`fix_bloqueo_congregacion_pendiente.sql`: `mis_congregaciones()`
  exige `estado = 'activa'` para el acceso operativo local).
- **`anular_congregacion()`** (congregación recién creada por error,
  sin censo real) sigue siendo el camino correcto para ese caso --
  esta política nueva es para congregaciones YA activas con datos
  reales, un caso distinto a propósito.
- **pg_cron ya estaba habilitado** (lo usa `negocio_snapshots_diarios.sql`
  desde antes) -- se reutiliza el mismo patrón exacto para el job
  diario que procesa las eliminaciones vencidas.
- **La ejecución definitiva generaliza el script manual de Agua
  Bonita**: mismo orden (`pastores` → `roles_sistema` → `personas` →
  `modulos`/`categorias_demograficas` → desvincular el catálogo IPUC →
  `congregaciones`), ahora como una función reutilizable en vez de un
  script de un solo uso.
- **Cuentas de login huérfanas**: igual que pasó con
  `andresanchezw916@gmail.com` en Agua Bonita, el borrado automático
  NO puede tocar `auth.users` directamente -- antes de purgar, guarda
  los emails de cualquier persona con login en esa congregación en
  `congregaciones_eliminadas_historial.cuentas_auth_huerfanas`, para
  que el super_admin las revise y borre a mano en Authentication.

## Qué se agregó

- **`supabase/distrital/eliminacion_congregacion_periodo_gracia.sql`**
  (nuevo, pendiente de ejecutar en producción):
  - Columnas nuevas en `congregaciones`: `eliminacion_solicitada_en`,
    `eliminacion_programada_para`, `eliminacion_solicitada_por`,
    `eliminacion_motivo`, `estado_antes_eliminacion`,
    `eliminacion_recordatorio_enviado`.
  - Tabla nueva `congregaciones_eliminadas_historial` -- auditoría que
    sobrevive aunque la congregación se borre de verdad
    (`congregacion_id` es un `uuid` plano, sin FK a `congregaciones`).
    Solo la lee `es_super_admin()` o el distrital dueño del distrito.
  - `solicitar_eliminacion_congregacion(congregacion_id, motivo?)` --
    mismo patrón de permisos que `anular_congregacion()`. Pone
    `estado = 'suspendida'`, programa el plazo a 30 días, notifica al
    pastor local.
  - `cancelar_eliminacion_congregacion(congregacion_id)` -- restaura
    el estado anterior, notifica al pastor local.
  - `eliminar_congregacion_definitivo(congregacion_id)` -- solo la
    llama el cron interno (mismo guard que
    `capturar_snapshot_negocio()`: si se llama con sesión real, exige
    `super_admin`).
  - `enviar_recordatorios_eliminacion_congregacion()` -- avisa de
    nuevo al pastor local cuando faltan 6-7 días, una sola vez.
  - `procesar_eliminaciones_congregaciones()` + job `pg_cron` diario
    (`15 5 * * *`) que llama a las dos anteriores.
- **`src/pages/Aprobaciones.jsx`**: botón "Solicitar eliminación" en
  las filas `activa`/`suspendida` (confirmación con motivo opcional),
  badge "Se elimina en N días" con `InfoTip` cuando hay una solicitud
  en curso, botón "Cancelar eliminación" en su lugar.
- **`src/lib/supabase.js`** (`getMisRoles()`) y **`MainLayout.jsx`**:
  el pastor local ve un mensaje específico ("Tu congregación será
  eliminada el {fecha}...") en vez del genérico "Congregación
  suspendida" cuando aplica, reutilizando el banner de bloqueo que ya
  existía.

## ⚠️ Orden de despliegue obligatorio (encontrado verificando, no a priori)

Al verificar con Playwright se encontró que **el frontend se puso a
pedir la columna `eliminacion_programada_para` antes de que existiera
en producción**, y PostgREST rechaza la consulta completa (no solo esa
columna) -- la consulta que arma `rolPrincipal` para TODA la app
(`getMisRoles()`, con el embed de `congregaciones(...)`) falló con
`400`, y el Sidebar cayó a un estado degradado (le faltaban módulos
del rol). Esto confirma que **el SQL debe correr en producción ANTES
de subir estos cambios de frontend**, o se rompería el login/rol de
todos los usuarios reales durante la ventana entre deploy y
ejecución del SQL.

**Por eso este commit se dejó sin pushear** hasta que el usuario
confirme que corrió `eliminacion_congregacion_periodo_gracia.sql` en
el SQL Editor de Supabase.

## Pendiente

1. Usuario: correr `eliminacion_congregacion_periodo_gracia.sql` en
   el SQL Editor de Supabase.
2. Confirmar que no rompe nada (pg_cron ya estaba habilitado, no
   debería pedir nada nuevo en el panel).
3. Solo entonces: push de los cambios de frontend.
4. Verificación real (no se pudo hacer clic real en "Solicitar
   eliminación" porque no hay cuenta de prueba distrital/super_admin
   -- limitación ya conocida y documentada en otras piezas de esta
   sesión): revisar por código + probar el RPC directamente contra una
   congregación de prueba efímera (nunca contra Puerto Tejada ni Sucre
   Cauca, que son reales), confirmando que el pastor local queda
   bloqueado con el mensaje nuevo y que "Cancelar eliminación" restaura
   el acceso.
5. Fuera de alcance a propósito (no se pidió): aviso por correo
   electrónico (hoy es solo notificación in-app, suficiente porque el
   login sigue funcionando durante el bloqueo).
