# Esquema `dm_collection` (Metabase)

Documentación de referencia del data mart de cobranza (Collection) de Alanube/Alegra, expuesto en Metabase en el esquema **`dm_collection`**. Estas tablas están pensadas para ser consultadas por cualquier IA vía MCP (Metabase MCP), así que esta carpeta funciona como el diccionario de datos que le da contexto de negocio a los nombres de columna.

## Tablas

| Tabla (nombre en Metabase) | Grano (una fila = …) | Doc |
|---|---|---|
| `Alanube Invoice Items` | Un ítem/renglón facturado (item de una factura) | [alanube_invoice_items.md](alanube_invoice_items.md) |
| `Alanube Movements` | Un movimiento sobre una factura (pago, NC, retención, incobrable, asignación a agente, notificación) | [alanube_movements.md](alanube_movements.md) |
| `Alanube Roll Rates` | Una factura, por cada mes que estuvo abierta (matriz de rodamiento) | [alanube_roll_rates.md](alanube_roll_rates.md) |
| `Alanube Daily History` | Una sociedad, por cada día (corte diario acumulado) | [alanube_daily_history.md](alanube_daily_history.md) |

Todas viven en el esquema `dm_collection`. Antes de escribir SQL contra una de estas tablas, lee su doc.

> **Los nombres de columna EN METABASE ESTÁN EN INGLÉS.** Los nombres en español que usa esta documentación (`Sociedad`, `Factura`, `Gestión`, `Facurado Neto`, …) son el **glosario de negocio** que le da contexto a cada campo — no son literalmente lo que verás en Metabase. La columna real, la que hay que usar en cualquier SQL/consulta contra `dm_collection`, es la del inglés (`Company Entity`, `Invoice Number`, `Management Type`, `Net Billed Amount`, …). Cada doc de tabla trae al inicio una tabla de equivalencias **glosario (español) → columna real en Metabase (inglés)** — tradúcela siempre antes de construir una query; nunca escribas el nombre en español directamente en el SQL.

## Modelo de datos y jerarquía

```
Alanube Invoice Items (línea de factura, 1 fila por ítem)
        │  Factura, Id_Client
        ▼
Alanube Roll Rates (factura × mes abierto — tabla central)  ←── Alanube Movements (evento puntual sobre la factura)
        │  Factura, Periodo
        ▼
Alanube Daily History (sociedad × día — agregado/KPI)
```

- **Invoice Items → Roll Rates**: se cruzan por `Factura`. Invoice Items no tiene columna de periodo; representa el ítem tal como se facturó (no cambia mes a mes salvo por NC). Para saber "qué compone esta factura" en cualquier fila de Roll Rates, se filtra Invoice Items por esa `Factura`.
- **Movements → Roll Rates**: se cruzan por `Factura` + el mes de `Fecha` (o directamente contra `ID_Factura_Fecha` si necesitas el mismo grano exacto). Roll Rates resume/agrega los movimientos del mes (`Pago del Mes`, `NC Aplicada`, `Retenciones`); Movements tiene el detalle evento por evento.
- **Roll Rates → Daily History**: Daily History es un agregado diario por `Sociedad`. El indicador `ADD` de Daily History es `ADD_Ponderado (Weighted Add) ÷ CxC Vencida (Overdue Ar)`, ambos ya disponibles como columnas propias de Daily History (agregados desde Roll Rates, pero no hace falta bajar ahí para calcular el ADD por sociedad). Para el ADD consolidado de las 4 sociedades, suma `Weighted Add` y `Overdue Ar` de las 4 sociedades del mismo `Fecha` antes de dividir. Para explicar por qué se movió un indicador de Daily History en un día dado, se debe bajar a Roll Rates (por `Sociedad` + `Periodo`) y de ahí a Invoice Items/Movements por factura puntual.
- Llaves compuestas útiles para joins/agrupaciones (evitan depender del nombre del cliente o de strings):
  - `Id_Client`: id numérico del cliente en Alegra. Está en Invoice Items y en Roll Rates.
  - `Id_factura`: id numérico de la factura en Alegra (consultable contra la API de Alegra). Está en Roll Rates.
  - `Factura`: número de factura (string, con prefijo `API` en Colombia). Llave de texto compartida entre Invoice Items, Movements y Roll Rates.
  - `ID_Item` (Invoice Items): `Factura + índice del ítem`, p. ej. `00100001010000000001_4`. Llave de renglón, usada para cruzar notas de crédito por ítem.
  - `ID_Unico` (Roll Rates): `Factura + Periodo`, p. ej. `001141_2025-01`. Llave de la fila de rodamiento.
  - `ID_Factura_Fecha` (Movements): `Factura + fecha del movimiento`.
  - `ID_sociedad` (Roll Rates): `Sociedad_Periodo_Gestión`, para cruzar contra métricas por sociedad respetando Interna/Externa.
  - `ID_Gestion_Ambas` (Roll Rates): igual pero con Gestión forzada a `"Ambas"` — úsala para vistas consolidadas Interna+Externa **sin doble conteo**.
  - `ID` (Roll Rates): `Sociedad_Periodo`, para métricas mensuales por sociedad sin filtrar por gestión.
  - `ID` (Daily History): `Sociedad + Fecha`.

