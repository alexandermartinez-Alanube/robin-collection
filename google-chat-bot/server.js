// Webhook HTTP que conecta Google Chat con Robin (Hermes CLI).
// Google Chat llama a POST /webhook por cada mensaje; este servicio lo pasa
// a `./run.sh -q "<mensaje>"` (Robin) y devuelve la respuesta de forma síncrona.

require('dotenv').config();

const path = require('path');
const { spawn } = require('child_process');
const express = require('express');
const { OAuth2Client } = require('google-auth-library');

const PORT = process.env.PORT || 8080;
const PROJECT_NUMBER = process.env.GCHAT_PROJECT_NUMBER; // audiencia esperada del JWT de Chat
const ALLOWED_SPACES = (process.env.GCHAT_ALLOWED_SPACES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean); // ej: "spaces/AAAA1111,spaces/BBBB2222" — vacío = sin restricción
const ROBIN_DIR = path.resolve(__dirname, '..');
const ROBIN_TIMEOUT_MS = Number(process.env.ROBIN_TIMEOUT_MS || 25000);

if (!PROJECT_NUMBER) {
  console.error('Falta GCHAT_PROJECT_NUMBER en .env — no se puede verificar la firma de Google Chat.');
  process.exit(1);
}

const authClient = new OAuth2Client();

async function verifyGoogleChatRequest(bearerToken) {
  const ticket = await authClient.verifyIdToken({
    idToken: bearerToken,
    audience: PROJECT_NUMBER,
  });
  const claim = ticket.getPayload();
  if (claim.iss !== 'chat@system.gserviceaccount.com') {
    throw new Error(`Emisor de token inesperado: ${claim.iss}`);
  }
  return claim;
}

function stripMention(text) {

  return text.replace(/^@\S+\s*/, '').trim();
}

function askRobin(message) {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['run.sh', '-q', message], {
      cwd: ROBIN_DIR,
      windowsHide: true,
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

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/webhook', async (req, res) => {
  try {
    const authHeader = req.get('Authorization') || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!bearerToken) {
      return res.status(401).json({ text: 'No autorizado.' });
    }
    await verifyGoogleChatRequest(bearerToken);

    const event = req.body || {};

    if (event.type !== 'MESSAGE' || !event.message) {
      
      return res.json({});
    }

    const spaceName = event.space && event.space.name;
    if (ALLOWED_SPACES.length && !ALLOWED_SPACES.includes(spaceName)) {
      console.warn(`Mensaje descartado: espacio no autorizado (${spaceName})`);
      return res.json({ text: 'Este espacio no está autorizado para usar a Robin.' });
    }

    const rawText = (event.message.text || '').trim();
    const question = stripMention(rawText);
    if (!question) {
      return res.json({ text: 'Escribe tu consulta (ej: "estado de cuenta del cliente X").' });
    }

    const answer = await askRobin(question);
    return res.json({ text: answer || 'Robin no devolvió respuesta.' });
  } catch (err) {
    console.error('Error procesando el webhook:', err.message);
    if (err.message === 'timeout') {
      return res.json({ text: 'Robin está tardando más de lo esperado. Intenta de nuevo en un momento.' });
    }
    return res.status(401).json({ text: 'No se pudo verificar la solicitud.' });
  }
});

app.listen(PORT, () => {
  console.log(`Robin Google Chat webhook escuchando en el puerto ${PORT}`);
});
