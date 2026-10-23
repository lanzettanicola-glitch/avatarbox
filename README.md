# AvatarBox 3

Hub IA sperimentale con avatar 3D, chat salvate localmente, confronto di due modelli, sintesi vocale del browser ed esportazione delle conversazioni.

## Requisiti
- Node.js 20 o superiore
- Connessione Internet per Three.js e il provider IA
- Una chiave API valida per il provider configurato

## Avvio locale

```bash
npm install
cp .env.example .env
```

Apri `.env` e inserisci la chiave in `POLLINATIONS_API_KEY`. Cambia anche `AVATARBOX_USER` e `AVATARBOX_PASSWORD` con credenziali uniche e robuste. Il browser chiederà queste credenziali quando la protezione è attiva. Verifica nella documentazione del provider l'endpoint e gli ID dei modelli che la tua chiave può usare. Aggiorna `AI_API_URL`, `AVAILABLE_MODELS` e `DEFAULT_MODEL` se necessario.

Poi avvia:

```bash
npm start
```

Apri http://localhost:3000.

## Pubblicazione su GitHub
1. Crea un repository e carica i file di questa cartella.
2. **Non caricare `.env`**: è escluso da `.gitignore`.
3. Per usare l'IA online, distribuisci l'app su un host che supporti Node.js e imposta le variabili d'ambiente nella dashboard dell'host.
4. GitHub Pages da solo non esegue `server.js`, quindi non può fornire l'endpoint `/api/chat`.

## Sicurezza e limiti
- La chiave API resta sul server; non viene inviata al browser.
- In produzione (`NODE_ENV=production`) il server non parte se mancano `AVATARBOX_USER` e `AVATARBOX_PASSWORD`. Configurali nelle variabili d’ambiente dell’host, mai nel repository.
- Sono attivi header di sicurezza, autenticazione HTTP Basic opzionale in locale e obbligatoria in produzione, limite di 20 richieste API al minuto per IP e limiti alla lunghezza delle richieste.
- Pubblica solo dietro HTTPS. Usa una password lunga e unica. HTTP Basic non sostituisce HTTPS e non è un sistema di account multiutente.
- Le chat sono salvate in `localStorage` del browser, non cifrate e non sincronizzate: non usarle per dati altamente sensibili.
- I modelli configurati sono solo esempi: gli ID, l'accesso e i prezzi dipendono dal provider e possono cambiare.
- Il confronto esegue due richieste, quindi può consumare circa il doppio rispetto a una singola risposta.
- La voce usa la sintesi vocale disponibile nel browser.