## Modelo de negocio: cómo factura Alanube

Antes de interpretar cualquier cifra de facturación o mora, hay que entender cómo arma Alanube una factura — si no, es fácil malinterpretar `Documentos`, `Facturado` o por qué aparece un cargo de `Mora`.

- **Facturación a mes vencido**: una factura emitida en un mes dado cobra por hechos del mes **anterior**. Por ejemplo, una factura emitida en septiembre puede incluir el cargo de `Consumo` correspondiente a los documentos electrónicos que el cliente **ya emitió en agosto** — la `Descripcion` del renglón trae el periodo real cubierto (p. ej. *"...Documentos emitidos 3071 Periodo Diciembre"* en una factura con `Fecha Emision` de enero), que casi siempre es el mes anterior a `Mes Emitido`/`Fecha Emision`. No asumas que lo facturado en el mes X corresponde a actividad de ese mismo mes X.
- **Cargos que pueden convivir en una misma factura** (mismo `Factura`, distintas filas por `Item`): una factura puede traer a la vez cargos de `OTP`/`Certificación` (onboarding/certificación como emisor electrónico, normalmente cobro único), `Firma` (Firma Electrónica) y `Consumo` (documentos emitidos) — son independientes entre sí, cada uno con su propia lógica de negocio.
  - **`Consumo`** (Item Name típico: `Arrendamiento de Intangibles - API Facturación Electrónica`, o `Cloud Computing - Alegra API` en Colombia): cobro por los documentos electrónicos que la empresa **efectivamente emitió** en el periodo cubierto (mes vencido). Es el cargo recurrente principal.
  - **`Pago Minimo`**: variante del mismo producto (`Consumo`) cuando el consumo real cae por debajo del mínimo contratado — mismo `Item Name`, distinto `Item`.
  - **`Anualidad`**: plan anual prepagado. **Su `Documentos` es el cupo/límite del plan, no los documentos que el cliente emitió ese mes** — no lo interpretes como consumo real. Si el cliente emite más documentos de los que cubre el plan, esos excedentes **no se descuentan del cupo silenciosamente**: se facturan aparte, después, como un cargo adicional de `Consumo` sobre lo que se pasó del plan.
  - **`OTP` / `Certificación`**: cargos de onboarding/activación como emisor electrónico (alta inicial), normalmente `Frecuencia = Cargos por activación` (cobro único).
  - **`Firma`**: cargo de Firma Electrónica, independiente del consumo de documentos.
- **Regla de mora (recargo por atraso)**:
  - Se genera cuando el cliente **paga después de la fecha de vencimiento** de su factura.
  - El cargo es **2% + la tasa de impuesto local** sobre el valor en mora (verificado: en los renglones `Item = Mora`, `Impuesto ÷ Subtotal` reproduce exactamente la tasa de impuesto local de la sociedad — 18% en R.Dominicana, coherente con el ITBIS).
  - **Se calcula sobre la última factura del cliente** (consolida el atraso de uno o varios periodos vencidos en un solo cargo de mora dentro de esa factura — la `Descripcion` del renglón de `Mora` puede listar varios periodos, p. ej. *"Mora por periodos de noviembre, diciembre y enero"*).
  - **Solo aplica a cargos de `Consumo`** (el producto `Arrendamiento de Intangibles - API Facturación Electrónica`) — **`OTP` y `Firma` nunca generan mora**, sin importar cuánto se atrasen.
  - En `Alanube Roll Rates`, la columna `Aplican_Mora?` marca qué filas entraron a este cálculo.

