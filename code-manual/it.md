# Manuale del codice dell'estensione browser Vault

[Manuale utente](../manual/it.md)

## Contratto della regola

Source: una sola espressione di funzione `(on, v) => { ... }`. Sono supportati solo JavaScript sincrono e l’API seguente; nessun callback di pianificazione JavaScript, accesso alla rete, API di estensione o accesso diretto al DOM. Le regole basate sul tempo usano i timer/tracciatori gestiti descritti di seguito, oppure `ev.now` ed eventi.

- Le modifiche salvano una bozza; **Run** attiva la regola e abilita il gruppo. I gruppi congelati non possono eseguire Run. Una source vuota scarica la regola.
- Un Run riuscito sostituisce handlers e panels, mantenendo `v.state`. Se compilazione/registrazione fallisce, resta la regola precedente; un timeout può interromperla. Quando il motore si ricarica, registra di nuovo l'ultima source attivata; le closure variables vengono azzerate.
- La registrazione può inizializzare state, registrare handlers, mostrare panels e scrivere log. Azioni sulla pagina/file ed emits vanno inseriti negli handlers; la coda creata durante la registrazione viene scartata.
- Disable sospende gli handlers e rimuove panels, sheets, covers e verdetti sugli elementi gestiti. Enable ripristina panels/sheets conservati e richiede di nuovo gli elementi. Run non cancella sheets, covers o verdetti esistenti. Delete rimuove regola, state ed effetti. Navigazione, modifiche DOM e scritture di file non vengono annullate.
- Gli events non sono limitati ai normali obiettivi del gruppo; filtra URLs/items nella regola. Gli actions vengono messi in coda e applicati dopo il dispatch. Le eccezioni interrompono quell'handler senza ripristinarne state/actions; gli handlers successivi possono ancora funzionare. Solo gli events file/query confermano un action.

## API condivisa

- `on(type, handler)` → boolean. Registra `handler(ev)`; più handlers vengono eseguiti nell'ordine di registrazione. False indica argomenti non validi o limite degli handlers raggiunto. `ev = { type: string, now: number, origin: "host" | "user" | "rule", data }`; `now` è Unix in millisecondi. Gli eventi reali dei controlli visualizzati hanno `origin: "user"`; gli eventi `v.emit` hanno `origin: "rule"`.
- `v.state`: oggetto JSON modificabile e salvato dopo l'event dispatch. Inizializza i fields mancanti invece di sovrascrivere lo state esistente. Assegnare un non-object o un array lo reimposta a `{}`; aggiornamenti non serializzabili/troppo grandi non vengono salvati.
- `v.log(...values)`: scrive nel Log di questo gruppo. Qui appaiono anche gli errori degli handler e gli errori segnalati delle azioni sulla pagina; la segnalazione non ripete le azioni. Logs/Clear sono indipendenti per gruppo. Gli errori di caricamento appaiono nello stato Run.
- `v.emit(type, data)`: mette in coda una copia JSON di `data` per gli handlers del gruppo dopo l'event corrente, con un nuovo `now`; non è una chiamata sincrona.
- `v.panel(id, spec, tabId?)`: sostituisce il panel nominato del gruppo; ometti `tabId` per tutte le pagine web accessibili oppure usa un tab ID intero. `spec` null rimuove il panel. Vedi Panels.
- `v.file(op, path, payload?)` → stringa request ID. Vedi Files.
- `v.store(request)` restituisce un ID richiesta; consulta i record del gruppo.

Le altre chiamate condivise restituiscono `undefined`, tranne le funzioni di creazione degli oggetti temporali gestiti con nome descritte di seguito. IDs/state appartengono al gruppo, non al suo nome visualizzato.

## Timer gestiti e utilizzo a finestra mobile

`v.timer(id, {direction:"down", durationMs:300000})` crea o restituisce un conto alla rovescia con nome, inizialmente in pausa. Usa `{direction:"up"}` per un timer crescente. L’oggetto offre `start()`, `pause()`, `resume()`, `reset()` e `snapshot()`. Avvio/ripresa sono idempotenti; il ripristino riporta il timer in pausa con zero tempo trascorso. I campi dello snapshot includono `ready`, `error`, `elapsedMs`, `remainingMs` (null per il timer crescente), `running` e `completed`.

