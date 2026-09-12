# Auditoría visual de producción — 2026-09-11

## Contexto

El usuario preguntó si el frontend está visualmente listo para
producción, más allá de las pantallas que ya recibieron atención esta
sesión (Feligresía/Personas/Amigos/Dashboard/Login). Se hizo una
auditoría de las 31 rutas de la app (desktop 1440×900 y móvil
390×844), con el usuario de prueba real `pueba691@gmail.com`.

## Resultado

El rediseño de esta sesión no quedó aislado: ya está aplicado de
forma consistente en prácticamente toda la app autenticada (Sepri,
Música, Educación Artística/Teológica, Conquistadores, Obra Social,
Damas Dorcas, Escuela Dominical, Obra Carcelaria, BIS/Uno Más/REFAM/
ESFOB/Discipulado, Misiones y Evangelismo, Misión Juvenil, Reportes,
Soporte, Solicitudes, Manual, Salud de Datos, Suscripciones, Equipo de
trabajo, Red de Familias, Corrección de asistencia, Configuración) --
todas usan el sistema de tarjetas con sombra en capas, tienen estados
vacíos con texto real (no tablas en blanco) y renderizan bien en
ambos tamaños de pantalla. **Nada bloqueante antes de más clientes.**

Dos inconsistencias menores reales, corregidas de inmediato por ser
cambios de una línea:

1. `src/pages/Perfil.jsx` -- el avatar de "Mi perfil" era un círculo
   negro plano con la inicial del correo, en vez del sistema
   compartido de iniciales con color (`src/lib/avatar.js`) que ya usan
   Feligresía/Personas/Amigos. Corregido: ahora usa
   `avatarTone(user.id)` + `initialesDe(...)`, con el mismo tratamiento
   de sombra en capas.
2. `src/pages/RutaFormacion.jsx` (compartido por Esfob y Discipulado)
   -- el panel derecho, cuando no hay nadie seleccionado en la lista,
   usaba un borde punteado (`border-dashed`) en vez de la tarjeta
   sólida (`.card`) que usa el resto de estados vacíos de la app.
   Corregido a `.card`.

Dos pulidos menores, identificados pero sin corregir (no urgentes):

- `ReportesOptimizado.jsx`/`RegistrarAsistencia.jsx`: en móvil, las
  tablas anchas no tienen ninguna pista visual de que se pueden
  desplazar horizontalmente (la columna "Asistentes" queda fuera de
  vista hasta que alguien desliza).
- `Soporte.jsx`/`Solicitudes.jsx`: en desktop, el formulario angosto
  deja como la mitad de la pantalla vacía -- se ve un poco disperso
  comparado con pantallas más densas.

## Verificación

`npm run build` sin errores tras los dos cambios. Confirmado con
Playwright (cuenta real `pueba691@gmail.com`): captura de `/perfil`
muestra el avatar "JS" con color de fondo; captura completa de
`/discipulado` muestra el panel "Selecciona una persona de la lista"
con la tarjeta sólida en vez del borde punteado.