## Modelo de negocio: proceso táctico de gestión de cobro (fases)

El objetivo del proceso no es "cobrar una deuda vencida" sino asegurar un ciclo de pago exitoso y recurrente, evitando que la mora se materialice — la gestión judicial es un fracaso estratégico (pérdida del cliente y de su CLV), así que el esfuerzo se concentra desproporcionadamente (>80%) en las fases preventiva y administrativa temprana. Estas fases son el contexto de negocio detrás de las notificaciones que se ven en `Alanube Movements` (`Movimiento = 'Notificacion'`, detalle por `Tipo`) y agregadas por día en `Alanube Daily History` (`Notificacion Preventiva`/`Mora`/`Suspension`).

| Fase | Ventana (días respecto al vencimiento) | Objetivo | Rastro en las tablas |
|---|---|---|---|
| **1. Preventiva** ("pre-dunning") | Día -15 a Día 0 (antes de vencer) | Facilitar el pago proactivamente: confirmar recepción de la factura y requisitos formales (día -15), recordatorio amigable (día -10), validar medios de pago — tarjeta/transferencia (día -7 a 0) | `Daily History.Notificacion Preventiva`; en `Movements`, `Tipo` tipo `Aviso Inicial`, `Aviso antes de vencimiento` |
| **2. Administrativa** (mora temprana) | Día 1 a Día 30 de mora | Recuperar el pago manteniendo relación comercial; tratar el atraso como excepción operativa, identificar y resolver disputas (aislar el monto disputado, negociar el saldo no disputado) | Empieza a alimentar `Daily History.Notificacion Mora`; en `Movements`, `Tipo` tipo `Mora Temprana`. Escalada de canal en día 1, 5, 15, 30 |
| **3. Pre-jurídica** (mora media/alta) | Desde Día 31 de mora | Carácter formal/restrictivo: cartas con redacción legal, involucramiento de Gerente de Cuenta/Director Comercial, suspensión temporal de la plataforma como palanca de presión | `Daily History.Notificacion Mora` (alertas altas) y `Notificacion Suspension`; en `Movements`, `Tipo` tipo `Alerta - Mora Alta`, `Aviso de suspensión Temporal`, `SUSPENSION`, `VENCE_HOY`. Coincide con facturas en bucket `31-60`/`61-90`/`>90` en `Roll Rates`, y puede reflejarse en `Estado_Empresa = 'Suspendido'` |
| **4. Judicial** (último recurso) | Sin ventana fija — tras análisis de incosteabilidad | Recuperación de activos: si el costo de litigio supera lo recuperable, se castiga contablemente (incobrable); si no, se transfiere a agencia externa o jurídico | Corresponde a `Movements.Movimiento = 'Externo'` (delegación a agencia externa) → `Roll Rates.Gestión = 'Externa'` desde ese mes, o a `Movements.Movimiento = 'Incobrable'` → `Roll Rates.Bucket Actual = 'Incobrable'` / `Invoice Items.Estado = 'Incobrable'` (castigo por incosteabilidad) |

**Cómo usar esto al analizar notificaciones**: si te preguntan por el volumen o la fase de gestión de una factura/cliente, cruza la fecha del movimiento (`Movements.Fecha`) contra `Vencimiento`/`Días Mora` de esa factura para ubicar en qué fase cae — un `Tipo` de `Alerta - Mora Alta` en una factura con pocos días de mora, o un `Aviso Inicial` en una factura ya con 60 días vencida, es una señal de inconsistencia en la ejecución del cronograma, no del cronograma en sí (verifica antes de reportarlo como anomalía real, ya que el catálogo de `Tipo` es texto libre/semi-libre, no una máquina de estados validada).

## Conceptos de negocio clave

