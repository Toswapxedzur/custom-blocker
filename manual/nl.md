# Functionele referentie voor kluisextensie

## Doel en status

Dit is de gezaghebbende functionele specificatie voor de Vault-browserextensie. Het documenteert het productcontract: de gegevens die een gebruiker kan configureren, het exacte gedrag dat de configuratie oplevert, de openbare aangepaste regeltaal en de limieten die daarop van toepassing zijn.

Het is bewust geen snelstartgids. De website-tutorial is het leertraject. Dit document is bedoeld voor mensen die het voor gebruikers zichtbare gedrag van Vault moeten configureren, testen, onderhouden, controleren of reproduceren.

De code is de canonieke waarheid als dit document en het product het niet eens zijn. Namen in dit document maken waar mogelijk gebruik van de opgeslagen/openbare woordenschat van het product. Een woord als 'retouren' betekent de retourwaarde die beschikbaar is gemaakt voor een aangepaste regel; het belooft geen resultaat op browserniveau als de browser of pagina de gevraagde actie weigert.

## 1. Productgrens

Vault is een WebExtension met focuscontrole. De configuratie-eenheid is een **blokgroep**. Een groep kan:

- beslissen dat een website, platformpagina, maker, community, server, kanaal of account op het hoogste niveau moet worden geblokkeerd;
- verberg geconfigureerde platformoppervlakken of bijpassende feedkaarten;
- meet de tijd doorgebracht in een bijpassende scope;
- een schema, bevriezingsbeveiliging of tijdelijke snooze toepassen waar dat groepstype dit ondersteunt;
- voer een aangepaste JavaScript-regel uit met een gebeurtenis-API;
- toon een on-page timer, paneel, bericht of paginalogboek;
- omleiden, navigeren, een browsertabblad sluiten of een siteblokkeringslijst bijhouden die alleen voor sessies is gemaakt;
- optioneel deelnemen aan een lokaal verbonden Vault-bridgecluster.

Vault werkt alleen binnen het browserprofiel waar het is geïnstalleerd en alleen daar waar de browser toestaat dat het inhoudsscript wordt uitgevoerd. Het doet niet:

- installeer een native applicatie of browserextensie;
- besturingssysteemapplicaties blokkeren;
- browsertoestemmingsprompts, beperkingen voor privé-browsen of het eigen beveiligingsmodel van een website omzeilen;
- garantie op selector-gebaseerde verberging wanneer een platform van een derde partij zijn DOM wijzigt;
- maak de aangepaste regelstatus overdraagbaar tussen profielen, tenzij de gebruiker deze afzonderlijk exporteert/configureert;
- zorg voor een netwerkfirewall, een proxy, accountbeheer of een dienst voor ouderlijk toezicht.

De volgende terminologie wordt overal gebruikt:

| Termijn | Betekenis |
| --- | --- |
| Groep | Eén onafhankelijk benoemd configuratieobject. Namen moeten uniek zijn binnen de extensie, waarbij hoofdletters en kleine letters worden genegeerd. |
| Sitegroep | Een normale groep waarvan de domeinlijst de belangrijkste matchingvoorwaarde is. |
| Platformgroep | Een normale groep gespecialiseerd voor YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord of Twitter/X. |
| Aangepaste groep | Een groep die eigenaar is van een JavaScript-regel en de bijbehorende gebeurtenisregistraties. Zijn heerschappij bepaalt zijn gedrag. |
| Overeenkomen | De pagina, het feeditem of het platformoppervlak voldoet aan de geconfigureerde voorwaarden van een groep. |
| Actief | De groep is ingeschakeld, komt in aanmerking voor de planning en is momenteel niet op snooze gezet. Aangepaste groepen vallen niet onder de normale planningsUI. |
| Blok | Voorkom dat de huidige pagina op het hoogste niveau bruikbaar blijft, normaal gesproken door om te leiden naar het reservedoel. |
| Verbergen | Verwijder of verberg een element/kaart op de momenteel weergegeven pagina. Verbergen is geen netwerkblokkering. |
| Reserve-URL | Een groepsspecifiek omleidingsdoel. Indien leeg, wordt de globale fallback gebruikt. |
| Toestaan/uitzonderingseffect | Een platformkaartoordeel dat overeenkomende inhoud redt van verborgen regels met een lagere prioriteit. Het is geen algemene toelatingslijst voor websites. |

## 2. Groepsmodel en gemeenschappelijke levenscyclus

Elke opgeslagen groep heeft een stabiele ID, een naam, een type, een ingeschakelde vlag en gemeenschappelijke beleidsvelden. Standaard is een nieuwe normale groep ingeschakeld. Een groep kan worden geselecteerd, opgeslagen door het automatische opslaggedrag van de editor, opnieuw geordend, geëxporteerd, geïmporteerd, bevroren, gedeblokkeerd, op snooze gezet, uitgeschakeld of verwijderd.

### 2.1 Bestelling en overlap

Er kan meer dan één groep overeenkomen met dezelfde pagina. Vault evalueert opgeslagen groepen vanaf het einde van de weergegeven lijst naar het begin. Behandel lagere items in de lijst als overeenkomsten met latere/hogere prioriteit bij het ontwerpen van overlappende regels.

Voor gewone siteblokkering op het hoogste niveau kan elke toepasselijke blokkeringsgroep de pagina onbeschikbaar maken. Voor het filteren van feedkaarten gebruikt de platformcascade de volgorde en het effect van elke overeenkomende groep: een latere overeenkomende toestemming/uitzondering kan een item redden uit blokkeringspredikaten met een lagere prioriteit. Dit uitzonderingsgedrag is beperkt tot het platformkaartfilteroppervlak; het maakt een normaal siteblok van een hele pagina niet ongedaan.

### 2.2 Ingeschakelde status

Uitgeschakelde groepen blijven behouden, maar nemen niet deel aan normale matching, timers, schema's of gewone snooze-bewerkingen. Als u een aangepaste groep uitschakelt, worden ook de actieve registraties verwijderd. Door het opnieuw inschakelen wordt niet-opgeslagen tekst niet omgezet in een actieve aangepaste regel; voer de regel uit om de opgeslagen bron te laden.

### 2.3 Gemeenschappelijke velden

| Veld | Betekenis en beperkingen |
| --- | --- |
| Naam | Niet-leeg, bijgesneden en uniek, hoofdlettergevoelig binnen dit eindpunt. De brug identificeert ook koppelbare groepen op naam en type, dus stabiele namen zijn belangrijk. |
| Ingeschakeld | Schakelt normale matching in of uit. |
| Gedrag | Direct blokkeren, blokkeren na een toeslag, of timer/optellen. Aangepaste groepen gebruiken hun eigen regel in plaats van deze normale gedragsselector. |
| Toegestane minuten | Positief getal gebruikt door het blok-na-toelage-gedrag. Nieuwe groepen zijn standaard 15 minuten. |
| Intervaluren resetten | Positief getal gebruikt door getimede normale groepen. Nieuwe groepen zijn standaard 24 uur. |
| Actieve dagen | Maandag tot en met zondag. Een normale groep is inactief als de huidige lokale weekdag niet is geselecteerd. |
| Tijdvensters | Nul of meer lokale tijdvensters, één per regel, geschreven als HHMM-HHMM. |
| Bevriezingsmodus | Geen, Bevroren, Strikt bevroren of Ouderlijk bevroren. |
| Sluimerbeleid | Of de groep snooze toestaat, met opties voor duur/vertraging/cooldown/bevestiging voor normale groepen. |
| Reserve-URL | Bestemming die wordt gebruikt als de groep een pagina blokkeert. |
| Ga naar volgende | Indien opgegeven in de editor, wordt de normale blokkeringsstroom gevraagd voorbij het geblokkeerde doel te gaan in plaats van erop te blijven. |

### 2.4 Normaal groepsgedrag

De normale editor biedt drie gedragingen:

| Gedrag | Functioneel resultaat |
| --- | --- |
| Direct blokkeren | Zodra de groep actief is en overeenkomt, wordt de normale beslissing over het paginablok onmiddellijk genomen. |
| Blokkeren na een aantal minuten | De overeenkomende tijd voor zichtbare pagina's wordt opgeteld bij de geconfigureerde vergoeding. Wanneer de toegestane hoeveelheid is opgebruikt, blokkeert de normale groep totdat de gebruiksperiode wordt gereset of de groep anderszins inactief/snoozed is. |
| Timer (optellen, geen blokkering) | De overeenkomende zichtbare paginatijd wordt geregistreerd en kan worden weergegeven. Deze modus blokkeert nooit alleen maar omdat de timer een waarde bereikt. |

