# Informativa sulla privacy: blocco Web personalizzato

_Ultimo aggiornamento: 04-08-2026_

Questa pagina spiega esattamente quali dati raccoglie l'estensione del browser **blocco Web personalizzato**, dove finiscono e perché viene richiesta ciascuna autorizzazione del browser. In breve: non conserviamo le tue regole né i tuoi dati di navigazione personali. La raccolta e la classificazione facoltative di Vault Classifier restano sotto il tuo controllo e usano il bridge locale autenticato. Anche una distinta integrazione facoltativa di IA locale (MCP) è disattivata per impostazione predefinita ed espone dati solo a un assistente che colleghi e approvi tu stesso.

## Riepilogo

- **La tua configurazione resta nel tuo browser.** Gruppi di blocco, pianificazioni, regole personalizzate, registri, timer e preferenze sono conservati solo nell'archiviazione locale dell'estensione di Chrome (`chrome.storage.local`).
- **Vault Classifier è solo locale.** Se attivi esplicitamente l'integrazione facoltativa con Vault Classifier, gli elementi visibili delle schede/pagine di YouTube (come un titolo, la descrizione visibile, i tag mostrati e gli ID pubblici di creatore/video) vengono instradati solo tramite il bridge locale autenticato di Vault verso Vault Classifier sul tuo Mac. Non vengono inviati al nostro sito web, a un fornitore di modelli, all'API Data di YouTube né ad alcun altro server.
- **La raccolta è un consenso a parte.** Vault Classifier chiede all'estensione i metadati di YouTube renderizzati e senza pubblicità solo dopo che hai attivato la raccolta di YouTube nel suo spazio di lavoro dei dati di classificazione. Quando è disattivata, l'estensione non invia alcun titolo o metadato del creatore per la raccolta. Quando è attivata, i campi locali conservati possono includere un titolo visibile, il nome/identificatore del creatore, il tipo di video, la durata, il testo visibile di iscritti/visualizzazioni/data di pubblicazione e l'URL canonico.
- **Integrazione facoltativa di IA locale (MCP).** Se la attivi e colleghi il tuo assistente di IA, tale assistente può — su tua indicazione esplicita — leggere dati selezionati (la tua configurazione, l'attività, il tempo di utilizzo, gli URL delle schede attive/aperte, il contenuto visibile delle pagine sui siti che hai configurato e qualsiasi evidenza di Classifier) tramite un server Vault locale sul tuo dispositivo. È disattivata per impostazione predefinita, ogni connessione è approvata da te e le password e le chiavi API non sono mai leggibili tramite essa. Vedi «Integrazione facoltativa di IA locale (MCP)» più avanti.
- **Non esistono analisi, profili pubblicitari, telemetria o segnalazioni di arresti anomali.**
- **Nessun tracciamento** dell'attività di navigazione oltre a quanto strettamente necessario per applicare le regole di blocco che hai configurato tu stesso.

## Cosa viene memorizzato localmente

L'estensione memorizza quanto segue nell'archiviazione locale dell'estensione del tuo browser per poter svolgere il suo compito tra una sessione e l'altra:

- I gruppi di blocco che crei: i loro nomi, i tipi di regola, gli elenchi di siti bloccati, le pianificazioni, le impostazioni di posticipo (snooze), lo stato di congelamento e qualsiasi JavaScript di regola personalizzata che scrivi.
- Lo stato di esecuzione per gruppo necessario ad applicare i limiti (ad es. quanti minuti di un budget di permesso differito restano oggi, quando termina un posticipo, quando termina un periodo di congelamento rigido).
- Le tue preferenze impostate in **Impostazioni** (frequenza di aggiornamento, ritardo del salvataggio automatico, durata di posticipo predefinita, URL di ripiego predefinito, interruttore della modalità di debug, lingua dell'interfaccia scelta).
- Le voci del registro attività mostrate nel pannello **Registro** dell'app, che puoi cancellare dall'interfaccia.
- Quando attivi esplicitamente Vault Classifier, la sua app locale mantiene una cache locale, limitata dall'utente, delle evidenze visibili, dei punteggi locali, delle decisioni e delle correzioni necessarie a classificare e spiegare le voci. Questa cache resta sul tuo Mac e non fa parte del normale traffico tra estensione e server.

La tua configurazione, lo stato di esecuzione e il registro attività restano sul tuo dispositivo e non vengono salvati dal nostro servizio. A seconda della build del browser e delle funzionalità che attivi, possono essere elaborati dall'estensione, dalla sua app companion locale per Safari o da un bridge Vault locale esplicitamente collegato.

## Cosa NON viene raccolto o trasmesso

Questo descrive il comportamento dell'estensione di per sé. L'unica eccezione è l'integrazione facoltativa di IA locale (MCP) che puoi attivare e collegare tu stesso, descritta nella sezione successiva.

- La cronologia di navigazione non viene registrata, riassunta o trasmessa dall'estensione stessa; serve solo ad applicare le regole che hai configurato.
- Il contenuto delle pagine non viene esfiltrato, acquisito come schermata o registrato dall'estensione stessa.
- Le evidenze di Vault Classifier non vengono trasmesse fuori dal dispositivo dall'estensione. Vengono elaborate dal bridge locale abbinato e dall'app solo quando attivi esplicitamente tale integrazione.
- Gli input dei moduli e le password non vengono mai letti dall'estensione; le password e le chiavi API non sono leggibili nemmeno tramite l'integrazione di IA locale (MCP).
- Nessun identificatore dell'estensione, dell'account o del dispositivo, né la tua configurazione delle regole, viene trasmesso per la normale applicazione delle regole.

## Integrazione facoltativa di IA locale (MCP)

L'estensione può, facoltativamente, rispondere alle richieste di un **server MCP Vault** locale in esecuzione all'interno delle app desktop di Vault sul tuo dispositivo, così puoi collegare il tuo assistente di IA (un «client MCP») e fargli leggere la tua configurazione di Vault o agire su di essa per te. Questa integrazione è **disattivata per impostazione predefinita** e non cambia nulla finché non la attivi deliberatamente.

- **Sei tu ad avviarla.** Nulla viene esposto finché non attivi l'integrazione e colleghi un client MCP, e ogni connessione di un client è approvata da te. Disattivarla revoca immediatamente l'accesso.
- **Il server è locale.** I dati forniti dall'estensione vengono consegnati, tramite lo stesso bridge autenticato del dispositivo, a un server MCP Vault sul tuo Mac, non al nostro sito web né ad alcun server Vault. L'estensione stessa non invia i tuoi dati a terzi.
- **Poi decide il tuo assistente.** Una volta che un client MCP collegato riceve dati su tua richiesta, ciò che ne viene fatto è regolato da **quel client** e dalle sue condizioni sulla privacy. Se l'assistente che hai scelto si appoggia a un servizio remoto, tale assistente può trasmettere i tuoi dati su tua indicazione, proprio come quando incolli informazioni in un qualsiasi strumento di IA. Scegli un client di cui ti fidi.
- **Cosa può essere esposto.** Su tua indicazione, un assistente collegato può leggere i tuoi gruppi di blocco, le pianificazioni, le regole personalizzate, il registro attività, i contatori del tempo di utilizzo, l'URL della scheda attiva o delle schede aperte, il contenuto visibile delle pagine sui siti che hai configurato e qualsiasi evidenza e decisione di Vault Classifier. Le azioni che modificano lo stato (modificare gruppi, avviare un posticipo, eseguire una regola salvata, avviare una classificazione) vengono confermate singolarmente.
- **I segreti restano segreti.** Le password (come una password di controllo parentale) e le chiavi API dei fornitori sono di **sola scrittura** tramite questa integrazione: possono essere impostate, ma nessun assistente può rileggerle.
- **Solo Chromium.** Come il bridge di Classifier, questa integrazione esiste solo nei browser Chromium con l'host locale del dispositivo; Firefox e Safari non la espongono.

## Perché viene richiesta ciascuna autorizzazione

| Autorizzazione | A cosa serve |
| --- | --- |
| `storage` | Salvare e caricare i tuoi gruppi di blocco, le impostazioni e lo stato di esecuzione solo nel tuo browser. |
| `favicon` | Mostrare accanto alle regole le icone dei siti memorizzate nella cache del browser in Chromium. Questo non invia la cronologia di navigazione né effettua richieste al nostro servizio. |
| `nativeMessaging` | In Chromium, richiedere al dispositivo una prova di Native Messaging locale per il bridge autenticato di Vault Classifier; in Safari, inoltrare le richieste della sandbox delle regole personalizzate all'app contenitore locale del dispositivo. Non è un trasporto nel cloud. |
| `alarms` | Riattivare il service worker in background secondo la pianificazione per aggiornare i limiti basati sul tempo e lo stato delle regole al termine di una finestra di posticipo, congelamento o pianificazione. |
| `offscreen` | Eseguire il JavaScript delle regole personalizzate in una sandbox all'interno di un documento fuori schermo, così da non poter uscire dall'estensione né toccare direttamente le tue pagine. |
| `tabs` | Aprire l'editor come scheda intera quando fai clic sull'icona della barra degli strumenti, consultare l'URL della scheda attiva per valutare le regole di gruppo e ricaricare le schede dopo una modifica di regola effettuata nell'editor. |
| `webNavigation` | Rilevare i cambi di URL delle SPA (navigazione push-state) affinché gli occultatori di feed per piattaforma e le regole basate su eventi possano reagire alla navigazione all'interno della pagina, non solo ai caricamenti di pagina completi. |
| Accesso host `<all_urls>` | Applicare le tue regole di blocco e gli occultatori di feed per piattaforma sui siti che scegli di bloccare. L'estensione legge/modifica le pagine solo sugli URL per cui hai attivamente configurato una regola, e solo per applicarla; l'adattatore facoltativo di Vault Classifier è limitato a YouTube. |

## Regole personalizzate

Se scrivi regole JavaScript personalizzate, tale codice:

- Viene eseguito in un documento fuori schermo in sandbox; non può raggiungere direttamente la rete, le tue pagine o altre estensioni.
- Comunica con gli script di contenuto solo tramite un bridge di messaggi fisso definito dall'API ausiliaria dell'estensione.
- Viene automaticamente messo in quarantena (disattivato con una voce di registro) se supera i limiti integrati di CPU, registro, post-message o mutazioni del DOM.

Le tue regole personalizzate sono memorizzate localmente insieme al resto delle tue impostazioni e non vengono mai trasmesse fuori dal dispositivo.

## Statistiche del sito web

Questa sezione riguarda il **sito web**. Il sito web pubblica un piccolo pannello **Statistiche** e, per popolarlo, il server conserva alcuni conteggi aggregati:

- **Conteggi dei download** — quante volte è stato cliccato il pulsante di download di ciascun prodotto (macOS, Windows, estensione del browser, Safari).
- **Account** — quanti account esistono.
- **Attività di domande e risposte** — il numero totale di post e commenti del forum.

Una volta all'ora il server registra il valore attuale di ciascun conteggio aggregato. Queste istantanee non contengono alcun evento per visitatore, sequenza di clic o cronologia di sessione.

- **Completamente anonimo / deidentificato.** Sono semplici totali progressivi. **Non** sono collegati al tuo nome, account, e-mail, indirizzo IP, dispositivo o qualsiasi altro identificatore: non c'è modo di attribuire un conteggio a una persona.
- **Mai commerciale.** Questi dati esistono solo per mostrare il pannello pubblico Statistiche. **Non vengono mai venduti, condivisi con terzi, usati per pubblicità o per qualsiasi altro scopo commerciale.**

## Bambini

L'estensione è uno strumento di produttività di uso generale. Non è rivolta ai bambini, non raccoglie consapevolmente dati da nessuno e non mostra pubblicità.

## Modifiche a questa informativa

Se in una versione futura le pratiche relative ai dati dovessero cambiare, questo file verrà aggiornato e la modifica sarà riassunta nelle note di versione di tale pubblicazione.

## Contatto

Domande, dubbi o segnalazioni di bug: apri una issue nel repository di origine dell'estensione o usa l'e-mail di assistenza indicata nella scheda del Chrome Web Store.
