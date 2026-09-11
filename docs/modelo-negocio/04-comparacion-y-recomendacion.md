# Comparación de los tres modelos y recomendación

## Tabla comparativa

| Criterio | 1. Venta única | 2. Licencia nacional (IPUC) | 3. Suscripción por congregación |
|---|---|---|---|
| Ingreso recurrente | No | Sí | Sí |
| Techo de ingreso a largo plazo | Bajo (un solo pago) | Medio (limitado por lo que un solo cliente institucional puede/quiere pagar) | Alto (~$2.640-3.300 millones COP/año a adopción total, ver modelo 3) |
| Riesgo de concentración | N/A (ya se cobró) | Alto -- un solo cliente, si se va se pierde el 100% | Bajo -- 4.000-5.000 clientes independientes |
| Complejidad de cobro | Baja (un pago) | Baja (un pago anual) | Alta (recaudo fragmentado, mora, pasarela de pagos) |
| Velocidad de adopción esperada | Inmediata (ya es dueña) | Rápida si hay mandato nacional | Gradual, depende de cada congregación |
| Control sobre el producto después | Se pierde (ya no es de SIGAP) | Se conserva | Se conserva |
| Depende de aprobación política/institucional | Sí, una sola vez | Sí, cada renovación | No (cada congregación decide sola) |
| Sensibilidad a capacidad de pago desigual | No aplica | No aplica (un solo pago nacional) | Alta -- mitigable con precio por tamaño |

## Recomendación

**El modelo 3 (suscripción por congregación), con precio segmentado
por tamaño en vez de precio plano, es el que tiene más sentido como
motor de ingreso principal** -- por tres razones concretas que salen
de este análisis:

1. La arquitectura de SIGAP (multi-tenant sobre una sola base de
   datos) hace que el costo marginal de sumar congregaciones sea bajo
   -- el modelo económicamente más alineado con "muchos clientes
   pagando poco" es precisamente el que la arquitectura ya soporta sin
   fricción técnica.
2. El techo de ingreso es muchísimo más alto que el modelo 2 (un
   contrato nacional plano corre el riesgo real de terminar cobrando
   el equivalente a unos pocos miles de pesos por congregación al mes,
   muy por debajo de lo que cada una individualmente pagaría).
3. Diversifica el riesgo -- perder algunas congregaciones no tumba el
   negocio, a diferencia de depender de un solo contrato con la
   nacional.

**El modelo 1 (venta única) no se recomienda** como estrategia
principal salvo que el usuario priorice liquidez inmediata sobre
crecimiento -- cierra la puerta al ingreso recurrente que es,
justamente, donde está el verdadero potencial de este negocio dado el
tamaño de la IPUC.

**El modelo 2 no se descarta, pero funciona mejor como complemento que
como sustituto**: la pieza de valor real que tiene el modelo 2 no es
el dinero que paga la nacional -- es el **respaldo institucional**, que
acelera la adopción del modelo 3. Ver la combinación propuesta abajo.

## Propuesta concreta: modelo híbrido

1. **Gestionar con la IPUC nacional un aval/respaldo oficial** de
   SIGAP como la plataforma recomendada (o eventualmente exigida) para
   todas las congregaciones -- sin que esto implique que la nacional
   pague la cuenta de todas. Esto le da a SIGAP el mismo impulso de
   adopción que tendría el modelo 2, sin sacrificar el ingreso por
   congregación del modelo 3.
2. **Cobrar la suscripción mensual a cada congregación individualmente**,
   con los 4 precios ya decididos por tamaño (ver
   [03-suscripcion-mensual-por-congregacion.md](03-suscripcion-mensual-por-congregacion.md):
   $29.990 pequeña, $59.990 mediana, $119.990 grande, $199.990 muy
   grande, con precios psicológicos deliberados) -- posicionados a
   propósito por debajo del mercado (KHESED-TEK) para no frenar la
   adopción inicial dentro de la propia organización.
3. **Considerar un descuento o cuota reducida para congregaciones muy
   pequeñas** (posiblemente incluso gratuitas por un tiempo, si el
   respaldo nacional lo justifica) -- esto es coherente con la misión
   de la organización y ayuda a la adopción total, sacrificando poco
   ingreso real (las congregaciones más pequeñas son las que menos
   aportarían de todas formas).

## Antes de fijar cualquier precio final

Los tres documentos de este modelo (00-03) dejan varios supuestos
marcados explícitamente que el usuario debe validar con datos propios
antes de negociar con la IPUC:

- Número real y actualizado de congregaciones (y su distribución por
  tamaño).
- Costo real del equipo que mantendría/soportaría la plataforma.
- Capacidad real de la IPUC (o de cada congregación) de asumir un
  mecanismo de pago recurrente (PSE, transferencia, efectivo a través
  de la estructura distrital, etc.).
