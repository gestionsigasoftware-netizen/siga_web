# Modelo 3: suscripción mensual por congregación

**Este es el modelo elegido por el usuario (dueño de SIGAP) el
2026-09-07, con precios ya decididos y definitivos** -- ver la tabla
de la sección siguiente. Las secciones de comparación y proyección de
este documento ya están actualizadas con esos precios finales, no con
los ejemplos genéricos de la primera versión de este análisis.

## En qué consiste

Cada congregación paga individualmente una cuota mensual por usar
SIGAP. Con ~4.000 a 5.000+ congregaciones en la IPUC, este es el
modelo con mayor volumen de clientes y, potencialmente, mayor ingreso
total acumulado.

## Precios definitivos (decisión del usuario, 2026-09-07)

| Tamaño de congregación | Feligreses | Precio/mes |
|---|---|---|
| Pequeña | 0 a 100 | **$29.990** |
| Mediana | 100 a 250 | **$59.990** |
| Grande | 250 a 500 | **$119.990** |
| Muy grande | Más de 500 | **$199.990** |

**Precios psicológicos deliberados** ("charm pricing" / efecto del
dígito izquierdo -- terminar en .990 en vez de un número redondo):
decisión de mercadeo del usuario, coherente en las 4 franjas. Es una
técnica bien documentada (Chicago/MIT) que funciona especialmente bien
en decisiones de compra individuales y numerosas como esta (miles de
pastores decidiendo cada uno por su cuenta), a diferencia de una
negociación institucional grande, donde lo normal es un número redondo
o a la medida.

Estas 4 franjas quedaron muy cercanas a los rangos que este análisis
había sugerido originalmente (pequeña ~30-40k, mediana ~60-80k, grande
~120-150k), con una cuarta franja nueva para congregaciones de más de
500 feligreses que el análisis inicial no contemplaba.

## ¿Los precios definitivos son razonables frente al mercado?

Comparado con el competidor más directo que existe -- **KHESED-TEK**,
colombiana, vendiendo a iglesias en toda Latinoamérica --, los 4
precios definitivos siguen siendo **entre 3 y 6 veces más baratos**
que sus planes equivalentes por tamaño (ver
[00-contexto-y-supuestos.md](00-contexto-y-supuestos.md) para el
detalle de KHESED-TEK):

| Franja SIGAP | Precio SIGAP/mes | Comparable KHESED-TEK más cercano | Precio KHESED-TEK/mes (COP aprox.) |
|---|---|---|---|
| Pequeña (0-100) | $29.990 | Semilla (hasta 150) | ~196.000 |
| Mediana (100-250) | $59.990 | Semilla/Cosecha | ~196.000-596.000 |
| Grande (250-500) | $119.990 | Cosecha (hasta 500) | ~596.000 |
| Muy grande (500+) | $199.990 | Reino (hasta 1.500) | ~1.196.000 |

**Lectura**: incluso con precio segmentado y una franja "muy grande"
nueva, SIGAP sigue posicionado como una opción de entrada bastante más
barata que el mercado -- coherente con la intención del usuario de
maximizar adopción dentro de la propia organización antes que
maximizar el ingreso por cliente individual desde el primer día.

## Por qué precio por tamaño y no precio plano

Un precio único para las 5.000+ congregaciones tendría un problema: una
congregación de 30 miembros en zona rural y una de 800 miembros en
Bogotá no tienen la misma capacidad de pago, ni usan SIGAP del mismo
modo (más comités, más feligreses, más volumen de datos y soporte). El
precio por tamaño ya decidido (ver tabla arriba) resuelve esto y
además ayuda a la adopción: una congregación pequeña que no podría
pagar $199.990/mes sí puede pagar $29.990, lo que **aumenta el número
de congregaciones dispuestas a inscribirse** en vez de perderlas por
precio.

## Proyección de ingresos (con los 4 precios definitivos)

