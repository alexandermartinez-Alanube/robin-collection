# Robin — Deployment a Servidor

**Versión:** 2.0 (Multi-Agent Orchestrator)  
**Fecha:** 2026-10-20  
**Estado:** ✅ Listo para deploy

---

## Quick Start: Copiar a Servidor

### Paso 1: Archivos a actualizar
```bash
# Estos 2 archivos cambian:
✅ .env
✅ system_prompt.md

# Estos NO cambian:
✓ run.sh
✓ google-chat-bot/server.js
✓ google-chat-bot/.env (Pub/Sub config)
```

### Paso 2: Verificar credenciales en servidor
```bash
# En el servidor, asegúrate que existan:
LINEAR_API_KEY=<Mi_Key>
LINEAR_TEAM_ID=<Mi_team>
HAM_APIKEY=<Ham_key>
ROBIN_API_KEY=<Robin_key>
ARCO_API_URL=<url>
VIRTUAL_LITELLM_KEY=<MI_KEY>
```

### Paso 3: Reinicia los servicios
```bash
# En servidor:
pkill -f "hermes gateway" || true
pkill -f "node server.js" || true

# Inicia de nuevo:
cd /path/to/Robin
nohup bash run.sh gateway > gateway.log 2>&1 &
cd google-chat-bot
nohup npm run start:http > server.log 2>&1 &
```

### Paso 4: Valida que funciona
```bash
# Consulta test:
curl http://localhost:8080/health
# Debe devolver: {"ok":true}

# Test desde Hermes CLI:
hermes -z "¿Mora total por sociedad?" --cli
```

---

## Estructura de Directorios (No cambia)

```
/server/Robin/
├── .env .......................... ✅ Actualizar (credenciales)
├── system_prompt.md .............. ✅ Actualizar (6 roles)
├── run.sh ........................ ✓ Sin cambios
├── google-chat-bot/
│   ├── server.js ................. ✓ Sin cambios
│   ├── package.json .............. ✓ Sin cambios
│   ├── pubsub-consumer.js ........ ✓ Sin cambios
│   └── .env ....................... ✓ Sin cambios (Pub/Sub config)
├── dm-collection-mbql/ ........... ✓ Sin cambios
└── [otros archivos]
```

---

## 6 Roles Activos (Automáticos según contexto)

| Rol | Ejemplos de activación | Herramientas |
|-----|----------------------|--------------|
| **📊 Analista Cartera** | "mora por sociedad", "aging", "CEI", "DSO" | Metabase dm_collection |
| **👤 Gestor Cliente** | "Cliente X", "estado de cuenta", "ranking vencidos" | A.R.C.O API |
| **🤝 CRM/Salesforce** | "Owner de cuenta", "contactos", "oportunidades" | Salesforce SOQL |
| **📈 Reportería** | "Panorama ejecutivo", "síntesis", "recomendaciones" | Combo |
| **📋 Linear Assistant** | "Redacta tarea", "crea epic", "desglose" | Linear API |
| **🧠 Orquestador** | Cualquier pregunta → elige rol correcto | Coordina todos |

---

## Monitoreo en Servidor

### Logs clave
```bash
# Hermes gateway:
tail -f /server/Robin/gateway.log

# Node.js webhook:
tail -f /server/Robin/google-chat-bot/server.log

# Google Chat consumer (si usas Pub/Sub):
tail -f /server/Robin/google-chat-bot/consumer.log
```

### Health checks
```bash
# Endpoint HTTP:
curl http://localhost:8080/health

# Hermes CLI (si tienes acceso):
hermes status
```

---

## Consumo de Recursos (Esperado)

| Métrica | Valor | Notas |
|---------|-------|-------|
| **Memoria Hermes** | ~250-350 MB | 1 sesión, todos los roles en memoria |
| **CPU promedio** | 5-15% | Bajo, incrementa en queries complejas |
| **Conexiones BD** | 1-3 | Metabase, A.R.C.O, Salesforce |
| **Latencia P50** | 2-4s | Queries simples (cliente, owner) |
| **Latencia P95** | 8-15s | Multi-query (reportería, cartera agregada) |

---

## Troubleshooting

### "Error: Hermes command not found"
```bash
# En servidor, Hermes debe estar en PATH:
which hermes
# Si no aparece, instala: pip install hermes-agent (o tu método)
```

### "linear_api_key inválida"
```bash
# Regenera en https://linear.app/settings/account/api
# Actualiza .env en servidor
# Reinicia: pkill -f "hermes gateway"
```

### "Timeout en queries de Reportería"
```bash
# Aumenta en .env:
ROBIN_TIMEOUT_MS=45000  # default 25000
```

### "Salesforce: Missing read grant"
```bash
# Falta grant en HAM. Contacta admin de Salesforce:
# Necesitas: sf:query, sf:Account, sf:Contact
```

---

## Rollback (Si algo falla)

```bash
# Revierte a versión anterior:
git checkout HEAD~1 system_prompt.md
git checkout HEAD~1 .env

# Reinicia:
pkill -f "hermes gateway"
pkill -f "node server.js"
bash run.sh gateway &
cd google-chat-bot && npm run start:http &
```

---

## Preguntas frecuentes

**¿Puedo cambiar los 6 roles?**  
Sí, edita `system_prompt.md` sección "## 2. INSTRUCCIONES POR ROL". Reinicia `hermes gateway`.

**¿Dónde guardó Linear las tareas?**  
En el proyecto COLLPRO de tu workspace Linear. Búscalas por COLLPRO-XXXX.

**¿Puedo agregar un 7º rol?**  
Sí: define en `system_prompt.md`, prueba localmente con `run.sh -q "..."`, luego deploy.

**¿Hermes necesita GPU?**  
No. Usa CPU + DeepSeek v4-flash (modelo ligero). GPU es opcional para inferencia más rápida.

---

**Versión:** Robin 2.0  
**Actualizado:** 2026-10-20  
**Testeo:** ✅ Todos los roles testeados y funcionales
