# Placeholders y tooltips en toda la app (no solo Feligresía)

**Fecha:** 2026-09-24
**Módulos:** Feligresía (Población, Familias, Historial de cargos),
Damas Dorcas, Conquistadores, Escuela Dominical, Amigos en ruta,
Misión Juvenil, Obra Carcelaria, Obra Social, Pastoral Distrital,
Perfil, SEPRI, Configuración.

## Contexto

El usuario pidió explícitamente extender la revisión de claridad
(tooltips, placeholders, ayudas para el usuario final) que se venía
haciendo submódulo por submódulo en Feligresía a **toda la web**, y
señaló que en la vuelta anterior de este mismo pedido solo se entregó
la parte de caza de bugs (ver
[[project_siga_barrido_bugs_masivo_2026_09_24]]), sin la parte de
tooltips/placeholders que también había pedido.

## Feligresía: lo que faltaba de las 3 pestañas ya revisadas

Las pestañas "Evolución", "Informe trimestral" y "Salud y emergencias"
ya estaban bien explicadas de sesiones anteriores (subtítulos claros
bajo cada gráfico, InfoTips en los conceptos no obvios como
"Retención por cohorte" o "Entregados"). Las que sí tenían huecos
reales:

- **Población**: las etiquetas "Nuevo bautizado · Xd en Discipulado"
  y "Sugerido: X" aparecen en cada fila del censo sin ninguna
  explicación de qué significan ni de dónde salen. Se agregó un
  `InfoTip` único arriba de la lista (no uno por fila, para no
  saturar) explicando ambas: la primera es una ventana temporal de
  seguimiento post-bautismo; la segunda es una sugerencia automática
  basada en el catálogo de Configuración → Rangos de edad por comité,
  que no asigna nada por sí sola.
- **Familias**: los placeholders "Dirección" y "Teléfono" repetían
  el nombre del campo sin dar ejemplo. Corregidos con ejemplos reales
  y aclarando que son opcionales.

## Barrido de placeholders repetidos en toda la app

Se buscó el mismo patrón exacto encontrado en Feligresía (placeholder
que solo repite el nombre del campo, sin ejemplo) en todo `src/pages`
con una búsqueda de texto dirigida (`Teléfono`, `Dirección`, `Nombre`,
`Observaciones`, `Notas`, `Descripción`, `Código`, etc.), y se
corrigió cada coincidencia real con un ejemplo concreto:

- `DamasDorcas.jsx`: descripción de actividad, nombres/apellidos y
  contacto de una beneficiaria.
- `Conquistadores.jsx`: descripción de actividad, nombres/apellidos
  de un miembro.
- `EscuelaDominical.jsx`: nombres/apellidos de un niño.
- `Amigos.jsx`: contacto de emergencia (nombre, teléfono, parentesco)
  -- el teléfono y el parentesco no tenían ninguna etiqueta visible
  aparte del placeholder, así que este caso era el más crítico.
- `MisionJuvenil.jsx`: nombres/apellidos de un estudiante.
- `ObraCarcelaria.jsx`: nombres/apellidos de un interno, notas del
  interno, notas del culto, observaciones del delegado, contacto y
  notas del seguimiento familiar.
- `ObraSocial.jsx`: notas de un caso.
- `PastoralDistrital.jsx`: ciudad y dirección de un centro
  penitenciario.
- `Perfil.jsx`: nombres/apellidos del propio usuario.
- `Sepri.jsx`: observaciones de un delegado.
- `Configuracion.jsx`: código de un cargo de comité (sin ejemplo antes,
  un admin nuevo no sabía qué formato esperar).
- `FeligresiaAdmin.jsx` (`CargoPanel`, historial de cargos de una
  persona): nombre del cargo, área y observaciones.

En todos los casos se siguió el mismo criterio: un ejemplo realista
en vez de repetir la etiqueta, y "(opcional)" cuando el campo no es
obligatorio.

## Lo que NO se tocó y por qué

- Los `<input>`/`<select>` que ya tienen una `<label>` visible al
  lado (la mayoría del formulario grande de personas,
  `PersonFormEditor`) no se tocaron: el problema que resuelve un
  placeholder (campo sin ninguna pista de qué escribir) no aplica
  igual cuando ya hay una etiqueta visible explicando el campo.
- Los componentes de analítica ya revisados en sesiones anteriores
  (`CommitteeAnalytics`, `HealthAnalytics`, `FeligresiaInsights`,
  `InformeTrimestralLocal`) ya tenían subtítulos e InfoTips
  adecuados -- no se encontró ningún hueco real ahí.

## Verificación

1. `npm run build` sin errores.
2. Playwright + login real (`pueba691@gmail.com`, rol local): la
   leyenda de "Qué significan las etiquetas" aparece en Población, y
   el placeholder real de Dirección aparece en Familias. Sin errores
   de consola.

## Pendiente

El resto de la app (Red de Familias, Evangelismo, Música, Educación
Artística/Teológica, Reportes, Configuración del resto de catálogos,
Auditoría, Equipo de trabajo, Suscripciones, etc.) todavía no se ha
revisado con este mismo nivel de detalle en esta ronda -- queda para
la siguiente pasada.
