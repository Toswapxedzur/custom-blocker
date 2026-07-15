# Informativa sulla privacy: blocco Web personalizzato

_Ultimo aggiornamento: 13-07-2026_

Questa pagina spiega esattamente quali dati utilizza il browser **Custom Web Blocker**
l'estensione raccoglie, dove va e perché è l'autorizzazione di ciascun browser
richiesta. In breve: non salviamo le tue regole né i tuoi dati personali di
navigazione. Le regole per tag possono interrogare ID pubblici di canali YouTube,
ma tali richieste non vengono conservate né collegate a te.

## Riepilogo

- **La configurazione resta nel browser.** Gruppi, orari, regole, registri,
  timer e preferenze sono salvati solo in `chrome.storage.local`.
- **Le richieste contengono soltanto ID pubblici di canali.** Non includono URL,
  titolo, ricerca, orario, account o impostazioni dell'estensione.
- **Le richieste non vengono salvate.** L'endpoint è di sola lettura, non
  inserisce canali sconosciuti e non associa la richiesta a una persona.
- **Nessuna analisi, telemetria, pubblicità o segnalazione di arresti anomali.**
- **Nessun tracciamento** dell'attività di navigazione oltre quanto strettamente necessario
  per applicare le regole di blocco da te configurate.

## Cosa viene archiviato localmente

L'estensione memorizza quanto segue nell'estensione locale del tuo browser
storage in modo che possa svolgere il proprio lavoro tra le sessioni:

- I gruppi di blocchi che crei: i loro nomi, tipi di regole, elenchi di
  siti bloccati, pianificazioni, impostazioni di posticipazione, stato di blocco e altro
  JavaScript con regola personalizzata che scrivi.
- Stato di runtime per gruppo necessario per applicare i limiti (ad esempio quanti
  i minuti di un budget per l'indennità ritardata rimangono oggi, quando viene posticipato
  termina, al termine del periodo di congelamento rigoroso).