Getimed gebruik is gebaseerd op de tijd op de zichtbare pagina. Het is niet bedoeld om tijd in rekening te brengen terwijl een pagina verborgen is op een achtergrondtabblad. Het reset-interval is een voortschrijdend beleidsinterval voor de normale getimede groep. Normale timers zijn onafhankelijk per groep.

### 2.5 Schema's

Voor normale groepen gelden de roosters. Een aangepaste groep heeft geen normale schema-UI en wordt als actief beschouwd voor de doeleinden van zijn JavaScript; de regel moet zelf elke gewenste tijdsvoorwaarde opleggen.

Het actieve-dagenbeleid wordt geëvalueerd op basis van lokale tijd:

1. Als de huidige weekdag niet is geselecteerd, is de normale groep inactief.
2. Als er geen geldige tijdvensters zijn opgegeven, wordt onder een actieve dag de volledige dag verstaan.
3. Als er geldige vensters worden opgegeven, moet de huidige lokale tijd zich in ten minste één venster bevinden.

Elk venster heeft de exacte vorm UUMM-UUMM, bijvoorbeeld 0900-1200. De uren moeten van 00 tot en met 23 zijn, de minuten van 00 tot en met 59 en de start moet voor het einde op dezelfde dag liggen. Een venster omvat het begin ervan en sluit het einde ervan uit. Middernachtvensters, zoals 2300-0100, zijn niet geldig. Lege regels worden genegeerd en dubbele vensters worden samengevouwen.

### 2.6 Snooze

Voor een normale groep is snooze een tijdelijke inactieve toestand met maximaal drie fasen:

| Fase | Resultaat |
| --- | --- |
| In behandeling | De gevraagde snooze bestaat, maar is niet gestart vanwege de activeringsvertraging. De groep is nog steeds actief. |
| Actief | De groep is tijdelijk inactief gedurende de sluimerduur. |
| Afkoeling | De snooze is afgelopen, de groep is weer actief en een nieuwe snooze kan pas beginnen als de cooldown is verstreken. |

Configuratievelden voor normale groepen zijn:

| Veld | Regel |
| --- | --- |
| Snooze toestaan ​​| Indien uitgeschakeld, kan de normale snooze niet worden gestart. |
| Sluimerduur | Positieve minuten. Een nieuwe normale groep neemt de mondiale standaard, aanvankelijk 30. |
| Activeringsvertraging | Nul of meer minuten. Leeg betekent nul. |
| Afkoeling | Nul tot en met vijf minuten. Leeg betekent nul. |
| Bevestigingen | Een niet-negatief geheel getal. Het product vereist zoveel bevestigingsinteracties voordat het verzoek wordt ingewilligd. |

Een aangepaste groep beschouwt de knop Sluimeren alleen als een invoergebeurtenis. Vault verzendt de aangepaste gebeurtenis met de naam snoozePress voor die groep; het past niet de normale duur/vertraging/cooldown-fallback toe namens de regel. Een aangepaste regel kan de gebeurtenis, zijn eigen persistentie, een paneel, een timer of helemaal geen actie gebruiken.

### 2.7 Bevriezen

Bevriezing beschermt een groep tegen gewone configuratiewijzigingen en tegen normale snooze-wijzigingen. Als u een bevriezingsmodus in de selector kiest, wordt de groep niet vanzelf bevroren; de bevriezingsactie past de gekozen modus toe.

| Modus | Functioneel contract |
| --- | --- |
| Bevroren | De groep is vergrendeld totdat de normale bevestigingsstroom voor het ontdooien van het product is voltooid. |
| Strikt bevroren | De groep kan pas worden gedeblokkeerd als de strikte bevriezingsduur is verstreken. De duur moet groter zijn dan nul en niet langer dan 72 uur; een nieuwe groep is standaard ingesteld op 24 uur. |
| Ouderlijk bevroren | Voor het beheer van bevriezen/deblokkeren is een beheerderswachtwoord vereist. Het configuratiedialoogvenster gebruikt een wachtwoord van zes cijfers. |

Vastgezette groepen kunnen niet via gewone velden worden bewerkt. Een bridge-gekoppeld cluster met een offline lid kan ook de bevriezingsbesturingselementen vergrendelen, omdat Vault de bevroren status binnen het cluster niet veilig kan coördineren. Freeze is bescherming tegen normale UI-bewerkingen; het verandert een browserprofiel niet in een onveranderlijke beveiligingsgrens.

### 2.8 Importeren, exporteren, wissen en opnieuw instellen

Exporteren produceert een compatibele representatie van de geselecteerde groep. Import valideert en normaliseert compatibele groepsgegevens voordat deze worden toegevoegd. Geïmporteerde groepsnamen moeten nog steeds uniek zijn. Groep verwijderen verwijdert die groep en de normale gebruiks-/sluimerstatus. Clear verwijdert alle groepen na bevestiging.

Het resetten naar de standaardwaarden is een bewerking van **algemene instellingen**. Het negeert voorkeuren voor de hele extensie; het is geen import-/exportsubstituut en moet als destructief worden behandeld.

## 3. Groepstypen en bijpassend contract

### 3.1 Standaard websitegroep

Een sitegroep is eigenaar van een door regels gescheiden websitelijst. Inzendingen worden genormaliseerd in host-/domeinvorm. Een hostvermelding komt overeen met die host en al zijn subdomeinen.

| Instelling | Resultaat |
| --- | --- |
| Blokkeer alles behalve deze sites uit | De lijst is een blokkeerlijst. Een overeenkomende host is geblokkeerd. |
| Blokkeer alles behalve deze sites op | De lijst is een toelatingslijst. Elke host die niet in de lijst staat, wordt geblokkeerd. Een lege toelatingslijst is daarom een ​​opzettelijke volledige webblokkering. |
| Startpagina blokkeren | Past het beleid van de groep toe op het geconfigureerde start-/thuisoppervlak van de browser waar dat besturingselement beschikbaar is. |
| Reserve-URL | Omleidingsbestemming voor een blok. Een lege groepswaarde valt terug naar de globale standaardwaarde. |

De normale lijst met sitegroepdomeinen is de enige declaratieve lijst met hele sites die door de editor wordt weergegeven. Platformgroepen komen in plaats daarvan overeen met hun eigen platform en geconfigureerde platformvoorwaarden.

### 3.2 Videoplatformgroepen

YouTube, TikTok, Facebook, Instagram en Twitch zijn videoplatformgroepen. Elk is beperkt tot zijn eigen platformhost. Een groep kan zich richten op de vorm van de inhoud, het bereik van de auteur/account, de thuisfeed van het platform en optionele besturingselementen voor het verbergen van elementen.

De algemene auteurmodi zijn:

| Modus | Resultaat |
| --- | --- |
| Alles | Beperk niet op auteur; andere geconfigureerde assen beslissen de wedstrijd. |
| Inclusief | Match alleen de vermelde genormaliseerde makers/accounts. |
| Uitsluiten | Match alle gedetecteerde makers/accounts, behalve de vermelde vermeldingen. |
| Niemand | Match geen auteur. Dit is een opzettelijke auteursas die niet overeenkomt. |
| Tag omvat | Match makers met een vermelde tag wanneer Vault ze kan classificeren. Onbekende/niet-geclassificeerde makers kunnen niet worden geopend. |
| Tag uitsluiten | Match makers zonder de geconfigureerde tag(s) wanneer Vault ze kan classificeren. Onbekende/niet-geclassificeerde makers kunnen niet worden geopend. |

De keuzes voor de inhoudsvorm zijn platformspecifiek:

| Platform | Inhoudsvormen |
| --- | --- |
| YouTube | Alle pagina's, shorts, lange video's, berichten. |
| TikTok | Alle pagina's, korte video's. |
| Facebook | Alle pagina's, rollen, video's, berichten. |
| Instagram | Alle pagina's, rollen, video's, berichten. |
| Trek | Alle pagina's, clips, streams/VOD's, kanaalpagina's. |

