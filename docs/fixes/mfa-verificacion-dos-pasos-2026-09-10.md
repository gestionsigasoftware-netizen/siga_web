# Verificación en dos pasos (MFA/TOTP) (2026-09-10)

Parte del cierre del checklist de seguridad de producción: el usuario
ya activó MFA en su propia cuenta de Supabase (protege el panel de
administración), pero faltaba la pieza equivalente **dentro de SIGAP**
para las cuentas nacional/super_admin (y cualquier otro usuario que
quiera activarla) — la tarjeta "Seguridad" de Preferencias personales
era solo texto fijo, sin ninguna acción real detrás.

## Qué se construyó

- `src/lib/mfa.js`: envoltorio delgado sobre la API nativa de MFA de
  Supabase Auth (`listFactors`, `enrollTotp`, `confirmEnrollment`,
  `unenrollFactor`, `getAssuranceLevel`, `verifyLoginChallenge`).
- **Activación** (`src/pages/ConfiguracionSistema.jsx`, nueva sección
  "Verificación en dos pasos"): genera un código QR + clave manual de
  respaldo, pide el código de 6 dígitos para confirmar, y permite
  desactivarla después. Si el usuario cancela a medias, se limpia el
  factor "no verificado" para no dejar basura en la cuenta.
- **Verificación al iniciar sesión** (`src/pages/Login.jsx`): tras una
  contraseña correcta, si la cuenta tiene un factor TOTP verificado, la
  sesión queda en `aal1` (no autorizada del todo) y se muestra un paso
  nuevo pidiendo el código de 6 dígitos antes de dejar entrar — sin
  esto, activar MFA no habría cambiado nada real en el login.

Disponible para cualquier cuenta (no se restringió por rol) porque
restringirlo no agregaba seguridad real y sí complejidad; se le indica
al usuario en el propio texto que es "muy recomendado para cuentas
nacional y super_admin".

## Verificación

De punta a punta con Playwright y un generador TOTP propio (RFC 6238,
sin dependencias externas, calculando el código real a partir del
secreto mostrado en pantalla) contra la cuenta de prueba real:
1. Login normal antes de activar -- entra directo, sin pedir código.
2. Activar: QR + secreto se muestran, código calculado confirma la
   activación, queda "Activada".
3. Cerrar sesión y volver a entrar con la misma contraseña -- esta vez
   se queda en `/login` pidiendo el código (no deja pasar solo con la
   contraseña).
4. Código válido calculado en el momento -- completa el login a `/app`.
5. Desactivar desde Preferencias -- vuelve a "No activada" (limpieza
   de la cuenta de prueba, sin dejar MFA activo compartido).

Cero errores de consola en todo el flujo. `npm run build` limpio.

## Pendiente relacionado (no bloqueante)

No hay forma de "resetear" el MFA de un usuario que perdió su
dispositivo/app autenticadora desde la propia app (tendría que
hacerse manualmente en el panel de Supabase, tabla `auth.mfa_factors`,
o dándole soporte directo). Aceptable para el volumen inicial de
usuarios; si se vuelve frecuente, vale la pena una pantalla de soporte
para esto.
