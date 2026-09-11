# Modelo 2: licencia anual + mantenimiento a nivel nacional (un solo cliente: la IPUC)

## En qué consiste

SIGAP nunca se vende -- la IPUC (como organización nacional) paga una
cuota anual que le da derecho a que **todas** sus congregaciones usen
la plataforma, y esa cuota incluye el mantenimiento continuo (nuevas
funcionalidades, corrección de errores, infraestructura, soporte).

Es un solo contrato, un solo cliente que paga (la IPUC nacional), sin
importar si tiene 4.000 o 5.500 congregaciones activas -- lo cual es
más simple de administrar que cobrarle a cada congregación por
separado (modelo 3), pero depende de que la IPUC nacional tenga la
voluntad y el presupuesto centralizado para asumir ese costo.

## Cómo estimar la cuota anual

```
Cuota anual = (infraestructura anual + costo del equipo de soporte
               y mantenimiento anual + costo de desarrollo continuo)
              / (1 - margen objetivo)
```

### Infraestructura anual

Usando el rango de [00-contexto-y-supuestos.md](00-contexto-y-supuestos.md)
(plan Supabase Team, ~US$599/mes + consumo, para una base con miles de
usuarios reales): **~US$7.200-10.000/año** (~29-40 millones de COP/año
al cambio de referencia). Esto es el mismo sin importar si son 500 o
5.000 congregaciones -- es la ventaja de la arquitectura multi-tenant
compartida.

### Costo del equipo de soporte y mantenimiento

Esta es la variable más grande y la que **el usuario debe aportar**,
no algo que se pueda buscar en internet: cuántas personas harían
soporte/mantenimiento de tiempo completo o parcial, y a qué costo
mensual. Como referencia de industria (no específica de Colombia), el
estándar de mantenimiento de software empresarial es **15-25% del
valor de la licencia/año** (18-22% es lo más citado hoy -- Oracle 22%,
SAP 19%, IBM 20-25%, ver fuente en el documento de contexto). Aplicado
al revés: si se quiere que el mantenimiento sea, por ejemplo, el 20%
del "valor" percibido del software para la IPUC, hay que primero
definir ese valor de referencia (que vuelve a depender del ejercicio
de costo-plus del modelo 1).

### Costo de desarrollo continuo

Si la cuota también debe financiar seguir construyendo funcionalidad
nueva (como todo lo que se ha construido esta sesión: Ruta
Evangelística, comités, PWA, etc.), hay que sumar el costo mensual del
desarrollador(es) que sigan trabajando en esto, no solo "mantenerlo
prendido".

## Ejemplo numérico ilustrativo (con supuestos marcados)

Este es un ejercicio de referencia, **no una cotización** -- reemplaza
los supuestos marcados con [SUPUESTO] por cifras reales del usuario
antes de usarlo para negociar:

| Rubro | Estimado anual (COP) | Nota |
|---|---|---|
| Infraestructura (Supabase Team + consumo) | ~35.000.000 | Con fuente, ver contexto |
| Soporte/mesa de ayuda (1 persona medio tiempo) | [SUPUESTO] 30.000.000 | Depende del costo real del equipo |
| Mantenimiento y mejoras continuas (desarrollador) | [SUPUESTO] 60.000.000 | Depende de si es tiempo completo o parcial |
| **Subtotal de costos** | **~125.000.000** | |
| Margen objetivo (30%) | ~54.000.000 | Ajustable según apetito de negocio |
| **Cuota anual sugerida a la IPUC** | **~179.000.000 COP/año** | ≈ 14.9 millones/mes |

Para dimensionar: si la IPUC tiene 4.500 congregaciones, esa cuota
anual equivale a **~3.300 COP por congregación al mes** -- una cifra
que suena muy baja comparada con el modelo 3 (entre $29.990 y $199.990
COP/mes según tamaño de la congregación, ver precios definitivos en
[03-suscripcion-mensual-por-congregacion.md](03-suscripcion-mensual-por-congregacion.md),
promedio ponderado estimado ~$54.990 COP/mes por
congregación), lo cual señala algo importante: **si la IPUC paga un
solo contrato nacional plano, SIGAP probablemente está dejando mucho
ingreso sobre la mesa** frente a cobrar por congregación individual
(ver modelo 3 y la comparación final).

## Riesgos de este modelo

1. **Un solo punto de pago**: si la IPUC nacional decide no renovar o
   tiene un problema presupuestal, se pierde el 100% del ingreso de un
   solo golpe -- a diferencia de 5.000 congregaciones pagando cada una
   por separado, donde perder algunas no tumba todo el negocio.
2. **Negociación política/institucional**: convencer a una junta
   nacional de aprobar un presupuesto anual grande es un proceso
   distinto (más lento, más político) que vender una suscripción
   pequeña congregación por congregación.
3. **Presión a la baja del precio**: es más fácil para una sola
   contraparte grande negociar un descuento fuerte que para 5.000
   congregaciones individuales negociar cada una.

## Cuándo SÍ tendría sentido este modelo

- Si la IPUC nacional ya tiene un rubro presupuestal para tecnología y
  prefiere centralizar el pago en vez de que cada congregación
  gestione su propia suscripción (elimina el problema de recaudo
  fragmentado mencionado en el contexto).
- Si el objetivo es una relación institucional de largo plazo con
  respaldo oficial de la organización completa (tiene valor
  reputacional/de adopción garantizada: si la nacional paga, es más
  fácil que exija a las congregaciones usarlo).
