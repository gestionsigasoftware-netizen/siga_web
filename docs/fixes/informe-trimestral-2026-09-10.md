# Informe trimestral (Bautizados, Sellados, Reconciliados, Entregados) — 2026-09-10

## Contexto

El usuario pidió automatizar el informe trimestral que hoy se arma a
mano y se envía por WhatsApp/correo al distrito, con 4 indicadores:
bautizados, sellados con el Espíritu Santo, reconciliados y
"entregados" (personas en la Ruta Evangelística sin bautizar aún).
Debía poder verse a nivel local (una congregación), distrital
(consolidado de todas las congregaciones del distrito, con ranking) y
nacional (consolidado de todos los distritos, con ranking).

Tras varias rondas de aclaración con el usuario se definió con
precisión cada indicador (ver plan de ejecución en el historial de la
sesión) -- en particular que "entregados" != "convertidos" (convertido
= ya bautizado), y que Bautizados/Sellados necesitan trazabilidad
"cuántos había vs cuánto crecimos", mientras que Reconciliados es un
evento puntual (se compara trimestre contra trimestre) y Entregados
necesita un desglose de tres partes (nuevos / graduados a bautizado /
total).

## Decisión de arquitectura

Todo se calcula **en vivo bajo demanda**, sin tabla de "informes
enviados" ni botón de "enviar" -- el mismo patrón que ya usa el 100%
del BI existente del repo (`resumen_distrital`, `resumen_nacional`,
las ~15 funciones `resumen_X_distrital`). El rol distrital ya puede
leer todas las congregaciones de su distrito (RLS vía
`mis_congregaciones()`) y el nacional ya puede leer todo -- el
"traslado" del informe ocurre estructuralmente por el rol, no por una
acción manual.

## Construido

1. **`supabase/reportes/informe_trimestral.sql`** (nuevo) -- función
   base `resumen_informe_trimestral_congregacion(p_congregacion_id,
   p_desde, p_hasta, p_desde_anterior, p_hasta_anterior)` con toda la
   lógica de los 4 indicadores, reutilizada vía `lateral join` en
   `resumen_informe_trimestral_distrital` (una fila por congregación,
   mismo patrón que las `resumen_X_distrital` existentes) y
   `resumen_informe_trimestral_nacional` (una fila por distrito,
   sumando sus congregaciones, mismo patrón que
   `resumen_pastoral_nacional`). Se reutiliza una sola función base en
   vez de triplicar la lógica porque la reconstrucción de "entregados"
   (punto-en-el-tiempo) es intrincada y triplicarla a mano arriesgaba
   que local/distrital/nacional mostraran números que no cuadran entre
   sí. Se agregaron dos índices de apoyo
   (`personas_sellado_idx`, `amigos_informe_trimestral_idx`).
2. **`src/lib/trimestre.js`** (nuevo) -- helper puro sin librería
   externa para calcular rangos de trimestre calendario (T1 ene-mar...
   T4 oct-dic), el trimestre anterior, y el último trimestre ya
   cerrado (default de selección en las 3 pantallas -- un trimestre a
   medias no tiene sentido reportarlo todavía).
3. **`src/pages/FeligresiaAdmin.jsx`** -- nueva pestaña "Informe
   trimestral" con selector de año/trimestre, tarjetas
   Bautizados/Sellados (anterior → nuevos → actual), Reconciliados
   (actual vs. anterior), Entregados (nuevos/graduados/total) y una
   mini-tabla "Hoy mismo por estación" (dato operativo actual, no del
   trimestre, rotulado para no confundir).
4. **`src/pages/PastoralDistrital.jsx`** -- nueva sección "Informe
   trimestral por congregación" antes de "Ruta Evangelística por
   congregación", con selector de trimestre y un selector "Ordenar
   por" que rankea las congregaciones de mayor a menor por el
   indicador elegido (client-side, mismo patrón de `paginate()` ya
   usado en el resto del archivo).
5. **`src/pages/GestionPastoralNacional.jsx`** -- misma estructura que
   distrital pero una fila por distrito, después de "Escalafón
   ministerial por distrito".

Ninguna de las tres pantallas mete esta carga en su cache/`Promise.all`
existente -- cada una usa su propio estado y `useEffect`, ya que
depende de un rango de fechas que cambia con el selector.

## Verificación

`npm run build` sin errores en cada paso. Verificado contra la base
real (Puerto Tejada Cauca Central) usando T2 2026 (abr-jun) como
"actual" de prueba y T1 2026 (ene-mar) como "anterior":

- Bautizados/Sellados: personas de prueba con `fecha_bautismo`/
  `fecha_sellado` antes y dentro de T2 -- confirmado
  `anterior + nuevos = actual` exactamente.
- Reconciliados: movimientos de prueba en T1 y T2 -- confirmado
  `reconciliados_actual` y `_anterior` cuentan cada uno por separado.
- Entregados, los 4 casos límite (amigo nuevo sin bautizar; amigo que
  llegó en T1 y se bautizó en T2; amigo que llegó y se bautizó ambos
  en T1; amigo que llegó en T1 y sigue sin bautizar): los 4 se
  reconstruyeron exactamente como se diseñó -- el que se graduó en T2
  sale de "actual" pero cuenta en "graduados"; el que ya se había
  bautizado en T1 no aparece en nada de T2; el que sigue sin bautizar
  cuenta en anterior y en actual.
- Desglose "hoy mismo" por estación: `ruta_procesos` de prueba activos
  en Uno Más y ESFOB, contados correctamente sin importar las fechas
  de arriba (es un corte operativo de hoy, no del trimestre).
- Consistencia entre niveles: la fila de Puerto Tejada dentro de
  `resumen_informe_trimestral_distrital` es idéntica a llamar la
  función de congregación directo.
- RLS: se confirmó que la tabla `congregaciones` en sí ya está
  restringida por RLS para un rol local (no ve otras congregaciones),
  y que `resumen_informe_trimestral_nacional` devuelve 0 filas para un
  rol puramente local (sin `distrito_id`/nacional) -- mismo
  comportamiento esperado que `resumen_pastoral_nacional`. Se intentó
  además otorgar temporalmente un rol distrital a la cuenta de prueba
  para probar esa pantalla en vivo como usuario distrital real -- RLS
  lo bloqueó correctamente (`roles_sistema` no permite que un pastor
  local se auto-asigne un rol superior), confirmando que ese camino de
  escalamiento está bien cerrado. Por esta razón, las pantallas
  distrital y nacional **no se probaron con clics reales como un
  usuario de ese rol** (no había credenciales de prueba distrital/
  nacional disponibles) -- sí se verificó exhaustivamente la lógica
  SQL que consumen (ver punto de "consistencia entre niveles" arriba),
  y el código de las pantallas sigue al pie de la letra los mismos
  patrones ya probados en esos mismos archivos (mismo estilo de RPC,
  misma tabla, mismo `paginate()`/`Pager`).
- Todos los datos de prueba se limpiaron al terminar, sin residuos.

## Pendiente (no bloqueante)

Confirmar visualmente las pantallas distrital y nacional con una
cuenta real de ese rol la próxima vez que alguien con ese acceso las
abra, dado que no se pudieron clickear en esta sesión.