I timer in esecuzione avanzano in base al tempo reale trascorso mentre l’app/il browser è chiuso o la regola è disabilitata. Un conto alla rovescia completato invia `timerEnded` con `{id, direction, durationMs, generation, incarnation}` una volta per incarnazione e generazione del timer a ciascun membro quando la sua regola viene eseguita di nuovo; Run non lo ripete. La consegna dipende dagli eventi dell’host; non è una sveglia in tempo reale. Inserisci `{type:"timer", timerId:"focus", label:"Focus"}` in un pannello per visualizzarlo tramite il controllo di testo esistente.

`v.rolling(id, {windowMs:3600000, limitMs:600000})` crea o restituisce un tracciatore con nome dell’utilizzo attivo. `assign({websites:["youtube.com","reddit.com"], apps:[]})` sostituisce le assegnazioni dei destinatari di questo membro. Le regole native possono invece assegnare identificatori di app della piattaforma. I domini includono i sottodomini. Un tracciatore raggruppa i propri destinatari; altri identificatori hanno quote indipendenti. `snapshot()` restituisce `ready`, `error`, `usedMs`, `remainingMs`, `available` e `nextReturnAtMs` (il prossimo millisecondo in cui scade un utilizzo registrato). `available(target?)` verifica anche l’assegnazione quando viene fornito un destinatario. `reset()` cancella la cronologia di questo oggetto.

Tutto l’utilizzo idoneo osservato viene conteggiato, anche oltre la quota; il tracciatore da solo non blocca pagine/app. Gli intervalli sovrapposti delle pagine visibili contano una sola volta e le app native conteggiano l’utilizzo osservato in primo piano. Le regole disabilitate non aggiungono utilizzo; la cronologia continua a scadere ai confini esatti degli intervalli. La disponibilità torna solo quando la cronologia rimanente è inferiore al limite. I campioni periodici sono limitati a cinque secondi; le interruzioni dovute a chiusura o disabilitazione non generano attività. Gli eventi emessi dall’utente non aggiungono utilizzo.

Gli stessi identificatori di oggetto nei gruppi personalizzati collegati condividono un’unica autorità locale nell’hub nativo. Il collegamento combina cronologia e assegnazioni dei tracciatori e mantiene lo stato del timer che avvia il collegamento; le configurazioni incompatibili impediscono il collegamento. Ogni membro riceve il proprio evento di completamento. La disconnessione rende indisponibili i tracciatori condivisi e rifiuta i comandi dei timer finché non torna disponibile un’autorità aggiornata. Quando il collegamento viene rimosso, ogni membro conserva l’utilizzo condiviso finale e lo stato del timer, ripristina i propri destinatari e scarta i comandi del vecchio collegamento. L’hub conserva lo snapshot finale finché il membro che ritorna non lo salva e ne conferma la ricezione; i trasferimenti in sospeso terminano prima che sia disponibile un nuovo collegamento.

Gli oggetti con nome sopravvivono a Run e al riavvio nel campo riservato `v.state.$vaultTime`; non modificare direttamente questo campo. Rimuovili esplicitamente con `v.removeTime(id)`. Gli identificatori sono composti da 1–80 lettere ASCII, cifre, `_` o `-`; i nomi di proprietà riservati vengono rifiutati. Fino a 32 oggetti condividono il limite di stato della regola di 64 KiB in UTF-8. Le durate sono millisecondi interi fino a 365 giorni. La cronologia mobile è limitata a 1024 contenitori da un minuto e 2048 intervalli uniti. Gli errori di capacità della cronologia lasciano il tracciatore indisponibile fino al ripristino esplicito; le configurazioni non valide e i salvataggi troppo grandi segnalano errori senza cancellare i dati salvati.

```js
(on, v) => {
  const timer = v.timer("focus", {durationMs: 300000});
  v.panel("focus", {controls: [
    {type: "timer", timerId: "focus", label: "Focus"},
    {id: "start", type: "button", label: "Start"},
    {id: "pause", type: "button", label: "Pause"},
    {id: "reset", type: "button", label: "Reset"}
  ]});
  on("panel", ev => {
    if (ev.data.eventName !== "click") return;
    if (ev.data.controlId === "start") timer.start();
    if (ev.data.controlId === "pause") timer.pause();
    if (ev.data.controlId === "reset") timer.reset();
  });
  on("timerEnded", ev => v.log("Finished", ev.data.id));
}
```

## Browser events

