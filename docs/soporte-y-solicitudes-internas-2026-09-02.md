# Soporte técnico y solicitudes internas entre niveles (2026-09-02)

## Contexto

Dos necesidades distintas que el usuario aclaró por separado:

1. **Soporte hacia el equipo que mantiene SIGAP** — para reportar bugs o
   fallas técnicas. Esto es comunicación *hacia afuera* del modelo
   jerárquico de la IPUC.
2. **Comunicación interna formal entre niveles** — local ↔ distrital,
   distrital ↔ nacional, en ambos sentidos. El usuario preguntó
   explícitamente si debía ser un chat libre o algo más estructurado; se
   recomendó un sistema de tickets (no chat) porque a la escala de 36
   distritos y sus congregaciones, un chat sin estados/prioridad se
   vuelve imposible de triage — nadie podría ver qué está pendiente.

## 1. Soporte técnico (`supabase/reportes_soporte.sql`, `src/pages/Soporte.jsx`)

- Cualquier usuario logueado puede reportar un problema (asunto,
  descripción) — se guarda con su correo, nivel, congregación y la
  página donde estaba, automáticamente.
- Solo nacional/super_admin (el equipo que mantiene SIGAP) ve todos los
  reportes y puede marcarlos resueltos. Cualquier otro usuario solo ve
  los suyos.
- **`supabase/functions/notificar-reporte-soporte/index.ts`** (Edge
  Function nueva): envía un correo a `soportesigasoftware@gmail.com` vía
  la API de Resend cuando llega un reporte nuevo — usa el mismo dominio
  ya verificado. Si el secreto `RESEND_API_KEY` no está configurado, el
  reporte igual queda guardado (el correo es un aviso adicional, no el
  mecanismo principal, así que no rompe el flujo si falta).
- Debajo del formulario se muestra el correo de soporte para contacto
  directo urgente.

## 2. Solicitudes internas (`supabase/solicitudes_jerarquicas.sql`, `src/pages/Solicitudes.jsx`)

Sistema de tickets con tipo (administrativa/queja/sugerencia/recurso/otro),
prioridad, estado (pendiente/en proceso/resuelto/cerrado) y un hilo de
respuestas dentro de cada uno — como un issue de GitHub, no un chat.

- **Local** solo puede enviar a su distrital (no elige, es automático).
- **Distrital** puede enviar a Nacional, o a una congregación específica
  de su propio distrito.
- **Nacional/super_admin** puede enviar a cualquier distrito.
- Solo se permiten direcciones entre niveles adyacentes (no
  nacional → local directo, por diseño — respeta la cadena de autoridad).
- Notificaciones automáticas (reutilizando `crear_notificacion_usuario`,
  ya usado en el resto de la app) cuando llega una solicitud nueva o una
  respuesta, con el mismo mecanismo de link `enlace` que ya usan las
  demás notificaciones.
- Nacional/super_admin ve todas las solicitudes del país (mismo criterio
  de alcance total que ya tienen en el resto de SIGAP); distrital ve las
  de su distrito; local ve las suyas.

## Acción requerida del usuario

1. Ejecutar `supabase/reportes_soporte.sql`.
2. Ejecutar `supabase/solicitudes_jerarquicas.sql`.
3. Desplegar la función nueva `notificar-reporte-soporte` desde el editor
   web de Supabase (igual que las anteriores — Deploy a new function →
   Via Editor → pegar el contenido de
   `supabase/functions/notificar-reporte-soporte/index.ts`).
4. **Opcional pero recomendado**: agregar el secreto `RESEND_API_KEY` en
   la configuración de Edge Functions de Supabase (Project Settings →
   Edge Functions → Secrets) con la misma API key que ya crearon en
   Resend. Sin esto, los reportes se siguen guardando bien, solo no
   llega el correo de aviso a `soportesigasoftware@gmail.com`.
