# Implementación inicial: Misiones y Evangelismo

Fecha: 28 de agosto de 2026
Estado: primera fase de navegación implementada

## Decisión aplicada

Se creó una entrada visible de Sidebar llamada **Misiones y Evangelismo**. El nombre técnico y las rutas existentes se conservan para evitar romper enlaces, permisos, consultas y la integración futura con la PWA.

Las rutas directas existentes siguen funcionando:

- `/evangelismo`
- `/amigos`
- `/mision-juvenil`

La nueva entrada `/misiones-evangelismo` funciona como puerta de entrada y enlaza los submódulos actuales.

## Submódulos conectados

- **Métodos y territorio:** pantalla Evangelismo para zonas, metodologías y análisis territorial.
- **Uno Más y BIS:** pantalla Amigos en ruta para personas alcanzadas, bienvenida e integración inicial.
- **REFAM:** enlazado actualmente a Evangelismo como estrategia de Reunión Familiar y de Amistad.
- **REFAM juvenil y discipulado:** enlazado a Misión Juvenil, donde REFAM puede aplicarse al trabajo evangelístico juvenil.

## Límites preservados

- REFAM significa Reunión Familiar y de Amistad.
- REFAM puede pertenecer a Misiones/Evangelismo y también desarrollarse en Misión Juvenil.
- REFAM no es Red de Familias.
- Red de Familias continúa como módulo administrativo familiar independiente.
- Feligresía no se mezcla con esta agrupación; recibe personas bautizadas bajo su propio censo.

## No se considera terminado todavía

Esta fase no crea todavía procesos operativos independientes para Métodos, Uno Más, BIS, REFAM, ESFOB/EFOB o Discipulado. Tampoco cambia el nombre técnico de la tabla/módulo `Evangelismo` ni modifica el contrato de `registros_actividad`.

## Siguiente fase

Definir con criterios institucionales los datos, responsables, actividades, resultados, permisos e historial de cada estación antes de convertir los enlaces actuales en submódulos operativos completos.

## Validación

- Diagnósticos de `App.jsx`, `Sidebar.jsx` y `MisionesEvangelismo.jsx`: sin errores.
- Falta ejecutar la validación final de build después de esta fase.
