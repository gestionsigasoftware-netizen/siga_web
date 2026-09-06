# Documentacion de SIGA

Esta carpeta contiene la memoria tecnica y operativa del proyecto SIGA,
organizada por tipo (reordenado el 2026-09-06 -- antes eran ~70 archivos
sueltos en un solo nivel).

## Estructura

- **[`pendientes.md`](pendientes.md)** (raiz): trabajo pendiente y bitacora
  de lo resuelto, ordenado por prioridad. Es el documento mas activo --
  cada sesion le agrega entradas nuevas.
- **`arquitectura/`**: documentos de referencia que describen el sistema
  como un todo -- arquitectura, estado del proyecto, seguridad,
  despliegue, planes funcionales por area, e investigacion de fondo
  (metodologia IPUC).
- **`auditorias/`**: rondas de auditoria y QA -- revisiones completas de
  un modulo o de toda la app en un momento dado, con sus hallazgos.
- **`fixes/`**: correcciones puntuales a un bug o comportamiento
  especifico ya existente (visual, RLS, datos, nombres, SEO, etc.).
- **`funcionalidades/`**: implementacion de una funcionalidad o modulo
  nuevo (o una fase de uno), de principio a fin.

Documentos clave dentro de `arquitectura/`:

- [Estado del proyecto](arquitectura/estado-proyecto.md): funciones terminadas, validaciones y estado actual.
- [Arquitectura](arquitectura/arquitectura.md): frontend, autenticacion, Supabase y modelo multi-tenant.
- [Seguridad de produccion](arquitectura/seguridad-produccion.md): controles implementados, pendientes y checklist de salida.
- [Despliegue y operacion](arquitectura/despliegue-operacion.md): instalacion, migraciones y puesta en produccion.
- [Plan funcional de Feligresía y Red de Familias](arquitectura/plan-funcional-feligresia-red-familias.md): propósito, límites, métricas, criterios éticos y hoja de ruta.
- [Plan funcional de Comités](arquitectura/plan-comites-feligresia.md): responsabilidades, cargos, vigencias, permisos, métricas y fases de fortalecimiento.

Para un documento de `funcionalidades/`, `fixes/` o `auditorias/` en
concreto, es mas rapido buscar por nombre/fecha (`grep` o el buscador del
editor) que navegar un indice -- son ~70 archivos y creciendo.

La interfaz publica minima vive en `/`, `/ayuda` y `/legal`. La politica legal
incluida en la aplicacion es una base pendiente de completar con los datos del
responsable institucional y revisar juridicamente antes de produccion.

## Regla de mantenimiento

Cada cambio relevante debe quedar documentado por escrito aqui, no solo
discutido en el chat -- un archivo nuevo en `fixes/`, `funcionalidades/`
o `auditorias/` segun corresponda (ver la estructura arriba), y una
entrada en `pendientes.md`.
