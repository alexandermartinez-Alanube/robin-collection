# `Alanube Roll Rates`

**Grano:** una fila por factura, por cada mes que estuvo abierta (hasta que cierra o se declara incobrable).

## Qué es

La matriz mensual de rodamiento: cruza `Alanube Invoice Items` con `Alanube Movements` y produce una fila por factura por cada mes que estuvo abierta. De ahí salen el saldo, los días de mora, el bucket (`Al día`, `1-30`…`>90`, `Closed`) y de dónde venía el mes anterior — el par `Estado_Mes_Anterior → Bucket Actual` **es** el rodamiento (roll rate). Todo está duplicado en moneda local y en USD.

Esta es la **tabla central** del data mart: la fuente de cartera, mora, buckets, gestión y la matriz de transición mes a mes.

## Equivalencia de columnas: glosario de negocio (español) → columna real en Metabase (inglés)

> Metabase muestra los nombres de columna **en inglés**. La columna de la izquierda es el glosario en español que usa el resto de este documento por legibilidad; para escribir SQL/consultas reales usa siempre la columna de la derecha.

| Glosario (español, este doc) | Columna real en Metabase (inglés) |
|---|---|
| `ID_Unico` | `Unique ID` |
| `Sociedad` | `Company Entity` |
| `Factura` | `Invoice Number` |
| `Fecha Emision` | `Issue Date` |
| `Fecha Vencimiento` | `Due Date` |
| `Mes emitido` | `Issued Month` |
| `Saldo Final Mes` | `Ending Balance` |
| `Pago del Mes` | `Month Payment` |
| `Saldo Inicial Mes` | `Beginning Balance` |
| `Periodo` | `Period Date` |
| `Días Mora` | `Days Past Due` |
| `Bucket Actual` | `Current Bucket` |
| `Estado_Mes_Anterior` | `Previous Month Status` |
| `NC Aplicada` | `Credit Note Applied` |
| `Retenciones` | `Withholdings` |
| `Gestión` | `Management Type` |
| `Estado Factura` | `Invoice Status` |
| `ID_sociedad` | `Company Entity Period ID` |
| `Id_Client` | `Client ID` |
| `TRM` | `Exchange Rate` |
| `Saldo Final Mes USD` | `Ending Balance Usd` |
| `Pago del Mes USD` | `Month Payment Usd` |
| `Saldo Inicial Mes USD` | `Beginning Balance Usd` |
| `NC USD` | `Credit Note Usd` |
| `Rete USD` | `Withholding Usd` |
| `Id_factura` | `Invoice ID` |
| `Ultima_Fecha_Pago` | `Last Payment Date` |
| `Motivo cerrada` | `Closed Reason` |
| `ADD_Ponderado` | `Weighted Add` |
| `Pago en?` | `Paid In` |
| `Aplican_Mora?` | `Applies Late Fee` |
| `Notificacion?` | `Notification Flag` |
| `Cliente` | `Client Name` |
| `Estado_Empresa` | `Company Status` |
| `ID_Gestion_Ambas` | `Management Both ID` |
| `ID` | `Period ID` |
| `Frecuencia` | `Frequency` |

## Diccionario de campos

