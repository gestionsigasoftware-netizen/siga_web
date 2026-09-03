# Mensajes de éxito que no se cerraban solos (2026-09-03)

## El bug reportado

El usuario vio en Evangelismo que "Lugar de cobertura creado." se
quedaba fijo en pantalla después de crear una zona, en vez de
desaparecer solo a los pocos segundos como pasa en el resto de la app.

## Alcance real: mucho más grande de lo que parecía

Al revisar, el patrón de auto-cierre (`useEffect` con `setTimeout(() =>
setNotice(null), 4500)`) solo existía en **4 de 23 pantallas** que usan
`notice`: Suscripciones, Solicitudes, Soporte y FeligresiaAdmin. Las
otras **19 pantallas nunca lo tuvieron** — no era un caso aislado de
Evangelismo, era el patrón por defecto en casi toda la app desde que se
creó cada pantalla.

## Corrección

Se agregó el mismo `useEffect` a las 19 pantallas restantes:
EscuelaDominical, Amigos, EducacionTeologica, ConfiguracionSistema,
DamasDorcas, Configuracion, EducacionArtistica, Conquistadores,
MisionJuvenil, GestionDistritos, Evangelismo, Login, RedFamilias,
Perfil, RutaFormacion, PastoralDistrital, Musica, ObraSocial,
ObraCarcelaria. En `Login.jsx` también faltaba importar `useEffect`.

## Sobre el segundo reporte (esqueleto de carga "móvil" en web)

El usuario también reportó que el esqueleto de carga del Resumen (los
bloques grises pulsantes mientras carga) se veía como una versión
"móvil" dentro de la pantalla de escritorio. Se investigó a fondo:

- No existe un componente de esqueleto separado para móvil vs. web —
  `src/components/Skeleton.jsx` tiene un solo set de componentes,
  usados igual en todos los tamaños de pantalla.
- El esqueleto de Dashboard.jsx (hero + `SkeletonStatTiles` +
  `SkeletonChart` ×2) se renderiza dentro del mismo contenedor
  responsive (`mx-auto max-w-[1220px]`, en `MainLayout.jsx`) que usa el
  contenido ya cargado — no hay un contenedor más angosto aparte para el
  estado de carga.
- `.page-shell` (la clase que usan la mayoría de las pantallas) tampoco
  impone un ancho más angosto — es solo `flex flex-col gap-6`.

No se encontró una causa de código concreta para un ancho distinto
entre el esqueleto y el contenido cargado. Puede ser un efecto visual
momentáneo (el esqueleto por naturaleza tiene menos elementos y más
espacio en blanco, lo que puede leerse como "más simple/móvil" sin ser
realmente más angosto). **No se aplicó ningún cambio para esto** — se
necesita confirmar si es reproducible de forma consistente antes de
seguir buscando, para no arriesgar un cambio a ciegas.

## Verificación

`npm run build` corre limpio.

## Acción requerida del usuario

Ninguna en base de datos. Para el tema del esqueleto: confirmar si pasa
siempre al cargar `/app`, o si fue un caso puntual.
