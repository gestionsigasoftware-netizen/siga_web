# Sidebar agrupado por secciones

**Fecha:** 2026-09-24
**Archivo:** `src/components/layout/Sidebar.jsx`

## Contexto

El usuario pidió una recomendación profesional sobre la organización
del sidebar. Al revisar el código real, el rol **local** (pastor)
tenía **27 ítems en una sola lista plana**, sin ningún agrupamiento
visual más allá de un único rótulo genérico "Navegación" -- forzaba a
escanear renglón por renglón para encontrar algo como "Damas Dorcas".
Los demás roles (distrital/nacional/super_admin) tienen listas mucho
más cortas (10-15 ítems) y no tenían este problema.

## Cambio

Cada ítem del array `items` ahora tiene un campo `group`. Se definió
un orden fijo de secciones (`GROUP_ORDER`) y sus etiquetas
(`GROUP_LABELS`):

1. **(sin encabezado)** -- Resumen, como punto de entrada, no como
   una sección más.
2. **Feligresía** -- Feligresía, Red de Familias.
3. **Evangelismo y misión** -- Misiones y Evangelismo, Amigos en
   ruta, Impacto Misionero.
4. **Comités y ministerios** -- los 10 comités reales de la IPUC
   (mismo criterio que ya reconoce `ComitesNacional.jsx`): Misión
   Juvenil, Escuela Dominical, Damas Dorcas, Obra Carcelaria, SEPRI,
   Música, Educación Artística, Educación Teológica, Conquistadores,
   Obra Social.
5. **Administración** -- todo lo administrativo de cualquier nivel:
   Corrección/contingencia, Equipo de trabajo, Auditoría de
   Feligresía, Gestión pastoral (distrital), Catálogo de distritos,
   Gestión Pastoral Nacional, Comités Nacional, Suscripciones,
   Errores del sistema, Módulos y actividades, Aprobaciones,
   Configuración local.
6. **Información y soporte** -- Reportes, Manual, Salud de datos,
   Soporte, Solicitudes internas, Preferencias personales (los únicos
   ítems visibles para absolutamente todos los roles).

El agrupamiento se calcula después del filtro de permisos (`.show`)
existente -- **una sección solo aparece con su encabezado si tiene al
menos un ítem visible para el rol activo**, así que distrital/
nacional/super_admin no ven encabezados de secciones vacías (por
ejemplo, "Comités y ministerios" nunca aparece fuera del rol local).
Se eliminó el rótulo genérico "Navegación" porque ahora cada sección
ya tiene su propio encabezado.

Sin cambios de permisos ni de rutas -- es reordenamiento/agrupación
visual puro, cada `show` se dejó exactamente igual.

## Verificación

1. `npm run build` sin errores.
2. Playwright + login real (rol local, cuenta de prueba): capturas de
   pantalla confirman los 5 encabezados de sección en el orden
   correcto, "Resumen" sin encabezado arriba, y que la navegación
   (clic en un ítem) sigue funcionando con normalidad. Sin errores de
   consola.
3. Verificado por código (sin cuenta de prueba distrital/nacional)
   que el filtro `.show` sigue exactamente igual por ítem -- el
   agrupamiento no cambia qué ve cada rol, solo cómo se organiza
   visualmente.
