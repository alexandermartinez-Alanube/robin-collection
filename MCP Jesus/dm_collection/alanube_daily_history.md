# `Alanube Daily History`

**Grano:** una fila por sociedad, por cada día (corte diario acumulado a través de los meses).

## Qué es

El corte diario por sociedad, acumulado a través de los meses: una fila por sociedad por día. Las columnas van en pares flujo/acumulado (`Venta del mes` vs `Venta Acumulada`, `Cobros del Periodo` vs `Cobro Acumulado del Periodo`), y cierra con los indicadores ya calculados: `CEI_General`, `CEI_Mes_Corriente`, `ADD` y `DSO`. El flag `Mes_Actual?` es el que gobierna el proceso: `1` = mes actual.

Esta es la tabla para **tendencias, comparación entre sociedades y los KPIs ya calculados** (CEI/ADD/DSO). Para explicar por qué se movió un número de un día a otro, hay que bajar a `Alanube Roll Rates` (por `Sociedad` + `Periodo`) y de ahí a factura puntual.

## Equivalencia de columnas: glosario de negocio (español) → columna real en Metabase (inglés)

> Metabase muestra los nombres de columna **en inglés**. La columna de la izquierda es el glosario en español que usa el resto de este documento por legibilidad; para escribir SQL/consultas reales usa siempre la columna de la derecha.

| Glosario (español, este doc) | Columna real en Metabase (inglés) |
|---|---|
| `ID` | `ID` |
| `Sociedad` | `Company Entity` |
| `Fecha` | `Metric Date` |
| `Venta del mes` | `Month Sales` |
| `Venta Acumulada` | `Cumulative Sales` |
| `Saldo Inicial CxC` | `Beginning Ar Balance` |
| `Cartera Heredada Pendiente` | `Inherited Pending Portfolio` |
| `Notas Credito Totales` | `Total Credit Notes` |
| `Notas Credito del Mes` | `Month Credit Notes` |
| `NC Acumulada del Mes Actual` | `Current Month Cumulative Cn` |
| `NC Acumulada Total` | `Total Cumulative Cn` |
| `Cobros por Anticipos` | `Advance Collections` |
| `Cobros del Periodo` | `Period Collections` |
| `Cobro Acumulado del Periodo` | `Cumulative Period Collections` |
| `Facturas Totales` | `Total Invoices` |
| `Facturas Cerradas` | `Closed Invoices` |
| `Facturas Cerradas Acumuladas` | `Cumulative Closed Invoices` |
| `Facturas Abiertas` | `Open Invoices` |
| `Facturas Abiertas Vencidas` | `Open Overdue Invoices` |
| `Facturas Cerradas por NC` | `Closed By Credit Note` |
| `Facturas Cerradas por Pago` | `Closed By Payment` |
| `CxC Cierre Diario` | `Daily Closing Ar` |
| `CxC Vencida` | `Overdue Ar` |
| `CxC Corriente` | `Current Ar` |
| `CxC Corriente Mes Actual` | `Current Month Ar` |
| `CxC Cierre Mes Actual` | `Current Month Closing Ar` |
| `Notificacion Preventiva` | `Preventive Notification` |
| `Notificacion Mora` | `Late Notification` |
| `Notificacion Suspension` | `Suspension Notification` |
| `CEI_General` | `Cei General` |
| `ADD_Ponderado` | `Weighted Add` |
| `ADD` | `Add Metric` |
| `DSO` | `Dso` |
| `CEI_Mes_Corriente` | `Current Month Cei` |
| `Mes_Actual?` | `Is Current Month` |

## Diccionario de campos

