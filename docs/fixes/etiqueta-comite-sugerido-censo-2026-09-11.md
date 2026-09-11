# Etiqueta "Sugerido: X" en el censo de Feligresía (2026-09-11)

## Contexto

La sugerencia de comité por edad/género/estado civil (catálogo
`rangos_edad_comite`, `sugerirComites()`) ya existía desde el
2026-09-07, pero solo se veía dentro de la ficha individual de cada
persona -- si nadie abría esa ficha puntual, la sugerencia quedaba
invisible. El usuario pidió que fuera visible directamente en la
lista, para detectar de un vistazo a quién le falta asignación.

## Corregido

`src/pages/FeligresiaAdmin.jsx`, pestaña "Población": cada fila ahora
muestra una etiqueta **"Sugerido: <comité>"** cuando la persona:
- está bautizada,
- no tiene ya un comité activo (`membresias_comite` sin `fecha_fin`),
- y encaja en al menos un rango del catálogo de edad/género/estado
  civil configurado en Módulos.

Si encaja en varios comités a la vez (ej. una mujer joven que
corresponde a Damas Dorcas y a Jóvenes), se listan todos separados por
coma -- sigue siendo solo informativo, no asigna nada por sí sola (la
asignación real sigue siendo manual desde la pestaña "Comités").

## Verificación

Probado contra la base real (Puerto Tejada Cauca Central): esa
congregación no tenía ningún rango de edad configurado todavía, así
que se insertó temporalmente uno de prueba (hombres 18-40 →
"Comité de Evangelismo"), se confirmó que la etiqueta apareció
correctamente solo en la única persona que encajaba (masculino, 31
años, soltero) y en ninguna otra, y se eliminó el dato de prueba sin
dejar residuos. `npm run build` sin errores.
