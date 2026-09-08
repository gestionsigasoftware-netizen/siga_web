# Humanizar el "Historial reciente" de comités — 2026-09-08

## Contexto

El usuario reportó (con captura de pantalla) que la pestaña "Evolución"
de Feligresía, sección "Historial reciente" (componente
`CommitteeAnalytics` en `FeligresiaAdmin.jsx`), mostraba directamente
al pastor datos crudos de la tabla de auditoría: el nombre técnico de
la tabla (`membresias_comite`), la acción SQL (`DELETE`) y un UUID de
usuario o la palabra "Sistema" -- sin ningún sentido para alguien sin
conocimiento técnico.

De paso, esa captura mostraba 100 filas idénticas con el mismo
timestamp -- se investigó y se confirmó (con el usuario) que eran
puramente ruido de sus propias cargas/limpiezas de datos de prueba a
lo largo de la sesión, no actividad pastoral real.

## Construido

**Humanización de la pantalla** (`src/pages/FeligresiaAdmin.jsx`):
- Nuevo `AUDIT_LABELS` (mapa `entidad` + `accion` → frase en español:
  "Comité creado", "Integrante removido", etc.) y
  `describirCambioAuditoria()`.
- `CommitteeAnalytics` ahora resuelve el `usuario_id` (UUID crudo) a un
  nombre real cuando corresponde a alguien de la congregación
  (`describirActor()`, usando un mapa `auth_user_id → nombre` armado
  desde `analyticsPeople`, al que se le agregó `auth_user_id` a su
  consulta) -- si no hay usuario, dice "Cambio automático del
  sistema"; si el usuario no se pudo resolver (ej. alguien fuera de la
  congregación), dice "Otro usuario".
- La tabla ahora tiene encabezados de columna (antes no tenía) y una
  sola columna "Cambio" en vez de dos columnas crudas separadas
  (entidad + acción).

**Limpieza de datos de prueba**
(`supabase/qa_pruebas/limpiar_auditoria_comites_puerto_tejada.sql`):
borra las 1.505 filas de auditoría de comités de Puerto Tejada Cauca
Central confirmadas como ruido de pruebas (4 fechas puntuales,
2026-08-26/28 y 2026-09-01/05) -- no toca auditoría de otras
congregaciones ni otras entidades.

## Verificación

`npm run build` sin errores. La resolución de nombres se verificó
contra la base real: solo 5 de las 1.505 filas tenían `usuario_id` no
nulo, todas del mismo usuario de prueba del 2026-08-26 -- el resto
(1.500) mostrará "Cambio automático del sistema" hasta que se corra la
limpieza, después de la cual la tabla debería quedar vacía o con solo
actividad real.

**Acción requerida del usuario**: ejecutar
`supabase/qa_pruebas/limpiar_auditoria_comites_puerto_tejada.sql` en
el SQL Editor para purgar el ruido histórico.

## Pendiente

Se pidió además revisar el resto de la app por el mismo tipo de
problema (datos técnicos crudos mostrados al usuario final) -- ver
hallazgos en un documento aparte una vez termine esa investigación.
