# `Alanube Invoice Items`

**Grano:** una fila por ítem/renglón facturado (una factura con 3 renglones = 3 filas).

## Qué es

Las facturas a nivel de renglón. Guarda quién, cuánto y de qué (`Item` = Consumo, Pago Minimo, Anualidad, OTP, Mora), con el valor `Facturado` con impuesto incluido y su desglose `Subtotal + Impuesto`, más las tres columnas netas de nota de crédito. Es la tabla que aporta la `TRM` con la que todo se convierte a USD en el resto del data mart.

Esta es la tabla de referencia para **qué se facturó y de qué tipo de cargo**, a diferencia de Roll Rates (que es la tabla de **saldo y mora**).

## Equivalencia de columnas: glosario de negocio (español) → columna real en Metabase (inglés)

> Metabase muestra los nombres de columna **en inglés**. La columna de la izquierda es el glosario en español que usa el resto de este documento por legibilidad; para escribir SQL/consultas reales usa siempre la columna de la derecha.

| Glosario (español, este doc) | Columna real en Metabase (inglés) |
|---|---|
| `ID_Item` | `Item ID` |
| `Sociedad` | `Company Entity` |
| `Empresa` | `Company Name` |
| `Factura` | `Invoice Number` |
| `Fecha Emision` | `Issue Date` |
| `Vencimiento` | `Due Date` |
| `Mes Emitido` | `Issued Month` |
| `Item` | `Item Type` |
| `Documentos` | `Documents` |
| `Frecuencia` | `Frequency` |
| `Facturado` | `Billed Amount` |
| `Gestión` | `Management Type` |
| `Id_Client` | `Client ID` |
| `Subtotal` | `Subtotal` |
| `Impuesto` | `Tax` |
| `Item Name` | `Item Name` |
| `Descripcion` | `Description` |
| `TRM` | `Exchange Rate` |
| `Moneda` | `Currency` |
| `Estado` | `Status` |
| `NC_Item` | `Credit Note Item Amount` |
| `Facurado Neto` | `Net Billed Amount` |
| `Subtotal_Neto` | `Net Subtotal` |
| `Impuesto_Neto` | `Net Tax` |

## Diccionario de campos

| Campo | Descripción |
|---|---|
| `ID_Item` | Llave del renglón: número de factura + índice del ítem (`00100001010000000001_4`). Es la llave con la que las NC por ítem cruzan contra esta hoja. **⚠️ No siempre es única** — ver gotcha más abajo. |
| `Sociedad` | Sociedad Alanube que emitió la factura: Alanube Colombia, Alanube R.Dominicana, Alanube Panama o Alanube Costa Rica. |
| `Empresa` | Razón social del cliente facturado, tal como está en Alegra. |
| `Factura` | Número de la factura emitida. En Colombia llega con prefijo `API`. |
| `Fecha Emision` | Fecha de emisión de la factura. Es el mes en que la factura entra a la matriz de rodamiento. |
| `Vencimiento` | Fecha de vencimiento de la factura. Contra ella se miden los días de mora y el bucket. |
| `Mes Emitido` | Primer día del mes de emisión. Es el filtro de periodo. |
| `Item` | Categoría del cargo facturado. Se deduce de la descripción del renglón. Valores observados: `Consumo`, `Pago Minimo`, `Mora`, `Certificación`, `Anualidad`, `OTP`, `Firma`. **Cada uno tiene lógica de negocio propia (facturación a mes vencido, cupo vs. consumo real, a qué cargos aplica la mora, etc.) — ver "Modelo de negocio: cómo factura Alanube" en `README.md` antes de sumar/comparar entre categorías.** |
| `Documentos` | Documentos electrónicos que cubre el renglón. En los planes anuales es el cupo del plan, no las emisiones del mes. |
| `Frecuencia` | Periodicidad del cargo: Mensual, Anual o Cargos por activación (cobro único). |
| `Facturado` | Valor facturado del ítem en la moneda de la factura, **impuesto incluido** (viene de `item.total` de la API de Alegra). |
| `Gestión` | Quién cobra la factura: `Interna` (equipo Collection) o `Externo` (agente externo asignado — nota: masculino aquí, en Roll Rates el mismo concepto es `Externa`). **Es un snapshot del valor vigente al momento de la extracción**, no el histórico mes a mes; para saber en qué mes exacto cambió de Interna a Externo, usa `Alanube Roll Rates.Gestión` fila por fila (o el movimiento `Externo` en `Alanube Movements`). |
| `Id_Client` | Id numérico del cliente en Alegra. Llave para agrupar por empresa sin depender del nombre. |
| `Subtotal` | Base gravable del ítem, es decir `Facturado` sin impuesto. |
| `Impuesto` | Impuesto del ítem (ITBIS, IVA o ITBMS). `Subtotal + Impuesto = Facturado`. |
| `Item Name` | Nombre del producto o servicio tal como está creado en Alegra, antes de clasificarlo en la columna `Item`. |
| `Descripcion` | Texto libre del renglón de la factura. De aquí se leen los documentos emitidos y la frecuencia. |
| `TRM` | Tasa de cambio a USD de la factura. Es el divisor de todas las columnas USD de la matriz de rodamiento. Vale 1 donde se factura en USD. |
| `Moneda` | Moneda en que se emitió la factura (COP, USD, …). |
| `Estado` | Estado de la factura. Valores reales: `Cobrada`, `Por cobrar`, `Anulada`, `Incobrable`. Las Anuladas se emitieron pero una nota de crédito las dejó en cero (en el 99% de los casos — 266 de 268 verificadas; 2 excepciones tienen `Net Billed Amount` distinto de cero pese a `Estado = Anulada`), así que **no cuentan como facturación del mes**. **⚠️ Es un snapshot del valor ACTUAL, no histórico** (igual que `Gestión` — ver gotcha más abajo): una factura puede tardar meses en anularse. |
| `NC_Item` | Nota de crédito aplicada a este ítem. Reduce lo facturado y no es un cobro. |
| `Facurado Neto` | `Facturado − NC_Item`: lo que quedó realmente facturado **después de nota de crédito** (si la factura se anuló por completo, `Facurado Neto = 0`). *(sic — así está nombrado el campo en Metabase, sin la "t")* **Ojo**: solo netea NC, no pagos ni retenciones — una factura totalmente pagada sin NC tiene `Facurado Neto = Facturado` aunque su saldo pendiente real sea 0. Para el saldo pendiente real (neto de pagos/retenciones/NC) usa `Alanube Roll Rates`, no esta columna. |
| `Subtotal_Neto` | Base gravable después de la nota de crédito. |
| `Impuesto_Neto` | Impuesto después de la nota de crédito. `Subtotal_Neto + Impuesto_Neto = Facurado Neto`. |

