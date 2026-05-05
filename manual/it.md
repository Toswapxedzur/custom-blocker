# Custom Web Blocker — Manuale di Istruzioni

Questo e il manuale di riferimento completo dell'estensione. Inizia dai flussi piu semplici e comuni e passa gradualmente ad argomenti avanzati come le regole di blocco JavaScript personalizzate e l'API helper.

Se sei completamente nuovo, leggi solo **Avvio rapido** e **Panoramica dei gruppi di blocco**. Tutto cio che segue queste sezioni e opzionale, in base a quello che vuoi fare.

---

## 1. Cosa fa questa estensione

Custom Web Blocker ti permette di bloccare siti web e distrazioni online secondo regole che definisci tu. Puoi:

- Bloccare subito i siti con il blocco di rete nativo del browser (lo stesso tipo di blocco che produce `ERR_BLOCKED_BY_CLIENT`).
- Concederti un certo numero di minuti al giorno su un sito, poi bloccarlo quando superi quel limite.
- Bloccare tipi specifici di contenuto su YouTube, TikTok, Facebook, Instagram, Twitch e Reddit (non l'intero sito).
- Nascondere i contenuti bloccati dai feed sulle piattaforme supportate invece di bloccare solo singole pagine.
- Pianificare quando una regola e attiva per giorno della settimana e finestre orarie `HHMM-HHMM`.
- Congelare una regola per non poterla cambiare facilmente. Il congelamento rigoroso la blocca per un numero di ore specificato e richiede un rituale di conferma in 20 passaggi per annullarlo.
- Sospendere temporaneamente una regola (snooze), ma solo dopo aver scritto una giustificazione sufficientemente lunga.
- Scrivere regole di blocco JavaScript personalizzate con helper per timer, persistenza, rilevamento piattaforma, matching domini e log.
- Usare l'estensione in oltre 20 lingue.

L'estensione e una Chrome Manifest V3, con una pagina editor (il popup), un background service worker e uno content script che gira su ogni pagina.

---

## 2. Tour dell'interfaccia

Quando clicchi l'icona dell'estensione, l'editor si apre come pagina web completa (non come piccolo popup). La pagina ha queste aree:

- **Barra superiore**
  - Pulsante **Instruction Manual** (questo documento)
  - Selettore **Language**
- **Pannello sinistro — Block Groups**
  - Elenco dei tuoi gruppi di blocco. Ogni card mostra nome gruppo, una breve riga riassuntiva e una checkbox di attivazione/disattivazione.
  - Il pulsante **Add** crea un nuovo gruppo. Il menu accanto seleziona il tipo.
  - **Delete All** rimuove tutti i gruppi, con conferme extra se almeno un gruppo e congelato.
  - Puoi trascinare la maniglia `::` su una card verso l'alto o il basso per riordinare i gruppi.
  - Puoi trascinare il divisore verticale per ridimensionare questo pannello.
- **Pannello destro — Editor**
  - Modifica il gruppo attualmente selezionato: nome, comportamento di blocco, blocklist, filtri specifici del tipo, pianificazione, freeze, snooze.
  - Tutte le modifiche si salvano automaticamente una frazione di secondo dopo che smetti di digitare o interagire.
- **Toast** (popup centrato che svanisce)
  - Mostra messaggi di stato come "Saved changes" o errori di input.

Mentre una pagina viene bloccata o ha un timer attivo, appare un overlay nell'angolo in alto a sinistra che mostra tutti i vincoli temporali attualmente applicati, in formato `hh:mm:ss` (o `mm:ss`). Vincoli multipli si impilano su piu righe.

---

## 3. Avvio rapido

1. Clicca l'icona dell'estensione. L'editor si apre come pagina completa.
2. Nel pannello **Block Groups**, scegli un tipo di gruppo dal menu:
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit` oppure `Custom`.
3. Clicca **Add**. Compare un nuovo gruppo e l'editor lo apre.
4. Assegna un nome.
5. Compila i campi specifici del tipo (per `Default`, significa la lista **Blocked websites**).
6. Assicurati che la checkbox del gruppo nel pannello sinistro sia attiva.
7. Visita uno dei siti elencati. Il blocco dovrebbe attivarsi immediatamente.

Questo e l'intero percorso principale. Il resto di questo manuale sono solo opzioni aggiuntive sopra questo.

---

## 4. Panoramica dei gruppi di blocco

Tutto in questa estensione e organizzato in **gruppi di blocco**. Un gruppo di blocco e un set di regole:

- Ha un nome, un tipo e uno stato attivo/disattivo.
- Ha un comportamento di blocco (immediato o dopo un numero di minuti).
- Ha una pianificazione opzionale (giorni + finestre orarie) e controlli freeze/snooze opzionali.
- In base al tipo, ha campi aggiuntivi come elenco siti, filtri creatore YouTube, nomi subreddit o una funzione JavaScript.

Puoi avere qualsiasi numero di gruppi. Piu gruppi possono applicarsi alla stessa pagina; in quel caso vince la regola **piu rigida**:

- "Blocca subito" batte "blocca dopo un po di tempo".
- Un gruppo con meno tempo residuo batte un gruppo con piu tempo residuo.

Quindi aggiungere piu gruppi puo solo far bloccare una pagina prima, mai dopo.

Puoi trascinare i gruppi dalla maniglia `::` per riordinarli. L'ordine non cambia quale regola e la piu rigida, ma controlla come l'elenco viene letto dall'alto verso il basso.

---

## 5. Tipi di gruppo

### 5.1 `Default` — blocca siti web normali

Per bloccare domini specifici (il caso d'uso tipico).

- **Blocked websites**: un sito per riga. Funzionano sia `facebook.com` sia `https://www.facebook.com/somepage`; l'estensione estrae e normalizza l'hostname.
- Una regola sito si applica a quell'hostname e a tutti i suoi sottodomini.
- Questo tipo di gruppo usa il blocco di rete nativo di Chrome, simile a `ERR_BLOCKED_BY_CLIENT`. Significa che la navigazione verso un URL bloccato viene fermata prima ancora del caricamento della pagina.

### 5.2 `YouTube` — blocca YouTube e siti video simili

Aggiunge una sezione **Filters** all'editor:

- **Content type**:
  - `Apply to all YouTube pages` — tutte le pagine YouTube contano.
  - `Apply to Shorts` — contano solo le pagine Shorts.
  - `Apply to long videos` — solo `/watch`, `/live/`, `/embed/`, ecc.
  - `Apply to YouTube posts` — post della community (`/post/...`, tab community/posts del canale).
- **Author filter**:
  - `Do not filter by author` — l'identita autore non conta.
  - `Apply to certain authors` — solo gli autori elencati attivano questo gruppo.
  - `Apply to all except certain authors` — gli autori elencati sono esclusi.
- **Authors**: un autore per riga. Accetta `@handle`, URL completi, `/channel/UC...`, `/c/...`, `/user/...`.
- **Hide blocked entries in the YouTube feed**: mentre questo gruppo sta bloccando attivamente, le card corrispondenti nei feed YouTube vengono nascoste. Quando il blocco diventa inattivo, ricompaiono al refresh successivo.

Per i tipi Shorts e Posts, quando non c'e filtro autore e il gruppo sta bloccando, l'estensione nasconde anche le voci di navigazione rilevanti (voce Shorts nella sidebar, tab Community/Posts del canale) e le shelf corrispondenti come "Latest YouTube posts".

Il rilevamento short-vs-long si estende anche ad altri siti video come TikTok, Vimeo, clip/VOD Twitch e Dailymotion quando la forma della pagina e rilevabile.

### 5.3 `TikTok` — blocca contenuti TikTok

Stessa card editor del platform-video editor, ma con etichette specifiche TikTok:

- Tipi di contenuto: short videos, videos, profile pages.
- Autori: handle TikTok (`@handle`) o URL profilo.
- L'occultamento feed nasconde le card corrispondenti nelle pagine TikTok mentre il gruppo e attivo.

### 5.4 `Facebook` — blocca contenuti Facebook

- Tipi di contenuto: Reels, videos, posts.
- Autori: nome pagina (`page.name`), URL profilo o formato `profile.php?id=...` (l'id numerico viene preservato come `id:<number>`).
- L'occultamento feed nasconde le card feed corrispondenti su Facebook.

### 5.5 `Instagram` — blocca contenuti Instagram

- Tipi di contenuto: Reels, videos, posts.
- Autori: handle Instagram o URL profilo.
- Percorsi riservati come `/reel/`, `/p/`, `/tv/`, `/explore/` non vengono trattati come autori.
- L'occultamento feed nasconde le card corrispondenti su Instagram.

### 5.6 `Twitch` — blocca contenuti Twitch

- Tipi di contenuto: clips, streams/VODs, channel pages.
- Autori: nomi canale o URL canale.
- Percorsi riservati come `/directory`, `/videos`, `/settings`, ecc. non vengono trattati come nomi canale.
- L'occultamento feed nasconde le card corrispondenti su Twitch.

### 5.7 `Reddit` — blocca Reddit o subreddit specifici

- **Subreddits**: un subreddit per riga. Lista vuota significa che il gruppo si applica a tutto Reddit. Sono accettati sia `productivity` sia `r/productivity`.

### 5.8 `Custom` — blocca con funzione JavaScript

Scrivi una funzione JavaScript. L'estensione la chiama circa ogni secondo e usa cio che restituisce come blocklist corrente.

I gruppi `Custom` non mostrano: comportamento di blocco, siti bloccati, minuti consentiti, intervallo reset timer, giorni di pianificazione o finestre orarie. Hanno solo un grande input — la funzione **Blocking Rules** — piu i controlli standard freeze/snooze.

Vedi **Sezione 11** per il riferimento completo delle regole custom e dell'API helper.

---

## 6. Comportamento di blocco

Per la maggior parte dei tipi di gruppo scegli una di due modalita:

### 6.1 Blocca immediatamente

La regola e attiva quando il gruppo e acceso, la pianificazione lo consente e (per i gruppi piattaforma) la pagina corrisponde.

Per i gruppi `Default` usa il blocco nativo Chrome. Per i gruppi piattaforma usa la logica overlay/uscita in pagina.

### 6.2 Blocca dopo un numero di minuti

Questo e un budget di utilizzo.

- **Allowed minutes before block** (decimale): quanti minuti ti concedi per periodo. Esempio: `15`, `0.5`, `90`.
- **Timer reset interval (hours)** (decimale): ogni quanto il budget si resetta. Esempio: `24` per giornaliero, `1` per orario, `0.25` per ogni 15 minuti.

Finche hai tempo residuo, la pagina funziona normalmente e mostra l'overlay timer. Quando il budget arriva a zero, la pagina viene bloccata per il resto del periodo e l'overlay mostra `0:00`, poi la scheda tenta di uscire.

L'estensione lavora per-gruppo, per-periodo:

- Ogni gruppo ha il proprio budget.
- Il tempo passato su qualsiasi pagina che corrisponde al gruppo viene conteggiato nel budget di quel gruppo.
- Piu schede nello stesso gruppo condividono il budget. I timer restano sincronizzati; passare a un'altra scheda forza anche un refresh cosi mostra subito il tempo condiviso corrente.

Se piu gruppi con limite temporale si applicano alla stessa pagina, vince quello piu rigido.

---

## 7. Pianificazione

Nella card **Schedule** puoi limitare quando un gruppo e attivo:

- **Days to block**: scegli i giorni in cui il gruppo si applica. I giorni non selezionati significano gruppo inattivo quel giorno.
- **Time windows**: elenco libero, una finestra per riga in formato `HHMM-HHMM`, per esempio:

  ```
  0900-1000
  1200-1300
  ```

  Il gruppo e attivo solo dentro queste finestre. Lista vuota significa tutto il giorno.

Si applica a tutti i tipi di gruppo tranne `Custom`.

---

## 8. Freeze (anti-manomissione)

Il freeze rende un gruppo difficile da disattivare d'impulso.

Nella card **Freeze** scegli:

- **Frozen** — non puoi modificare o eliminare il gruppo, e non puoi togliere la sua checkbox di attivazione. Per cambiare qualsiasi cosa devi eseguire il rituale di sblocco (vedi sotto).
- **Strict frozen** — uguale a Frozen, ma resta bloccato per un numero di ore scelto da te (decimale, fino a 72). Finche quel timer non scade, anche il rituale di sblocco non e disponibile.

Quando un gruppo frozen e sbloccabile, compare il pulsante **Unfreeze**. Cliccandolo inizia il **rituale in 20 passaggi**:

- La modale mostra un messaggio di autodisciplina.
- Devi cliccare `Confirm` 20 volte.
- C'e una pausa forzata di 5 secondi tra i clic.
- Se annulli in qualsiasi punto, devi ricominciare dal passaggio 1.
- I 20 messaggi ruotano, cosi li leggi davvero.

Se il gruppo e anche marcato "no snooze" (vedi sezione successiva), non puoi metterlo in snooze mentre e frozen.

Lo stato freeze viene mostrato nella riga meta della card gruppo, incluso il tempo rimanente per strict freeze.

---

## 9. Snooze (disattivazione temporanea)

Snooze disattiva temporaneamente un gruppo senza scongelarlo, ma solo con una giustificazione scritta.

Nella card **Snooze**:

- **Allow snooze for this group** — se disattivato, questo gruppo non puo essere messo in snooze in alcun caso (incluso quando e frozen).
- **Snooze for (minutes)** — decimale, quanto dura lo snooze.
- **Reason** — deve essere **di almeno 100 caratteri e piu di 20 parole**. Il pulsante Start resta disabilitato finche entrambe le condizioni non sono soddisfatte. Se la regola fallisce, appare un avviso inline vicino al pulsante.

Se il gruppo e frozen, i minuti snooze sono bloccati al valore scelto prima del freeze. Puoi comunque fare snooze, purche sia consentito e la ragione rispetti le regole.

Un messaggio di stato conferma lo snooze. Quando lo snooze finisce, il gruppo torna automaticamente normale.

Puoi anche terminare uno snooze in anticipo con il pulsante **End Snooze**.

---

## 10. Azioni di massa

- **Delete All** rimuove tutti i gruppi.
  - Chiede sempre conferma.
  - Se almeno un gruppo e frozen, richiede lo stesso rituale in 20 passaggi dell'unfreeze.
  - Se un gruppo strict-frozen e ancora bloccato, **Delete All** e disabilitato.

---

## 11. Gruppi Custom (riferimento completo)

Un gruppo `Custom` esegue una funzione JavaScript nel background service worker. La funzione viene chiamata circa ogni secondo, e l'estensione usa cio che restituisce per decidere quali domini devono essere bloccati in questo momento.

### 11.1 Firma della funzione

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

Parametri:

- `month` — da `1` a `12`.
- `dayOfMonth` — da `1` a `31`.
- `dayName` — per esempio `"Monday"`.
- `hour` — da `0` a `23`.
- `minute` — da `0` a `59`.
- `blockedDomains` — la lista di domini in esecuzione che altre regole hanno gia prodotto. Puoi aggiungere, sostituire o ignorare.
- `helpers` — un pacchetto di oggetti helper (vedi sotto).

Valore di ritorno:

- Un array di stringhe dominio da bloccare ora, OPPURE
- niente (in tal caso l'estensione usa qualunque mutazione tu abbia fatto a `blockedDomains`).

La funzione viene validata al salvataggio. Errori di sintassi producono un avviso di stato e la regola non viene usata finche non la correggi. Se la funzione lancia errori a runtime, l'estensione li intercetta, scrive nel console background e torna al risultato precedente.

### 11.2 Pianificazione adattiva

Le regole custom normalmente girano circa ogni secondo. Se la tua regola inizia a richiedere troppo tempo, l'estensione rallenta automaticamente il loop (fino a circa ogni 5 secondi). Non devi gestirlo manualmente.

### 11.3 L'oggetto `helpers`

Dentro la funzione, `helpers` espone diversi sotto-helper. Ognuno ha sia nome lungo sia alias corto. Ci sono anche metodi getter espliciti:

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — epoch time corrente in millisecondi.

Tutti i metodi helper sono progettati per essere sicuri: parametri errati restituiscono `null`, `false` o un valore vuoto invece di lanciare eccezioni.

#### 11.3.1 `timerHelper`

Gestisce timer countdown legati a un dominio. I timer persistono attraverso i riavvii del browser. Ogni timer appartiene al gruppo custom che lo ha creato.

- `createTimer(domain, durationMs, displayName?)` — crea e restituisce un id timer unico, oppure `null` se non valido. Esempio: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`. Mentre l'utente e su una pagina che corrisponde a quel dominio, l'overlay in pagina mostrera `Timer1: 30:00` e fara il countdown.
- `deleteTimer(id)` — elimina il timer. Restituisce `true` in caso di successo.
- `pauseTimer(id)` — mette in pausa il countdown.
- `continueTimer(id)` / `resumeTimer(id)` — riprende un timer in pausa.
- `resetTimer(id, durationMs?)` — riavvia il timer. Senza `durationMs`, riusa l'originale.
- `addMs(id, ms)` — aggiunge millisecondi (o sottrae con valori negativi).
- `remainingMs(id)` — millisecondi rimanenti.
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — boolean.
- `getDomain(id)` / `getDisplayName(id)` — legge informazioni timer.
- `findByDomain(domain)` — array di id timer per quel dominio.
- `list()` — array di `{ id, domain, displayName, durationMs, remainingMs, isPaused }` per ogni timer posseduto da questo gruppo.

La durata massima di un timer e circa 30 giorni.

#### 11.3.2 `persistenceHelper`

Storage tipo mappa con scope del tuo gruppo. I valori devono essere serializzabili in JSON. Utile per ricordare stato tra chiamate.

- `set(key, value)` — salva qualsiasi valore JSON. Restituisce `true` in caso di successo.
- `get(key, defaultValue?)` — restituisce il valore salvato, oppure `defaultValue` se manca.
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`.

Limiti morbidi: circa 200 chiavi per gruppo, 16 KB per valore.

#### 11.3.3 `domainHelper`

- `normalize(value)` — restituisce il dominio canonico come `youtube.com`, oppure `null`.
- `matches(hostname, site)` — `true` se `hostname` appartiene a `site` (gestisce sottodomini).

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — scrivono nel console background.

Per vedere questi messaggi: `chrome://extensions` → abilita Developer Mode → clicca il link "service worker" dell'estensione.

#### 11.3.5 `platformHelper`

Ispeziona le piattaforme social/video supportate.

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`.
- `normalizePlatform(value)` — restituisce il nome piattaforma canonico, oppure `null`.
- `normalizeAuthor(author, platform)` — normalizza un identificatore autore (handle, URL, ecc.) per una piattaforma specifica, oppure `null`.
- `detect(urlOrHost)` / `getContext(urlOrHost)` — restituisce `{ platform, hostname, pathname, type, authors, url }`, oppure `null`.
  - `type` e `"short" | "long" | "post" | "unknown"`.
  - `authors` e la lista di autori normalizzati rilevabili da quell'URL.
- `getType(urlOrHost)` — scorciatoia per `detect(...).type`.
- `getPlatform(urlOrHost)` — scorciatoia per `detect(...).platform`.
- `getAuthors(urlOrHost)` — scorciatoia per `detect(...).authors`.
- `matchesAuthor(urlOrHost, platform, authors)` — restituisce `true` se l'URL e su quella piattaforma e uno degli autori dati corrisponde.

### 11.4 Esempi

Facile: blocca i social media nelle mattine dei giorni feriali.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

Medio: 30 minuti di YouTube per sessione browser, con countdown visibile.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper } = helpers;
  let id = persistenceHelper.get("youtubeTimer");

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer("youtube.com", 30 * 60 * 1000, "YouTube");
    persistenceHelper.set("youtubeTimer", id);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, "youtube.com"];
  }

  return blockedDomains;
}
```

Piu difficile: blocca una sessione TikTok solo se e short videos E l'autore e nella tua lista distrattori. Usa `platformHelper`.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { platformHelper, logHelper } = helpers;
  const distractors = ["someuser", "anotheruser"];
  const url = "https://www.tiktok.com" + (globalThis.location?.pathname ?? "");
  const ctx = platformHelper.detect(url);

  if (ctx?.platform === "tiktok" && ctx.type === "short") {
    if (platformHelper.matchesAuthor(url, "tiktok", distractors)) {
      logHelper.log("Blocking TikTok short by", ctx.authors);
      return [...blockedDomains, "tiktok.com"];
    }
  }

  return blockedDomains;
}
```

(`globalThis.location` e solo un placeholder di esempio — normalmente guiderai `platformHelper` con la tua logica, non dalla location del worker, dato che il background worker non ha un vero URL pagina.)

Difficilissimo: "sito del giorno" a rotazione con limite giornaliero, persistente tra riavvii.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper, domainHelper, logHelper } = helpers;
  const sites = ["reddit.com", "twitter.com", "news.ycombinator.com"];
  const today = `${month}-${dayOfMonth}`;
  const lastDay = persistenceHelper.get("lastDay");

  if (today !== lastDay) {
    for (const id of timerHelper.list().map((t) => t.id)) {
      timerHelper.deleteTimer(id);
    }
    persistenceHelper.set("lastDay", today);
  }

  const site = sites[(month + dayOfMonth) % sites.length];
  let id = persistenceHelper.get(`timer:${site}`);

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer(site, 20 * 60 * 1000, `${site} budget`);
    persistenceHelper.set(`timer:${site}`, id);
    logHelper.log("Started budget for", site);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, domainHelper.normalize(site)];
  }

  return blockedDomains;
}
```

---

## 12. Comportamento multi-pagina

- Tutte le schede aperte nello stesso gruppo condividono lo stesso timer.
- Quando passi a una scheda nello stesso gruppo, il suo overlay si aggiorna immediatamente per mostrare il tempo condiviso corrente.
- Quando viene aggiunta una nuova regola, ogni pagina aperta rileva il cambiamento e si aggiorna in una frazione di secondo; non serve ricaricare manualmente le schede.
- Quando una regola scade, card feed nascoste e pulsanti di navigazione vengono ripristinati al refresh successivo.

---

## 13. Internazionalizzazione

L'intera UI e completamente tradotta. Usa il selettore **Language** in alto a destra.

Le lingue supportate includono inglese, cinese (semplificato), spagnolo, giapponese, coreano, piu copertura parziale per hindi, arabo, bengalese, portoghese, russo, punjabi, tedesco, francese, turco, vietnamita, italiano, thai, olandese, polacco, indonesiano, urdu e persiano. Le lingue con copertura parziale usano fallback in inglese per stringhe mancanti.

Anche il manuale carica il file markdown corrispondente alla lingua selezionata, con inglese come fallback.

---

## 14. Messaggi di stato

I messaggi di stato appaiono come toast centrato che svanisce dopo circa due secondi:

- "Saved changes."
- "Created \"Group name\"."
- Errori di validazione come "Allowed minutes must be a number greater than 0."
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

Per i campi input con requisiti di formato, il messaggio appare anche accanto al pulsante pertinente (per snooze).

---

## 15. Privacy e archiviazione

- Tutto e memorizzato localmente in `chrome.storage.local`. Nessun dato viene inviato da nessuna parte.
- Gli elementi salvati includono: i tuoi gruppi, timer di utilizzo, ultimi tempi di reset, record snooze, timer custom e valori persistenti custom.
- L'estensione non legge contenuti pagina oltre quanto necessario per rilevare il tipo di pagina (path/hostname/marker DOM noti per siti video). Non legge messaggi, post, commenti o contenuti privati.

---

## 16. Permessi

- `storage` — per i dati sopra.
- `declarativeNetRequest` — per il blocco nativo dei gruppi `Default`.
- `alarms` — per pianificare transizioni regole in modo efficiente.
- `host_permissions: <all_urls>` — cosi il content script puo mostrare l'overlay timer e rilevare il contesto piattaforma su qualsiasi pagina.

---

## 17. Risoluzione problemi

- **Un gruppo che ho aggiunto non fa nulla.** Assicurati che il gruppo sia abilitato, che la pianificazione lo consenta ora, che non ci sia snooze attivo e (per gruppi piattaforma) che la pagina corrisponda davvero al tipo contenuto e filtro autore scelti.
- **Un timer e bloccato o errato in una scheda.** Passa via e torna, oppure porta in focus la scheda: questo attiva un refresh forzato dal timer condiviso.
- **Le card feed riappaiono anche se dovrebbero essere nascoste.** L'occultamento feed funziona solo mentre la regola sta bloccando attivamente. Se hai una regola `after-minutes`, l'occultamento parte quando il tempo arriva a zero.
- **Un pulsante di navigazione YouTube che mi aspettavo nascosto e ancora li.** L'occultamento nav richiede regola su "do not filter by author" e tipo contenuto Shorts o YouTube posts. Con filtri autore, l'occultamento e solo per-card.
- **La regola custom non ha fatto nulla o ha fallito in silenzio.** Apri `chrome://extensions`, abilita Developer Mode, clicca il link "service worker" dell'estensione e controlla la console. Usa `helpers.logHelper.log(...)` per tracciare la regola.
- **Non riesco a eliminare un gruppo.** Probabilmente e frozen. I gruppi strict-frozen non possono essere eliminati finche il lock non scade; i frozen non strict possono essere eliminati tramite rituale unfreeze.

---

## 18. Glossario

- **Block group** — un set di regole con proprio tipo, comportamento, pianificazione e freeze/snooze.
- **Instant block** — la regola blocca immediatamente ogni volta che e attiva.
- **After-minutes block** — la regola inizia a bloccare solo dopo che il budget tempo del periodo e esaurito.
- **Reset interval** — con quale frequenza si resetta il budget after-minutes.
- **Schedule** — giorni + finestre orarie durante cui un gruppo e attivo.
- **Freeze / Strict freeze** — stati anti-manomissione.
- **Snooze** — disattivazione temporanea con giustificazione scritta.
- **Author filter** — per gruppi piattaforma, limita la regola a specifici creator.
- **Content type** — per gruppi piattaforma, limita la regola a forme specifiche di contenuto (short, long, post).
- **Helpers** — utility passate alla funzione di una regola custom.
- **Platform** — uno tra `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Ognuno ha proprio tipo gruppo e logica feed hiding.

---

## 19. Limitazioni

- L'occultamento feed dipende dal DOM corrente di ogni piattaforma. Se la piattaforma cambia layout, i selettori di occultamento potrebbero richiedere aggiornamento.
- Il rilevamento contesto piattaforma per siti non YouTube e per lo piu basato su URL, quindi e piu affidabile sugli URL contenuto canonici.
- I loop delle regole custom avvengono nel background worker, non nelle pagine, quindi nel funzione non sono disponibili informazioni a livello DOM. Usa invece `platformHelper.detect(url)` con una stringa URL.
- Il browser puo sospendere il service worker quando inattivo. L'estensione lo riprende appena una pagina o un alarm lo richiede; i timer di utilizzo non perderanno precisione per questo.