La notazione del payload descrive i tipi, non è codice eseguibile. `?` indica fields facoltativi.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
attachment: { eventName: "click" | "input" | "change", tabId: number,
              attachmentId: string, controlId: string, value: unknown,
              values: { [controlId: string]: unknown }, item: Item, text: string }
record: { requestId: string, ok: boolean, op?: string, key?: string,
          record?: Record | null, entries?: Header[], next?: string | null,
          deleted?: number, error?: string }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, contentId: string, instanceId: string, attachments: { [id: string]: Attachment },
         url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` è approssimativo; usa timestamps, non il conteggio dei tick. `active` indica una pagina selezionata in una finestra browser, non dimostra che l'utente la stia guardando. URLs possono essere vuote o limitate.
- `visible` proviene da pagine accessibili e non nascoste; `elapsedMs` è il tempo dall'ultimo heartbeat e vale zero quando la pagina è coperta. Non è uso accumulato né tempo di riproduzione.
- `items` (`platform: "web"` fuori dai siti riconosciuti) segnala nuovi elementi feed supportati o modificati e li reinvia dopo Run/riattivazione. `ref` identifica una scheda nella pagina, non un content ID permanente; `ref === "page"` indica la pagina stessa. Titoli/URLs/autori possono essere vuoti. `authors` contiene source identifiers specifici della piattaforma.
- Platform IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. La disponibilità dipende dal markup supportato della pagina.
- I tag richiedono Classifier desktop collegato e una build/piattaforma con tagging attivo (Chromium e Safari: YouTube, Reddit, Bilibili, X/`twitter`). Confidence va da 1 a 5. `tagsSettled === false` significa in attesa/non disponibile, non senza tag; `tags: []` settled significa senza tag.
- `snooze` significa che è stato premuto il pulsante Snooze del gruppo. Non applica da solo una pausa.
- Le risposte query/file sono inviate al gruppo richiedente. Associa `requestId`, controlla `error`/`ok` e imposta una scadenza con i tick: le risposte possono perdersi alla chiusura della pagina, al riavvio del motore o alla disattivazione del gruppo. I request ID possono ripetersi dopo Run; le richieste in attesa non sono attività durevoli.

## Browser actions

`tabId` intero deve provenire da un event. Le azioni della pagina richiedono una pagina accessibile a Vault; le pagine interne del browser non sono disponibili. In genere, input non validi o destinazioni non disponibili non producono effetti.

- `v.item(tabId, ref, verdict)`: `"hide"` rimuove una scheda feed, `"dim"` copre il media, `"allow"` lo esenta dai gruppi inferiori, `null` cancella il verdetto del gruppo. Refs sconosciuti non fanno nulla; usa `v.cover` per `isPage`. I verdetti seguono l'ordine dei gruppi: hide più in alto prevale; dim più in alto resta anche con allow inferiore; allow impedisce verdetti inferiori. Una scheda riutilizzata/rimossa richiede una nuova decisione.
- `v.cover(tabId, on, message?)`: true copre la pagina, false rimuove la cover personalizzata; message è vuoto per impostazione predefinita (max 500 caratteri). Ogni pagina ha un custom-cover slot; vince l'ultima chiamata cover applicata, indipendentemente dall'ordine dei gruppi. Il cambio di indirizzo rimuove la cover; il blocco normale può comunque coprire la pagina.
- `v.go(tabId, target)`: URL HTTP(S) oppure `"back"`, `"forward"`, `"reload"` (target max 4096 caratteri).
- `v.close(tabId)`: chiude il tab.
- `v.css(tabIdOrStar, id, css)`: tab ID intero o `"*"`; sostituisce il foglio di stile del gruppo con quell'ID oppure lo rimuove con null. I tab sheets terminano al cambio indirizzo; le sheets `"*"` si applicano alle pagine future. ID max 80, CSS max 100000 caratteri.
- `v.dom(tabId, selector, op, arg?)`: CSS selector (max 1000); tutti i match, tranne `scrollTo` che usa il primo. Ops: `hide` imposta inline `display:none!important`; `show` rimuove l'inline display; `click`; `setText` sostituisce il testo con `arg`; `addClass`/`removeClass` usano un solo class name; `scrollTo` scorre fino all'elemento. Arg max 2000. Le modifiche restano finché non vengono annullate esplicitamente o la pagina viene sostituita.
- `v.query(tabId, selector)` → stringa request ID oppure null per argomenti non validi. Il risultato è un event `query` successivo: fino a 50 matches, `tag` minuscolo, normalized text ≤1000 caratteri, attributes ≤2000, value ≤1000. Nessun match restituisce `[]` con successo; CSS non valido dà `error: "invalid-selector"`. Una pagina senza receiver di Vault potrebbe non rispondere.

## Panels

```text
spec = { title?: string, description?: string, controls?: Control[],
         position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center",
         width?: "small" | "medium" | "large" | number,
         layout?: Layout, align?: "left" | "center" | "right", role?: Role }