| Campo | Descripción |
|---|---|
| `ID_Unico` | Llave de la fila: factura + periodo (`001141_2025-01`). Una factura tiene una fila por cada mes que estuvo abierta. |
| `Sociedad` | Sociedad Alanube que emitió la factura. |
| `Factura` | Número de la factura. |
| `Fecha Emision` | Fecha de emisión. Es el mes en que la factura entra a la matriz. |
| `Fecha Vencimiento` | Fecha de vencimiento. Contra ella se calculan los días de mora y el bucket. |
| `Mes emitido` | Mes de emisión de la factura. |
| `Saldo Final Mes` | Mientras la factura sigue `Abierta`: saldo pendiente al cierre del mes, en moneda local (`saldo inicial − NC − pago − retención`; por debajo de la tolerancia de cierre —0.01 en sociedades que facturan en USD, 1 en Colombia— se lleva a cero). **En la fila del mes en que la factura cierra, en cambio, muestra el saldo CON el que cerró (no el remanente, que sería 0)** — ver el detalle más abajo. |
| `Pago del Mes` | Pagos aplicados a la factura durante el mes, en moneda local. |
| `Saldo Inicial Mes` | Saldo con que la factura empezó el mes, es decir el saldo final del mes anterior. |
| `Periodo` | Mes del rodamiento al que corresponde la fila. Es el filtro de periodo de la matriz. |
| `Días Mora` | Días vencidos al cierre del mes. En el mes en curso se miden contra hoy; si la factura cerró, contra la fecha real de cierre (la del pago o la de la NC). |
| `Bucket Actual` | Tramo en que terminó el saldo: `Al día`, `1-30`, `31-60`, `61-90`, `>90`, `Closed` o `Incobrable`. Es el eje **destino** de la matriz de rodamiento. |
| `Estado_Mes_Anterior` | Bucket del mes anterior; en el mes de emisión dice `"Ventas de <Mes>"`. Es el eje **origen** de la matriz de rodamiento. |
| `NC Aplicada` | Notas de crédito aplicadas en el mes, en moneda local. |
| `Retenciones` | Retenciones aplicadas en el mes, en moneda local. **Verificado con datos reales: en las 506 filas con `Retenciones > 0`, todas vienen acompañadas de `Pago del Mes` en la misma fila — la retención nunca cierra una factura por sí sola** (no existe un `Motivo cerrada = 'Closed x Retención'`; el cierre siempre queda registrado como `Closed x Pago`, con `Pago del Mes + Retenciones = Saldo Inicial Mes`). |
| `Gestión` | `Interna` por defecto; pasa a `Externa` (femenino — en Invoice Items el mismo concepto es `Externo`) **desde el mes en que la factura se asigna a un agente externo, quedando así en todas las filas siguientes**. Es un valor por fila/mes (no fijo por factura): la misma factura puede tener varias filas `Interna` seguidas de varias filas `Externa`. Desde ese mes la factura deja de contar para la cartera/objetivo del equipo Interno, pero sigue con seguimiento y sigue apareciendo en la cartera total del `Periodo`. |
| `Estado Factura` | Abierta, Cerrada o Incobrable. |
| `ID_sociedad` | Llave `Sociedad_Periodo_Gestión` (`Alanube Panama_2025-01_Interna`). Sirve para cruzar la matriz con las métricas por sociedad. |
| `Id_Client` | Id numérico del cliente en Alegra. |
| `TRM` | Tasa de cambio con que se convirtió la factura a USD. Vale 1 donde se factura en USD. |
| `Saldo Final Mes USD` | `Saldo Final Mes ÷ TRM`. Para unificar en USD. |
| `Pago del Mes USD` | `Pago del Mes ÷ TRM`. Es el cobro del mes que alimenta el revenue por ítem. Para unificar en USD. |
| `Saldo Inicial Mes USD` | `Saldo Inicial Mes ÷ TRM`. Para unificar en USD. |
| `NC USD` | `NC Aplicada ÷ TRM`. Para unificar en USD. |
| `Rete USD` | `Retenciones ÷ TRM`. Para unificar en USD. |
| `Id_factura` | Id numérico de la factura en Alegra, el que se consulta contra la API. |
| `Ultima_Fecha_Pago` | Fecha del último pago recibido de la factura, sin importar el mes de la fila. |
| `Motivo cerrada` | Por qué cerró el saldo: `Closed x Pago`, `Closed x Nota Credito`, `Descuento comercial`, `Pago Parcial`, `Closed por Incobrable` o `Saldo Abierto`. |
| `ADD_Ponderado` | `Días Mora × Saldo Final Mes USD`. Solo se llena cuando la factura está vencida y abierta (`Días Mora > 0` y bucket distinto de `Closed` y `Al día`). Es el insumo del ADD ponderado por saldo (ver `Alanube Daily History`). |
| `Pago en?` | Momento del pago del mes respecto al vencimiento. Valores reales: `Tiempo` (antes de vencer), `Posterior` (después de vencer), `Limite` (justo en el vencimiento), `Anticipo` (pago adelantado), `Pago parcial` (abono que no cierra la factura). Queda vacío cuando no hubo pago en el mes. |
| `Aplican_Mora?` | Marca `Aplican` en las filas que entran al cargo de mora del 2% (vacío si no aplica). |
| `Notificacion?` | Si la factura ya recibió aviso de cobro. Valores reales: `Si` / `No` (sin acento en el dato). |
| `Cliente` | Nombre del cliente. |
| `Estado_Empresa` | Estado del cliente (activo, suspendido, retirado). |
| `ID_Gestion_Ambas` | El gemelo de `ID_sociedad` con la gestión en `"Ambas"` (`Alanube Panama_2025-01_Ambas`). Permite la vista consolidada Interna + Externa **sin doble conteo**. |
| `ID` | Llave `Sociedad_Periodo` (`Alanube Panama_2025-01`), para cruzar la fila con las métricas mensuales. |
| `Frecuencia` | Periodicidad del cargo de la factura: `Mensual`, `Anual`, `Cargos por activación` (cobro único) o `Consumo Adicional`; heredada del ítem. |