- **Sociedades**: Alanube Colombia (factura en **COP**, `TRM` variable), Alanube Panama y Alanube Costa Rica (facturan en **USD**, `TRM = 1` siempre), Alanube R.Dominicana (factura mayoritariamente en **USD**, `TRM = 1`, pero tiene un histórico de facturas en DOP con `TRM ≈ 58-59`). Es decir: Colombia es la única sociedad que siempre convive con una tasa de cambio real distinta de 1; verifica `TRM` antes de asumir que todo lo que no es Colombia ya está en USD.
- **TRM / USD**: todas las columnas en USD de Roll Rates son la columna local dividida entre `TRM`. Es el mecanismo para comparar/sumar entre sociedades con distinta moneda. **🔴 En `Invoice Items`, la autoridad sobre en qué moneda está un monto es `Moneda`, no `TRM`.** `Facturado`/`Facurado Neto`/etc. ya están en la moneda que diga `Moneda` en esa fila — si `Moneda = 'USD'`, el monto ya está en USD y no se divide por `TRM` sin importar qué valor traiga; solo divide por `TRM` cuando `Moneda` sea moneda local (COP, DOP). Verificado: 234 facturas de R.Dominicana en `Mes Emitido = 2026-09-01` traen `Moneda = 'USD'` con `TRM ≈ 58-59` (el valor histórico DOP) — dividir por esa TRM (asumiendo que `TRM ≠ 1` significa moneda local) crea una caída falsa de ~98%. Detalle en `alanube_invoice_items.md`.
- **Gestión / cartera Interna vs. Externa** (el concepto más delicado del modelo):
  - `Alanube Roll Rates.Gestión` es **por fila** (factura × mes): una misma factura puede tener varios meses en `Interna` y luego pasar a `Externa` desde el mes en que se delega a la agencia de cobro externa (ese cambio queda registrado también como un movimiento `Movimiento = "Externo"` en `Alanube Movements`, en la fecha de la asignación).
  - **Desde el mes en que una factura pasa a `Externa`, deja de ser responsabilidad/objetivo de la gestión Interna** (no cuenta para el desempeño o las metas del equipo interno de Collection), **pero sigue con seguimiento** y **sigue formando parte de la cartera total del mes** (la fila sigue apareciendo en `Roll Rates` con `Periodo` = ese mes, solo que con `Gestión = Externa`).
  - En la práctica: si filtras `Roll Rates` solo por `Periodo` (sin filtrar `Gestión`), obtienes la **cartera total** del mes (Interna + Externa). Si además filtras `Gestión = 'Interna'`, obtienes la cartera bajo responsabilidad del equipo interno (excluye lo ya delegado). Usa `ID_Gestion_Ambas` para la vista consolidada sin doble conteo cuando necesites cruzar contra métricas por sociedad.
  - **Ojo con la ortografía**: en `Alanube Invoice Items` el valor es `Externo` (masculino); en `Alanube Roll Rates` es `Externa` (femenino). Además, `Invoice Items.Gestión` es un **snapshot actual** (el valor vigente al momento de la extracción), no el histórico mes a mes — para saber en qué mes exacto pasó de Interna a Externa, la fuente de verdad es `Roll Rates.Gestión` fila por fila (o el movimiento `Externo` en `Movements`).
