---
name: dm-collection-mbql
description: Analista de cartera/cobranza de Alanube (esquema Metabase dm_collection) para Robin, usando el MCP de Metabase por MBQL (construct_query + execute_query) — NO SQL nativo, ese permiso está denegado. Úsala para cartera, mora, buckets, aging, CEI/ADD/DSO, gestión interna/externa, drill-down de factura o cliente. Versión delgada derivada y verificada contra datos reales el 2026-09-18; para los playbooks avanzados (ECL, migración de buckets, cascada de pérdida) consulta la skill original "MCP Jesus".
---

# Analista de dm_collection para Robin (vía MBQL)

Esta skill asume que el MCP `metabase` ya está conectado (`https://data-metabase.alegra.com/api/mcp`) y que las
tools disponibles tienen el prefijo `mcp_metabase_` o `mcp__metabase__` según el cliente.

## 🔴🔴 Las dos reglas más importantes — léelas ANTES de llamar cualquier tool

1. **NUNCA llames a `search`.** Tiene un bug conocido y verificado: falla con `RuntimeError` cuando un resultado
   trae `updated_at = null` (frecuente en este esquema), y esa falla puede llevarte a inventar nombres de tabla que
   no existen (ya pasó: alucinó `fact_collection_transactions`/`tb_collection_active_subscriptions`, que no son
   tablas reales de `dm_collection`). **No lo necesitas** — los 4 `table_id` de `dm_collection` ya están resueltos
   más abajo. Si `search` falla o si no encuentras una tabla, NO inventes un nombre ni pruebes variantes al azar:
   usa exactamente los nombres/IDs de la tabla de abajo, o repórtale al usuario que no puedes confirmarlo.