No hay datos duros sobre cómo se distribuyen las 4.000-5.000+
congregaciones de la IPUC entre las 4 franjas de tamaño -- es un
**supuesto de trabajo**, marcado como tal, mientras el usuario no
tenga la cifra real. Usando una distribución típica de una
denominación nacional (muchas congregaciones pequeñas/rurales, pocas
grandes): **60% pequeña, 25% mediana, 10% grande, 5% muy grande**, el
precio promedio ponderado por congregación es:

```
0.60 × 29.990 + 0.25 × 59.990 + 0.10 × 119.990 + 0.05 × 199.990
≈ $54.990 COP/mes por congregación (promedio)
```

Usando ese promedio y el rango de congregaciones de
[00-contexto-y-supuestos.md](00-contexto-y-supuestos.md) (4.000-5.000+,
4.500 como punto medio), con distintos escenarios de adopción (nunca
se espera 100% desde el primer año):

| Adopción | # Congregaciones (sobre 4.500) | Ingreso mensual | Ingreso anual |
|---|---|---|---|
| 20% (arranque) | 900 | ~$49.490.000 | ~$593.900.000 |
| 50% (adopción media) | 2.250 | ~$123.730.000 | ~$1.484.700.000 |
| 80% (adopción alta) | 3.600 | ~$197.960.000 | ~$2.375.600.000 |
| 100% (todas) | 4.500 | ~$247.460.000 | ~$2.969.500.000 |

Con el rango completo de congregaciones (4.000 a 5.000) a adopción
total: entre **~$220.000.000 y ~$275.000.000 COP/mes** (~$2.640 y
~$3.300 millones/año). **Si la distribución real resulta con más
congregaciones grandes/muy grandes de lo supuesto aquí, el ingreso
real sería mayor** -- este cálculo es conservador por diseño.

**Comparación con el modelo 2** (licencia nacional plana): en el
ejemplo numérico de
[02-licencia-anual-mas-mantenimiento-ipuc.md](02-licencia-anual-mas-mantenimiento-ipuc.md),
una cuota nacional de ~179 millones COP/año equivale a solo ~3.300
COP/congregación/mes -- **muy por debajo** de lo que este modelo 3
generaría incluso a baja adopción (20%). Esta es la señal más
importante de este análisis: **cobrar por congregación individual
tiene mucho más techo de ingreso que un contrato nacional plano**,
aunque sea operativamente más complejo de administrar (recaudo
fragmentado, mora esperable, más trabajo de cobro).

## Riesgos y fricciones prácticas de este modelo

1. **Recaudo fragmentado**: cobrar a 4.000-5.000 congregaciones
   individuales exige una pasarela de pagos, recordatorios de pago,
   manejo de mora, y probablemente perder acceso (o degradar el
   servicio) a quien no pague -- esto es trabajo operativo real que no
   existe en el modelo 2.
2. **Capacidad de pago desigual**: ya mencionado -- resuelto
   parcialmente con precio por tamaño.
3. **Fricción de decisión**: cada congregación (normalmente su pastor)
   tiene que decidir individualmente inscribirse y pagar -- sin el
   respaldo/mandato de la nacional (modelo 2), la adopción puede ser
   más lenta al principio.
4. **Costo de soporte que SÍ crece con el volumen**: a diferencia de
   la infraestructura (que es casi plana), atender a 5.000
   congregaciones individuales con dudas, capacitación y soporte sí
   requiere más personas conforme crece la base -- hay que presupuestar
   esto en el precio, no asumir que todo es margen.

## Combinación posible: aval nacional + cobro individual

No es necesario elegir 100% entre modelo 2 y modelo 3. Una posibilidad
intermedia: la IPUC nacional **respalda/recomienda oficialmente**
SIGAP a todas sus congregaciones (sin pagar ella la cuenta), y cada
congregación paga su propia suscripción mensual. Esto da el impulso de
adopción del modelo 2 (mandato/respaldo institucional) sin perder el
techo de ingreso más alto del modelo 3. Ver más en
[04-comparacion-y-recomendacion.md](04-comparacion-y-recomendacion.md).
