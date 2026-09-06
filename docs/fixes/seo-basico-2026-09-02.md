# SEO básico: meta tags, robots.txt, sitemap.xml (2026-09-02)

## La pregunta del usuario

Al buscar `sigap.com.co` en Google, el sitio no aparece, aunque carga
normal si se escribe la URL directamente en el navegador. No es un bug
ni una mala configuración del proyecto — es el comportamiento normal de
**cualquier** sitio nuevo: Google no lo ha indexado todavía porque nunca
se le dijo que existe, y hasta ahora la página no tenía nada que
ayudara a que lo entienda (sin descripción, sin sitemap, sin robots.txt).

## Qué se agregó

- **`index.html`**: título más descriptivo, `<meta name="description">`,
  etiquetas Open Graph / Twitter Card (para que al compartir el enlace
  en WhatsApp, Facebook, etc. se vea una tarjeta con nombre, descripción
  e imagen en vez de un link pelado), y `<link rel="canonical">`.
- **`public/robots.txt`**: permite indexar solo las páginas públicas
  (`/`, `/ayuda`, `/legal`, `/login`) — el resto de la app está detrás de
  inicio de sesión (`ProtectedRoute` en `App.jsx`), así que no tiene
  sentido que Google intente indexarlo (ni podría, sin sesión).
- **`public/sitemap.xml`**: lista esas mismas páginas públicas para que
  Google las descubra más rápido.

## Lo que esto NO resuelve por sí solo

Estos archivos ayudan a que, **cuando** Google rastree el sitio, lo
entienda bien. Pero no obligan a Google a rastrearlo ya — un dominio
nuevo sin ningún enlace externo hacia él puede tardar semanas o nunca
ser descubierto solo. El paso que realmente lo activa es:

## Acción requerida del usuario: Google Search Console

1. Entrar a [search.google.com/search-console](https://search.google.com/search-console)
   con una cuenta de Google.
2. Agregar la propiedad `sigap.com.co` (tipo "Dominio", cubre http/https
   y www automáticamente).
3. Verificar la propiedad agregando un registro TXT en el DNS —
   como el dominio está en Cloudflare, se agrega ahí (Cloudflare
   dashboard → sigap.com.co → DNS → Records → Add record, tipo TXT, con
   el valor exacto que Google Search Console indique).
4. Una vez verificado, enviar el sitemap: Search Console → Sitemaps →
   pegar `sitemap.xml` → Enviar.
5. Opcional pero recomendado: usar "Inspeccionar URL" sobre
   `https://sigap.com.co/` y pedir indexación manual — esto suele hacer
   que aparezca en Google en horas o pocos días en vez de semanas.

Esto no lo puedo hacer yo — requiere la cuenta de Google del usuario y
acceso a agregar registros DNS reales en Cloudflare.

## Verificación

`npm run build` corre limpio. No se puede verificar la indexación real
en Google desde aquí (depende de Search Console, paso manual).

## Acción requerida del usuario

Completar los pasos de Google Search Console arriba.
