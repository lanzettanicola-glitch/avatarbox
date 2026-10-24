// AvatarBox gateway — Cloudflare Worker (piano gratuito).
// Impostazioni > Variabili e segreti: GROQ_KEY, GEMINI_KEY, OPENROUTER_KEY (almeno una)
// e ALLOWED_ORIGIN = https://lanzettanicola-glitch.github.io (solo dominio, senza percorso).
// Facoltativi: DISABLED = "1" (interruttore di emergenza) e il binding RL (Rate Limiting) di Cloudflare.
// Gli ID dei modelli cambiano nel tempo: aggiornali qui se un fornitore li ritira.

const CHAIN = {
  fast: [["groq", "llama-3.1-8b-instant"], ["gemini", "gemini-2.0-flash"], ["openrouter", "meta-llama/llama-3.3-70b-instruct:free"]],
  smart: [["groq", "llama-3.3-70b-versatile"], ["gemini", "gemini-2.5-flash"], ["openrouter", "meta-llama/llama-3.3-70b-instruct:free"]],
};
CHAIN.auto = CHAIN.fast;

const URLS = {
  groq: "https://api.groq.com/openai/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};
const KEYS = { groq: "GROQ_KEY", gemini: "GEMINI_KEY", openrouter: "OPENROUTER_KEY" };
const MAX_PER_MINUTE = 15, MAX_PER_DAY = 300;
const MAX_BODY = 64 * 1024, MAX_TOTAL_CHARS = 16000, UPSTREAM_TIMEOUT_MS = 15000;
const minute = new Map(), daily = new Map(); // in memoria: limite "best effort" per istanza

const SEC = { "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const json = (obj, status, cors) =>
  new Response(JSON.stringify(obj), { status, headers: { ...SEC, ...cors, "Content-Type": "application/json" } });

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: { ...SEC, ...cors } });
    if (req.method !== "POST" || new URL(req.url).pathname !== "/chat") return json({ error: "Non trovato" }, 404, cors);
    if (env.DISABLED === "1") return json({ error: "Servizio temporaneamente sospeso." }, 503, cors);

    if (env.ALLOWED_ORIGIN && req.headers.get("Origin") !== env.ALLOWED_ORIGIN) return json({ error: "Origine non consentita" }, 403, cors);
    if (!(req.headers.get("Content-Type") || "").includes("application/json")) return json({ error: "Content-Type non valido" }, 415, cors);
    if (Number(req.headers.get("Content-Length") || 0) > MAX_BODY) return json({ error: "Richiesta troppo grande" }, 413, cors);

    const ip = req.headers.get("CF-Connecting-IP") || "?", now = Date.now(), day = new Date().toISOString().slice(0, 10);
    if (env.RL) { const { success } = await env.RL.limit({ key: ip }); if (!success) return json({ error: "Troppe richieste, riprova tra poco." }, 429, cors); }
    const recent = (minute.get(ip) || []).filter(t => now - t < 60000);
    const d = daily.get(ip);
    const used = d && d.day === day ? d.n : 0;
    if (recent.length >= MAX_PER_MINUTE) return json({ error: "Troppe richieste, riprova tra poco." }, 429, cors);
    if (used >= MAX_PER_DAY) return json({ error: "Limite giornaliero raggiunto." }, 429, cors);
    recent.push(now); minute.set(ip, recent); daily.set(ip, { day, n: used + 1 });
    if (minute.size > 5000) minute.clear();
    if (daily.size > 5000) daily.clear();

    let body;
    try {
      const raw = await req.text();
      if (raw.length > MAX_BODY) return json({ error: "Richiesta troppo grande" }, 413, cors);
      body = JSON.parse(raw);
    } catch { return json({ error: "JSON non valido" }, 400, cors); }
    if (!body || typeof body !== "object") return json({ error: "JSON non valido" }, 400, cors);

    let total = 0;
    const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-24).map((m, i) => {
      const role = m && ["system", "user", "assistant"].includes(m.role) ? m.role : "user";
      const content = String((m && m.content) || "").slice(0, role === "system" ? 1500 : 4000);
      total += content.length;
      return { role: role === "system" && i > 0 ? "user" : role, content };
    });
    if (!messages.length || total > MAX_TOTAL_CHARS) return json({ error: "Messaggi non validi" }, 400, cors);

    const temperature = Math.min(Math.max(Number(body.temperature) || 0.7, 0), 1.2);
    const max_tokens = Math.min(Math.max(Number(body.max_tokens) || 512, 16), 1024);
    const chain = typeof body.model === "string" && Object.hasOwn(CHAIN, body.model) ? CHAIN[body.model] : CHAIN.auto;

    for (const [provider, model] of chain) {
      const key = env[KEYS[provider]];
      if (!key) continue;
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), UPSTREAM_TIMEOUT_MS);
      try {
        const r = await fetch(URLS[provider], {
          method: "POST", signal: ctl.signal,
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
          body: JSON.stringify({ model, messages, stream: true, temperature, max_tokens }),
        });
        clearTimeout(timer);
        if (r.ok && r.body) {
          return new Response(r.body, { headers: { ...SEC, ...cors, "Content-Type": "text/event-stream" } });
        }
      } catch (e) { clearTimeout(timer); /* passa al fornitore successivo */ }
    }
    return json({ error: "Nessun modello disponibile al momento: riprova o usa l'IA locale." }, 503, cors);
  },
};