| Campo | Descripción |
|---|---|
| `ID` | Sociedad + fecha del corte (`Alanube Panama_2026-04-01`). Llave de la fila diaria. |
| `Sociedad` | Sociedad Alanube del corte. Hay una fila por sociedad y por día. |
| `Fecha` | Día del corte al que corresponden todas las cifras de la fila. |
| `Venta del mes` | Facturación emitida ese día. Es **flujo diario**, no acumulado. |
| `Venta Acumulada` | Facturación del mes acumulada hasta el día del corte. Es el término "ventas del periodo" de la fórmula del CEI. |
| `Saldo Inicial CxC` | Cartera abierta al cerrar el mes anterior. Es constante durante todo el mes y es el "saldo inicial" de la fórmula del CEI. |
| `Cartera Heredada Pendiente` | Cuánto de ese `Saldo Inicial CxC` sigue abierto al día del corte. Baja a medida que se cobra la mora heredada. |
| `Notas Credito Totales` | Notas de crédito aplicadas ese día, de cualquier periodo de emisión. Flujo diario. |
| `Notas Credito del Mes` | Notas de crédito aplicadas ese día sobre facturas emitidas en el mes en curso. Flujo diario. |
| `NC Acumulada del Mes Actual` | Notas de crédito del mes en curso acumuladas hasta el día del corte. |
| `NC Acumulada Total` | Todas las notas de crédito del mes acumuladas hasta el corte, incluidas las que caen sobre facturas de periodos anteriores. |
| `Cobros por Anticipos` | Cobros del día que se aplicaron desde anticipos ya recibidos. Son caja de meses anteriores, así que se leen aparte del cobro del periodo. |
| `Cobros del Periodo` | Cobrado ese día. Es flujo diario, no acumulado. |
| `Cobro Acumulado del Periodo` | Cobrado del mes acumulado hasta el día del corte. Es la cifra de recaudo del update semanal. |
| `Facturas Totales` | Facturas en cartera ese día: las que cerraron en el día más las que quedaron abiertas. |
| `Facturas Cerradas` | Facturas que cerraron ese día. Flujo diario. |
| `Facturas Cerradas Acumuladas` | Facturas cerradas en el mes hasta el día del corte. |
| `Facturas Abiertas` | Facturas con saldo pendiente al cierre del día. |
| `Facturas Abiertas Vencidas` | De las abiertas, cuántas ya pasaron su fecha de vencimiento. |
| `Facturas Cerradas por NC` | De las cerradas del día, cuántas cerraron por nota de crédito y no por cobro. |
| `Facturas Cerradas por Pago` | De las cerradas del día, cuántas cerraron por pago recibido. |
| `CxC Cierre Diario` | Cartera total a cobrar al cierre del día: ventas del mes en curso + saldo heredado de meses anteriores. Es el "saldo final total" de la fórmula del CEI y la cifra de cartera abierta. **`CxC Cierre Diario = CxC Vencida + CxC Corriente` siempre** (verificado sin excepciones). |
| `CxC Vencida` | Parte de `CxC Cierre Diario` que ya venció. Es lo único que separa al CEI del 100%: `CxC Vencida ÷ denominador = 100% − CEI`. |
| `CxC Corriente` | Parte de `CxC Cierre Diario` que todavía no vence. Es el "saldo final corriente" que se resta en el denominador del CEI, así que mientras una factura no vence no penaliza el indicador. |
| `CxC Corriente Mes Actual` | `CxC Corriente` contando solo facturas emitidas en el mes en curso; excluye la cartera heredada. |
| `CxC Cierre Mes Actual` | `CxC Cierre Diario` contando solo facturas emitidas en el mes en curso; excluye la cartera heredada. |
| `Notificacion Preventiva` | Avisos preventivos enviados ese día, antes del vencimiento. Es conteo **diario**, no acumulado: para una ventana semanal hay que sumarlo. |
| `Notificacion Mora` | Avisos de mora enviados ese día. Conteo diario, no acumulado. |
| `Notificacion Suspension` | Avisos de suspensión enviados ese día. Conteo diario, no acumulado. |
| `CEI_General` | CEI (Collection Effectiveness Index) del mes hasta el corte, sobre toda la cartera: `((Venta Acumulada + Saldo Inicial CxC − NC Acumulada Total) − CxC Cierre Diario) ÷ ((Venta Acumulada + Saldo Inicial CxC − NC Acumulada Total) − CxC Corriente)`. **Verificado exactamente contra el valor ya calculado en la columna (diff promedio 0.002, máx 0.005 — solo ruido de redondeo).** **Ya viene en escala 0-100 (puntos porcentuales), no como fracción 0-1.** No lo multipliques por 100 de nuevo. A media de mes es parcial y no se compara contra el objetivo de 90%. |
| `ADD_Ponderado` | Resultado de multiplicar el Saldo Final del Mes (USD) por los Días de Mora de cada registro. Representa la exposición de la cartera al atraso y es la base para calcular `ADD`. Viene ya agregado a nivel de sociedad+día en esta tabla (no hace falta bajar a `Roll Rates` para obtenerlo). |
| `ADD` | Average Days Delinquent: días promedio de atraso de la cartera vencida, ponderados por saldo (`ADD_Ponderado ÷ CxC Vencida`, ambos de esta misma fila). Es el ADD **por sociedad**, no el consolidado — ver el gotcha de abajo para el ADD general de las 4 sociedades. |
| `DSO` | Days Sales Outstanding: `CxC Cierre Mes Actual ÷ (Venta Acumulada − NC Acumulada del Mes Actual) × días del mes de Fecha`. **Verificado exactamente contra el valor ya calculado en la columna** (diff promedio 0.002, máx 0.005 — solo ruido de redondeo). Días promedio que tarda en cobrarse la cartera del periodo — usa `CxC Cierre Mes Actual`/`NC Acumulada del Mes Actual`, así que solo mide lo facturado en el mes en curso (no la mora heredada, a diferencia del CEI General que sí la incluye). |
| `CEI_Mes_Corriente` | El mismo CEI pero solo con lo facturado en el mes en curso, usando `CxC Cierre Mes Actual` y `CxC Corriente Mes Actual`. Misma escala 0-100 que `CEI_General`. Aísla la gestión del mes de la mora heredada; cuando todo lo del mes sigue corriente da 100%. |
| `Mes_Actual?` | Vale 1 si la fila pertenece al mes actual. |

