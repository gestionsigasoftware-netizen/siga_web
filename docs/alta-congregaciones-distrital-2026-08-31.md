# Alta de congregaciones desde el rol distrital

Fecha: 31 de agosto de 2026

## Problema

La IPUC tiene 36 distritos; cada líder distrital debe poder dar de alta las
congregaciones locales de su distrito y dejar operando a su primer pastor,
todo desde la web — nunca desde Supabase directamente (no es ético que un
usuario final tenga acceso a la base de datos).

Se verificó que **no existía ningún camino funcional para crear una
congregación nueva**: la única política que lo permitía
(`congregaciones_insert_self_register`) fue eliminada por seguridad en
`migracion_produccion.sql` y nunca se reemplazó por un flujo administrativo
real. Peor aún: aunque se creara la congregación a mano, **tampoco había
forma de dar acceso de login a su primer pastor**, porque la función que
invita usuarios (`invitar-usuario`) exige el permiso `usuarios.administrar`,
que nadie tiene todavía en una congregación recién creada — nadie es "local"
ahí aún. Era un vacío de punta a punta, no solo un permiso faltante.

## Solución construida

### Base de datos (`supabase/gestion_distrital_congregaciones.sql`, nuevo archivo)

- Política `congregaciones_insert_distrital`: un líder distrital puede
	insertar congregaciones únicamente dentro de su propio distrito
	(`distrito_id in (select mis_distritos())`).
- Función `crear_congregacion_con_pastor(distrito, nombre, pastor_nombres,
	pastor_apellidos, pastor_telefono)`: alta atómica que crea la
	congregación (`estado = 'pendiente_aprobacion'`, respetando el flujo de
	Aprobaciones ya existente), la primera persona del censo (el pastor), su
	`roles_sistema` (nivel local, rol pastor) y su registro en el módulo de
	gestión pastoral (`pastores` + `asignaciones_pastorales`), para que ambos
	sistemas —censo/acceso y seguimiento pastoral distrital— queden
	coherentes desde el primer momento, no desconectados como antes.
- Función `distrital_puede_iniciar_congregacion(congregacion, persona)`:
	autoriza a la Edge Function de invitación a aceptar al líder distrital
	únicamente para la persona puntual que él mismo creó y que todavía no
	tiene cuenta vinculada, dentro de su propio distrito. No amplía sus
	permisos sobre el resto del censo de esa ni de otras congregaciones.

### Edge Function (`supabase/functions/invitar-usuario/index.ts`)

Se agregó una segunda condición de autorización: si el chequeo normal
(`usuarios.administrar`) falla, se acepta también si
`distrital_puede_iniciar_congregacion` lo autoriza. El resto de la función
no cambió.

### Interfaz (`src/pages/PastoralDistrital.jsx`)

Nueva sección "Registrar nueva congregación" al inicio de la pantalla:
nombre de la congregación, nombres/apellidos/teléfono/correo del pastor. Al
enviarla: crea todo lo anterior y, en el mismo paso, envía la invitación de
acceso real al correo del pastor (reutilizando el mismo mecanismo que ya usa
Equipo de trabajo). La congregación queda "pendiente de aprobación" — el
mismo líder distrital la activa después desde Aprobaciones, sin flujo
especial nuevo que mantener.

## Acción requerida del usuario (no la puedo ejecutar yo)

1. Ejecutar `supabase/gestion_distrital_congregaciones.sql` completo en el
	 SQL Editor (nuevo archivo, es repetible).
2. Redesplegar la Edge Function: `supabase functions deploy invitar-usuario`.

## Validación ejecutada

- `npm run build`: correcto.
- **Probado de extremo a extremo el 2026-08-31** con una cuenta real de rol
	distrital (se le agregó ese rol, adicional al local, a la cuenta de
	prueba existente — una persona puede tener varios roles). Verificado en
	vivo vía Playwright y llamadas directas:
	- El Sidebar y Pastoral Distrital muestran correctamente la vista de
		nivel distrital (sin errores de consola).
	- `crear_congregacion_con_pastor()` y la política
		`congregaciones_insert_distrital` ya estaban aplicadas y funcionan:
		crean la congregación, la persona del pastor, su `roles_sistema`,
		`pastores` y `asignaciones_pastorales` de forma atómica.
	- Tras redesplegar `invitar-usuario` (`npx supabase functions deploy
		invitar-usuario --project-ref yeexyxsysuczsxbnauqf`, requiere `npx
		supabase login` primero), la autorización
		`distrital_puede_iniciar_congregacion` funciona: la función acepta al
		líder distrital y llega hasta el paso real de invitar en Supabase
		Auth. Dos intentos de prueba fallaron ahí mismo por motivos ajenos al
		código (dominio de correo inválido de prueba, y luego límite de envío
		de correos de Supabase Auth) — confirmando que la lógica de
		autorización y el flujo completo sí funcionan; no se creó ningún
		usuario de Auth huérfano en ninguno de los intentos.
	- Todos los registros de prueba (congregación, persona, pastor,
		asignación) se limpiaron, salvo dos filas en `congregaciones` que el
		cliente no puede borrar (no existe política de DELETE para
		`congregaciones`, por diseño) — quedan con `pastor_id = null` y sin
		personas asociadas, inocuas, pendientes de un `delete` manual opcional
		en el SQL Editor.

## Pendiente, fuera de este alcance

- **Límite de envío de correo de Supabase Auth**: por defecto es muy bajo
	(pensado para desarrollo). Antes de operar con las ~5.000 congregaciones
	reales, hay que configurar un proveedor SMTP propio (Resend, SendGrid,
	Postmark, etc.) en la configuración de Auth del proyecto, o las
	invitaciones a pastores van a fallar por límite de tasa en producción.
- Mostrar visualmente el `estado` (pendiente/activa/suspendida) de cada
	congregación en esta misma pantalla — hoy solo se ve en Aprobaciones.
- El panel de monitoreo distrital agregado (gráficos e insights por
	congregación del distrito) — pedido explícitamente por el usuario, es un
	desarrollo aparte, todavía no construido.
- Expandir el modelo de datos de `pastores` (salario, tiempo de servicio,
	cargos distritales más allá de la asignación a una congregación) — el
	usuario lo pidió documentar; requiere definir con él las reglas de
	privacidad antes de construir almacenamiento para datos sensibles como
	salario.
