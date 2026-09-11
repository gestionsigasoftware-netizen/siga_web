# Modelo de negocio e ingresos de SIGAP

**Esto es investigación y planteamiento estratégico, no documentación
técnica.** Nada de lo que hay aquí implica cambios de código ni de
producto -- es para tomar una decisión de negocio junto con el usuario
sobre cómo generar ingresos con SIGAP.

## Contexto de la pregunta (2026-09-07)

El usuario planteó tres modelos posibles para generar ingresos con
SIGAP, pensados para la IPUC (Iglesia Pentecostal Unida de Colombia,
~5.000 o más congregaciones según el usuario -- ver matiz de esta
cifra en [00-contexto-y-supuestos.md](00-contexto-y-supuestos.md)):

1. **Venta única** -- la IPUC compra el software una sola vez.
2. **Licencia anual + mantenimiento a nivel nacional** -- no se vende
   el software, se le cobra a la organización completa una licencia de
   uso anual que incluya el mantenimiento de toda la plataforma.
3. **Suscripción mensual por congregación** -- cada congregación paga
   una cuota mensual individual. **Este es el modelo elegido** (decisión
   del usuario, dueño de SIGAP, 2026-09-07), con 4 precios definitivos
   por tamaño de congregación: $29.990 / $59.990 / $119.990 / $199.990
   COP/mes -- ver [03-suscripcion-mensual-por-congregacion.md](03-suscripcion-mensual-por-congregacion.md).

## Decisión final de comercialización (2026-09-10)

El usuario cerró la forma concreta de vender el modelo 3 (suscripción
por congregación), con dos ajustes respecto a lo que proponían los
documentos 03/04 de abajo:

- **Dos períodos, no cuatro precios fijos**: plan mensual y plan anual
  (mismo acceso completo a SIGAP en ambos -- la diferencia es el
  período de permanencia, no funciones). No se implementó la tabla de
  4 precios por tamaño de `03-suscripcion-mensual-por-congregacion.md`
  -- queda como referencia de rango de mercado, no como el mecanismo
  final.
- **Sin precios públicos**: en vez de mostrar cifras en el sitio, la
  página de inicio pública usa copywriting (qué incluye cada plan, sin
  números) y dirige al interesado a WhatsApp para que se le cotice el
  valor exacto según el tamaño de su congregación. Implementado en
  `src/pages/InicioPublico.jsx` (sección "Planes", con enlace
  `wa.me` al número de contacto de SIGAP).

## Documentos

- [00-contexto-y-supuestos.md](00-contexto-y-supuestos.md) -- escala
  real de la IPUC, cómo está construido SIGAP hoy (arquitectura
  multi-tenant compartida) y qué tan barato o caro es escalarlo, y los
  comparables de precio investigados (con fuentes).
- [01-venta-unica-a-la-ipuc.md](01-venta-unica-a-la-ipuc.md) -- análisis
  del modelo de venta única.
- [02-licencia-anual-mas-mantenimiento-ipuc.md](02-licencia-anual-mas-mantenimiento-ipuc.md)
  -- análisis del modelo de licencia + mantenimiento nacional.
- [03-suscripcion-mensual-por-congregacion.md](03-suscripcion-mensual-por-congregacion.md)
  -- **modelo elegido**, con los 4 precios definitivos por tamaño de
  congregación evaluados contra comparables reales y proyección de
  ingresos.
- [04-comparacion-y-recomendacion.md](04-comparacion-y-recomendacion.md)
  -- tabla comparativa de los tres modelos y una recomendación
  razonada.

## Cómo leer las cifras

Donde hay un número con fuente citada, es un dato real de mercado.
Donde no hay fuente, es una **estimación de trabajo** que depende de
datos que solo el usuario tiene (costos reales del equipo, horas ya
invertidas, capacidad de cobro, etc.) -- están marcadas explícitamente
como supuestos a validar, no como hechos.