## Notas / gotchas

- **🔴 Verificar duplicados por `ID` antes de confiar en una fila o de sumar.** **Todo agosto 2026** (31 días × 4 sociedades = 124 `ID`) aparece repetido **13 veces cada uno** (1,612 de las 2,220 filas totales) — julio y septiembre 2026, en cambio, aparecen una sola vez por `ID`, así que no es un patrón permanente de la tabla, sino algo puntual de ese mes.
  - Para Costa Rica, R.Dominicana y Colombia, las 13 copias de cada día de agosto son **idénticas en todas las columnas** — no distorsionan una lectura puntual (un `SELECT` de un día da el valor correcto sin importar cuál copia tome), pero **sí inflarían por 13x cualquier `SUM()`** hecho sobre agosto sin deduplicar (p. ej. sumar `Cobros del Periodo` día por día en vez de usar directamente `Cobro Acumulado del Periodo`).
  - Para **Alanube Panama** es más grave: en 27 de sus 31 días de agosto, las 13 filas **no son copias idénticas — traen dos versiones con valores distintos** (p. ej. `Alanube Panama_2026-08-31`: 8 filas dicen `Total Invoices = 6` / `Cei General = 79.90%`, las otras 5 dicen `Total Invoices = 7` / `Cei General = 78.31%`). Son dos snapshots en conflicto bajo la misma llave `Sociedad + Fecha`, probablemente de un recálculo del mes que no depuró la versión anterior — no hay forma de saber cuál es "la correcta" solo con esta tabla (no trae columna de fecha de carga/versión).
  - **Qué hacer**: antes de reportar una cifra de un `Periodo` que incluya agosto 2026 (o de sumar sobre un rango de fechas), correr `GROUP BY ID HAVING COUNT(*) > 1` — si hay más de una combinación de valores distintos para el mismo `ID`, no asumir cuál usar; validarlo contra Metabase en vivo o con quien mantiene el pipeline antes de reportarlo.
- **Chequeo de integridad útil**: `CxC Vencida + CxC Corriente` debe cuadrar exactamente con `CxC Cierre Diario` en cualquier fila — si no cuadra, algo está mal con esa fila (no asumas que es solo redondeo).
- Las columnas "acumuladas" ya son la cifra al corte — **no las vuelvas a sumar día a día** dentro del mismo mes (eso duplicaría). Para flujo, usa las columnas "del mes"/"del día"; para el total del mes a una fecha dada, toma directamente la columna acumulada de ese día.
- `Notificacion Preventiva/Mora/Suspension` son conteos diarios, no acumulados — sí hay que sumarlos si quieres una ventana (semana, mes).
- `CEI_General` a media de mes no es comparable contra la meta de 90% (solo tiene sentido al cierre del mes); úsalo con cuidado en reportes intra-mes o acompáñalo de esa aclaración.
- Filtra `Mes_Actual? = 1` cuando quieras "el mes en curso"; no asumas que la fila más reciente siempre pertenece al mes actual sin chequear el flag.
- Para entender un salto puntual en `CxC Vencida` o `CEI_General` de un día a otro, ve a `Alanube Roll Rates` filtrado por esa `Sociedad` y el `Periodo` correspondiente, e identifica qué facturas cambiaron de bucket.
- **ADD consolidado (las 4 sociedades juntas)**: la columna `ADD` de esta tabla viene calculada **por sociedad**, así que nunca la promedies directo entre sociedades (un promedio simple de 4 ADD distorsiona por el tamaño de cartera de cada una). Para el ADD general, usa el método ponderado (pooled) sobre las columnas ya disponibles en esta misma tabla: `ADD general = Σ Weighted Add (ADD_Ponderado) de las 4 sociedades ÷ Σ Overdue Ar (CxC Vencida) de las 4 sociedades`, sumando ambas columnas del mismo `Fecha` (mismo día) a través de las sociedades antes de dividir. Mismo mecanismo que el CEI general: se agregan los componentes y se aplica la fórmula una sola vez sobre el total, no se promedian los indicadores ya calculados.
