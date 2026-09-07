# Sugerencia visible de comités por edad/sexo — 2026-09-07

## Contexto

Segundo ítem del plan de cierre del rediseño Ruta Evangelística +
comités. Conecta el catálogo ya construido en la pieza anterior
(`rangos_edad_comite`, `src/lib/comitesPorPoblacion.js`) a las dos
pantallas donde el usuario pidió verla: el Censo de Feligresía (para
no bautizados, ej. hijos de creyentes que administra Escuela
Dominical) y Amigos en ruta (no convertidos). Es puramente
informativo -- nunca traslada ni asigna a nadie automáticamente.

## Construido

**`src/pages/FeligresiaAdmin.jsx`:**
- Import de `getRangosEdadComite`/`sugerirComites` de
  `src/lib/comitesPorPoblacion.js` (se reutiliza el `calcularEdad`
  local del archivo, ya existente, en vez de importar el de la
  librería, para no duplicar la función con dos firmas distintas).
- Estado nuevo `rangosEdad`, cargado una vez por `congregacionId` en
  un `useEffect` independiente del `load()` cacheado de la pantalla.
- `PersonFormEditor` recibe `rangosEdad` como prop y muestra "Comités
  sugeridos: X, Y" justo después del bloque "Participación y
  responsabilidades", solo cuando `editing` es true y hay al menos una
  sugerencia (sin fecha de nacimiento o sin coincidencias, no se
  muestra nada).

**`src/pages/Amigos.jsx`:**
- Mismo patrón: import de las mismas funciones, estado `rangosEdad`
  cargado una vez por `congregacionId`.
- Línea de sugerencia insertada inmediatamente después de cerrar la
  sección "Estación actual" de la Ruta Evangelística, usando
  `selected.fecha_nacimiento`, `selected.genero` y
  `editForm.estado_civil` (ya en estado, sin fetch adicional por
  persona).

## Verificación

Contra la base de datos real (congregación Puerto Tejada Cauca
Central), con el usuario de prueba `pueba691@gmail.com`:

1. Se creó un rango de prueba (18-30 años, femenino) apuntando a un
   comité real de la congregación.
2. La consulta `getRangosEdadComite` lo trae con el nombre del comité
   embebido correctamente (`comites(nombre)`).
3. Una mujer de ~25 años recibe la sugerencia; un hombre de la misma
   edad no (filtro de género respetado).
4. El texto exacto que renderizarían ambas pantallas
   (`comitesSugeridos.map(r => r.comites?.nombre).filter(Boolean).join(', ')`)
   se armó correctamente.
5. Limpieza completa, sin residuos.

`npm run build` sin errores en ambos archivos.

## Pendiente

Siguen los últimos dos ítems del plan de cierre: botón "Vincular" en
la entrada inicial de Obra Carcelaria (pestaña Internos), y botón
"Reasignar comité" independiente del traslado.
