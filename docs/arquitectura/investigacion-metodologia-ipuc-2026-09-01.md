# Investigación: metodología y estructura real de la IPUC (2026-09-01)

## Propósito

El usuario pidió investigar en internet la metodología estadística real de
la coordinación nacional/distrital/local de la IPUC, para que SIGAP hable
el mismo idioma que la organización real a la que sirve. Esta es una nota
de investigación (no un cambio de código) — al final se listan
implicaciones concretas para el software.

**Limitación honesta de entrada**: los formatos internos exactos de
"informe estadístico" que un pastor local diligencia (el documento más
autoritativo posible) **no están publicados públicamente** — es
documentación interna de la organización, lo cual es normal y esperable.
Lo que sí se encontró públicamente (sitios oficiales de distritos,
`ipuc.org.co` y sus subdominios) permite confirmar bastante de la
estructura real. La fuente más confiable para los formatos exactos sigue
siendo pedirlos directamente a la coordinación nacional de estadística de
la IPUC, ya que el usuario tiene relación directa con la organización.

## Hallazgos confirmados

### 1. Escala real (Colombia, cifra propia de IPUC — no confundir con UPCI global)

- Aproximadamente **1.6 millones de creyentes**, **~4,100–4,250 pastores**
  ordenados, **~3,800–4,100 templos/congregaciones**, presencia en todos
  los departamentos de Colombia.
- **Nota de precisión importante**: el sitio oficial de IPUC también
  menciona "más de 8.6 millones de miembros en 144 naciones" — esa cifra
  corresponde a la **UPCI (United Pentecostal Church International)**, la
  comunión global de la que IPUC es la afiliada colombiana, **no** a IPUC
  Colombia por sí sola. Es fácil confundir ambas cifras en cualquier
  reporte o dashboard nacional — SIGAP debe dejar clarísimo en cualquier
  vista "nacional" que sus números son de Colombia únicamente.
