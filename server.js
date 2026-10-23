require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_URL = process.env.AI_API_URL || 'https://gen.pollinations.ai/v1/chat/completions';
const API_KEY = process.env.POLLINATIONS_API_KEY || '';
const ACCESS_USER = process.env.AVATARBOX_USER || '';
const ACCESS_PASSWORD = process.env.AVATARBOX_PASSWORD || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (IS_PRODUCTION && (!ACCESS_USER || !ACCESS_PASSWORD)) {
  console.error('Avvio bloccato: in produzione configura AVATARBOX_USER e AVATARBOX_PASSWORD.');
  process.exit(1);
}
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'openai';
const ALLOWED_MODELS = (process.env.AVAILABLE_MODELS || 'openai,openai-fast,mistral,deepseek')
  .split(',').map(s => s.trim()).filter(Boolean);

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'],
    connectSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    frameAncestors: ["'none'"]
  } },
  crossOriginEmbedderPolicy: false
}));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!ACCESS_USER || !ACCESS_PASSWORD) return next(); // consentito solo in sviluppo locale
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="AvatarBox", charset="UTF-8"');
    return res.status(401).send('Accesso richiesto.');
  }
  let suppliedUser = '', suppliedPassword = '';
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const splitAt = decoded.indexOf(':');
    if (splitAt < 0) throw new Error('Formato credenziali non valido');
    suppliedUser = decoded.slice(0, splitAt);
    suppliedPassword = decoded.slice(splitAt + 1);
  } catch {
    res.set('WWW-Authenticate', 'Basic realm="AvatarBox", charset="UTF-8"');
    return res.status(401).send('Accesso richiesto.');
  }
  const safeEqual = (a, b) => {
    const aa = Buffer.from(a); const bb = Buffer.from(b);
    return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
  };
  if (!safeEqual(suppliedUser, ACCESS_USER) || !safeEqual(suppliedPassword, ACCESS_PASSWORD)) {
    res.set('WWW-Authenticate', 'Basic realm="AvatarBox", charset="UTF-8"');
    return res.status(401).send('Credenziali non valide.');
  }
  next();
});
app.use(express.json({ limit: '50kb' }));
app.use('/api/', rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: 'Troppe richieste. Attendi un minuto e riprova.' } }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('/api/config', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ configured: Boolean(API_KEY), models: ALLOWED_MODELS, defaultModel: DEFAULT_MODEL });
});

app.post('/api/chat', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!API_KEY) {
    return res.status(503).json({ error: 'API non configurata. Imposta POLLINATIONS_API_KEY nel file .env sul server.' });
  }
  const { messages, model } = req.body || {};
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 40) {
    return res.status(400).json({ error: 'Cronologia non valida (massimo 40 messaggi per richiesta).' });
  }
  if (!ALLOWED_MODELS.includes(model)) {
    return res.status(400).json({ error: 'Modello non consentito. Controlla AVAILABLE_MODELS nel file .env.' });
  }
  const cleanMessages = [];
  let totalChars = 0;
  for (const item of messages) {
    if (!item || !['system', 'user', 'assistant'].includes(item.role) || typeof item.content !== 'string') {
      return res.status(400).json({ error: 'Formato messaggio non valido.' });
    }
    totalChars += item.content.length;
    if (item.content.length > 8000 || totalChars > 24000) {
      return res.status(413).json({ error: 'Testo troppo lungo. Riduci la lunghezza della richiesta.' });
    }
    cleanMessages.push({ role: item.role, content: item.content });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const upstream = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({ model, messages: cleanMessages, stream: false })
    });
    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { error: { message: 'Il provider ha restituito una risposta non JSON.' } }; }
    if (!upstream.ok) {
      // Non inoltrare dettagli potenzialmente sensibili dell'upstream.
      return res.status(upstream.status === 429 ? 429 : 502)
        .json({ error: upstream.status === 429 ? 'Limite del provider raggiunto. Riprova più tardi.' : 'Il provider IA ha rifiutato la richiesta. Controlla la configurazione sul server.' });
    }
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim()) {
      return res.status(502).json({ error: 'Risposta del modello vuota o in formato non supportato.' });
    }
    return res.json({ answer: answer.trim(), model });
  } catch (err) {
    const aborted = err.name === 'AbortError';
    return res.status(aborted ? 504 : 502).json({ error: aborted ? 'Timeout del provider (60 secondi).' : 'Impossibile contattare il provider IA.' });
  } finally {
    clearTimeout(timeout);
  }
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`AvatarBox pronto sulla porta ${PORT}. Non vengono stampate chiavi o credenziali.`));
