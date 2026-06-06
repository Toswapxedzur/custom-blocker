# Aangepaste webblocker - Handleiding

Dit is de volledige referentiehandleiding voor de extensie. Het begint met de eenvoudigste, meest voorkomende workflows en gaat geleidelijk over naar geavanceerde onderwerpen zoals aangepaste gebeurtenisgestuurde blokkeerregels en de helper-API.

Als je helemaal nieuw bent, lees dan **Snelle start** en **Blokkeergroepenoverzicht**. Alles onder deze secties is optioneel, afhankelijk van wat u wilt doen.

---

## 1. Wat deze extensie doet

Met Custom Web Blocker kunt u websites en online afleidingen blokkeren volgens de regels die u zelf definieert. U kunt:

- Blokkeer sites onmiddellijk met de eigen netwerkblokkering van de browser (hetzelfde soort blokkering dat `ERR_BLOCKED_BY_CLIENT` produceert).
- Gun uzelf een bepaald aantal minuten per dag op een site en blokkeer deze zodra u die limiet overschrijdt.
- Blokkeer specifieke soorten inhoud op Joetjoep, kortevideoportaal, Gezichtenboek, Fotogram, Livekanaal en gemeenschapsforum (niet de hele site).
- Verberg geblokkeerde inhoud van feeds op ondersteunde platforms in plaats van alleen afzonderlijke pagina's te blokkeren.
- Schema wanneer een regel actief is, per dag van de week en per `HHMM-HHMM`-tijdvenster.
- Bevries een regel, zodat u deze niet gemakkelijk kunt wijzigen. Strikte bevriezing vergrendelt het voor een bepaald aantal uren en vereist een bevestigingsritueel van 20 stappen om het ongedaan te maken.
- Sluimer een regel tijdelijk, maar pas nadat u een voldoende lange rechtvaardiging heeft geschreven.
- Schrijf **gebeurtenisgestuurde** aangepaste regels in scripttaal met helpers voor voorwaartse/achterwaartse timers, permanente opslag per groep, DOM-intenties per platform (verberg navigatieknoppen, verberg feedkaarten per predikaat, stel timers per subsectie in), URL-hulpprogramma's en gestructureerde logboekregistratie.
- Kies uit een ingebouwde bibliotheek met meer dan 50 kant-en-klare sjablonen (timers, schema's, het verbergen van feeds, focussessies, omleidingen, duwtjes, doorzettingsvermogen, DOM-tweaks, debug-helpers).
- Gebruik de extensie in meer dan 20 talen.

De extensie is een Chroom-browser Manifest V3-extensie met één editorpagina (de pop-up), één achtergrondservicemedewerker, één offscreen sandbox die aangepaste regelcode host en één inhoudsscript dat op elke pagina wordt uitgevoerd. Aangepaste regels leven in de offscreen-sandbox; ze worden één keer per Run-klik geladen en blijven geregistreerd totdat de regel wordt uitgeschakeld of verwijderd.

---

## 2. UI-rondleiding

Wanneer u op het pictogram van de extensie klikt, wordt de editor geopend als een volledige webpagina (geen kleine pop-up). De pagina heeft deze gebieden:

- **Bovenbalk**
  - Knop **Instructiehandleiding** (dit document)
  - **Taal** kiezer
  - **Instellingen**-uitrusting (geavanceerde schakelaars, inclusief **Debug-modus**)
- **Linkerpaneel — Blokgroepen**
  - Lijst met uw blokgroepen. Elke kaart toont de groepsnaam, een korte samenvattingsregel en een selectievakje voor in-/uitschakelen.
  - Met de knop **Toevoegen** wordt een nieuwe groep gemaakt. In de vervolgkeuzelijst ernaast wordt het type gekozen.
  - **Alles verwijderen** verwijdert elke groep, met extra bevestigingen als een groep bevroren is.
  - U kunt de `::`-handgreep op een kaart omhoog of omlaag slepen om groepen opnieuw te ordenen.
  - U kunt de verticale splitser slepen om het formaat van dit paneel te wijzigen.
- **Rechterpaneel — Editor**
  - Bewerkt de momenteel geselecteerde groep: naam, blokkeergedrag, blokkeerlijsten, typespecifieke filters, planning, bevriezen, snooze.
  - Alle wijzigingen worden automatisch een fractie van een seconde opgeslagen nadat u bent gestopt met typen of communiceren.
  - Voor **Aangepaste** groepen toont de editor ook de **Sjablonen**-browser, de **Uitvoeren**-knop en het **Logboek**-paneel (hernoemd van *Activiteitenlog* in v1.1).
- **Toast** (gecentreerde pop-up die vervaagt) — toont statusberichten zoals 'Opgeslagen wijzigingen'. of invoerfouten.
- **Overlay op de pagina** — terwijl een tabblad een actieve timer of blok heeft, verschijnt er in de linkerbovenhoek een overlay met alle beperkingen die daarop van invloed zijn, in `hh:mm:ss` (of `mm:ss`)-indeling. Meerdere beperkingen worden op meerdere regels gestapeld. Standaard aftellingen voor blokgroepen en timers met aangepaste regels delen deze overlay.

---

## 3. Snelle start1. Klik op het extensiepictogram. De editor wordt geopend als een volledige pagina.
2. Kies in het paneel **Groepen blokkeren** een groepstype uit de vervolgkeuzelijst:
   - `Default`, `Joetjoep`, `kortevideoportaal`, `Gezichtenboek`, `Fotogram`, `Livekanaal`, `gemeenschapsforum` of `Custom`.
3. Klik op **Toevoegen**. Er verschijnt een nieuwe groep en de editor opent deze.
4. Geef het een naam.
5. Vul de typespecifieke velden in (voor `Default` betekent dit de lijst **Geblokkeerde websites**).
6. Zorg ervoor dat het selectievakje van de groep in het linkerpaneel is ingeschakeld.
7. Bezoek een van de genoemde sites. De blokkering zou onmiddellijk van kracht moeten worden.

Dat is het hele gelukkige pad. De rest van deze handleiding bestaat uit slechts opties daarbovenop.

> Wanneer u op **Uitvoeren** drukt in een aangepaste groep, wordt de nieuwe regel gekoppeld aan **toekomstige** paginagebeurtenissen. Reeds geopende tabbladen blijven de vorige regel uitvoeren totdat u ze opnieuw laadt. De pop-up toont na elke succesvolle run een herinnering hierover.

---

## 4. Overzicht blokgroepen

Alles in deze extensie is georganiseerd als **blokgroepen**. Een blokgroep is één regelset:

- Het heeft een naam, een type en een ingeschakelde/uitgeschakelde status.
- Het heeft een blokkeergedrag (onmiddellijk, na een aantal minuten, of vast aftellen).
- Het heeft een optioneel schema (dagen + tijdvensters) en optionele bedieningselementen voor bevriezen/sluimeren.
- Afhankelijk van het type heeft het extra velden, zoals een lijst met websites, filters voor Joetjoep-creators, namen van subreddits of een gebeurtenisgestuurde scripttaal-regel.

U kunt een willekeurig aantal groepen hebben. Er kunnen meerdere groepen op dezelfde pagina van toepassing zijn; in dat geval wint de **strengste** regel:

- "Onmiddellijk blokkeren" is beter dan "blokkeren na enige tijd".
- Een groep met minder resterende tijd verslaat een groep met meer resterende tijd.

Het toevoegen van meer groepen kan dus alleen eerder een paginablok maken, nooit later.

**De evaluatievolgorde is van onder naar boven.** Wanneer de extensie uw blokgroepen herhaalt, begint deze met de groep onderaan de lijst en werkt zich omhoog. De groep bovenaan de lijst wordt als laatste geëvalueerd en krijgt het 'laatste woord'. Als een onderste groep bijvoorbeeld `helpers.getPlatformHelper().youtube().hideShortButton()` belt en een bovenste groep `showShortButton()`, blijft de knop zichtbaar. Sleep de `::`-greep op een kaart om deze volgorde te wijzigen.

---

## 5. Groepstypen

### 5.1 `Default` — blokkeer gewone websites

Voor het blokkeren van specifieke domeinen (het typische gebruiksscenario).

- **Geblokkeerde websites**: één site per regel. Zowel `facebook.com` als `https://www.facebook.com/somepage` werken; de extensie extraheert en normaliseert de hostnaam.
- Er is een siteregel van toepassing op die hostnaam en al zijn subdomeinen.
- Dit groepstype maakt gebruik van de eigen netwerkblokkering van Chroom-browser, vergelijkbaar met `ERR_BLOCKED_BY_CLIENT`. Dat betekent dat de navigatie naar een geblokkeerde URL wordt gestopt voordat de pagina zelfs maar wordt geladen.

### 5.2 `Joetjoep` — blokkeer Joetjoep en soortgelijke videosites

Voegt een sectie **Filters** toe aan de editor:

- **Inhoudstype**:
  - `Apply to all Joetjoep pages` — elke Joetjoep-pagina telt.
  - `Apply to Shorts`: alleen Shorts-pagina's tellen mee.
  - `Apply to long videos` — alleen `/watch`, `/live/`, `/embed/`, enz.
  - `Apply to Joetjoep posts` — communityposts (`/post/...`, tabbladen kanaalcommunity/posts).
- **Auteurfilter**:
  - `Do not filter by author` — identiteit van de auteur doet er niet toe.
  - `Apply to certain authors` — alleen vermelde auteurs activeren deze groep.
  - `Apply to all except certain authors` — vermelde auteurs zijn vrijgesteld.
- **Auteurs**: één auteur per regel. Accepteert `@handle`, volledige URL's, `/channel/UC...`, `/c/...`, `/user/...`.
- **Geblokkeerde vermeldingen in de Joetjoep-feed verbergen**: terwijl deze groep actief blokkeert, zijn overeenkomende kaarten in Joetjoep-feeds verborgen. Wanneer het blok inactief wordt, komen ze terug bij de volgende vernieuwing.

Voor Shorts- en Posts-inhoudstypen verbergt de extensie, als er geen auteursfilter is ingesteld en de groep momenteel blokkeert, ook relevante navigatie-items (invoer in de Shorts-zijbalk, Community-/Posts-kanaaltabbladen) en de bijbehorende planken zoals 'Nieuwste Joetjoep-posts'.

De korte versus lange detectie strekt zich uit tot andere videosites zoals kortevideoportaal, Vimeo, Livekanaal-clips/VOD's en Dailymotion wanneer hun paginavorm kan worden gedetecteerd.

### 5.3 `kortevideoportaal` — blokkeer kortevideoportaal-inhoud

Dezelfde editorkaart als de platform-video-editor, maar met kortevideoportaal-specifieke labels:- Inhoudstypen: korte video's, video's, profielpagina's.
- Auteurs: kortevideoportaal-handvatten (`@handle`) of profiel-URL's.
- Feed verbergen verbergt overeenkomende kaarten op kortevideoportaal-pagina's terwijl de groep actief is.

### 5.4 `Gezichtenboek` — blokkeer Gezichtenboek-inhoud

- Inhoudstypen: rollen, video's, berichten.
- Auteurs: paginanaam (`page.name`), profiel-URL of `profile.php?id=...`-formulier (de numerieke id blijft behouden als `id:<number>`).
- Feed verbergen verbergt bijpassende feedkaarten op Gezichtenboek.

### 5.5 `Fotogram` — blokkeer Fotogram-inhoud

- Inhoudstypen: rollen, video's, berichten.
- Auteurs: Fotogram-handvatten of profiel-URL's.
- Gereserveerde paden zoals `/reel/`, `/p/`, `/tv/`, `/explore/` worden niet als auteurs behandeld.
- Feed verbergen verbergt bijpassende kaarten op Fotogram.

### 5.6 `Livekanaal` — blokkeer Livekanaal-inhoud

- Inhoudstypen: clips, streams/VOD's, kanaalpagina's.
- Auteurs: kanaalnamen of kanaal-URL's.
- Gereserveerde paden zoals `/directory`, `/videos`, `/settings`, enz. worden niet behandeld als kanaalnamen.
- Feed verbergen verbergt bijpassende kaarten op Livekanaal.

### 5.7 `gemeenschapsforum` — blokkeer gemeenschapsforum of specifieke subreddits

- **Subreddits**: één subreddit per regel. Een lege lijst betekent dat de groep van toepassing is op heel gemeenschapsforum. Zowel `productivity` als `r/productivity` worden geaccepteerd.

### 5.8 `Custom` — blokkeren door gebeurtenisgestuurd scripttaal

U schrijft een scripttaal-functie die **handlers registreert** voor gebeurtenissen zoals het openen van de pagina, het wijzigen van de URL, de hartslag van de pagina, het einde van de timer en uw eigen aangepaste gebeurtenissen. De functie wordt één keer uitgevoerd per Run-klik; de geregistreerde handlers blijven actief in alle navigaties totdat u opnieuw op Uitvoeren drukt, de groep uitschakelt of verwijdert.

`Custom`-groepen worden niet weergegeven: blokkeergedrag, geblokkeerde sites, toegestane minuten, reset-interval, planningsdagen of tijdvensters. Ze behouden de **Blokkeerregels**-editor plus standaard besturingselementen voor bevriezen/snooze. Er is ook een knop **Sjablonen** die een vooraf ingestelde browser opent met geparametreerde starterregels; het toepassen van een voorinstelling vervangt de huidige regel na bevestiging.

Zie **Sectie 11** voor de volledige referentie naar aangepaste regels en helpers-API.

---

## 6. Blokkeergedrag

Voor de meeste groepstypes kies je één van de drie modi.

### 6.1 Onmiddellijk blokkeren

De regel is actief wanneer de groep is ingeschakeld, de planning dit toestaat en (voor platformgroepen) de pagina overeenkomt.

Voor `Default`-groepen wordt hierbij de native blokkering van Chroom-browser gebruikt. Voor platformgroepen wordt de in-page overlay/exit-logica gebruikt.

### 6.2 Blokkeren na een aantal minuten

Dit is een gebruiksbudget.

- **Toegestane minuten voor blok** (decimaal): hoeveel minuten je jezelf gunt per periode. Voorbeeld: `15`, `0.5`, `90`.
- **Timer reset-interval (uren)** (decimaal): hoe vaak het budget wordt gereset. Voorbeeld: `24` voor dagelijks, `1` voor elk uur, `0.25` voor elke 15 minuten.

Zolang u nog tijd over heeft, werkt de pagina normaal en wordt de timer-overlay weergegeven. Wanneer het budget nul bereikt, wordt de pagina voor de rest van de periode geblokkeerd en toont de overlay `0:00`, waarna het tabblad probeert af te sluiten.

De uitbreiding is per groep, per periode:

- Elke groep heeft zijn eigen budget.
- De tijd die wordt doorgebracht op een pagina die overeenkomt met de groep, telt mee voor het budget van die groep.
- Meerdere tabbladen in dezelfde groep delen het budget. Hun timers blijven gesynchroniseerd; Als u naar een ander tabblad overschakelt, wordt ook een vernieuwing geforceerd, zodat de huidige gedeelde tijd onmiddellijk wordt weergegeven.

Als er meerdere in de tijd beperkte groepen op dezelfde pagina van toepassing zijn, wint de strengste.

### 6.3 Timer (aftellen en dan blokkeren)

Deze modus toont een afteltimer en blokkeert zodra `0:00` wordt bereikt.

- **Timer reset-interval (uren)** (decimaal): zowel de timerduur als de resetfrequentie. Voorbeeld: `24` voor dagelijks, `1` voor elk uur, `0.25` voor elke 15 minuten.

In tegenstelling tot **Blokkeren na een aantal minuten** heeft deze modus **geen** een apart veld 'Toegestane minuten vóór blokkeren'. De timer start eenvoudigweg bij het reset-interval, telt af terwijl overeenkomende pagina's open zijn en blokkeert vervolgens tot de volgende reset.Aftellingen voor standaardgroepen en timers voor aangepaste groepen (zie **Paragraaf 11.3.1**) gaan beide **alleen verder als het tabblad zichtbaar is**. Als u van tabblad wisselt, het venster minimaliseert of het scherm vergrendelt, wordt het aftellen automatisch gepauzeerd.

---

## 7. Schema

Op de kaart **Schema** kunt u beperken wanneer een groep actief is:

- **Dagen om te blokkeren**: kies de dagen waarop de groep van toepassing is. Niet-aangevinkte dagen betekenen dat de groep die dag inactief is.
- **Tijdvensters**: lijst met vrije vorm, één venster per regel in `HHMM-HHMM`-indeling, bijvoorbeeld:

  ```
  0900-1000
  1200-1300
  ```

  De groep is alleen actief binnen die vensters. Lege lijst betekent de hele dag.

Dit geldt voor alle groepstypen behalve `Custom`. (Aangepaste regels kunnen hun eigen schema implementeren met behulp van `ev.time.dayName` / `ev.time.hour`; zie **Sectie 11.4**.)

---

## 8. Bevriezen (anti-manipulatie)

Door bevriezing is het moeilijk om een groep in een impuls uit te schakelen.

Op de **Freeze** kaart kies je:

- **Bevroren** — u kunt de groep niet bewerken of verwijderen, en u kunt de schakelaar voor inschakelen niet uitschakelen. Om iets te veranderen moet je het ontdooiritueel uitvoeren (zie hieronder).
- **Strikt bevroren** — hetzelfde als Frozen, maar het blijft vergrendeld gedurende een door u gekozen aantal uren (decimaal, tot 72). Totdat die timer afloopt, is zelfs het ontdooiritueel niet beschikbaar.

Wanneer een bevroren groep ontgrendeld kan worden, verschijnt de knop **Ontdooien**. Als u erop klikt, wordt het **ritueel van 20 stappen** gestart:

- Het modale toont een boodschap van zelfdiscipline.
- U moet 20 keer op `Confirm` klikken.
- Er is een gedwongen wachttijd van 5 seconden tussen klikken.
- Als u op enig moment annuleert, moet u opnieuw beginnen vanaf stap 1.
- De 20 berichten roteren zodat je ze ook daadwerkelijk leest.

Als de groep ook gemarkeerd is als "geen snooze" (zie volgende sectie), kunt u deze ook niet snoozen als deze bevroren is.

De bevriezingsstatus wordt weergegeven in de metaregel van de groepskaart, inclusief de resterende tijd voor strikte bevriezing.

---

## 9. Sluimeren (tijdelijk uitschakelen)

Met snooze wordt een groep tijdelijk uitgeschakeld zonder dat de bevriezing wordt opgeheven. Het ondersteunt vertraagde activering, cooldown na snooze, bevestigingsstappen en een totaal van de snooze-tijd.

Op de **Snooze**-kaart:

- **Sluiten toestaan voor deze groep** — indien uitgeschakeld, kan deze groep helemaal niet op snooze worden gezet (ook niet wanneer deze is bevroren).
- **Snooze gedurende (minuten)** — decimaal, hoe lang de snooze duurt.
- **Activeringsvertraging (minuten)** — decimaal `>= 0`. Nadat je de snooze hebt bevestigd, blijft de groep blokkeren totdat deze vertraging is verstreken; pas dan wordt de snooze actief.
- **Afkoelen na snooze (minuten)** — decimaal van `0` tot `5`. Nadat de snooze is afgelopen, kun je voor deze groep geen nieuwe snooze meer starten totdat de cooldown is afgelopen.
- **Tijden van bevestiging** — geheel getal `>= 0`. Als dit `0` is, wordt snooze onmiddellijk gepland. Anders start het starten van de snooze een bevestigingsritueel met precies zoveel stappen.

Elke bevestigingsstap voor snooze heeft een geforceerde wachttijd van **5 seconden** voordat de volgende klik is toegestaan. De modal vertelt je dit expliciet en toont het live aftellen op de knop.

Als de groep bevroren is, worden de snooze-instellingen vergrendeld op de waarden die vóór het bevriezen zijn gekozen. Je kunt het nog steeds op snooze zetten, zolang snooze toegestaan ​​is, maar je moet wel de opgeslagen instellingen voor vertraging/afkoelen/bevestiging gebruiken.

Op de snoozekaart wordt ook **Totale snoozetijd** voor die groep weergegeven. Dit totaal telt de volledige actieve snooze-duur, zelfs als de site tijdens die periode om een ​​andere reden bereikbaar wordt.

Wanneer een snooze eindigt, komt de regel onmiddellijk terug. Als de groep nog niet bevroren was, bevriest het toestel deze automatisch opnieuw aan het einde van de snooze.

Een statusbericht bevestigt de snooze. Wanneer de snooze eindigt, keert de groep automatisch terug naar normaal.

U kunt een snooze ook vroegtijdig beëindigen met de knop **Snooze beëindigen**.

Voor aangepaste groepen wordt door op **Start Snooze** te drukken ook een `snoozePress`-gebeurtenis naar de regel verzonden (zie de gebeurtenissentabel in **Sectie 11**), zodat een aangepaste regel de pers kan opnemen, een rechtvaardiging kan vastleggen of vervolggebeurtenissen kan activeren. De regel heeft **geen programmatische snooze-API**; hij kan reageren op de pers, maar kan deze niet annuleren of verlengen.

---

## 10. Bulkacties- **Alles verwijderen** verwijdert elke groep.
  - Er wordt altijd om bevestiging gevraagd.
  - Als ten minste één groep bevroren is, is hetzelfde ritueel van 20 stappen vereist als bij het ontdooien.
  - Als een groep strikt bevroren is en nog steeds vergrendeld is, is **Alles verwijderen** uitgeschakeld.

---

## 11. Aangepaste groepen — gebeurtenisgestuurde referentie (v1.1+)

Vanaf v1.1 zijn aangepaste regels **gebeurtenisgestuurd**. Uw regel is niet langer een functie per hartslag waarvan de retourwaarde de pagina blokkeert. In plaats daarvan is de regeltekst een script dat handlers **registreert** voor specifieke gebeurtenissen (pagina openen, URL-wijziging, paginahartslag, aangepaste gebeurtenissen, ...). De handlers blijven geregistreerd via paginanavigatie en tabbladschakelaars en leven in een langlevende **offscreen sandbox**.

De regeltekst wordt **één keer per Run-klik** uitgevoerd (of één keer wanneer de groep is ingeschakeld en er al een actieve bron bestaat). Om handlers opnieuw te laden, klikt u op **Uitvoeren** in de editor. De pop-up toont een herinnering waarin u wordt gevraagd een reeds geopende pagina opnieuw te laden, zodat de nieuwe regel daar ook van toepassing is.

### 11.1 Ondertekening van de regel

```js
(event, helpers) => {
  // Register handlers here. This function is called exactly once
  // per Run click (or when the group is enabled).
}
```

Twee argumenten:

- `event` — het **gebeurtenissenregister** voor deze groep. Gebruik het om handlers te registreren, te overschrijven, weer te geven, te tellen of de registratie ervan ongedaan te maken, en voor aangepaste `post(...)`-gebeurtenissen.
- `helpers` — de helperbundel (zie **11.3**).

Er wordt **niet** verwacht dat de functie een waarde retourneert. De beslissing om te blokkeren of toe te staan ​​wordt later genomen, wanneer er een gebeurtenis plaatsvindt en een van uw geregistreerde handlers `ev.preventDefault()` en/of `ev.setResult(...)` aanroept.

### 11.2 Levenscyclus

- **Uitvoeren** (knop per groep in de editor): de engine wist eerst elke handler die eerder met deze groep was getagd, en voert vervolgens de regeltekst opnieuw uit in de off-screen sandbox. Dit is de enige manier om opnieuw te registreren na het bewerken van de bron.
- **Groep uitschakelen**: elke handler die met deze groep is getagd, wordt gewist. De groepsbron wordt in de opslag bewaard, maar reageert niet meer op gebeurtenissen.
- **Groep opnieuw inschakelen**: de engine voert automatisch de actieve bron voor deze groep opnieuw uit.
- **Groep verwijderen**: hetzelfde als uitschakelen; alle handlers die met de groep zijn getagd, worden gewist.
- **Opnieuw registreren met dezelfde `(eventType, id)`**: overschrijft stil de vorige registratie.

De offscreen-sandbox wordt gedeeld door **alle** aangepaste groepen. Handlers van verschillende groepen bestaan ​​daar naast elkaar, elk intern getagd met hun groeps-ID, zodat "Uitvoeren", uitschakelen of verwijderen alleen de juiste groep raakt.

Als een aangepaste regel zich niet goed gedraagt ​​(synchrone oneindige lus, op hol geslagen logboekspam, enz.), plaatst de sandbox deze in quarantaine: de groep wordt automatisch uitgeschakeld en de fout wordt geregistreerd, zodat u deze kunt zien in het paneel Logboek. Om een ​​in quarantaine geplaatste regel opnieuw in te schakelen, corrigeert u de bron en klikt u op **Uitvoeren**. De engine wist de reden voor het afbreken en laadt de regel opnieuw.

### 11.2.1 Het gebeurtenissenregister (`event`)

Generieke methoden:

- `event.register(type, id, handler, options?)` — registreer een handler voor een willekeurig gebeurtenistype. `id` is uw eigen keuze. `options.priority` (standaard `0`) - hogere runs eerst. `options.intervalMs` — alleen voor `tickEvent`; geef deze specifieke handler gas ten opzichte van de globale tick. Opnieuw registreren met dezelfde `(type, id)`-overschrijvingen.
- `event.unregister(type, id)`, `event.unregisterAll(type)`.
- `event.post(type, data?, { scope })` — activeer een aangepast evenement. `scope: "global"` bereikt elke groep; standaard `scope: "group"` bereikt alleen handlers in dezelfde **dezelfde** groep.

Suiker per gebeurtenistype (één set methoden per ingebouwd type):

- `event.registerTickEvent(id, handler, opts)`, `event.getTickEvent(id)`, `event.getTickEvents()`, `event.countTickRegistered()`.
- `event.registerOpenWebEvent(id, handler, opts)`, `event.getOpenWebEvent(id)`, `event.getOpenWebEvents()`, `event.countOpenWebRegistered()`.
- Dezelfde vorm voor `closeWebEvent`, `switchWebEvent`, `switchDomainEvent`, `webChangedEvent`, `pageHeartbeatEvent`, `timerEnded`, `snoozePress`.

### 11.2.2 Ingebouwde gebeurtenistypen

| Typ | Wanneer het vuurt | `ev.data` nuttige lading |
|---|---|---|
| `tickEvent` | Wereldwijd gedeeld vinkje van 1 seconde in de hele browser. Wordt geactiveerd ongeacht de zichtbaarheid van het tabblad. Gebruik dit voor klokachtige logica die moet blijven draaien, zelfs als er geen tabblad is gefocust. | `{ intervalMs: 1000 }` |
| `pageHeartbeatEvent` | ~250 ms hartslag vanaf het tabblad **actief**, **zichtbaar**. Stuurt alle tabbladzichtbaarheidsbewuste logica aan, inclusief de automatische vink die is ingebouwd in de `getOrCreateTimer({ scope })`. Wordt **niet** geactiveerd vanaf tabbladen op de achtergrond of terwijl het scherm is vergrendeld. | `{ elapsedMs }` |
| `openWebEvent` | Er wordt een nieuw tabblad aangemaakt OF een nieuwe navigatie komt op een URL terecht die de engine voor dat tabblad nog niet heeft gezien. Wordt **niet** opnieuw geactiveerd voor reeds geopende tabbladen na een klik op Uitvoeren. | `{ previousUrl, isNewTab }` |
| `closeWebEvent` | Er is een tabblad gesloten. | `{ reason, nextUrl }` |
| `switchWebEvent` | URL **wijzigingen** binnen hetzelfde tabblad - terug/vooruit, SPA-routewijziging of een navigatie die op een andere URL terechtkomt dan voorheen. Wordt **niet** geactiveerd bij een normale herlaadbeurt (dezelfde URL). | `{ previousUrl, previousHostname, sameDomain }` |
| `switchDomainEvent` | URL-wijziging overschrijdt een hostnaamgrens (bijvoorbeeld `youtube.com` → `wikipedia.org`). Vuurt naast `switchWebEvent`. | `{ previousUrl, previousHostname }` |
| `webChangedEvent` | De pagina wordt op welke manier dan ook (opnieuw) geladen: open, switch, SPA-geschiedenisupdate, **of gewoon opnieuw laden met dezelfde URL**. Dit is de betrouwbare haak "de pagina is gewijzigd, evalueer alles opnieuw". Vuurt naast `openWebEvent` / `switchWebEvent` / `switchDomainEvent`, en is de enige die vuurt voor herladen met dezelfde URL. | `{ previousUrl, previousHostname, sameDomain, isFirstLoad, isReload, transition }` waarbij `transition` `"tabCreated"`, `"commit"` of `"history"` is |
| `timerEnded` | Een timer beheerd door de groep bereikt `currentMs === 0`. Enkel afgeleverd aan de eigenaarsgroep. | `{ timerId, displayName, direction, currentMs }` |
| `snoozePress` | De gebruiker heeft op **Start Snooze** gedrukt in de pop-up voor deze **aangepaste** groep. Pure notificatiegebeurtenis: de handler kan willekeurige code uitvoeren (loggen, omleiden, andere gebeurtenissen activeren), maar aangepaste regels hebben **geen programmatische snooze-API**. Houtblokken die hier worden geproduceerd, verschijnen als toast op het actieve tabblad. Enkel geleverd aan de geperste groep. | `{ triggeredAt }` |

URL's in `ev.url` en in gebeurtenisgegevens worden **genormaliseerd** voor gebeurtenissen: de pagina 'Nieuw tabblad' van Chroom-browser (die het 'Zoek Google of typ URL'-oppervlak van Google weergeeft), `about:blank` en gelijkwaardige newtab-schema's worden weergegeven als de lege tekenreeks `""`. Een timer gericht op `ev.url === ""` tikt dus alleen terwijl u zich op de nieuwe tabbladpagina bevindt. Reguliere `google.com`-URL's blijven ongewijzigd.

### 11.2.3 Het gebeurtenisobject (`ev`)

Elke handler wordt aangeroepen als `(ev, helpers) => void`. `ev` draagt:

- `ev.type`: het verzonden gebeurtenistype.
- `ev.groupId` — de id van de ontvangende groep.
- `ev.tabId`, `ev.pageId`, `ev.url`, `ev.hostname` — context voor de gebeurtenis.
- `ev.time` — `{ now, month, dayOfMonth, dayName, hour, minute }` momentopname bij verzending. `dayName` is `"Sunday"`..`"Saturday"`.
- `ev.data` — gebeurtenisspecifieke payload (zie tabel hierboven).

Methoden:

- `ev.preventDefault()` — markeer de verzending als "geblokkeerd". Het hostinhoudscript verlaat de pagina (of volgt `setRedirectLink`), tenzij een handler met een hogere prioriteit later `setResult(1)` instelt.
- `ev.stopPropagation()` — stop deze verzending onmiddellijk. **Voor deze gebeurtenis worden geen verdere handlers binnen een groep** ingeroepen.
- `ev.setResult(value)` — stel het verzendresultaat in. `value` kan een **getal** zijn in `[-255, 255]` (`-1` blok, `0` neutraal, `1` toegestaan; andere gehele getallen worden bewaard voor uw eigen debug-logica), of een **tekenreeks** (geïnterpreteerd als een omleidings-URL). De laatste `setResult`-oproep van alle handlers wint. Een numerieke `1` overschrijft alle eerdere `preventDefault`.
- `ev.setRedirectLink(url)` / `ev.getRedirectLink()` — de URL waar de host naartoe moet navigeren wanneer de verzending als geblokkeerd eindigt. Dit is de **enige** manier om om te leiden vanaf aangepaste regels; de editor geeft niet langer het veld 'Omleidings-URL bij blokkering' weer voor aangepaste groepen.
- `ev.post(type, data, { scope })` — vuur een vervolggebeurtenis af vanuit een handler.

Bovendien is `ev` een proxy: elk veld dat u erop instelt (bijvoorbeeld `ev.foo = 42`) wordt opgeslagen in een `custom`-kaart en kan worden teruggelezen door dezelfde afhandelaar of door latere afhandelaars in dezelfde verzending.### 11.3 Het `helpers`-object

Elke handleraanroep krijgt een nieuwe `helpers`-bundel, gericht op de ontvangende groep en de URL van de gebeurtenis. Constante velden:

- `helpers.now` — tijdperk milliseconden bij verzending.
- `helpers.currentUrl` — de gebeurtenis-URL, na newtab/lege normalisatie.
- `helpers.groupId` — groeps-ID ontvangen.

Gemakssnelkoppelingen (route naar dezelfde accumulatorbewuste functies die worden gebruikt door de onderstaande helpers, zodat de uitvoer nog steeds in het logboekpaneel terechtkomt):

-`helpers.log(...)`, `helpers.warn(...)`, `helpers.error(...)`.

Accessor-methoden:

- `helpers.getLogHelper()` — `log` / `warn` / `error`. De uitvoer is beperkt in snelheid en beperkt per verzending om te voorkomen dat op hol geslagen regels de pop-up bevriezen.
- `helpers.getDomainHelper()` (alias `helpers.getDomainUtility()`) — URL-inspectie (zie **11.3.5**).
- `helpers.getTimerHelper()` - timers voor groepen (aftellen / optellen); status blijft bestaan ​​bij het opnieuw opstarten van de browser.
- `helpers.getPersistenceHelper()`: JSON-sleutel/waarde-archief gericht op de groep.
- `helpers.getRedirectionHelper()` — `setRedirectLink(url)` / `getRedirectLink()` (en `set` / `get` aliassen) plus `createMessageUrl(message)` die een `chrome-extension://...` URL retourneert die het gegeven bericht weergeeft.
- `helpers.getPlatformHelper()` — DOM-intenties per platform (zie **11.3.6**).
- `helpers.getDOMHelper()` - generieke DOM-intenties: `hide(sel)`, `show(sel)`, `addClass(sel, c)`, `removeClass(sel, c)`, `setText(sel, text)`, `click(sel)`, `injectCss(css, id?)`, `removeInjectedCss(id)`, `scrollTo(sel)`. Bewerkingen worden in batches uitgevoerd en toegepast nadat de afhandelaar terugkeert.
- `helpers.getNavigationHelper()` — `back()`, `forward()`, `reload()`, `goTo(url)`, `closeTab()`. Effecten worden toegepast op het tabblad waar de gebeurtenis vandaan komt.
- `helpers.getStorageHelper()` — superset van `getPersistenceHelper` plus async `requestAsyncGet(key)` / `requestAsyncSet(key, value)` hooks voor opslag tussen extensies (de resultaten komen binnen als een vervolggebeurtenis op maat).
- `helpers.getTabHelper()` — `list()`, `getActiveTab()`, `getById(id)`, `countOpen()` tegen een momentopname die bij de gebeurtenis is geleverd.

Alle hulpmethoden zijn veilig: slechte parameters retourneren `null`, `false` of een lege waarde in plaats van te gooien.

#### 11.3.1 `getTimerHelper()`

Timers per groep. Elke timer wordt geïdentificeerd door een string `id` die u kiest; identiteit is afgestemd op de groep, dus twee groepen kunnen beide de id `"yt-shorts"` gebruiken zonder met elkaar in botsing te komen. De status blijft bestaan ​​wanneer de browser opnieuw wordt opgestart.

De persistente status van een timer is precies: `id`, `displayName`, `direction` (`"forward"` of `"backward"`), `isPaused` en `currentMs`. Er is geen opgeslagen "initiële duur" - `isExpired` is gewoon `currentMs === 0`. Voorwaartse timers lopen voor altijd door en verlopen nooit vanzelf. Achterwaartse timers stoppen met tikken bij `0` (geen negatieve waarden).

Er zijn twee bouwmethoden. Kies degene waarvan de semantiek overeenkomt met wat u wilt:

- `create({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **(re)creëert** altijd de timer met de opgegeven init-waarden, waarbij elke bestaande status wordt overschreven, inclusief `currentMs`. Gebruik dit als u "nieuw beginnen" bedoelt, b.v. binnen een one-shot reset-tak.
- `getOrCreateTimer({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **idempotent**. Als er al een timer met die `id` bestaat, kunnen de `displayName` en `direction` worden bijgewerkt, maar blijft `currentMs` behouden. Anders wordt het gemaakt met de opgegeven init-waarden. Dit is wat je wilt voor het veel voorkomende patroon "zorg ervoor dat mijn timer bestaat en laat hem dan tikken".

Beide methoden accepteren twee predikaatfuncties die de engine onthoudt gedurende de levensduur van de regel (ze overleven over hartslagen en over `webChangedEvent`-herevaluaties, maar ze worden **nooit bewaard** in de opslag):- `scope: (url) => boolean`: wanneer `true` de huidige zichtbare URL op elke `pageHeartbeatEvent` is, tikt de timer automatisch op basis van het hartslaginterval (~250 ms). De helper zelf blokkeert nooit; het werkt alleen `currentMs` bij. Maximaal één automatische tik per hartslag per timer.
- `domain: (url) => boolean` — wanneer `true` voor de huidige zichtbare URL wordt weergegeven, wordt de timer weergegeven in de overlay op de pagina (linksboven). Wanneer `domain` wordt weggelaten, valt de motor terug naar `scope` voor weergave, dus daar verschijnt ook een "vinkje op /korte pagina's" -timer zonder extra bedrading. Geef `domain` expliciet op als u een andere weergavepoort wilt (vink bijvoorbeeld alleen `/shorts/` aan, maar toon de resterende tijd voor heel `youtube.com`).

> **Belangrijk: een timer blokkeert nooit uit zichzelf.** Wanneer een achterwaartse timer nul bereikt, stopt hij gewoon bij nul en vuurt `timerEnded` één keer af. Of de pagina daadwerkelijk moet worden geblokkeerd, is aan een afzonderlijke `openWebEvent` / `switchWebEvent`-handler die `ev.preventDefault()` aanroept na controle van `helpers.getTimerHelper().isExpired(id)`. Door deze scheiding kunt u 'alleen waarschuwings'-timers, opteltrackers, zachte duwtjes of harde blokken bouwen - dezelfde primitief, uw keuze.

Andere methoden:

- `delete(id)`, `pause(id)`, `resume(id)` — standaard levenscyclus. Pauze bevriest `currentMs`.
- `setDirection(id, "forward" | "backward")`, `setCurrentMs(id, ms)`, `addMs(id, deltaMs)` — directe mutators (de meeste regels hebben deze niet nodig — laat de hartslag de timer voor je tikken).
- `setDisplayName(id, name)` — opnieuw labelen.
- `getCurrentMs(id)`, `getDirection(id)`, `getDisplayName(id)`, `isPaused(id)`, `exists(id)`.
- `isExpired(id)` — `true` iff `currentMs === 0`.
- `getState(id)` — `{ id, displayName, direction, isPaused, currentMs, isExpired }` of `null`.
- `list()` — elke timer die deze groep bezit, als een array van statusobjecten.

#### 11.3.2 `getPersistenceHelper()`

Kaartachtige opslag gericht op uw groep. Waarden moeten JSON-serialiseerbaar zijn.

- `set(key, value)`, `get(key, defaultValue?)`, `has(key)`, `delete(key)`, `keys()`, `entries()`, `clear()`, `size()`.

Zachte limieten: ongeveer 200 sleutels per groep, 16 KB per waarde.

#### 11.3.3 `getLogHelper()`

- `log(...args)`, `warn(...args)`, `error(...args)` — schrijf naar het **Logboek**-paneel in de pop-up (de helperbundel leidt ze nog steeds door dezelfde accumulator, ongeacht welke verzending ze heeft geproduceerd). Elke regel wordt voorafgegaan door `[CustomBlocker:groupId]`.
- De helper heeft harde caps: ongeveer **200 logboekvermeldingen per verzending** en een maximale tekenreekslengte per invoer. Overtollige invoer wordt verwijderd en meegeteld in `accumulator.logsDropped`. Dit is wat de pop-up beschermt tegen een wegloper van de `for (let i = 0; i < 100000; i++) helpers.log(i)`.
- Wanneer de **Debug-modus** is uitgeschakeld (standaard), worden gegevens op traceerniveau die de engine zelf uitzendt (verzendingsstart/handlertiming) overal onderdrukt. Ze worden niet weergegeven in het logboekpaneel en worden niet afgedrukt naar de console. Uw eigen `log` / `warn` / `error`-oproepen gaan altijd door.

#### 11.3.4 `getRedirectionHelper()`

Inspecteer/overschrijf de omleidings-URL die het inhoudsscript zal gebruiken als de huidige pagina geblokkeerd raakt.

- `get()` — retourneert de huidige effectieve omleidings-URL voor deze verzending. In eerste instantie is dit de geconfigureerde fallback-URL van de ingebouwde groep (indien aanwezig), anders `""`.
- `set(url)`: overschrijft de omleidings-URL voor deze verzending. Retourneert `true` bij succes, `false` voor niet-tekenreeksinvoer. Als u `""` passeert, wordt de omleidingsoverschrijving opgeheven en wordt teruggevallen op het normale standaard afsluitgedrag.
- `createMessageUrl(message)` — retourneert een `chrome-extension://<id>/message-page.html?msg=...`-URL die, wanneer ernaar wordt genavigeerd, het bericht op een schone pagina weergeeft. Handig om gebruikers door te sturen naar een scherm 'Ga werken'/'Neem een ​​pauze' nadat een timer is afgelopen. Voorbeeld: `ev.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Go Work"))`.

Net als de andere bijwerkingen van aangepaste regels wordt deze status gedeeld door alle regels in de huidige verzending. Omdat de regels van onder naar boven lopen, wint de bovenste regel die `set(...)` aanroept.

#### 11.3.5 `getDomainHelper()` (alias `getDomainUtility()`)

Helpers voor URL-inspectie. Er is geen `normalize()` omdat inkomende URL's al newtab-genormaliseerd zijn.

Kern:- `hostnameOf(url)`, `pathnameOf(url)`, `matches(hostname, site)`, `getPlatform(url)`.
- `isYouTubeHost`, `isTikTokHost`, `isInstagramHost`, `isFacebookHost`, `isTwitchHost`, `isRedditHost`, `isDiscordHost`.
- `youtube()`, `tiktok()`, `instagram()`, `facebook()`, `twitch()` — elk retourneert `{ isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId }`.

URL-filtering en sectiehelpers:

- `isEmptyStartPage(url)` — `true` voor de nieuwe tabbladpagina en equivalenten (de URL's die worden weergegeven als `""` voor handlers).
- `matchesAny(url, patterns)` — `patterns` kan een regex, een stringregex of een array van beide zijn.
- `pathStartsWith(url, path)` — grensbewust (`pathStartsWith("/r/", "/r")` is waar; `"/results/"` niet).
- `queryHas(url, key, value?)`, `queryGet(url, key)` - inspectie van queryreeksen.
- `isSearchPage(url)` - herkent Google / Bing / DuckDuckGo / Joetjoep-resultaten / gemeenschapsforum / Tjilper / X-zoekopdrachten.
- `isInfiniteFeedUrl(url)` — herkent de algoritmische feedoppervlakken van Joetjoep, kortevideoportaal, Fotogram, Gezichtenboek, gemeenschapsforum, X.
- `sameSection(a, b)` — dezelfde hostnaam EN hetzelfde eerste padsegment.

#### 11.3.6 `getPlatformHelper()`

DOM-intenties per platform en timers voor subsecties, plus inspectie. Elke `helpers.getPlatformHelper().<platform>()` retourneert een object waarvan de methodeset **wordt beheerd door het platform** - methoden die op een bepaald platform niet zinvol zijn, zijn eenvoudigweg afwezig, dus als u ze aanroept, wordt `TypeError: ... is not a function` gegenereerd in plaats van stilzwijgend geen actie te ondernemen. `twitch().hidePosts` bestaat bijvoorbeeld niet (Livekanaal heeft geen berichten) en `tiktok().hideShortButton` bestaat niet (de hele ervaring van kortevideoportaal is al een korte video). Gebruik `helpers.getPlatformHelper().hasMethod(platform, name)` of `.listMethods(platform)` voor introspectie tijdens runtime.

Methodematrix per platform:

| methode | youtube | tiktok | Fotogram | facebook | trillen |
|---|:---:|:---:|:---:|:---:|:---:|
| `hideShorts` / `showShorts` | ✓ |  |  |  |  |
| `hideReels` / `showReels` |  |  | ✓ | ✓ |  |
| `hideClips` / `showClips` |  |  |  |  | ✓ |
| `hideStreams` / `showStreams` |  |  |  |  | ✓ |
| `hideVideos` / `showVideos` | ✓ | ✓ |  | ✓ | ✓ (VOD's) |
| `hidePosts` / `showPosts` | ✓ |  | ✓ | ✓ |  |
| `hideShortButton` / `showShortButton` | ✓ |  |  |  |  |
| `hideHomePage` / `showHomePage` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `hideComments` / `showComments` | ✓ | ✓ | ✓ | ✓ | ✓ (chatten) |
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

De platformeigen namen (`hideReels`, `hideClips`, `hideStreams`) zijn GEEN afzonderlijke buckets van `hideShorts` / `hideVideos` - het opslagslot is hetzelfde; alleen de voor de gebruiker zichtbare naam volgt de terminologie van elk platform.

> **Predicaatlevensduur en regel voor één slot.** Elk van `hideShorts` / `hideReels` / `hideClips` / `hideStreams` / `hideVideos` / `hidePosts` / `filterComments` / `filterLive` bezit **één** persistent predikaat volgens `(group, platform, slot)`. Het predikaat is **niet** afgestemd op de huidige gebeurtenis. Als u het eenmaal hebt ingesteld, blijft het actief bij elke pagina die wordt geladen en bij elke verzending totdat de overeenkomende `show*()` wordt aangeroepen of de groep wordt verwijderd. Door dezelfde methode opnieuw aan te roepen met een nieuwe functie **vervangt** de vorige: de engine voegt nooit meerdere predikaten samen binnen één groep. Om voorwaarden te combineren, schrijft u één predikaat dat zelf het combineren doet, b.v. `yt.hideVideos(item => isShort(item) || hasKeyword(item))`. In **verschillende** groepen draagt ​​elke groep zijn eigen predikaat bij en wordt een item verborgen als het predikaat van een groep overeenkomt.

Inspectiemethoden ontlenen hun waarde op het moment van verzending aan een momentopname die bij de gebeurtenis is geleverd; hun beschikbaarheid wordt bepaald door de bovenstaande matrix.

URL-classificatoren worden altijd opnieuw weergegeven, ongeacht het platform: `isPlatformUrl`, `isShortUrl`, `isVideoUrl`, `isPostUrl`, `isHomePage`, `extractAuthor`, `extractVideoId`.Timers voor subsecties registreren de timer in de persistente groepsbucket en vinken, indien van toepassing, alleen URL's aan die overeenkomen met die subsectie. De timermethoden accepteren `{ id, direction, currentMs, displayName }` en volgen dezelfde poort per platform.

Voor predikaatmethoden wordt het predikaat per overeenkomende kaart aangeroepen met een genormaliseerde `item`: `{ url, name, author, length, views, publishedAt, description, live?, sponsored?, algorithmic? }`. Elk veld kan `null` zijn; "onschuldig totdat het tegendeel bewezen is" - retourneer `false` als het veld dat je nodig hebt ontbreekt.

### 11.4 Voorbeelden

**Eenvoudig**: blokkeer Joetjoep Shorts-pagina's op doordeweekse ochtenden:

```js
(event, helpers) => {
  const yt = helpers.getDomainHelper().youtube();

  function maybeBlock(ev) {
    if (!yt.isShortUrl(ev.url)) return;
    const { dayName, hour } = ev.time;
    const weekday = !["Saturday", "Sunday"].includes(dayName);
    if (weekday && hour >= 9 && hour < 12) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }

  event.registerOpenWebEvent("morning-block", maybeBlock);
  event.registerSwitchWebEvent("morning-block", maybeBlock);
}
```

**Gemiddeld** — Dagbudget van 30 minuten voor Joetjoep Shorts. De timer tikt automatisch aan op `pageHeartbeatEvent`'s terwijl een Shorts-URL zichtbaar is; een afzonderlijke handler dwingt het blok af wanneer de timer nul bereikt.

```js
(event, helpers) => {
  const TIMER_ID = "yt-shorts-budget";
  const yt = helpers.getDomainHelper().youtube();
  const onShorts = (url) => yt.isShortUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: 30 * 60 * 1000,
    displayName: "YT Shorts",
    scope: onShorts,
    domain: onShorts
  });

  function maybeBlock(ev, h) {
    if (!yt.isShortUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.setRedirectLink("https://example.com/focus");
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("budget-block", maybeBlock);
  event.registerSwitchWebEvent("budget-block", maybeBlock);

  event.registerTimerEndedEvent("budget-warn", (_ev, h) => {
    h.getLogHelper().log("Budget hit zero.");
  });
}
```

**Harder**: verberg individuele Joetjoep Shorts waarvan de auteurshandle te lang is, en injecteer een 'deze Short is verborgen'-CSS:

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

**Moeilijkst** — zend een aangepaste gebeurtenis uit van de ene handler naar de andere:

```js
(event, helpers) => {
  event.registerSwitchDomainEvent("track-domain", (ev) => {
    ev.post("domainChange", { from: ev.data.previousHostname, to: ev.hostname });
  });

  event.register("domainChange", "log-it", (ev, h) => {
    h.getLogHelper().log("crossed", ev.data.from, "→", ev.data.to);
  });
}
```

---

## 12. Sjablonen

Elke aangepaste groep heeft een **Sjablonen**-kiezer waarmee een doorzoekbare, vooraf ingestelde browser wordt geopend. De bibliotheek levert nu **50+ sjablonen**, georganiseerd in negen categorieën, zodat u kunt bladeren in plaats van helemaal opnieuw regels te schrijven:

| Categorie | Voorbeelden |
|---|---|
| **Timers** | Sitetijdbudget (aftellen + blokkeren), sitetijdtracker (optellen), Joetjoep Shorts-limiet, kortevideoportaal-feedlimiet, Fotogram Reels-limiet, Gezichtenboek Reels-limiet, Livekanaal Clips-limiet, Universeel afleidingsbudget, Dagelijkse tracker voor diepgaand werk |
| **Schema** | Werktijdenblok op weekdagen, sites die alleen in het weekend beschikbaar zijn, uitschakeling vóór bedtijd, slechts één uur toestaan, nieuws alleen tijdens de lunch, nieuwe start op maandag, eerste N minuten van elk uur toestaan, streng werkblok voor diep werk |
| **Feed/Shorts** | Blokkeer Joetjoep Shorts-URL's, verberg Shorts-kaarten, verberg Shorts op trefwoord, verberg Joetjoep-homefeed / reacties / trending, blokkeer kortevideoportaal FYP, verberg kortevideoportaal-shorts, blokkeer Fotogram Reels-URL's, verberg Fotogram Reels-feed, verberg Gezichtenboek-feed / Reels, verberg gemeenschapsforum / Tjilper / LinkedIn-home |
| **Omleiding** | Afleidingen → focuspagina, Shorts → /feed/abonnementen, reddit.com → old.reddit.com, twitter / x → Nitter, nieuw tabblad → takenlijst |
| **Focus** | Focussessie alleen op de toelatingslijst, Pomodoro 25/5, blokkeren tijdens vergadering, blokkeren na N bezoeken vandaag, blokkeren bij streakverlies |
| ** Duw** | Registreer elk afleidingsbezoek, waarschuw bij elk Shorts-bezoek, tel dagelijkse bezoeken aan een site |
| **Volharding** | Maandelijkse bezoeklimiet, wekelijkse ban-schakelaar, track bezochte chatdienst-kanalen |
| **DOM-aanpassingen** | Verberg Joetjoep-autoplay-schakelaar, verberg Tjilper / X "Wat er gebeurt", algemeen "verberg selectors op een site" |
| **Debuggen** | Demo aftellen (3 s), elke aangepaste gebeurtenis registreren |

Filterchips bovenaan de kiezer verfijnen de lijst op categorie (`Timer`, `Schedule`, `Feed`, …) en platform (`Joetjoep`, `kortevideoportaal`, `Fotogram`, …). Een sjabloon selecteren:

1. Laadt de parameterinvoer (URL, minuten, uurbereiken, enz.) in een klein formulier.
2. **Voorinstelling toepassen** geeft een voorbeeld van de gegenereerde bron weer.
3. Nadat u **De huidige aangepaste regel vervangen door deze voorinstelling?** heeft bevestigd, wordt de broncode naar de editor geschreven.
4. Vervolgens klikt u op **Uitvoeren** om de handlers van de regel te registreren in de offscreen-sandbox.

Sjablonen worden gedefinieerd onder `templates/*.js` (`timers.js`, `schedule.js`, `feed.js`, …). Elk bestand roept `CB_REGISTER_TEMPLATES([...])` aan tijdens het laden, en de pop-up gebruikt de samengevoegde lijst. Het toevoegen van een nieuwe sjabloon betekent dat u één item in het juiste bestand schrijft - geen ander loodgieterswerk.

---

## 13. Gedrag van meerdere pagina's- Alle geopende tabbladen in dezelfde groep delen dezelfde timer.
- Wanneer u naar een tabblad in dezelfde groep overschakelt, wordt de overlay onmiddellijk vernieuwd om de huidige gedeelde tijd weer te geven.
- Timers met aangepaste regels tikken alleen op het tabblad **actief zichtbaar** — aangestuurd door `pageHeartbeatEvent`. Achtergrondtabbladen en geminimaliseerde vensters verplaatsen deze niet naar voren. Dit komt overeen met het standaard aftellen van blokgroepen.
- Wanneer een nieuwe regel wordt toegevoegd, detecteert elke geopende pagina de wijziging en wordt deze binnen een fractie van een seconde opnieuw geëvalueerd; **maar** nieuw geregistreerde handlers "openen" niet met terugwerkende kracht reeds geopende tabbladen. Om die reden wordt in de pop-up na elke run een herlaadherinnering weergegeven.
- Wanneer een regel vervalt, worden verborgen feedkaarten en navigatieknoppen hersteld bij de volgende vernieuwing.

---

## 14. Instellingen

Open het dialoogvenster **Instellingen** via het tandwielpictogram in de bovenste balk.

- **Hartslaginterval**: hoe vaak het inhoudsscript de tabbladtijd rapporteert en `pageHeartbeatEvent` aanstuurt. Standaard 250 ms. Lagere waarden reageren beter, maar gebruiken meer CPU.
- **Tick-interval** — hoe vaak de globale `tickEvent` vuurt. Standaard 1000 ms.
- **Debug-modus** — standaard *uit*. Wanneer *aan*, verzendt de engine vermeldingen op traceerniveau naar het logboekpaneel (`[trace] dispatchEvent`, `[trace] N handler(s)`) en `[CustomBlocker:trace]`-regels naar de browserconsole. Laat het uit bij dagelijks gebruik; schakel het in terwijl u een regel voor wangedrag diagnosticeert. `pageHeartbeatEvent` wordt uitgesloten van traceringsregistratie, zelfs als de foutopsporingsmodus is ingeschakeld, omdat deze vier keer per seconde vuurt en de rest zou overstemmen.

---

## 15. Internationalisering

De hele gebruikersinterface is vertaald. Gebruik de **Taal**-kiezer rechtsboven.

Ondersteunde talen zijn onder meer Engels, Chinees (vereenvoudigd), Spaans, Japans, Koreaans, plus gedeeltelijke dekking voor Hindi, Arabisch, Bengaals, Portugees, Russisch, Punjabi, Duits, Frans, Turks, Vietnamees, Italiaans, Thais, Nederlands, Pools, Indonesisch, Urdu en Perzisch. Talen met gedeeltelijke dekking vallen terug op Engels vanwege ontbrekende tekenreeksen.

De handleiding zelf laadt het markdown-bestand dat overeenkomt met de door u geselecteerde taal, met Engels als reserve.

---

## 16. Statusberichten

Statusberichten verschijnen als een gecentreerde toast die na ongeveer twee seconden vervaagt:

- "Opgeslagen wijzigingen."
- "\"Groepsnaam\" gemaakt."
- "Aangepaste regel geladen — N ​​handler(s) actief. Om deze regel toe te passen op tabbladen die u al heeft geopend, laadt u ze opnieuw."
- Validatiefouten zoals 'Toegestane minuten moeten een getal groter dan 0 zijn.'
- "Snooze-minuten moeten een getal groter dan 0 zijn."
- "Bevroren groepen kunnen niet worden gewijzigd."

Bij invoervelden met formaatvereisten verschijnt de melding ook naast de betreffende knop (voor snooze).

---

## 17. Privacy en opslag

- Alles wordt lokaal opgeslagen in `chrome.storage.local`. Er worden nergens gegevens verzonden.
- Opgeslagen items zijn onder meer: ​​uw groepen, gebruikstimers, laatste resettijden, snooze-records, aangepaste timers en aangepaste persistente waarden.
- De extensie leest de pagina-inhoud niet verder dan wat nodig is om het paginatype (pad / hostnaam / bekende DOM-markeringen voor videosites) te detecteren en door de gebruiker geschreven predikaten te evalueren. Het leest uw berichten, berichten, opmerkingen of privé-inhoud niet.

---

## 18. Machtigingen

- `storage` — voor de bovenstaande gegevens.
- `declarativeNetRequest` — voor native blokkering van `Default`-groepen.
- `alarms` — om regelovergangen efficiënt te plannen.
- `tabs`, `webNavigation` — om het maken van tabbladen, URL-wijzigingen en paginahartslagen te detecteren, zodat gebeurtenissen kunnen worden verzonden.
- `offscreen` — om de duurzame sandbox met aangepaste regels te hosten.
- `host_permissions: <all_urls>` — zodat het inhoudsscript de timer-overlay kan weergeven en platformcontext op elke pagina kan detecteren.

---

## 19. Problemen oplossen- **Een groep die ik heb toegevoegd, doet niets.** Zorg ervoor dat de groep is ingeschakeld, dat de planning dit nu toestaat, dat er geen snooze actief is en (voor platformgroepen) dat de pagina daadwerkelijk overeenkomt met het gekozen inhoudstype en auteursfilter.
- **Een timer loopt vast of is verkeerd op één tabblad.** Schakel weg en terug, of focus op het tabblad, waardoor een geforceerde vernieuwing van de gedeelde timer wordt geactiveerd.
- **Feedkaarten verschijnen opnieuw nadat ik denk dat ze verborgen moeten worden.** Het verbergen van feeds wordt alleen uitgevoerd als de regel actief blokkeert. Als je een `after-minutes`-regel hebt, wordt het verbergen van feeds geactiveerd zodra je tijd nul bereikt.
- **Er is nog steeds een Joetjoep-navigatieknop waarvan ik verwachtte dat deze verborgen zou zijn.** Voor het verbergen van de navigatie moet de regel zijn ingesteld op 'niet filteren op auteur' en moet het inhoudstype Shorts of Joetjoep-posts zijn. Met auteursfilters is het verbergen alleen per kaart mogelijk.
- **Aangepaste regel deed niets of gooide stil.** Open Instellingen → schakel **Debug-modus** in, klik vervolgens opnieuw op **Uitvoeren** en bekijk het logboekpaneel. Regels voorafgegaan door `[trace]` tonen elke verzending en afhandelaar. Gebruik `helpers.getLogHelper().log(...)` om uw eigen traceerpunten toe te voegen. Als een regel die zich misdraagt ​​steeds automatisch in quarantaine wordt geplaatst, repareer dan de bron en klik op Uitvoeren. Met Uitvoeren wordt de reden voor het afbreken gewist.
- **Mijn nieuwe aangepaste regel heeft geen invloed op reeds geopende tabbladen.** Laad ze opnieuw. Aangepaste regels zijn gekoppeld aan *toekomstige* paginagebeurtenissen; de pop-up toont een herinnering om na elke run te herladen.
- **Mijn afteltimer loopt niet door.** Timers met aangepaste regels vinken alleen aan op het tabblad **actief zichtbaar** via `pageHeartbeatEvent`. Achtergrondtabbladen, geminimaliseerde vensters en vergrendelde schermen pauzeren ze door hun ontwerp - hetzelfde gedrag als het standaard aftellen van blokgroepen.
- **Ik kan een groep niet verwijderen.** Deze is waarschijnlijk vastgelopen. Strikt bevroren groepen kunnen helemaal niet worden verwijderd totdat hun vergrendeling verloopt; niet-strikte bevroren groepen kunnen worden verwijderd via het unfreeze-ritueel.
- **De pop-up toont voor altijd "Rennen...".** Een aangepaste regel is waarschijnlijk in de knoop geraakt. De engine schakelt deze uit na een moeilijke time-out en plaatst de regel in quarantaine. Open het paneel Logboek voor de reden van afbreken; herstel de regel en klik op Uitvoeren.

---

## 20. Woordenlijst

- **Blokkeergroep** — één regelset met zijn eigen type, gedrag, planning en bevriezen/snooze.
- **Direct blokkeren**: de regel blokkeert onmiddellijk wanneer deze actief is.
- **Blokking na minuten** — de regel begint pas te blokkeren nadat het tijdsbudget voor de periode is opgebruikt.
- **Resetinterval** — hoe vaak het budget na minuten wordt gereset.
- **Schema** — dagen + tijdvensters waarin een groep actief is.
- **Bevriezen / Strenge bevriezing** — anti-manipulatiestatussen.
- **Snooze** — tijdelijk uitschakelen met een configureerbaar bevestigingsritueel.
- **Auteursfilter** — beperkt voor platformgroepen de regel tot bepaalde makers van inhoud.
- **Contenttype** — voor platformgroepen beperkt deze regel tot bepaalde vormen van inhoud (kort, lang, post).
- **Helpers** — hulpprogramma's doorgegeven aan de handler van een aangepaste regel.
- **Platform** — een van `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Elk heeft zijn eigen groepstype en logica voor het verbergen van feeds.
- **Hartslag**: de `pageHeartbeatEvent` van ~250 ms verzonden vanaf het actieve zichtbare tabblad.
- **Vink aan** — de 1 s wereldwijd gedeelde `tickEvent` (zichtbaarheidsonafhankelijk).
- **Debug-modus** — een instelling die interne traceringsregistratie zichtbaar maakt in het logboekpaneel en de browserconsole.
- **Quarantaine** — automatische uitschakeling van een aangepaste regel die de runtime-veiligheidslimiet overschrijdt (deadline, logspam, …). Gewist bij de volgende run.

---

## 21. Beperkingen- Het verbergen van feeds is afhankelijk van de huidige DOM van elk platform. Als het platform van lay-out verandert, moeten de verborgen selectors mogelijk worden bijgewerkt.
- Platformcontextdetectie voor niet-Joetjoep-sites is grotendeels gebaseerd op URL's en is dus het meest betrouwbaar op URL's van canonieke inhoud.
- Timers met aangepaste regels tikken met een hartslagresolutie (~250 ms). Vertrouw er niet op voor de timing van minder dan een seconde.
- Predikaten doorgegeven aan `hideShorts` / `hideVideos` / `hidePosts` worden synchroon geëvalueerd per feedkaart. Zware logica in een predikaat kan het scrollen van de feed vertragen; hou ze goedkoop.
- Twee tabbladen die dezelfde timer per groep bewerken, gebruiken gelijktijdig een strategie voor 'laatste schrijven wint'. Voor normaal gebruik is dit prima; als u afhankelijk bent van exacte boekhouding, kunt u af en toe een kleine afwijking verwachten.
- De browser kan de achtergrondservicemedewerker opschorten wanneer deze niet actief is. De extensie hervat het zodra een pagina of alarm dit nodig heeft; site-/getimede gebruiksbudgetten blijven tellen via hartslagherhaling.

## v1.2-opmerking

De editor voor aangepaste regels kleurt nu scripttaal-syntaxis, en de templatebrowser gebruikt dezelfde kleuren voor codevoorbeelden. De bulkactie voor groepen heet **Wissen**.

