# Contexto y supuestos base

## 1. Escala real de la IPUC (con un matiz importante)

Dos cifras distintas están circulando y vale la pena dejarlas claras
en vez de usar una sola sin más:

- **Investigación previa de este mismo proyecto** (2026-09-01, ver
  memoria de sesión y `docs/investigacion-metodologia-ipuc-2026-09-01.md`
  si existe): IPUC Colombia tiene aproximadamente **1.6 millones de
  creyentes, ~4.100 pastores y ~4.000 templos**.
- **Búsqueda web de hoy** (fuente con fecha 2012, desactualizada):
  "más de 1.500.000 miembros y aproximadamente 3.800 templos y
  congregaciones" -- consistente en orden de magnitud con lo anterior,
  aunque vieja.
- **Cifra del usuario hoy**: "unas 5.000 y más congregaciones".

**No hay una fuente pública reciente y confiable que confirme
exactamente cuál es la cifra correcta hoy.** Las tres apuntan al mismo
rango (4.000-5.000+), así que para el modelamiento financiero de este
documento se usa un **rango de 4.000 a 5.000 congregaciones**, y se
muestra la sensibilidad del ingreso a ese rango en cada modelo. Antes
de tomar una decisión de precio final, vale la pena pedirle a la
coordinación nacional de estadística de la IPUC el número exacto y
actualizado -- probablemente varía además por tamaño (una congregación
de 300 miembros no es comparable a una de 30).

## 2. Cómo está construido SIGAP hoy (por qué esto importa para el precio)

Este es el hecho técnico más relevante para decidir el modelo de
ingresos, y viene directo de cómo se construyó el sistema esta sesión
y las anteriores:

**SIGAP es multi-tenant sobre UNA sola base de datos compartida**
(Supabase/Postgres), no una base de datos por congregación. El
aislamiento entre congregaciones se hace con Row Level Security (RLS)
-- cada fila de cada tabla sabe a qué `congregacion_id` pertenece, y
las políticas de seguridad garantizan que cada congregación solo vea
lo suyo. La PWA de captura móvil (`siga-pwa-nacional`) se conecta al
mismo backend.

**Por qué esto importa para el precio**: el costo marginal de sumar
una congregación más NO es "una base de datos más" (que sería un costo
fijo por cliente, como en muchos SaaS mal diseñados) -- es solo más
filas y más tráfico sobre la misma infraestructura. Esto favorece
fuertemente cualquier modelo de **muchos clientes pagando poco cada
uno** (el modelo 3, suscripción por congregación), porque escalar de
500 a 5.000 congregaciones no dispara el costo de infraestructura de
forma proporcional -- dispara principalmente almacenamiento y ancho de
banda, que en Supabase son baratos comparados con el precio de
suscripción por asiento.

### Costo real de infraestructura (Supabase, investigado 2026-09-07)

| Plan | Precio | Qué cubre |
|---|---|---|
| Free | $0 | Suficiente solo para desarrollo/pruebas, no para producción con miles de usuarios reales |
| Pro | US$25/mes + consumo | Un proyecto, créditos de cómputo incluidos, consumo adicional (almacenamiento, ancho de banda, usuarios activos) se cobra aparte |
| Team | US$599/mes + consumo | Cumplimiento SOC2/ISO27001, respaldo de 14 días, soporte prioritario -- el escalón pensado para una organización con datos sensibles de miles de usuarios reales |
| Enterprise | Precio a medida | Negociado directamente con Supabase para volúmenes muy grandes |