## Notas / gotchas

- **⚠️ IMPORTANTE — `Saldo Final Mes` (Ending Balance) en la fila del mes en que la factura cierra NO es el remanente (0), sino el saldo CON el que la factura llegó a cerrarse ese mes.** Es diseño intencional, no un bug: el remanente después del cierre siempre es 0 y no aporta información, así que la columna conserva en su lugar el último saldo real (el que existía justo antes de resolverse). Verificado contra las 3,101 filas con `Invoice Status = Cerrada`: en el 100% de los casos `Saldo Final Mes = Saldo Inicial Mes`, sin importar el `Motivo cerrada` (`Closed x Pago`, `Closed x Nota Credito`, `Closed por Incobrable`, `Descuento comercial`). Mientras la factura sigue `Abierta` (incluidos los `Pago Parcial`), `Saldo Final Mes` sí se calcula como el remanente real: `Saldo Inicial − Pago − NC − Retención`.
  - **Implicación práctica**: para estimar "cuánto queda pendiente" nunca sumes `Saldo Final Mes`/`Saldo Final Mes USD` sin filtrar `Estado Factura = 'Abierta'` (o excluir `Bucket Actual = 'Closed'`) primero — de lo contrario cada factura que cerró ese mes se cuenta con el saldo que tenía antes de resolverse, inflando la cartera. La fuente de verdad de "¿queda saldo pendiente?" es `Estado Factura`/`Bucket Actual`, no el valor numérico de `Saldo Final Mes`.
  - Ejemplo real (factura `API164`, Colombia): `Saldo Inicial Mes = 15,179,853`, `Pago del Mes = 14,648,558.15` + una retención de `531,294.86` en `Movements` (que sí cuadran contra el saldo inicial), `Motivo cerrada = Closed x Pago`; `Saldo Final Mes` en esa fila queda en `15,179,853` — el saldo con el que cerró, no el remanente (0).
