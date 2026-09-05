# QA de producción — 2026-09-04

Ronda de pruebas de calidad sobre toda la web (`siga-nacional`) y la PWA
(`siga-pwa-nacional`), para evaluar si SIGAP está lista para producción.
Se usó una congregación de prueba aislada (`QA - Prueba SIGAP`,
`es_demo=true`) y la cuenta multi-rol `pueba691@gmail.com` (persona
Jhan Sanchez, con roles local/local/distrital/nacional). 5 rondas de
QA en paralelo: Ruta Evangelística, fixes recientes de sesión + PWA,
pantallas distritales/nacionales, FECP/Feligresía/comités, y
login/navegación (web + PWA).

## Veredicto

**Ningún hallazgo bloqueante.** No se encontró ningún bug que impida
salir a producción. Hay 3 hallazgos "importantes" que vale la pena
resolver o al menos decidir conscientemente antes de lanzar, y una
lista de hallazgos menores/cosméticos que se pueden priorizar después.

## Corregido durante esta ronda

- **Cero fantasma en "Umbral de alerta"** (`src/pages/Configuracion.jsx`) —
  el campo convertía a `Number()` en cada tecla; tras borrar y escribir
  quedaba "034" en vez de "34". Mismo patrón ya corregido antes en
  `EstacionRefam.jsx`, `ObraCarcelaria.jsx`, `RedFamilias.jsx` y
  `MisionJuvenil.jsx`, aquí con la variante de conversión en cada
  `onChange` en vez de valor inicial `0`. Verificado con Playwright
  (escribir letra por letra, guardar, recargar, confirmar persistencia)
  y corregido en el commit `58ddf10`.

## Hallazgos importantes (pendientes)

1. **No existe una pantalla real de "404 / No encontrado"**, ni en web
   ni en PWA. El catch-all de ambos routers (`src/App.jsx`) es
   `<Route path="*" element={<Navigate to="/" replace />} />`. Si el
   usuario está autenticado, `InicioPublico.jsx` lo rebota
   automáticamente a `/app` — cualquier URL con typo es indistinguible
   de una navegación válida, sin ninguna señal de error. No crashea ni
   deja pantalla en blanco, pero tampoco avisa. Recomendación: agregar
   una ruta 404 real con un mensaje y enlace de vuelta al dashboard.

2. **No hay forma de borrar una congregación creada por error.** El
   formulario "Registrar nueva congregación" (en `/pastoral-distrital`,
   no en `/distritos` como se asumía) crea filas reales vía
   `crear_congregacion_con_pastor` + invitación real de Supabase Auth
   por correo — y no existe ninguna política RLS de `DELETE` sobre
   `congregaciones`/`personas`/`pastores`/`roles_sistema` para
   revertirlo. Un typo o una congregación duplicada queda ahí para
   siempre (o requiere acceso `service_role` directo a la base de
   datos). Recomendación: decidir si se agrega una vía de baja lógica
   (`activa=false`) para congregaciones, similar a como ya funciona
   "Retirar" en Equipo de trabajo.

3. **`historial_amigos` y hallazgos de accesos**: ya resuelto en una
   sesión previa (ver `docs/pendientes.md`), se menciona aquí solo para
   dejar constancia de que quedó verificado en esta ronda de QA sin
   recurrencia.

## Hallazgos menores / cosméticos

- **Warning `validateDOMNesting`** (botón dentro de botón) causado por
  `InfoTip` en `EscuelaDominical.jsx`, `Musica.jsx`,
  `EducacionArtistica.jsx`, `EducacionTeologica.jsx` — cosmético/a11y,
  no afecta funcionalidad.
- **PWA sin las *future flags* de React Router v7**: la web ya declara
  `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}`
  en su `<BrowserRouter>` (`siga-nacional/src/App.jsx`), la PWA no —
  genera 2 warnings de consola en cada navegación. Arreglo trivial:
  copiar el mismo `future={{...}}` al `App.jsx` de la PWA.
- **401 intermitente en consola justo tras login** (visto en Damas
  Dorcas, Feligresía, Módulos, Obra Carcelaria, y una vez en el chequeo
  de login) — no reproducible de forma consistente, no bloquea nada
  visible; posible carrera entre el token de sesión propagándose y la
  primera petición a Supabase. Vigilar si se repite en producción.
