# Documentacion de SIGA

Esta carpeta contiene la memoria tecnica y operativa del proyecto SIGA.

## Documentos

- [Estado del proyecto](estado-proyecto.md): funciones terminadas, validaciones y estado actual.
- [Arquitectura](arquitectura.md): frontend, autenticacion, Supabase y modelo multi-tenant.
- [Seguridad de produccion](seguridad-produccion.md): controles implementados, pendientes y checklist de salida.
- [Despliegue y operacion](despliegue-operacion.md): instalacion, migraciones y puesta en produccion.
- [Pendientes](pendientes.md): trabajo pendiente ordenado por prioridad.
- [Plan funcional de Feligresía y Red de Familias](plan-funcional-feligresia-red-familias.md): propósito, límites, métricas, criterios éticos y hoja de ruta.
- [Ejecución de Red de Familias](red-familias-implementacion-2026-08-28.md): alcance de la primera entrega, migración y validación.
- [Plan funcional de Comités](plan-comites-feligresia.md): responsabilidades, cargos, vigencias, permisos, métricas y fases de fortalecimiento.

La interfaz publica minima vive en `/`, `/ayuda` y `/legal`. La politica legal
incluida en la aplicacion es una base pendiente de completar con los datos del
responsable institucional y revisar juridicamente antes de produccion.

## Regla de mantenimiento

Cada cambio relevante debe actualizar el documento correspondiente. Cuando una tarea se termine, debe moverse de `pendientes.md` a `estado-proyecto.md` y anotarse la fecha o la migracion que la habilito.