- **No sumes `Bucket Actual` a través de distintos `Periodo`** sin filtrar — cada factura aparece una vez por mes que estuvo abierta, así que sumar sin filtrar `Periodo` duplica saldo entre meses. Para "cartera hoy", filtra `Periodo` = mes en curso (p. ej. `Periodo = '2026-09-01'` para septiembre 2026 — siempre primer día del mes).
- **`Periodo` es el filtro de "cartera del mes"**: todas las facturas con una fila en ese `Periodo` son la cartera de ese mes, tanto las que siguen abiertas como las que cerraron dentro del mismo mes.
- **Contar meses que lleva abierta una factura** = contar sus filas (`COUNT(*)` agrupado por `Factura`), ordenadas por `Periodo` desde el mes de emisión. Verificado con datos reales: una factura sigue generando una fila por mes mientras esté `Abierta`, y **deja de generar filas nuevas en el mes en que cierra o se declara incobrable** (última fila = `Invoice Status = Cerrada` / `Bucket Actual = Closed`, o `Invoice Status = Incobrable` / `Bucket Actual = Incobrable`) — verificado en las 4 facturas `Incobrable`: todas dejaron de generar filas justo en el `Periodo` en que se declararon incobrables, sin importar cuántos meses llevaban abiertas antes (entre 5 y 8 meses).
- **Facturas `Incobrable`**: las 4 facturas declaradas incobrables comparten la misma fecha de movimiento (`2025-12-31`) y el mismo monto (`150.00` USD, R.Dominicana) pero con distinta antigüedad (5 a 8 meses abiertas) — sugiere un evento de castigo/write-off por lote a cierre de año para saldos pequeños, no una declaración factura por factura a lo largo del año. `Bucket Actual`/`Estado Factura` usan el valor `Incobrable` como categoría propia, **distinta** de `Closed`/`Cerrada` — no la confundas con un cierre por pago o NC.
- **`Gestión` no es fija por factura**: puede empezar en `Interna` y pasar a `Externa` a partir de cierto `Periodo` (queda así en adelante). Desde ese mes, la factura sale de la cartera/objetivo Interno pero sigue en la cartera total del mes y con seguimiento — no la excluyas de un `Periodo` solo por estar en `Externa`, solo exclúyela cuando la pregunta sea específicamente sobre gestión Interna.
- Para la matriz de rodamiento propiamente dicha (transición de buckets), pivotea `Estado_Mes_Anterior` (filas) × `Bucket Actual` (columnas) dentro de un mismo `Periodo`.
- Para vista Interna+Externa consolidada sin doble conteo, agrupa por `ID_Gestion_Ambas`, no sumes las filas Interna y Externa por separado (podrían no ser mutuamente excluyentes en el agregado que uses).
- `ADD_Ponderado` únicamente aporta en filas vencidas y abiertas; no lo sumes indiscriminadamente para todas las filas o vas a incluir facturas `Closed`/`Al día` que no aplican.
- `Días Mora` cambia de definición según si la factura sigue abierta (vs. hoy) o ya cerró (vs. fecha real de cierre) — ten cuidado al comparar `Días Mora` de filas de meses pasados ya cerrados contra filas del mes en curso todavía abiertas.
- Solo Alanube Colombia convive con una `TRM` real (COP); Panama y Costa Rica tienen `TRM = 1` siempre (facturan en USD); R.Dominicana tiene `TRM = 1` en la gran mayoría de filas pero un histórico con `TRM ≈ 58-59` (facturas antiguas en DOP) — no asumas TRM=1 para R.Dominicana sin verificar la fila.
- **No existe un `Bucket Actual`/`Estado Factura` propio para "Anulada"** — cuando una factura termina anulada (100% acreditada por NC, `Invoice Items.Estado = 'Anulada'`), en Roll Rates se ve **idéntica** a cualquier otro cierre por nota de crédito: `Bucket Actual = Closed`, `Invoice Status = Cerrada`, `Motivo cerrada = Closed x Nota Credito`. Para saber si una factura de Roll Rates terminó anulada (y no solo cobrada/cerrada normalmente), cruza por `Factura` contra `Invoice Items.Estado`.
  - **A diferencia de Invoice Items (snapshot actual), Roll Rates sí conserva la foto histórica mes a mes**: verificado con `API37` (Colombia) — se emitió en 2025-02 y **rodó como cartera abierta normal durante 14 meses** (`1-30 → 31-60 → 61-90 → >90`, `Invoice Status = Abierta` todo ese tiempo) antes de anularse por NC completa en 2026-04. Las filas de Roll Rates de esos 14 meses siguen mostrando la factura como cartera abierta real de esos periodos — no se reescriben ni desaparecen retroactivamente cuando la factura se anula después. Por eso, para un reporte de cartera/facturación de un mes ya cerrado que necesite ser estable en el tiempo, Roll Rates (por `Periodo`) es más confiable que `Invoice Items.Estado` (que si cambia retroactivamente — ver gotcha en `alanube_invoice_items.md`).
