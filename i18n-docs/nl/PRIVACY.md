# Privacybeleid - Aangepaste webblokkering

_Laatst bijgewerkt: 13-07-2026_

Op deze pagina wordt precies uitgelegd welke gegevens de **Custom Web Blocker**-browser bevat
extensie verzamelt, waar deze naartoe gaat en waarom elke browser toestemming heeft
gevraagd. Kort gezegd: wij bewaren uw regels en persoonlijke browsegegevens
niet. Tagregels kunnen openbare YouTube-kanaal-ID's opvragen, maar die
opvragingen worden niet bewaard of aan u gekoppeld.

## Samenvatting

- **Uw configuratie blijft in de browser.** Groepen, schema's, regels, logboeken,
  timers en voorkeuren worden alleen in `chrome.storage.local` opgeslagen.
- **Een tagopvraging bevat alleen een openbaar kanaal-ID.** Geen URL, videotitel,
  zoekterm, tijdstip, account of extensie-instelling wordt meegestuurd.
- **Opvragingen worden niet opgeslagen.** Het endpoint is alleen-lezen, voegt
  onbekende kanalen niet toe en koppelt het verzoek niet aan een persoon.
- **Er zijn geen analyses, telemetrie, advertenties of crashrapporten.**
- **Geen tracking** van browse-activiteit buiten wat strikt noodzakelijk is
  om de blokkeerregels toe te passen die u zelf hebt geconfigureerd.

## Wat lokaal wordt opgeslagen

De extensie slaat het volgende op in de lokale extensie van uw browser
opslag zodat het zijn werk over sessies heen kan doen:

- De blokgroepen die u maakt: hun namen, regeltypen, lijsten ervan
  geblokkeerde sites, schema's, snooze-instellingen, bevriezingsstatus en wat dan ook
  custom-rule JavaScript dat u schrijft.
- Runtimestatus per groep nodig om limieten af te dwingen (bijvoorbeeld hoeveel
  Er blijven vandaag minuten over van een begroting met uitgestelde uitkeringen, wanneer er een dutje is gedaan
  eindigt wanneer een strikte bevriezingsperiode eindigt).
- Uw eigen voorkeuren ingesteld in **Instellingen** (tick rate, automatisch opslaan
  debounce, standaard snooze-duur, standaard fallback-URL, debug-modus
  schakelen, gekozen UI-taal).
- Activiteitenlogboekvermeldingen weergegeven in het **Logboek**-paneel in de app, wat u kunt doen
  duidelijk uit de gebruikersinterface.

Deze gegevens worden alleen gelezen en geschreven door de eigen scripts van de extensie
op uw apparaat, en alleen binnen uw eigen browserprofiel.

## Wat NIET wordt verzameld of verzonden

- De browsegeschiedenis wordt niet geregistreerd, samengevat of verzonden.
- Pagina-inhoud wordt niet geëxfiltreerd, screenshot gemaakt of geregistreerd.
- Formulierinvoer, wachtwoorden en persoonlijke gegevens worden nooit gelezen.
- Er wordt geen informatie over u, uw apparaat of uw gebruik naar de
  extensie auteur of een derde partij.

## Waarom elke toestemming wordt gevraagd

| Toestemming | Waar wordt het voor gebruikt |
| --- | --- |
| `storage` | Bewaar en laad uw blokgroepen, instellingen en runtimestatus alleen in uw browser. |
| `favicon` | Toont in Chromium naast regels sitepictogrammen die al lokaal door de browser zijn gecachet. Dit verstuurt geen browsegeschiedenis en doet geen verzoek aan onze dienst. |
| `nativeMessaging` | Stuurt alleen in Safari sandboxverzoeken van aangepaste regels door naar de lokale app op het apparaat. Dit is geen cloudtransport. |
| `alarms` | Maak de achtergrondservicemedewerker op schema wakker om op tijd gebaseerde limieten te vernieuwen en de regelstatus bij te werken wanneer een snooze-, bevriezings- of planningsvenster eindigt. |
| `offscreen` | Voer JavaScript met aangepaste regels in een sandbox uit in een document buiten het scherm, zodat het niet aan de extensie kan ontsnappen of uw pagina's rechtstreeks kan raken. |
| `tabs` | Open de editor als een volledig tabblad wanneer u op het werkbalkpictogram klikt, zoek de URL van het actieve tabblad op om groepsregels te evalueren en laad tabbladen opnieuw na een regelwijziging die u in de editor hebt aangebracht. |
| `webNavigation` | Detecteer SPA-URL-wijzigingen (push-state navigatie), zodat feed-hiders en gebeurtenisgestuurde regels per platform kunnen reageren op navigatie op de pagina, en niet alleen op het laden van volledige pagina's. |
| `<all_urls>` hosttoegang | Pas uw blokkeerregels en feed-hiders per platform toe op welke sites u ook blokkeert. De extensie leest/wijzigt alleen pagina's op URL's waarvoor u actief een regel heeft geconfigureerd, en alleen om die regel af te dwingen. |