Vault normaliseert de invoer van auteurs. De editor accepteert de gewone handle/channel/page-vorm van het platform en de ondersteunde profiel-URL's. Het kan verkeerd opgemaakte inzendingen afwijzen of als ongeldig weergeven in plaats van ze stilletjes in een ander doelwit te veranderen.

Keuzes voor oppervlaktehuid zijn onafhankelijk van blokkering op het hoogste niveau. Ze hebben alleen invloed op de huidige gebruikersinterface van het platform en kunnen niet meer werken als het platform de markup wijzigt.

| Platform | Verzonden keuzes voor verborgen elementen |
| --- | --- |
| YouTube | Shorts-navigatie/planken/kaarten, promotie-/advertentieoppervlakken in de homefeed en opmerkingen. De advertentiegerelateerde optie geeft een waarschuwing omdat het verbergen van advertenties in strijd kan zijn met de voorwaarden van een platform. |
| TikTok | Ontdek navigatie. |
| Facebook | Molennavigatie en molenoppervlakken. |
| Instagram | Rollen en verken navigatie/oppervlakken. |
| Trek | Blader door navigatie. |

Bij het matchen van YouTube-creatortags wordt gebruik gemaakt van lokale/beschikbare kanaalclassificaties. Een ontbrekende classificatie wordt niet louter een blok omdat er een tagmodus is geselecteerd.

### 3.3 Reddit

Een Reddit-groep is alleen van toepassing op Reddit. De entiteit ervan is een subreddit. Subreddit-invoer accepteert de gewone communityvorm en normaliseert deze voordat deze wordt gematcht.

De subreddit-modi zijn:

| Modus | Resultaat |
| --- | --- |
| Alles | Solliciteer op Reddit zonder beperking op de subredditlijst. |
| Inclusief | Toepassen op vermelde subreddits. |
| Uitsluiten | Van toepassing op alle behalve de vermelde subreddits. |
| Niemand | Toepassen op geen subreddit. |

De meegeleverde optie voor oppervlakte verbergen verbergt de navigatie Populair/Alles. Het gedrag van de feedkaart is afhankelijk van de momenteel detecteerbare kaartstructuur van Reddit.

### 3.4 Onenigheid

Een Discord-groep is alleen van toepassing op Discord/Discordapp-pagina's. Het doel ervan is een server-ID of een server/kanaalpaar. De doeleditor accepteert genormaliseerde Discord-kanaalpadwaarden.

| Modus | Resultaat |
| --- | --- |
| Alles | Ben van toepassing op Discord zonder beperking van de doellijst. |
| Inclusief | Alleen van toepassing op vermelde server- of server-/kanaaldoelen. |
| Uitsluiten | Toepassen op alle doelen, behalve de vermelde doelen. |
| Niemand | Toepassen op geen doel. |

Discord heeft momenteel geen optie voor verborgen elementen in het normale platformprofiel.

### 3.5 Twitter/X

Op X/Twitter is een Twitter/X-groep van toepassing. Het kan van toepassing zijn op alle accounts of de algemene accountmodi gebruiken die zijn beschreven voor videoplatforms, met genormaliseerde invoer van handle/profiellink.

De verzonden keuzes voor verborgen elementen zijn Explore, Messages, Grok, Trends en gepromote feeditems. Zoals bij alle op selectoren gebaseerde oppervlaktebesturingselementen kan een wijziging in de X-markering de werking ervan beïnvloeden.

### 3.6 Aangepaste groepsdeclaratieve velden

Een aangepaste groep voert voornamelijk de JavaScript-bron uit. Er wordt geen gebruik gemaakt van de normale gedragskiezer of de normale schema-UI. Het kan niettemin een domeinlijst bevatten wanneer het wordt geïmporteerd of geconfigureerd via compatibele gegevens:

- een niet-lege aangepaste blokkeerlijst kan deelnemen aan de gewone sitebeslissing over een hele pagina;
- een aangepaste toelatingslijst kan zelfs deelnemen als deze leeg is, waardoor een volledige webdeclaratieve vergrendeling ontstaat;
- een niet-geconfigureerde Aangepaste groep blokkeert niet per ongeluk pagina's alleen maar omdat deze een regel heeft;
- Aangepaste timers blokkeren nooit vanzelf; een regel bepaalt expliciet of er moet worden geblokkeerd wanneer een timer afloopt.

## 4. Algemene instellingen

Algemene instellingen zijn van toepassing op de extensie in plaats van op één groep.

| Instelling | Standaard | Gedrag |
| --- | --- | --- |
| Vinkpercentage | 1000 ms | Frequentie van de gedeelde Custom tickEvent. Geldig bereik is 250 tot en met 60.000 ms. Lagere waarden kunnen gebeurtenisgestuurde regels responsiever maken, maar meer CPU gebruiken. |
| Debounce automatisch opslaan | 400 ms | Vertraging na de laatste editorwijziging voordat de normale instellingen blijven bestaan. Maximaal is 5.000 ms. |
| Foutopsporingsmodus | Uit | Maakt uitgebreide traceringsuitvoer van aangepaste regels en de overlay voor foutopsporingslogboeken op de pagina mogelijk. Het bepaalt niet of de gewone logaanroepen van een regel het pop-uplogboek bereiken. |
| Aangepaste regellogboeken op webpagina's weergeven | Aan | Bestuurt gewone paginalogboektoasts. Regelauteurs kunnen nog steeds expliciet uitvoer op het scherm of alleen pop-ups aanvragen. |
| Standaard snoozeduur | 30 minuten | Seed gebruikt bij het maken van nieuwe normale groepen. Bestaande groepen behouden hun eigen duur. |
| Standaard reserve-URL | over:leeg | Wordt gebruikt wanneer een blokkerende groep geen groepsspecifieke reserve-URL heeft. |
| Help makers te classificeren | Uit | Expliciete aanmelding. Het stuurt gevonden YouTube-kanaal-ID's alleen naar de geconfigureerde classificatieservice; het verzendt geen titels of kijkgeschiedenis. |
| Lokale bestandsmap | Geen | Optionele mapmogelijkheid voor aangepaste regels. Zie sectie 9. |
| Web-app-bridge | Uit | Optionele verbinding met een compatibele lokale Vault-hub. Zie paragraaf 11. |

### 4.1 Editorinterface en feedbackoppervlakken

De extensie-editor heeft een permanente groepslijst en een editor voor geselecteerde groepen. De groepslijst bevat de groepstypekiezer, Toevoegen, Wissen, Selectie, Inschakelen en Sleepvolgorde. De verdeler is aanpasbaar. De editor voor geselecteerde groepen levert groepsspecifieke velden en de groepsexport-/importacties.

De editor slaat gewone veldwijzigingen automatisch op na de globale debounce-periode. Validatiefouten worden gerapporteerd als status-/toastfeedback; ongeldige normale waarden worden niet stilletjes omgezet in niet-gerelateerde instellingen. Een bevroren groep schakelt de gewone bewerkingsknoppen uit.

De extensie heeft ook deze voor de gebruiker zichtbare feedbackoppervlakken:

| Oppervlakte | Functioneel doel |
| --- | --- |
| Handleiding | Opent deze referentie in de extensie. |
| Taalkiezer | Kiest de taal van de extensie-interface. |
| Instellingen | Opent de hierboven beschreven algemene instellingen. |
| Status-/toastfeedback | Rapporten opslaan, importeren, validatie en actieresultaten. |
| Timer-overlay op de pagina | Toont actieve normale timer-/aftelitems en aangepaste timers die zich binnen hun weergavebereik bevinden. Er kunnen meerdere items naast elkaar bestaan. |
| Logoppervlak op de pagina | Ontvangt aangepaste log-, waarschuwings- en foutoproepen indien toegestaan ​​door de algemene instellingen. |
| Aangepast logboek | Een live activiteitenlogboek voor door regels gemaakte pop-up-zichtbare vermeldingen. Het kan worden gewist en gedownload. |

Voor aangepaste groepen wordt in het veld Regels de brontekst opgeslagen. Eerst uitvoeren voert de preflight van de syntaxis van de regel uit en laadt de bron pas als dat lukt. De editor voert ook lokale bronvermeldingen uit als tekst verandert. Het zichtbare besturingselement **Let AI Code** opent een promptveld en kopieert een bundel voor het genereren van code met daarin het verzoek van de gebruiker, de huidige regel en een gegenereerde verwijzing naar de huidige aangepaste regel-API. Er wordt geen contact opgenomen met een AI-service en de regel wordt niet automatisch gewijzigd.

