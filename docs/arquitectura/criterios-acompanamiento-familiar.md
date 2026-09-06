# Criterios de acompanamiento familiar

Fecha: 28 de agosto de 2026

## Principio rector

SIGA no debe clasificar automaticamente un hogar como `disfuncional`. Esa
etiqueta es ambigua, puede estigmatizar y no es una conclusion que pueda
obtenerse de una base de datos. El sistema debe describir hechos registrados y
ayudar a priorizar acompanamiento pastoral, dejando la valoracion a personas
responsables y capacitadas.

## Datos descriptivos permitidos

- Integrantes asociados a una familia.
- Parentesco registrado por la familia.
- Rangos de edad.
- Estado civil declarado: soltero/a, casado/a, union libre, divorciado/a o
  viudo/a.
- Personas apartadas, activas, trasladadas, inactivas o fallecidas.
- Participacion en comites y cargos vigentes o historicos.
- Ultima asistencia registrada, cuando exista.
- Seguimientos pastorales y proximas fechas, con acceso restringido.

Estos datos son indicadores de contexto. No prueban por si solos conflicto,
abandono, violencia, negligencia ni incapacidad familiar.

## Criterios eticos para priorizar acompanamiento

Un caso puede sugerirse para revision humana cuando exista al menos una de
estas condiciones verificables:

1. La persona o la familia solicita acompanamiento.
2. Existe un seguimiento pastoral pendiente o vencido.
3. Hay una situacion registrada por el pastor o la junta local con fecha,
   responsable y proximo paso.
4. Se observa ausencia prolongada y se decide contactar, sin asumir el motivo.
5. La persona esta viuda, divorciada, apartada, sola o en otra situacion vital
   y acepta o requiere contacto pastoral.
6. Hay cambios familiares relevantes que la persona autoriza registrar.

La sugerencia debe decir `requiere revision` o `acompanamiento solicitado`, no
`hogar disfuncional`.

## Reglas de trato y privacidad

- Pedir consentimiento para registrar detalles sensibles siempre que sea
  posible.
- Registrar solo la informacion necesaria para una accion pastoral concreta.
- Evitar notas morbosas, rumores, etiquetas clinicas o juicios morales.
- No usar estado civil, edad, sexo, discapacidad, pobreza o viudez como prueba
  de un problema familiar.
- Restringir notas pastorales mediante RLS y permisos de administracion.
- Permitir corregir, cerrar o actualizar un seguimiento sin borrar la
  trazabilidad.
- Si aparece una posible situacion de violencia o riesgo, no automatizar una
  conclusion: derivar segun los protocolos institucionales y la legislacion
  aplicable.

## Aplicacion en SIGA

- Evolucion muestra distribucion y senales agregadas de estado civil, edad,
  familia y estado ministerial.
- Feligresia permite abrir la ficha y registrar un seguimiento, pero la
  decision pastoral queda en manos del equipo autorizado.
- Las alertas deben usar lenguaje accionable y neutral: `revisar`, `contactar`,
  `ofrecer acompanamiento` o `confirmar informacion`.
- Las metricas no deben comparar familias como si existiera una estructura
  familiar ideal unica.

## Pendiente de producto

Si la congregacion necesita una marca operativa, usar en `familias` un estado
controlado como `sin_revision`, `acompanamiento_solicitado`,
`acompanamiento_activo` o `cerrado`, junto con motivo, responsable, fecha y
proximo paso. No crear un campo `disfuncional`.