## Aangepaste regels

Als u aangepaste JavaScript-regels schrijft, doet die code het volgende:

- Draait in een off-screen document in een sandbox; het kan de
  netwerk, uw pagina's of andere extensies.
- Communiceert alleen met inhoudsscripts via een vaste berichtenbrug
  gedefinieerd door de helper-API van de extensie.
- Wordt automatisch in quarantaine geplaatst (uitgeschakeld met een logboekinvoer) als dit het geval is
  overschrijdt de ingebouwde CPU-, log-, post-bericht- of DOM-mutatielimieten.

Uw aangepaste regels worden lokaal opgeslagen bij de rest van uw instellingen
en worden nooit via het apparaat verzonden.

## Website- en maker-tagservicestatistieken

Dit gedeelte gaat over de **website en de creator-tagservice**. De extensie kan
openbare kanaal-ID's alleen-lezen opvragen; die verzoeken worden niet opgeslagen.
Het **Statistieken**-paneel bewaart alleen tellingen die niet aan een persoon zijn gekoppeld:

- **Downloadtellingen**: hoe vaak de downloadknop van elk product is gebruikt
  aangeklikt (macOS, Windows, browserextensie, Safari).
- **Creators geclassificeerd**: hoeveel YouTube-creators zijn getagd.
- **Accounts** — hoeveel accounts er zijn.
- **Vraag- en antwoordactiviteit** — het totale aantal forumposts en reacties.

Eén keer per uur registreert de server de huidige waarde van elk van deze tellingen en
niets anders. Er zijn geen records per gebeurtenis, geen klikstreams en geen sessie
geschiedenis.

- **Volledig anoniem/geanonimiseerd.** Dit zijn gewone totalen. Zij
  zijn **niet** gekoppeld aan uw naam, account, e-mailadres, IP-adres, apparaat of iets anders
  andere identificatie: er is geen manier om een telling aan een persoon toe te schrijven.
- **Nooit commercieel.** Deze gegevens zijn alleen bedoeld om de openbare statistieken te tonen
  paneel. Het wordt **nooit verkocht, gedeeld met derden, gebruikt voor reclame,
  of gebruikt voor enig ander commercieel doel.**
- **Optionele kanaal-ID-bijdragen.** Als – en alleen als – u zich aanmeldt, wordt de
  extensie/website mag YouTube **kanaal-ID’s** delen (nooit videotitels,
  kijkgeschiedenis of iets persoonlijks) om makers voor iedereen te classificeren.
- **Handmatige bijdragen.** Bij bewuste inzendingen door ingelogde gebruikers
  blijft de koppeling e-mail–kanaal-ID alleen gedurende het 24-uursquotum bewaard
  en wordt deze elk uur opgeschoond.
- **Openbare wachtrij.** Openbare ID's en status zijn zichtbaar, niet het tijdstip of de inzender.

## Kinderen

De extensie is een productiviteitstool voor algemene doeleinden. Dat is het niet
gericht op kinderen, verzamelt niet bewust gegevens van wie dan ook, en
toont geen reclame.

## Wijzigingen in dit beleid

Als de gegevenspraktijken in een toekomstige versie ooit veranderen, zal dit bestand dat ook doen
worden bijgewerkt en de wijziging wordt samengevat in de versieopmerkingen voor
die uitgave.

## Contactpersoon

Vragen, zorgen of bugrapporten: open een probleem op de
de bronrepository van de extensie, of gebruik het ondersteunings-e-mailadres vermeld op de
Chrome Web Store-vermelding.
