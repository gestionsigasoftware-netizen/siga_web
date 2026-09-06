# FAQ ampliado y Manual de uso por nivel (2026-09-02)

## FAQ (`src/pages/Ayuda.jsx`)

Pasó de 4 preguntas sueltas a 13, organizadas en 3 grupos: "Empezar a
usar SIGAP", "Uso diario" y "Privacidad, datos y soporte técnico". Se
agregaron preguntas que reflejan trabajo real de esta sesión (el nombre
genérico al registrarse, cómo hacer un traslado, cómo hablar con tu
distrital/nacional, cómo reportar un bug) en vez de quedarse solo con lo
básico de acceso/contraseña que ya existía.

## Manual de uso (`src/pages/Manual.jsx`, nuevo, ruta `/manual`)

Página nueva dentro de la app (autenticada, visible para todos los
niveles vía Sidebar) con 3 pestañas — Local, Distrital, Nacional — que
explican qué hace cada pantalla real de SIGAP, agrupadas por tema (censo,
comités, gestión pastoral, supervisión, herramientas generales). Cubre
las ~30 pantallas que existen hoy, verificadas contra
`Sidebar.jsx` (la fuente de verdad de qué existe por nivel) para no
dejar ningún módulo por fuera. Arranca en la pestaña del nivel de quien
está viendo, pero cualquiera puede ver las otras — útil para que, por
ejemplo, un distrital entienda qué ve exactamente un pastor local.

## Acción requerida del usuario

Ninguna — ambos son contenido de frontend puro, sin migraciones SQL.