- **Estado (Invoice Items)** — valores reales observados: `Cobrada`, `Por cobrar`, `Anulada`, `Incobrable`. Las **Anuladas no cuentan como facturación** del mes (se emitieron pero una NC las dejó en cero, en el 99% de los casos verificados) — hay que excluirlas al sumar facturación bruta si se quiere la cifra "real". Este `Estado` es el snapshot actual de la factura (equivalente a nivel factura de lo que en Roll Rates es `Estado Factura`/`Bucket Actual` mes a mes) — **igual que `Gestión`, no es histórico**: una factura puede tardar meses en anularse (verificado, factura `API37`: 14 meses rodando como cartera abierta normal antes de anularse por NC completa), así que un reporte de facturación de un mes cerrado "excluyendo Anuladas" puede dar cifras distintas según cuándo se corra. Para una cifra de un periodo cerrado que no cambie con el tiempo, usa `Alanube Roll Rates` por `Periodo` en vez de `Invoice Items.Estado`.
- **Bucket Actual / Estado_Mes_Anterior (Roll Rates)**: son el eje destino/origen de la matriz de rodamiento (roll rate). Buckets: `Al día`, `1-30`, `31-60`, `61-90`, `>90`, `Closed`, `Incobrable`. En el mes de emisión, `Estado_Mes_Anterior` es `"Ventas de <Mes>"` (no viene de un bucket real anterior).
- **Dos vistas complementarias del "monto final" de una factura, ninguna es 0 por sí sola en Roll Rates**: `Alanube Roll Rates` muestra el ciclo de vida completo de la factura (emisión → cierre, ya sea por pago, NC total o incobrable) y su `Saldo Final Mes` en la fila de cierre **nunca es 0** — siempre queda con el saldo CON el que se cerró (ver el gotcha de abajo). `Alanube Invoice Items`, en cambio, sí puede mostrar `0` en `Facurado Neto` cuando la factura se anuló completamente por NC — esa columna representa el monto final de la factura **después de NC** (no de pagos ni retenciones). En resumen: para "¿con cuánto se resolvió esta factura y por qué medio?" usa Roll Rates; para "¿cuánto quedó facturado tras la nota de crédito?" usa `Invoice Items.Facurado Neto`.
- **⚠️ En la fila del mes en que la factura cierra, `Saldo Final Mes` NO es el remanente (que sería 0) sino el saldo CON el que cerró** — es decir, el monto que quedaba pendiente y que ese mes se resolvió (por pago, NC o incobrable). Es un diseño intencional, no un bug: como el remanente tras el cierre siempre es 0 (no aporta información), la columna guarda en su lugar el último saldo real de la factura antes de resolverse. Verificado con datos reales: en las 3,101 filas `Cerrada` revisadas, `Saldo Final Mes = Saldo Inicial Mes` el 100% de las veces. **Implicación práctica sin cambios**: para "cuánto queda pendiente hoy" sigue siendo obligatorio filtrar `Estado Factura = 'Abierta'` (o excluir `Bucket Actual = 'Closed'`) antes de sumar `Saldo Final Mes` — de lo contrario cuentas como pendiente el saldo de facturas que ya se resolvieron ese mes. Ver el detalle en `alanube_roll_rates.md`.
- **Periodo (Roll Rates) = mes de la cartera**: para "la cartera de septiembre 2026" filtra `Periodo = '2026-09-01'` (siempre primer día del mes). Todas las facturas que tengan una fila con ese `Periodo` son la cartera de ese mes — incluidas las que cerraron dentro del mismo mes (su fila de ese `Periodo` queda con `Bucket Actual = Closed`).
- **Cuántos meses lleva abierta una factura**: cuenta las filas de `Roll Rates` para esa `Factura` (una por cada `Periodo` en que estuvo en la matriz, empezando por el mes de emisión). Mientras sigue abierta, cada fila tiene `Invoice Status = Abierta`; en el mes que cierra aparece una última fila con `Invoice Status = Cerrada` / `Bucket Actual = Closed` (o `Invoice Status = Incobrable` / `Bucket Actual = Incobrable` si se declaró incobrable) y **no se generan más filas después** de esa.
- **Tolerancia de cierre**: saldo por debajo de 0.01 (sociedades que facturan en USD) o 1 (Colombia, en COP) se lleva a cero al calcular `Saldo Final Mes`.
### Las 3 métricas principales (DSO, CEI, ADD)

No son intercambiables: cada una aísla un fenómeno distinto, y hay que leerlas juntas para saber si "vamos bien" — una sola puede ocultar el problema que muestra otra.

- **DSO (Days Sales Outstanding) — Días Venta en Calle**: el termómetro de la **velocidad** del ciclo de efectivo. Mide cuántos días en promedio tarda la empresa en convertir una venta a crédito en efectivo. Un DSO bajo y estable = cobranza eficiente y flujo de caja saludable; un DSO que sube es la primera señal de que el ciclo se está alargando. Solo mira lo facturado **en el mes en curso** (no carga la mora heredada de meses anteriores — para eso está el CEI General).
  - Fórmula (verificada exactamente contra el valor ya calculado en `Daily History`): `CxC Cierre Mes Actual ÷ (Venta Acumulada − NC Acumulada del Mes Actual) × días del mes de Fecha`.
