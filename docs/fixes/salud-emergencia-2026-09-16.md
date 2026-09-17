# Ficha de salud de emergencia (item 5 de los 13 pedidos) — 2026-09-16

## Contexto

El usuario explicó el caso de uso real: si alguien se enferma en pleno
culto (se desmaya, convulsiona, etc.), la congregación necesita
información clara de qué hacer y a quién avisar, sin asumir que es un
tema espiritual. Pidió explícitamente que:

- Aplique tanto a creyentes del censo como a **amigos que ya están en
  seguimiento activo** de la Ruta Evangelística (no a un visitante de
  un solo culto, que normalmente ni siquiera tiene un registro
  todavía).
- Categorice por prioridad: niños, mujeres embarazadas, adultos
  mayores, y demás.
- Incluya EPS, condiciones médicas, y medicamentos que la persona toma
  bajo receta de su propio médico -- **solo como referencia para un
  paramédico o primer respondiente**, nunca para que la congregación
  diagnostique, prescriba o administre nada.
- Tenga mediciones, insights y gráficos, no solo captura de datos.

Antes de construir se preguntó explícitamente cómo manejar el
consentimiento, porque en Colombia la información de salud es un dato
sensible (Ley 1581 de 2012) más exigente que un dato normal, y el
usuario ya tenía marcado aparte un módulo de consentimiento con
archivo/firma (item 8, todavía sin construir). El usuario eligió
agregar ya un consentimiento mínimo (checkbox + fecha) mientras se
construye el módulo completo.

## Construido

`supabase/modulos/salud_emergencia.sql` (confirmado ejecutado) agrega
en `personas` **y** `amigos` (mismas columnas en ambas tablas):
`tipo_sangre` (catálogo de 8 tipos), `eps_nombre`,
`condiciones_medicas`, `alergias`, `medicamentos_actuales`,
`discapacidad`, `embarazada` + `fecha_probable_parto`, contacto de
emergencia (`contacto_emergencia_nombre/telefono/parentesco`), y el
consentimiento mínimo `autorizacion_datos_salud` +
`fecha_autorizacion_datos_salud`.

`src/lib/saludEmergencia.js` (nuevo): `categoriasPrioridad(persona,
edad)` clasifica a alguien en niño (<12 años), adulto mayor (≥60 años
-- corte operativo, no una clasificación oficial de la IPUC),
embarazada, condición médica, alergia o discapacidad. Una persona
puede caer en varias categorías a la vez.

### Frontend

`src/pages/FeligresiaAdmin.jsx`: nueva sección plegable "Ficha de
salud de emergencia" en la ficha de persona, con el checkbox de
consentimiento primero -- **el resto de los campos de salud solo se
guardan si esa autorización está marcada** (igual que el resto del
formulario nunca guarda datos de bautismo si `bautizado` es falso).
Muestra insignias visuales de las categorías de prioridad detectadas.
Nueva pestaña "Salud y emergencias" con un panel de analítica
(`HealthAnalytics`): cobertura del censo activo con ficha registrada,
personas con EPS, y un gráfico de barras de personas por categoría de
prioridad (barras, no pastel, porque las categorías no son excluyentes
entre sí).

`src/pages/Amigos.jsx`: la misma ficha de salud (con el mismo
consentimiento) en el formulario de alta Y en el de edición de un
amigo existente -- sin panel de analítica agregado todavía para
amigos, queda como extensión futura si se pide.

## Alcance NO cubierto en esta pieza

No se agregó ningún dato de salud a las exportaciones CSV/Excel/PDF
del censo, a propósito -- exportar información sensible en un archivo
suelto sería un riesgo de privacidad que no se pidió resolver ahora.

## Verificación

- `npm run build` sin errores en cada paso.
- Consulta directa contra la base real: persona con consentimiento
  guardó todos los campos; persona sin consentimiento quedó con todos
  los campos de salud en null; amigo embarazada con fecha probable de
  parto guardó correctamente; un `tipo_sangre` inválido ("Z+") fue
  rechazado por el check constraint (código 23514). Registros de
  prueba eliminados, cero residuo.
- Playwright con la cuenta real: se registró una persona nueva,
  se marcó el consentimiento, se llenó EPS y condiciones médicas
  (apareció la insignia "Condición médica"), se guardó ("Persona
  registrada correctamente en la feligresía"), y la pestaña "Salud y
  emergencias" mostró correctamente 1/10 personas activas (10%) con
  ficha, 1 con EPS, y el gráfico de barras con "Condición médica: 1".
  Cero errores de consola. Persona de prueba eliminada de la base
  real al terminar, cero residuo.
