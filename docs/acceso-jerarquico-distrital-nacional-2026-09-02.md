# Otorgar acceso distrital/nacional sin depender de Supabase (2026-09-02)

## Contexto

El usuario preguntó si "Equipo de trabajo" debía funcionar en distrital y
nacional. Se revisó el código: esa pantalla está correctamente limitada a
local (gestiona el acceso web dentro de una sola congregación). Pero al
investigar se encontró un vacío real un nivel más arriba: el 31 de agosto
se había resuelto que un distrital pueda crear una congregación y darle
acceso a su primer pastor (`gestion_distrital_congregaciones.sql`), pero
**no existía ningún camino en la app para el siguiente escalón** —
nacional dando de alta a un nuevo líder distrital, o super_admin dando de
alta a un nuevo líder nacional. Sin esto, la única forma de crear esos
roles era entrando directo a Supabase, exactamente lo que ya se había
identificado como incorrecto para el caso local.

## Qué se construyó

- **`supabase/otorgar_rol_jerarquico.sql`**:
  `puede_otorgar_rol_jerarquico(p_nivel)` — verifica que quien pide el
  otorgamiento tenga permiso real: solo `super_admin` puede otorgar nivel
  nacional; `nacional` o `super_admin` pueden otorgar nivel distrital.
- **`supabase/functions/otorgar-acceso-jerarquico/index.ts`** (Edge
  Function nueva): valida el permiso vía la función anterior, busca o
  invita la cuenta de Auth de la persona (mismo mecanismo que
  `invitar-usuario`, incluyendo que el nombre real del censo viaja al
  crear la cuenta) y, solo si todo lo anterior funcionó, inserta el
  `roles_sistema` correspondiente (nivel distrital con su distrito, o
  nacional). No duplica accesos ya activos.
- **`src/pages/GestionPastoralNacional.jsx`**: nueva sección "Otorgar
  acceso al sistema" — busca cualquier persona del censo nacional (no
  solo de una congregación), selecciona el nivel a otorgar (nacional
  solo visible si quien está usando la pantalla es super_admin) y, si
  aplica, el distrito.

## Por qué se diseñó como una Edge Function separada, no una extensión de `invitar-usuario`

`invitar-usuario` está pensada específicamente para acceso local
(perfiles de acceso y módulos dentro de una congregación). Mezclar ahí la
lógica de otorgar niveles jerárquicos habría complicado una función ya
usada en producción sin necesidad — la nueva función comparte el mismo
patrón (verificar permiso vía RPC, buscar/crear cuenta con
`service_role`, vincular, y recién al final escribir el registro de
negocio) pero vive separada.

## Acción requerida del usuario

1. Ejecutar `supabase/otorgar_rol_jerarquico.sql` en el SQL Editor.
2. Desplegar la función nueva `otorgar-acceso-jerarquico`. Como no hay
   CLI instalado en esta máquina, hacerlo desde el dashboard de
   Supabase: Edge Functions → **Deploy a new function** → **Via Editor**
   → nombrarla exactamente `otorgar-acceso-jerarquico` → pegar el
   contenido de `supabase/functions/otorgar-acceso-jerarquico/index.ts`
   → Deploy.
