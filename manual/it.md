# Riferimento funzionale dell'estensione Vault

## Scopo e status

Questa è la specifica funzionale autorevole per l'estensione del browser Vault. Documenta il contratto del prodotto: i dati che un utente può configurare, i comportamenti esatti prodotti dalla configurazione, il linguaggio pubblico delle regole personalizzate e i limiti ad esso applicabili.

Volutamente non è una guida rapida. Il tutorial del sito web è il percorso di apprendimento. Questo documento è rivolto a chi ha bisogno di configurare, testare, mantenere, controllare o riprodurre il comportamento visibile all'utente di Vault.

Il codice è la verità canonica quando questo documento e il prodotto non sono d'accordo. I nomi presenti in questo documento utilizzano, ove possibile, il vocabolario archiviato/pubblico del prodotto. Una parola come "resi" indica il valore restituito reso disponibile per una regola personalizzata; non promette un risultato a livello di browser se il browser o la pagina rifiuta l'azione richiesta.

## 1. Confine del prodotto

Vault è un'estensione Web per il controllo del focus. La sua unità di configurazione è un **gruppo di blocchi**. Un gruppo può:

- decidere che un sito web, una pagina della piattaforma, un creatore, una comunità, un server, un canale o un account di primo livello debbano essere bloccati;
- nascondere le superfici della piattaforma configurate o le schede feed corrispondenti;
- misurare il tempo trascorso in un ambito corrispondente;
- applicare una pianificazione, una protezione dal blocco o una posticipazione temporanea laddove il tipo di gruppo lo supporta;
- eseguire una regola JavaScript personalizzata con un'API di eventi;
- mostrare un timer, un pannello, un messaggio o un registro della pagina sulla pagina;
- reindirizzare, navigare, chiudere una scheda del browser o mantenere una blocklist del sito creata da regole di sola sessione;
- facoltativamente partecipare a un cluster Vault Bridge connesso localmente.

Vault agisce solo all'interno del profilo del browser in cui è installato e solo dove il browser consente l'esecuzione dello script di contenuto. Non:

- installare un'applicazione nativa o un'estensione del browser;
- bloccare le applicazioni del sistema operativo;
- ignorare le richieste di autorizzazione del browser, le restrizioni di navigazione privata o il modello di sicurezza di un sito Web;
- garantire l'occultamento basato sul selettore quando una piattaforma di terze parti cambia il suo DOM;
- rendere lo stato della regola personalizzata trasferibile tra i profili a meno che l'utente non lo esporti/configuri separatamente;
- fornire un firewall di rete, un proxy, un controllo dell'account o un servizio di monitoraggio parentale.

La seguente terminologia viene utilizzata ovunque:

| Termine | Significato |
| --- | --- |
| Gruppo | Un oggetto di configurazione con nome indipendente. I nomi devono essere univoci all'interno dell'estensione, ignorando le maiuscole e minuscole. |
| Gruppo del sito | Un gruppo normale la cui lista di domini è la sua principale condizione di corrispondenza. |
| Gruppo piattaforma | Un normale gruppo specializzato per YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord o Twitter/X. |
| Gruppo personalizzato | Un gruppo che possiede una regola JavaScript e le relative registrazioni di eventi. La sua regola ne decide il comportamento. |
| Partita | La pagina, l'elemento del feed o la superficie della piattaforma soddisfa le condizioni configurate di un gruppo. |
| Attivo | Il gruppo è abilitato, idoneo per la sua pianificazione e al momento non posticipato. I gruppi personalizzati non sono gestiti dalla normale interfaccia utente della pianificazione. |
| Blocca | Impedisci che la pagina di livello superiore corrente rimanga utilizzabile, normalmente reindirizzando alla sua destinazione di fallback. |
| Nascondi | Rimuovi o nascondi un elemento/carta nella pagina attualmente renderizzata. Nascondersi non è un blocco della rete. |
| URL di riserva | Una destinazione di reindirizzamento specifica del gruppo. Se vuoto, viene utilizzato il fallback globale. |
| Effetto autorizzazione/eccezione | Un verdetto della scheda piattaforma che salva il contenuto corrispondente dalle regole di nascondere con priorità inferiore. Non si tratta di una lista consentita generale di siti Web. |

##2. Modello di gruppo e ciclo di vita comune

Ogni gruppo memorizzato ha un ID stabile, un nome, un tipo, un flag abilitato e campi di policy comuni. Per impostazione predefinita è abilitato un nuovo gruppo normale. Un gruppo può essere selezionato, salvato tramite il comportamento di salvataggio automatico dell'editor, riordinato, esportato, importato, congelato, sbloccato, posticipato, disabilitato o eliminato.

### 2.1 Ordinamento e sovrapposizione

Più di un gruppo può corrispondere alla stessa pagina. Vault valuta i gruppi archiviati dalla fine dell'elenco visualizzato verso l'inizio. Tratta gli elementi inferiori nell'elenco come corrispondenze successive/con precedenza superiore quando si progettano regole di sovrapposizione.

Per il blocco ordinario del sito di livello superiore, qualsiasi gruppo di blocco applicabile può rendere la pagina non disponibile. Per il filtraggio delle schede feed, la cascata della piattaforma utilizza l'ordine e l'effetto di ciascun gruppo corrispondente: una successiva autorizzazione/eccezione corrispondente può salvare un elemento dai predicati di blocco con priorità inferiore. Questo comportamento di eccezione è limitato alla superficie di filtraggio della scheda della piattaforma; non annulla un normale blocco del sito dell'intera pagina.

### 2.2 Stato abilitato

I gruppi disabilitati vengono conservati ma non partecipano alla normale corrispondenza, ai timer, alle pianificazioni o alle normali operazioni di posticipazione. La disabilitazione di un gruppo personalizzato scarica anche le sue registrazioni attive. La riattivazione non trasforma il testo non salvato in una regola personalizzata attiva; eseguire la regola per caricare l'origine salvata.

### 2.3 Campi comuni

| Campo | Significato e vincoli |
| --- | --- |
| Nome | Non vuoto, tagliato e univoco senza distinzione tra maiuscole e minuscole all'interno di questo endpoint. Il bridge identifica anche i gruppi collegabili per nome e tipo, quindi i nomi stabili sono importanti. |
| Abilitato | Abilita o disabilita la corrispondenza normale. |
| Comportamento | Blocco istantaneo, blocco dopo un permesso o timer/conteggio alla rovescia. I gruppi personalizzati utilizzano la propria regola anziché questo normale selettore di comportamento. |
| Minuti consentiti | Numero positivo utilizzato dal comportamento blocco dopo tolleranza. I nuovi gruppi hanno una durata predefinita di 15 minuti. |
| Reimposta ore intervallo | Numero positivo utilizzato dai gruppi normali cronometrati. Per impostazione predefinita, i nuovi gruppi hanno 24 ore. |
| Giorni attivi | Dal lunedì alla domenica. Un gruppo normale è inattivo quando il giorno della settimana locale corrente non è selezionato. |
| Finestre temporali | Zero o più finestre dell'ora locale, una per riga, scritte come HHMM-HHMM. |
| Modalità congelamento | Nessuno, Bloccato, Bloccato rigorosamente o Bloccato dai genitori. |
| Politica di posticipazione | Indica se il gruppo consente la posticipazione, con controlli di durata/ritardo/causa/conferma per i gruppi normali. |
| URL di riserva | Destinazione utilizzata se il gruppo blocca una pagina. |
| Passa al successivo | Quando previsto nell'editor, chiede al normale flusso di blocco di oltrepassare la destinazione bloccata anziché rimanervi. |

### 2.4 Comportamenti normali di gruppo

L'editor normale offre tre comportamenti:

| Comportamento | Risultato funzionale |
| --- | --- |
| Blocca immediatamente | Una volta che il gruppo è attivo e corrisponde, la normale decisione di bloccare la pagina è immediata. |
| Blocca dopo un certo numero di minuti | Il tempo corrispondente alla pagina visibile viene incrementato rispetto al limite configurato. Quando la disponibilità è esaurita, il gruppo normale si blocca finché il suo periodo di utilizzo non viene reimpostato o il gruppo viene altrimenti inattivo/posticipato. |
| Timer (conteggio progressivo, nessun blocco) | Il tempo corrispondente alla pagina visibile viene registrato e può essere visualizzato. Questa modalità non si blocca mai semplicemente perché il suo timer raggiunge un valore. |

