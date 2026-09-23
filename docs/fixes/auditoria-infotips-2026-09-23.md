# Auditoría de InfoTips (ayudas contextuales) -- 2026-09-23

## Contexto

El usuario notó que, al usuario final le faltan más botones de ayuda
("¿i") que expliquen qué hace un botón o para qué sirve un campo,
especialmente en piezas nuevas agregadas hoy mismo (la sesión ya había
construido varias funciones nuevas: restricciones de rol en
Aprobaciones, el fix de auditoría multi-rol, y el seguimiento de
contacto para feligresía/amigos). Pidió una auditoría completa de la
app.

Se usaron 3 agentes en paralelo para revisar las 48 pantallas de
`src/pages/` (más `Sidebar.jsx`, `GlobalSearch.jsx`, `MainLayout.jsx`)
contra el criterio: ¿hay un botón, campo o badge cuyo propósito o
consecuencia no sea evidente por su sola etiqueta, y que todavía no
tenga un `InfoTip` cerca? Se les pidió ser selectivos -- no llenar la
app de tooltips, solo donde un usuario real se quedaría con dudas.

**Hallazgo general**: SIGAP ya tiene una cobertura de InfoTip
inusualmente completa (40 de 48 páginas ya los usan, muchas de forma
extensa). Los huecos reales encontrados fueron puntuales, concentrados
sobre todo en las piezas construidas hoy mismo.

## Agregados

- **`FeligresiaAdmin.jsx`**: el nuevo botón "Confirmar contacto hoy"
  (agregado hoy) aparecía junto al "Atender" existente sin explicar la
  diferencia entre los dos. Se quitó el `title` nativo (no funciona en
  pantallas táctiles) y se agregó un `InfoTip` explicando cuándo usar
  cada uno.
- **`Dashboard.jsx`**: el botón "Atender" del Resumen (distinto al de
  Feligresía, mismo nombre) cierra la alerta de forma permanente con
  una nota automática genérica, sin abrir ningún formulario -- un
  comportamiento no evidente. Se agregó `InfoTip` aclarándolo.
- **`GestionPastoralNacional.jsx`**: el campo "Correo de acceso" (al
  otorgar acceso a un nuevo líder) dispara una función real -- invita
  por correo si es cuenta nueva, o vincula una cuenta existente si el
  correo ya coincide. Se agregó `InfoTip` explicando la consecuencia
  antes de que el usuario lo envíe.
- **`ObraCarcelaria.jsx`**: "Vincular a la Ruta" (pestaña Internos) ya
  tenía su explicación en la pestaña Reinserción pero no aquí, donde
  un usuario la encuentra primero. Se igualó.
- **`RutaFormacion.jsx`** (modo ESFOB): "Marcar bautizado" cierra el
  proceso y fija la fecha de bautismo a hoy -- una acción con
  consecuencia real y sin deshacer, ahora explicada.
- **`Evangelismo.jsx`**: las métricas "Capturas móviles" (jerga
  interna: no es "personas contactadas") y "Conversiones" (solo cuenta
  cuando se bautiza, no por mostrar interés) no explicaban su cálculo,
  a diferencia de sus vecinas en el mismo tablero.
- **`EquipoCongregacion.jsx`**: "Responsabilidades operativas" tiene el
  mismo comportamiento de "Retirar" (solo termina desde hoy, conserva
  historial) que ya está explicado en la sección "Perfiles activos" de
  arriba, pero no aquí -- inconsistencia real, ahora igualada.
- **`Configuracion.jsx`**: "Etapas de seguimiento de Amigos" es hoy un
  catálogo secundario/legado (el trabajo real del día a día ya se hace
  por "estación" en Ruta Evangelística, no por "etapa") -- sin esa
  aclaración, un pastor podría creer que está editando el flujo
  principal. Se agregó un prop `info` reutilizable al componente
  compartido `ListaCatalogo`.
- **`Amigos.jsx`** (piezas nuevas de hoy mismo): el badge "N días sin
  contacto" y el botón "Marcar contacto hoy" (ficha de detalle) ahora
  explican que el número se calcula solo (no hay que escribir nada a
  mano) y para qué sirve el botón. También se aclaró el filtro por
  "Etapa" de la lista, que es un dato distinto a la "estación" que
  muestra cada tarjeta -- confusión real que ya existía antes de hoy.

## Revisado, sin cambios (cobertura ya adecuada)

La mayoría de pantallas de ministerio (Sepri, EstacionRefam/Bis/UnoMas,
EscuelaDominical, MisionJuvenil, ObraSocial, Musica, RedFamilias,
Conquistadores, DamasDorcas, EducacionArtistica/Teologica,
MisionesEvangelismo), las distritales/nacionales (PastoralDistrital,
ImpactoMisionero, GestionDistritos, SaludDatos, ComitesNacional,
Solicitudes, Personas, RegistrarAsistencia, AuditoriaFeligresia), y las
administrativas (Soporte, Suscripciones, Modulos,
ConfiguracionSistema, Perfil, ErroresSistema, GlobalSearch,
MainLayout) ya explican sus acciones no evidentes (traslados, anular,
umbrales, jerga IPUC como Licencia Local/General, consentimientos de
salud, etc.). No se forzaron hallazgos donde no los había.

`Sidebar.jsx` quedó fuera a propósito: cada ítem de navegación es un
`NavLink`, y `InfoTip` renderiza su propio `<button>` -- anidarlo
requeriría rediseñar la marcación de cada fila del menú, y no hay
ningún otro nav en la app que lo haga así. Se documenta como posible
mejora futura, no se forzó ahora.

## Verificación

- `npm run build` sin errores.
- Cambios puramente de UI/texto -- no tocan lógica de negocio ni
  consultas a la base de datos, sin necesidad de verificación contra
  producción.
