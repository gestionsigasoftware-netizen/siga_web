# Consentimiento con firma, acudiente obligatorio y familias mixtas — 2026-09-16

## Contexto

Tercera y última pieza de los 13 pedidos por WhatsApp (items 8, 10 y
13), construida bajo la misma consigna que las dos anteriores: no son
pantallas sueltas, sino que alimentan la misma analítica de decisión
pastoral (cobertura de consentimiento, composición real de las
familias, niños sin acudiente).

**Decisión de consentimiento (item 8)**: en vez de subir un archivo
firmado a Supabase Storage (infraestructura nueva, no usada en ningún
otro lugar de la app), se construyó una **firma dibujada en pantalla**
(con el dedo en celular/tablet o con el mouse en computador -- sin
ningún dispositivo externo) que se guarda como una imagen pequeña
(PNG en base64) directamente en la fila de `personas`/`amigos`.

## Construido

`supabase/modulos/familias_mixtas_consentimiento_acudiente.sql`
(confirmado ejecutado):

- **Item 8**: `consentimiento_datos_firma` (texto, imagen base64) y
  `fecha_consentimiento_datos` en `personas` y `amigos`.
- **Item 13**: `tipo_familia` en `escuela_dominical_ninos` (`creyente`
  / `amigo_en_ruta`), para distinguir de quién es responsabilidad el
  seguimiento del niño.
- **Item 10**: tabla nueva `familia_amigos` (no se tocó
  `familia_miembros`, que ya usan el árbol genealógico y las
  relaciones familiares de personas -- separarla evita arriesgar esa
  funcionalidad existente).

### Frontend

`src/components/SignaturePad.jsx` (nuevo, compartido): lienzo
`<canvas>` con eventos de mouse y táctiles, sin librería externa.

`src/pages/FeligresiaAdmin.jsx` y `src/pages/Amigos.jsx`: nueva
sección "Consentimiento de datos" (captura de firma, vista previa,
revocar) en ambos formularios. Nueva métrica "Con consentimiento
firmado" en el panel de Evolución.

`src/pages/FeligresiaAdmin.jsx`, pestaña Familias: `FamilyTree` ahora
también muestra y permite vincular amigos en ruta al núcleo familiar
("Vincular amigo en ruta"), con una línea de composición ("X
creyentes, Y amigos en ruta, Z niños menores de 12 años") tanto en el
árbol como en cada tarjeta de familia.

`src/pages/EscuelaDominical.jsx`: nuevo select obligatorio "¿Hijo de
creyente o de amigo en ruta?" y los campos de acudiente (nombre y
teléfono) ahora son `required` -- bloquea el registro de un niño
nuevo sin esta información, tanto en el navegador (atributo
`required`) como en `createNino()` (segunda validación). Nueva
métrica "Sin acudiente registrado" para visibilizar los niños
registrados antes de este cambio que aún no lo tienen.

## Verificación

- `npm run build` sin errores en cada paso.
- Consulta directa contra la base real: persona con firma guardada;
  `tipo_familia` inválido rechazado por el check constraint (código
  23514); niño con acudiente y tipo_familia guardado correctamente;
  vínculo familia-amigo creado y leído con el nombre del amigo
  anidado; vínculo duplicado rechazado por el índice único (código
  23505). Registros de prueba eliminados, cero residuo.
- Playwright con la cuenta real: se dibujó una firma real con el
  mouse sobre el lienzo, se guardó, se cerró y reabrió la ficha
  confirmando que persiste, y la métrica de consentimiento apareció en
  Evolución. Se vinculó un amigo de prueba a una familia de prueba y
  apareció correctamente en el árbol con el texto de composición
  actualizado. En Escuela Dominical, un registro sin tipo de familia
  ni acudiente NO creó ninguna fila (bloqueado), y con los datos
  completos sí se guardó, mostrando la métrica de cobertura. Cero
  errores de consola en las tres pruebas. Todos los registros de
  prueba eliminados, cero residuo.