## Notas / gotchas

- Para "facturación real" de un periodo, usa `Facurado Neto` (o filtra `Estado != 'Anulada'` si usas `Facturado` bruto); de lo contrario duplicas el efecto de la NC o cuentas facturas anuladas.
- **`Facturado`/`Subtotal`/`Impuesto`/`Facurado Neto` (y sus columnas netas) siempre están en la moneda que diga `Moneda` en esa fila — esa es la autoridad, no `TRM`.** `TRM` es un campo de referencia que viene poblado en la fila, pero **no determina ni confirma en qué moneda está el monto** — no asumas que `TRM ≠ 1` significa que el monto está en moneda local, ni that `TRM = 1` es la única señal válida de que ya está en USD. Para convertir a USD: si `Moneda = 'USD'`, el monto **ya está en USD, úsalo tal cual** (no lo dividas por `TRM` pase lo que pase); solo divide por `TRM` cuando `Moneda` sea una moneda local (COP, DOP).
- **🔴 Prueba de que `TRM` no es confiable como señal de conversión**: 234 facturas de Alanube R.Dominicana, **todas de `Mes Emitido = 2026-09-01`**, traen `Moneda = 'USD'` pero `TRM ≈ 58-59` (el valor histórico de conversión DOP→USD) en vez de `TRM = 1`. Si hubiera dividido `Facurado Neto` entre esa `TRM` (razonando "TRM≠1, debe estar en moneda local"), habría creado una caída falsa de ~98% — comparé un cliente mes a mes (`Facturado` ~$4,285 en agosto vs ~$4,442 en septiembre, magnitud casi idéntica) y al dividir el de septiembre entre 59 quedaba en ~$75, una caída inventada que no existe en la realidad. Confía siempre en `Moneda`, ignora el valor de `TRM` para decidir si conviertes o no.
- **🔴 `Estado = 'Anulada'` es un snapshot actual, no un hecho del mes de emisión — la anulación puede tardar meses en llegar.** Verificado con datos reales, factura `API37` (Alanube Colombia): se emitió el 2025-02-13 y **rodó como cartera normal durante 14 meses** (subiendo de bucket `1-30 → 31-60 → 61-90 → >90` en Roll Rates, con `Invoice Status = Abierta` todo ese tiempo) hasta que el 2026-04-15 —**más de un año después**— una nota de crédito por el 100% del valor la anuló. En una muestra de 40 facturas `Anulada`, el tiempo entre emisión y anulación varió de 0 a 426 días (mediana: 29 días).
  - **Implicación práctica**: un reporte de "facturación bruta de febrero 2025 excluyendo Anuladas" da un resultado **distinto según cuándo lo corras**. Corrido en marzo 2025 (antes de la NC), `API37` todavía tenía `Estado = Por cobrar` y sí contaba como facturación; corrido hoy, `Estado = Anulada` y la excluye retroactivamente. Esto no es un error — es consecuencia de que `Estado`, igual que `Gestión`, refleja el valor vigente al momento de la consulta, no el histórico. Si necesitas un reporte de facturación bruta **reproducible/estable en el tiempo** para un mes ya cerrado, considera usar el saldo que muestra `Alanube Roll Rates` para ese `Periodo` específico en vez de `Invoice Items.Estado` (Roll Rates sí conserva la foto histórica mes a mes — ver el mismo ejemplo en `alanube_roll_rates.md`).
