# Inicio: modo día/noche real + 3 idiomas (Fase 1 de una iniciativa más grande)

**Fecha:** 2026-09-25
**Archivos:** `src/pages/InicioPublico.jsx`, `src/hooks/useTheme.jsx`,
`src/components/ThemeToggle.jsx`, `src/components/LanguageSwitcher.jsx`,
`src/i18n/`, `tailwind.config.js`, `src/main.jsx`.

## Contexto

A partir de las 3 opciones de rediseño exploradas en Artifact (A/B/C),
el usuario pidió implementar tanto la Opción A como la Opción B, pero
no como dos páginas separadas: **A es el modo día** (evolución
refinada de la marca actual, con la franja "Un mismo sistema, cuatro
lecturas" que se agregó en la exploración) y **B es el modo noche**
(fondo oscuro real, encabezado con acento en degradado, diagrama de
consolidado Congregación → Distrito → Nacional en vez de la franja de
niveles). Además pidió un segundo idioma para toda la app (web y PWA)
-- terminó siendo dos: **inglés y portugués**, sumados al español -- y
que tanto el tema día/noche como el idioma apliquen también a la PWA.

Dado el tamaño real de "modo oscuro + 3 idiomas en toda la app (web +
PWA)", se acordó con el usuario abordarlo **por fases**: esta sesión
es la Fase 1, solo Inicio, construyendo la base reutilizable (hook de
tema + infraestructura de i18n) para que extenderla al resto de la
app en sesiones siguientes sea barato.

## Qué se construyó

### Tema claro/oscuro

- `tailwind.config.js`: `darkMode: 'class'` -- no afecta ninguna otra
  pantalla porque ninguna otra usa todavía clases `dark:`.
- `src/hooks/useTheme.jsx` (nuevo, **Context**, no un hook con estado
  local -- ver "Bug real encontrado" abajo): `ThemeProvider` +
  `useTheme()`. Aplica la clase `dark` en `<html>`, persiste en
  `localStorage` (`sigap:theme`), arranca en `prefers-color-scheme`
  del sistema si el usuario nunca lo cambió a mano.
- `src/components/ThemeToggle.jsx` (nuevo, reutilizable): botón
  redondo con ícono sol/luna.
- `src/main.jsx`: toda la app queda envuelta en `<ThemeProvider>` --
  listo para que cualquier pantalla futura use `useTheme()` sin tocar
  nada más.
- `InicioPublico.jsx`: reescrito para usar `theme`/`esOscuro` en vez
  de clases fijas. Día = fondo crema con órbitas doradas/azules
  (mismo lenguaje visual ya validado, tipografía más grande), noche =
  fondo `#0B0B0B`, encabezado con "la lectura" en degradado
  azul→dorado, y la sección intermedia cambia de contenido según el
  tema (franja de 4 niveles en día, diagrama SVG animado de
  consolidado en noche) -- no es solo un cambio de color, cada modo
  tiene su propia identidad, tal como se aprobó en las opciones A/B.

### Idiomas (español, inglés, portugués)

- Librerías: `react-i18next`, `i18next`, `i18next-browser-languagedetector`.
- `src/i18n/index.js`: configuración con los 3 idiomas, detección por
  `localStorage` primero y luego navegador, persistencia en
  `localStorage` (`sigap:idioma`).
- `src/i18n/locales/{es,en,pt}.json`: todas las claves de Inicio bajo
  `inicio.*`, más `common.*` (nav, pie de página, tema, idioma) ya
  preparado para cuando el resto de la app también use i18n. Las
  traducciones de inglés y portugués son reales, no automáticas ni de
  relleno.
- `src/components/LanguageSwitcher.jsx` (nuevo, reutilizable):
  selector ES/EN/PT tipo píldora, con tratamiento claro/oscuro.
- `InicioPublico.jsx`: todo el texto pasa por `t(...)`, incluyendo el
  encabezado partido en `titlePre`/`titleAccent`/`titlePost` para
  poder aplicarle el degradado solo a la palabra clave en modo noche.

## Bug real encontrado y corregido durante la verificación