L'utilizzo temporizzato si basa sul tempo della pagina visibile. Non è previsto l'addebito del tempo mentre una pagina è nascosta in una scheda in background. L'intervallo di reimpostazione è un intervallo di criteri a rotazione per il gruppo a tempo normale. I timer normali sono indipendenti per gruppo.

### 2.5 Orari

Gli orari si applicano ai gruppi normali. Un gruppo personalizzato non ha un'interfaccia utente di pianificazione normale ed è considerato attivo ai fini del relativo JavaScript; la regola deve imporre essa stessa qualsiasi condizione temporale desiderata.

La politica dei giorni attivi viene valutata utilizzando l'ora locale:

1. Se il giorno della settimana corrente non è selezionato, il gruppo normale è inattivo.
2. Se non vengono fornite finestre temporali valide, per giorno attivo si intende l'intera giornata.
3. Se vengono fornite finestre valide, l'ora locale corrente deve essere presente in almeno una finestra.

Ogni finestra ha la forma esatta HHMM-HHMM, ad esempio 0900-1200. Le ore devono essere comprese tra 00 e 23, i minuti tra 00 e 59 e l'inizio deve essere prima della fine dello stesso giorno. Una finestra include il suo inizio ed esclude la sua fine. Le finestre oltre la mezzanotte, come 2300-0100, non sono valide. Le righe vuote vengono ignorate e le finestre duplicate vengono compresse.

### 2.6 Posticipa

Per un gruppo normale, la ripetizione è uno stato inattivo temporaneo con un massimo di tre fasi:

| Fase | Risultato |
| --- | --- |
| In attesa | La ripetizione richiesta esiste ma non è stata avviata a causa del ritardo di attivazione. Il gruppo è ancora attivo. |
| Attivo | Il gruppo è temporaneamente inattivo per la durata della posticipazione. |
| Raffreddamento | La posticipazione è terminata, il gruppo è di nuovo attivo e un'altra posticipazione non può iniziare finché non scade il tempo di recupero. |

I campi di configurazione del gruppo normale sono:

| Campo | Regola |
| --- | --- |
| Consenti posticipazione | Se disattivato, non è possibile avviare la funzione snooze normale. |
| Durata posticipo | Minuti positivi. Un nuovo gruppo normale assume il valore predefinito globale, inizialmente 30. |
| Ritardo di attivazione | Zero o più minuti. Vuoto significa zero. |
| Raffreddamento | Da zero a cinque minuti. Vuoto significa zero. |
| Conferme | Un numero intero non negativo. Il prodotto richiede molte interazioni di conferma prima di soddisfare la richiesta. |

Un gruppo personalizzato tratta il pulsante Posticipa solo come un evento di input. Vault emette l'evento personalizzato denominato snoozePress per quel gruppo; non applica il normale fallback di durata/ritardo/carico per conto della regola. Una regola personalizzata può utilizzare l'evento, la propria persistenza, un pannello, un timer o nessuna azione.

### 2.7 Congelare

Il congelamento protegge un gruppo dalle normali modifiche alla configurazione e dalle normali modifiche posticipate. La scelta di una modalità di congelamento nel selettore non blocca il gruppo da solo; l'azione di congelamento applica la modalità scelta.

| Modalità | Contratto funzionale |
| --- | --- |
| Congelato | Il gruppo è bloccato fino al completamento del normale flusso di conferma dello scongelamento del prodotto. |
| Rigorosamente congelato | Il gruppo non può essere sbloccato finché non è trascorso il periodo di congelamento rigoroso. La durata deve essere maggiore di zero e non superiore a 72 ore; un nuovo gruppo ha come impostazione predefinita 24 ore. |
| Parentale congelato | Per la gestione del blocco/sblocco è richiesta una password di protezione. La finestra di dialogo di configurazione utilizza una password di sei cifre. |

I gruppi congelati non possono essere modificati tramite campi ordinari. Un cluster collegato tramite bridge con un membro offline può anche bloccare i controlli di blocco perché Vault non è in grado di coordinare in modo sicuro lo stato di blocco nel cluster. Il blocco è la protezione contro le normali operazioni dell'interfaccia utente; non trasforma un profilo del browser in un limite di sicurezza immutabile.

### 2.8 Importa, esporta, cancella e ripristina

L'esportazione produce una rappresentazione compatibile del gruppo selezionato. L'importazione convalida e normalizza i dati del gruppo compatibile prima di aggiungerli. I nomi dei gruppi importati devono essere comunque univoci. Elimina gruppo rimuove il gruppo e il suo normale stato di utilizzo/posticipazione. Cancella rimuove tutti i gruppi dopo la conferma.

Il ripristino delle impostazioni predefinite è un'operazione di **impostazioni globali**. Scarta le preferenze a livello di estensione; non è un sostituto dell’importazione/esportazione e dovrebbe essere trattato come distruttivo.

## 3. Tipologie di gruppo e contratto di abbinamento

### 3.1 Gruppo di siti Web predefinito

Un gruppo di siti possiede un elenco di siti Web separati da righe. Le voci sono normalizzate nel formato host/dominio. Una voce host corrisponde a quell'host e a tutti i suoi sottodomini.

| Impostazione | Risultato |
| --- | --- |
| Blocca tutto tranne questi siti | L'elenco è una lista bloccata. Un host corrispondente è bloccato. |
| Blocca tutto tranne questi siti su | L'elenco è una lista consentita. Tutti gli host non presenti nell'elenco vengono bloccati. Una lista consentita vuota è quindi un blocco intenzionale dell'intero Web. |
| Blocca la home page | Applica i criteri del gruppo alla superficie iniziale/home del browser configurata dove il controllo è disponibile. |
| URL di riserva | Reindirizzare la destinazione per un blocco. Un valore di gruppo vuoto torna al valore predefinito globale. |

Il normale elenco di domini del gruppo di siti è l'unico elenco dichiarativo dell'intero sito esposto dall'editor. I gruppi di piattaforme corrispondono invece alla propria piattaforma e alle condizioni della piattaforma configurata.

### 3.2 Gruppi di piattaforme video

YouTube, TikTok, Facebook, Instagram e Twitch sono gruppi di piattaforme video. Ciascuno è limitato al proprio host di piattaforma. Un gruppo può scegliere come target il modulo del contenuto, l'ambito dell'autore/account, il feed home della piattaforma e i controlli opzionali per nascondere gli elementi.

Le modalità generali dell'autore sono:

| Modalità | Risultato |
| --- | --- |
| Tutti | Non limitare per autore; altri assi configurati decidono la corrispondenza. |
| Includi | Corrisponde solo ai creatori/account normalizzati elencati. |
| Escludi | Corrisponde a tutti i creatori/account rilevati tranne le voci elencate. |
| Nessuno | Non corrisponde a nessun autore. Questo è un asse dell'autore deliberatamente non corrispondente. |
| Il tag include | Abbina i creatori a qualsiasi tag elencato quando Vault può classificarli. I creatori sconosciuti/non classificati non riescono ad aprire. |
| Escludi tag | Abbina gli autori senza i tag configurati quando Vault può classificarli. I creatori sconosciuti/non classificati non riescono ad aprire. |

Le scelte relative alla forma del contenuto sono specifiche della piattaforma:

| Piattaforma | Moduli di contenuto |
| --- | --- |
| YouTube | Tutte le pagine, cortometraggi, video lunghi, post. |
| TikTok | Tutte le pagine, brevi video. |
| Facebook | Tutte le pagine, i reel, i video, i post. |
| Instagram | Tutte le pagine, i reel, i video, i post. |
| Contrazione | Tutte le pagine, clip, stream/VOD, pagine canale. |

Vault normalizza l'input dell'autore. L'editor accetta il normale modulo handle/canale/pagina della piattaforma e gli URL dei profili supportati. Potrebbe rifiutare voci dal formato errato o mostrarle come non valide anziché trasformarle silenziosamente in un obiettivo diverso.

Le scelte di Nascondi superficie sono indipendenti dal blocco di livello superiore. Influiscono solo sull'interfaccia utente corrente della piattaforma e possono smettere di funzionare quando la piattaforma modifica il proprio markup.

| Piattaforma | Scelte di elementi nascosti spediti |
| --- | --- |
| YouTube | Navigazione/scaffali/schede di cortometraggi, feed home promossi/superfici pubblicitarie e commenti. L'opzione relativa agli annunci presenta un avviso perché nascondere gli annunci potrebbe entrare in conflitto con i termini di una piattaforma. |
| TikTok | Esplora la navigazione. |
| Facebook | Navigazione dei rulli e superfici dei rulli. |
| Instagram | Navigazione/superfici su Bobine ed Esplora. |
| Contrazione | Sfoglia la navigazione. |

