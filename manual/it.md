# Manuale utente dell'estensione browser Vault

Vault controlla i siti web e i contenuti supportati delle piattaforme nel profilo del browser in cui è installato. Apri l'editor dal pulsante dell'estensione nella barra degli strumenti. Se connesso, Mac Vault o Windows Vault fornisce l'applicazione di tag e Activity in locale; l'estensione applica i blocchi agli obiettivi del browser.

## Gruppi di blocco

Un **gruppo di blocco** applica una policy di blocco. Un **gruppo Classifier** assegna tag ai contenuti; da solo non blocca nulla.

1. Aggiungi un gruppo di blocco e assegnagli un nome.
2. Scegli gli obiettivi in **Si applica a**.
3. Scegli quando applicare il blocco, poi imposta un programma o un tempo consentito, se necessario.
4. Attiva il gruppo. I suoi obiettivi condividono la policy del gruppo.

Le modifiche ordinarie si salvano automaticamente. Un errore indica che la modifica non è stata accettata; correggi il campo e riprova. Disattiva un gruppo per sospenderne la policy mantenendo la configurazione. **Elimina gruppo** lo rimuove. Trascina i gruppi per riordinarli. Più gruppi possono applicarsi allo stesso obiettivo; posticiparne uno non rimuove il blocco di un altro.

**Esporta** copia la configurazione di un gruppo. **Importa** sostituisce la configurazione del gruppo selezionato dopo la conferma.

### Tempo consentito e programma

**Blocca subito** si applica quando il gruppo attivo corrisponde e il programma è in corso. **Blocca quando si esaurisce il tempo consentito** permette l'uso corrispondente finché il tempo consentito non termina.

Imposta il tempo consentito in minuti e l'intervallo di ripristino in ore. Un limite mobile conteggia l'uso nella finestra temporale precedente. Il ripristino a mezzanotte avvia un nuovo periodo alla mezzanotte locale, anche per un limite mobile.

Scegli i giorni attivi della settimana e gli intervalli di ora locale facoltativi, uno per riga, ad esempio **09:00-12:00**. Senza intervalli, il gruppo si applica per tutti i giorni selezionati. Un intervallo deve terminare più tardi rispetto all'inizio nello stesso giorno; dividi un programma notturno su giorni diversi.

### Posticipa

Configura il posticipo in ogni gruppo di blocco. **Sospendi il blocco** sospende la policy del gruppo per la durata impostata. **Aggiungi al tempo consentito** aggiunge minuti utilizzabili a un gruppo con limite temporale. Solo il tempo aggiuntivo consumato viene conteggiato come posticipo. Il tempo aggiuntivo non utilizzato scade al ripristino successivo; per un limite mobile scade dopo una finestra, o prima a mezzanotte se l'opzione è attiva.

**Ritardo di attivazione** posticipa il rinvio mentre il blocco continua. **Intervallo di attesa** indica quanto attendere dalla fine del posticipo prima di richiederlo di nuovo. **Conferme richieste** imposta il numero di passaggi di conferma. Il posticipo è disponibile per un gruppo congelato solo se consentito prima del congelamento.

### Congelamento e PIN

**Congela** impedisce le modifiche ordinarie. Per scongelare servono dieci conferme a distanza di cinque secondi, oltre all'eventuale attesa configurata e a un PIN di sei cifre. **Attendi prima di scongelare** accetta 0–72 ore; 0 non aggiunge attesa.

Mentre il gruppo è congelato, l'attesa può essere prolungata e si può aggiungere un PIN se non è già presente. Queste condizioni non possono essere allentate finché il gruppo non viene scongelato. Anche l'eliminazione rispetta l'attesa restante e il PIN.

### Gruppi collegati

Usa **Collega** per connettere gruppi selezionati esplicitamente in altri programmi Vault. I gruppi collegati condividono nome, impostazioni di policy supportate, obiettivi, utilizzo e condizioni di congelamento. Ogni programma modifica e applica i tipi di obiettivo supportati; le altre voci restano disponibili ai programmi collegati. Scollegare mantiene ciascun gruppo e le sue impostazioni.

Se un membro collegato è offline, potrebbe non essere possibile modificarlo. Apri l'app Vault desktop e il browser collegato per riconnetterti. Una policy salvata in locale può continuare ad applicarsi quando un membro è offline.

## Assistenza

Fai clic sulla piccola **i** accanto a un campo per leggerne la spiegazione. Fai clic all'esterno o premi Escape per chiuderla. Gli elenchi restano in riquadri scorrevoli; scorri il riquadro per visualizzare altre voci. La ricerca filtra l'elenco visibile senza eliminare voci.

Le regole personalizzate hanno un [Manuale del codice](../code-manual/it.md) dedicato, che spiega l'editor, l'attivazione, i log, l'accesso ai file e l'API supportata.

## Siti web e contenuti delle piattaforme