- **🔴 Cuando `ID_Item` choca entre dos renglones distintos de la misma factura, la nota de crédito se les aplica a AMBOS en vez de solo al que le correspondía** (verificado con datos reales, factura `API512`, Alanube Colombia, cliente THE CREATIVE HENRY SAS):
  - La factura tenía dos renglones reales y distintos (`Descripcion` distinta en cada uno, ambos con el mismo `Item Name` = "Cloud Computing - Alegra API"): uno de **175,000** COP (`Descripcion`: *"...Starter Reseller Pack - Diciembre"*, un cargo de diciembre que resultó erróneo/duplicado) y otro de **350,000** COP (`Descripcion`: *"...Documentos emitidos / Periodo de Facturación Dic - Ene"*, el cargo real del periodo). Por la fórmula `Factura + índice`, **ambos calcularon el mismo `ID_Item = API512_394`** — la colisión que rompe la unicidad de la llave.
  - En `Alanube Movements` la nota de crédito aparece **una sola vez, a nivel de factura**: un movimiento `Nota Credito` de `175,000` con fecha `2026-03-19` (el motivo real: *"Anulación por duplicidad de item en el cobro del mes de Diciembre"* — o sea, la NC solo debía cancelar el renglón de 175,000).
  - En `Alanube Invoice Items`, sin embargo, `Credit Note Item Amount` (`NC_Item`) aparece con **175,000 en los DOS renglones** (no solo en el que la NC realmente canceló) — todo indica que, al chocar el `ID_Item`, el proceso que reparte la NC por ítem la aplicó a ambas filas que comparten esa llave, en vez de aplicarla solo a la que le correspondía. Resultado: el renglón de 175,000 queda en `Net Billed Amount = 0` (correcto, era el que debía anularse) pero el renglón de 350,000 queda en `Net Billed Amount = 175,000` (incorrecto — a ese renglón no le tocaba ninguna NC).
  - **La verdad de la factura está en `Alanube Roll Rates`, no en sumar `Invoice Items`**: `Saldo Inicial Mes = 525,000` → tras la NC, `Saldo Final Mes = 350,000` (periodo 2026-03, `NC Aplicada = 175,000`) — es decir, el renglón de 350,000 síguió intacto y la NC solo se llevó los 175,000 del renglón duplicado, tal como debía ser. Si en cambio sumas `Net Billed Amount` de `Invoice Items` para esta factura obtienes `0 + 175,000 = 175,000`, que **no** es el saldo real (350,000).
  - **Cómo detectarlo**: agrupa por `Factura` + `ID_Item` y busca combinaciones con más de una fila — ahí `NC_Item`/`Net Billed Amount` a nivel de ítem dejan de ser confiables para esa factura.
  - **Cómo resolverlo**: para el saldo neto real de una factura tras NC, usa siempre `Alanube Roll Rates` (`Saldo Inicial Mes − NC Aplicada`, o el `Saldo Final Mes` mientras siga `Abierta`) o el monto de `Alanube Movements` filtrado por `Movimiento = 'Nota Credito'` (ahí la NC sí está correcta, una vez, a nivel de factura) — nunca sumando `NC_Item`/`Facurado Neto`/`Net Billed Amount` de `Invoice Items` cuando hay colisión de `ID_Item`. `Invoice Items` sigue siendo confiable para `Facturado`/`Subtotal` **brutos** (antes de NC) y para la categorización por `Item`.
  - En facturas sin colisión de `ID_Item` (la mayoría — verificado en varios otros ejemplos con NC parcial, cada ítem con su propio índice), `SUM(Net Billed Amount)` sí cuadra exacto contra el `Ending Balance` de Roll Rates.
- `Item` es una categoría derivada (parseada de la descripción), no un campo maestro de Alegra — trátalo como texto de negocio, no como catálogo cerrado garantizado.
- En planes `Anual`, no interpretes `Documentos` como "documentos emitidos ese mes": es el cupo total del plan.
