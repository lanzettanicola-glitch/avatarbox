# AvatarBox

Assistente con avatar 3D che gira **interamente nel browser**: l'intelligenza artificiale viene eseguita in locale con WebGPU, senza server, senza chiavi API e senza costi. Le conversazioni restano sul tuo dispositivo.

**Provalo:** https://lanzettanicola-glitch.github.io/avatarbox/

## Cosa fa

- Avatar 3D personalizzabile (colori, accessori) con ammiccamento e bocca animata mentre parla
- Chat con IA locale, risposte in streaming e pulsante per interromperle
- Voce di sintesi (lettura frase per frase) e dettatura vocale, anche in modalità conversazione
- Cinque lingue per le risposte: italiano, inglese, spagnolo, francese, tedesco
- Cronologia chat con titoli, ricerca, rinomina, eliminazione, esportazione e importazione
- Modifica, eliminazione e rigenerazione dei messaggi
- Impostazioni di voce (velocità, volume), creatività, lunghezza delle risposte e personalità
- Gestione dei modelli scaricati, tema chiaro o scuro, dimensione del testo

## Requisiti

- **Browser con WebGPU:** Chrome o Edge aggiornati su computer, oppure un Android recente. Safari e Firefox potrebbero non funzionare.
- **Connessione a Internet** la prima volta, per scaricare il modello. Poi il modello resta salvato nel browser.
- **Spazio e memoria:** dipendono dal modello scelto.

| Modello | Download | Note |
|---|---|---|
| Qwen 2.5 1.5B | circa 1 GB | Consigliato, veloce |
| Phi 3.5 Mini | circa 2,5 GB | Leggero |
| Llama 3 8B | circa 5 GB | Più capace, richiede circa 6 GB di VRAM |

## Come si usa

1. Apri la pagina, personalizza l'avatar e scegli un modello.
2. Premi **Avvia AvatarBox**. Al primo avvio il modello viene scaricato (barra di avanzamento sotto il nome).
3. Scrivi o detta un messaggio. Con ⚙️ Impostazioni cambi voce, modello e aspetto in qualsiasi momento.

## Privacy

Chat e impostazioni sono salvate nel `localStorage` del browser, non cifrate e non sincronizzate: non usarle per dati altamente sensibili. Per funzionare, la pagina carica librerie, font e modelli da servizi esterni (cdnjs, esm.run, Google Fonts, Hugging Face), che possono vedere l'indirizzo IP del visitatore.

## Esecuzione locale e pubblicazione

L'app è un unico file, `index.html`. Per provarla in locale serve un piccolo server (aprire il file con doppio clic non basta per caricare i moduli):

```
python3 -m http.server 8000
```

Poi apri http://localhost:8000. Per pubblicarla basta mettere `index.html` nella radice del repository e attivare GitHub Pages (Settings → Pages → ramo `main`, cartella `/ (root)`).

## Limiti noti

- Modelli piccoli possono sbagliare o inventare: verifica le informazioni importanti.
- Su telefoni e browser senza WebGPU l'IA locale non parte.
- Le impostazioni di voce dipendono dalle voci installate nel dispositivo.
- L'interfaccia è in italiano; cambia solo la lingua delle risposte.

## Crediti e licenze

- Grafica 3D: [Three.js](https://threejs.org/) (MIT)
- Esecuzione dei modelli nel browser: [WebLLM](https://github.com/mlc-ai/web-llm) (Apache 2.0)
- Modelli: Qwen 2.5 (Apache 2.0), Phi 3.5 Mini (MIT), Llama 3 8B
- Font: Inter e Fira Code (SIL Open Font License)

**Built with Meta Llama 3.** Meta Llama 3 is licensed under the Meta Llama 3 Community License, Copyright © Meta Platforms, Inc. All Rights Reserved.

Verifica sempre i testi originali delle licenze prima di un uso commerciale.

## Licenza del progetto

Tutti i diritti riservati, salvo diversa indicazione.
