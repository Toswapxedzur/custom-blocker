# Privacybeleid - Aangepaste webblokkering

_Laatst bijgewerkt: 04-08-2026_

Deze pagina legt precies uit welke gegevens de browserextensie **Aangepaste webblokkering** verzamelt, waar ze naartoe gaan en waarom elke browsertoestemming wordt gevraagd. Kort gezegd: wij bewaren uw regels en persoonlijke surfgegevens niet. De optionele verzameling en classificatie door Vault Classifier blijven onder uw controle en gebruiken de geverifieerde lokale brug. Een aparte optionele lokale AI-integratie (MCP) is eveneens standaard uitgeschakeld en stelt gegevens alleen beschikbaar aan een assistent die u zelf verbindt en goedkeurt.

## Samenvatting

- **Uw configuratie blijft in uw browser.** Blokkeergroepen, planningen, aangepaste regels, logboeken, timers en voorkeuren worden uitsluitend bewaard in de lokale extensieopslag van Chrome (`chrome.storage.local`).
- **Vault Classifier is alleen lokaal.** Als u de optionele Vault Classifier-integratie uitdrukkelijk inschakelt, worden zichtbare YouTube-kaart-/pagina-elementen (zoals een titel, de zichtbare beschrijving, weergegeven labels en openbare maker-/video-ID's) uitsluitend via de geverifieerde lokale Vault-brug naar Vault Classifier op uw Mac gerouteerd. Ze worden niet naar onze website, een modelaanbieder, de YouTube Data API of een andere server verzonden.
- **Verzameling is een aparte opt-in.** Vault Classifier vraagt de extensie pas om gerenderde, advertentievrije YouTube-metadata nadat u de YouTube-verzameling in de werkruimte voor classificatiegegevens hebt ingeschakeld. Wanneer die uit staat, verzendt de extensie geen enkele titel of maker-metadata voor verzameling. Wanneer die aan staat, kunnen de bewaarde lokale velden een zichtbare titel, de naam/identificatie van de maker, het videotype, de duur, de zichtbare tekst met abonnees/weergaven/publicatiedatum en de canonieke URL bevatten.
- **Optionele lokale AI-integratie (MCP).** Als u die inschakelt en uw eigen AI-assistent verbindt, kan die assistent — op uw uitdrukkelijke aanwijzing — geselecteerde gegevens lezen (uw configuratie, activiteit, gebruikstijd, de URL's van de actieve/geopende tabbladen, zichtbare pagina-inhoud op door u geconfigureerde sites en eventuele Classifier-gegevens) via een lokale Vault-server op uw apparaat. Ze is standaard uitgeschakeld, elke verbinding wordt door u goedgekeurd, en wachtwoorden en API-sleutels zijn er nooit via leesbaar. Zie "Optionele lokale AI-integratie (MCP)" hieronder.
- **Er zijn geen analytics, advertentieprofielen, telemetrie of crashrapportage.**
- **Geen tracking** van surfactiviteit buiten wat strikt noodzakelijk is om de blokkeerregels toe te passen die u zelf hebt ingesteld.

## Wat lokaal wordt opgeslagen

De extensie slaat het volgende op in de lokale extensieopslag van uw browser, zodat ze haar werk over sessies heen kan doen:

- De blokkeergroepen die u maakt: hun namen, regeltypen, lijsten met geblokkeerde sites, planningen, snooze-instellingen, bevriezingsstatus en alle aangepaste regel-JavaScript die u schrijft.
- De runtimestatus per groep die nodig is om limieten toe te passen (bijv. hoeveel minuten van een uitgesteld toewijzingsbudget vandaag resteren, wanneer een snooze eindigt, wanneer een periode van strikte bevriezing eindigt).
- Uw eigen voorkeuren die u instelt in **Instellingen** (tikfrequentie, vertraging van automatisch opslaan, standaard snoozeduur, standaard terugval-URL, schakelaar voor foutopsporingsmodus, gekozen interfacetaal).
- De activiteitenlogboekvermeldingen die worden getoond in het paneel **Logboek** in de app, die u via de interface kunt wissen.
- Wanneer u Vault Classifier uitdrukkelijk inschakelt, houdt de lokale app ervan een door de gebruiker begrensde lokale cache bij van de zichtbare gegevens, lokale scores, beslissingen en correcties die nodig zijn om vermeldingen te classificeren en toe te lichten. Deze cache blijft op uw Mac en maakt geen deel uit van het normale verkeer tussen extensie en server.

Uw configuratie, runtimestatus en activiteitenlogboek blijven op uw apparaat en worden niet door onze dienst opgeslagen. Afhankelijk van de browserbuild en de functies die u inschakelt, kunnen ze worden verwerkt door de extensie, de apparaatlokale Safari-begeleidende app of een uitdrukkelijk gekoppelde lokale Vault-brug.

## Wat NIET wordt verzameld of verzonden

Dit beschrijft hoe de extensie zich op zichzelf gedraagt. De enige uitzondering is de optionele lokale AI-integratie (MCP) die u zelf kunt inschakelen en verbinden, beschreven in de volgende sectie.

- De browsegeschiedenis wordt door de extensie zelf niet vastgelegd, samengevat of verzonden; ze wordt alleen gebruikt om de door u ingestelde regels toe te passen.
- Pagina-inhoud wordt door de extensie zelf niet geëxfiltreerd, als schermafbeelding vastgelegd of gelogd.
- Vault Classifier-gegevens worden door de extensie niet van het apparaat verzonden. Ze worden alleen verwerkt door de gekoppelde lokale brug en de app wanneer u die integratie uitdrukkelijk inschakelt.
- Formulierinvoer en wachtwoorden worden nooit door de extensie gelezen; wachtwoorden en API-sleutels zijn ook via de lokale AI-integratie (MCP) niet leesbaar.
- Er wordt geen extensie-, account- of apparaatidentificatie en geen regelconfiguratie verzonden voor de normale handhaving van regels.

## Optionele lokale AI-integratie (MCP)

De extensie kan optioneel verzoeken beantwoorden van een lokale **Vault MCP-server** die binnen de Vault-desktopapps op uw eigen apparaat draait, zodat u uw eigen AI-assistent (een "MCP-client") kunt verbinden en die uw Vault-instellingen voor u kunt laten lezen of erop laten handelen. Deze integratie is **standaard uitgeschakeld** en verandert niets tenzij u ze bewust inschakelt.

- **U start ze.** Er wordt niets beschikbaar gesteld totdat u de integratie inschakelt en een MCP-client verbindt, en elke clientverbinding wordt door u goedgekeurd. Uitschakelen trekt de toegang onmiddellijk in.
- **De server is lokaal.** Gegevens die de extensie levert, worden via dezelfde geverifieerde apparaatinterne brug overgedragen aan een Vault MCP-server op uw Mac — niet aan onze website of een Vault-server. De extensie zelf verzendt uw gegevens niet naar derden.
- **Daarna beslist uw assistent.** Zodra een verbonden MCP-client op uw verzoek gegevens ontvangt, wordt wat ermee gebeurt bepaald door **die client** en diens eigen privacyvoorwaarden. Als de door u gekozen assistent op een externe dienst steunt, kan die assistent uw gegevens op uw aanwijzing verzenden — net zoals wanneer u informatie in een willekeurig AI-hulpmiddel plakt. Kies een client die u vertrouwt.
- **Wat kan worden blootgesteld.** Op uw aanwijzing kan een verbonden assistent uw blokkeergroepen, planningen, aangepaste regels, het activiteitenlogboek, de tellers van de gebruikstijd, de URL van het actieve tabblad of de geopende tabbladen, zichtbare pagina-inhoud op door u geconfigureerde sites en alle Vault Classifier-gegevens en -beslissingen lezen. Acties die de status wijzigen (groepen bewerken, een snooze starten, een opgeslagen regel uitvoeren, een classificatie starten) worden afzonderlijk bevestigd.
- **Geheimen blijven geheim.** Wachtwoorden (zoals een ouderlijk-toezichtwachtwoord) en API-sleutels van aanbieders zijn via deze integratie **alleen-schrijven**: ze kunnen worden ingesteld, maar kunnen door geen enkele assistent worden teruggelezen.
- **Alleen Chromium.** Net als de Classifier-brug bestaat deze integratie alleen in Chromium-browsers met de apparaatlokale host; Firefox en Safari stellen ze niet beschikbaar.

## Waarom elke toestemming wordt gevraagd

| Toestemming | Waarvoor ze wordt gebruikt |
| --- | --- |
| `storage` | Uw blokkeergroepen, instellingen en runtimestatus alleen in uw browser opslaan en laden. |
| `favicon` | Naast de regels de door de browser gecachte sitepictogrammen tonen in Chromium. Dit verzendt geen browsegeschiedenis en doet geen verzoek aan onze dienst. |
| `nativeMessaging` | In Chromium bij het apparaat een lokaal Native Messaging-bewijs aanvragen voor de geverifieerde Vault Classifier-brug; in Safari sandboxverzoeken van aangepaste regels doorsturen naar de apparaatlokale container-app. Het is geen cloudtransport. |
| `alarms` | De service worker op de achtergrond volgens planning wekken om tijdgebaseerde limieten en de regelstatus bij te werken wanneer een snooze-, bevriezings- of planningsvenster eindigt. |
| `offscreen` | De JavaScript van aangepaste regels in een sandbox uitvoeren in een offscreen-document, zodat het niet uit de extensie kan ontsnappen of uw pagina's rechtstreeks kan aanraken. |
| `tabs` | De editor als volledig tabblad openen wanneer u op het werkbalkpictogram klikt, de URL van het actieve tabblad opzoeken om groepsregels te evalueren en tabbladen herladen na een regelwijziging die u in de editor hebt gemaakt. |
| `webNavigation` | SPA-URL-wijzigingen (push-state-navigatie) detecteren zodat feedverbergers per platform en gebeurtenisgestuurde regels kunnen reageren op navigatie binnen de pagina, niet alleen op volledige paginaladingen. |
| Hosttoegang `<all_urls>` | Uw blokkeerregels en feedverbergers per platform toepassen op de sites die u kiest te blokkeren. De extensie leest/wijzigt pagina's alleen op URL's waarvoor u actief een regel hebt ingesteld, en alleen om die regel te handhaven; de optionele Vault Classifier-adapter is beperkt tot YouTube. |

## Aangepaste regels

Als u aangepaste JavaScript-regels schrijft, geldt voor die code:

- Ze draait in een offscreen-document in een sandbox; ze kan het netwerk, uw pagina's of andere extensies niet rechtstreeks bereiken.
- Ze communiceert met contentscripts uitsluitend via een vaste berichtenbrug die door de hulp-API van de extensie is gedefinieerd.
- Ze wordt automatisch in quarantaine geplaatst (uitgeschakeld met een logvermelding) als ze de ingebouwde limieten voor CPU, log, post-message of DOM-mutaties overschrijdt.

Uw aangepaste regels worden lokaal opgeslagen samen met de rest van uw instellingen en worden nooit van het apparaat verzonden.

## Websitestatistieken

Deze sectie gaat over de **website**. De website publiceert een klein **Statistieken**-paneel en houdt daarvoor op de server enkele geaggregeerde tellingen bij:

- **Downloadtellingen** — hoe vaak op de downloadknop van elk product is geklikt (macOS, Windows, browserextensie, Safari).
- **Accounts** — hoeveel accounts er bestaan.
- **Vraag-en-antwoordactiviteit** — het totale aantal forumberichten en reacties.

Eenmaal per uur legt de server de huidige waarde van elke geaggregeerde telling vast. Deze momentopnamen bevatten geen gebeurtenis per bezoeker, klikpad of sessiegeschiedenis.

- **Volledig anoniem / gede-identificeerd.** Dit zijn eenvoudige lopende totalen. Ze zijn **niet** gekoppeld aan uw naam, account, e-mail, IP-adres, apparaat of enige andere identificatie — er is geen manier om een telling aan een persoon toe te schrijven.
- **Nooit commercieel.** Deze gegevens bestaan alleen om het openbare Statistieken-paneel te tonen. Ze worden **nooit verkocht, met derden gedeeld, voor advertenties gebruikt of voor enig ander commercieel doel gebruikt.**

## Kinderen

De extensie is een productiviteitshulpmiddel voor algemeen gebruik. Ze is niet gericht op kinderen, verzamelt bewust van niemand gegevens en toont geen advertenties.

## Wijzigingen in dit beleid

Als de gegevenspraktijken in een toekomstige versie veranderen, wordt dit bestand bijgewerkt en wordt de wijziging samengevat in de versienotities van die release.

## Contact

Vragen, zorgen of foutrapporten: open een issue in de bronrepository van de extensie of gebruik het ondersteunings-e-mailadres dat op de Chrome Web Store-vermelding staat.