- **Rol activo se guarda en `localStorage`, no `sessionStorage`**
  (`useMiRol.js`) — sobrevive cierres de navegador (distinto de "solo
  por sesión"). El comportamiento parece intencional, pero vale
  confirmar que es el deseado para el producto.
- **Acento inconsistente "Uno Mas" vs "Uno Más"** en
  `ruta_estaciones.nombre` (dato sembrado) vs el título real de la
  página — cosmético, pendiente de sesión anterior.
- **Posible bug de "-1 días" por huso horario** en `diasDesde()`
  (`src/lib/rutaEvangelistica.js`) — América/Bogotá UTC-5, pendiente de
  sesión anterior, no verificado a fondo todavía.
- **`ruta_procesos.responsable_persona_id` es nullable a nivel de base
  de datos** (solo se exige en el frontend) — nota de hardening,
  pendiente de decisión.
- **Higiene de entorno de desarrollo**: procesos node huérfanos
  ocupando los puertos 5174-5177 y 5183-5184 en esta máquina (restos de
  corridas anteriores de QA); no afecta producción, pero se recomienda
  liberar esos puertos y considerar `strictPort: true` en los
  `vite.config.js` de ambos repos para que un servidor mal levantado
  falle rápido en vez de derivar a otro puerto en silencio.

## Confirmado que funciona bien (sin hallazgos)

- Login/logout, RoleChooser (4 tarjetas correctas, sin Super Admin
  cuando no aplica), "Cambiar de rol" sin cerrar sesión (sidebar
  cambia de verdad: 26 ítems local → 11 distrital → 13 nacional),
  sesión persistente tras recargar, rutas protegidas redirigen a login
  sin sesión.
- Feligresía (6 pestañas reales: Población, Familias, Comités,
  Seguimiento pastoral, Traslados, Evolución), Red de Familias
  (incluida integración con Obra Social — un caso vinculado cambia de
  "Identificada" a "En apoyo" automáticamente), los 7 módulos de
  grupos/beneficiarios (Escuela Dominical, Damas Dorcas, Música,
  Educación Artística, Educación Teológica, Conquistadores, Obra
  Social), Obra Carcelaria, Módulos y actividades, Configuración,
  Equipo de trabajo (bajas lógicas por diseño, con historial
  conservado).
- Pantallas distritales y nacionales (`/pastoral-distrital`,
  `/gestion-pastoral-nacional`, `/comites-nacional`,
  `/impacto-misionero`, `/reportes` con exportación CSV real,
  `/salud-datos`), incluida la nueva sección "Ruta Evangelística por
  congregación" con las 6 columnas correctas.
- Ruta Evangelística completa: las 6 estaciones (Uno Más, BIS, REFAM,
  ESFOB, Discipulado, Métodos) con movimiento libre entre estaciones,
  responsable obligatorio, línea de tiempo del amigo, exportación PDF,
  catálogos de lecciones REFAM/ESFOB con progreso medible.
- El bug de "cero fantasma" en campos numéricos **no se reprodujo** en
  Red de Familias ni Obra Carcelaria tras el fix de esta sesión —
  confirmado escribiendo carácter por carácter, no con `.fill()`.
- PWA: login, navegación de los 4 módulos de captura (Ujieres,
  Misiones y Evangelismo, Misión Juvenil, Obra Carcelaria),
  `/estadisticas`, logout y sesión persistente — todo funciona; por
  diseño no tiene RoleChooser ni sidebar (es una herramienta de
  captura de un solo propósito, con "asignaciones" por módulo en vez
  de roles).

## Aclaraciones (no son bugs)

- `/suscripciones` es exclusiva de `super_admin`, no de `nacional`.
- Los selects de "Persona/Instructor/Maestro" solo listan personas con
  `estado_membresia = activo` — filtro correcto, no bug.
- Génward del censo con solo 1% de campo "Género" diligenciado es un
  problema real de calidad de datos, no un bug de la pantalla de Salud
  de Datos (que está haciendo justo su trabajo de exponerlo).
- Los `net::ERR_ABORTED` en peticiones `HEAD` de conteo son un
  artefacto de doble-render de React StrictMode en desarrollo, sin
  impacto visible en las cifras mostradas.

## Entorno de pruebas

Persona de prueba y congregación aislada quedan activas hasta que se
confirme que ya no se van a usar — ver `supabase/qa_entorno_pruebas_2026-09-04.sql`
(lo que se creó) y `supabase/qa_entorno_pruebas_cleanup.sql` (para
revertirlo, NO ejecutado todavía).
