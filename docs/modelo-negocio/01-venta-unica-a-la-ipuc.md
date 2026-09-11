# Modelo 1: venta única del software a la IPUC

## En qué consiste

La IPUC paga una sola vez y se convierte en dueña (o dueña de una
licencia perpetua) del software. No hay pago recurrente después de esa
transacción (salvo que se negocie mantenimiento aparte, lo cual ya
sería mezclarlo con el modelo 2).

## Por qué es el más difícil de poner precio

A diferencia de un producto con historial de ventas o ingresos
recurrentes ya probados (que se puede valorar por múltiplos de
ingreso), SIGAP hoy es un **software a la medida con un solo cliente
potencial** (la IPUC) -- no hay mercado comparable de "cuánto vale
este software" porque no es un producto que se revenda tal cual a
otros. Esto significa que el precio no lo fija "el mercado", lo fija
la negociación entre las dos partes, y ahí el punto de partida más
defendible es el **costo de reconstrucción/costo hundido**, no el
"valor" abstracto del software.

## Cómo estimar un precio de venta única (método costo-plus)

```
Precio de venta = (costo de desarrollo ya invertido + costo de
                    terminar lo que falte) × factor de margen
```

- **Costo de desarrollo ya invertido**: horas reales × tarifa/hora
  equivalente de un desarrollador senior full-stack en Colombia para
  este tipo de proyecto (multi-tenant, RLS, PWA, múltiples módulos).
  Esta cifra el usuario la tiene mejor que cualquier búsqueda externa
  -- es lo primero que hay que poner sobre la mesa.
- **Factor de margen**: para software a la medida vendido una sola vez,
  un múltiplo de 2x a 4x el costo de desarrollo es razonable en
  Colombia para software empresarial custom (cubre el riesgo de no
  tener ingreso recurrente después, y el valor de la propiedad
  intelectual transferida).

## El problema de fondo con este modelo

**Vender una sola vez mata el negocio recurrente.** Una vez la IPUC es
dueña del software:

1. No hay ingreso mensual/anual futuro para SIGAP -- se convierte en
   un proyecto cerrado, no en una empresa de software.
2. La IPUC tendría que asumir ella misma (o contratar a alguien más)
   el mantenimiento, las nuevas funcionalidades, la infraestructura y
   el soporte a las 5.000 congregaciones -- una carga operativa que
   una organización religiosa normalmente no está estructurada para
   asumir bien.
3. Si en el futuro la IPUC quiere que SIGAP siga mejorando el software,
   tocaría **volver a negociar cada mejora como un contrato nuevo**, lo
   cual es más lento e ineficiente que un modelo de licencia continua.

## Cuándo SÍ tendría sentido este modelo

- Si el usuario prefiere una salida de una sola vez (liquidez
  inmediata) sobre construir un negocio recurrente a largo plazo.
- Si la relación con la IPUC no es lo suficientemente estable como
  para apostar a un ingreso recurrente de años.
- Como **complemento**, no sustituto: vender el "código base" a la
  IPUC pero mantener un contrato de soporte/mantenimiento aparte (esto
  en la práctica termina pareciéndose al modelo 2).

## Recomendación de este documento

Este es el modelo con **menor potencial de ingreso total en el tiempo**
de los tres (una IPUC de 5.000 congregaciones representa años de
ingreso recurrente si se cobra por uso, ver modelo 3) y el que más
poder de negociación cede de una sola vez. Solo tendría sentido si el
usuario prioriza liquidez inmediata sobre crecimiento del negocio -- ver
la comparación completa en
[04-comparacion-y-recomendacion.md](04-comparacion-y-recomendacion.md).
