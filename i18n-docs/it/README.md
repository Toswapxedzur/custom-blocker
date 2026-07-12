# Estensione del deposito

L'estensione Vault è uno strumento di focus Manifest V3 per i browser Chromium. Il suo attuale editor gestisce gruppi di blocchi di siti Web, gruppi di piattaforme supportate, gruppi JavaScript personalizzati, pianificazioni, controlli di blocco e posticipazione e collegamenti bridge facoltativi di app Web.

Il codice sorgente è il contratto del prodotto. Il manuale in-app in inglese su [manual/en.md](manual/en.md) spiega i controlli forniti; sostituisce i precedenti manuali copiati e tradotti automaticamente.

## Capacità attuali

- Gruppi di siti Web predefiniti con comportamento di lista bloccata o lista consentita, reindirizzamento opzionale, blocco immediato, tempo concesso o conto alla rovescia.
- Gruppi dedicati per YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord e Twitter/X.
- Filtri specifici della piattaforma e controlli opzionali per nascondere gli elementi laddove il profilo della piattaforma corrente li supporta.
- Gruppi JavaScript personalizzati con controllo della sintassi, modelli, controlli di esecuzione, runtime controllato e feed di registro.
- Pianificazioni per gruppo, modalità di blocco, controlli di posticipazione, importazione/esportazione e salvataggio automatico.
- Accesso facoltativo alla cartella locale per operazioni supportate con testo con regole personalizzate, CSV e JSON.
- Connessione facoltativa a un hub bridge Vault nativo per gruppi collegati esplicitamente.

## Esegui localmente

1. Apri `chrome://extensions` in un browser Chromium.
2. Abilita la **Modalità sviluppatore**.
3. Seleziona **Carica unpacked** e scegli questa cartella del repository.
4. Apri l'estensione Vault e crea un gruppo.

Il manifest richiede Chrome 116 o versione successiva per le attuali API fuori schermo e regole.

## Controlli di sviluppo

Esegui la suite di test delle estensioni da questa cartella:

```bash
./tests/run.sh
```

La suite esercita il comportamento dell'assistente, i profili della piattaforma, il rendering Markdown e l'audit del catalogo di traduzione.

## Manuali e traduzioni localizzate

I documenti inglesi rimangono la fonte canonica. L'estensione spedisce i suoi manuali localizzati accanto a `manual/en.md` e le copie localizzate di altri documenti gestiti si trovano in `i18n-docs/<locale>/`.

I cataloghi dell'interfaccia utente in `translation/*.json` sono completi per ogni locale supportata. Verifica i cataloghi e i documenti localizzati con:

```bash
node scripts/translation-audit.js
node scripts/documentation-audit.js
```

## Ambito

L'estensione Vault agisce solo nel profilo del browser in cui è installata e sulle pagine a cui il browser consente l'accesso. Non installa app native, non modifica le autorizzazioni di sistema né sincronizza i gruppi a meno che l'utente non colleghi esplicitamente un bridge e colleghi i gruppi corrispondenti.
