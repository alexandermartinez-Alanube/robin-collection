# Robin ↔ Google Chat (vía Cloud Pub/Sub)

Conecta un espacio/DM de **Google Chat** con **Robin** (Hermes CLI) sin exponer
ningún puerto ni URL pública: Google Chat publica cada evento en un topic de
Pub/Sub de tu proyecto, y este proceso los "jala" (pull), le pasa el mensaje a
`../run.sh -q "<mensaje>"` y publica la respuesta de vuelta al espacio usando
la Chat API (autenticado como la propia app).

## 1. Habilitar APIs

En tu proyecto de Google Cloud (project number `559696669516`):

1. **Google Chat API** — Biblioteca de APIs → buscar y habilitar.
2. **Cloud Pub/Sub API** — Biblioteca de APIs → buscar y habilitar.

## 2. Crear el topic y la suscripción

En **Pub/Sub → Topics → Create topic**:
- **Topic ID**: `robin-chat-events`

Dale permiso al servicio de Chat para publicar en ese topic:
- Entra al topic → pestaña **Permissions** → **Add principal**.
- Principal: `chat-api-push@system.gserviceaccount.com`
- Rol: **Pub/Sub Publisher**

Crea la suscripción (pull, no push):
- Dentro del topic → **Create subscription**.
- **Subscription ID**: `robin-chat-events-sub`
- **Delivery type**: Pull (por defecto).

## 3. Crear la cuenta de servicio de Robin

**IAM y administración → Cuentas de servicio → Crear cuenta de servicio**:
- Nombre: `robin-chat-bot`
- Roles a asignar:
  - **Pub/Sub Subscriber** (para leer la suscripción)
  - **Pub/Sub Viewer** (opcional, ayuda a depurar)

Genera una **clave JSON** para esa cuenta (pestaña **Keys** → **Add key** →
**JSON**) y descárgala.

⚠️ Guarda ese archivo dentro de `google-chat-bot/` como `service-account.json`
— ya está cubierto por el `.gitignore` raíz (`*.json`), así que no se sube a
ningún repo.

## 4. Configurar la Chat API para usar Pub/Sub

**APIs y servicios → Google Chat API → Configuration**:
- **App name**: Robin
- **Interactive features**: activado
- **Connection settings**: elige **Cloud Pub/Sub**
- **Topic name**: `projects/<TU_PROJECT_ID>/topics/robin-chat-events`
- **Visibility**: restringe a tu organización si es posible.

## 5. Instalar dependencias y configurar `.env`

```bash
cd google-chat-bot
npm install
cp .env.example .env
```

Edita `.env`:
```
GCP_PROJECT_ID=<tu-project-id>
PUBSUB_SUBSCRIPTION=robin-chat-events-sub
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
```

## 6. Arrancar el consumidor

```bash
npm start
```

Deberías ver: `Robin escuchando eventos de Google Chat vía Pub/Sub (robin-chat-events-sub)...`

Este proceso debe quedar corriendo (en esta misma máquina, porque A.R.C.O vive
en `localhost:5000`). Si se cae o reinicias el PC, solo hace falta volver a
correr `npm start` — a diferencia de un túnel, **no hay ninguna URL que
cambie**.

## 7. Probar

Desde Google Chat, busca la app "Robin", agrégala a un espacio o inicia un DM,
y escribe algo como:

```
estado de cuenta del cliente 12345
```

## Notas

- **Sin URL pública**: Pub/Sub es "pull", así que no necesitas ngrok,
  Cloudflare Tunnel ni ningún puerto abierto a internet.
- **Autenticación como app**: la cuenta de servicio usa el scope
  `https://www.googleapis.com/auth/chat.bot` para responder en los espacios
  sin necesidad de delegación de dominio.
- **Alternativa HTTP**: si en algún momento prefieres el modo con endpoint
  HTTP + túnel (más simple de depurar, pero con URL que cambia), sigue
  disponible con `npm run start:http` — usa `server.js` y las variables
  `PORT` / `GCHAT_PROJECT_NUMBER` del `.env.example`.
- **Restringir espacios**: usa `GCHAT_ALLOWED_SPACES` en `.env` si quieres que
  Robin solo responda en ciertos espacios.
