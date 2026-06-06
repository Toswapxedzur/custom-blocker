# Web Blocker personalizzato: manuale di istruzioni

Questo è il manuale di riferimento completo per l'estensione. Inizia con i flussi di lavoro più semplici e comuni e passa gradualmente ad argomenti avanzati come le regole di blocco personalizzate basate sugli eventi e l'API di supporto.

Se sei nuovo, leggi **Avvio rapido** e **Panoramica dei gruppi di blocco**. Tutto ciò che è al di sotto di queste sezioni è facoltativo, a seconda di cosa vuoi fare.

---

## 1. Cosa fa questa estensione

Custom Web Blocker ti consente di bloccare siti Web e distrazioni online in base alle regole che definisci tu stesso. Puoi:

- Blocca immediatamente i siti con il blocco di rete nativo del browser (lo stesso tipo di blocco che produce `ERR_BLOCKED_BY_CLIENT`).
- Concediti un certo numero di minuti al giorno su un sito, quindi bloccalo una volta superato tale limite.
- Blocca tipi specifici di contenuti su Iutub, Tic Toc, Feisbuc, rete fotografica, dirette video e Rèddit (non sull'intero sito).
- Nascondi i contenuti bloccati dai feed sulle piattaforme supportate invece di bloccare solo singole pagine.
- Pianifica quando una regola è attiva per giorno della settimana e per finestre temporali `HHMM-HHMM`.
- Blocca una regola in modo da non poterla modificare facilmente. Il congelamento rigoroso lo blocca per un numero specificato di ore e richiede un rituale di conferma in 20 passaggi per essere annullato.
- Posticipare temporaneamente una regola, ma solo dopo aver scritto una giustificazione sufficientemente lunga.
- Scrivi regole personalizzate **guidate dagli eventi** in linguaggio di script con aiutanti per timer avanti/indietro, archiviazione persistente per gruppo, intenti DOM per piattaforma (nascondi pulsanti di navigazione, nascondi schede feed per predicato, imposta timer per sottosezione), utilità URL e registrazione strutturata.
- Scegli da una libreria integrata di oltre 50 modelli già pronti (timer, pianificazioni, occultamento dei feed, sessioni di focus, reindirizzamenti, solleciti, persistenza, modifiche DOM, aiutanti per il debug).
- Utilizza l'estensione in oltre 20 lingue.

L'estensione è un'estensione browser Cromo Manifest V3 con una pagina dell'editor (il popup), un operatore del servizio in background, un sandbox fuori schermo che ospita il codice delle regole personalizzate e uno script di contenuto eseguito in ogni pagina. Le regole personalizzate vivono nella sandbox fuori schermo; vengono caricati una volta per ogni clic su Esegui e rimangono registrati finché la regola non viene disabilitata o eliminata.

---

## 2. Panoramica dell'interfaccia utente

Quando fai clic sull'icona dell'estensione, l'editor si apre come una pagina Web completa (non un piccolo popup). La pagina ha queste aree:

- **Barra superiore**
  - Pulsante **Manuale di istruzioni** (questo documento)
  - Selettore **Lingua**
  - Attrezzatura **Impostazioni** (interruttori avanzati, inclusa la **modalità Debug**)
- **Pannello sinistro: gruppi di blocchi**
  - Elenco dei tuoi gruppi di blocco. Ogni scheda mostra il nome del gruppo, una breve riga di riepilogo e una casella di controllo abilita/disabilita.
  - Il pulsante **Aggiungi** crea un nuovo gruppo. Il menu a discesa accanto seleziona il tipo.
  - **Elimina tutto** rimuove ogni gruppo, con conferme aggiuntive se qualche gruppo è bloccato.
  - Puoi trascinare la maniglia `::` su una carta verso l'alto o verso il basso per riordinare i gruppi.
  - Puoi trascinare il divisore verticale per ridimensionare questo pannello.
- **Pannello destro: editor**
  - Modifica il gruppo attualmente selezionato: nome, comportamento di blocco, liste di blocco, filtri specifici del tipo, pianificazione, blocco, posticipazione.
  - Tutte le modifiche vengono salvate automaticamente una frazione di secondo dopo aver smesso di digitare o interagire.
  - Per i gruppi **Personalizzati**, l'editor mostra anche il browser **Modelli**, il pulsante **Esegui** e il pannello **Registro** (rinominato da *Registro attività* nella versione 1.1).
- **Toast** (popup centrato che svanisce): mostra messaggi di stato come "Modifiche salvate". o errori di input.
- **Sovrapposizione in-page**: mentre una scheda ha un timer o un blocco attivo, nell'angolo in alto a sinistra viene visualizzata una sovrapposizione che mostra tutti i vincoli che la influenzano nel formato `hh:mm:ss` (o `mm:ss`). Più vincoli si sovrappongono su più righe. I conti alla rovescia dei gruppi di blocco predefiniti e i timer delle regole personalizzate condividono questa sovrapposizione.

---

## 3. Avvio rapido1. Fare clic sull'icona dell'estensione. L'editor si apre come una pagina intera.
2. Nel pannello **Blocca gruppi**, scegli un tipo di gruppo dal menu a discesa:
   - `Default`, `Iutub`, `Tic Toc`, `Feisbuc`, `rete fotografica`, `dirette video`, `Rèddit` o `Custom`.
3. Fare clic su **Aggiungi**. Viene visualizzato un nuovo gruppo e l'editor lo apre.
4. Dagli un nome.
5. Compila i campi specifici del tipo (per `Default`, ciò significa l'elenco **Siti Web bloccati**).
6. Assicurati che la casella di controllo del gruppo nel pannello di sinistra sia attiva.
7. Visita uno dei siti elencati. Il blocco dovrebbe avere effetto immediato.

Questo è l’intero percorso felice. Il resto di questo manuale contiene solo opzioni aggiuntive.

> Quando premi **Esegui** su un gruppo personalizzato, la nuova regola si collega agli eventi **futuri** della pagina. Le schede già aperte continuano a eseguire la regola precedente finché non le ricarichi. Il popup mostra un promemoria in tal senso dopo ogni esecuzione riuscita.

---

## 4. Panoramica dei gruppi di blocchi

Tutto in questa estensione è organizzato come **gruppi di blocchi**. Un gruppo di blocchi è un set di regole:

- Ha un nome, un tipo e uno stato abilitato/disabilitato.
- Ha un comportamento di blocco (immediato, dopo un certo numero di minuti, o conto alla rovescia fisso).
- Dispone di una pianificazione opzionale (giorni + finestre temporali) e controlli di blocco/posticipazione opzionali.
- A seconda del tipo, dispone di campi aggiuntivi come un elenco di siti Web, filtri per creatori di Iutub, nomi di subreddit o una regola linguaggio di script basata sugli eventi.

Puoi avere un numero qualsiasi di gruppi. Più gruppi possono candidarsi alla stessa pagina; in tal caso prevale la regola **più rigorosa**:

- "Blocca immediatamente" è migliore di "blocca dopo un po' di tempo".
- Un gruppo con meno tempo rimanente batte un gruppo con più tempo rimanente.

Quindi l'aggiunta di più gruppi può solo creare un blocco di pagina prima, mai dopo.

**L'ordine di valutazione è dal basso verso l'alto.** Quando l'estensione esegue l'iterazione dei gruppi di blocchi, inizia con il gruppo in fondo all'elenco e procede verso l'alto. Il gruppo in cima all'elenco viene valutato per ultimo e ottiene l'"ultima parola": ad esempio, se un gruppo in basso chiama `helpers.getPlatformHelper().youtube().hideShortButton()` e un gruppo in alto chiama `showShortButton()`, il pulsante rimane visibile. Trascina la maniglia `::` su una carta per modificare questo ordine.

---

## 5. Tipi di gruppo

### 5.1 `Default`: blocca i siti Web ordinari

Per bloccare domini specifici (il caso d'uso tipico).

- **Siti Web bloccati**: un sito per riga. Funzionano sia `facebook.com` che `https://www.facebook.com/somepage`; l'estensione estrae e normalizza il nome host.
- Una regola del sito si applica a quel nome host e a tutti i suoi sottodomini.
- Questo tipo di gruppo utilizza il blocco di rete nativo di browser Cromo, simile a `ERR_BLOCKED_BY_CLIENT`. Ciò significa che la navigazione verso un URL bloccato viene interrotta prima ancora che la pagina venga caricata.

### 5.2 `Iutub`: blocca Iutub e siti di video simili

Aggiunge una sezione **Filtri** all'editor:

- **Tipo di contenuto**:
  - `Apply to all Iutub pages`: ogni pagina Iutub conta.
  - `Apply to Shorts`: contano solo le pagine di Short.
  - `Apply to long videos` — solo `/watch`, `/live/`, `/embed/`, ecc.
  - `Apply to Iutub posts`: post della community (`/post/...`, schede community/post del canale).
- **Filtro autore**:
  - `Do not filter by author`: l'identità dell'autore non ha importanza.
  - `Apply to certain authors`: solo gli autori elencati attivano questo gruppo.
  - `Apply to all except certain authors`: gli autori elencati sono esenti.
- **Autori**: un autore per riga. Accetta `@handle`, URL completi, `/channel/UC...`, `/c/...`, `/user/...`.
- **Nascondi le voci bloccate nel feed di Iutub**: mentre questo gruppo blocca attivamente, le schede corrispondenti nei feed di Iutub vengono nascoste. Quando il blocco diventa inattivo, ritornano al successivo aggiornamento.

Per i tipi di contenuto Short e Post, quando non è impostato alcun filtro autore e il gruppo è attualmente bloccato, l'estensione nasconde anche le voci di navigazione pertinenti (voce della barra laterale Short, schede canale Community/Post) e gli scaffali corrispondenti come "Ultimi post di Iutub".

Il rilevamento breve/lungo si estende ad altri siti video come Tic Toc, Vimeo, clip/VOD dirette video e Dailymotion quando è possibile rilevare il modulo della pagina.

### 5.3 `Tic Toc`: blocca i contenuti di Tic Toc

Stessa scheda editor dell'editor video della piattaforma, ma con etichette specifiche per Tic Toc:- Tipi di contenuto: brevi video, video, pagine del profilo.
- Autori: Tic Toc gestisce (`@handle`) o URL del profilo.
- Il feed hidden nasconde le carte corrispondenti sulle pagine Tic Toc mentre il gruppo è attivo.

### 5.4 `Feisbuc`: blocca i contenuti di Feisbuc

- Tipi di contenuto: Reels, video, post.
- Autori: nome della pagina (`page.name`), URL del profilo o modulo `profile.php?id=...` (l'ID numerico viene conservato come `id:<number>`).
- Il feed hidden nasconde le schede feed corrispondenti su Feisbuc.

### 5.5 `rete fotografica`: blocca i contenuti di rete fotografica

- Tipi di contenuto: Reels, video, post.
- Autori: handle di rete fotografica o URL del profilo.
- I percorsi riservati come `/reel/`, `/p/`, `/tv/`, `/explore/` non sono trattati come autori.
- Il feed hidden nasconde le carte corrispondenti su rete fotografica.

### 5.6 `dirette video`: blocca i contenuti di dirette video

- Tipi di contenuti: clip, stream/VOD, pagine canale.
- Autori: nomi di canali o URL di canali.
- I percorsi riservati come `/directory`, `/videos`, `/settings`, ecc. non vengono trattati come nomi di canali.
- Feed hidden nasconde le carte corrispondenti su dirette video.

### 5.7 `Rèddit`: blocca Rèddit o subreddit specifici

- **Subreddit**: un subreddit per riga. L'elenco vuoto significa che il gruppo si applica a tutto Rèddit. Sono accettati sia `productivity` che `r/productivity`.

### 5.8 `Custom`: blocco tramite linguaggio di script basato sugli eventi

Scrivi una funzione linguaggio di script che **registra i gestori** per eventi quali apertura della pagina, modifica dell'URL, heartbeat della pagina, fine del timer ed eventi personalizzati. La funzione viene eseguita una volta per ogni clic su Esegui; i gestori registrati rimangono attivi durante le navigazioni finché non premi nuovamente Esegui, disabiliti il ​​gruppo o lo elimini.

I gruppi `Custom` non mostrano: comportamento di blocco, siti bloccati, minuti consentiti, intervallo di reimpostazione, giorni di pianificazione o finestre temporali. Mantengono l'editor delle **Regole di blocco** oltre ai controlli di blocco/posticipazione standard. C'è anche un pulsante **Modelli** che apre un browser preimpostato con regole iniziali parametrizzate; l'applicazione di una preimpostazione sostituisce la regola corrente dopo la conferma.

Consulta la **Sezione 11** per il riferimento completo alle regole personalizzate e all'API helper.

---

## 6. Comportamento bloccante

Per la maggior parte dei tipi di gruppo scegli una delle tre modalità.

### 6.1 Blocca immediatamente

La regola è attiva ogni volta che il gruppo è attivo, la pianificazione lo consente e (per i gruppi sulla piattaforma) la pagina corrisponde.

Per i gruppi `Default` viene utilizzato il blocco nativo di browser Cromo. Per i gruppi di piattaforme utilizza la logica di overlay/uscita in-page.

### 6.2 Blocco dopo un certo numero di minuti

Questo è un budget di utilizzo.

- **Minuti consentiti prima del blocco** (decimale): quanti minuti ti concedi per periodo. Esempio: `15`, `0.5`, `90`.
- **Intervallo di reimpostazione del timer (ore)** (decimale): quanto spesso il budget si reimposta. Esempio: `24` per giornaliero, `1` per orario, `0.25` per ogni 15 minuti.

Finché hai tempo a disposizione, la pagina funziona normalmente e mostra la sovrapposizione del timer. Quando il budget raggiunge lo zero, la pagina viene bloccata per il resto del periodo e l'overlay mostra `0:00`, quindi la scheda tenta di uscire.

L'estensione è per gruppo, per periodo:

- Ogni gruppo ha il proprio budget.
- Il tempo trascorso su qualsiasi pagina che corrisponde al gruppo viene conteggiato nel budget di quel gruppo.
- Più schede nello stesso gruppo condividono il budget. I loro timer rimangono sincronizzati; anche il passaggio a un'altra scheda forza un aggiornamento in modo da mostrare immediatamente l'ora condivisa corrente.

Se più gruppi a tempo limitato si applicano alla stessa pagina, vince quello più rigoroso.

### 6.3 Timer (conto alla rovescia, quindi blocco)

Questa modalità mostra un timer per il conto alla rovescia e si blocca una volta raggiunto `0:00`.

- **Intervallo di ripristino del timer (ore)** (decimale): sia la durata del timer che la frequenza di ripristino. Esempio: `24` per giornaliero, `1` per orario, `0.25` per ogni 15 minuti.

A differenza del **Blocca dopo un certo numero di minuti**, questa modalità **non** ha un campo separato "Minuti consentiti prima del blocco". Il timer si avvia semplicemente all'intervallo di ripristino, esegue il conto alla rovescia mentre le pagine corrispondenti sono aperte, quindi si blocca fino al ripristino successivo.I conti alla rovescia del gruppo predefinito e i timer del gruppo personalizzato (vedere **Sezione 11.3.1**) entrambi **avanzano solo mentre la scheda è visibile**. Passando da una scheda all'altra, riducendo a icona la finestra o bloccando lo schermo, il conto alla rovescia viene messo automaticamente in pausa.

---

## 7. Programma

Nella scheda **Programma** puoi limitare il momento in cui un gruppo è attivo:

- **Giorni da bloccare**: scegli i giorni a cui si applica il gruppo. I giorni non selezionati indicano che il gruppo è inattivo quel giorno.
- **Finestre temporali**: elenco in formato libero, una finestra per riga in formato `HHMM-HHMM`, ad esempio:

  ```
  0900-1000
  1200-1300
  ```

  Il gruppo è attivo solo all'interno di quelle finestre. L'elenco vuoto significa tutto il giorno.

Questo vale per tutti i tipi di gruppo tranne `Custom`. (Le regole personalizzate possono implementare la propria pianificazione utilizzando `ev.time.dayName` / `ev.time.hour`; vedere **Sezione 11.4**.)

---

## 8. Blocco (anti-manomissione)

Il congelamento rende difficile disattivare un gruppo d'impulso.

Nella scheda **Blocca** scegli:

- **Frozen**: non puoi modificare o eliminare il gruppo e non puoi deselezionare la sua attivazione/disattivazione. Per modificare qualcosa è necessario eseguire il rituale di sblocco (vedi sotto).
- **Rigorosamente congelato**: come Frozen, ma rimane bloccato per un numero di ore da te scelto (decimale, fino a 72). Fino alla scadenza del timer, anche il rituale di sblocco non sarà disponibile.

Quando un gruppo bloccato è sbloccabile, viene visualizzato il pulsante **Sblocca**. Cliccandolo si avvia il **rituale in 20 passaggi**:

- La modale mostra un messaggio di autodisciplina.
- È necessario fare clic su `Confirm` 20 volte.
- Tra un clic e l'altro è prevista un'attesa forzata di 5 secondi.
- Se annulli in qualsiasi momento, devi ricominciare dal passaggio 1.
- I 20 messaggi ruotano in modo che tu possa effettivamente leggerli.

Se il gruppo è contrassegnato anche come "no snooze" (vedere la sezione successiva), non è possibile posticiparlo neanche mentre è congelato.

Lo stato di congelamento viene mostrato nella riga meta della scheda di gruppo, compreso il tempo rimanente per il congelamento rigoroso.

---

## 9. Posticipa (disabilita temporaneamente)

La funzione Snooze disabilita temporaneamente un gruppo senza sbloccarlo. Supporta l'attivazione ritardata, il tempo di recupero post-snooze, i passaggi di conferma e un totale parziale del tempo posticipato.

Nella scheda **Posticipa**:

- **Consenti posticipazione per questo gruppo**: se disattivato, questo gruppo non può essere posticipato affatto (anche se congelato).
- **Posticipa per (minuti)**: decimale, quanto dura la posticipazione.
- **Ritardo di attivazione (minuti)** — decimale `>= 0`. Dopo aver confermato la posticipazione, il gruppo continua a bloccarsi finché questo ritardo non è trascorso; solo allora lo snooze diventa attivo.
- **Recupero dopo la posticipazione (minuti)**: decimale da `0` a `5`. Al termine della posticipazione, non puoi avviarne un'altra per questo gruppo fino al termine del tempo di recupero.
- **Tempi di conferma** — intero `>= 0`. Se è `0`, la posticipazione viene programmata immediatamente. Altrimenti, l'avvio della funzione snooze avvia un rituale di conferma con esattamente lo stesso numero di passaggi.

Ogni passaggio di conferma della posticipazione prevede un'attesa forzata di **5 secondi** prima che venga consentito il clic successivo. Il modale te lo dice esplicitamente e mostra il conto alla rovescia in tempo reale sul pulsante.

Se il gruppo è congelato, le impostazioni di ripetizione sono bloccate sui valori scelti prima del blocco. Puoi comunque posticiparlo, purché sia ​​consentito, ma devi utilizzare le impostazioni di ritardo/ricarica/conferma salvate.

La scheda Posticipa mostra anche il **Tempo totale posticipato** per quel gruppo. Questo totale conta l'intera durata della posticipazione attiva anche se il sito diventa raggiungibile per qualche altro motivo durante quella finestra.

Al termine della ripetizione, la regola ritorna immediatamente. Se il gruppo non era già bloccato, l'interno lo congela nuovamente automaticamente al termine della ripetizione.

Un messaggio di stato conferma la ripetizione. Al termine della ripetizione, il gruppo torna automaticamente alla normalità.

Puoi anche terminare anticipatamente una posticipazione con il pulsante **Termina posticipazione**.

Per i gruppi personalizzati, premendo **Avvia posticipo** si invia anche un evento `snoozePress` nella regola (vedere la tabella degli eventi nella **Sezione 11**), in modo che una regola personalizzata possa registrare la stampa, registrare una giustificazione o attivare eventi di follow-up. La regola **non ha API di posticipo programmatico**: può reagire alla stampa, ma non può annullarla o estenderla.

---

## 10. Azioni collettive- **Elimina tutto** rimuove tutti i gruppi.
  - Chiede sempre conferma.
  - Se almeno un gruppo viene congelato, è necessario lo stesso rituale in 20 passaggi dello scongelamento.
  - Se un gruppo è bloccato e ancora bloccato, **Elimina tutto** è disabilitato.

---

## 11. Gruppi personalizzati: riferimento basato sugli eventi (v1.1+)

A partire dalla versione 1.1, le regole personalizzate sono **guidate dagli eventi**. La tua regola non è più una funzione per heartbeat il cui valore restituito blocca la pagina. Invece, il corpo della regola è uno script che **registra i gestori** per eventi specifici (apertura della pagina, modifica dell'URL, heartbeat della pagina, eventi personalizzati,...). I gestori rimangono registrati durante la navigazione delle pagine e i cambi di scheda e vivono all'interno di una **sandbox offscreen** di lunga durata.

Il corpo della regola viene eseguito **una volta per ogni clic su Esegui** (o una volta quando il gruppo è abilitato ed esiste già un'origine attiva). Per ricaricare i gestori, fai clic su **Esegui** nell'editor. Il popup mostra un promemoria che ti chiede di ricaricare qualsiasi pagina già aperta in modo che la nuova regola venga applicata anche lì.

### 11.1 Firma delle regole

ZXQCODICE1ZXQ

Due argomenti:

- `event`: il **registro eventi** per questo gruppo. Utilizzalo per registrare, sovrascrivere, elencare, contare o annullare la registrazione di gestori e per eventi personalizzati `post(...)`.
- `helpers` — il bundle di supporto (vedere **11.3**).

Si prevede che la funzione **non** restituisca un valore. La decisione di bloccare o consentire viene presa in seguito, quando si attiva un evento e uno dei gestori registrati chiama `ev.preventDefault()` e/o `ev.setResult(...)`.

### 11.2 Ciclo di vita

- **Esegui** (pulsante per gruppo nell'editor): il motore cancella prima ogni gestore precedentemente taggato con questo gruppo, quindi esegue nuovamente il corpo della regola nella sandbox fuori schermo. Questo è l'unico modo per registrarsi nuovamente dopo aver modificato la fonte.
- **Disabilita gruppo**: ogni gestore taggato con questo gruppo viene cancellato. L'origine del gruppo viene mantenuta in archivio ma smette di rispondere agli eventi.
- **Riattiva gruppo**: il motore riesegue automaticamente la sorgente attiva per questo gruppo.
- **Elimina gruppo**: equivale a disabilitare; tutti i gestori taggati con il gruppo verranno cancellati.
- **Nuova registrazione con lo stesso `(eventType, id)`**: sovrascrive silenziosamente la registrazione precedente.

La sandbox fuori schermo è condivisa da **tutti** i gruppi personalizzati. Qui coesistono gestori di gruppi diversi, ciascuno taggato internamente con il proprio ID gruppo proprietario in modo che "Esegui", disabilita o elimina tocchi solo il gruppo giusto.

Se una regola personalizzata si comporta in modo anomalo (loop infinito sincrono, spam di log fuori controllo, ecc.) la sandbox la mette in quarantena: il gruppo viene disabilitato automaticamente e l'errore viene registrato in modo da poterlo vedere nel pannello Log. Per riattivare una regola in quarantena, correggi l'origine e fai clic su **Esegui**: il motore cancella il motivo dell'interruzione e ricarica la regola.

### 11.2.1 Il registro degli eventi (`event`)

Metodi generici:

- `event.register(type, id, handler, options?)`: registra un gestore per un tipo di evento arbitrario. `id` è la tua scelta. `options.priority` (predefinito `0`) — viene eseguito prima il valore più alto. `options.intervalMs` — solo per `tickEvent`; limitare questo gestore specifico rispetto al segno di spunta globale. La nuova registrazione con le stesse priorità `(type, id)`.
-`event.unregister(type, id)`, `event.unregisterAll(type)`.
- `event.post(type, data?, { scope })`: attiva un evento personalizzato. `scope: "global"` raggiunge ogni gruppo; predefinito `scope: "group"` raggiunge solo i gestori nello **stesso** gruppo.

Zucchero per tipo di evento (un set di metodi per tipo integrato):

-`event.registerTickEvent(id, handler, opts)`, `event.getTickEvent(id)`, `event.getTickEvents()`, `event.countTickRegistered()`.
-`event.registerOpenWebEvent(id, handler, opts)`, `event.getOpenWebEvent(id)`, `event.getOpenWebEvents()`, `event.countOpenWebRegistered()`.
- Stessa forma per `closeWebEvent`, `switchWebEvent`, `switchDomainEvent`, `webChangedEvent`, `pageHeartbeatEvent`, `timerEnded`, `snoozePress`.

### 11.2.2 Tipi di eventi incorporati

| Digitare | Quando spara | Carico utile `ev.data` |
|---|---|---|
| `tickEvent` | Tick ​​di 1 secondo condiviso a livello globale nell'intero browser. Si attiva indipendentemente dalla visibilità della scheda. Usalo per la logica in stile orologio che deve continuare a funzionare anche quando nessuna scheda è focalizzata. | `{ intervalMs: 1000 }` |
| `pageHeartbeatEvent` | ~250 ms di battito cardiaco dalla scheda **attiva**, **visibile**. Gestisce tutta la logica sensibile alla visibilità delle schede, incluso il segno di spunta automatico integrato in `getOrCreateTimer({ scope })`. **Non** si attiva dalle schede in background o mentre lo schermo è bloccato. | `{ elapsedMs }` |
| `openWebEvent` | Viene creata una nuova scheda OPPURE una nuova navigazione arriva a un URL che il motore non ha ancora visto per quella scheda. **Non** si riattiva per le schede già aperte dopo un clic su Esegui. | `{ previousUrl, isNewTab }` |
| `closeWebEvent` | Una scheda è chiusa. | `{ reason, nextUrl }` |
| `switchWebEvent` | L'URL **cambia** all'interno della stessa scheda: avanti/indietro, modifica del percorso SPA o navigazione che arriva a un URL diverso rispetto a prima. **Non** si attiva con una semplice ricarica (stesso URL). | `{ previousUrl, previousHostname, sameDomain }` |
| `switchDomainEvent` | La modifica dell'URL supera il limite del nome host (ad esempio `youtube.com` → `wikipedia.org`). Spara insieme a `switchWebEvent`. | `{ previousUrl, previousHostname }` |
| `webChangedEvent` | La pagina (ri)si carica in qualsiasi modo: apertura, cambio, aggiornamento della cronologia SPA, **o un semplice ricaricamento che mantiene lo stesso URL**. Questo è l'affidabile hook "la pagina è cambiata, rivaluta tutto". Si attiva insieme a `openWebEvent` / `switchWebEvent` / `switchDomainEvent` ed è l'unico che si attiva per ricaricamenti dello stesso URL. | `{ previousUrl, previousHostname, sameDomain, isFirstLoad, isReload, transition }` dove `transition` è `"tabCreated"`, `"commit"` o `"history"` |
| `timerEnded` | Un timer gestito dal gruppo raggiunge `currentMs === 0`. Consegnato solo al gruppo proprietario. | `{ timerId, displayName, direction, currentMs }` |
| `snoozePress` | L'utente ha premuto **Avvia posticipazione** nel popup per questo gruppo **personalizzato**. Evento di notifica puro: il gestore può eseguire codice arbitrario (registrazione, reindirizzamento, attivazione di altri eventi) ma le regole personalizzate **non hanno API di posticipazione programmatica**. I registri prodotti qui vengono visualizzati come toast nella scheda attiva. Consegnato solo al gruppo pressato. | `{ triggeredAt }` |

Gli URL in `ev.url` e nei dati degli eventi sono **normalizzati** per gli eventi: la pagina Nuova scheda di browser Cromo (che esegue il rendering della superficie "Cerca in Google o digita URL") di Google), `about:blank` e gli schemi newtab equivalenti vengono esposti come stringa vuota `""`. Pertanto, un timer con ambito `ev.url === ""` funziona solo mentre ti trovi nella pagina nuova scheda. Gli URL `google.com` regolari rimangono invariati.

### 11.2.3 L'oggetto evento (`ev`)

Ogni gestore viene richiamato come `(ev, helpers) => void`. `ev` trasporta:

- `ev.type`: il tipo di evento inviato.
- `ev.groupId`: l'ID del gruppo ricevente.
- `ev.tabId`, `ev.pageId`, `ev.url`, `ev.hostname`: contesto per l'evento.
- `ev.time`: istantanea `{ now, month, dayOfMonth, dayName, hour, minute }` alla spedizione. `dayName` è `"Sunday"`..`"Saturday"`.
- `ev.data`: carico utile specifico dell'evento (vedere la tabella sopra).

Metodi:

- `ev.preventDefault()`: contrassegna l'invio come "bloccato". Lo script del contenuto dell'host uscirà dalla pagina (o seguirà `setRedirectLink`) a meno che un gestore con priorità più alta non imposti successivamente `setResult(1)`.
- `ev.stopPropagation()`: interrompi immediatamente l'invio. **Nessun ulteriore gestore in nessun gruppo** viene richiamato per questo evento.
- `ev.setResult(value)`: imposta il risultato dell'invio. `value` può essere un **numero** in `[-255, 255]` (blocco `-1`, `0` neutro, `1` consentito; altri numeri interi vengono conservati per la propria logica di debug) o una **stringa** (interpretata come URL di reindirizzamento). Vince l'ultima chiamata `setResult` tra tutti i gestori. Uno `1` numerico sovrascrive qualsiasi `preventDefault` precedente.
- `ev.setRedirectLink(url)` / `ev.getRedirectLink()`: l'URL a cui l'host deve accedere quando l'invio termina come bloccato. Questo è l'**unico** modo per reindirizzare dalle regole personalizzate; l'editor non espone più il campo "URL di reindirizzamento quando bloccato" per i gruppi personalizzati.
- `ev.post(type, data, { scope })`: attiva un evento di follow-up dall'interno di un gestore.

Inoltre, `ev` è un proxy: qualsiasi campo impostato su di esso (ad esempio `ev.foo = 42`) viene memorizzato in una mappa `custom` e può essere riletto dallo stesso gestore o da gestori successivi nello stesso invio.### 11.3 L'oggetto `helpers`

Ogni chiamata del gestore riceve un nuovo bundle `helpers` con ambito al gruppo ricevente e all'URL dell'evento. Campi costanti:

- `helpers.now`: millisecondi di epoca all'invio.
- `helpers.currentUrl`: l'URL dell'evento, dopo la normalizzazione della nuova scheda/spazio vuoto.
- `helpers.groupId`: ID gruppo ricevente.

Scorciatoie di comodità (indirizza alle stesse funzioni compatibili con l'accumulatore utilizzate dagli aiutanti di seguito, in modo che l'output arrivi ancora nel pannello Log):

-`helpers.log(...)`, `helpers.warn(...)`, `helpers.error(...)`.

Metodi di accesso:

-`helpers.getLogHelper()` — `log` / `warn` / `error`. L'output è limitato e limitato per invio per evitare che regole incontrollate blocchino il popup.
- `helpers.getDomainHelper()` (alias `helpers.getDomainUtility()`) — Ispezione URL (vedere **11.3.5**).
- `helpers.getTimerHelper()`: timer con ambito di gruppo (conto alla rovescia/conto alla rovescia); lo stato persiste dopo il riavvio del browser.
- `helpers.getPersistenceHelper()`: archivio chiave/valore JSON con ambito gruppo.
- `helpers.getRedirectionHelper()` — `setRedirectLink(url)` / `getRedirectLink()` (e alias `set` / `get`) più `createMessageUrl(message)` che restituisce un URL `chrome-extension://...` che visualizza il messaggio specificato.
- `helpers.getPlatformHelper()`: intenti DOM per piattaforma (vedere **11.3.6**).
- `helpers.getDOMHelper()`: intenti DOM generici: `hide(sel)`, `show(sel)`, `addClass(sel, c)`, `removeClass(sel, c)`, `setText(sel, text)`, `click(sel)`, `injectCss(css, id?)`, `removeInjectedCss(id)`, `scrollTo(sel)`. Le operazioni vengono raggruppate e applicate dopo il ritorno del gestore.
-`helpers.getNavigationHelper()` — `back()`, `forward()`, `reload()`, `goTo(url)`, `closeTab()`. Gli effetti vengono applicati alla scheda da cui proviene l'evento.
- `helpers.getStorageHelper()`: superset di `getPersistenceHelper` più hook asincroni `requestAsyncGet(key)`/`requestAsyncSet(key, value)` per l'archiviazione tra interni (i risultati arrivano come evento personalizzato successivo).
- `helpers.getTabHelper()` — `list()`, `getActiveTab()`, `getById(id)`, `countOpen()` rispetto a uno snapshot in bundle con l'evento.

Tutti i metodi di supporto sono sicuri: i parametri errati restituiscono `null`, `false` o un valore vuoto invece di lanciare un'eccezione.

#### 11.3.1 `getTimerHelper()`

Temporizzatori per gruppo. Ogni timer è identificato da una stringa `id` a scelta; L'identità ha come ambito il gruppo, quindi due gruppi possono entrambi utilizzare l'ID `"yt-shorts"` senza entrare in collisione. Lo stato persiste dopo il riavvio del browser.

Lo stato persistente di un timer è esattamente: `id`, `displayName`, `direction` (`"forward"` o `"backward"`), `isPaused` e `currentMs`. Non esiste una "durata iniziale" memorizzata: `isExpired` è solo `currentMs === 0`. I timer di avanzamento si attivano per sempre e non scadono mai da soli. I timer indietro smettono di ticchettare a `0` (nessun valore negativo).

Esistono due metodi di costruzione. Scegli quello la cui semantica corrisponde a ciò che desideri:

- `create({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **(ri)crea sempre** il timer con i valori iniziali forniti, sovrascrivendo qualsiasi stato esistente incluso `currentMs`. Usalo quando intendi "ricominciare da zero", ad es. all'interno di un ramo di ripristino one-shot.
- `getOrCreateTimer({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **idempotente**. Se esiste già un timer con quello `id`, i relativi `displayName` e `direction` potrebbero essere aggiornati ma `currentMs` verrà preservato. Altrimenti viene creato con i valori iniziali forniti. Questo è ciò che desideri per il modello comune "assicurati che il mio timer esista, quindi lascialo ticchettare".

Entrambi i metodi accettano due funzioni predicative che il motore ricorda per tutta la durata della regola (sopravvivono agli heartbeat e alle rivalutazioni `webChangedEvent`, ma **non vengono mai mantenute** nell'archiviazione):- `scope: (url) => boolean`: quando `true` per l'URL attualmente visibile su ciascun `pageHeartbeatEvent`, il timer esegue automaticamente il tick in base all'intervallo di battito cardiaco (~250 ms). L'aiutante stesso non si blocca mai; aggiorna solo `currentMs`. Al massimo un tick automatico per battito cardiaco per timer.
- `domain: (url) => boolean`: quando `true` per l'URL visibile corrente, il timer viene visualizzato nell'overlay in-page (in alto a sinistra). Quando `domain` viene omesso, il motore torna a `scope` per la visualizzazione, quindi viene visualizzato anche un timer "spunta su /shorts/pagine" senza cavi aggiuntivi. Fornisci `domain` esplicitamente se desideri una porta di visualizzazione diversa (ad esempio, seleziona solo `/shorts/`, ma mostra il tempo rimanente su tutto `youtube.com`).

> **Importante: un timer non si blocca mai da solo.** Quando un timer all'indietro raggiunge lo zero, si ferma semplicemente allo zero e attiva `timerEnded` una volta. Se bloccare effettivamente la pagina dipende da un gestore `openWebEvent` / `switchWebEvent` separato che chiama `ev.preventDefault()` dopo aver controllato `helpers.getTimerHelper().isExpired(id)`. Questa separazione ti consente di creare timer "solo avviso", contatori di conteggio, soft nudge o blocchi rigidi: stessa primitiva, a te la scelta.

Altri metodi:

- `delete(id)`, `pause(id)`, `resume(id)`: ciclo di vita standard. La pausa blocca `currentMs`.
- `setDirection(id, "forward" | "backward")`, `setCurrentMs(id, ms)`, `addMs(id, deltaMs)` — mutatori diretti (la maggior parte delle regole non ne ha bisogno: lascia che sia il battito cardiaco a scandire il timer per te).
- `setDisplayName(id, name)` — rietichettatura.
-`getCurrentMs(id)`, `getDirection(id)`, `getDisplayName(id)`, `isPaused(id)`, `exists(id)`.
- `isExpired(id)` — `true` se e solo `currentMs === 0`.
- `getState(id)` — `{ id, displayName, direction, isPaused, currentMs, isExpired }` o `null`.
- `list()`: ogni timer di proprietà di questo gruppo, come array di oggetti di stato.

#### 11.3.2 `getPersistenceHelper()`

Archiviazione simile a una mappa con ambito al tuo gruppo. I valori devono essere serializzabili in formato JSON.

-`set(key, value)`, `get(key, defaultValue?)`, `has(key)`, `delete(key)`, `keys()`, `entries()`, `clear()`, `size()`.

Limiti flessibili: circa 200 chiavi per gruppo, 16 KB per valore.

#### 11.3.3 `getLogHelper()`

- `log(...args)`, `warn(...args)`, `error(...args)` — scrivi nel pannello **Log** nel popup (il pacchetto helper li instrada comunque attraverso lo stesso accumulatore, indipendentemente dal dispatch che li ha prodotti). Ogni riga ha il prefisso `[CustomBlocker:groupId]`.
- L'helper ha dei limiti rigidi: circa **200 voci di registro per invio** e una lunghezza massima della stringa per voce. Le voci in eccesso vengono eliminate e conteggiate in `accumulator.logsDropped`. Questo è ciò che protegge il popup da una fuga di `for (let i = 0; i < 100000; i++) helpers.log(i)`.
- Quando la **modalità debug** è disattivata (impostazione predefinita), le voci a livello di traccia emesse dal motore stesso (avvio dell'invio/tempi del gestore) vengono soppresse ovunque: non vengono visualizzate nel pannello Log e non vengono stampate sulla console. Le tue chiamate `log` / `warn` / `error` vengono sempre effettuate.

#### 11.3.4 `getRedirectionHelper()`

Ispeziona/sostituisci l'URL di reindirizzamento che lo script del contenuto utilizzerà se la pagina corrente risulta bloccata.

- `get()`: restituisce l'URL di reindirizzamento effettivo corrente per questo invio. Inizialmente questo è l'URL di fallback configurato del gruppo integrato (se presente), altrimenti `""`.
- `set(url)`: sovrascrive l'URL di reindirizzamento per questa spedizione. Restituisce `true` in caso di successo, `false` per input non di tipo stringa. Il passaggio di `""` cancella l'override del reindirizzamento e torna al normale comportamento di uscita predefinito.
- `createMessageUrl(message)`: restituisce un URL `chrome-extension://<id>/message-page.html?msg=...` che, quando si accede, visualizza il messaggio centrato su una pagina pulita. Utile per reindirizzare gli utenti alla schermata "Vai a lavorare"/"Fai una pausa" allo scadere del tempo. Esempio: `ev.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Go Work"))`.

Come gli altri effetti collaterali delle regole personalizzate, questo stato è condiviso tra tutte le regole nell'invio corrente. Poiché le regole vengono eseguite dal basso verso l'alto, prevale la regola più in alto per chiamare `set(...)`.

#### 11.3.5 `getDomainHelper()` (alias `getDomainUtility()`)

Aiutanti per l'ispezione degli URL. Non esiste `normalize()` perché gli URL in entrata sono già normalizzati newtab.

Nucleo:-`hostnameOf(url)`, `pathnameOf(url)`, `matches(hostname, site)`, `getPlatform(url)`.
-`isYouTubeHost`, `isTikTokHost`, `isrete fotograficaHost`, `isFacebookHost`, `isTwitchHost`, `isRedditHost`, `isDiscordHost`.
- `youtube()`, `tiktok()`, `instagram()`, `facebook()`, `twitch()`: ciascuno restituisce `{ isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId }`.

Filtraggio URL e aiutanti di sezione:

- `isEmptyStartPage(url)` — `true` per la pagina nuova scheda ed equivalenti (gli URL che vengono visualizzati come `""` ai gestori).
- `matchesAny(url, patterns)` — `patterns` può essere una regex, una regex di stringa o un array di entrambe.
- `pathStartsWith(url, path)`: riconoscimento dei confini (`pathStartsWith("/r/", "/r")` è vero; `"/results/"` non lo è).
- `queryHas(url, key, value?)`, `queryGet(url, key)`: ispezione della stringa di query.
- `isSearchPage(url)`: riconosce i risultati di Google / Bing / DuckDuckGo / Iutub / Rèddit / Tuitter / X.
- `isInfiniteFeedUrl(url)`: riconosce le superfici di feed algoritmico di Iutub, Tic Toc, rete fotografica, Feisbuc, Rèddit, X.
- `sameSection(a, b)`: stesso nome host E stesso primo segmento di percorso.

#### 11.3.6 `getPlatformHelper()`

Intenti DOM per piattaforma e timer di sottosezioni, oltre a ispezione. Ogni `helpers.getPlatformHelper().<platform>()` restituisce un oggetto il cui set di metodi è **controllato dalla piattaforma**: i metodi che non hanno senso su una determinata piattaforma sono semplicemente assenti, quindi chiamarli lancia `TypeError: ... is not a function` anziché silenziosamente no-op. Ad esempio, `twitch().hidePosts` non esiste (dirette video non ha post) e `tiktok().hideShortButton` non esiste (l'intera esperienza di Tic Toc è già un video in formato breve). Utilizza `helpers.getPlatformHelper().hasMethod(platform, name)` o `.listMethods(platform)` per eseguire l'introspezione in fase di esecuzione.

Matrice del metodo per piattaforma:

| metodo | youtube | tiktok | instagram | facebook | contrazione |
|---|:---:|:---:|:---:|:---:|:---:|
| `hideShorts` / `showShorts` | ✓ |  |  |  |  |
| `hideReels` / `showReels` |  |  | ✓ | ✓ |  |
| `hideClips` / `showClips` |  |  |  |  | ✓ |
| `hideStreams` / `showStreams` |  |  |  |  | ✓ |
| `hideVideos` / `showVideos` | ✓ | ✓ |  | ✓ | ✓ (VOD) |
| `hidePosts` / `showPosts` | ✓ |  | ✓ | ✓ |  |
| `hideShortButton` / `showShortButton` | ✓ |  |  |  |  |
| `hideHomePage` / `showHomePage` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `hideComments` / `showComments` | ✓ | ✓ | ✓ | ✓ | ✓ (chiacchierare) |
| `filterComments` | ✓ | ✓ | ✓ | ✓ |  |
| `hideLive` / `showLive` / `filterLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isCurrentChannelSubscribed` / `isChannelSubscribed` | ✓ |  |  |  | ✓ |
| `isCurrentChannelVerified` | ✓ |  |  |  |  |
| `isLiveNow` | ✓ | ✓ |  | ✓ | ✓ |
| `isItemLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isAlgorithmicRecommendation` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `isSponsored` | ✓ | ✓ | ✓ | ✓ |  |
| `setShortsTimer` | ✓ |  |  |  |  |
| `setReelsTimer` |  |  | ✓ | ✓ |  |
| `setClipsTimer` |  |  |  |  | ✓ |
| `setStreamsTimer` |  |  |  |  | ✓ |
| `setVideosTimer` | ✓ | ✓ |  | ✓ | ✓ |
| `setPostsTimer` | ✓ |  | ✓ | ✓ |  |

I nomi nativi della piattaforma (`hideReels`, `hideClips`, `hideStreams`) NON sono bucket separati da `hideShorts` / `hideVideos`: lo slot di archiviazione è lo stesso; solo il nome visibile all'utente segue la terminologia di ciascuna piattaforma.

> **Durata del predicato e regola per slot singolo.** Ciascuno di `hideShorts` / `hideReels` / `hideClips` / `hideStreams` / `hideVideos` / `hidePosts` / `filterComments` / `filterLive` possiede **uno** persistente predicato per `(group, platform, slot)`. Il predicato **non** ha come ambito l'evento corrente: una volta impostato, rimane attivo a ogni caricamento della pagina e a ogni invio finché non viene chiamato il `show*()` corrispondente o il gruppo non viene caricato. Richiamare nuovamente lo stesso metodo con una nuova funzione **sostituisce** quella precedente: il motore non unisce mai tramite OR più predicati all'interno di un singolo gruppo. Per combinare le condizioni, scrivi un predicato che esegua tu stesso la combinazione, ad es. `yt.hideVideos(item => isShort(item) || hasKeyword(item))`. Nei **diversi** gruppi, ogni gruppo contribuisce con il proprio predicato e un elemento viene nascosto se il predicato di qualsiasi gruppo corrisponde.

I metodi di ispezione traggono valore al momento dell'invio da un'istantanea fornita in bundle con l'evento; la loro disponibilità è controllata dalla matrice sopra.

I classificatori URL vengono sempre riesposti indipendentemente dalla piattaforma: `isPlatformUrl`, `isShortUrl`, `isVideoUrl`, `isPostUrl`, `isHomePage`, `extractAuthor`, `extractVideoId`.I timer delle sottosezioni registrano il timer nel bucket del gruppo persistente e, una volta limitato l'ambito, selezionano solo gli URL che corrispondono a quella sottosezione. I metodi timer accettano `{ id, direction, currentMs, displayName }` e seguono lo stesso gating per piattaforma.

Per i metodi del predicato, il predicato viene chiamato per la carta corrispondente con un `item` normalizzato: `{ url, name, author, length, views, publishedAt, description, live?, sponsored?, algorithmic? }`. Qualsiasi campo può essere `null`; "innocente fino a prova contraria": restituisce `false` quando manca il campo che ti serve.

### 11.4 Esempi

**Facile**: blocca le pagine di Iutub Shorts nelle mattine dei giorni feriali:

ZXQCODICE2ZXQ

**Medio**: budget giornaliero di 30 minuti per Iutub Shorts. Il timer attiva automaticamente gli `pageHeartbeatEvent` mentre è visibile l'URL di uno Short; un gestore separato impone il blocco quando il timer raggiunge lo zero.

ZXQCODICE3ZXQ

**Più difficile**: nascondi singoli Short di Iutub il cui nome dell'autore è troppo lungo e inserisci un CSS "questo Short è nascosto":

```js
(event, helpers) => {
  const MAX_AUTHOR_LEN = 16;

  function configure(_ev, h) {
    const yt = h.getPlatformHelper().youtube();
    yt.hideShorts(
      (item) => item.author && item.author.length > MAX_AUTHOR_LEN,
      { blockPageOnVisit: true }
    );
    h.getDOMHelper().injectCss(
      "ytd-rich-grid-media[data-cb-hidden] { opacity: 0.2 !important; }",
      "long-author-label"
    );
  }

  event.registerOpenWebEvent("hide-long-shorts", configure);
  event.registerSwitchWebEvent("hide-long-shorts", configure);
  event.registerWebChangedEvent("hide-long-shorts", configure);
}
```

**Più difficile**: trasmetti un evento personalizzato da un gestore ad altri:

ZXQCODICE5ZXQ

---

## 12. Modelli

Ogni gruppo personalizzato dispone di un selettore **Modelli** che apre un browser preimpostato ricercabile. La libreria ora fornisce **oltre 50 modelli** organizzati in nove categorie in modo che tu possa sfogliarli invece di scrivere regole da zero:

| Categoria | Esempi |
|---|---|
| **Timer** | Budget del tempo sul sito (conto alla rovescia + blocco), tracker del tempo del sito (conteggio alla rovescia), limite di Iutub Shorts, limite di feed Tic Toc, limite di rete fotografica Reels, limite di Feisbuc Reels, limite di dirette video Clips, budget di distrazione universale, tracker giornaliero del lavoro approfondito |
| **Programma** | Blocco dell'orario di lavoro nei giorni feriali, siti solo nel fine settimana, chiusura prima di andare a dormire, consenti solo un'ora, notizie solo per il pranzo, nuovo inizio del lunedì, consenti i primi N minuti di ogni ora, blocco rigoroso del lavoro profondo |
| **Feed / Pantaloncini** | Blocca gli URL degli shorts di Iutub, nascondi le schede degli shorts, nascondi gli shorts per parola chiave, nascondi il feed della home page di Iutub/commenti/trending, blocca il FYP di Tic Toc, nascondi gli shorts di Tic Toc, blocca gli URL dei reels di rete fotografica, nascondi il feed dei reels di rete fotografica, nascondi il feed/reels di Feisbuc, nascondi la home page di Rèddit/Tuitter/Linkedin |
| **Reindirizzamento** | Distrazioni → pagina focus, Pantaloncini → /feed/subscriptions, reddit.com → old.reddit.com, twitter / x → Nitter, nuova scheda → elenco attività |
| **Focus** | Sessione focus solo nella lista consentita, Pomodoro 25/5, blocco durante la riunione, blocco dopo N visite oggi, blocco in caso di perdita di serie |
| **Spingi** | Registra ogni visita che distrae, avvisa per ogni visita a Shorts, conta le visite giornaliere a un sito |
| **Persistenza** | Limite mensile delle visite, attivazione/disattivazione del divieto settimanale, traccia dei canali Discor visitati |
| **Modifiche DOM** | Nascondi l'attivazione/disattivazione della riproduzione automatica di Iutub, nascondi Tuitter / X "Cosa sta succedendo", generico "nascondi selettori su un sito" |
| **Debug** | Conto alla rovescia demo (3 s), registra ogni evento personalizzato |

I chip filtro nella parte superiore del selettore restringono l'elenco per categoria (`Timer`, `Schedule`, `Feed`, …) e piattaforma (`Iutub`, `Tic Toc`, `rete fotografica`, …). Selezione di un modello:

1. Carica i suoi input di parametri (URL, minuti, intervalli di ore, ecc.) in un piccolo modulo.
2. **Applica preimpostazione** visualizza in anteprima la sorgente generata.
3. Dopo aver confermato **Sostituire la regola personalizzata corrente con questa preimpostazione?**, la fonte viene scritta nell'editor.
4. Quindi fare clic su **Esegui** per registrare i gestori della regola nella sandbox fuori schermo.

I modelli sono definiti in `templates/*.js` (`timers.js`, `schedule.js`, `feed.js`, …). Ogni file chiama `CB_REGISTER_TEMPLATES([...])` al momento del caricamento e il popup utilizza l'elenco unito. Aggiungere un nuovo modello significa scrivere una voce nel file appropriato, nessun altro impianto idraulico.

---

## 13. Comportamento multipagina- Tutte le schede aperte nello stesso gruppo condividono lo stesso timer.
- Quando passi a una scheda nello stesso gruppo, la sua sovrapposizione si aggiorna immediatamente per mostrare l'orario condiviso corrente.
- I timer con regole personalizzate spuntano solo nella scheda **attivo visibile**, gestito da `pageHeartbeatEvent`. Le schede in background e le finestre ridotte a icona non le fanno avanzare. Ciò corrisponde al conto alla rovescia predefinito del gruppo di blocco.
- Quando viene aggiunta una nuova regola, ogni pagina aperta rileva la modifica e la rivaluta entro una frazione di secondo; **ma** i gestori appena registrati non "aprono" retroattivamente le schede già aperte. Per questo motivo, il popup mostra un promemoria di ricarica dopo ogni corsa.
- Quando una regola scade, le schede dei feed nascosti e i pulsanti di navigazione vengono ripristinati al successivo aggiornamento.

---

## 14. Impostazioni

Apri la finestra di dialogo **Impostazioni** tramite l'icona a forma di ingranaggio nella barra in alto.

- **Intervallo di battito cardiaco**: la frequenza con cui lo script del contenuto segnala il tempo di tabulazione e guida `pageHeartbeatEvent`. Predefinito 250 ms. I valori più bassi sono più reattivi ma utilizzano più CPU.
- **Intervallo di spunta**: la frequenza con cui si attiva lo `tickEvent` globale. Predefinito 1000 ms.
- **Modalità debug**: *disattivata* per impostazione predefinita. Quando *on*, il motore emette voci a livello di traccia nel pannello Log (`[trace] dispatchEvent`, `[trace] N handler(s)`) e righe `[CustomBlocker:trace]` nella console del browser. Lascialo spento nell'uso quotidiano; accenderlo durante la diagnosi di una regola di comportamento anomalo. `pageHeartbeatEvent` è escluso dalla registrazione della traccia anche quando la modalità debug è attiva, perché si attiva quattro volte al secondo e coprirebbe il resto.

---

##15. Internazionalizzazione

L'intera interfaccia utente è tradotta. Utilizza il selettore **Lingua** in alto a destra.

Le lingue supportate includono inglese, cinese (semplificato), spagnolo, giapponese, coreano, oltre a una copertura parziale per hindi, arabo, bengalese, portoghese, russo, punjabi, tedesco, francese, turco, vietnamita, italiano, tailandese, olandese, polacco, indonesiano, urdu e persiano. Le lingue con copertura parziale ricadono nell'inglese per le stringhe mancanti.

Il manuale di istruzioni stesso carica il file di markdown corrispondente alla lingua selezionata, con l'inglese come fallback.

---

## 16. Messaggi di stato

I messaggi di stato vengono visualizzati come un toast centrato che svanisce dopo circa due secondi:

- "Modifiche salvate".
- "Creato \"Nome gruppo\"."
- "Regola personalizzata caricata: N gestori attivi. Per applicare questa regola alle schede già aperte, ricaricale."
- Errori di convalida come "I minuti consentiti devono essere un numero maggiore di 0."
- "I minuti di posticipazione devono essere un numero maggiore di 0."
- "I gruppi congelati non possono essere modificati."

Per i campi di input con requisiti di formato, il messaggio appare anche accanto al pulsante corrispondente (per snooze).

---

## 17. Privacy e archiviazione

- Tutto è archiviato localmente in `chrome.storage.local`. Nessun dato viene inviato da nessuna parte.
- Gli elementi memorizzati includono: gruppi, timer di utilizzo, orari dell'ultimo ripristino, record di posticipazione, timer personalizzati e valori persistenti personalizzati.
- L'estensione non legge il contenuto della pagina oltre quanto necessario per rilevare il tipo di pagina (percorso/nome host/marcatori DOM conosciuti per siti di video) e per valutare i predicati scritti dall'utente. Non legge i tuoi messaggi, post, commenti o contenuti privati.

---

## 18. Autorizzazioni

- `storage` — per i dati sopra.
- `declarativeNetRequest`: per il blocco nativo dei gruppi `Default`.
- `alarms`: per pianificare le transizioni delle regole in modo efficiente.
- `tabs`, `webNavigation`: per rilevare la creazione di schede, le modifiche agli URL e gli heartbeat delle pagine in modo che gli eventi possano essere inviati.
- `offscreen`: per ospitare il sandbox con regole personalizzate di lunga durata.
- `host_permissions: <all_urls>`: in modo che lo script del contenuto possa mostrare la sovrapposizione del timer e rilevare il contesto della piattaforma su qualsiasi pagina.

---

## 19. Risoluzione dei problemi- **Un gruppo che ho aggiunto non fa nulla.** Assicurati che il gruppo sia abilitato, che la pianificazione lo consenta adesso, che non sia attiva alcuna posticipazione e (per i gruppi di piattaforme) che la pagina corrisponda effettivamente al tipo di contenuto e al filtro dell'autore scelti.
- **Un timer è bloccato o sbagliato su una scheda.** Passa indietro e indietro oppure focalizza la scheda: ciò attiva un aggiornamento forzato dal timer condiviso.
- **Le carte feed riappaiono dopo che penso che dovrebbero essere nascoste.** L'occultamento del feed viene eseguito solo mentre la regola blocca attivamente. Se hai una regola `after-minutes`, alimenta il nascondiglio che entra in azione una volta che il tuo tempo raggiunge lo zero.
- **Un pulsante di navigazione di Iutub che mi aspettavo fosse nascosto è ancora lì.** Per nascondere la navigazione è necessario che la regola sia impostata su "non filtrare per autore" e che il tipo di contenuto sia Short o post di Iutub. Con i filtri dell'autore, l'occultamento avviene solo per scheda.
- **La regola personalizzata non ha fatto nulla o è stata lanciata in modo silenzioso.** Apri Impostazioni → attiva la **Modalità debug**, quindi fai di nuovo clic su **Esegui** e osserva il pannello Registro. Le righe con prefisso `[trace]` mostrano ogni spedizione e gestore. Utilizza `helpers.getLogHelper().log(...)` per aggiungere i tuoi punti di tracciamento. Se una regola dal comportamento anomalo continuava a essere messa in quarantena automatica, correggi l'origine e fai clic su Esegui: Esegui cancella il motivo dell'interruzione.
- **La mia nuova regola personalizzata non influisce sulle schede già aperte.** Ricaricale. Le regole personalizzate si allegano agli eventi *futuri* della pagina; il popup mostra un promemoria per ricaricare dopo ogni corsa.
- **Il mio timer per il conto alla rovescia non avanza.** I timer con regole personalizzate spuntano solo sulla scheda **visibile attivo** tramite `pageHeartbeatEvent`. Le schede in background, le finestre ridotte a icona e le schermate bloccate le mettono in pausa in base alla progettazione: lo stesso comportamento del conto alla rovescia predefinito del gruppo di blocco.
- **Non riesco a eliminare un gruppo.** Probabilmente è bloccato. I gruppi bloccati in modo rigoroso non possono essere eliminati finché il loro blocco non scade; i gruppi congelati non rigidi possono essere eliminati tramite il rituale di sblocco.
- **Il popup mostra "In esecuzione..." per sempre.** Una regola personalizzata probabilmente è entrata in un circolo vizioso. Il motore lo spegne dopo un duro timeout e mette in quarantena la regola. Aprire il pannello Log per il motivo dell'interruzione; correggere la regola e fare clic su Esegui.

---

##20. Glossario

- **Gruppo di blocco**: un set di regole con tipo, comportamento, pianificazione e blocco/posticipazione specifici.
- **Blocco istantaneo**: la regola si blocca immediatamente ogni volta che è attiva.
- **Blocco dopo i minuti**: la regola inizia a bloccarsi solo dopo che il budget temporale per il periodo è esaurito.
- **Intervallo di reimpostazione**: la frequenza con cui il budget dopo i minuti viene reimpostato.
- **Pianificazione**: giorni + finestre temporali durante le quali un gruppo è attivo.
- **Blocco/Blocco rigoroso**: stati anti-manomissione.
- **Snooze**: disabilitazione temporanea con un rituale di conferma configurabile.
- **Filtro autore**: per i gruppi di piattaforme, limita la regola a determinati creatori di contenuti.
- **Tipo di contenuto**: per i gruppi di piattaforme, limita la regola a determinate forme di contenuto (breve, lungo, post).
- **Aiutanti**: utilità passate al gestore di una regola personalizzata.
- **Piattaforma**: una tra `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Ognuno ha il proprio tipo di gruppo e la propria logica per nascondere i feed.
- **Battito cardiaco**: `pageHeartbeatEvent` da ~250 ms inviato dalla scheda visibile attiva.
- **Tick**: 1 `tickEvent` condiviso a livello globale (indipendente dalla visibilità).
- **Modalità debug**: un'impostazione che mostra la registrazione della traccia interna nel pannello Registro e nella console del browser.
- **Quarantena**: disattivazione automatica di una regola personalizzata che ha superato un limite di sicurezza di runtime (scadenza, registro spam, ...). Cancellato alla corsa successiva.

---

## 21. Limitazioni- L'occultamento dei feed dipende dal DOM attuale di ciascuna piattaforma. Se la piattaforma cambia layout, potrebbe essere necessario aggiornare i selettori nascosti.
- Il rilevamento del contesto della piattaforma per i siti non Iutub è per lo più basato su URL, quindi è più affidabile sugli URL di contenuti canonici.
- I timer con regole personalizzate ticchettano alla risoluzione del battito cardiaco (~250 ms). Non fare affidamento su di loro per tempi inferiori al secondo.
- I predicati passati a `hideShorts` / `hideVideos` / `hidePosts` vengono valutati in modo sincrono per scheda di alimentazione. La logica pesante in un predicato può rallentare lo scorrimento del feed; tenerli a buon mercato.
- Due schede che modificano lo stesso timer per gruppo utilizzano contemporaneamente una strategia "l'ultima scrittura vince". Per l'uso tipico va bene; se dipendi da una contabilità esatta, aspettati piccole derive occasionali.
- Il browser potrebbe sospendere l'operatore del servizio in background quando è inattivo. L'estensione lo riprende non appena una pagina o un allarme lo richiedono; i budget per l'utilizzo del sito/temporizzato continuano a essere conteggiati tramite la riproduzione dell'heartbeat.

## Nota v1.2

L’editor delle regole personalizzate ora colora la sintassi linguaggio di script, e il browser dei modelli usa gli stessi colori per le anteprime del codice. L’azione di massa dei gruppi si chiama **Svuota**.

