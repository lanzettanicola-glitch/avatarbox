// AvatarBox gateway — Cloudflare Worker (piano gratuito).
// Impostazioni > Variabili e segreti: GROQ_KEY, GEMINI_KEY, OPENROUTER_KEY (almeno una)
// e ALLOWED_ORIGIN = https://lanzettanicola-glitch.github.io (solo dominio, senza percorso).
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
const MAX_PER_MINUTE = 15;
const hits = new Map(); // conteggio per IP, in memoria (limite "best effort")

const json = (obj, status, cors) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST" || new URL(req.url).pathname !== "/chat") return json({ error: "Non trovato" }, 404, cors);

    const origin = req.headers.get("Origin");
    if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN) return json({ error: "Origine non consentita" }, 403, cors);

    const ip = req.headers.get("CF-Connecting-IP") || "?", now = Date.now();
    const recent = (hits.get(ip) || []).filter(t => now - t < 60000);
    if (recent.length >= MAX_PER_MINUTE) return json({ error: "Troppe richieste, riprova tra poco." }, 429, cors);
    recent.push(now); hits.set(ip, recent);
    if (hits.size > 5000) hits.clear();

    let body;
    try { body = await req.json(); } catch { return json({ error: "JSON non valido" }, 400, cors); }
    const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-24).map(m => ({
      role: ["system", "user", "assistant"].includes(m.role) ? m.role : "user",
      content: String(m.content || "").slice(0, 4000),
    }));
    if (!messages.length) return json({ error: "Nessun messaggio" }, 400, cors);

    const temperature = Math.min(Math.max(Number(body.temperature) || 0.7, 0), 1.2);
    const max_tokens = Math.min(Number(body.max_tokens) || 512, 1024);

    for (const [provider, model] of CHAIN[body.model] || CHAIN.auto) {
      const key = env[KEYS[provider]];
      if (!key) continue;
      try {
        const r = await fetch(URLS[provider], {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
          body: JSON.stringify({ model, messages, stream: true, temperature, max_tokens }),
        });
        if (r.ok && r.body) {
          return new Response(r.body, { headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
        }
      } catch (e) { /* passa al fornitore successivo */ }
    }
    return json({ error: "Nessun modello disponibile al momento: riprova o usa l'IA locale." }, 503, cors);
  },
};
