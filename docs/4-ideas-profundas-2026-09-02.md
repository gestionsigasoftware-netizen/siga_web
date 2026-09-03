# Las 4 ideas profundas (2026-09-02)

## 1. Salud de datos (`supabase/salud_datos.sql`, `src/pages/SaludDatos.jsx`, nuevo, ruta `/salud-datos`)

La pirámide poblacional, los cumpleaños y la proyección de crecimiento
(construidos antes en esta sesión) solo son tan buenas como los datos
que las alimentan. Nueva pantalla, en los 3 niveles, mostrando el % de
personas activas con cada campo clave diligenciado (fecha de
nacimiento, género, teléfono, familia asociada, fecha de ingreso):

- Local: calculado directo del censo propio.
- Distrital: `resumen_salud_datos_distrital(distrito_id)`, por
  congregación.
- Nacional/super_admin: `resumen_salud_datos_nacional()`, por distrito.

## 2. Riesgo de apartamiento (`src/pages/Dashboard.jsx`, local)

La alerta pastoral existente reacciona a los 90 días sin asistir. Esto
es una ventana más temprana: personas con 2 o más señales de alejamiento
(45-89 días sin asistir, sin familia asociada, más de un año sin
bautizarse) — mismo criterio que el semáforo de salud ya construido
antes: se muestran las señales tal cual, no se inventa un puntaje
compuesto que esconda de dónde sale el riesgo.

## 3. Comparativa entre pares (`src/pages/Dashboard.jsx`, distrital)

La tabla "Comparativa por congregación" ya existía con números
absolutos (personas activas, nuevas en 3 meses). Se le agregó una
columna de **tasa de crecimiento** (`(nuevas - bajas) / activos`, que sí
es comparable entre congregaciones de tamaños distintos, a diferencia
del número absoluto) con un indicador de si está por encima o por debajo
del promedio del distrito.

## 4. Continuidad pastoral (`supabase/continuidad_pastoral.sql`, `src/pages/PastoralDistrital.jsx`)

Ya existía transferir credenciales al finalizar una asignación pastoral,
pero no los pendientes reales de la congregación que queda vacante.
Nueva sección "Continuidad pendiente" mostrando, para cada congregación
sin pastor asignado: seguimientos pastorales pendientes, casos activos
de Red de Familias, y cargos obligatorios de comité sin cubrir — lo que
el próximo pastor (o el distrital, mientras tanto) necesita saber que
sigue abierto.

## Acción requerida del usuario

Ejecutar `supabase/salud_datos.sql` y `supabase/continuidad_pastoral.sql`
en el SQL Editor. Las ideas 2 y 3 son cálculo en el cliente sobre datos
ya cargados, no requieren SQL nuevo.
