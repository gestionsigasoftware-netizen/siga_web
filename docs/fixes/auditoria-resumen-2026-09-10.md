# Auditoría y corrección del módulo Resumen (Dashboard) — 2026-09-10

## Contexto

El usuario pidió una auditoría completa de la pantalla "Resumen"
(`/app`, `src/pages/Dashboard.jsx`) para los 3 roles (local, distrital,
nacional): si de verdad funciona, si los gráficos/insights hacen su
trabajo, qué es redundante, y qué hay que reorganizar para que no
confunda. Se investigó con 3 agentes en paralelo (local, distrital/
nacional, y redundancia cruzada con el resto de la app) antes de tocar
código. Tras presentar los hallazgos, el usuario pidió resolver todo y
dejarlo listo para producción.

## Hallazgo estructural (corrige una suposición inicial)

`Dashboard.jsx` no es una sola pantalla con huecos condicionales -- son
**3 componentes separados** (`Dashboard` local, `DashboardDistrital`,
`DashboardNacional`) con un `switch` temprano por rol. Distrital y
nacional **sí tienen contenido propio y bien diseñado** (semáforo,
insights de BI, pirámide poblacional, tabla comparativa) -- no estaban
vacíos ni eran genéricos, contrario a lo que se podría suponer.

## Construido

### Bugs reales corregidos (no solo redundancia)

1. **"Promedio por actividad" media una cosa y rotulaba otra**
   (`Dashboard.jsx`): el color (verde/rojo) estaba fijo en `success` y
   el texto reusaba la variación del *total* de asistentes, no la del
   promedio por actividad. Se agregó `variacionPromedio` (calculado
   sobre `averageSeries`) y el tono/texto ahora reflejan el dato real.
2. **Gráfico "Evolución {frecuencia}" se pintaba vacío** junto al
   aviso "Tu panel está listo para recibir datos" -- ahora usa
   `ChartEmpty` cuando `!hasData`, igual que "Ritmo"/"Composición".
3. **"Amigos e integración" dependía de una categoría "Amigos" que las
   congregaciones reales nunca reciben** al darse de alta (solo el
   seed de demo la trae). Nuevo
   `supabase/catalogos/categoria_amigos_demografica.sql`: la siembra
   retroactivamente en toda congregación que no la tenga.
4. **"Familias asociadas" no filtraba por `estado_membresia='activo'`**
   como sus tiles vecinos -- contaba familias de personas apartadas/
   trasladadas/fallecidas. Corregido en la vista `vw_resumen_feligresia`
   (`supabase/modulos/hitos_espirituales.sql`). Verificado con un caso
   de prueba real: agregar una familia solo de una persona apartada NO
   mueve el número.
5. **"Riesgo de apartamiento" mezclaba ausencia de dato con señal
   real**: una persona sin `fecha_ultima_asistencia` contaba
   automáticamente como si llevara 45-89 días sin asistir. Se quitó esa
   señal automática -- ahora solo cuenta un hueco de asistencia real
   medido en días.
6. **"Composición" y "Evolución {frecuencia}" mostraban el mismo
   gráfico dos veces**. "Composición" ahora muestra una lista compacta
   de categorías (sin repetir el gráfico completo) y remite al detalle
   de "Evolución" más abajo.
7. **No existía ningún botón de exportar/descargar** en toda la
   pantalla. Se agregó "Descargar PDF" (reusa `descargarPdf()`) con los
   KPIs visibles + la tabla de evolución por categoría y periodo.

### Desperdicio de carga en distrital/nacional

8. El `useEffect` principal de carga (pensado solo para local) corría
   igual para distrital/nacional, aunque su resultado se descartaba
   por completo -- disparando de fondo consultas pesadas y sin
   filtrar: **todas** las alertas pastorales de la IPUC, 6 años de
   asistencia agregada sin filtro de congregación, y la tabla `amigos`
   completa. Ahora ese efecto corta al inicio si el rol no es local.
9. Se agregó un enlace "Ir a Pastoral Distrital" / "Ir a Gestión
   Pastoral Nacional" en el encabezado de `DashboardDistrital`/
   `DashboardNacional`, ya que comparten los mismos RPC de fondo pero
   antes no se enlazaban entre sí.
10. Se quitó el objeto `NIVEL_TITULO` (código muerto: sus claves
    distrital/nacional/super_admin nunca se leían, porque esos roles
    ya retornan antes de llegar a esa línea).

### Redundancia riesgosa aclarada o unificada

11. **"Vacantes de pastor"**: el Resumen (distrital y nacional) lo
    calculaba con `pastor_nombre is null` (texto denormalizado),
    mientras que Gestión Pastoral Nacional ya usaba `pastor_id is null`
    (la relación real). Se unificó a `pastor_id` en ambos lados
    (`resumen_distrital` ahora expone `pastor_id`;
    `resumen_nacional.sql` cambia su filtro) -- una sola fuente de
    verdad, para que las dos pantallas nunca muestren cifras distintas
    de "vacantes" para el mismo distrito.
12. **"Reconciliados"**: el Resumen usa una ventana móvil de 90 días,
    el Informe Trimestral usa el trimestre calendario exacto -- son
    legítimamente distintos, no se unificaron, pero se aclaró en el
    label ("Reconciliados (90 días)") y el tooltip.
13. **"Bautizados"**: el Resumen/cabecera de Feligresía muestran el
    total en vivo, el Informe Trimestral muestra una foto al cierre de
    un trimestre -- se agregó un tooltip aclaratorio en ambos lados en
    vez de forzarlos a coincidir (son conceptos distintos a propósito).

## Redundancia inofensiva (dejada tal cual, a propósito)

Tiles de feligresía/alertas activas repetidos entre Resumen y
Feligresía, KPIs de Amigos repetidos entre Resumen y Amigos.jsx, y
`resumen_distrital`/`cargos_vacantes` reusados en más de una pantalla
-- todos son el mismo dato, misma fuente, sin riesgo de inconsistencia.
No se tocaron: no vale el esfuerzo, y el usuario planea eliminar
módulos del sidebar más adelante, momento en el que conviene revisar
de nuevo si alguno de estos números queda huérfano.

## Verificación

`npm run build` sin errores en cada paso. Contra la base real (Puerto
Tejada Cauca Central, cuenta de prueba):
- Capturas de pantalla completas del Resumen local (scroll completo) --
  "Promedio por actividad" ahora en rojo con el texto correcto,
  "Composición" sin gráfico duplicado, "Amigos e integración" con
  datos reales, "Riesgo de apartamiento" ya no aparece para esta
  congregación (los falsos positivos por dato vacío desaparecieron).
- `resumen_distrital` confirmado devolviendo `pastor_id` real.
- `vw_resumen_feligresia.familias_asociadas` probado con un caso real
  (familia de una persona apartada no cuenta) -- coincide exactamente
  con el conteo manual solo-activos.
- Categorías demográficas de Puerto Tejada confirmadas con "Amigos"
  presente.
- Descarga de PDF del Resumen probada de extremo a extremo (clic real,
  descarga real, renderizado a imagen para inspección visual).
- Distrital y nacional: no se pudieron clickear como usuario real de
  esos roles (misma limitación de toda la sesión -- sin cuenta de
  prueba de ese nivel), pero los cambios de SQL se verificaron
  directamente vía RPC (sin error, columnas correctas).
