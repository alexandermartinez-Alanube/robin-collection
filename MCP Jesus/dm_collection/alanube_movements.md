# `Alanube Movements`

**Grano:** una fila por movimiento sobre una factura (evento puntual, con fecha y monto).

## Qué es

El libro de eventos que mueve el saldo de cada factura: pagos, notas de crédito, retenciones, incobrables y asignaciones a agente externo, más las notificaciones que se emiten a la factura. Una fila por movimiento, con su fecha y monto en moneda local.

Esta es la tabla para **explicar, evento por evento, por qué cambió el saldo o el estado** de una factura puntual (el detalle que hay detrás de las columnas agregadas `Pago del Mes`, `NC Aplicada`, `Retenciones` de Roll Rates).

## Equivalencia de columnas: glosario de negocio (español) → columna real en Metabase (inglés)

> Metabase muestra los nombres de columna **en inglés**. La columna de la izquierda es el glosario en español que usa el resto de este documento por legibilidad; para escribir SQL/consultas reales usa siempre la columna de la derecha.

| Glosario (español, este doc) | Columna real en Metabase (inglés) |
|---|---|
| `Movimiento` | `Movement Type` |
| `Sociedad` | `Company Entity` |
| `Factura` | `Invoice Number` |
| `Fecha` | `Movement Date` |
| `Monto` | `Amount` |
| `Tipo` | `Type` |
| `ID` | `Movement ID` |
| `ID_Factura_Fecha` | `Invoice Date ID` |

## Diccionario de campos

| Campo | Descripción |
|---|---|
| `Movimiento` | Tipo de movimiento que afecta el saldo/estado de la factura. Valores reales: `Payment` (pago), `Nota Credito`, `Retencion`, `Incobrable`, `Externo` (asignación de la factura a la agencia de cobro externa — el disparador de por qué `Gestión` pasa a `Externa` en Roll Rates desde ese mes), `Interna` (reasignación de vuelta a gestión interna, poco frecuente) y `Notificacion` (aviso enviado, no mueve saldo). |
| `Sociedad` | Sociedad Alanube que emitió la factura: Alanube Colombia, Alanube R.Dominicana, Alanube Panama o Alanube Costa Rica. |
| `Factura` | Factura sobre la que cae el movimiento. |
| `Fecha` | Fecha del movimiento. |
| `Monto` | Monto del movimiento en moneda local, **a nivel de factura completa** (no por ítem/renglón), aunque la factura tenga varios ítems — cada documento (pago, NC, retención) genera una sola fila con su monto total. Pagos, notas de crédito y retenciones se restan del saldo de la factura. |
| `Tipo` | Detalle del movimiento — catálogo de texto libre/semi-libre, no una lista cerrada. En pagos suele venir vacío o con el medio/nota (p. ej. `Descuento Comercial`, `Transf. Bancolombia`, `Enlace Yunno - Payment ID: …`, ajustes de saldo a favor); en `Nota Credito` describe el motivo (`Error`, `Factura duplicada`, `Corrección de monto`, `Aplica nueva factura`, `Anulación de factura`, …); en `Notificacion` es el tipo de aviso enviado (`Aviso Inicial`, `Aviso antes de vencimiento`, `Mora Temprana`, `Alerta - Mora Alta`, `Aviso de suspensión Temporal`, `VENCE_HOY`, `SUSPENSION`, etc. — hay variantes con distinto formato/mayúsculas para el mismo concepto). En `Externo`/`Incobrable` suele venir vacío. |
| `ID` | Id del documento origen en Alegra: el pago, la nota de crédito o la retención. |
| `ID_Factura_Fecha` | Factura + fecha del movimiento (`E310000000372_2025-01-22`). |

## Notas / gotchas

- `Monto` está en moneda local (no tiene columna USD propia) — si necesitas USD, cruza por `Factura` contra Roll Rates/Invoice Items para obtener la `TRM` correspondiente.
- `Movimiento = Notificaciones` no mueve saldo (no es dinero); es el rastro de comunicación con el cliente. Para conteos agregados diarios de notificaciones usa mejor `Alanube Daily History` (ya vienen sumadas por día); usa esta tabla cuando necesites el detalle de una factura/cliente puntual.
- Para reconciliar contra el saldo de una fila de Roll Rates de un mes: filtra `Movements` por `Factura` y por el mes de `Fecha`, y agrupa `Monto` por `Movimiento` (Payment, Nota Credito, Retencion) — debe cuadrar con `Pago del Mes`, `NC Aplicada` y `Retenciones` de esa fila. Esta es la vía confiable para el monto real de una NC cuando la factura tiene varios ítems (ver el gotcha de `ID_Item` duplicado en `alanube_invoice_items.md`: ahí el monto de NC puede aparecer repetido por ítem y no sumar al total real; aquí en Movements aparece una sola vez, correcto, a nivel de factura).
- `Movimiento = 'Externo'` marca el evento de asignación a gestión externa (verificado: la fecha de este movimiento cae dentro del mismo mes en que `Roll Rates.Gestión` cambia a `Externa` para esa factura); es el disparador de por qué `Gestión` cambia de Interna a Externa en Roll Rates a partir de ese mes.
  - **Ojo**: una misma factura puede tener **más de un** movimiento `Externo` (verificado: 5 de 29 facturas con evento `Externo` tienen 2). El segundo evento no implica una nueva transición Interna→Externa (la factura ya estaba en `Externa` en Roll Rates para ese periodo) — parece ser una reasignación/reafirmación. No asumas que `COUNT(Movimiento = 'Externo')` = número de transiciones de gestión; para el estado de gestión de un mes puntual, la fuente de verdad sigue siendo `Roll Rates.Gestión` fila por fila.
- Para responder "qué pagos/movimientos tiene la factura X", filtra esta tabla por `Factura` y ordena por `Fecha` — te da la línea de tiempo completa (pagos, NC, retenciones, asignación a externo, notificaciones) para esa factura puntual.
