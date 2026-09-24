# Comités (Feligresía): tooltips, placeholders y datos que se guardaban pero no se veían

**Fecha:** 2026-09-24
**Módulo:** `src/pages/FeligresiaAdmin.jsx` -- pestaña "Comités" (`CommitteeCreateForm`, `CommitteeFilters`, `AdminDialog`, tarjeta de comité)

## Contexto

El usuario reportó que el submódulo de Comités "no se entiende" --
nadie sabe qué es "código interno" ni qué significa "tipo", y varios
formularios no tienen placeholders que ayuden a saber qué escribir.
Pidió que un usuario final pueda entrar y entender en poco tiempo, sin
sentir que es difícil.

## Lo que se encontró al revisar el código real

- `CommitteeCreateForm` (crear comité): **ningún campo tenía
  placeholder** -- ni Nombre, ni Código interno, ni Descripción,
  Propósito u Observaciones. "Código interno" y "Tipo" no tenían
  ningún `InfoTip` explicando qué son (a diferencia del resto de esta
  misma página -- la ficha de Personas sí usa `InfoTip` extensamente).
- **Descripción y Propósito son dos campos de texto libre muy
  parecidos entre sí**, sin ninguna aclaración de en qué se
  diferencian -- fácil de confundir.
- El diálogo genérico "Editar comité" (`AdminDialog`) tampoco tenía
  placeholders ni tooltips -- su esquema de campos no soportaba esas
  propiedades en absoluto.
- **Hallazgo más importante**: la tarjeta de cada comité, después de
  creado, **no mostraba código, tipo, responsable ni fechas en
  ningún lado** -- solo el nombre y la lista de integrantes. Un
  usuario llenaba hasta 8 campos al crear un comité y después no veía
  reflejado casi nada de eso -- lo que probablemente explica buena
  parte del "no se entiende", porque no había forma de verificar que
  el dato se guardó ni de recordar qué significaba.

## Cambios

- **`CommitteeCreateForm`**: placeholder en cada campo de texto (con
  ejemplos concretos, ej. "Ej: Comité de Evangelismo"). `InfoTip` en
  "Código interno" (aclara que es de uso interno de la congregación,
  SIGAP no lo usa para nada más), "Tipo" (explica que viene del
  catálogo de Configuración → Tipos de comité), "Fecha de
  finalización" (aclara que se deja vacía si el comité es permanente),
  "Descripción" y "Propósito" (distingue explícitamente "qué ES" vs
  "para QUÉ existe").
- **`CommitteeFilters`**: `InfoTip` en "Vigencia" explicando la
  diferencia real entre "Vigentes" y "Vencidos" (verificado leyendo la
  lógica real del filtro, no supuesto) -- "vencidos" puede incluir
  comités que siguen marcados como activos, lo cual sin explicación es
  contraintuitivo.
- **Tarjeta de comité**: ahora muestra, cuando existen, código, tipo
  (resuelto por nombre desde el catálogo, no el id), responsable
  (nombre completo) y el rango de fechas -- y una sección expandible
  "Ver descripción y propósito" con ambos textos etiquetados ("Qué
  es"/"Para qué") para que la distinción quede clara también al leerlo,
  no solo al llenarlo.
- **`AdminDialog`** (diálogo genérico "Editar comité" y otros usos en
  la misma página): se le agregó soporte opcional de `placeholder` y
  `tip` por campo (retrocompatible -- los demás usos de este diálogo
  en el archivo, que no pasan esas propiedades, quedan exactamente
  igual). Aplicado a los campos de comité con el mismo texto que el
  formulario de creación. De paso, "Descripción" pasó de `<input>` de
  una sola línea a `<textarea>` -- un texto potencialmente largo
  forzado en un campo de una línea era en sí mismo un problema de
  usabilidad.
- **Formulario de asignar integrante**: título "Asignar integrante a
  un comité" con `InfoTip` explicando qué es el "Cargo" en ese
  contexto (el rol dentro del comité, ej. Presidente/Secretario).

## Verificación

1. `npm run build` sin errores.
2. Verificación real con login (cuenta de prueba, rol local) vía
   Playwright: los 6 placeholders nuevos aparecen exactamente con el
   texto esperado; los íconos de `InfoTip` aparecen en los 7 lugares
   nuevos (código, tipo, fecha fin, descripción, propósito, filtro de
   vigencia, encabezado de asignar integrante); captura de pantalla
   confirma el layout completo sin errores visuales ni de consola.
   Los comités reales de esa congregación ("Comite Alabanza", "Comite
   de Escuela Dominical") se siguen viendo bien -- no muestran la
   línea de metadatos nueva porque, correctamente, no tienen
   código/tipo/responsable registrados.