- **CEI (Collection Effectiveness Index) — Índice de Efectividad de Cobranza**: a diferencia del DSO (que las fluctuaciones estacionales de ventas pueden distorsionar), el CEI es un indicador **puro de la competencia operativa** del equipo de cobranza — mide qué tanto de lo que *podía* cobrarse en el periodo realmente se cobró. Es la relación entre lo **Recaudado** y lo **Recaudable**:
  - `Saldo Final Total CxC` = toda la cartera al cierre del mes (vencida + no vencida) = `CxC Cierre Diario`.
  - `Saldo Final Corriente CxC` = la parte de esa cartera que al cierre del mes aún no ha vencido (sigue dentro del plazo) = `CxC Corriente`.
  - `Universo Cobrable (Recaudable)` = `Saldo Inicial CxC + Ventas a Crédito del Mes − Saldo Final Corriente CxC` — todo el dinero que teóricamente pudo haberse cobrado en el periodo (después de restarle la NC acumulada, que nunca fue dinero real a cobrar).
  - Fórmula completa (verificada exactamente contra el valor ya calculado en `Daily History`): `((Venta Acumulada + Saldo Inicial CxC − NC Acumulada Total) − CxC Cierre Diario) ÷ ((Venta Acumulada + Saldo Inicial CxC − NC Acumulada Total) − CxC Corriente)`. A media de mes es parcial: **no se compara contra la meta de 90% hasta que el mes cierra**. Existe también `CEI_Mes_Corriente`, la misma fórmula pero aislando solo lo facturado en el mes en curso (sin la mora heredada).
- **ADD (Average Days Delinquent) — Promedio de Días de Mora**: aísla el "ruido" de las facturas al día y se enfoca solo en la deuda **ya vencida**. Mide el atraso promedio, ponderado por saldo, de las facturas que ya incumplieron su fecha de pago — es el indicador más fiel del riesgo y la calidad de la cartera morosa. El objetivo es mantenerlo lo más bajo posible (tendencia a cero); si sube, es alerta temprana de que la mora se está volviendo más vieja y más propensa a terminar en `Incobrable` (write-off).
  - Fórmula (por sociedad, ya calculada en `Daily History.ADD`): `ADD_Ponderado (Weighted Add) ÷ CxC Vencida (Overdue Ar)`, ambos de la misma fila sociedad+día. `ADD_Ponderado` es `Días Mora × Saldo Final Mes USD`; en `Roll Rates` solo existe fila a fila cuando la factura está vencida y abierta (`Días Mora > 0` y bucket ≠ `Closed`/`Al día`), pero en `Daily History` ya viene agregado a nivel de sociedad+día, así que no hace falta bajar a `Roll Rates` para obtenerlo.
  - **ADD consolidado (las 4 sociedades)**: no promedies el `ADD` de las 4 sociedades directamente (un promedio simple distorsiona por tamaño de cartera). Usa el método ponderado: `ADD general = Σ Weighted Add (4 sociedades) ÷ Σ Overdue Ar (4 sociedades)`, sumando ambas columnas del mismo `Fecha` a través de sociedades antes de dividir — mismo mecanismo que el CEI general (se agregan los componentes y se aplica la fórmula una sola vez sobre el total).
- **Frecuencia**: `Mensual`, `Anual`, `Cargos por activación` (cobro único) o `Consumo Adicional`. En los planes anuales, `Documentos` es el cupo del plan completo, no las emisiones del mes.
- **Motivo cerrada**: por qué se cerró el saldo de una factura — `Closed x Pago`, `Closed x Nota Credito`, `Descuento comercial`, `Pago Parcial`, `Closed por Incobrable`, `Saldo Abierto` (aún no cierra).
- **Pago en? (Roll Rates)** — valores reales: `Tiempo` (antes de vencer), `Posterior` (después de vencer), `Limite` (justo en el vencimiento), `Anticipo` (pagada antes de tiempo/por adelantado), `Pago parcial` (abono que no cierra la factura). Vacío cuando no hubo pago en el mes.
- **Aplican_Mora?**: `Aplican` (o vacío) — marca qué filas entran al cargo de mora del 2%.
- **Notificacion? (Roll Rates)**: `Sí` / `No` (sin acento en el dato: `Si`/`No`).
- **Notificaciones**: se registran tanto en Movements (evento puntual: tipo de notificación enviada, catálogo abierto de textos como `Aviso Inicial`, `Mora Temprana`, `Alerta - Mora Alta`, `Aviso de suspensión Temporal`, etc.) como agregadas por día en Daily History (`Notificacion Preventiva/Mora/Suspension`, conteo **diario**, hay que sumarlo para ventanas semanales/mensuales).
- **Estado_Empresa / Company Status**: vacío = activo (es el valor por defecto, no hay un literal "Activo"), o `Suspendido` / `Retirado`.