- Fuentes: [Facebook oficial IPUC](https://www.facebook.com/IPUCoficial/), [demografía IPUC](http://ipucolombia.blogspot.com/p/demografia.html)

### 2. Doctrina — confirma por qué bautizado y sellado deben medirse por separado

IPUC practica la "Unicidad de Dios" (Oneness Pentecostalism) y el
bautismo únicamente en el nombre de Jesús. Esto es justo el trasfondo
doctrinal detrás de lo que el usuario explicó: bautismo en agua y
sellado/lleno con el Espíritu Santo son dos hitos doctrinalmente
distintos y ambos centrales — confirma que el trabajo ya hecho esta
sesión (censo de bautizados/sellados en todos los módulos) está
correctamente alineado con la identidad real de la organización.

### 3. Jerarquía nacional → distrital → local, confirmada con nombres reales

- **Nivel nacional**: comités/departamentos nacionales con sitio propio,
  ej. `mujer.ipuc.org.co` ("Comité Nacional de Asesoría y Apoyo de las
  Damas Dorcas") y `misionesnacionales.ipuc.org.co` (incluye Obra
  Carcelaria, con director nacional nombrado). Confirma que el patrón ya
  usado en SIGAP (nacional coordina/consolida, no opera directamente) es
  correcto.
- **Nivel distrital**: cada distrito tiene sitio propio
  (`distritoN.ipuc.org.co`) con secciones "Directivos" y "Comités y
  Oficios". **Hallazgo relevante para el futuro del software**: la
  directiva distrital real **no es una sola persona "coordinador"**, sino
  una junta de 5 cargos (confirmado en Distrito 9): **Supervisor,
  Secretario, Presbítero A, Presbítero B, Veedor**. Hoy SIGAP modela el
  nivel distrital como un solo rol (`roles_sistema.nivel = 'distrital'`)
  sin distinguir esos cargos — funciona para lo que se ha construido
  hasta ahora, pero si en el futuro se necesita, por ejemplo, que el
  "Veedor" tenga acceso de solo auditoría/lectura distinto al del
  Supervisor, o que el Secretario reciba notificaciones distintas, el
  modelo de datos tendría que ampliarse para representar esos 5 cargos
  por separado. **No se implementó nada de esto — es una nota para
  cuando el usuario decida si lo necesita.**
- Fuentes: [Distrito 9 – Comités y Oficios](https://distrito9.ipuc.org.co/comites-y-oficios/), [Distrito 9 – Directivos](https://distrito9.ipuc.org.co/directivos/), [Mujer IPUC](https://mujer.ipuc.org.co/), [Misiones Nacionales](https://misionesnacionales.ipuc.org.co/)

### 4. Comités/ministerios nacionales reales — checklist contra lo ya construido en SIGAP

Confirmado de forma consistente en varios sitios de distrito: **Damas
Dorcas, Conquistadores Pentecostales, Misión Juvenil, Evangelismo y
Misiones, Música, Artística, Escuela Dominical, Obra Social, Obra
Carcelaria, Educación Teológica**.

| Comité/ministerio real de la IPUC | ¿Existe ya en SIGAP? |
|---|---|
| Escuela Dominical | Sí (`EscuelaDominical.jsx`) |
| Damas Dorcas | Sí (`DamasDorcas.jsx`) |
| Misión Juvenil | Sí (`MisionJuvenil.jsx`) |
| Evangelismo y Misiones | Sí (`Evangelismo.jsx`, `MisionesEvangelismo.jsx`, `Amigos.jsx`) |
| Obra Carcelaria | Sí (`ObraCarcelaria.jsx`, construido en esta sesión) |
| Educación Teológica | Parcial — se registra formación/licencias del **pastor** en `PastoralDistrital.jsx`, pero no hay un módulo de educación teológica para la membresía general |
| **Conquistadores Pentecostales** | **No existe** — parece un programa distinto de Misión Juvenil (posiblemente pre-adolescentes/escuela dominical avanzada; el alcance exacto no se confirmó con las fuentes públicas disponibles) |
| **Música** | **No existe** — ministerio de alabanza/coros, mencionado como comité local recurrente (de hecho, "Músico" ya aparece implícitamente en SIGAP como uno de los cargos de comité que el usuario mencionó que exige estar sellado) |
| **Artística** | **No existe** — ministerio de artes (danza, teatro, etc., típico en iglesias pentecostales grandes) |
| **Obra Social** | **No existe como módulo propio** — distinto de Obra Carcelaria; es ayuda social/comunitaria general (podría solaparse parcialmente con Red de Familias, pero esa está enfocada en la familia del censo local, no en la comunidad externa en general) |

**No se construyó nada de esto en esta sesión** — es investigación pura,
para que el usuario decida cuáles de estos módulos faltantes vale la pena
construir a futuro, con el mismo criterio y nivel de detalle que ya se
usó para Obra Carcelaria/Escuela Dominical/Damas Dorcas.

### 5. Escalafón ministerial — ya modelado correctamente en SIGAP

`PastoralDistrital.jsx` ya tiene el escalafón real: **Obrero → Licencia
Local → Licencia General → Ordenación Ministerial**
(`LICENCIA_LABELS`/`LICENCIA_SIGUIENTE`, construido en una sesión
anterior). Esto coincide con el patrón estándar de credenciales
ministeriales de las iglesias pentecostales "del Nombre de Jesús"
(afiliadas a UPCI) — buena confirmación de que ese trabajo previo ya
estaba bien alineado, sin necesidad de cambios.

## Implicaciones concretas para SIGAP (no ejecutadas, para decidir)

1. **Aclarar en cualquier vista nacional que las cifras son de IPUC
   Colombia**, no de UPCI global — evita una confusión real que hasta el
   propio sitio institucional de IPUC puede generar.
2. **Módulos potenciales que faltan**, si el usuario decide construirlos:
   Conquistadores Pentecostales, Música, Artística, Obra Social,
   Educación Teológica (para membresía, no solo para pastores).
3. **Posible ampliación futura del nivel distrital** de un solo rol
   "coordinador" a los 5 cargos reales de junta (Supervisor, Secretario,
   Presbítero A, Presbítero B, Veedor) — solo si el usuario necesita
   diferenciar permisos/funciones entre esos cargos; hoy el modelo actual
   de un solo rol distrital sigue siendo funcional para todo lo
   construido.
4. **La fuente más confiable para el formato exacto del informe
   estadístico** (categorías exactas, periodicidad, qué reporta cada
   nivel) sigue siendo pedirlo directamente a la coordinación nacional de
   estadística de la IPUC — el usuario tiene ese contacto real, cosa que
   la investigación pública no puede reemplazar del todo.

## Fuentes consultadas

- [IPUC – Demografía](http://ipucolombia.blogspot.com/p/demografia.html)
- [IPUC Facebook oficial](https://www.facebook.com/IPUCoficial/)
- [Sitio oficial IPUC](https://ipuc.org.co/)
- [Misiones Nacionales IPUC](https://misionesnacionales.ipuc.org.co/)
- [Mujer IPUC (Damas Dorcas nacional)](https://mujer.ipuc.org.co/)
- [Distrito 9 IPUC – Comités y Oficios](https://distrito9.ipuc.org.co/comites-y-oficios/)
- [Distrito 9 IPUC – Directivos](https://distrito9.ipuc.org.co/directivos/)
- [Distrito 1 IPUC – Comités y Oficios](https://distrito1.ipuc.org.co/comites-y-oficios/)
- [Misiones Nacionales – Obra Carcelaria](https://ipucmisionesnacionales.blogspot.com/p/obra-carcelaria.html)