Fuente: [Supabase Pricing 2026 (JetAdmin)](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/), [Supabase Pricing 2026 (Flexprice)](https://flexprice.io/blog/supabase-pricing-breakdown), [Supabase Pricing 2026 (MetaCTO)](https://www.metacto.com/blogs/the-true-cost-of-supabase-a-comprehensive-guide-to-pricing-integration-and-maintenance)

**Lectura práctica**: incluso en el escenario más caro (Team, US$599/mes
≈ 2.4 millones de COP/mes al cambio de referencia usado en este
documento, ~4.000 COP/USD) más algo de consumo adicional, la
infraestructura para las 5.000 congregaciones completas costaría en el
orden de **3-5 millones de COP/mes total** -- no por congregación. Con
solo **50-100 congregaciones pagando la franja más baja ($29.990
COP/mes, ver precios definitivos en [03-suscripcion-mensual-por-congregacion.md](03-suscripcion-mensual-por-congregacion.md))**
ya se cubre ese costo de infraestructura completo. Todo lo que
venga de ahí en adelante (miles de congregaciones más) es, en términos
de infraestructura, casi puro margen -- el costo real que crece con la
escala es el de soporte humano (mesa de ayuda, capacitación,
onboarding), no el de servidores.

## 3. Comparables de precio investigados (con fuentes)

### Internacionales (mercado en dólares, referencia de rango)

| Producto | Precio | Modelo |
|---|---|---|
| ChurchTrac | US$9/mes (hasta 75 miembros) a US$105/mes (ilimitado) | Por tamaño de congregación |
| Breeze ChMS | US$72/mes | Precio único, miembros y usuarios ilimitados |
| Planning Center | Gratis (funcional básico) a partir de US$14/mes por módulo | Modular, pago por módulo activado |

Fuente: [Church Pricing 2026 (ITQlick)](https://www.itqlick.com/church-management-software/pricing), búsqueda "church management software pricing per month SaaS 2026".

### El comparable más relevante: KHESED-TEK (colombiana, con sede en Barranquilla)

Esta es la comparación que más pesa porque es una empresa **colombiana
vendiendo software de gestión a iglesias en toda Latinoamérica** -- el
competidor más directo que existe para SIGAP:

| Plan | Precio (USD/mes) | Alcance |
|---|---|---|
| Semilla | US$49 | Hasta 150 miembros |
| Cosecha | US$149 | Hasta 500 miembros |
| Reino | US$299 | Hasta 1.500 miembros |
| Gloria | A medida | Megaiglesias y multi-sede |

Fuente: [KHESED-TEK Global](https://www.khesed-tek-systems.org/global), [KHESED-TEK LATAM](https://www.khesed-tek-systems.org/latam).

Convertido a pesos colombianos de referencia (~4.000 COP/USD, cifra
usada solo para tener una idea de orden de magnitud, no una tasa
oficial):

| Plan | COP/mes aproximado |
|---|---|
| Semilla | ~196.000 |
| Cosecha | ~596.000 |
| Reino | ~1.196.000 |

**Esto es entre 3 y 6 veces más caro que los precios definitivos que
decidió el usuario por franja de tamaño** ($29.990 a $199.990 COP/mes)
-- ver el análisis completo y la tabla de precios en
[03-suscripcion-mensual-por-congregacion.md](03-suscripcion-mensual-por-congregacion.md).

## 4. Referencia de poder adquisitivo local

**Salario mínimo legal mensual vigente en Colombia para 2026:
$1.750.905 COP** (con auxilio de transporte, ingreso puede llegar a
~$2.000.000). Fuente: [Salario mínimo Colombia 2026 (Alegra)](https://blog.alegra.com/colombia/salario-minimo-en-colombia-2026/).

Esto importa porque muchas congregaciones de la IPUC son pequeñas y en
zonas de bajos ingresos -- un valor de suscripción que parezca
razonable para una iglesia urbana grande puede ser una carga real para
una congregación rural pequeña. El modelo de precio por tamaño de
congregación (como ya hace KHESED-TEK) es más realista que un precio
plano único para las 5.000+.

## 5. Referencia de estándar de mantenimiento de software

La industria de software empresarial cobra típicamente **entre 15% y
25% del valor de la licencia por año** en mantenimiento/soporte (18-22%
es el rango más citado hoy; Oracle 22%, SAP 19%, IBM 20-25%). Fuente:
búsqueda "annual software maintenance fee industry standard percentage".

Esta cifra es la base de cálculo para el **modelo 2** (licencia anual +
mantenimiento) -- ver
[02-licencia-anual-mas-mantenimiento-ipuc.md](02-licencia-anual-mas-mantenimiento-ipuc.md).

## 6. Lo que el usuario debe aportar para afinar cualquiera de los tres modelos

Estos números no se pueden investigar en internet -- solo el usuario
los tiene:

- Horas/meses reales invertidos en construir SIGAP hasta hoy (para
  estimar el costo de desarrollo ya hundido, relevante para el modelo
  1).
- Costo mensual real del equipo que mantendría la plataforma en
  producción (soporte, nuevas funcionalidades, corrección de errores).
- Capacidad de cobro/recaudo -- ¿SIGAP cobraría directamente a cada
  congregación (recaudo fragmentado, con mora esperable) o la IPUC
  centralizaría el recaudo y se lo transferiría a SIGAP consolidado?
  Esto cambia mucho la viabilidad práctica del modelo 3.