Aggiungi domini o URL completi, uno per voce. Un dominio include i sottodomini. Un percorso limita la corrispondenza a quel percorso e ai suoi discendenti. **Blocca tutto tranne questi siti** trasforma l'elenco in una lista consentita.

Puoi aggiungere più volte lo stesso sito web. Ogni voce ha filtri e controlli di pagina propri; per esempio, una voce YouTube può bloccare Shorts e un'altra un creator. Le voci corrispondenti si combinano nel gruppo e condividono programma, tempo consentito e posticipo.

Un obiettivo può coprire una pagina corrispondente oppure mettere in pausa prima e offrire Continua dopo un conto alla rovescia. Nel gruppo, un obiettivo di blocco ha la precedenza su uno di pausa. **Quando è bloccato: reindirizza o mostra un messaggio** accetta un indirizzo web o un messaggio di copertura; lascia vuoto per coprire la pagina sul posto. Una pausa non reindirizza mai.

Gli obiettivi delle piattaforme usano **Creator** per le piattaforme video, **Account** per Twitter / X, **Community** per Reddit e ID di server/canale per Discord. I controlli si applicano dove Vault può identificare la fonte e il tipo di contenuto. I controlli dei contenuti nascondono elementi supportati della pagina, come annunci o schede video. Le autorizzazioni del browser e le modifiche dei siti possono influire su questi controlli.

### Filtri dei tag dei contenuti

La connessione a Classifier e la correzione dei tag sono disponibili nei browser Chromium supportati, come Chrome ed Edge, e in Safari Vault su macOS.

Connetti Mac Vault o Windows Vault e configura Classifier per ottenere i tag. Il filtro dei tag di un gruppo di blocco sceglie cosa coprire o nascondere. Non avvia né mette in pausa l'applicazione di tag; usa le impostazioni di Classifier nell'app desktop o il controllo di pausa del singolo gruppo Classifier.

Ogni voce di sito ha un filtro **Si applica a**: tutti i contenuti, i creator selezionati, tutti tranne i creator selezionati, i tag selezionati o tutti tranne i tag selezionati. Aggiungi un'altra voce per lo stesso sito se ti serve un filtro diverso.

Scegli alcuni tag o tutto tranne determinati tag. Una regola può combinare tag (**Gaming + Drama**), richiedere un livello di affidabilità (**Gaming @3**) o creare un'eccezione (**!Tutorial**). **Copri contenuto** mantiene disponibile la correzione dei tag. **Nascondi contenuto** rimuove l'elemento corrispondente.

**Blocca anche contenuti senza tag affidabili** include i risultati completati senza tag alla soglia di affidabilità predefinita, compresi i risultati con bassa affidabilità. Le regole esplicite elencate vengono controllate per prime. **Senza tag** significa che l'applicazione di tag è terminata senza assegnarne; **Applicazione tag in corso** indica un risultato in attesa. L'opzione separata per i contenuti in attesa controlla la copertura degli elementi finché l'applicazione di tag non termina.

### Correggi i tag

Fai clic su **+ tag** accanto ai tag di un elemento per aprire il selettore di correzione. Cerca i tag esistenti di Classifier e scegline uno da aggiungere. Fai clic sul comando di rimozione di un tag selezionato, oppure selezionalo e premi Delete una volta per rimuoverlo. Le correzioni vengono inviate all'app desktop collegata e usate per le future assegnazioni. Se la ricerca non è disponibile, appare **Senza tag** e può essere ripetuta automaticamente; questa visualizzazione non crea un tag in Classifier.

## Impostazioni e connessione

**Mostra il pulsante di aggiunta rapida +** aggiunge un piccolo pulsante alle pagine supportate. Seleziona un gruppo di destinazione nell'elenco; la scelta viene ricordata alla riapertura di Vault. Usa il pulsante nella pagina per aggiungerla all'elenco dei siti. Con una lista consentita, l'azione consente la pagina. I gruppi congelati non accettano aggiunte rapide.

I dizionari ufficiali e l’importazione/esportazione del dizionario personale si configurano nell’app desktop in **Impostazioni → Classificatore → Dizionari ufficiali**. Il servizio dei dizionari può essere contattato se un creator manca nella cache o sono attivi i contributi facoltativi; la ricerca sul Web ha consenso e impostazioni del provider separati. Consulta il manuale desktop e le informative.

La connessione a Classifier indica lo stato del servizio Vault desktop locale. Configura gruppi Classifier, download dei modelli, Knowledge, consenso alla ricerca e provider API nell'app desktop collegata.

Se mancano tag, verifica che l'app Vault desktop sia aperta, la connessione attiva, l'applicazione di tag abilitata, il gruppo Classifier pertinente ripreso e il feed della piattaforma registrato. Controlla lo stato del download del modello nell'app desktop. Se il blocco non si applica, verifica che il gruppo sia attivo e controlla obiettivi, programma, tempo consentito e stato del posticipo.