Het besturingselement Sjablonen opent de sjabloonbrowser. Wanneer een sjabloon wordt verzonden, heeft deze een titel, beschrijving, tags, parameters en een gegenereerd voorbeeld. Als u deze toepast, wordt na bevestiging de huidige regeltekst vervangen. De momenteel verzonden sjablooncatalogus is leeg; de browser blijft beschikbaar voor toekomstige beheerde sjablonen en mag niet worden behandeld als een bron van actieve regels.

## 5. Taal op maat

### 5.1 Regelbronformulieren

De bron van een aangepaste groep is JavaScript. Bij **Uitvoeren** verwijdert Vault de eerdere registraties en status van de groep die door de vorige actieve bron zijn gemaakt, en laadt vervolgens de nieuwe bron.

De bron kan zijn:

1. a function expression accepting events and helpers; or
2. kale instructies die gebruik maken van de opgegeven gebeurtenissen (of oudere gebeurtenissen) en helpersvariabelen.

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

Run voert de JavaScript-syntaxis/preflightcontrole uit en maakt, alleen als dit lukt, de huidige bron actief. Het opslaan van tekst en het uitvoeren van tekst zijn opzettelijk verschillend: een regel kan worden opgeslagen zonder de actieve gebeurtenisbron te worden.

De actieve bron wordt verwijderd wanneer de aangepaste groep opnieuw wordt uitgevoerd, uitgeschakeld, verwijderd of expliciet gestopt. Als u de regel opnieuw uitvoert, worden de handlers, timers, panelen, persistentiebucket en door regels gemaakte platformpredikaten van de regel gewist voordat de registratie begint. Een sandboxherstel kan de actieve bron opnieuw laden; regelauteurs moeten daarom de registratie idempotent maken.

### 5.2 Uitvoeringsmodel en veilige aannames

Custom rules are event registrations, not a continuous script loop. Register handlers during rule initialization, then respond to events.

Elke begeleider ontvangt:

```js
(event, helpers) => {
  // event: the currently dispatched event object
  // helpers: the public Vault Custom-rule API
}
```

Handlers voor een gebeurtenis die wordt uitgevoerd met aflopende numerieke prioriteit; gelijke prioriteit maakt gebruik van registratievolgorde. Een handler kan worden vervangen door hetzelfde gebeurtenistype en dezelfde ID opnieuw te registreren. Er zijn maximaal 1.000 geregistreerde handlers voor één aangepaste groep.

Vault beperkt het actieve werk van één handler tot ongeveer één seconde. Drie overschrijdingen van de deadline voor dezelfde groep binnen één minuut zetten de regel in quarantaine: Vault schakelt deze uit in plaats van herhaaldelijk een problematische handler uit te voeren. Maak geen gebruik van drukke wachttijden, onbegrensde lussen, synchrone polling of een groot aantal mutaties/logboeken per gebeurtenis.

Per verzending accepteert Vault maximaal:

| Artikel | Maximaal |
| --- | --- |
| Regellogboekvermeldingen | 200 |
| Geplaatste evenementen | 64 |
| DOM-bewerkingen | 256 |
| Actie/intenties | 256 |
| Panelen per groep | 24 |
| Bediening in één paneel | 32 |
| Opties in selecteren/radiobesturing | 64 |

Overtollig logbestand, geposte gebeurtenis, DOM-bewerking en intentiegegevens kunnen worden verwijderd. Een aangepaste regel mag niet afhankelijk zijn van het aanleveren van teveel inzendingen.

### 5.3 Ingebouwde gebeurtenistypen

De volgende tekenreeksen van het gebeurtenistype zijn ingebouwd. Een regel kan ook zijn eigen niet-lege tekenreeks gebruiken, zolang deze maar niet begint met een onderstrepingsteken.

| Evenementtype | Wanneer het wordt verzonden | Belangrijke gegevens |
| --- | --- | --- |
| tickEvent | Gedeelde periodieke tick met de globale tick-rate-instelling. | Huidige pagina-/tabcontext, indien beschikbaar. Gebruik de intervalMs-registratieoptie om een ​​individuele handler een snelheidslimiet te geven. |
| openWebEvent | Er wordt een pagina op het hoogste niveau beschikbaar voor de regel. | URL, hostnaam, tabblad-/pagina-ID's, tijd. |
| sluitenWebEvent | Een pagina/tabblad op het hoogste niveau wordt gesloten. | URL/hostnaam-context, indien beschikbaar. |
| webChangedEvent | Een toegewijde navigatie op het hoogste niveau, inclusief herladen met dezelfde URL. | gegevens bevatten een eerdere URL/hostnaam en navigatievlaggen zoals isFirstLoad, isReload en sameDomain. |
| timerBeëindigd | Een aangepaste timer verandert in de verlopen status. | gegevens: timerId, displayName, richting, currentMs. Het wordt alleen geleverd aan de groep die eigenaar is van de timer. |
| snoozeDruk op | De gebruiker drukt op Start Snooze voor deze aangepaste groep. | De regel is eigenaar van het antwoord; er wordt geen normale snooze-fallback uitgevoerd. |
| paneelGebeurtenis | Een gerenderd paneel Aangepast heeft een interactie. | gegevens- en gemaksvelden omvatten paneel-/controle-/gebeurtenis-/waarde-informatie. |
| localFileEvent | Een gevraagde actie voor een lokaal bestand is voltooid. | gegevens- en gemaksvelden omvatten requestId, pad, resultaat, bytes, vermeldingen en fouten. |
| paginaHeartbeatEvent | Een hartslag van een zichtbare pagina, ongeveer elke 250 ms terwijl het tabblad zichtbaar is. | elapsedMs is de verstreken tijd op de zichtbare pagina. Scoped Custom-timers gebruiken het automatisch, zelfs zonder een geregistreerde handler. |

### 5.4 Gebeurtenisregistratie-API

Het eerste argument voor een bron in functiestijl is het gebeurtenissenregister. In de kale-statementbron verwijzen zowel gebeurtenissen als gebeurtenissen naar dit register.

| Werkwijze | Overeenkomst |
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

Het optionele object handleropties ondersteunt:

| Optie | Betekenis |
| --- | --- |
| prioriteit | Numerieke volgorde. Hogere waarden worden vóór lagere waarden uitgevoerd. Standaard 0. |
| intervalMs | Positief getal. Alleen voor tickEvent: onderdrukt oproepen totdat zoveel tijd is verstreken sinds de vorige oproep van de handler. |

Synthetische gebeurtenissen vallen standaard onder het groepsbereik: alleen handlers die tot de uitzendende groep behoren, ontvangen ze. Gebruik { scope: "global" } om de gebeurtenis naar elke regel te sturen die hetzelfde type registreerde. Gebruik geen voorlooponderstrepingsteken in de naam van een gebeurtenis; het is gereserveerd.

### 5.5 Gebeurtenisobject

Elke handler ontvangt een veranderlijk gebeurtenisobject met gemeenschappelijke velden:

| Veld/methode | Overeenkomst |
| --- | --- |
| typ | Tekenreeks van gebeurtenistype. |
| groepsID | Aangepaste groeps-ID van ontvanger. |
| tabId, paginaId | Browser-ID's, indien beschikbaar; anders nul. |
| url, hostnaam | Huidige URL en hostnaam op het hoogste niveau, of lege tekenreeksen. |
| tijd | Kopie van het verzendtijdobject, of null. |
| gegevens | Gebeurtenisspecifieke payload, of null. |
| voorkomenDefault() | Markeert de verzending als een paginablokactie. De pagina wordt doorgestuurd naar de huidige omleidingslink/het huidige resultaat, indien aanwezig; anders gebruikt Vault het normale exit/fallback-pad. |
| stopPropagation() | Stopt latere handlers voor de verzending van de huidige gebeurtenis. |
| setResultaat(waarde) | Slaat een getal- of tekenreeksresultaat op. Een niet-lege tekenreeks wordt behandeld als een omleidingsdoel; resultaat 1 onderdrukt een anders geaccumuleerd preventieDefault-resultaat. |
| getResultaat() | Retourneert het resultaat dat is ingesteld door dit gebeurtenisobject, of null. |
| post(type, gegevens, opties) | Zet een synthetische gebeurtenis in de wachtrij, met dezelfde bereikregels als Events.post. |
| setRedirectLink(url) | Stel de omleidings-URL voor deze verzending in. Retourneert alleen false voor een niet-tekenreeksinvoer. |
| getRedirectLink() | Lees de omleidings-URL van deze verzending, of een lege tekenreeks. |
| sluiten(id) | Verzoek om een ​​tabblad te sluiten. Een getal is een tabblad-ID, een tekenreeks identificeert een URL en een weggelaten waarde is gericht op het actieve tabblad. |
| blok(id) | Voeg een dynamisch siteblokpatroon voor alleen sessies toe. Gebruik de hostnaam van de gebeurtenis als er geen tekenreeks-ID is. |
| deblokkeren(id) | Verwijder een dynamisch siteblokpatroon dat alleen voor een sessie geldt. Gebruik de hostnaam van de gebeurtenis als er geen tekenreeks-ID is. |
| open() | No-op in de browserextensie. Het kan geen applicaties starten. |