La corrispondenza dei tag creatore di YouTube utilizza le classificazioni dei canali locali/disponibili. Una classificazione mancante non diventa un blocco semplicemente perché è stata selezionata una modalità tag.

### 3.3 Reddit

Un gruppo Reddit si applica solo su Reddit. La sua entità è un subreddit. L'input del subreddit accetta il modulo ordinario della comunità e lo normalizza prima della corrispondenza.

Le modalità subreddit sono:

| Modalità | Risultato |
| --- | --- |
| Tutti | Applica a Reddit senza restrizioni nell'elenco subreddit. |
| Includi | Applica ai subreddit elencati. |
| Escludi | Applica a tutti tranne che ai subreddit elencati. |
| Nessuno | Non applicare a nessun subreddit. |

L'opzione Nascondi superficie fornita nasconde la navigazione Popolari/Tutti. Il comportamento delle carte feed dipende dalla struttura delle carte attualmente rilevabile da Reddit.

### 3.4 Discordia

Un gruppo Discord si applica solo alle pagine Discord/Discordapp. Il suo obiettivo è un ID server o una coppia server/canale. L'editor di destinazione accetta valori del percorso del canale Discord normalizzati.

| Modalità | Risultato |
| --- | --- |
| Tutti | Applica a Discord senza restrizioni sull'elenco di destinazione. |
| Includi | Si applica solo ai server elencati o alle destinazioni server/canale. |
| Escludi | Si applica a tutti tranne i target elencati. |
| Nessuno | Non applicare a nessun target. |

Discord attualmente non ha una scelta di elementi nascosti nel normale profilo della piattaforma.

### 3.5 Twitter/X

Un gruppo Twitter/X si applica su X/Twitter. Può applicarsi a tutti gli account o utilizzare le modalità account generali descritte per le piattaforme video, con input normalizzato per handle/collegamento al profilo.

Le scelte degli elementi nascosti forniti sono Esplora, Messaggi, Grok, Tendenze e elementi del feed sponsorizzati. Come per tutti i controlli di superficie basati su selettore, una modifica del markup X può influenzarne il funzionamento.

### 3.6 Campi dichiarativi di gruppo personalizzati

Un gruppo personalizzato esegue principalmente la propria origine JavaScript. Non utilizza il normale selettore del comportamento o la normale interfaccia utente della pianificazione. Può comunque contenere una lista di domini importati o configurati tramite dati compatibili:

- una blocklist personalizzata non vuota può partecipare alla decisione ordinaria del sito a pagina intera;
- una lista consentita personalizzata può partecipare anche se vuota, producendo un blocco dichiarativo dell'intero web;
- un gruppo personalizzato non configurato non blocca accidentalmente le pagine semplicemente perché ha una regola;
- I timer personalizzati non si bloccano mai da soli; una regola decide esplicitamente se bloccare allo scadere del timer.

## 4. Impostazioni globali

Le impostazioni globali si applicano all'interno anziché a un gruppo.

| Impostazione | Predefinito | Comportamento |
| --- | --- | --- |
| Tasso di spunta | 1000ms | Frequenza del tickEvent personalizzato condiviso. L'intervallo valido è compreso tra 250 e 60.000 ms. Valori più bassi possono rendere le regole basate sugli eventi più reattive ma utilizzare più CPU. |
| Rimbalzo del salvataggio automatico | 400 ms | Ritardo dopo l'ultima modifica dell'editor prima che le impostazioni normali persistano. Il massimo è 5.000 ms. |
| Modalità debug | Spento | Abilita l'output dettagliato della traccia delle regole personalizzate e la sovrapposizione del registro di debug sulla pagina. Non controlla se le chiamate di registro ordinarie di una regola raggiungono il registro popup. |
| Mostra i log delle regole personalizzate sulle pagine web | Su | Controlla i normali toast del registro delle pagine. Gli autori delle regole possono comunque richiedere esplicitamente l'output solo su schermo o solo popup. |
| Durata posticipazione predefinita | 30 minuti | Seme utilizzato durante la creazione di nuovi gruppi normali. I gruppi esistenti mantengono la propria durata. |
| URL di riserva predefinito | informazioni su:vuoto | Utilizzato quando un gruppo di blocco non dispone di un URL di fallback specifico del gruppo. |
| Aiuta a classificare i creatori | Spento | Accettazione esplicita. Invia gli ID dei canali YouTube rilevati solo al servizio di classificazione configurato; non invia titoli né cronologia visualizzazioni. |
| Cartella file locale | Nessuno | Funzionalità di cartella opzionale per regole personalizzate. Vedere la sezione 9. |
| Ponte dell'app Web | Spento | Connessione opzionale a un hub Vault locale compatibile. Vedere la sezione 11. |

### 4.1 Interfaccia dell'editor e superfici di feedback

L'editor dell'estensione dispone di un elenco di gruppi persistenti e di un editor di gruppi selezionati. L'elenco dei gruppi fornisce il selettore del tipo di gruppo, Aggiungi, Cancella, selezione, attiva/disattiva e trascina l'ordine. Il suo divisore è ridimensionabile. L'editor del gruppo selezionato fornisce campi specifici del gruppo e le azioni di esportazione/importazione del gruppo.

L'editor salva automaticamente le modifiche ordinarie ai campi dopo il periodo di antirimbalzo globale. Gli errori di convalida vengono segnalati come feedback di stato/toast; i valori normali non validi non vengono convertiti automaticamente in impostazioni non correlate. Un gruppo congelato disabilita i normali controlli di modifica.

L'estensione dispone anche di queste superfici di feedback visibili all'utente:

| Superficie | Scopo funzionale |
| --- | --- |
| Manuale di istruzioni | Apre questo riferimento nell'estensione. |
| Selettore lingua | Sceglie la lingua dell'interfaccia dell'estensione. |
| Impostazioni | Apre le impostazioni globali sopra descritte. |
| Feedback sullo stato/toast | I report salvano, importano, convalidano e mostrano i risultati delle azioni. |
| Sovrapposizione del timer sulla pagina | Mostra gli elementi attivi del timer normale/conto alla rovescia e i timer personalizzati che si trovano nel loro ambito di visualizzazione. Possono coesistere più elementi. |
| Superficie del registro sulla pagina | Riceve chiamate di registro, avviso e errore personalizzate quando consentito dalle impostazioni globali. |
| Registro personalizzato | Un registro delle attività in tempo reale per le voci visibili tramite popup create da regole. Può essere cancellato e scaricato. |

Per i gruppi personalizzati, il campo Regole memorizza il testo di origine. Esegui prima esegue il preflight della sintassi della regola e carica l'origine solo quando l'operazione ha esito positivo. L'editor esegue anche il linting della fonte locale quando il testo cambia. Il controllo visibile **Let AI Code** apre un campo di richiesta e copia un bundle di generazione del codice contenente la richiesta dell'utente, la regola corrente e un riferimento generato all'API della regola personalizzata corrente. Non contatta un servizio AI né modifica automaticamente la regola.

Il controllo Modelli apre il browser dei modelli. Un modello, quando viene spedito, ha un titolo, una descrizione, tag, parametri e un'anteprima generata. L'applicazione sostituisce il testo attuale delle Regole dopo la conferma. Il catalogo dei modelli attualmente spedito è vuoto; il browser rimane disponibile per futuri modelli curati e non deve essere trattato come una fonte di regole attive.

## 5. Linguaggio delle regole personalizzate

### 5.1 Moduli sorgente delle regole

L'origine di un gruppo personalizzato è JavaScript. All'**Esegui**, Vault rimuove le registrazioni precedenti del gruppo e lo stato creato dalla precedente origine attiva, quindi carica la nuova origine.

La fonte può essere:

1. a function expression accepting events and helpers; or
2. semplici istruzioni che utilizzano gli eventi forniti (o eventi legacy) e le variabili helper.

```js
// Function-expression form
(events, helpers) => {
  events.on("openWebEvent", "welcome", (event, h) => {
    h.log("Opened", event.url);
  });
}
```

```js
// Bare-statement form
events.on("openWebEvent", "welcome", (event, h) => {
  h.log("Opened", event.url);
});
```