Control = { id?: string, type?: string, label?: string, value?, disabled?: boolean,
            ariaLabel?: string, autoFocus?: boolean,
            align?: "left" | "center" | "right", layout?: Layout,
            width?: "full" | "auto" | number, height?: "auto" | number,
            ...type-specific fields below }
Layout = "vertical" | "compact" | "comfortable" | "spacious" | "inline" | "row"
       | "wrap" | "twoColumn" | "grid" | "split" | "form" | "toolbar" | "stack"
Role = "region" | "dialog" | "alert" | "status" | "form" | "group"
```

Valori predefiniti: posizione in basso a destra; layout verticale; allineamento a sinistra; role region; larghezza in base al contenuto. I preset sono 220/280/360px; la larghezza numerica del panel è limitata a 180–520px. La larghezza dei control è 32–520px e l'altezza 20–360px. Le dimensioni numeriche accettano anche pixel strings. Le varianti verticali cambiano la spaziatura; inline/row non vanno a capo; wrap/toolbar vanno a capo; twoColumn/grid/split/form usano griglie; stack riduce al minimo la spaziatura. Role fornisce semantica di accessibilità, non blocco modale.

Gli IDs sono normalizzati in ASCII letters/digits/`_`/`-` (max 80); scegli IDs univoci e stabili. Un control ID omesso diventa `control-N`; type omesso/sconosciuto diventa text. text/lists omessi sono vuoti; disabled è false. La chiamata `v.panel` sostituisce tutto lo spec. `value` omesso riutilizza l'ultimo event value del control, quindi applica la normalizzazione del type; `value` esplicito lo sovrascrive. Autofocus è false per impostazione predefinita. Fields sconosciuti vengono eliminati; colori/fonts/CSS forniti dalle regole non sono supportati.

Campi e valori dei controlli:

- `text`: string `text`; predefinito uguale a label. `html`: string `html`; rimuove scripts, event attributes, URL pericolosi e stili.
- `button`: `label`, `action: "submit" | "cancel" | "close"` facoltativo; value stringa (predefinito vuoto). Actions generano events; non inviano/chiudono automaticamente.
- `checkbox`, `toggle`: boolean `value` (predefinito false).
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; string value (predefinito vuoto). I valori option vuoti vengono rimossi; labels predefiniti uguali a value.
- `textInput`, `textarea`: string value (predefinito vuoto), `placeholder`; textarea `rows` 1–12 (predefinito 3).
- `numberInput`, `range`: numeric value (predefinito 0), `min`, `max`, `step` positivo. I values restano entro i limiti; limiti di normalizzazione non specificati: −1000000…1000000. I widget range vanno da 0…100 per impostazione predefinita; imposta limiti espliciti.
- `date`: string `YYYY-MM-DD`; `time`: string `HH:MM` o `HH:MM:SS`; formati iniziali non validi diventano vuoti. `color`: `#RRGGBB` (predefinito `#000000`).
- `pin`: stringa di cifre; `length` 3–12 (predefinito 6), `masked` true per impostazione predefinita, `autoSubmit` false. `section`: `text`, `controls`, layout/align/role facoltativi (role predefinito group); le child sections al depth 3 non hanno children (root controls depth 0).

Panel events: i controlli di input inviano `input`/`change` (text input cambia su blur/Enter; textarea su blur/Ctrl-or-Cmd+Enter). I controlli normali inviano anche `focus`, `blur`, `key`; i metadati key non vengono inoltrati alla regola. I buttons inviano `click` **e** l'action configurato come events separati: gestiscine uno solo. PIN invia `change` e `submit` quando autoSubmit è completo. Mount/unmount usa `controlId: ""`, `value: true`. `values` contiene i valori input correnti per ID; esclude buttons/text/HTML. Gli events non hanno tab ID di origine; usa panel IDs distinti per interazioni per-tab.