Een handler kan willekeurige extra eigenschappen aan een gebeurtenis koppelen. Lees ze via event.custom of rechtstreeks via de toegewezen naam terwijl dat gebeurtenisobject actief is. Ze hebben geen persistente status en zijn geen cross-event-opslag.

Voor panelEvent worden deze gemaksvelden toegevoegd: panelId, controlId, eventName, waarde, waarden, sleutel, code en keyInfo.

Voor localFileEvent worden deze handige velden toegevoegd: eventName, action, path, directoryPath, requestId, ok, text, value, entrys, exist, bytes en error.

### 5.6 Hulpingangspunten

Het helpers-object heeft deze directe eigenschappen:

| Instappunt | Betekenis |
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

## 6. Aangepaste helperreferentie

### 6.1 Domeinhelper

Get it with helpers.getDomainHelper(). It is also available as helpers.getDomainUtility().

| Werkwijze | Terugkeer en gedrag |
| --- | --- |
| hostnaamVan(url) | Genormaliseerde host in kleine letters zonder voorafgaande www., of null voor een ongeldige URL. |
| padnaamVan(url) | URL-padnaam, of / wanneer de URL niet kan worden geparseerd. |
| komt overeen met(hostnaam, site) | Waar als de hostnaam gelijk is aan de site of het subdomein ervan is. |
| getPlatform(url) | youtube, tiktok, instagram, facebook, twitch of null. |
| isYouTubeHost(host), isTikTokHost(host), isInstagramHost(host), isFacebookHost(host), isTwitchHost(host), isRedditHost(host), isDiscordHost(host) | Gastclassificaties. |
| youtube(), tiktok(), instagram(), facebook(), twitch() | Retourneer het URL-classifier-object van dat platform. |
| isEmptyStartPage(url) | Waar voor de door de browser ondersteunde blanco/nieuw-tabblad-/startpagina-URL's. |
| matchAny(url, patronen) | Vergelijk een URL met één RegExp, een RegExp-array of tekenreeksen die zijn gecompileerd als reguliere expressies. Ongeldige tekenreekspatronen worden genegeerd. |
| pathStartsWith(url, pad) | Geldt voor een exact pad of een afstammeling van een pad. Er wordt een ontbrekende leidende schuine streep meegeleverd. |
| queryHas(url, sleutel, waarde) | True als er een querysleutel bestaat; wanneer waarde wordt opgegeven, moet deze ook gelijk zijn aan de tekenreekswaarde. |
| queryGet(url, sleutel) | Querywaarde of null. |
| isSearchPage(url) | Detecteert ondersteunde zoek-URL's van Google, Bing, DuckDuckGo, YouTube, Reddit en X/Twitter. |
| isInfiniteFeedUrl(url) | Detecteert ondersteunde oppervlakken met oneindige invoer. |
| zelfdeSectie(a, b) | Alleen waar als beide URL's een host en het eerste padnaamsegment delen. |

Elk platform-URL-classificatieobject geeft isPlatformUrl(url), isShortUrl(url), isVideoUrl(url), isPostUrl(url), isHomePage(url), extractAuthor(url) en extractVideoId(url) weer. Een methode kan false/null retourneren als de URL geldig is, maar dat soort inhoud niet identificeert.

### 6.2 Timerhulp

Get it with helpers.getTimerHelper(). Timers are rule-owned counters. They may be displayed in Vault's page overlay, but they never block on their own.

Opties maken/krijgen:

| Optie | Betekenis |
| --- | --- |
| ID | Vereiste niet-lege timer-ID. |
| weergavenaam | Voor mensen leesbaar overlay-label. |
| richting | vooruit voor optellen; elke andere waarde wordt achteruit/aftellen. |
| huidigeMs | Initiële milliseconden, gevloerd op nul en begrensd als er grenzen zijn. |
| minMs, maxMs | Optionele positieve minimum-/maximumgrenzen. |
| stapMevrouw | Optionele positieve kwantiseringsstap voor verstreken ticks. |
| overlayStijl | Optionele tekenreeksen voor kleur, achtergrond, fontSize, fontWeight, border, borderRadius, opvulling, dekking en pictogram. Niet-ondersteunde/ongeldige onderdelen worden verwijderd. |
| bereik(url) | Predikaat dat bepaalt waar de tijd voor zichtbare pagina's toeneemt. |
| domein(url) | Predikaat dat bepaalt waar de timer in de overlay verschijnt; standaard ingesteld op bereik. |
| accrueWhen(url) | Optioneel extra predikaat. Tijd loopt alleen op als zowel scope als accrueWhen waar zijn. |

| Werkwijze | Gedrag |
| --- | --- |
| creëren(opties) | Creëert/vervangt een timer en reset de status ervan. Retourneert id of null. |
| getOrCreateTimer(opties) | Alleen aanmaken bij afwezigheid. De bestaande toestand blijft ongewijzigd. Retourneert id of null. |
| verwijder(id) | Verwijder de timer en de reikwijdte/weergavepredicaten ervan. |
| pauze(id), hervatten(id) | Wijzig de onderbroken status. Retourneert alleen waar als een statuswijziging mogelijk is. |
| setDirection(id, richting) | Vooruit of achteruit instellen. |
| setCurrentMs(id, ms) | Stel het absolute aantal in en handhaaf grenzen. |
| addMs(id, deltaMs), subMs(id, deltaMs) | Pas het aantal aan en handhaaf grenzen. |
| setBounds(id, minMs, maxMs) | Stel positieve grenzen; pass null voor een bound om het te verwijderen. |
| setStep(id, stepMs) | Stel een positieve tick-kwantisering in. Geef null of nul door om het te wissen. |
| setOverlayStyle(id, stijl) | Vervang/wist toegestane overlaystijlen. |
| setDisplayName(id, naam) | Overlay-label instellen. |
| getCurrentMs(id) | Getal, nul voor een afwezigheidstimer. |
| isVerlopen(id) | Alleen waar als er een timer bestaat en currentMs nul is. |
| isPaused(id) | Booleaans. |
| getDirection(id), getDisplayName(id) | Richting/naam of nul. |
| bestaat(id) | Booleaans. |
| getState(id) | Serialiseerbare timer-snapshot of null. |
| lijst() | Serialiseerbare reeks timer-snapshots. |

Bereikpredikaten worden onthouden terwijl de aangepaste bron geladen blijft. Vault zet overeenkomende timers vooruit tijdens zichtbare pageHeartbeatEvent-cycli, één tik per timer per verzending. Een achterwaartse timer stopt bij nul en zendt timerEnded uit bij de overgang naar nul. Het blijft nul totdat de regel het wijzigt/reset. Gebruik een handler met timer-einde om te beslissen of een verlopen timer preventieDefault moet aanroepen, een omleiding moet instellen of een andere actie moet uitvoeren.

### 6.3 Persistente en asynchrone opslag

Get the synchronous persistence helper with helpers.getPersistenceHelper(). Values must be JSON-serializable. A group can store at most 200 keys and each serialized value is limited to 16 KiB.

| Werkwijze | Gedrag |
| --- | --- |
| get(sleutel, standaardwaarde) | Lees een gekloonde waarde of defaultValue. |
| set(sleutel, waarde) | Bewaar een JSON-veilige kloon. Retourneert false voor een ongeldige sleutel/waarde of uitputting van de sleutelkap. |
| verwijder(sleutel) | Verwijder bestaande sleutel; geeft terug of het bestond. |
| heeft(sleutel) | Booleaans. |
| sleutels() | Reeks sleutels. |
| vermeldingen() | Array van gekloonde [sleutel, waarde]-paren. |
| helder() | Verwijder alle regelpersistentie voor deze groep. |
| maat() | Aantal sleutels. |