Esegui esegue il controllo preliminare/sintassi JavaScript e, solo quando ha esito positivo, rende attiva la sorgente corrente. Il salvataggio del testo e il testo in esecuzione sono intenzionalmente diversi: una regola può essere salvata senza diventare l'origine evento attiva.

L'origine attiva viene scaricata quando il gruppo personalizzato viene eseguito nuovamente, disabilitato, eliminato o interrotto esplicitamente. La riesecuzione cancella i gestori, i timer, i pannelli, il bucket di persistenza e i predicati della piattaforma creati dalla regola prima dell'inizio della registrazione. Un ripristino sandbox può ricaricare la sorgente attiva; gli autori delle regole devono quindi rendere la registrazione idempotente.

### 5.2 Modello di esecuzione e ipotesi sicure

Custom rules are event registrations, not a continuous script loop. Register handlers during rule initialization, then respond to events.

Ogni conduttore riceve:

```js
(event, helpers) => {
  // event: the currently dispatched event object
  // helpers: the public Vault Custom-rule API
}
```

Gestori per un evento eseguito con priorità numerica decrescente; la stessa priorità utilizza l'ordine di registrazione. Un gestore può essere sostituito registrando nuovamente lo stesso tipo di evento e lo stesso ID. È disponibile un massimo di 1.000 gestori registrati per un gruppo personalizzato.

Vault limita il lavoro attivo di un gestore a circa un secondo. Tre superamenti della scadenza per lo stesso gruppo entro un minuto mettono in quarantena la regola: Vault la disabilita anziché eseguire ripetutamente un gestore problematico. Non utilizzare attese occupate, cicli illimitati, polling sincrono o un numero elevato di mutazioni/log per evento.

Per spedizione, Vault accetta al massimo:

| Articolo | Massimo |
| --- | --- |
| Voci del registro delle regole | 200|
| Eventi pubblicati | 64|
| Operazioni DOM | 256|
| Azione/intenti | 256|
| Pannelli per gruppo | 24|
| Controlli in un unico pannello | 32|
| Opzioni nel selettore/radiocomando | 64|

Le voci in eccesso relative a log, eventi pubblicati, operazioni DOM e intenti potrebbero essere eliminate. Una regola personalizzata non deve dipendere dalla consegna di voci in eccesso.

### 5.3 Tipi di eventi incorporati

Sono integrate le seguenti stringhe di tipo evento. Una regola può anche utilizzare una propria stringa di tipo non vuota, purché non inizi con un carattere di sottolineatura.

| Tipo evento | Quando viene inviato | Dati importanti |
| --- | --- | --- |
| tickEvento | Tick ​​periodico condiviso con l'impostazione del tasso di tick globale. | Contesto della pagina/scheda corrente, ove disponibile. Utilizza l'opzione di registrazione intervalMs per limitare la velocità di un singolo gestore. |
| openWebEvent | Una pagina di livello superiore diventa disponibile per la regola. | URL, nome host, ID scheda/pagina, ora. |
| chiudiWebEvent | Una pagina/scheda di livello superiore si chiude. | Contesto URL/nome host, ove disponibile. |
| evento webChanged | Una navigazione di primo livello impegnata, inclusi i ricaricamenti dello stesso URL. | i dati contengono URL/nome host precedenti e flag di navigazione come isFirstLoad, isReload e sameDomain. |
| timerFine | Un timer personalizzato passa allo stato scaduto. | dati: timerId, displayName, direzione, currentMs. Viene consegnato solo al gruppo proprietario del timer. |
| snoozePremere | L'utente preme Avvia posticipazione per questo gruppo personalizzato. | La regola possiede la risposta; non viene eseguito il normale fallback snooze. |
| pannelloEvento | Un pannello personalizzato renderizzato presenta un'interazione. | i campi dati e comodità includono informazioni su pannello/controllo/evento/valore. |
| eventoFilelocale | Viene completata un'azione richiesta sul file locale. | i campi dati e pratici includono requestId, percorso, risultato, byte, voci ed errore. |
| paginaHeartbeatEvento | Un battito cardiaco della pagina visibile, circa ogni 250 ms mentre la scheda è visibile. | elapsedMs è il tempo trascorso della pagina visibile. I timer personalizzati con ambito lo utilizzano automaticamente anche senza un gestore registrato. |

### 5.4 API del registro eventi

Il primo argomento di un'origine in stile funzione è il registro degli eventi. Nell'origine bare-statement, sia gli eventi che gli eventi si riferiscono a questo registro.

| Metodo | Contratto |
| --- | --- |
| events.on(type, id, handler, options) | Register a handler. Returns true when accepted, false for invalid/capped registrations. |
| events.register(type, id, handler, options) | Alias of on. |
| events.off(type, id) | Unregister a handler. Returns whether something was removed. |
| events.unregister(type, id) | Alias of off. |
| events.unregisterAll(type) | Remove all handlers owned by this group for that event type. Returns the number removed. |
| events.getEvent(type, id) | Return the registered function for this group/id, or null. |
| events.getEvents(type) | Return an object mapping this group's handler ids to functions. |
| events.countRegistered(type) | Return this group's number of registrations for type. |
| events.emit(type, data, options) | Queue a synthetic event. |
| events.post(type, data, options) | Alias of emit. |

L'oggetto opzioni del gestore facoltativo supporta:

| Opzione | Significato |
| --- | --- |
| priorità | Ordine numerico. I valori più alti vengono eseguiti prima dei valori più bassi. Predefinito 0. |
| intervalloMs | Numero positivo. Solo per tickEvent, sopprime le chiamate finché non è trascorso questo tempo dalla chiamata precedente del gestore. |

Gli eventi sintetici hanno per impostazione predefinita l'ambito del gruppo: solo i gestori appartenenti al gruppo di emissione li ricevono. Utilizza { scope: "global" } per inviare l'evento a ogni regola che ha registrato lo stesso tipo. Non utilizzare un carattere di sottolineatura iniziale nel nome di un evento; è riservato.

### 5.5 Oggetto evento

Ogni gestore riceve un oggetto evento mutabile con campi comuni:

| Campo/metodo | Contratto |
| --- | --- |
| digitare | Stringa del tipo di evento. |
| IDgruppo | ID gruppo personalizzato destinatario. |
| tabId, pageId | Identificatori del browser quando disponibili; altrimenti nullo. |
| URL, nome host | URL di primo livello e nome host correnti o stringhe vuote. |
| tempo | Copia dell'oggetto ora di spedizione o null. |
| dati | Payload specifico dell'evento o null. |
| preventDefault() | Contrassegna l'invio come azione di blocco della pagina. La pagina viene reindirizzata al collegamento/risultato di reindirizzamento corrente, se ne esiste uno; in caso contrario Vault utilizza il normale percorso di uscita/fallback. |
| stopPropagazione() | Arresta i gestori successivi per l'invio dell'evento corrente. |
| setRisultato(valore) | Memorizza un numero o un risultato di stringa. Una stringa non vuota viene trattata come destinazione di reindirizzamento; Il risultato 1 sopprime un risultato preventDefault altrimenti accumulato. |
| getRisultato() | Restituisce il risultato impostato da questo oggetto evento oppure null. |
| post(tipo, dati, opzioni) | Accoda un evento sintetico, con le stesse regole di ambito di Events.post. |
| setRedirectLink(url) | Imposta l'URL di reindirizzamento per questa spedizione. Restituisce false solo per un input non di tipo stringa. |
| getRedirectLink() | Leggi l'URL di reindirizzamento di questo invio o una stringa vuota. |
| chiudi(id) | Richiedi la chiusura di una scheda. Un numero è un ID di scheda, una stringa identifica un URL e un valore omesso indirizza la scheda attiva. |
| blocco(id) | Aggiungi un pattern di blocco sito dinamico solo per la sessione. Senza ID stringa, utilizza il nome host dell'evento. |
| sbloccare(id) | Rimuovi un pattern di blocco sito dinamico solo per la sessione. Senza ID stringa, utilizza il nome host dell'evento. |
| aperto() | Nessuna operazione nell'estensione del browser. Non può avviare applicazioni. |

Un gestore può allegare proprietà extra arbitrarie all'evento. Leggili tramite event.custom o direttamente tramite il nome assegnato mentre l'oggetto evento è vivo. Non sono uno stato persistente e non sono archivi di eventi incrociati.

Per panelEvent, vengono aggiunti questi campi utili: panelId, controlId, eventName, valore, valori, chiave, codice e keyInfo.

