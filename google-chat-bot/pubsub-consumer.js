// Consumidor de Pub/Sub que conecta Google Chat con Robin (Hermes CLI).
// Google Chat publica cada evento en un topic de Pub/Sub; este proceso hace
// "pull" de la suscripción, le pasa el mensaje a `./run.sh -q "<mensaje>"`
// (Robin) y publica la respuesta de vuelta al espacio vía la Chat API,
// autenticado como la propia app (sin necesidad de un endpoint público).

require('dotenv').config();

const path = require('path');
const { spawn } = require('child_process');
const { PubSub } = require('@google-cloud/pubsub');
const { google } = require('googleapis');
const { createLinearTask } = require('./linear-api');

const PROJECT_ID = process.env.GCP_PROJECT_ID;
const SUBSCRIPTION_NAME = process.env.PUBSUB_SUBSCRIPTION;
const ALLOWED_SPACES = (process.env.GCHAT_ALLOWED_SPACES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ROBIN_DIR = path.resolve(__dirname, '..');
const ROBIN_TIMEOUT_MS = Number(process.env.ROBIN_TIMEOUT_MS || 60000);
const MAX_MESSAGE_AGE_MS = Number(process.env.MAX_MESSAGE_AGE_MS || 3 * 60 * 1000);

if (!PROJECT_ID || !SUBSCRIPTION_NAME) {
  console.error('Faltan GCP_PROJECT_ID o PUBSUB_SUBSCRIPTION en .env');
  process.exit(1);
}

const pubsub = new PubSub({ projectId: PROJECT_ID });
const subscription = pubsub.subscription(SUBSCRIPTION_NAME);

// La cuenta de servicio (GOOGLE_APPLICATION_CREDENTIALS) debe pertenecer al
// mismo proyecto de Cloud que la app de Chat: así puede publicar mensajes
// "como la app", sin delegación de dominio.
const chatAuth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/chat.bot'],
});
const chat = google.chat({ version: 'v1', auth: chatAuth });

function stripMention(text) {
  return text.replace(/^@\S+\s*/, '').trim();
}

function askRobin(message) {
  return new Promise((resolve, reject) => {
    const child = spawn('hermes', ['-z', `${message}`, '--cli'], {
  cwd: ROBIN_DIR,
  shell: true,


    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('timeout'));
    }, ROBIN_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(stderr || `run.sh salió con código ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function parseAndCreateTask(response) {
  if (!response.includes('**Qué:**') || !response.includes('**Por qué:**')) {
    return response;
  }

  try {
    const titleMatch = response.match(/\*\*Título:\*\*\s*(.+?)(?:\n|$)/);
    const queMatch = response.match(/\*\*Qué:\*\*\s*(.+?)(?:\*\*Por qué|$)/s);
    const porqueMatch = response.match(/\*\*Por qué:\*\*\s*(.+?)(?:\*\*Hecho cuando|$)/s);
    const hechoMatch = response.match(/\*\*Hecho cuando:\*\*\s*(.+?)(?:\*\*Responsable|$)/s);
    const fechaMatch = response.match(/\*\*Fecha límite:\*\*\s*(\d{4}-\d{2}-\d{2})?/);
    const priorMatch = response.match(/\*\*Prioridad:\*\*\s*(Alta|Media|Baja|Urgente)?/);

    if (!titleMatch || !queMatch) return response;

    const title = titleMatch[1].trim();
    const description = [
      `**Qué:** ${queMatch[1].trim()}`,
      `**Por qué:** ${porqueMatch ? porqueMatch[1].trim() : ''}`,
      `**Hecho cuando:** ${hechoMatch ? hechoMatch[1].trim() : ''}`
    ].filter(s => s.length > 20).join('\n\n');

    const dueDate = fechaMatch ? fechaMatch[1] : null;
    const priority = priorMatch ? priorMatch[1] : 'Media';

    console.log(`Creando tarea en Linear: "${title}"`);
    const task = await createLinearTask(title, description, priority, dueDate);

    return `${response}\n\n✅ **Tarea creada en Linear:** ${task.identifier} · [${task.title}](${task.url})`;
  } catch (err) {
    console.error('Error creando tarea en Linear:', err.message);
    return `${response}\n\n⚠️ No se pudo crear la tarea en Linear: ${err.message}`;
  }
}

async function replyToSpace(spaceName, threadName, text) {
  await chat.spaces.messages.create({
    parent: spaceName,
    requestBody: {
      text,
      ...(threadName ? { thread: { name: threadName } } : {}),
    },
  });
}

subscription.on('message', async (message) => {
  // Ack inmediato: Robin puede tardar más que el plazo de entrega de Pub/Sub;
  // el ack solo confirma que recibimos el evento, no que ya respondimos.
  message.ack();

  try {
    const event = JSON.parse(message.data.toString('utf8'));
    // El formato Pub/Sub de Chat anida el mensaje en chat.messagePayload,
    // no en event.type/event.message como el modo HTTP endpoint clásico.
    const messagePayload = event.chat && event.chat.messagePayload;
    if (!messagePayload || !messagePayload.message) {
      console.log('Evento ignorado (no es un mensaje):', Object.keys(event.chat || {}));
      return;
    }

    const spaceName = messagePayload.space && messagePayload.space.name;
    if (ALLOWED_SPACES.length && !ALLOWED_SPACES.includes(spaceName)) {
      console.warn(`Evento descartado: espacio no autorizado (${spaceName})`);
      return;
    }

    // Si el consumidor estuvo caído, Pub/Sub retiene el mensaje hasta que
    // alguien lo jale de nuevo. Evitamos "resucitar" saludos viejos.
    const createTime = messagePayload.message.createTime && new Date(messagePayload.message.createTime).getTime();
    const ageMs = createTime ? Date.now() - createTime : 0;
    if (ageMs > MAX_MESSAGE_AGE_MS) {
      console.warn(`Evento descartado: demasiado viejo (${Math.round(ageMs / 1000)}s)`);
      return;
    }

    const threadName = messagePayload.message.thread && messagePayload.message.thread.name;
    const rawText = (messagePayload.message.text || '').trim();
    console.log(`Mensaje de ${messagePayload.message.sender && messagePayload.message.sender.displayName} en ${spaceName}: "${rawText}"`);
    const question = stripMention(rawText);
    if (!question) {
      await replyToSpace(spaceName, threadName, 'Escribe tu consulta (ej: "estado de cuenta del cliente X").');
      return;
    }

    const answer = await askRobin(question);
    const finalAnswer = await parseAndCreateTask(answer);
    await replyToSpace(spaceName, threadName, finalAnswer || 'Robin no devolvió respuesta.');
  } catch (err) {
    console.error('Error procesando evento de Chat:', err.message);
  }
});

subscription.on('error', (err) => {
  console.error('Error de la suscripción Pub/Sub:', err);
});

console.log(`Robin escuchando eventos de Google Chat vía Pub/Sub (${SUBSCRIPTION_NAME})...`);