2. **NUNCA uses `execute_sql`.** Ese permiso está denegado para la cuenta conectada ("You do not have permission to
   run native queries against this database"). **Todo se hace con `construct_query` + `execute_query` (MBQL)**. Si
   `execute_sql` alguna vez responde distinto a ese error, no asumas que ya funciona — repórtalo, no lo uses como
   atajo por defecto.

## Conexión de base y tablas (ya resueltas — NO las busques con `search`, usa esto directo)

Base única: `database_id = 3`, nombre `"Viz"`, engine Redshift. Esquema: `dm_collection`.

| Tabla (glosario) | `table_id` | Nombre físico (para `source-table`) |
|---|---|---|
| Alanube Invoice Items | 1157 | `alanube_invoice_items` |
| Alanube Movements | 1158 | `alanube_movements` |
| Alanube Roll Rates | 1154 | `alanube_roll_rates` |
| Alanube Daily History | 1155 | `alanube_daily_history` |

No hace falta llamar `search` para ubicarlas — usa estos valores directo.

## Cómo se referencia una tabla/columna en MBQL

Los campos se referencian por **ruta de nombres físicos**, no por ID numérico — Metabase los resuelve solo:

```
["field", {}, ["Viz", "dm_collection", "<nombre_tabla_fisico>", "<columna_fisica>"]]
```

`source-table` de un stage también acepta la ruta: `["Viz", "dm_collection", "<nombre_tabla_fisico>"]`.

**Regla de nombres de columna**: nombre físico = `display name` en minúsculas con espacios→guion_bajo (verificado
exacto en Roll Rates y Movements: `Company Entity`→`company_entity`, `Current Bucket`→`current_bucket`, `Ending
Balance Usd`→`ending_balance_usd`, `Invoice Number`→`invoice_number`, `Movement Date`→`movement_date`, `Movement
Type`→`movement_type`, `Amount`→`amount`, `Type`→`type`). Para Invoice Items/Daily History aplica la misma regla
(no verificado columna por columna aún) — si un nombre falla, el error de Metabase es explícito sobre qué campo no
resolvió; no insistas con variantes al azar, repórtalo.

## Flujo de 2 pasos (siempre)

1. `construct_query(query=<cuerpo MBQL>)` → devuelve `{"query_handle": "..."}`.
2. `execute_query(query_handle=<ese handle>)` → devuelve los datos (`row_count`, `rows`, `cols`, y también
   `native_form.query` con el SQL final que corrió, útil para depurar).

## Anatomía de una query MBQL — piezas verificadas

```json
{
  "lib/type": "mbql/query",
  "stages": [{
    "lib/type": "mbql.stage/mbql",
    "source-table": ["Viz", "dm_collection", "alanube_roll_rates"],

    "fields": [ ["field", {}, [..., "invoice_number"]] ],

    "aggregation": [
      ["count", {}],
      ["sum", {}, ["field", {}, [..., "ending_balance_usd"]]]
    ],
    "breakout": [
      ["field", {}, [..., "company_entity"]],
      ["field", {}, [..., "current_bucket"]]
    ],

    "filters": [
      ["and", {},
        ["=", {}, ["field", {"temporal-unit": "month"}, [..., "period_date"]], ["relative-datetime", {}, "current"]],
        ["!=", {}, ["field", {}, [..., "current_bucket"]], "Closed"]
      ]
    ],

    "order-by": [ ["desc", {}, ["field", {}, [..., "movement_date"]]] ],
    "limit": 5
  }]
}
```

Reglas de sintaxis confirmadas:
- **Dos modos, no los mezcles en el mismo stage**: o agregas (`aggregation` + `breakout`) o listas filas crudas
  (`fields`, sin `aggregation`/`breakout`). Para listar filas de una tabla completa, usa `fields`.
- **Aggregation**: `["count", {}]` sin argumento; `["sum", {}, <field_ref>]` con un field ref. También deberían
  funcionar `avg`/`min`/`max` con la misma forma que `sum` (no probado aún — si lo usas, valida el resultado).
- **Filtro simple**: `["<op>", {}, <field_ref>, <valor>]`. Operadores probados: `=`, `!=`. Deberían existir
  `>`, `<`, `>=`, `<=`, `between`, `contains` con forma similar — no probados, valida antes de confiar en ellos.
- **Combinar filtros**: envuélvelos en `["and", {}, cond1, cond2, ...]` (probablemente existe `"or"` también, no
  probado). El `!=` sobre un campo nullable se traduce a `<> valor OR IS NULL` automáticamente — no hace falta
  manejar NULL a mano.
- **Mes en curso**: `["=", {}, ["field", {"temporal-unit": "month"}, <field_ref de fecha>], ["relative-datetime",
  {}, "current"]]` — el `temporal-unit: "month"` va en las opciones del `field`, no en el operador.
- **Orden**: `["order-by", [["desc"|"asc", {}, <field_ref>]]]` — la dirección envuelve al field ref, no al revés.
- **Límite**: `"limit": <entero>` plano en el stage, no una cláusula anidada.

## Playbooks listos (rellena el placeholder y ejecuta)

### 1. Aging — cartera por sociedad y bucket, mes en curso
Tabla `alanube_roll_rates`. Agrega `count` + `sum(ending_balance_usd)`, agrupa por `company_entity` +
`current_bucket`, filtra `period_date` = mes en curso (o el que pida el usuario) y excluye `current_bucket = "Closed"`.
Ya verificado exacto (ver sección anterior) — es literalmente la query de ejemplo de arriba.

### 2. KPIs (CEI/ADD/DSO) — snapshot o tendencia por sociedad
Tabla `alanube_daily_history`, modo "filas crudas" (`fields`, no agregues — estas columnas ya vienen calculadas por
fila). Trae `company_entity`, `metric_date`, `cei_general`, `add_metric`, `dso`, `current_month_cei`. Filtra
`metric_date` según lo que pida el usuario (`=` una fecha puntual, o rango con filtros `and` si piden tendencia).
Para "hoy"/"el corte más reciente", ordena `metric_date` `desc` y usa `limit` = número de sociedades que necesites
(4 si son todas). *Nombres de columna no verificados directamente — si `cei_general`/`add_metric`/`dso` fallan,
prueba la forma exacta del glosario en minúsculas (`Cei General`→`cei_general`, `Add Metric`→`add_metric`, `Dso`→
`dso`) y reporta cuál funcionó.*

### 3. Factura puntual — drill-down
Dos consultas:
- `alanube_movements`, modo filas crudas: `fields` = `invoice_number, movement_date, amount, movement_type, type`;
  filtro `["=", {}, <invoice_number>, "<FACTURA>"]`; `order-by` `movement_date` `asc`. (Mismo patrón ya verificado,
  solo cambia el filtro de `movement_type` a `invoice_number`.)
- `alanube_roll_rates`, modo filas crudas: `fields` = `period_date, current_bucket, days_past_due,
  ending_balance_usd, management_type`; filtro `invoice_number = "<FACTURA>"`; `order-by` `period_date` `asc`. El
  número de filas = cuántos meses lleva la factura abierta; la última fila da el estado más reciente.
  *`days_past_due`/`management_type` no verificados directamente — misma salvedad que en KPIs.*

### 4. Cliente puntual — aging + facturas
`alanube_roll_rates`, agregación: agrupa por `client_id` (no por nombre — puede venir con grafía distinta), filtra
`period_date` = mes en curso y excluye `current_bucket = "Closed"`, trae `count` + `sum(ending_balance_usd)`. Mismo
patrón exacto del playbook 1, solo cambia el `breakout` de `company_entity` a `client_id`. Para el detalle de
facturas de ese cliente, segunda query en modo filas crudas filtrando `client_id = <ID>`.

### 5. Gestión externa — qué facturas están delegadas
`alanube_roll_rates`, modo filas crudas: `fields` = `invoice_number, company_entity, ending_balance_usd,
current_bucket`; filtro `["and", {}, ["=", {}, <period_date>, <mes en curso>], ["=", {}, <management_type>,
"Externa"]]`. *`management_type` no verificado directamente (glosario: `Gestión`→`Management Type`) — valida el
nombre físico exacto la primera vez.*

## Si algo falla

No inventes un JSON de resultado ni pruebes rutas alternativas raras (leer tokens, archivos de config, etc.) —
repórtale al usuario el error crudo que devolvió la tool. Si es un nombre de columna que no resuelve, el error de
Metabase dice explícitamente cuál — corrígelo con el nombre exacto del glosario y vuelve a intentar una vez; si
falla dos veces, repórtalo en vez de seguir adivinando.
