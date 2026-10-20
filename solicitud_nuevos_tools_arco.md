# Solicitud: nuevos tools de A.R.C.O para Robin

> ✅ **Resuelto (2026-08-31).** El equipo de A.R.C.O respondió con la
> "alternativa" propuesta abajo: extendieron `arco_consultar_cliente` en vez
> de crear tools nuevos. Contrato final en
> [robin-external-api.md](robin-external-api.md); `system_prompt.md` y
> `AGENTS.md` ya están actualizados con las instrucciones de uso. Este
> documento queda como registro de la solicitud original.
>
> ⚠️ Al probar la integración salió un bug (`documentos_emitidos_mes` no
> refleja datos de la Calculadora) — ver detalle en
> [robin-external-api.md](robin-external-api.md#bug-documentos_emitidos_mes-no-refleja-datos-de-la-calculadora).

**De:** Equipo Collection (Robin / Alanube)
**Para:** Equipo que mantiene A.R.C.O (backend)
**Fecha:** 2026-08-31
**Motivo:** Robin (agente de cobranza) solo puede consultar A.R.C.O a través de tools
expuestos explícitamente — no lee la base de datos, Google Sheets ni el
backend directamente (restricción de diseño, ver `system_prompt.md`). Hoy
existen 3 tools (`arco_consultar_cliente`, `arco_ranking_cartera`,
`arco_registrar_gestion`) que cubren cartera y facturación, pero no cubren:

1. El historial de correos de notificación con detalle (tipo, fecha, destino).
2. La nueva sección de documentos emitidos, organizados por mes.

Se solicitan dos tools nuevos (o extender uno existente, ver alternativa al
final) para cerrar ese hueco.

---

## Tool 1 — `arco_historial_correos`

**Objetivo:** consultar el historial de correos de cobranza enviados a un
cliente, con el detalle necesario para responder "¿cuál fue el último correo
que le enviamos a X?".

### Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `client_id` | string | uno de los dos (`client_id` o `nombre`) | ID del cliente en A.R.C.O |
| `nombre` | string | uno de los dos | Nombre del cliente (si no se conoce el `client_id`) |
| `sociedad` | string | sí, si se usa `nombre` | País/sociedad, para desambiguar |
| `tipo` | string | no | Filtro por tipo de correo (ej. `recordatorio`, `mora`, `vencimiento`) |
| `limit` | number | no (default sugerido: 10) | Máximo de correos a devolver, más recientes primero |

### Respuesta esperada

```json
{
  "cliente": { "client_id": "...", "nombre": "...", "sociedad": "..." },
  "correos": [
    {
      "tipo": "recordatorio_vencimiento",
      "fecha_notificacion": "2026-08-20T14:32:00Z",
      "destinatario": "facturacion@clientex.com",
      "asunto": "Recordatorio: factura próxima a vencer",
      "estado_envio": "enviado"
    }
  ],
  "total": 1
}
```

- Si no hay correos: `"correos": []`.
- Si el cliente no existe: mismo contrato de error que `arco_consultar_cliente`
  (`"Cliente no encontrado"` o `candidatos` si el nombre es ambiguo).

### Nota

Si `historial_notificaciones` (ya devuelto por `arco_consultar_cliente`) **ya
contiene** `tipo` + `fecha_notificacion` + `destinatario` por cada entrada,
este tool nuevo no sería necesario — bastaría con confirmar el shape exacto
de ese campo y documentarlo. Ver "Alternativa" al final.

---

## Tool 2 — `arco_documentos_emitidos`

**Objetivo:** consultar cuántos documentos (facturas u otros) emitió un
cliente en un mes/periodo determinado, aprovechando que A.R.C.O ahora guarda
los documentos organizados por el mes de emisión.

### Parámetros

| Parámetro | Tipo | Requerido | Descripción |
|---|---|---|---|
| `client_id` | string | uno de los dos (`client_id` o `nombre`) | ID del cliente |
| `nombre` | string | uno de los dos | Nombre del cliente |
| `sociedad` | string | sí, si se usa `nombre` | País/sociedad |
| `mes` | string | sí | Periodo a consultar, formato `YYYY-MM` (ej. `2026-08`) |
| `tipo_documento` | string | no | Filtro por tipo (ej. `factura`, `nota_credito`) si A.R.C.O distingue tipos |

### Respuesta esperada

```json
{
  "cliente": { "client_id": "...", "nombre": "...", "sociedad": "..." },
  "mes": "2026-08",
  "total_documentos": 14,
  "documentos": [
    {
      "numero": "FE-00123",
      "tipo": "factura",
      "fecha_emision": "2026-08-05",
      "estado": "emitido"
    }
  ]
}
```

- `documentos` puede omitirse o limitarse (ej. `limit` opcional) si el volumen
  es alto — lo mínimo indispensable es que `total_documentos` esté siempre
  presente, ya que es el dato que más se va a preguntar ("¿cuántos documentos
  emitió el cliente X en agosto?").
- Mismo contrato de error que los demás tools (`Cliente no encontrado`,
  `candidatos`).

---

## Alternativa (más económica): extender `arco_consultar_cliente`

En vez de dos tools nuevos, se podría:

1. Confirmar/documentar el shape real de `historial_notificaciones` (si ya
   trae tipo/fecha/destino, no hace falta el Tool 1).
2. Agregar un campo opcional `documentos_por_mes` (o un parámetro
   `mes` opcional en `arco_consultar_cliente`) que devuelva el resumen del
   Tool 2 solo cuando se pida.

Esto evita mantener 5 tools distintos, pero requiere que
`arco_consultar_cliente` soporte parámetros opcionales adicionales sin romper
las llamadas actuales.

---

## Qué se necesita del equipo de A.R.C.O

- [x] Confirmar si `historial_notificaciones` ya trae `tipo` + `fecha` +
      `destinatario`, o si hace falta el Tool 1.
- [x] Confirmar si es viable exponer documentos por mes vía tool nuevo o
      extendiendo `arco_consultar_cliente`.
- [x] Definir nombres finales de tools/parámetros (los de arriba son
      propuesta, deben quedar consistentes con la convención `arco_*` ya
      usada).
- [x] Una vez expuesto, avisar para actualizar `system_prompt.md` y
      `AGENTS.md` con las instrucciones de uso (mismo patrón que los tools
      actuales).

**Respuesta:** ver [robin-external-api.md](robin-external-api.md).