helpers.getStorageHelper() exposes all the preceding methods and two asynchronous request methods:

| Werkwijze | Gedrag |
| --- | --- |
| requestAsyncGet(sleutel) | Vraag een asynchrone opslaglezing aan. Retourneert waar wanneer het in de wachtrij staat. Gebruik een latere gebeurtenis/uw eigen statusstroom om te reageren; het is geen synchrone getter. |
| requestAsyncSet(sleutel, waarde) | Vraag een asynchrone JSON-veilige winkel aan. Retourneert waar wanneer het in de wachtrij staat. |

Regelpersistentie wordt bij Uitvoeren gewist omdat een nieuwe actieve bron start met een schone aangepaste regelstatus.

### 6.4 Logboekhulp

Get it with helpers.getLogHelper(). Every method accepts any number of values.

| Werkwijze | Bestemming |
| --- | --- |
| log, waarschuw, fout | Pop-up activiteitenlogboek; paginatoast wanneer algemene paginalogboektoasts zijn ingeschakeld. |
| logScreen, warnScreen, errorScreen | Alleen paginatoast/foutopsporingsoppervlak; uitgesloten van pop-uplogboek. |
| logPopup, warnPopup, errorPopup | Alleen pop-upactiviteitenlogboek; uitgesloten van paginatoast. |

Logboeken proberen ook de browserconsole te bereiken met een CustomBlocker-groepsvoorvoegsel. Dit is diagnostische uitvoer, geen persistentie-API. Gebruik de persistentiehelper voor status.

### 6.5 Omleidingshelper

Get it with helpers.getRedirectionHelper().

| Werkwijze | Gedrag |
| --- | --- |
| get(), getRedirectLink() | Retourneert de huidige verzendomleidings-URL of een lege tekenreeks. |
| set(url), setRedirectLink(url) | Stel de omleidings-URL in voor de huidige verzending. |
| createMessageUrl(bericht) | Maak een extensie-lokale berichtpagina-URL die het opgegeven bericht weergeeft. |

Het instellen van alleen een omleiding dwingt de navigatie niet af. Koppel het met event.preventDefault(), of stel een niet-lege tekenreeks in via event.setResult(), volgens de gewenste regelstroom.

### 6.6 DOM-helper

Get it with helpers.getDOMHelper(). These actions are queued and applied to the current page. Selectors must be valid for the page browser; malformed selectors or elements that do not exist can produce no visible result.

| Werkwijze | Gevraagde actie |
| --- | --- |
| verberg(kiezer), toon(kiezer) | Overeenkomende elementen verbergen/tonen. |
| addClass(selector, klassenaam), removeClass(selector, klassenaam) | Muteer CSS-klasse. |
| setText(selector, tekst) | Tekstinhoud vervangen. |
| klik(kiezer) | Klik op het overeenkomende element. |
| injectCss(css, id) | Voeg een geïdentificeerd CSS-blok toe. |
| removeInjectedCss(id) | Verwijder een eerder geïdentificeerd geïnjecteerd CSS-blok. |
| scrollNaar(selector) | Blader door een overeenkomend element in beeld. |

DOM-acties bieden geen onbeperkte paginascripting. Ze zijn een begrensd actieoppervlak en zouden idempotent moeten zijn bij gebruik door hartslag-/tekenbehandelaars.

### 6.7 Navigatie, tabbladen en browservensterhelper

Get navigation with helpers.getNavigationHelper().

| Werkwijze | Gevraagde actie |
| --- | --- |
| terug() | Navigeer naar het huidige tabblad terug. |
| vooruit() | Navigeer naar voren op het huidige tabblad. |
| herladen() | Huidig ​​tabblad opnieuw laden. |
| gaNaar(url) | Navigeer op het huidige tabblad naar de URL. |
| closeTab() | Sluit het huidige tabblad. |

Get a snapshot helper with helpers.getTabHelper().

| Werkwijze | Terugkeer/actie |
| --- | --- |
| lijst() | Kopie van de momentopname van het huidige tabblad. |
| getActiveTab() | Momentopname van actief tabblad of null. |
| getById(id) | Overeenkomende momentopname van tabblad of null. |
| telOpen() | Aantal tabbladen in de momentopname. |
| verzoekVernieuwen() | Vraag een momentopname van een nieuw tabblad aan voor later regelwerk. |

Get the browser-tab/window helper with helpers.getWindowHelper(). In the extension, a "window" is represented by browser tabs.

| Werkwijze | Gedrag |
| --- | --- |
| huidige() | Huidig ​​actief tabbladobject: id, url, hostnaam, titel, isBrowser. |
| alles() | Array van tabbladobjecten met id, url, hostnaam, titel, actief. |
| close(idOrUrl) | Sluiten op numerieke tabblad-ID, exacte URL-tekenreeks of actief tabblad indien weggelaten. |
| closeTab() | Sluit het actieve tabblad. |
| blok(patroon) | Voeg een genormaliseerd domeinblok voor alleen sessies toe en pas het toe. |
| deblokkeren(patroon) | Verwijder een genormaliseerd domeinblok voor alleen sessies. |
| isBlocked(urlOrHostnaam) | Query uitvoeren op de door de regel gemaakte sessieblokkeringslijst. |
| getBlocked() | Maak een lijst van huidige, door sessies gemaakte patronen. |

Door regels gemaakte blokpatronen normaliseren http/https, leiden www. en paden naar een hostpatroon. Ze komen overeen met de exacte host en subdomeinen. Deze dynamische blokkeerlijst is sessiegeheugen en geen opgeslagen normale sitegroep.

### 6.8 Helper voor lokale bestandsmappen

Get it with helpers.getLocalFolderHelper(). It only operates after the user has selected a folder in Global Settings and granted browser permission. It is asynchronous: every request returns a request id; completion arrives as localFileEvent.

| Werkwijze | Gedrag |
| --- | --- |
| isBeschikbaar() | Rapporteert dat het API-oppervlak bestaat; het bewijst niet dat een map momenteel is geautoriseerd. |
| requestRead(pad) | Vraag tekstlezen aan. |
| requestWrite(pad, tekst) | Verzoek om tekst te schrijven. |
| requestAppend(pad, tekst) | Verzoek om tekst toe te voegen. |
| requestList(pad = "") | Vraag een directoryvermelding aan. |
| requestExists(pad) | Bestaanstest aanvragen. |
| requestReadJson(pad) | Vraag JSON-lezing aan; pad moet eindigen op .json. |
| requestWriteJson(pad, waarde) | Vraag JSON-schrijven aan; pad moet eindigen op .json en de waarde moet JSON-veilig zijn. |

Paden zijn altijd relatief ten opzichte van de geselecteerde wortel. Ze kunnen niet absoluut, drive-gekwalificeerd, puntvoorvoegsel of bevatten zijn. of .. segmenten. Alleen .txt-, .csv- en .json-bestanden worden geaccepteerd voor bestandsbewerkingen. De mapselectie kan op elk moment worden ingetrokken; een mislukt verzoek rapporteert ok false en een foutreeks in localFileEvent.

### 6.9 Platformhelper

Get the collection with helpers.getPlatformHelper() or helpers.platform(). Get one raw platform API with helpers.platform("youtube"), for example.

Alle onbewerkte platform-API's onthullen:

| Werkwijze | Gedrag |
| --- | --- |
| hide(predikaat, opties) | Stel hetzelfde predikaat per item in voor elke feedcardsleuf op dat platform. |
| hide(slot, predikaat, opties) | Stel één predikaat per item in. Het predikaat ontvangt het platformitem/de momentopname die door dat platform wordt geleverd. |
| allow(predikaat, opties), allow(slot, predikaat, opties) | Hetzelfde als verbergen, maar creëert een oordeel over toestaan/uitzonderen. |
| toon(), toon(slot) | Wis alle of één geïnstalleerde predicaatslot. |
| oppervlak(naam, "verbergen" of "tonen") | Verberg/toon een hele platformregio. home is de publieke naam voor homePage. |
| timer(slot, opties) | Configureer een timer voor platformsubsecties. Retourneert options.id indien opgegeven, anders nul. |
| opnieuw scannen() | Evalueer reeds gescande feedkaarten opnieuw na wijzigingen in de externe regelstatus. |
| momentopname() | Retourneert de huidige platformmomentopname of null. |
| slots(), oppervlakken(), timerSlots() | Retourneer de ondersteunde namen voor dit platform. |
| isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId | URL-helpers voor dat platform. |

