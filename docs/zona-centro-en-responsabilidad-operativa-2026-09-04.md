# Zona / centro de reclusión al asignar responsabilidad operativa (2026-09-04)

## El hallazgo (por qué era urgente)

"Equipo de trabajo" nunca pedía zona al asignar la "Responsabilidad
operativa" de Evangelismo o Misión Juvenil, pese a que ambos módulos
tienen `requiere_zona = true`. Esto significa que **probablemente
ningún cargo de Evangelismo/Misión Juvenil creado hasta hoy tiene zona
asignada**, y cada registro de asistencia capturado desde la PWA se
guarda con `zona_id` en blanco.

Más grave aún: la política de seguridad de "Amigos"
(`amigos_write`, `schema.sql`) exige `tengo_acceso_zona(zona_id)` --
que compara contra `asignaciones_cargo.zona_id` -- para dejar
registrar un Amigo nuevo. Sin zona en el cargo, un capturador puro
(sin rol de pastor) **nunca podría** dar de alta un Amigo, sin importar
qué se construya en la PWA para eso. Este arreglo es un requisito
previo real, no solo una mejora de UX.

## Diseño confirmado con el usuario

- Zona y centro de reclusión se muestran como catálogos **propios de
  cada congregación** (zonas ya lo eran; centros de reclusión ya se
  filtraban por distrito). Puerto Tejada tiene 4 congregaciones, cada
  una con sus propios barrios -- no se mezclan.
- Mismo mecanismo para Evangelismo y Misión Juvenil (ambos usan
  `zona_id` de forma idéntica). "Instituciones" de Misión Juvenil es un
  concepto aparte (colegios/universidades, gestión propia en la web) --
  no se tocó, queda fuera de este cambio.
- Obra Carcelaria usa el mismo patrón pero con centro de reclusión en
  vez de zona.

## Cambios

- **`supabase/asignaciones_cargo_centro.sql`** (nuevo): agrega
  `asignaciones_cargo.centro_id` (ya existía `zona_id`, faltaba el
  equivalente para Obra Carcelaria).
- **`supabase/functions/invitar-usuario/index.ts`**: acepta `zonaId` y
  `centroId` opcionales, los valida (la zona debe pertenecer a la
  congregación; el centro debe existir), y los guarda al crear la
  `asignaciones_cargo`. Si la persona ya tenía el cargo activo, también
  permite **actualizar** la zona/centro sin tener que retirar y volver
  a asignar.
- **`src/pages/EquipoCongregacion.jsx`**: el formulario "Agregar o
  actualizar acceso" ahora muestra un selector adicional **obligatorio**
  cuando corresponde -- "Zona de la que será responsable" (Evangelismo/
  Misión Juvenil) o "Centro de reclusión del que será responsable"
  (Obra Carcelaria) -- poblado con los catálogos reales de esa
  congregación/distrito. La lista de "Responsabilidades operativas" ya
  muestra la zona o el centro asignado junto al módulo.

## Verificación

`npm run build` corre limpio. Pendiente probar de punta a punta una vez
desplegada la Edge Function actualizada y ejecutado el script SQL.

## Acción requerida del usuario

1. Ejecutar `supabase/asignaciones_cargo_centro.sql` en el SQL Editor
   de Supabase.
2. **Desplegar la Edge Function actualizada** (no se pudo hacer desde
   aquí, requiere sesión del CLI de Supabase que no está disponible en
   este entorno). Dos formas:
   - **Dashboard de Supabase** → Edge Functions → `invitar-usuario` →
     reemplazar el código por el contenido actual de
     `supabase/functions/invitar-usuario/index.ts` → Deploy.
   - **CLI**, si lo tienes instalado y logueado en tu propia terminal:
     `supabase functions deploy invitar-usuario` desde la raíz del
     proyecto.
3. Después de eso, revisar si hay cargos existentes de Evangelismo/
   Misión Juvenil sin zona (probablemente todos) y volver a invitar a
   esas personas para completarles la zona -- el sistema ya lo permite
   sin retirarles el acceso primero.
