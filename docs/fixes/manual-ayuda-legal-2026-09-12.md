# Manual de uso, Ayuda y Legal — 2026-09-12

## Contexto

El usuario preguntó por 4 cosas relacionadas con la orientación al
usuario: si el botón "Solicitar acceso" del inicio tiene lógica real,
si la página de Ayuda estaba desactualizada, si Privacidad y términos
necesitaba actualizarse, y si el Manual de uso (dentro de la app, por
rol) enseña de verdad paso a paso. Se investigaron las 4 antes de
tocar nada.

## 1. Botón "Solicitar acceso" — hallazgo real, corregido

El botón (en `InicioPublico.jsx`) lleva a `/ayuda#acceso`, que decía
"contacta al responsable de SIGAP en tu congregación" -- válido solo
si la congregación YA usa SIGAP. Se confirmó en código que el alta de
una congregación nueva la hace **exclusivamente el distrital**
(`crear_congregacion_con_pastor`, llamado solo desde
`PastoralDistrital.jsx`) -- no existe ningún registro público. El
copy no distinguía los dos casos.

**Corregido** en `src/pages/Ayuda.jsx`: la sección `#acceso` y dos
preguntas del FAQ ahora separan explícitamente "tu congregación ya usa
SIGAP" (pide a tu pastor) de "tu congregación nunca ha usado SIGAP"
(contacta a tu distrital).

## 2. Página de Ayuda

El resto de la página ya estaba en buen estado (preguntas genéricas,
no dependientes de features puntuales). Solo tenía el mismo hueco del
punto 1, ya corregido.

## 3. Privacidad y términos

Este documento **nunca fue una política real** -- es una plantilla
marcada explícitamente como borrador ("requiere revisión jurídica e
institucional antes de considerarse una política definitiva"), con
placeholders para datos institucionales. No estaba desactualizada por
las features nuevas; seguía faltando que la organización complete
datos legales reales.

**Actualizado** (`src/pages/Legal.jsx`) solo lo que se puede afirmar
con certeza desde el código:
- Sección 2: categorías de datos ampliadas con todos los módulos
  reales construidos (comités que administran población, Ruta
  Evangelística, Obra Social/Carcelaria, Red de Familias, auditoría) y
  la nueva categoría de negocio (suscripciones/cobro y errores
  técnicos, exclusiva de super_admin, aclarando que los errores nunca
  incluyen datos de feligresía).
- Sección 7: proveedores reales de infraestructura nombrados
  explícitamente (Supabase, Cloudflare, Resend, Sentry) en vez de
  "deben documentarse los proveedores".

**Sigue pendiente, y no se puede completar sin el usuario**: razón
social/responsable legal, domicilio, correo de atención de derechos
de datos, periodos exactos de conservación, política de backups y
procedimiento de eliminación. El aviso de "requiere revisión jurídica"
se dejó intacto a propósito.

## 4. Manual de uso — reescritura completa

Hallazgo principal: **no existía ninguna pestaña para super_admin** --
el Manual mostraba a super_admin el contenido de "nacional" (datos
pastorales), sin mencionar nada de lo construido para el negocio
(Panel de negocio, Suscripciones, Errores del sistema, exportar
informes).

El usuario pidió explícitamente que el manual enseñe **qué es** cada
pantalla y **cómo se usa paso a paso** (antes era solo un glosario de
"qué es"). Se investigó el código real de ~35 páginas (delegado a 2
agentes en paralelo: local y distrital/nacional, más los módulos que
ya conocía de esta sesión) para extraer nombres exactos de pestañas,
botones y campos, evitando inventar texto genérico.

### Construido

`src/pages/Manual.jsx` reescrito por completo:
- Nueva estructura de datos por ítem: `{ titulo, queEs, como: [{ accion, pasos: [...] }] }` en vez de `{ titulo, texto }`.
- Nueva pestaña **Super admin** (Panel de negocio, Suscripciones,
  Errores del sistema).
- Las 3 pestañas existentes (local/distrital/nacional) reescritas con
  pasos concretos usando las etiquetas literales del código (ej.
  "Registrar persona", "Vincular a la Ruta", "Iniciar proceso").
- Sección "Herramientas generales" (Reportes, Soporte, Solicitudes
  internas, Preferencias personales) también reescrita con el mismo
  formato; la nota de Soporte ahora aclara que super_admin ve los
  reportes de todo el país.
- Distinción de patrones de negocio verificada explícitamente por
  módulo (comité que administra población vs. comité de servicio vs.
  flujo de aprobación vs. tablero de solo lectura), en vez de
  asumirla uniforme.

### Verificación

- `npm run build` sin errores.
- Playwright con la cuenta real `pueba691@gmail.com`: captura completa
  de las 4 pestañas (local, distrital, nacional, super admin) --
  las pestañas del Manual son informativas y no están restringidas por
  rol (cualquier usuario puede consultar cómo trabajan los demás
  niveles), así que se pudieron ver las 4 con la misma cuenta sin
  necesitar parches temporales.
- Contenido revisado visualmente: cada tarjeta muestra "Qué es" y,
  debajo de una línea divisoria, uno o más bloques "ACCIÓN" con pasos
  numerados.

## Pendiente

Ninguna acción de base de datos. Solo frontend, ya desplegado. Falta
que el usuario aporte los datos institucionales reales para
Privacidad y términos cuando los tenga listos.