Een slot bezit één predikaat voor één groep/platform. Een latere verberg/toestaan-oproep voor hetzelfde slot vervangt het eerdere predikaat; het is geen impliciete OF. Het optionele optieobject herkent:

| Optie | Effect |
| --- | --- |
| blockPageOnVisit | Wanneer een overeenkomende kaart/pagina wordt bezocht, vraag dan om een ​​paginablokkering in plaats van alleen de kaart te verbergen. |
| uitwerking | blokkeren (standaard) of toestaan. De allow-helpersets staan ​​automatisch toe. |

Roep opnieuw scannen aan wanneer een predikaat afhankelijk is van de status die is gewijzigd nadat de kaarten voor het eerst zijn geëvalueerd, zoals een selectievakje in een paneel, een quotum of een tijdsdrempel.

Onbewerkte platformondersteuningsmatrix:

| Platform | Predikaatslots | Oppervlaktenamen | Timerslots |
| --- | --- | --- | --- |
| YouTube | korte broeken, video's, berichten, reacties, live | home, shortButton, commentaar, live | korte broeken, video's, berichten |
| TikTok | video's, reacties, live | thuis, reacties, live | video's |
| Instagram | korte broeken, berichten, opmerkingen | thuis, reacties | korte broeken, berichten |
| Facebook | korte broeken, video's, berichten, reacties, live | thuis, reacties, live | korte broeken, video's, berichten |
| Trek | korte broeken, streams, video's, live | thuis, reacties, live | korte broeken, streams, video's |

De onbewerkte aangepaste platformhelper stelt Reddit, Discord of Twitter/X niet bloot. Gebruik algemene URL-, DOM-, timer-, paneel- en navigatiemogelijkheden voor maatwerk op die sites.

## 7. Aangepaste panelen

The panel helper creates safe, declarative on-page panels. Get it with helpers.getPanelHelper(). A panel can be scoped to URLs, react to interactions, display timer state, and retain its user-entered values for the active rule lifetime.

### 7.1 Paneel-API

| Werkwijze | Gedrag |
| --- | --- |
| creëren(config) | Maak of vervang een paneel. Retourneert genormaliseerde paneel-ID of null. |
| getOrCreatePanel(config) | Alleen aanmaken bij afwezigheid; retourneert id of null. |
| update(id, patch) | Vervang gespecificeerde paneelvelden na validatie. |
| verwijder(id) | Verwijder een paneel en de geregistreerde inline-handlers ervan. |
| toon(id), verberg(id) | Verander de zichtbaarheid. |
| setValue(paneelId, controleId, waarde) | Stel na validatie een beschrijfbare controlewaarde in. |
| updateControl(paneelId, controleId, patch) | Vervang de toegestane velden van een besturingselement. |
| uitschakelen(paneelId, controleId), inschakelen(paneelId, controleId) | Schakel de beschikbaarheid van controle in. |
| setOptions(panelId, controlId, opties) | Vervang selectie-/radiokeuzes. |
| setText(paneelId, controleId, tekst) | Update een knoplabel, tekst/sectietekst of een ander besturingselementlabel. |
| setTheme(panelId, thema) | Paneelthema vervangen. |
| setTitle(paneelId, titel), setDescription(paneelId, beschrijving) | Tekst bijwerken. |
| getValue(paneelId, controleId) | Retourneert een gekloonde waarde of ongedefinieerd. |
| getValues(paneelId) | Retourneert alle beschrijfbare waarden die zijn ingetoetst op controle-ID. |
| getState(id) | Retourneert een serialiseerbare momentopname van het paneel of null. |
| lijst() | Retourneer serialiseerbare snapshots van alle panelen. |
| kennisgeving(config) | Creëer een compact statuspaneel rechtsonder met optioneel bericht/tekst. |
| bevestigen(config) | Creëer een gecentreerd dialoogvenster met gegenereerde bevestigings- en annuleerknoppen. |
| controlelijst(config) | Maak een paneel met selectievakjes. |
| formulier(config) | Maak een formulierindelingspaneel van velden. |

### 7.2 Paneelconfiguratie

| Veld | Geaccepteerde waarden/gedrag |
| --- | --- |
| ID | Vereist. Genormaliseerd naar letters, cijfers, onderstrepingstekens, koppelteken; maximaal 80 tekens. |
| titel | Paneeltitel, maximaal 240 tekens. |
| beschrijving of hoofdtekst | Beschrijving, maximaal 1.000 tekens. |
| positie | linksboven, rechtsboven, linksonder, rechtsonder of midden. Standaard rechtsonder. |
| uitlijnen | links, midden of rechts. Standaard links. |
| lay-out | verticaal, compact, comfortabel, ruim, inline, rij, omloop, twee kolommen, raster, splitsen, vorm, werkbalk of stapel. Standaard verticaal. |
| prioriteit | Numerieke weergavevolgorde, vastgezet op -1000 tot en met 1000. Hogere panelen worden eerst weergegeven. |
| breedte | klein, middelgroot, groot of 180 tot en met 520 px. |
| tekstgrootte/lettergrootte | 10 tot en met 32 ​​px, of 0,65 tot en met 2 rem/em. |
| ariaLabel/a11yLabel | Toegankelijk etiket. |
| rol | regio, dialoogvenster, waarschuwing, status, formulier of groep. |
| autoFocus | Booleaans. |
| thema/kleuren | achtergrond, voorgrond, accent, rand, gedempt, fontSize/textSize, titleSize. |
| controles | Array van maximaal 32 bedieningselementen, met secties die maximaal drie niveaus kunnen nesten. |
| zichtbaar | Vals verbergt het paneel. |
| bereik(url), domein(url) | Functies die de beschikbaarheid/weergave regelen. domein heeft voorrang; zonder domein worden de bereikbedieningen weergegeven. |

Inline-handlervelden van het paneel kunnen op het paneel of op individuele besturingselementen verschijnen: onEvent, onChange, onClick, onInput, onFocus, onBlur, onSubmit, onClose, onMount, onUnmount, onKey en onKeyDown. Elk ontvangt de normale (gebeurtenis, helpers) parameters. Een inline-handler wordt vervangen wanneer dat paneel opnieuw wordt gemaakt/bijgewerkt met besturingsdefinities.

### 7.3 Bediening

De beschikbare besturingstypen zijn tekst, selectievakje, selectie, tekstinvoer, tekstgebied, knop, sectie, timer, getalinvoer, bereik, schakelen, radio, datum, tijd, kleur, pincode en html. Aliasseninvoer, vervolgkeuzelijst, groep, nummer, schuifregelaar, schakelaar, onbewerkt en opmaak normaliseren naar hun overeenkomstige type.

Alle besturingselementen accepteren id, type, label, waarde, uitgeschakeld, prioriteit en, waar relevant, lay-out, uitlijning, ariaLabel/a11yLabel, autoFocus, breedte, hoogte en rijen.

| Typ | Belangrijke velden en waardecontract |
| --- | --- |
| tekst | tekst (of label) weergegeven als niet-invoertekst. |
| selectievakje, schakel | Booleaanse waarde. |
| selecteren, radio | opties als strings of { value, label } objecten; maximaal 64. Waarde is een korte reeks. |
| tekstInvoer, tekstgebied | Tekenreekswaarde, maximaal 2.000 tekens; optionele tijdelijke aanduiding. |
| knop | etiket/tekst; optionele actie indienen, annuleren of sluiten. |
| sectie | tekst/beschrijving, rol en geneste besturingselementen. |
| timer | timerId of timermomentopname; formaat ms, ss, mm:ss of uu:mm:ss; showExpired is standaard waar. |
| nummerInvoer, bereik | Numerieke waarde vastgeklemd op geleverde min/max; optionele positieve stap. |
| datum | Alleen JJJJ-MM-DD-waarde. |
| tijd | Alleen HH:MM- of HH:MM:SS-waarde. |
| kleur | Zescijferige #RRGGBB-invoerwaarde. |
| speld | Alleen cijfers, lengte 3 tot en met 12, standaard gemaskeerd, optioneel autoSubmit. |
| html | Gezuiverde markeringen. Scriptblokken, inline gebeurteniskenmerken en javascript: URL's worden verwijderd. |

