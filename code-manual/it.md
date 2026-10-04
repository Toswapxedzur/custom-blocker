# Manuale del codice dell'estensione browser Vault

[Manuale utente](../manual/it.md)

## Contratto della regola

Source: una sola espressione di funzione `(on, v) => { ... }`. Sono supportati solo JavaScript sincrono e l'API seguente; niente timers, network, extension APIs o accesso diretto al DOM. Le regole basate sul tempo usano `ev.now` ed events.

- Le modifiche salvano una bozza; **Run** attiva la regola e abilita il gruppo. I gruppi congelati non possono eseguire Run. Una source vuota scarica la regola.
- Un Run riuscito sostituisce handlers e panels, mantenendo `v.state`. Se compilazione/registrazione fallisce, resta la regola precedente; un timeout può interromperla. Quando il motore si ricarica, registra di nuovo l'ultima source attivata; le closure variables vengono azzerate.
- La registrazione può inizializzare state, registrare handlers, mostrare panels e scrivere log. Azioni sulla pagina/file ed emits vanno inseriti negli handlers; la coda creata durante la registrazione viene scartata.
- Disable sospende gli handlers e rimuove panels, sheets, covers e verdetti sugli elementi gestiti. Enable ripristina panels/sheets conservati e richiede di nuovo gli elementi. Run non cancella sheets, covers o verdetti esistenti. Delete rimuove regola, state ed effetti. Navigazione, modifiche DOM e scritture di file non vengono annullate.
- Gli events non sono limitati ai normali obiettivi del gruppo; filtra URLs/items nella regola. Gli actions vengono messi in coda e applicati dopo il dispatch. Le eccezioni interrompono quell'handler senza ripristinarne state/actions; gli handlers successivi possono ancora funzionare. Solo gli events file/query confermano un action.

## API condivisa

- `on(type, handler)` → boolean. Registra `handler(ev)`; più handlers vengono eseguiti nell'ordine di registrazione. False indica argomenti non validi o limite degli handlers raggiunto. `ev = { type: string, now: number, data }`; `now` è Unix in millisecondi.
- `v.state`: oggetto JSON modificabile e salvato dopo l'event dispatch. Inizializza i fields mancanti invece di sovrascrivere lo state esistente. Assegnare un non-object o un array lo reimposta a `{}`; aggiornamenti non serializzabili/troppo grandi non vengono salvati.
- `v.log(...values)`: unico modo per scrivere nel Log del gruppo. Logs/Clear sono indipendenti per gruppo. Gli errori di caricamento appaiono nello stato Run; i diagnostici degli handlers non popolano Log.
- `v.emit(type, data)`: mette in coda una copia JSON di `data` per gli handlers del gruppo dopo l'event corrente, con un nuovo `now`; non è una chiamata sincrona.
- `v.panel(id, spec, tabId?)`: sostituisce il panel nominato del gruppo; ometti `tabId` per tutte le pagine web accessibili oppure usa un tab ID intero. `spec` null rimuove il panel. Vedi Panels.
- `v.file(op, path, payload?)` → stringa request ID. Vedi Files.

Le altre chiamate condivise restituiscono `undefined`. IDs/state appartengono al gruppo, non al suo nome visualizzato.

## Browser events

La notazione del payload descrive i tipi, non è codice eseguibile. `?` indica fields facoltativi.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` è approssimativo; usa timestamps, non il conteggio dei tick. `active` indica una pagina selezionata in una finestra browser, non dimostra che l'utente la stia guardando. URLs possono essere vuote o limitate.
- `visible` proviene da pagine accessibili e non nascoste; `elapsedMs` è il tempo dall'ultimo heartbeat e vale zero quando la pagina è coperta. Non è uso accumulato né tempo di riproduzione.
- `items` segnala nuovi elementi feed supportati o modificati e li reinvia dopo Run/riattivazione. `ref` identifica una scheda nella pagina, non un content ID permanente; `ref === "page"` indica la pagina stessa. Titoli/URLs/autori possono essere vuoti. `authors` contiene source identifiers specifici della piattaforma.
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

Per event per group: 256 queued actions, 200 log calls, 64 emits; l'eccesso viene scartato. Per rule: 1000 handlers, 24 panels; ogni control list ha 32 entries e ogni choice 64 options; l'eccesso viene ignorato/troncato. Le emit chains si fermano dopo 16 generazioni. Serialized state limit: 65536 JavaScript string characters. Mantieni registration e handlers combinati di ogni event sotto 1 secondo; superamenti ripetuti o hard timeout fermano il gruppo fino a Run. Log conserva 200 entries, accetta 50/sec per gruppo e tronca messaggi lunghi intorno a 4096 caratteri. Timers/replies sono best-effort, non garanzie real-time.

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
