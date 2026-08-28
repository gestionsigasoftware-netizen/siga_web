# Revisión de Amigos en ruta

Fecha: 28 de agosto de 2026
Estado: revisión inicial ejecutada

## Funcionalidad encontrada

- Registro y edición de personas en ruta.
- Etapas configurables por congregación.
- Zonas, metodologías de Evangelismo y categorías.
- Búsqueda, filtro por etapa y paginación.
- Notas de acompañamiento.
- Marcación de bautismo.
- Incorporación transaccional a Feligresía mediante `incorporar_amigo_bautizado`.
- RLS por congregación y zona mediante `tengo_acceso_zona`.

## Correcciones aplicadas

- La UI consulta `evangelismo.editar` y considera roles locales operativos; los perfiles `solo_lectura` quedan en consulta.
- Las operaciones de alta, edición, cambio de estado, incorporación, eliminación y notas verifican autorización antes de ejecutarse.
- Los formularios de escritura se ocultan para perfiles de consulta.
- Las métricas de acompañamiento y conversión usan conteos globales de Supabase y no solo la página visible.
- La ficha muestra una cronología de etapas con fecha, usuario y etapa anterior/nueva.
- El módulo muestra métricas globales por etapa, zona y metodología, además de una señal prudente de contactos con más de 30 días.

## Pendientes reales

- Crear insights prudentes sobre personas sin contacto reciente, sin inferir compromiso o valor.
- Administrar catálogos de etapas y zonas desde una interfaz autorizada.
- Incorporar fechas de nacimiento y estado civil al alta/edición general, no solo al traslado a Feligresía.
- Probar en Supabase el aislamiento entre congregaciones y zonas, además de perfiles pastor, líder territorial y solo lectura.
- Revisar la sincronización operativa con los registros agregados de Evangelismo sin duplicar la captura de la PWA.

## Validación

- `npm run build`: correcto.
- Diagnósticos de `Amigos.jsx` e `index.css`: sin errores.
- Las pruebas de RLS y comportamiento real contra Supabase todavía no se han ejecutado.