- Le tue preferenze impostate in **Impostazioni** (tasso di spunta, salvataggio automatico
  antirimbalzo, durata posticipazione predefinita, URL di fallback predefinito, modalità debug
  alterna, lingua dell'interfaccia utente scelta).
- Voci del registro attività mostrate nel pannello **Registro** in-app, che puoi
  chiaro dall'interfaccia utente.

Questi dati vengono letti e scritti solo dagli script propri dell'estensione
sul tuo dispositivo e solo all'interno del tuo profilo del browser.

## Ciò che NON viene raccolto né trasmesso

- La cronologia di navigazione non viene registrata, riepilogata o trasmessa.
- Il contenuto della pagina non viene estratto, schermato o registrato.
- L'input del modulo, le password e le informazioni personali non vengono mai letti.
- Nessuna informazione su di te, sul tuo dispositivo o sul tuo utilizzo viene inviata a
  autore dell'estensione o di terze parti.

## Perché viene richiesta ogni autorizzazione

| Autorizzazione | A cosa serve |
| --- | --- |
| `storage` | Salva e carica i gruppi di blocco, le impostazioni e lo stato di runtime solo nel tuo browser. |
| `favicon` | Mostra in Chromium, accanto alle regole, le icone dei siti già memorizzate nella cache del browser. Non invia la cronologia né contatta il nostro servizio. |
| `nativeMessaging` | Solo in Safari, inoltra le richieste della sandbox delle regole personalizzate all'app locale sul dispositivo. Non è un trasporto cloud. |
| `alarms` | Riattiva l'operatore dei servizi in background secondo la pianificazione per aggiornare i limiti basati sul tempo e aggiornare lo stato delle regole al termine di una finestra di posticipazione, blocco o pianificazione. |
| `offscreen` | Esegui JavaScript con regole personalizzate in modalità sandbox in un documento fuori schermo in modo che non possa sfuggire all'estensione o toccare direttamente le tue pagine. |
| `tabs` | Apri l'editor come scheda completa quando fai clic sull'icona della barra degli strumenti, cerca l'URL della scheda attiva per valutare le regole del gruppo e ricarica le schede dopo una modifica alle regole apportata nell'editor. |
| `webNavigation` | Rileva le modifiche agli URL SPA (navigazione con stato push) in modo che gli hider di feed per piattaforma e le regole guidate dagli eventi possano reagire alla navigazione in-page, non solo ai caricamenti di pagine intere. |
| `<all_urls>` accesso host | Applica le tue regole di blocco e gli hider di feed per piattaforma su qualunque sito tu scelga di bloccare. L'estensione legge/modifica le pagine solo sugli URL per i quali hai configurato attivamente una regola e solo per applicare tale regola. |

## Regole personalizzate

Se scrivi regole JavaScript personalizzate, quel codice:

- Viene eseguito in un documento fuori schermo in modalità sandbox; non può raggiungere direttamente il
  rete, le tue pagine o altre estensioni.
- Comunica con gli script di contenuto solo tramite un bridge di messaggi fisso
  definito dall'API helper dell'estensione.
- Viene automaticamente messo in quarantena (disabilitato con una voce di registro) se
  supera i limiti integrati di CPU, log, post-messaggio o mutazione DOM.

Le tue regole personalizzate vengono archiviate localmente con il resto delle tue impostazioni
e non vengono mai trasmessi dal dispositivo.

## Statistiche del servizio sito web e tag creatore

Questa sezione riguarda il **sito web e il servizio di tag dei creator**.
L'estensione può interrogare ID pubblici di canali in sola lettura; tali
richieste non vengono conservate. Il sito pubblica un piccolo pannello di **statistiche**
pannello e per popolarlo il server conserva alcuni conteggi aggregati:

- **Conteggio download**: quante volte è stato visualizzato il pulsante di download di ciascun prodotto
  cliccato (macOS, Windows, estensione del browser, Safari).
- **Creatori classificati**: quanti creatori di YouTube sono stati taggati.
- **Account**: quanti account esistono.
- **Attività di domande e risposte**: il numero totale di post e commenti del forum.

Una volta ogni ora il server registra il valore corrente di ciascuno di questi conteggi e
nient'altro. Non sono presenti record per evento, flussi di clic e sessioni
storia.

- **Completamente anonimo/non identificato.** Questi sono totali parziali. Loro
  **non** sono collegati al tuo nome, account, email, indirizzo IP, dispositivo o altro
  altro identificatore: non è possibile attribuire un conteggio a una persona.
- **Mai commerciale.** Questi dati esistono solo per mostrare le statistiche pubbliche
  pannello. Non viene **mai venduto, condiviso con terzi, utilizzato per pubblicità,
  o utilizzato per qualsiasi altro scopo commerciale.**
- **Contributi facoltativi per l'ID canale.** Se, e solo se, aderisci, il
  l'estensione/il sito web possono condividere gli **ID canale** di YouTube (mai titoli di video,
  cronologia visualizzazioni o qualsiasi cosa personale) per aiutare a classificare i creatori per tutti.
- **Contributi manuali.** Per gli invii volontari di utenti autenticati,
  l'associazione e-mail/ID canale è conservata solo nella finestra mobile di
  24 ore e viene eliminata dalla pulizia oraria.
- **Coda pubblica.** Può mostrare l'ID pubblico e lo stato, ma non l'ora di
  invio né l'identità di chi lo ha fornito.

## Bambini

L'estensione è uno strumento di produttività generico. Non lo è
rivolto ai bambini, non raccoglie consapevolmente dati da nessuno, e
non mostra pubblicità.

## Modifiche a questa politica

Se le pratiche relative ai dati dovessero cambiare in una versione futura, questo file lo farà
essere aggiornato e la modifica verrà riepilogata nelle note di versione per
quella liberazione.

##Contatto

Domande, dubbi o segnalazioni di bug: apri un problema su
repository di origine dell'estensione o utilizzare l'e-mail di supporto elencata nel file
Elenco del Chrome Web Store.
