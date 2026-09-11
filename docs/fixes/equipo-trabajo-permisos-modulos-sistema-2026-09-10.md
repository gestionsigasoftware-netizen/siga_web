# Equipo de trabajo: formulario cortado, y 2 preguntas de permisos (2026-09-10)

El usuario compartió una captura de "Equipo de trabajo" en la
congregación real Agua Bonita: el formulario "Agregar o actualizar
acceso" se veía cortado, y preguntó si el catálogo de permisos (web y
operativos) está completo.

## 1. El formulario se veía cortado

**Causa real**: los `<label>` de "Acceso web" y "Responsabilidad
operativa" tenían `className="text-sm flex items-center gap-1"` --
ese `flex` metía el texto de la etiqueta, el badge "(opcional)", el
ícono de ayuda Y el `<select>` en una sola fila horizontal, en vez de
dejar el select en su propia línea debajo (que es lo que el `mt-1.5`
del select daba a entender que iba a pasar). El resultado: el select
quedaba apretado en el poco espacio que sobraba después del texto e
ícono, mostrando solo un carácter, y su menú desplegable salía
recortado por el borde de la ventana.

**Corregido** (`src/pages/EquipoCongregacion.jsx`): se separó el texto
de la etiqueta (con el `flex` para el ícono) del `<select>`, que ahora
es un hermano en su propia línea -- mismo patrón que ya funciona bien
en `GestionDistritos.jsx` ("Número" del distrito).

## 2. ¿Está completo el catálogo de "Acceso web"?

Los 3 perfiles (`perfiles_acceso`: `pastor`/Acceso total,
`estadisticas`/Comité de Estadísticas, `consulta`/Solo lectura) cubren
bien las categorías **generales**: feligresía, red de familias,
estadísticas genéricas, reportes, y (solo Acceso total) administración
de usuarios/configuración/auditoría. Es correcto que "Acceso total" dé
el mismo nivel que el pastor -- es literalmente el mismo perfil
(`codigo = 'pastor'`), pensado para un colaborador de máxima confianza
que hace el trabajo local completo.

**Hueco real encontrado**: los permisos de los módulos especializados
(Evangelismo, Misión Juvenil, Ruta Evangelística, Escuela Dominical,
Damas Dorcas, Obra Carcelaria, SEPRI, Música, Conquistadores, Obra
Social, Educación Artística/Teológica) NO están en `permisos_perfil` --
se conceden automáticamente solo si el rol es `pastor`
(`tiene_permiso()` los revisa por una lista fija de
`rol_local = 'pastor'`, ver `seguridad_produccion.sql` y las
redefiniciones posteriores). Ni "Comité de Estadísticas" ni "Solo
lectura" dan acceso a ninguno de esos módulos desde la web.

**En la práctica esto significa**: si el pastor quiere que alguien del
equipo actualice, por ejemplo, Escuela Dominical o Música desde el
navegador, hoy solo tiene dos opciones -- darle "Acceso total" (con lo
cual también hereda administrar usuarios, configuración y ver
auditoría, que probablemente no debería tener) o no darle nada. No
existe un perfil intermedio "puede entrar y trabajar en módulos
específicos, pero no administrar la congregación".

No se implementó un cambio todavía porque es una decisión de producto
(cuántos perfiles nuevos, si deben mapear 1 a 1 con los módulos o
agruparse) -- se deja documentado para decidir con el usuario antes de
tocar `permisos_perfil`/`tiene_permiso()`.

## 3. "Responsabilidad operativa" vacío -- ¿bug o esperado?

El usuario sospechó correctamente que podía ser porque la congregación
es nueva: `modulos` es una tabla por congregación, y un pastor
normalmente los crea a mano desde "Módulos y actividades"
(`Modulos.jsx`). **Pero investigar la causa raíz encontró algo más
grave**: 3 módulos ("Evangelismo", "Mision Juvenil", "Obra
Carcelaria") están pensados para existir SIEMPRE, en toda
congregación, sin que el pastor tenga que crearlos -- así lo hacían
`evangelismo.sql`, `mision_juvenil.sql` y
`sembrar_modulo_obra_carcelaria.sql`. El problema es que esos 3
archivos siembran el módulo con un `for congregacion in (select id
from congregaciones) loop` -- un backfill de una sola vez sobre las
congregaciones que existían en ese momento. **Ninguna congregación
creada después con `crear_congregacion_con_pastor()` (el flujo real de
alta) vuelve a pasar por ahí.**

Impacto real, no solo en "Responsabilidad operativa": `Evangelismo.jsx`
y `MisionJuvenil.jsx` buscan su módulo por nombre exacto
(`ilike nombre_modulo`), y si no existe, la pantalla queda vacía y
en silencio -- sin ningún mensaje de "módulo no configurado". Es decir,
Agua Bonita (y cualquier congregación nueva de aquí en adelante) tenía
esas 2 pantallas efectivamente rotas, no solo un selector vacío.

**Corregido** en
`supabase/catalogos/fix_congregacion_nueva_sin_modulos_sistema.sql`:
- Nueva función reutilizable `sembrar_modulos_sistema_congregacion(uuid)`
  con el mismo catálogo de módulos/tipos de actividad que ya usaban los
  3 archivos originales.
- Backfill retroactivo sobre TODAS las congregaciones reales existentes
  (incluida Agua Bonita) -- corrige el problema ya presente hoy.
- `crear_congregacion_con_pastor()` ahora llama a esa función antes de
  devolver el resultado, así que toda congregación nueva sale completa
  desde el alta.

**Pendiente de ejecutar por el usuario**: ese archivo SQL en el SQL
Editor de Supabase.

## Verificación

`npm run build` sin errores tras el cambio de frontend. El fix de
módulos es solo SQL -- se puede verificar después de ejecutarlo
entrando a Equipo de trabajo de Agua Bonita y confirmando que
"Responsabilidad operativa" ya ofrece Evangelismo, Misión Juvenil y
Obra Carcelaria.
