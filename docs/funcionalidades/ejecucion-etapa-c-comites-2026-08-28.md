# Ejecución Etapa C: análisis de comités

Fecha: 28 de agosto de 2026
Estado: Parcial ejecutada; quedan validaciones y mejoras documentadas

## Plan aplicado

1. Calcular comités activos y vigentes desde el censo local.
2. Contabilizar integrantes y cargos obligatorios cubiertos.
3. Identificar vacantes, comités sin integrantes y comités sin responsable.
4. Medir personas disponibles y concentración de responsabilidades.
5. Detectar responsabilidades con vencimiento dentro de 90 días.
6. Mostrar insights con interpretación prudente y acción sugerida.
7. Consultar historial persistido de `auditoria_feligresia` para comités y membresías.
8. Exportar análisis y cambios recientes en CSV.
9. Mantener la analítica dentro de la pestaña Evolución de Feligresía.

## Resultado

La pantalla `FeligresiaAdmin` incorpora el bloque `CommitteeAnalytics` dentro de Evolución. El cálculo usa `comites`, `membresias_comite`, `cargos_comite`, `personas` y `auditoria_feligresia`, respetando el aislamiento por congregación ya aplicado en las consultas y RLS.

Las métricas distinguen cargos obligatorios cubiertos de integrantes totales. Una persona sin participación se presenta como disponible, sin etiquetarla negativamente. La concentración se informa únicamente cuando una persona tiene más de una responsabilidad vigente.

## Validación

- `npm run build`: correcto.
- Diagnósticos de `src/pages/FeligresiaAdmin.jsx`: sin errores.
- La exportación incluye resumen de comités activos y cambios recientes de comités/membresías.

## Pendiente no ejecutado

- La búsqueda de personas para asignar integrantes todavía usa la lista local
	cargada por la pantalla; no es un buscador remoto.
- El catálogo de tipos y cargos existe en SQL, pero no tiene todavía una
	pantalla de administración.
- El responsable y los campos normalizados ya se pueden capturar en el nuevo
	formulario de alta; falta completar su edición avanzada en el detalle.
- Los permisos específicos de comités aún no están separados completamente
	del permiso general de edición de Feligresía.
- La tabla accesible alternativa para el análisis y los filtros propios del
	historial no están terminados.
- No se ejecutaron todavía pruebas reales contra Supabase de concurrencia,
	aislamiento entre congregaciones, fechas superpuestas, reemplazos y perfiles.
- El cálculo de responsabilidades próximas a vencer requiere una revisión de
	datos para incluir registros con fecha de finalización dentro del periodo.

## Seguimiento pastoral revisado

- La agenda permite filtrar por pendiente, completado, cancelado o todos.
- La agenda permite buscar por persona o acción.
- La validación de fechas del próximo contacto existe en interfaz y SQL.
- Las acciones de escritura se ocultan visualmente en modo de solo lectura.

## Pendiente fuera de esta etapa

Las pruebas A/B de aislamiento, concurrencia y usabilidad con usuarios reales corresponden a la Etapa E y deben ejecutarse contra el proyecto Supabase después de aplicar el SQL actualizado.
