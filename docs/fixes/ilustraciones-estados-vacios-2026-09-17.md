# Ilustraciones para estados vacíos, error, 404 y login — 2026-09-17

## Contexto

El usuario pidió que SIGAP se sintiera "amigable en todo lado", empezando
por una revisión visual en Google Meet de una ilustración de estado
vacío. Se probaron primero varios estilos dibujados a mano en un lienzo
de diseño (línea suave, geometría de marca, motivo comunitario, insignia
con ícono, personas dibujadas a mano) -- el usuario los rechazó por verse
"genéricos, no premium". Se optó entonces por **ilustraciones reales de
unDraw** (https://undraw.co, licencia libre para uso comercial, sin
atribución obligatoria, pensada para recolorear su único color de
acento), confirmadas explícitamente por el usuario como el nivel de
calidad correcto.

**Reglas explícitas del usuario para todo el set**:
- Nivel de calidad "premium" (ilustraciones profesionales, no dibujadas
  a mano).
- Cada ilustración distinta según el contexto -- no repetir siempre la
  misma escena.
- Variedad de género entre las distintas ilustraciones.
- **Sin tono de piel realista, ni blanco ni negro** -- se reemplazó el
  tono de piel original de cada ilustración (varios hex distintos según
  el archivo: `#fbbebe`, `#ffb8b8`, `#ffb6b6`, `#ffb9b9`, `#9e616a`,
  `#a0616a`) por un único gris cálido neutro (`#B9AFA3`, de la misma
  familia que los tokens `secondary`/`muted` de SIGAP) en las 6 piezas,
  para no representar ninguna raza en particular en vez de intentar
  "representar diversidad" con un color de piel específico.
- Antes de construir: inventario real de dónde hace falta una
  ilustración en toda la app, web y PWA, empezando por inicio y login.

## Inventario (confirmado por el usuario antes de construir)

1. Error inesperado (`ErrorBoundary.jsx`, web).
2. Página no encontrada / 404 (web y PWA).
3. Bienvenida / inicio de sesión (web y PWA).
4. Estado vacío: familias/censo.
5. Estado vacío: comités/equipo/delegados.
6. Estado vacío genérico: búsquedas sin resultados y gráficos sin datos
   (`ChartEmpty`, usado en 16 archivos).

## Construido

Ilustraciones fuente (unDraw, recoloreadas): `bug-fixing`, `empty-street`,
`enter`, `family`, `team`, `empty`. Para cada una: color de piel
neutralizado a `#B9AFA3`, `var(--primary-svg-color)` dejado intacto para
recolorear vía CSS a `#2A78D6` (azul de marca) por defecto, con un prop
`primaryColor` para casos puntuales.

`src/components/illustrations/*.jsx` (nuevo, 6 componentes): cada uno
`export default function XIllustration({ className, primaryColor })`,
el SVG completo transcrito directamente (sin retocar los `path` a mano,
para no arriesgar errores de transcripción) con el color de piel ya
neutralizado.

- **`src/components/ErrorBoundary.jsx`**: `BugFixingIllustration` sobre
  el mensaje "Algo salió mal" -- la misma pantalla que causó la caída
  real en producción esta sesión.
- **`src/pages/NotFound.jsx`** (web): `EmptyStreetIllustration`
  reemplaza el ícono de brújula.
- **`src/pages/Login.jsx`** (web): `EnterIllustration` reemplaza el
  ícono `BarChart3` decorativo del panel oscuro, dentro de una insignia
  circular blanca (el panel es oscuro y la ilustración está pensada
  para fondo claro -- sin esa insignia, sus tonos oscuros se perderían).
- **`src/components/Empty.jsx`** (nuevo, compartido): antes existían
  **3 copias idénticas** de este componente (`FeligresiaAdmin.jsx`,
  `ObraCarcelaria.jsx`, `Sepri.jsx`) -- unificado en uno solo con un
  prop `illustration` (`'familia'` / `'equipo'` / `'resultados'`, este
  último por defecto) para que cada pantalla elija la escena que le
  corresponde. Los 15 usos existentes de `<Empty text=.../>` se
  actualizaron: "Aún no hay familias registradas" → `familia`, "Aún no
  hay comités/delegados registrados" (3 casos, en los 3 archivos) →
  `equipo`, el resto se queda con el genérico `resultados`.
- **`src/components/ChartEmpty.jsx`** (16 archivos lo usan): el ícono
  `BarChart3` se reemplazó por `NoResultsIllustration` en tamaño
  reducido.

### PWA (`siga movil/siga-pwa-nacional`, proyecto aparte)

Se copiaron `EmptyStreetIllustration.jsx` y `EnterIllustration.jsx` a
`src/components/illustrations/` de ese proyecto (mismo contenido que en
la web, sin modificaciones).

- **`src/pages/NotFound.jsx`**: mismo tratamiento que la web.
- **`src/pages/Login.jsx`**: `EnterIllustration` en una insignia
  circular blanca junto al titular del encabezado oscuro.

## Bug real encontrado y corregido durante la verificación

Los 6 componentes se generaron inicialmente con `width="100%"
height="auto"` como **atributos XML del `<svg>`** (no CSS). El DOM de
SVG no acepta `"auto"` como valor válido del atributo `height` (a
diferencia de la propiedad CSS `height`), lo que producía un error de
consola (`<svg> attribute height: Expected length, "auto"`) en cada
pantalla que renderizara una de estas ilustraciones -- visualmente no
se notaba (el tamaño real ya lo controlan las clases de Tailwind
pasadas por `className`, ej. `w-48 h-auto`), pero ensuciaba la consola
en producción. Corregido quitando esos dos atributos XML de los 6
componentes (web y las 2 copias en la PWA): el tamaño ya lo gobierna
por completo el CSS de `className`.

## Verificación

- `npm run build` sin errores, en la web y en la PWA, en cada paso.
- Playwright con la cuenta real: `/login` y una ruta inexistente (404)
  cargan sin ningún error de consola, con las ilustraciones visibles y
  bien proporcionadas. Se navegó a Feligresía → Evolución con datos
  reales (sin romper nada existente).
- Se renderizaron por separado los 3 SVG restantes (`family`, `team`,
  `empty`) para confirmar visualmente: personas de distinto género
  reconocible por peinado/vestimenta, sin ningún tono de piel realista
  (todas en el mismo gris neutro), proporciones y trazo de calidad
  profesional.
- No se pudo probar visualmente el estado "0 familias" ni "0 comités"
  con la cuenta real (Puerto Tejada ya tiene datos) -- verificado por
  lectura de código y por el mismo patrón ya confirmado en 404/Login.

## Pendiente (no bloqueante, mencionado pero no construido)

- La landing pública (`InicioPublico.jsx`) ya tiene un mockup de
  gráfico hecho a medida en el hero; se decidió no tocarla por ahora.
- El panel de notificaciones (`NotificationCenter.jsx`) se dejó solo
  con texto -- es un dropdown pequeño, una ilustración completa no
  cabría bien ahí.