Per localFileEvent, vengono aggiunti questi campi utili: eventName, azione, percorso, directoryPath, requestId, ok, testo, valore, voci, esiste, byte ed errore.

### 5.6 Punti di ingresso dell'aiutante

L'oggetto helper ha queste proprietà dirette:

| Punto di ingresso | Significato |
| --- | --- |
| helpers.now | Current dispatch timestamp in milliseconds. |
| helpers.currentUrl | Current unmodified URL string for this dispatch. |
| helpers.groupId | Owning Custom-group id. |
| helpers.log / warn / error | Direct aliases for the log helper. |
| helpers.logScreen / warnScreen / errorScreen | Direct aliases for screen-only logs. |
| helpers.logPopup / warnPopup / errorPopup | Direct aliases for popup-only logs. |
| helpers.getLogHelper() | Returns the log helper. |
| helpers.getDomainHelper(), getDomainUtility() | Return the domain helper. |
| helpers.getTimerHelper() | Returns the timer helper. |
| helpers.getPanelHelper() | Returns the panel helper. |
| helpers.getPersistenceHelper() | Returns the persistence helper. |
| helpers.getRedirectionHelper() | Returns the redirect helper. |
| helpers.getDOMHelper() | Returns the DOM helper. |
| helpers.getNavigationHelper() | Returns the navigation helper. |
| helpers.getStorageHelper() | Returns the persistence plus asynchronous storage helper. |
| helpers.getLocalFolderHelper() | Returns the optional local-folder helper. |
| helpers.getTabHelper() | Returns the tab-snapshot helper. |
| helpers.getWindowHelper() | Returns the browser-tab/window helper. |
| helpers.getPlatformHelper() | Returns the platform-helper collection. |
| helpers.platform() | Returns the platform-helper collection. |
| helpers.platform(name) | Returns the named raw platform API. Valid names: youtube, tiktok, facebook, instagram, twitch. |

## 6. Riferimento all'helper personalizzato

### 6.1 Assistente dominio

Get it with helpers.getDomainHelper(). It is also available as helpers.getDomainUtility().

| Metodo | Ritorno e comportamento |
| --- | --- |
| nomehostDi(url) | Host in lettere minuscole normalizzate senza www. iniziale o null per un URL non valido. |
| percorsoDi(url) | Nome del percorso dell'URL o / quando l'URL non può essere analizzato. |
| corrispondenze(nome host, sito) | Vero quando il nome host è uguale a sito o è il suo sottodominio. |
| getPiattaforma(url) | youtube, tiktok, instagram, facebook, twitch o null. |
| isYouTubeHost(host), isTikTokHost(host), isInstagramHost(host), isFacebookHost(host), isTwitchHost(host), isRedditHost(host), isDiscordHost(host) | Classificatori di host. |
| youtube(), tiktok(), instagram(), facebook(), twitch() | Restituisce l'oggetto classificatore URL di quella piattaforma. |
| isEmptyStartPage(url) | Vero per gli URL vuoti/nuova scheda/pagina iniziale supportati dal browser. |
| corrispondeAny(url, modelli) | Abbina un URL a una RegExp, a un array RegExp o a stringhe compilate come espressioni regolari. I modelli di stringa non validi vengono ignorati. |
| percorsoIniziaCon(url, percorso) | Vero per un percorso esatto o un discendente di percorso. Viene fornita una barra iniziale mancante. |
| queryHas(url, chiave, valore) | Vero se esiste una chiave di query; quando viene fornito valore, deve anche essere uguale al valore della stringa. |
| queryGet(url, chiave) | Valore della query o null. |
| isSearchPage(url) | Rileva gli URL di ricerca supportati di Google, Bing, DuckDuckGo, YouTube, Reddit e X/Twitter. |
| isInfiniteFeedUrl(url) | Rileva le superfici ad alimentazione infinita supportate. |
| stessaSezione(a, b) | Vero solo quando entrambi gli URL condividono un host e il primo segmento del nome percorso. |

Ogni oggetto classificatore URL della piattaforma espone isPlatformUrl(url), isShortUrl(url), isVideoUrl(url), isPostUrl(url), isHomePage(url), extractAuthor(url) ed extractVideoId(url). Un metodo può restituire false/null quando l'URL è valido ma non identifica quel tipo di contenuto.

### 6.2 Assistente timer

Get it with helpers.getTimerHelper(). Timers are rule-owned counters. They may be displayed in Vault's page overlay, but they never block on their own.

Crea/ottieni opzioni:

| Opzione | Significato |
| --- | --- |
| id | ID timer non vuoto obbligatorio. |
| displayNome | Etichetta sovrapposta leggibile dall'uomo. |
| direzione | avanti per il conteggio; qualsiasi altro valore diventa indietro/conto alla rovescia. |
| attualeMs | Millisecondi iniziali, fissati a zero e limitati se esistono limiti. |
| minMs, maxMs | Limiti minimo/massimo positivi facoltativi. |
| passi | Passaggio opzionale di quantizzazione positiva per i tick trascorsi. |
| sovrapposizioneStile | Stringhe facoltative per colore, sfondo, fontSize, fontWeight, border, borderRadius, riempimento, opacità e icona. Le parti non supportate/non valide vengono eliminate. |
| ambito(url) | Predicato che decide dove matura il tempo trascorso sulla pagina visibile. |
| dominio(url) | Predicato che decide dove appare il timer nell'overlay; l'impostazione predefinita è l'ambito. |
| accrueWhen(url) | Predicato aggiuntivo facoltativo. Il tempo matura solo quando sia scope che accrueWhen sono true. |

| Metodo | Comportamento |
| --- | --- |
| crea(opzioni) | Crea/sostituisce un timer e ne reimposta lo stato. Restituisce id o null. |
| getOrCreateTimer(opzioni) | Crea solo se assente. Lo stato attuale rimane invariato. Restituisce id o null. |
| elimina(id) | Rimuovere il timer e i relativi predicati di ambito/visualizzazione. |
| pausa(id), ripresa(id) | Modifica lo stato in pausa. Restituisce vero solo quando è possibile un cambiamento di stato. |
| setDirection(id, direzione) | Imposta avanti o indietro. |
| setCurrentMs(id, ms) | Imposta il conteggio assoluto, imponendo i limiti. |
| addMs(id, deltaMs), subMs(id, deltaMs) | Regola il conteggio, applicando i limiti. |
| setBounds(id, minMs, maxMs) | Impostare limiti positivi; passare null per un limite per rimuoverlo. |
| setStep(id, stepMs) | Imposta una quantizzazione del tick positiva. Passa null o zero per cancellarlo. |
| setOverlayStyle(id, stile) | Sostituisci/cancella gli stili di sovrapposizione consentiti. |
| setDisplayName(id, nome) | Imposta l'etichetta sovrapposta. |
| getCurrentMs(id) | Numero, zero per un timer assente. |
| èScaduto(id) | Vero solo quando esiste un timer e currentMs è zero. |
| isPaused(id) | Booleano. |
| getDirection(id), getDisplayName(id) | Direzione/nome o null. |
| esiste(id) | Booleano. |
| getState(id) | Snapshot del timer serializzabile o null. |
| lista() | Array serializzabile di istantanee timer. |

I predicati dell'ambito vengono ricordati mentre l'origine personalizzata rimane caricata. Vault fa avanzare i timer di corrispondenza durante i cicli visibili di pageHeartbeatEvent, un segno di spunta per timer per invio. Un timer all'indietro si ferma a zero ed emette timerEnded durante la transizione a zero. Rimane zero finché la regola non la modifica/reimposta. Utilizza un gestore con timer terminato per decidere se un timer scaduto deve chiamare preventDefault, impostare un reindirizzamento o eseguire un'altra azione.

### 6.3 Archiviazione persistente e asincrona

Get the synchronous persistence helper with helpers.getPersistenceHelper(). Values must be JSON-serializable. A group can store at most 200 keys and each serialized value is limited to 16 KiB.

| Metodo | Comportamento |
| --- | --- |
| get(chiave, valore predefinito) | Leggere un valore clonato o defaultValue. |
| set(chiave, valore) | Archivia un clone sicuro per JSON. Restituisce false per chiave/valore non valido o esaurimento del keycap. |
| cancella(tasto) | Elimina la chiave esistente; restituisce se esisteva. |
| ha(chiave) | Booleano. |
| chiavi() | Matrice di chiavi. |
| voci() | Matrice di coppie [chiave, valore] clonate. |
| chiaro() | Elimina tutta la persistenza delle regole per questo gruppo. |
| dimensione() | Numero di chiavi. |