## Cómo consultar estas tablas (vía MCP)

1. Estas tablas se consultan con las herramientas del **Metabase MCP** (`search`, `execute_sql`, `construct_query`, `construct_native_query`, `execute_query`/`execute_question`). Los IDs de base de datos/tabla en Metabase no están fijados aquí porque pueden cambiar — usa `search` (o `read_resource`) para localizar la tabla exacta por nombre (`Alanube Invoice Items`, etc.) dentro del esquema `dm_collection` antes de construir la query.
2. Si escribes SQL nativo, referencia la tabla calificada por esquema, p. ej. `dm_collection."Alanube Roll Rates"` (ajusta comillas/backticks al motor real que reporte Metabase), **y usa los nombres de columna en inglés** (`Invoice Number`, `Period Date`, `Management Type`, …) tomándolos de la tabla de equivalencias de cada doc — los nombres en español de este README son solo el glosario de negocio.
3. Reglas por defecto al agregar (nombrados aquí en español por legibilidad — tradúcelos a la columna real en inglés antes de escribir la query, con la tabla de equivalencias de cada doc):
   - Facturación bruta de un periodo → `Alanube Invoice Items` filtrado por `Mes Emitido`, excluyendo `Estado = 'Anulada'`.
   - Cartera / mora / bucket de un mes → `Alanube Roll Rates` filtrado por `Periodo` (mes del corte que te interese, normalmente el mes en curso para "hoy" — p. ej. `Periodo = '2026-09-01'` para septiembre 2026). Sin filtrar `Gestión` obtienes cartera total (Interna+Externa); con `Gestión = 'Interna'` obtienes solo la cartera bajo responsabilidad interna.
   - Cobro/recaudo de un mes → `Alanube Roll Rates.Pago del Mes` (o `Pago del Mes USD`) agregado por `Periodo`, o `Alanube Daily History.Cobro Acumulado del Periodo` en el último corte disponible del mes.
   - Comparaciones entre sociedades o series temporales de indicadores (CEI/ADD/DSO) → `Alanube Daily History`.
   - Detalle evento por evento de un movimiento puntual (para explicar un salto en el saldo de una factura) → `Alanube Movements`.
   - Vista Interna+Externa sin duplicar factura → agrupa por `ID_Gestion_Ambas` en vez de sumar Interna + Externa por separado.

## "¿Qué pagos/movimientos tiene la factura X?" — playbook de historial de una factura

Esta es la pregunta más común a nivel de una factura puntual. Requiere las tres tablas:

1. **`Alanube Movements`** filtrado por `Factura = X` → el detalle evento por evento: fechas y tipo de cada movimiento (`Payment`, `Nota Credito`, `Retencion`, `Externo` = asignación a agencia externa, `Incobrable`, `Notificacion`).
2. **`Alanube Invoice Items`** filtrado por `Factura = X` → el estado actual/snapshot de la factura vía `Estado` (`Cobrada`, `Por cobrar`, `Anulada`, `Incobrable`) y su composición por ítem (`Facturado`, `NC_Item`, `Facurado Neto`).
3. **`Alanube Roll Rates`** filtrado por `Factura = X`, ordenado por `Periodo` → el historial mes a mes: cuántas filas tiene = cuántos meses lleva en la matriz (abierta o hasta que cerró); la última fila da el bucket/estado más reciente; si en algún punto `Gestión` cambia de `Interna` a `Externa`, ese es el mes en que se delegó a la agencia externa.