Elke gerenderde interactie genereert panelEvent. Het waardenobject van de gebeurtenis bevat de beschrijfbare besturingselementen van het paneel, met uitzondering van knoppen, tekst en timerbesturingselementen. Een close action verbergt het paneel voordat handlers de gebeurtenis waarnemen.

## 8. Actierecepten op maat

De volgende voorbeelden zijn specificaties van openbare composities, geen tutorial.

### 8.1 Een openingspagina omleiden

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

### 8.2 Zichtbare tijd aftellen met expliciet blok

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

### 8.3 Wijzig een feedpredikaat vanuit een paneel

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

Er moeten predikaten worden geschreven voor de platformmomentopname/itemwaarden die door het actieve platformoppervlak worden geleverd. Als een platform een ​​veld niet op betrouwbare wijze kan identificeren, moet het predikaat niet worden geopend in plaats van aan te nemen dat een waarde waar is.

## 9. Verzoekprotocol voor lokale mappen

Lokale mapbewerkingen zijn geen directe bestands-I/O. De volledige functionele volgorde is:

1. De gebruiker selecteert een map in Algemene instellingen.
2. De regel plaatst een verzoek in de wachtrij en ontvangt een verzoek-ID.
3. Vault vraagt de geautoriseerde mapfunctie om de bewerking uit te voeren.
4. Vault verzendt localFileEvent naar dezelfde aangepaste groep.
5. De handler correleert event.requestId met de oorspronkelijke aanvraag-ID.

Succesvol lezen wordt voltooid met tekst voor tekstbestanden of waarde voor JSON. Lijst retourneert vermeldingen. Bestaat retourneert bestaat. Schrijven/toevoegen levert bytes op, waar van toepassing. Mislukking levert ok false en error op. Regels mogen er nooit van uitgaan dat een geselecteerde map geautoriseerd blijft na opnieuw laden, opnieuw opstarten van de browser of intrekken van toestemming.

## 10. Veiligheids- en storingssemantiek op maat

### 10.1 Compileer- en uitvoerfouten

Controleer de syntaxis en rapporteer een compilatiefout. Run kan tijdens de registratie ook een runtimefout melden. Als een functie-achtige bron een syntaxisfout bevat, valt Vault niet stilzwijgend terug op het behandelen ervan als onschadelijke kale instructies.

Een lege bron heeft nul handlers. Deze is geldig als een inactieve aangepaste regel, maar voert geen geconfigureerde aangepaste actie uit.

### 10.2 Handlerfouten

Een uitzondering van één handler wordt geïsoleerd van de algehele gebeurtenisverzending. Het is diagnostische uitvoer; het zorgt er niet voor dat latere handlers op magische wijze slagen. Gebruik smalle handlers en registreer bruikbare fouten.

### 10.3 Quarantaine

Vault kan een aangepaste groep in quarantaine plaatsen na herhaalde deadlineoverschrijdingen of een overschrijding tijdens de registratie. Quarantaine schakelt de groep uit en registreert de reden voor het afbreken ervan. Corrigeer de bron, sla deze op en voer deze expliciet opnieuw uit om actieve registraties te herstellen.

### 10.4 Browser-/paginalimieten

Geen enkele aangepaste regel ontvangt onbeperkte uitbreidings-API's. In het bijzonder:

- een DOM-selector kan niets vinden op een platform dat is gewijzigd;
- navigatie, tabblad sluiten en schermacties blijven afhankelijk van de browsermogelijkheden;
- een extensie kan geen native applicaties openen;
- Voor bewerkingen met lokale mappen zijn een door de gebruiker toegekende map en de ondersteunde bestandstypen vereist;
- een gebeurtenishandler kan er niet op vertrouwen dat een onzichtbare pagina zichtbare hartslagen blijft produceren;
- een pagina kan een inhoudsscript onafhankelijk van de regel opnieuw laden, navigeren, weggooien of ongeldig maken;
- Door regels gemaakte dynamische siteblokken zijn sessiestatusacties, geen permanente sitegroepbewerkingen.

## 11. Web-app-bridge

De brug is optioneel. Het verbindt een browserextensieclient met een compatibele lokale Vault-hub. De browserextensie is een client; een native Vault-app biedt de hub. Het vaste lokale eindpunt is ws://127.0.0.1:8787 en protocolcompatibiliteit is vereist.

Verbindingsstatussen zijn Uit, Verbinden, Verbinding verbroken, Verbonden en Fout. Als de client is ingeschakeld, onderzoekt Vault eerst snel en gaat vervolgens door met langzamere pogingen om opnieuw verbinding te maken totdat er verbinding wordt gemaakt of de gebruiker de verbinding uitschakelt. Connection voegt niet zelf alle groepen samen.

### 11.1 Groepen koppelen

Groepen kunnen alleen worden gekoppeld als hun naam en type overeenkomen en ze in aanmerking komen voor koppeling. De gebruiker selecteert/koppelt expliciet de deelnemende programma’s. Een gekoppelde groep vormt een cluster. Als u de verbinding verbreekt, blijven de lokale groepsgegevens intact; het stopt live-synchronisatie.

De bridge synchroniseert gedeeld scalair beleid voor ondersteunde gekoppelde groepen, inclusief de normale blokkeermodus, toegestane/resetwaarden, snooze-instellingen, actieve dagen/vensters, bevriezingsstatus/keuze/duur, homepagebeleid, toelatingslijstinstelling, fallback-URL en skip-to-next-beleid. Het coördineert ook het gebruik en de snooze-status voor clusterleden.

De bridge belooft niet dat elk productspecifiek veld, platformkiezer, aangepaste brontekst of browserspecifieke mogelijkheid overdraagbaar is naar een ander programma. Een groep kan lokaal en niet-gekoppeld blijven, zelfs als de bridge is aangesloten.

Bevroren brugclusters vereisen dat alle relevante leden online zijn voor bevriezingsacties waarvoor gecoördineerde mutatie nodig is. Een verbinding is lokaal transport, geen cloudback-up of een kanaal voor afstandsbediening.

## 12. Verificatiechecklist voor beheerders

Gebruik deze checklist bij het controleren van een uitstoot of het reproduceren van gedrag:

1. Controleer of de groep een niet-lege unieke naam, het juiste type, de ingeschakelde status en de beoogde lijst/volgorde heeft.
2. Bevestig voor normale groepen de actieve weekdag, het geldige lokale tijdvenster, geen actieve snooze en niet-bevroren bewerkingsstatus.
3. Test voor een sitegroep de exacte host, het subdomein en (voor de toelatingslijst) een host buiten de lijst.
4. Test voor een platformgroep de overeenkomsten op paginaniveau, de gerichte item-/kaartovereenkomsten, de auteursmodus, de inhoudsvormmodus en elke ingeschakelde oppervlakteverberging afzonderlijk.
5. Controleer voor getimede normale groepen de opbouw van zichtbare pagina's, het verlopen van de toegestane hoeveelheid of het niet-blokkerende gedrag bij het optellen, en het opnieuw instellen van het interval.
6. Voor aangepaste regels voert u syntaxiscontrole uit, Uitvoeren, inspecteert u het aantal handlers/logboeken, test u elke geregistreerde ingebouwde gebeurtenis en test u vervolgens opnieuw laden/navigeren.
7. Test elke aangepaste timer op de grenzen van het bereik en op nul; controleer of elk blok expliciet is in de regel.
8. Test panelen met elke controlewaarde, uitgeschakelde status, actie verzenden/annuleren/sluiten en panelEvent-handler.
9. Test het falen van de lokale map vóór succes: geen geselecteerde map, toestemming ingetrokken, ongeldig pad, niet-ondersteunde extensie, daarna geautoriseerd lezen/schrijven.
10. Test de brugverbinding-uit, verbinding-aan, gekoppelde/ontkoppelde groep en een offline clusterlid voordat u vertrouwt op synchronisatie of bevriezing van de coördinatie.

## 13. Versiebeheerregel

Dit Engelstalige bestand is de bijgehouden bronhandleiding. Gelokaliseerde handleidingen zijn vertalingen ervan en moeten mogelijk opnieuw worden gegenereerd na een update van de functionele documentatie. Productbron blijft de canonieke waarheid voor ambiguïteit op implementatieniveau.
