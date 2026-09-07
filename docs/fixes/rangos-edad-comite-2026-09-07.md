# Catálogo de rangos de edad → comités — 2026-09-07

## Contexto

Segunda pieza del rediseño más amplio que el usuario planteó
(extramural alimenta a intramural vía la Ruta Evangelística, con
comités locales como responsables). Antes de poder sugerir a qué
comité le corresponde una persona por edad/sexo, hacía falta el
catálogo base -- esta pieza es solo eso, sin conectarlo todavía a
ninguna pantalla de sugerencia (esa es la siguiente).

Modelo confirmado con el usuario: una misma persona puede caer en
**varios rangos a la vez** (ej. una mujer soltera de 20 años puede
corresponderle Señoritas, Adolescentes, Jóvenes y Damas Dorcas según
el plan de trabajo de cada comité) -- por eso el catálogo no es una
relación uno a uno, y cada congregación define sus propios rangos (a
diferencia de las estaciones de la Ruta Evangelística, que sí son un
estándar nacional de la IPUC).

## Hallazgo antes de construir

`amigos` (los no convertidos) **nunca tuvo campo de género** -- solo
`personas` lo tenía (agregado en `catalogos/genero_personas.sql` para
la pirámide poblacional). Sin esto, la sugerencia nunca podría
aplicar a la mitad de la población que pidió el usuario (los que
apenas empiezan, sin bautizar). Se agregó como parte de esta misma
pieza.

## Construido

**`supabase/catalogos/rangos_edad_comite.sql`**:
- `amigos.genero` (nullable, `masculino`/`femenino`, igual patrón que
  `personas.genero`).
- Tabla `rangos_edad_comite`: `nombre`, `edad_desde`, `edad_hasta`
  (nulo = sin tope), `genero` y `estado_civil` opcionales (nulo =
  aplica a cualquiera), `comite_id` (obligatorio, referencia a
  `comites`). RLS igual patrón que `comites`/`tipos_comite`
  (`puede_administrar_feligresia` para escribir).

**`src/lib/comitesPorPoblacion.js`** (nuevo):
- `calcularEdad(fechaNacimiento)` -- edad en años cumplidos.
- `getRangosEdadComite(congregacionId)` -- trae el catálogo activo con
  el nombre del comité embebido.
- `sugerirComites({ edad, genero, estadoCivil }, rangos)` -- filtra
  los rangos que aplican, puede devolver varios a la vez (a
  propósito).

**`src/pages/Modulos.jsx`**: nueva sección "Rangos de edad y comités"
-- alta con nombre, edad desde/hasta, género, estado civil (todos
opcionales salvo nombre/edad desde/comité), lista con editar/activar,
igual patrón que los demás catálogos de esa pantalla (caracteres de
culto, lecciones). Avisa si la congregación aún no tiene comités
activos, ya que sin eso no se puede configurar nada.

**`src/pages/Amigos.jsx`**: campo "Género" nuevo en la ficha general
del amigo (junto a fecha de nacimiento, que ya existía), guardado por
la misma acción "Guardar cambios" de siempre.

## Verificación

Contra la base de datos real, con datos desechables:

1. Crear un rango "Señoritas" (15-25, femenino, soltera) → un comité.
2. Crear un segundo rango solapado en edad pero sin filtro de género →
   otro comité (confirma que varios comités pueden aplicar a la misma
   franja de edad).
3. El catálogo trae ambos con el nombre del comité embebido.
4. Una mujer soltera de 20 años recibe **ambas** sugerencias.
5. Un hombre de 20 años recibe solo la que no filtra por género (no la
   de "Señoritas").
6. Alguien fuera del rango de edad no recibe ninguna sugerencia.
7. Editar y desactivar un rango funciona y se refleja correctamente.
8. `amigos.genero` se guarda sin problema.

Todo limpiado sin residuos. `npm run build` sin errores.

## Pendiente

La sugerencia todavía no se muestra en ninguna pantalla (Censo de
Feligresía, Amigos en ruta) -- esa es la siguiente pieza acordada con
el usuario. Después de esa sigue el botón "Reasignar comité"
(independiente del traslado) y el botón "Vincular" en Misión Juvenil.