helpers.getStorageHelper() exposes all the preceding methods and two asynchronous request methods:

| Metodo | Comportamento |
| --- | --- |
| requestAsyncGet(chiave) | Richiedere una lettura dell'archiviazione asincrona. Restituisce vero quando in coda. Utilizzare un evento successivo/il flusso del proprio stato per rispondere; non è un getter sincrono. |
| requestAsyncSet(chiave, valore) | Richiedi un archivio asincrono sicuro per JSON. Restituisce vero quando in coda. |

La persistenza della regola viene cancellata durante l'esecuzione perché una nuova origine attiva viene avviata con uno stato di regola personalizzata pulito.

### 6.4 Assistente per la registrazione

Get it with helpers.getLogHelper(). Every method accepts any number of values.

| Metodo | Destinazione |
| --- | --- |
| log, avviso, errore | Registro attività popup; toast della pagina quando i toast globali del registro delle pagine sono abilitati. |
| logScreen, warnScreen, errorScreen | Solo superficie toast/debug della pagina; escluso dal registro popup. |
| logPopup, warnPopup, errorPopup | Solo registro attività popup; escluso dal brindisi della pagina. |

I log tentano anche di raggiungere la console del browser con un prefisso di gruppo CustomBlocker. Questo è un output diagnostico, non un'API di persistenza. Utilizza l'helper di persistenza per lo stato.

### 6.5 Aiutante di reindirizzamento

Get it with helpers.getRedirectionHelper().

| Metodo | Comportamento |
| --- | --- |
| get(), getRedirectLink() | Restituisce l'URL di reindirizzamento dell'invio corrente o una stringa vuota. |
| set(url), setRedirectLink(url) | Imposta l'URL di reindirizzamento per l'invio corrente. |
| createMessageUrl(messaggio) | Crea un URL della pagina del messaggio locale dell'estensione che visualizzi il messaggio fornito. |

La sola impostazione di un reindirizzamento non forza la navigazione. Abbinalo a event.preventDefault() o imposta una stringa non vuota tramite event.setResult(), in base al flusso di regole desiderato.

### 6.6 Assistente DOM

Get it with helpers.getDOMHelper(). These actions are queued and applied to the current page. Selectors must be valid for the page browser; malformed selectors or elements that do not exist can produce no visible result.

| Metodo | Azione richiesta |
| --- | --- |
| nascondi(selettore), mostra(selettore) | Nascondi/mostra gli elementi corrispondenti. |
| addClass(selettore, className), rimuoviClass(selettore, className) | Mutare la classe CSS. |
| setText(selettore, testo) | Sostituisci il contenuto del testo. |
| fare clic (selettore) | Fare clic sull'elemento corrispondente. |
| injectCss(css, id) | Aggiungi un blocco CSS identificato. |
| rimuoviInjectedCss(id) | Rimuovi un blocco CSS inserito precedentemente identificato. |
| scrollTo(selettore) | Scorri un elemento corrispondente per visualizzarlo. |

Le azioni DOM non forniscono script di pagina senza restrizioni. Sono una superficie d'azione delimitata e dovrebbero essere idempotenti se utilizzati da gestori di battito cardiaco/tick.

### 6.7 Navigazione, schede e supporto per la finestra del browser

Get navigation with helpers.getNavigationHelper().

| Metodo | Azione richiesta |
| --- | --- |
| indietro() | Torna indietro nella scheda corrente. |
| avanti() | Naviga in avanti nella scheda corrente. |
| ricarica() | Ricarica la scheda corrente. |
| vai a(url) | Naviga nella scheda corrente fino all'URL. |
| chiudiTab() | Chiudi la scheda corrente. |

Get a snapshot helper with helpers.getTabHelper().

| Metodo | Ritorno/azione |
| --- | --- |
| lista() | Copia dell'istantanea della scheda corrente. |
| getActiveTab() | Istantanea della scheda attiva o null. |
| getById(id) | Istantanea della scheda corrispondente o null. |
| conteggioAperto() | Numero di schede nell'istantanea. |
| richiestaAggiorna() | Richiedi una nuova istantanea della scheda per un successivo lavoro sulle regole. |

Get the browser-tab/window helper with helpers.getWindowHelper(). In the extension, a "window" is represented by browser tabs.

| Metodo | Comportamento |
| --- | --- |
| corrente() | Oggetto scheda attiva corrente: ID, URL, nome host, titolo, isBrowser. |
| tutto() | Matrice di oggetti scheda con ID, URL, nome host, titolo, attivo. |
| chiudi(idOrUrl) | Chiudi tramite ID numerico della scheda, stringa URL esatta o scheda attiva quando omesso. |
| chiudiTab() | Chiudi la scheda attiva. |
| blocco(modello) | Aggiungi un blocco di dominio di sola sessione normalizzato e applicalo. |
| sbloccare(modello) | Rimuovi un blocco di dominio di sola sessione normalizzato. |
| isBlocked(urlOrHostname) | Interroga la blocklist della sessione creata dalla regola. |
| getBlocked() | Elenca i pattern correnti creati dalla sessione. |

I modelli di blocco creati da regole normalizzano http/https, www. e i percorsi iniziali in un modello host. Corrispondono esattamente all'host e ai sottodomini. Questa blocklist dinamica è la memoria della sessione, non un normale gruppo del sito salvato.

### 6.8 Assistente per la cartella di file locale

Get it with helpers.getLocalFolderHelper(). It only operates after the user has selected a folder in Global Settings and granted browser permission. It is asynchronous: every request returns a request id; completion arrives as localFileEvent.

| Metodo | Comportamento |
| --- | --- |
| è disponibile() | Segnala che la superficie API esiste; non dimostra che una cartella sia attualmente autorizzata. |
| richiestaLeggi(percorso) | Richiedi la lettura del testo. |
| requestWrite(percorso, testo) | Richiedi la scrittura del testo. |
| requestAppend(percorso, testo) | Richiedi l'aggiunta di testo. |
| requestList(percorso = "") | Richiedi un elenco di directory. |
| richiestaEsiste(percorso) | Richiedi test di esistenza. |
| requestReadJson(percorso) | Richiedi lettura JSON; il percorso deve terminare con .json. |
| requestWriteJson(percorso, valore) | Richiedi la scrittura JSON; il percorso deve terminare con .json e il valore deve essere sicuro per JSON. |

I percorsi sono sempre relativi alla radice selezionata. Non possono essere assoluti, qualificati per l'unità, con prefisso punto o contenere . o .. segmenti. Per le operazioni sui file sono accettati solo file .txt, .csv e .json. La selezione della cartella può essere revocata in qualsiasi momento; una richiesta non riuscita riporta ok false e una stringa di errore in localFileEvent.

### 6.9 Assistente della piattaforma

Get the collection with helpers.getPlatformHelper() or helpers.platform(). Get one raw platform API with helpers.platform("youtube"), for example.

Tutte le API della piattaforma raw espongono:

| Metodo | Comportamento |
| --- | --- |
| nascondi(predicato, opzioni) | Imposta lo stesso predicato per articolo per ogni slot della scheda feed su quella piattaforma. |
| hide(slot, predicato, opzioni) | Imposta un predicato per elemento. Il predicato riceve l'elemento/istantanea della piattaforma fornito da quella piattaforma. |
| consenti(predicato, opzioni), consenti(slot, predicato, opzioni) | Uguale a hide ma crea un verdetto di autorizzazione/eccezione. |
| mostra(), mostra(slot) | Cancella tutto o uno slot del predicato installato. |
| superficie(nome, "nascondi" o "mostra") | Nascondi/mostra un'intera regione della piattaforma. home è il nome pubblico di homePage. |
| timer(slot, opzioni) | Configura un timer per la sottosezione della piattaforma. Restituisce options.id quando fornito, altrimenti null. |
| ripetere la scansione() | Rivalutare le schede feed già scansionate dopo le modifiche allo stato delle regole esterne. |
| istantanea() | Restituisce lo snapshot della piattaforma corrente o null. |
| slots(), superfici(), timerSlots() | Restituisce i nomi supportati per questa piattaforma. |
| isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId | Helper URL per quella piattaforma. |

Uno slot possiede un predicato per un gruppo/piattaforma. Una successiva chiamata hide/allow per lo stesso slot sostituisce il predicato precedente; non è un OR implicito. L'oggetto opzioni facoltativo riconosce:

| Opzione | Effetto |
| --- | --- |
| blockPageOnVisit | Quando viene visitata una scheda/pagina corrispondente, richiedi il blocco della pagina anziché nascondere solo la scheda. |
| effetto | bloccare (impostazione predefinita) o consentire. I set di helper consenti consentono automaticamente. |

Chiama la nuova scansione ogni volta che un predicato dipende dallo stato che è cambiato dopo la prima valutazione delle carte, come una casella di controllo del pannello, una quota o una soglia temporale.

Matrice di supporto della piattaforma grezza:

| Piattaforma | Slot predicativi | Nomi delle superfici | Slot del timer |
| --- | --- | --- | --- |
| YouTube | cortometraggi, video, post, commenti, live | home, shortButton, commenti, live | cortometraggi, video, post |
| TikTok | video, commenti, live | casa, commenti, live | video |
| Instagram | cortometraggi, post, commenti | casa, commenti | cortometraggi, post |
| Facebook | cortometraggi, video, post, commenti, live | casa, commenti, live | cortometraggi, video, post |
| Contrazione | cortometraggi, streaming, video, live | casa, commenti, live | cortometraggi, streaming, video |

L'helper della piattaforma personalizzata non elaborata non espone Reddit, Discord o Twitter/X. Utilizza URL generali, DOM, timer, pannello e funzionalità di navigazione per un lavoro personalizzato su tali siti.

## 7. Pannelli personalizzati

The panel helper creates safe, declarative on-page panels. Get it with helpers.getPanelHelper(). A panel can be scoped to URLs, react to interactions, display timer state, and retain its user-entered values for the active rule lifetime.

### 7.1 API del pannello

| Metodo | Comportamento |
| --- | --- |
| creare(config) | Crea o sostituisci un pannello. Restituisce l'ID del pannello normalizzato o null. |
| getOrCreatePanel(config) | Crea solo quando assente; restituisce id o null. |
| aggiornamento(id, patch) | Sostituisci i campi del pannello specificati dopo la convalida. |
| elimina(id) | Rimuovere un pannello e i relativi gestori in linea registrati. |
| mostra(id), nascondi(id) | Cambia visibilità. |
| setValue(ID pannello, ID controllo, valore) | Imposta un valore di controllo scrivibile dopo la convalida. |
| updateControl(Idpannello, Idcontrollo, patch) | Sostituisci i campi consentiti di un controllo. |
| disabilita(panelId, controlId), abilita(panelId, controlId) | Attiva/disattiva il controllo della disponibilità. |
| setOptions(panelId, controlId, opzioni) | Sostituisci le scelte di selezione/radio. |
| setText(Idpannello, Idcontrollo, testo) | Aggiorna l'etichetta di un pulsante, un testo/testo di sezione o un'altra etichetta di controllo. |
| setTheme(panelId, tema) | Sostituisci il tema del pannello. |
| setTitle(panelId, titolo), setDescription(panelId, descrizione) | Aggiorna testo. |
| getValue(ID pannello, ID controllo) | Restituisce un valore clonato o non definito. |
| getValues(ID pannello) | Restituisce tutti i valori scrivibili digitati dall'id di controllo. |
| getState(id) | Restituisce uno snapshot del pannello serializzabile o null. |
| lista() | Restituisce istantanee serializzabili di tutti i pannelli. |
| avviso(config) | Crea un pannello di stato compatto in basso a destra con messaggio/testo opzionale. |
| conferma(config) | Crea una finestra di dialogo centrata con i pulsanti di conferma e annullamento generati. |
| lista di controllo(config) | Crea un pannello di elementi con caselle di controllo. |
| modulo(config) | Crea un pannello di layout del modulo dai campi. |

### 7.2 Configurazione della centrale

| Campo | Valori/comportamenti accettati |
| --- | --- |
| id | Necessario. Normalizzato in lettere, cifre, carattere di sottolineatura, trattino; massimo 80 caratteri. |
| titolo | Titolo del pannello, massimo 240 caratteri. |
| descrizione o corpo | Descrizione, massimo 1.000 caratteri. |
| posizione | in alto a sinistra, in alto a destra, in basso a sinistra, in basso a destra o al centro. Predefinito in basso a destra. |
| allineare | sinistra, centro o destra. Predefinito lasciato. |
| disposizione | verticale, compatto, comodo, spazioso, in linea, riga, a capo, a due colonne, griglia, diviso, modulo, barra degli strumenti o pila. Verticale predefinito. |
| priorità | Ordine di visualizzazione numerico, compreso tra -1000 e 1000. I pannelli più alti vengono visualizzati per primi. |
| larghezza | piccolo, medio, grande o da 180 a 520 px. |
| dimensione testo/dimensione carattere | Da 10 a 32 px o da 0,65 a 2 rem/em. |
| ariaLabel/a11yLabel | Etichetta accessibile. |
| ruolo | regione, finestra di dialogo, avviso, stato, modulo o gruppo. |
| messa a fuoco automatica | Booleano. |
| tema/colori | sfondo, primo piano, accento, bordo, disattivato, fontSize/textSize, titleSize. |
| controlli | Array contenente fino a 32 controlli, con sezioni annidate fino a tre livelli. |
| visibile | False nasconde il pannello. |
| ambito(url), dominio(url) | Funzioni di controllo disponibilità/visualizzazione. il dominio ha la precedenza; senza dominio, vengono visualizzati i controlli dell'ambito. |

I campi del gestore in linea del pannello possono essere visualizzati sul pannello o su un singolo controllo: onEvent, onChange, onClick, onInput, onFocus, onBlur, onSubmit, onClose, onMount, onUnmount, onKey e onKeyDown. Ciascuno riceve i normali parametri (evento, helper). Un gestore in linea viene sostituito quando il pannello viene ricreato/aggiornato con le definizioni dei controlli.

### 7.3 Controlli

I tipi di controllo disponibili sono testo, casella di controllo, selezione, textInput, textarea, pulsante, sezione, timer, numberInput, intervallo, attiva/disattiva, radio, data, ora, colore, pin e html. Gli alias input, menu a discesa, gruppo, numero, dispositivo di scorrimento, interruttore, raw e markup vengono normalizzati nel tipo corrispondente.

Tutti i controlli accettano ID, tipo, etichetta, valore, disabilitato, priorità e, dove rilevante, layout, allineamento, ariaLabel/a11yLabel, messa a fuoco automatica, larghezza, altezza e righe.

| Digitare | Campi importanti e contratto a valore |
| --- | --- |
| testo | testo (o etichetta) reso come testo non di input. |
| casella di controllo, attiva/disattiva | Valore booleano. |
| seleziona, radio | opzioni come stringhe o oggetti { valore, etichetta }; massimo 64. Il valore è una stringa breve. |
| textInput, area di testo | Valore stringa, massimo 2.000 caratteri; segnaposto opzionale. |
| pulsante | etichetta/testo; azione facoltativa inviare, annullare o chiudere. |
| sezione | testo/descrizione, ruolo e controlli nidificati. |
| temporizzatore | timerId o istantanea del timer; formato ms, ss, mm:ss o hh:mm:ss; showExpired è impostato su true. |
| numeroInput, intervallo | Valore numerico vincolato al min/max fornito; passaggio positivo facoltativo. |
| data | Solo valore AAAA-MM-GG. |
| tempo | Solo valore HH:MM o HH:MM:SS. |
| colore | Valore di input #RRGGBB a sei cifre. |
| perno | Solo cifre, lunghezza da 3 a 12, mascherate per impostazione predefinita, invio automatico opzionale. |
| html | Markup disinfettato. Blocchi di script, attributi di eventi in linea e javascript: gli URL vengono rimossi. |

Ogni interazione renderizzata genera panelEvent. L'oggetto valori dell'evento contiene i controlli scrivibili del pannello, esclusi pulsanti, testo e controlli timer. Un'azione ravvicinata nasconde il pannello prima che gli operatori osservino l'evento.

## 8. Ricette di azioni con regole personalizzate

Gli esempi seguenti sono specifiche di composizione pubblica, non un tutorial.

### 8.1 Reindirizzare una pagina di apertura

```js
(events, helpers) => {
  events.on("openWebEvent", "redirect-distracting-search", (event, h) => {
    const domain = h.getDomainHelper();
    if (!domain.isSearchPage(event.url)) return;
    event.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Return to your planned task."));
    event.preventDefault();
  });
}
```