Limiti di testo: title/label/ariaLabel 240; description/text 1000; HTML 20000; placeholder 500; input text 2000; altre value strings 512; option value/label 256. L'eccesso viene troncato.

## Files

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`. Richiede **Cartella regole personalizzate** in Settings e la relativa autorizzazione. Safari usa il selettore di cartelle native e conserva un security-scoped grant; è disponibile solo la cartella scelta.

- `path` è relativo; `/` separa le directory. I segmenti consentono ASCII letters/digits, spazi e `_.,@()-`; niente punto iniziale, `.`/`..`, absolute path o URL. Estensioni: `.txt`, `.csv`, `.json` (senza distinzione maiuscole/minuscole). List path è una directory; `""` elenca la root scelta.
- Read restituisce testo UTF-8. Write sostituisce/crea; append crea/aggiunge senza newline automatico. Le directory genitore vengono create in scrittura. String payload viene scritto letteralmente; altri payload JSON vengono serializzati; null/omesso significa testo vuoto. Il parsing JSON/CSV spetta alla regola. Dimensione massima file: 1048576 UTF-8 bytes.
- List restituisce le sottodirectory e i file supportati visibili immediatamente. Entries: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; sui file extension include il punto. Exists restituisce boolean per un file supportato.

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

I result fields inutilizzati sono null; in caso di successo error è vuoto. Gli errori includono invalid-path, unsupported-file-type, permission/folder unavailable, missing file e file-too-large. Considera error una stringa, non un enum esaustivo fisso. Le richieste non garantiscono transazioni/ordine; serializza le operazioni read-modify-write per path.

## Limiti

Per evento e gruppo: 256 azioni in coda, 200 chiamate di log, 64 emissioni; l’eccesso viene scartato. Per regola: 1000 handler, 24 pannelli; ogni elenco di controlli ha 32 voci e ogni selezione 64 opzioni; l’eccesso viene ignorato/troncato. Le catene di emissioni si fermano dopo 16 generazioni. Limite dello stato serializzato: 65536 byte UTF-8. Mantieni la registrazione e gli handler combinati di ogni evento sotto 1 secondo; superamenti ripetuti o un timeout rigido fermano il gruppo fino a Run. Il Log conserva 200 voci, accetta 50 chiamate al secondo per gruppo e tronca i messaggi lunghi intorno a 4096 caratteri. Timer/risposte sono forniti al meglio delle possibilità, senza garanzie in tempo reale.

## Regola completa

Pausa di cinque minuti, avviata da Snooze o dal suo pulsante panel:

```javascript
(on, v) => {
  v.state.pauseUntil ??= 0;
  const pause = ev => { v.state.pauseUntil = ev.now + 300000; };
  v.panel("pause", { controls: [{ id: "pause", type: "button", label: "Pause 5 min" }] });
  on("snooze", pause);
  on("panel", ev => {
    if (ev.data.panelId === "pause" && ev.data.controlId === "pause" && ev.data.eventName === "click") pause(ev);
  });
  on("tick", ev => {
    for (const tab of ev.data.tabs) {
      if (/^https?:\/\/(www\.)?youtube\.com(?:\/|$)/i.test(tab.url)) v.cover(tab.tabId, ev.now >= v.state.pauseUntil);
    }
  });
}
```


## Chiamate IA da una regola in esecuzione

Ogni custom group sceglie una connessione/modello e reasoning effort in **AI calls**. Le regole Mac e browser usano la stessa API; le richieste browser richiedono Mac Vault collegato e le credenziali provider restano lì. I gruppi collegati condividono la selezione e un limite giornaliero facoltativo. Campo vuoto significa nessun limite di gruppo, ma restano i limiti account. Il limite usa il giorno UTC, persiste al riavvio e conta i tentativi inviati inclusi quelli falliti. Link combina l’uso già fatto; unlink mantiene l’uso precedente.

Prompt e contesto salvati sono condivisi dai gruppi collegati e disponibili nei handler come `v.context.ai.prompt` e `v.context.ai.context`. Vault non li invia automaticamente; la regola sceglie cosa includere in ogni chiamata `v.ai`.

`v.ai({ prompt, input? })` restituisce subito un request ID. Chiamala dentro un handler, non durante la registrazione della regola. `input` può essere qualsiasi valore JSON; prompt/input sono limitati a20KB ciascuno. Le risposte arrivano come eventi `ai` events: `. Success text is at most48KB; citations are ` `ask` `note`: {requestId, ok, text, citations, error}. Testo riuscito massimo48KB; citazioni {url,title}. Mantieni visibili e cliccabili i link alle fonti nelle risposte della ricerca Web. Search è sempre disponibile al modello. Nessuna deadline fissa dell’app, concorrenza limitata, nessun fallback provider o retry automatico. Le risposte sono dati, non vengono eseguite come JavaScript; la regola decide quali azioni esistenti intraprendere.

```javascript
(on, v) => {
  let pending = null;
  on("panel", ({ data }) => {
    if (data.controlId !== "ask" || pending) return;
    pending = v.ai({ prompt: v.context.ai.prompt || "Summarize this text.", input: {context:v.context.ai.context, note:data.values?.note ?? ""} });
  });
  on("ai", ({ data }) => {
    if (data.requestId !== pending) return;
    pending = null;
    if (!data.ok) { v.log("AI request failed:", data.error); return; }
    v.log(data.text, data.citations);
  });
}
```

Le chiamate pendenti non vengono riprodotte dopo il riavvio. Run, disabilita/riabilita ed elimina scartano risposte obsolete; un browser disconnesso segnala `ai-unavailable`. Altri errori: `ai-not-configured`, `ai-invalid-input`, `ai-busy`, `ai-daily-limit`, `ai-request-failed`, `ai-usage-storage-unavailable`. Le chiamate fallite non sovrascrivono un risultato precedente conservato dalla regola. Il limite di stato resta64KB.

Scopri opzioni senza credenziali con `rule_ai_models` su Mac o `settings-rule-ai-models` nel browser; configura `ruleAI` tramite il percorso set-group esistente. Campi: `providerModel`, `accountID`, `reasoningEffort` (`default`, `low`, `medium`, `high`) e `dailyRequestLimit` (null o1–100000). Usa una scelta restituita; non inserire chiavi o URL provider nel sorgente della regola.
I campi salvati facoltativi sono `prompt` e `context`, stringhe fino a16KB ciascuno.

## Record del gruppo

`v.store(request)` avvia un’operazione asincrona di record JSON dentro un handler. I record sono privati del gruppo, persistono dopo Run e riavvio, e vengono eliminati con il gruppo. I gruppi collegati hanno store distinti. La regola sceglie chiavi, valori, versioni, invalidazione cache e priorità dei feedback. Le regole Mac e browser usano la stessa API, ma ogni app/browser ha uno store separato.

| Request | Result |
|---|---|
| `{op:"get", key}` | `record` o `null` |
| `{op:"put", key, value, version?, ifRevision?}` | `record` salvato |
| `{op:"delete", key, ifRevision?}` | `record: null` |
| `{op:"list", prefix?, after?, limit?}` | `entries` ordinate e `next` |
| `{op:"clear", prefix?}` | conteggio `deleted` |

Ogni record è `{value, revision, version, updatedAt}`. revision opaco cambia con una scrittura reale; `version` è metadato scelto dal chiamante. `list` restituisce header senza valori; usa `get` per leggerne uno e `after: next` `put` `delete` per la pagina successiva. Senza `ifRevision`, put/delete sono incondizionati; `null` richiede chiave assente e una stringa revision una corrispondenza esatta. Un conflitto restituisce `ok:false`, `error:"store-conflict"` e il `record` attuale, evitando che una risposta automatica tardiva sovrascriva il feedback utente. `v.context.revision` è un marker opaco della configurazione che la regola può includere nella propria versione; il framework non impone politiche cache.

Limiti: chiave 1–2048 caratteri, version ≤128, valore JSON ≤64KiB, profondità ≤32, 10000 chiavi per gruppo e documento completo16MiB. `list` restituisce al massimo100 header e96KiB per pagina. Massimo32 richieste per gruppo e128 avvii al secondo complessivi; overload segnala un `store-busy` per gruppo al secondo e scarta le altre richieste. Errori di storage restituiscono `ok:false`; un documento futuro o malformato viene conservato e segnala `store-unavailable`. Nessun retry o eviction automatici; usa ticks per le deadline.

## Allegati di contenuto salvati

`v.attach(tabId, item, id, spec)` salva un pill o una vista HTML/CSS passiva per un elemento osservato. Passa l’`item` completo di un evento `items` o `attachment`; il solo `ref` non è un handle di allegato. `contentId` identifica il contenuto salvato e `instanceId` la sua presenza attuale. Conserva l’handle originale durante l’attesa di AI. Vault rifiuta allegati tardivi per destinazioni rimosse, riutilizzate o navigate. `v.item(tabId, ref, verdict)` resta indipendente.

Per un pill, `spec` è `{type:"pill", text, tone?, tooltip?}`; i toni sono `blue`, `cyan`, `gold`, `pink` o `red`. Testo semplice fino a 240 caratteri, tooltip fino a 1000. Per una vista, spec è `{type:"html", html, css?, label?}`. Limiti: HTML 32000 caratteri, CSS 16000, label 200. La vista viene ricostruita da HTML/SVG passivo consentito, in uno shadow root chiuso con CSS circoscritto. Script, attributi evento, risorse remote, embed e CSS non sicuro vengono rimossi. La vista resta nella scheda contenuto e scorre a 480px di altezza. Gli ID usano 1–80 lettere/numeri ASCII, _ o -. Un spec null rimuove il pill del gruppo. Chiama dentro un handler; errori di persistenza/consegna compaiono in Log e non vengono ritentati automaticamente.

Ogni elemento espone gli allegati di questo gruppo come snapshot di sola lettura in `item.attachments`; quelli degli altri gruppi non sono inclusi. Se i dati salvati non sono disponibili, `attachments` è null e `attachmentError` è impostato: non significa che la cache sia vuota. Gli altri handler proseguono. Usa l’esempio per non richiedere di nuovo AI per contenuti con un risultato salvato.

L’attivazione con puntatore, Enter o Space genera un evento `attachment` per il gruppo. I pill inviano `click`. I controlli della vista usano `data-control` o `id` come `controlId` e inviano `click`, `input` o `change`, con il `value` corrente e `values` limitati dei controlli nominati. Gli eventi UI reali hanno `ev.origin === "user"`; quelli generati dalla regola hanno `origin === "rule"`. Includono `tabId`, `attachmentId` e l’`item` corrente. La vista non esegue codice della regola; pill e viste impediscono che l’interazione navighi la scheda sottostante. I dati salvati non contengono callback o codice eseguibile. Una revisione pill obsoleta non può richiamare un allegato attuale. Gli emit della regola restano logica normale; il browser convalida separatamente i veri messaggi di clic UI.

Gli allegati sono salvati nel profilo browser per gruppo/contenuto/ID e ricompaiono in occorrenze successive, navigazione, riavvio browser e Run. Disable li nasconde mantenendo i dati; enable li ripristina. Eliminare il gruppo elimina gli allegati. I gruppi collegati restano separati; nessuna sincronizzazione automatica tra browser/dispositivi. I contenuti riconosciuti di YouTube, Reddit, X e Bilibili usano ID piattaforma. Gli altri usano un URL normalizzato con cautela, quindi la disponibilità dipende dal markup supportato.

Limiti: 8 allegati per gruppo/contenuto, 32 per elemento tra tutti i gruppi, 10000 voci contenuto per gruppo e documento allegati serializzato di 8MB. Al limite, la nuova modifica viene rifiutata con `attachment-item-limit` o `attachment-storage-limit` nel Log; i dati esistenti sono conservati. Un dispatch raggruppa le scritture; spec identici non riscrivono lo store. Gli allegati sono UI di contenuto browser, incluso il motore nativo delle regole Safari. Le regole dell’app Mac non hanno handle di contenuto browser né una superficie allegati nell’app.

```javascript
(on, v) => {
  on("items", ({data}) => {
    for (const item of data.items) {
      if (item.attachments && !item.attachments.note) {
        v.attach(data.tabId, item, "note", {
          type: "pill", text: "Review this", tone: "blue"
        });
      }
    }
  });
  on("attachment", ({data}) => {
    if (data.attachmentId === "note") {
      v.log("Review clicked", data.item.contentId);
    }
  });
}
```

`code-manual/generic-example.js` è un esempio di policy eseguibile. Usa record, chiamate AI, feedback dell’utente, compare-and-swap, controlli HTML, verdict degli item e un report d’uso gestito dalla regola; questi comportamenti sono nel codice d’esempio, non sono caratteristiche speciali dello store.