Primera versión de `useTheme` era un hook normal con `useState` local
(sin Context). Al probar con Playwright, el botón de tema sí cambiaba
de ícono y sí aplicaba la clase `dark` a `<html>` y guardaba en
`localStorage` -- pero **la página en sí seguía viéndose en modo
claro**. Causa: `InicioPublico.jsx` y `ThemeToggle.jsx` llaman
`useTheme()` cada uno por su lado: con un hook de estado local (no
Context), cada llamada crea su **propia instancia de estado
aislada**. El clic en el botón solo actualizaba el estado interno del
botón (y el efecto secundario global de `localStorage`/clase en
`<html>`, que sí es compartido); la página nunca se enteraba porque
leía su propia copia del estado, nunca actualizada. Se corrigió
convirtiendo `useTheme` en un Context real (`ThemeProvider` +
`useTheme()`), con un solo Provider en la raíz de la app
(`main.jsx`). Detectado y confirmado con captura de pantalla real
(el color de fondo no cambiaba pese a que `html.dark` sí era
`true`) -- otro caso de por qué verificar visualmente, no solo por
DOM/localStorage.

## Verificación

1. `npm run build` sin errores (antes y después del fix del Context).
2. Playwright + navegación real (sin necesidad de login, Inicio es
   pública):
   - Modo oscuro: `html.dark` se aplica, `localStorage['sigap:theme']
     = 'dark'`, la franja de niveles se reemplaza por el diagrama de
     consolidado, captura de pantalla confirma el cambio visual
     completo (fondo, tipografía, tarjetas).
   - Cambio de idioma a inglés y portugués: el encabezado y el resto
     del texto cambian correctamente a cada idioma real.
   - Persistencia: recargar la página mantiene tema oscuro/claro e
     idioma elegidos (probado con `light` + `pt` tras recarga).
   - Sin errores de consola en ningún punto.

## Ajustes pedidos tras revisar la primera versión (misma sesión)

El usuario revisó la franja "Un mismo sistema, cuatro lecturas" (modo
día) y pidió corregirla antes de seguir con la Fase 2:

1. **No mencionar los 36 distritos en público** -- la descripción del
   nivel nacional decía "Lectura de los 36 distritos"; se cambió a
   "Lectura consolidada de todo el país" (sin el número, en los 3
   idiomas).
2. **Quitar "Super Admin" de cara al público** -- es un rol interno
   de la plataforma, no algo que le interese a una congregación
   evaluando SIGAP. Se eliminó la 4ª tarjeta por completo (queda
   Congregación / Distrital / Nacional) y el encabezado pasó de
   "cuatro lecturas" a "tres lecturas".
3. **"Inteligencia pastoral" → "Analítica pastoral"** en el eyebrow
   del hero (y su variante "en vivo" del modo noche), en los 3
   idiomas -- coincide además con el nombre completo de SIGAP
   ("Gestión y Analítica Pastoral").
4. **Color de la franja**: pasó de tarjetas claras (blanco sobre
   crema, con un tinte azul de fondo) a una banda oscura real
   (`bg-ink`, texto blanco, tarjetas en vidrio oscuro con acento
   azul claro `#8FC8FF`) -- mismo lenguaje visual que la sección de
   módulos justo debajo.
5. **Copywriting nuevo**: se agregó "Disponible 24/7, los 365 días
   del año." debajo de las 3 tarjetas, con ícono de reloj, en los 3
   idiomas.

Verificado con Playwright: primero un falso positivo por texto en
mayúsculas (CSS `text-transform: uppercase` hace que
`innerText` devuelva "ANALÍTICA PASTORAL", un chequeo case-sensitive
sin eso en cuenta reporta "no encontrado" aunque sí esté) y un
servidor de desarrollo obsoleto (puerto 5173 ocupado por un proceso
Vite anterior que `pkill -f vite` no mató en Windows -- hubo que
identificarlo con `netstat -ano` y matarlo por PID con `taskkill`).
La verificación final fue un volcado completo del texto renderizado
(`body.innerText()`), no un `includes()` puntual, y una captura de
pantalla real de la franja oscura.

## Pendiente (fases siguientes, no en esta sesión)

- **Fase 2**: extender modo oscuro + los 3 idiomas al resto de la
  app web (Sidebar, Dashboard, Feligresía, y las ~45 pantallas
  restantes) -- la base (`ThemeProvider`, `useTheme`, i18n con
  namespace `common.*` ya listo) ya está puesta para esto.
- **Fase 3**: aplicar el mismo tema día/noche y los mismos 3 idiomas
  a la PWA (`SIGA\siga movil\siga-pwa-nacional`, proyecto separado)
  -- todavía no se ha tocado ese proyecto en esta iniciativa.