### 8.2 Conto alla rovescia del tempo visibile con blocco esplicito

```js
(events, helpers) => {
  const timer = helpers.getTimerHelper();
  timer.create({
    id: "reading-budget",
    displayName: "Reading budget",
    direction: "backward",
    currentMs: 10 * 60 * 1000,
    scope: (url) => url.includes("example.com")
  });

  events.on("timerEnded", "stop-at-zero", (event) => {
    if (event.data?.timerId !== "reading-budget") return;
    event.setRedirectLink("about:blank");
    event.preventDefault();
  });
}
```

### 8.3 Modificare un predicato di feed da un pannello

```js
(events, helpers) => {
  const panel = helpers.getPanelHelper();
  const youtube = helpers.platform("youtube");

  panel.create({
    id: "feed-filter",
    title: "Feed filter",
    controls: [{
      id: "hide-sponsored",
      type: "toggle",
      label: "Hide sponsored items",
      value: true,
      onChange: (event, h) => {
        const api = h.platform("youtube");
        if (event.value) {
          api.hide("videos", (item) => item?.sponsored === true);
        } else {
          api.show("videos");
        }
        api.rescan();
      }
    }]
  });

  youtube.hide("shorts", () => true);
}
```

È necessario scrivere i predicati per i valori di snapshot/elemento della piattaforma forniti dalla superficie attiva della piattaforma. Se una piattaforma non è in grado di identificare un campo in modo affidabile, il predicato dovrebbe fallire all'apertura anziché presupporre che un valore sia vero.

## 9. Protocollo di richiesta della cartella locale

Le operazioni della cartella locale non sono I/O file immediati. La sequenza funzionale completa è:

1. L'utente seleziona una cartella in Impostazioni globali.
2. La regola accoda una richiesta e riceve un ID richiesta.
3. Vault richiede alla funzionalità della cartella autorizzata di eseguire l'operazione.
4. Vault invia localFileEvent allo stesso gruppo personalizzato.
5. Il gestore mette in correlazione event.requestId con l'ID della richiesta originale.

La lettura riuscita viene completata con il testo per i file di testo o il valore per JSON. L'elenco restituisce le voci. Esiste restituisce esiste. Scrivi/aggiungi fornisce byte ove applicabile. Il fallimento fornisce ok false ed errore. Le regole non devono mai presupporre che una cartella selezionata rimanga autorizzata dopo un ricaricamento, un riavvio del browser o una revoca dell'autorizzazione.

## 10. Sicurezza delle regole personalizzate e semantica dei guasti

### 10.1 Errori di compilazione ed esecuzione

Controllare la sintassi segnala un errore di compilazione. Run può anche segnalare un errore di runtime durante la registrazione. Se un'origine simile a una funzione presenta un errore di sintassi, Vault non ricorre silenziosamente a trattarla come semplici istruzioni innocue.

Un'origine vuota non ha gestori. È valida come regola personalizzata inattiva, ma non esegue alcuna azione personalizzata configurata.

### 10.2 Errori del gestore

Un'eccezione proveniente da un gestore viene isolata dall'invio complessivo dell'evento. È un output diagnostico; non fa sì che i gestori successivi abbiano magicamente successo. Utilizza gestori ristretti e registra gli errori su cui è possibile intervenire.

### 10.3 Quarantena

Vault può mettere in quarantena un gruppo personalizzato dopo ripetuti superamenti della scadenza o durante la registrazione. La quarantena disabilita il gruppo e ne registra il motivo dell'interruzione. Correggere l'origine, salvarla ed eseguirla di nuovo esplicitamente per ripristinare le registrazioni attive.

### 10.4 Limiti del browser/pagina

Nessuna regola personalizzata riceve API di estensione illimitate. In particolare:

- un selettore DOM non può trovare nulla su una piattaforma che sia cambiata;
- la navigazione, la chiusura delle schede e le azioni sullo schermo rimangono soggette alle funzionalità del browser;
- un'estensione non può aprire applicazioni native;
- le operazioni della cartella locale richiedono una cartella concessa dall'utente e i tipi di file supportati;
- un gestore di eventi non può fare affidamento su una pagina invisibile che continua a produrre heartbeat in tempo visibile;
- una pagina può ricaricarsi, navigare, essere scartata o invalidare uno script di contenuto indipendentemente dalla regola;
- I blocchi di sito dinamici creati da regole sono azioni sullo stato della sessione, non modifiche permanenti al gruppo di siti.

## 11. Bridge tra app Web

Il ponte è facoltativo. Connette un client di estensione del browser a un hub Vault locale compatibile. L'estensione del browser è un client; un'app Vault nativa fornisce l'hub. L'endpoint locale fisso è ws://127.0.0.1:8787 ed è richiesta la compatibilità del protocollo.

Gli stati di connessione sono Disattivato, Connessione in corso, Disconnesso, Connesso ed Errore. Con il client abilitato, Vault esegue prima la scansione rapidamente e poi continua i tentativi di riconnessione più lenti finché non si connette o finché l'utente non lo spegne. La connessione da sola non unisce tutti i gruppi.

### 11.1 Collegamento di gruppi

I gruppi sono collegabili solo quando il nome e il tipo corrispondono e sono idonei per il collegamento. L'utente seleziona/collega esplicitamente i programmi partecipanti. Un gruppo collegato forma un cluster. La disconnessione lascia intatti i dati del gruppo locale; interrompe la sincronizzazione live.

Il bridge sincronizza la policy scalare condivisa per i gruppi collegati supportati, tra cui la modalità di blocco normale, i valori di autorizzazione/reimpostazione, le impostazioni di posticipazione, giorni/finestre attive, stato/scelta/durata di blocco, policy della home page, impostazione della lista consentita, URL di fallback e policy salta al successivo. Coordina inoltre l'utilizzo e lo stato di posticipazione per i membri del cluster.

Il bridge non promette che ogni campo specifico del prodotto, selettore della piattaforma, testo sorgente personalizzato o funzionalità specifica del browser sia trasferibile a un programma diverso. Un gruppo può rimanere locale e non collegato anche mentre il bridge è connesso.

I cluster di ponti congelati richiedono che tutti i membri interessati siano online per azioni di congelamento che richiedono una mutazione coordinata. Una connessione è un trasporto locale, non un backup su cloud o un canale di controllo remoto.

## 12. Lista di controllo per la verifica per i manutentori

Utilizza questa lista di controllo quando controlli un rilascio o riproduci un comportamento:

1. Confermare che il gruppo abbia un nome univoco non vuoto, il tipo corretto, lo stato abilitato e l'elenco/ordine previsto.
2. Per i gruppi normali, confermare il giorno della settimana attivo, la finestra temporale locale valida, l'assenza di posticipazione attiva e lo stato di modifica non bloccato.
3. Per un gruppo Sito, testare l'host esatto, il sottodominio e (per la lista consentita) un host esterno all'elenco.
4. Per un gruppo di piattaforme, testare separatamente la corrispondenza a livello di pagina, la corrispondenza di elemento/scheda mirata, la modalità autore, la modalità modulo contenuto e ciascuna superficie abilitata.
5. Per i gruppi normali a tempo, verificare l'accumulo di pagine visibili, la scadenza dell'indennità o il comportamento non bloccante del conteggio e l'intervallo di ripristino.
6. Per le regole personalizzate, eseguire il controllo della sintassi, Esegui, ispezionare il conteggio/i log del gestore, testare ogni evento integrato registrato, quindi testare un ricaricamento/navigazione.
7. Testare ciascun timer personalizzato ai limiti dell'ambito e a zero; verificare che qualsiasi blocco sia esplicito nella regola.
8. Testare i pannelli con ciascun valore di controllo, stato disabilitato, azione di invio/annullamento/chiusura e gestore panelEvent.
9. Testare l'errore della cartella locale prima del successo: nessuna cartella selezionata, autorizzazione revocata, percorso non valido, estensione non supportata, quindi lettura/scrittura autorizzata.
10. Testare la connessione bridge disattivata, la connessione attivata, il gruppo collegato/scollegato e un membro del cluster offline prima di affidarsi alla sincronizzazione o al blocco del coordinamento.

## 13. Regola di versione

Questo file inglese è il manuale sorgente mantenuto. I manuali localizzati ne sono traduzioni e potrebbero richiedere la rigenerazione dopo un aggiornamento della documentazione funzionale. La fonte del prodotto rimane la verità canonica per l'ambiguità a livello di implementazione.
