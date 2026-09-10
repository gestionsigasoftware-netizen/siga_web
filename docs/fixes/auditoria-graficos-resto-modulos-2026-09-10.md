# Auditoría y corrección de gráficos e indicadores — resto de módulos (2026-09-10)

Continuación de la auditoría del módulo Resumen
(`auditoria-resumen-2026-09-10.md`). El usuario pidió repetir el mismo
ejercicio ("revisar si están haciendo su trabajo y sino, corregirlo")
en el resto de pantallas de la web que muestran gráficos o
indicadores calculados. Se auditaron con 4 agentes en paralelo los 18
archivos restantes con `react-chartjs-2`, y se corrigió todo lo
encontrado salvo la falta de botón de exportar (ver "Pendiente
explícito" al final).

## Ruta Evangelística

**`src/pages/Evangelismo.jsx`**
- "Asistencia por captura" y "Conversiones por metodología" no tenían
  estado vacío (`ChartEmpty`) pese a que otros 3 gráficos del mismo
  archivo sí lo usaban. Agregado.
- Tile "Conversiones" con tono verde fijo sin importar el valor.
  Corregido a condicional.
- Las tarjetas "Amigos en ruta"/"Conversiones" se repetían dos veces
  en la pantalla sin aportar nada nuevo la segunda vez. Se eliminó la
  repetición.
- La tabla "Rendimiento por barrio o vereda" y el detalle del mapa
  mostraban `row.amigos` (TODOS los amigos de la zona, incluidos ya
  convertidos) bajo la etiqueta "amigos en ruta". Se agregó un campo
  `enRuta` calculado correctamente (excluye convertidos) y se usa en
  ambos lugares.
- La columna "Responsable" de esa misma tabla nunca mostraba el
  nombre del responsable, solo el botón "Editar". Se agregó la celda
  con el nombre (vía el join `personas:lider_persona_id` que ya se
  traía pero no se usaba) y una columna aparte para el botón.

**`src/pages/EstacionBis.jsx`, `EstacionUnoMas.jsx`, `EstacionRefam.jsx`**
- Tile "Candidatos a trasladar" con tono naranja fijo sin importar el
  valor. Corregido a condicional en los tres archivos.

**`src/pages/RutaFormacion.jsx`** (ESFOB y Discipulado)
- Tiles "Completados" y "Candidatos a trasladar"/"Requieren
  seguimiento" con tono fijo sin importar el valor. Corregido.
- Tile "Tasa de éxito": cuando no hay procesos finalizados
  (`tasaExito === null`) se mostraba en verde como si fuera un éxito.
  Corregido a tono neutro.
- Gráfico "Personas en ESFOB por zona" usaba un `<p>` de texto plano
  para el estado vacío en vez de `ChartEmpty` (el archivo ya lo
  importa y usa en otros dos gráficos). Unificado.
- Gráfico "Personas por estado" (Discipulado) evaluaba el estado
  vacío con `rows.length` en vez de con los datos reales del propio
  gráfico (`discipuladoStats.distribucion.labels.length`). Corregido.

## Comités

**`src/pages/Conquistadores.jsx`**
- Tile "Actividades (30 días)" mostraba un conteo de una ventana fija
  de 30 días, pero su tono/insight venían de `tendenciaVariacion`,
  calculada sobre el periodo completo seleccionado (30/180/365 días)
  — si el filtro estaba en "12 meses", el color de la tarjeta de "30
  días" reflejaba la tendencia de todo el año. Se agregó
  `variacion30Dias`, calculada específicamente comparando los últimos
  30 días contra los 30 anteriores, y se usa solo en esa tarjeta.
- "Sin seguimiento reciente" marcaba como riesgo a cualquier miembro
  sin actividad registrada, sin importar si acababa de ingresar (un
  miembro registrado hoy salía marcado igual que uno inactivo hace
  meses). Ahora, si no hay actividad registrada, se compara contra
  `fecha_ingreso` en vez de marcarlo automáticamente.

**`src/pages/DamasDorcas.jsx`** (casi copia de Conquistadores.jsx)
- Mismos dos bugs de arriba, corregidos igual.
- La query de `damas_dorcas_beneficiarias` no traía ningún campo de
  fecha de ingreso, así que no había con qué comparar. Se agregó
  `created_at` a la query y se usa como base.
- Tile "Tipo de trabajo líder": con cero actividades registradas
  mostraba igual la primera categoría del catálogo ("Visita") como si
  fuera la líder real. Corregido para mostrar "—" cuando no hay datos.

**`src/pages/EscuelaDominical.jsx`**
- Mismo bug de "líder falso con datos en cero" en la tarjeta "Niños
  por etapa líder" (mostraba "Cuna" con 0 niños). Corregido.

**`src/pages/Sepri.jsx`**
- Tile "Cumplimiento del plazo": sin solicitudes evaluables en 12
  meses (`cumplimiento === null`) se mostraba en verde como si fuera
  un logro. Corregido a tono neutro.
- Tile "Delegados activos": con cero delegados activos, mostraba
  verde (0 vencidos de 0 activos = "0% problemas"). Corregido para
  mostrar tono neutro cuando no hay delegados activos.

## Educación y ministerios de sesión

**`src/pages/EducacionArtistica.jsx`, `Musica.jsx`, `EducacionTeologica.jsx`, `ObraCarcelaria.jsx`**
- Bug de "1 día = -100%": con una sola sesión/culto registrado en el
  periodo, el cálculo de tendencia partía ese único dato entre "primera
  mitad" (el dato) y "segunda mitad" (vacío), dando una caída de
  "-100%" completamente artificial con solo un día de historial real.
  Corregido en los 4 archivos: ahora se requieren al menos 2 fechas
  distintas en el periodo para calcular una variación; si no, se
  muestra "aún no hay suficiente historial" en vez de un falso -100%.
- "Disciplina líder" (Ed. Artística), "Modalidad líder" (Música),
  "Nivel líder" (Ed. Teológica): mismo bug de "líder falso con datos
  en cero" que en Escuela Dominical/Damas Dorcas. Corregido en los
  tres.
- Tile "Certificados" (Ed. Teológica) con tono verde fijo sin importar
  el valor. Corregido a condicional.

**`src/pages/ObraCarcelaria.jsx`**
- El gráfico "Asistencia vs. hitos espirituales" mezclaba en una sola
  escala la asistencia acumulada (suma de asistentes de todos los
  cultos del periodo, típicamente decenas u cientos) con conteos de
  personas (bautizados, sellados, típicamente unidades). La barra de
  asistencia dominaba visualmente y las otras dos casi no se veían.
  Se separó en dos ejes: "Personas" (bautizados/sellados) a la
  izquierda y "Asistencia acumulada" a la derecha, cada uno con su
  propia escala y leyenda para distinguir qué barra usa cuál.

## Ruta Evangelística — Misión Juvenil

**`src/pages/MisionJuvenil.jsx`** (el archivo con más hallazgos)
- No importaba `ChartEmpty` en absoluto: los gráficos "Actividad
  juvenil" y "Estado de estudiantes" se pintaban vacíos sin ningún
  aviso cuando no había datos. Agregado el componente y el guard en
  ambos.
- Los filtros de "Institución" y "Estado espiritual" solo afectan al
  gráfico "Estado de estudiantes" (por diseño de datos: los registros
  de actividad del módulo no tienen institución ni estado asociado),
  pero el texto de la sección de filtros no lo aclaraba, dando a
  entender que ambos paneles reaccionan al filtro. Se agregó una nota
  bajo el título del gráfico de actividad aclarando que es del
  ministerio completo y no varía con esos filtros.
- Tile "Grupos REFAM" (`studentsPerGroup`): dividía estudiantes YA
  filtrados por institución entre `activeGroups` SIN filtrar por
  institución, dando un promedio artificialmente bajo al filtrar por
  una institución específica. Se filtró `activeGroups` por la misma
  institución seleccionada.

## Verificación

- `npm run build` limpio después de cada tanda de cambios.
- Playwright: login como rol local de prueba y visita a las 15
  pantallas tocadas (`/evangelismo`, `/conquistadores`,
  `/damas-dorcas`, `/escuela-dominical`, `/sepri`,
  `/educacion-artistica`, `/musica`, `/educacion-teologica`,
  `/obra-carcelaria`, `/mision-juvenil`, `/esfob`, `/discipulado`,
  `/bis`, `/uno-mas`, `/refam`) — todas cargan sin errores de consola
  ni 404.
- Captura de pantalla de `Obra Carcelaria` para confirmar visualmente
  que el gráfico de doble eje se ve correcto (título y escala
  independientes a cada lado, leyenda distinguiendo las series).
- No se probó como rol distrital/nacional por falta de cuenta de
  prueba con esos roles (misma limitación del resto de la sesión) —
  no aplica aquí de todas formas, ya que estas 18 pantallas son todas
  de nivel local/comité, sin equivalente distrital/nacional.

## Botón de exportar agregado (2026-09-10, segunda mitad de la sesión)

Se detectó que **15 de los 18 archivos auditados no tenían ningún
botón de exportar** (CSV/Excel/PDF vía `ExportButtons`): Evangelismo,
EstacionBis, EstacionUnoMas, EstacionRefam, RutaFormacion (ESFOB y
Discipulado), Conquistadores, EscuelaDominical, DamasDorcas,
EducacionArtistica, Musica, EducacionTeologica, ObraCarcelaria,
MisionJuvenil, ObraSocial, ImpactoMisionero. (Sepri y
ReportesOptimizado ya lo tenían.) Confirmado con el usuario, se
agregó a los 15 usando el mismo patrón compartido ya existente
(`descargarCsv`/`descargarExcel`/`descargarPdf` de
`src/lib/reportExport.js` + `<ExportButtons>`), con un
`exportResumen()` (KPIs + desglose para el Excel/PDF) y un
`exportHeaders()` (tabla principal de cada pantalla: zonas,
miembros, grupos, internos, casos, según el archivo) por pantalla.

Verificado con Playwright: login como rol local, clic real en los
botones PDF y CSV de las 16 rutas tocadas — las 16 descargas se
completaron con el nombre de archivo esperado (`<módulo>-<fecha>.pdf`
/ `.csv`) y sin errores nuevos de consola.

También queda como mejora (no bug) sin tocar: `CommitteeAnalytics` en
`FeligresiaAdmin.jsx` (pestaña "Evolución") no tiene ningún gráfico
pese al nombre de la pestaña — todo se presenta en tabla de texto. Los
cálculos son correctos, solo falta la visualización.
