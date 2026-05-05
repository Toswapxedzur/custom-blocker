# Custom Web Blocker — Handleiding

Dit is de volledige referentiehandleiding voor de extensie. Ze begint met de eenvoudigste, meest gebruikte workflows en gaat daarna geleidelijk naar geavanceerde onderwerpen zoals aangepaste JavaScript-blokkeerregels en de helper-API.

Als je helemaal nieuw bent, lees dan alleen **Snelle start** en **Overzicht van blokgroepen**. Alles onder die secties is optioneel, afhankelijk van wat je wilt doen.

---

## 1. Wat deze extensie doet

Met Custom Web Blocker kun je websites en online afleiding blokkeren volgens regels die je zelf definieert. Je kunt:

- Sites direct blokkeren met de native netwerkblokkering van de browser (hetzelfde type blokkering dat `ERR_BLOCKED_BY_CLIENT` oplevert).
- Jezelf een bepaald aantal minuten per dag op een site toestaan en die daarna blokkeren zodra je over de limiet gaat.
- Specifieke soorten inhoud op YouTube, TikTok, Facebook, Instagram, Twitch en Reddit blokkeren (niet de hele site).
- Geblokkeerde inhoud verbergen in feeds op ondersteunde platforms, in plaats van alleen losse pagina's te blokkeren.
- Inplannen wanneer een regel actief is per dag van de week en per tijdvenster in `HHMM-HHMM`-formaat.
- Een regel bevriezen zodat je hem niet makkelijk kunt wijzigen. Strikt bevriezen vergrendelt hem voor een opgegeven aantal uren en vereist een bevestigingsritueel van 20 stappen om dit ongedaan te maken.
- Een regel tijdelijk snoozen, maar alleen nadat je een voldoende lange motivatie hebt geschreven.
- Aangepaste JavaScript-blokkeerregels schrijven met helpers voor timers, persistente opslag, platformdetectie, domeinmatching en logging.
- De extensie gebruiken in meer dan 20 talen.

De extensie is een Chrome Manifest V3-extensie, met één editorpagina (de popup), één background service worker en één content script dat op elke pagina draait.

---

## 2. Rondleiding door de UI

Wanneer je op het extensiepictogram klikt, opent de editor als een volledige webpagina (niet als een kleine popup). De pagina heeft deze onderdelen:

- **Bovenbalk**
  - Knop **Instruction Manual** (dit document)
  - Taalkeuze **Language**
- **Linkerpaneel — Block Groups**
  - Lijst met je blokgroepen. Elke kaart toont de groepsnaam, een korte samenvattingsregel en een aan/uit-vakje.
  - De knop **Add** maakt een nieuwe groep. De dropdown ernaast kiest het type.
  - **Delete All** verwijdert alle groepen, met extra bevestigingen als een groep bevroren is.
  - Je kunt de `::`-greep op een kaart omhoog of omlaag slepen om groepen te herordenen.
  - Je kunt de verticale splitter slepen om dit paneel te vergroten of verkleinen.
- **Rechterpaneel — Editor**
  - Bewerkt de momenteel geselecteerde groep: naam, blokkeergedrag, bloklijsten, type-specifieke filters, planning, bevriezen, snooze.
  - Alle wijzigingen worden automatisch opgeslagen, een fractie van een seconde nadat je stopt met typen of interactie.
- **Toast** (gecentreerde popup die vervaagt)
  - Toont statusmeldingen zoals "Saved changes" of invoerfouten.

Terwijl een pagina wordt geblokkeerd of een actieve timer heeft, verschijnt linksboven een overlay met alle tijdsbeperkingen die op dat moment van toepassing zijn, in `hh:mm:ss` (of `mm:ss`)-formaat. Meerdere beperkingen worden op meerdere regels gestapeld.

---

## 3. Snelle start

1. Klik op het extensiepictogram. De editor opent als volledige pagina.
2. Kies in het paneel **Block Groups** een groepstype uit de dropdown:
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit` of `Custom`.
3. Klik op **Add**. Er verschijnt een nieuwe groep en de editor opent deze.
4. Geef de groep een naam.
5. Vul de type-specifieke velden in (voor `Default` betekent dit de lijst **Blocked websites**).
6. Zorg dat het selectievakje van de groep in het linkerpaneel aan staat.
7. Bezoek een van de vermelde sites. De blokkering moet direct ingaan.

Dit is het volledige happy path. De rest van deze handleiding zijn alleen opties bovenop dit proces.

---

## 4. Overzicht van blokgroepen

Alles in deze extensie is georganiseerd als **blokgroepen**. Een blokgroep is één regelset:

- Ze heeft een naam, een type en een ingeschakelde/uitgeschakelde status.
- Ze heeft een blokkeergedrag (direct of na een aantal minuten).
- Ze heeft een optionele planning (dagen + tijdvensters) en optionele bevries-/snooze-bediening.
- Afhankelijk van het type heeft ze extra velden zoals een lijst websites, YouTube-makerfilters, subredditnamen of een JavaScript-functie.

Je kunt een onbeperkt aantal groepen hebben. Meerdere groepen kunnen op dezelfde pagina van toepassing zijn; in dat geval wint de **strengste** regel:

- "Direct blokkeren" wint van "na enige tijd blokkeren".
- Een groep met minder resterende tijd wint van een groep met meer resterende tijd.

Dus meer groepen toevoegen kan er alleen voor zorgen dat een pagina eerder wordt geblokkeerd, nooit later.

Je kunt groepen slepen via de `::`-greep om ze te herordenen. De volgorde verandert niet welke regel het strengst is, maar bepaalt wel hoe de lijst van boven naar beneden leest.

---

## 5. Groepstypen

### 5.1 `Default` — gewone websites blokkeren

Voor het blokkeren van specifieke domeinen (de typische use case).

- **Blocked websites**: één site per regel. Zowel `facebook.com` als `https://www.facebook.com/somepage` werken; de extensie haalt de hostnaam eruit en normaliseert die.
- Een siteregel geldt voor die hostnaam en alle subdomeinen ervan.
- Dit groepstype gebruikt native netwerkblokkering van Chrome, vergelijkbaar met `ERR_BLOCKED_BY_CLIENT`. Dat betekent dat navigatie naar een geblokkeerde URL stopt voordat de pagina überhaupt laadt.

### 5.2 `YouTube` — YouTube en vergelijkbare videosites blokkeren

Voegt een sectie **Filters** toe aan de editor:

- **Content type**:
  - `Apply to all YouTube pages` — elke YouTube-pagina telt mee.
  - `Apply to Shorts` — alleen Shorts-pagina's tellen mee.
  - `Apply to long videos` — alleen `/watch`, `/live/`, `/embed/`, enz.
  - `Apply to YouTube posts` — communityposts (`/post/...`, kanaaltabbladen community/posts).
- **Author filter**:
  - `Do not filter by author` — auteur-identiteit maakt niet uit.
  - `Apply to certain authors` — alleen vermelde auteurs activeren deze groep.
  - `Apply to all except certain authors` — vermelde auteurs zijn uitgezonderd.
- **Authors**: één auteur per regel. Accepteert `@handle`, volledige URL's, `/channel/UC...`, `/c/...`, `/user/...`.
- **Hide blocked entries in the YouTube feed**: terwijl deze groep actief blokkeert, worden overeenkomende kaarten in YouTube-feeds verborgen. Wanneer de blokkering inactief wordt, komen ze terug bij de volgende vernieuwing.

Voor contenttypen Shorts en Posts verbergt de extensie, wanneer er geen auteurfilter is ingesteld en de groep momenteel blokkeert, ook relevante navigatie-items (Shorts-zijbalkitem, Community/Posts-tabbladen van kanalen) en bijpassende planken zoals "Latest YouTube posts".

De detectie kort-versus-lang geldt ook voor andere videosites zoals TikTok, Vimeo, Twitch clips/VOD's en Dailymotion wanneer hun paginavorm detecteerbaar is.

### 5.3 `TikTok` — TikTok-inhoud blokkeren

Zelfde editorkaart als de platform-video-editor, maar met TikTok-specifieke labels:

- Contenttypen: korte video's, video's, profielpagina's.
- Auteurs: TikTok-handles (`@handle`) of profiel-URL's.
- Feed-verberging verbergt overeenkomende kaarten op TikTok-pagina's terwijl de groep actief is.

### 5.4 `Facebook` — Facebook-inhoud blokkeren

- Contenttypen: Reels, video's, posts.
- Auteurs: paginanaam (`page.name`), profiel-URL, of `profile.php?id=...`-vorm (de numerieke id wordt bewaard als `id:<number>`).
- Feed-verberging verbergt overeenkomende feedkaarten op Facebook.

### 5.5 `Instagram` — Instagram-inhoud blokkeren

- Contenttypen: Reels, video's, posts.
- Auteurs: Instagram-handles of profiel-URL's.
- Gereserveerde paden zoals `/reel/`, `/p/`, `/tv/`, `/explore/` worden niet als auteurs behandeld.
- Feed-verberging verbergt overeenkomende kaarten op Instagram.

### 5.6 `Twitch` — Twitch-inhoud blokkeren

- Contenttypen: clips, streams/VOD's, kanaalpagina's.
- Auteurs: kanaalnamen of kanaal-URL's.
- Gereserveerde paden zoals `/directory`, `/videos`, `/settings`, enz. worden niet als kanaalnamen behandeld.
- Feed-verberging verbergt overeenkomende kaarten op Twitch.

### 5.7 `Reddit` — Reddit of specifieke subreddits blokkeren

- **Subreddits**: één subreddit per regel. Een lege lijst betekent dat de groep op heel Reddit van toepassing is. Zowel `productivity` als `r/productivity` worden geaccepteerd.

### 5.8 `Custom` — blokkeren via JavaScript-functie

Je schrijft een JavaScript-functie. De extensie roept die ongeveer elke seconde aan en gebruikt wat die teruggeeft als de huidige bloklijst.

`Custom`-groepen tonen niet: blokkeergedrag, geblokkeerde sites, toegestane minuten, resetinterval, planningsdagen of tijdvensters. Ze hebben slechts één groot invoerveld — de functie **Blocking Rules** — plus standaard bevries-/snooze-bediening.

Zie **Sectie 11** voor de volledige referentie van custom rules en helper-API.

---

## 6. Blokkeergedrag

Voor de meeste groepstypen kies je een van twee modi:

### 6.1 Direct blokkeren

De regel is actief wanneer de groep aan staat, de planning dit toelaat en (voor platformgroepen) de pagina overeenkomt.

Voor `Default`-groepen gebruikt dit native blokkering van Chrome. Voor platformgroepen gebruikt het de overlay-/exitlogica in de pagina.

### 6.2 Blokkeren na een aantal minuten

Dit is een gebruiksbudget.

- **Allowed minutes before block** (decimaal): hoeveel minuten je jezelf per periode toestaat. Voorbeeld: `15`, `0.5`, `90`.
- **Timer reset interval (hours)** (decimaal): hoe vaak het budget reset. Voorbeeld: `24` voor dagelijks, `1` voor elk uur, `0.25` voor elke 15 minuten.

Zolang je tijd over hebt, werkt de pagina normaal en toont de timer-overlay. Wanneer het budget nul bereikt, wordt de pagina voor de rest van de periode geblokkeerd en toont de overlay `0:00`, waarna het tabblad probeert af te sluiten.

De extensie werkt per groep, per periode:

- Elke groep heeft zijn eigen budget.
- Tijd besteed op elke pagina die met de groep overeenkomt telt mee voor het budget van die groep.
- Meerdere tabbladen in dezelfde groep delen het budget. Hun timers blijven gesynchroniseerd; overschakelen naar een ander tabblad forceert ook een refresh zodat direct de actuele gedeelde tijd wordt getoond.

Als meerdere tijdbeperkte groepen op dezelfde pagina van toepassing zijn, wint de strengste.

---

## 7. Planning

In de kaart **Schedule** kun je beperken wanneer een groep actief is:

- **Days to block**: kies de dagen waarop de groep geldt. Niet-aangevinkte dagen betekenen dat de groep die dag inactief is.
- **Time windows**: vrije lijst, één venster per regel in `HHMM-HHMM`-formaat, bijvoorbeeld:

  ```
  0900-1000
  1200-1300
  ```

  De groep is alleen actief binnen die vensters. Lege lijst betekent de hele dag.

Dit geldt voor alle groepstypen behalve `Custom`.

---

## 8. Bevriezen (anti-manipulatie)

Bevriezen maakt een groep moeilijk impulsief uit te schakelen.

In de kaart **Freeze** kies je:

- **Frozen** — je kunt de groep niet bewerken of verwijderen, en je kunt het aan/uit-vakje niet uitzetten. Om iets te wijzigen moet je het ontdooi-ritueel uitvoeren (zie hieronder).
- **Strict frozen** — hetzelfde als Frozen, maar de groep blijft vergrendeld voor een door jou gekozen aantal uren (decimaal, tot 72). Tot die timer afloopt is zelfs het ontdooi-ritueel niet beschikbaar.

Wanneer een bevroren groep ontgrendelbaar is, verschijnt de knop **Unfreeze**. Klikken start het **ritueel van 20 stappen**:

- De modal toont een boodschap over zelfdiscipline.
- Je moet 20 keer op `Confirm` klikken.
- Er is een verplichte wachttijd van 5 seconden tussen klikken.
- Als je op enig moment annuleert, moet je opnieuw beginnen bij stap 1.
- De 20 berichten roteren zodat je ze echt leest.

Als de groep ook is gemarkeerd als "no snooze" (zie volgende sectie), kun je die tijdens bevriezing ook niet snoozen.

De bevriesstatus staat in de metaregel van de groepskaart, inclusief resterende tijd voor strikte bevriezing.

---

## 9. Snooze (tijdelijk uitschakelen)

Snooze schakelt een groep tijdelijk uit zonder die te ontdooien, maar alleen met een geschreven motivatie.

In de kaart **Snooze**:

- **Allow snooze for this group** — als uit, kan deze groep helemaal niet gesnoozed worden (ook niet tijdens bevriezing).
- **Snooze for (minutes)** — decimaal, hoe lang de snooze duurt.
- **Reason** — moet **minstens 100 tekens en meer dan 20 woorden** zijn. De knop Start blijft uitgeschakeld tot beide voorwaarden gehaald zijn. Als de regel faalt, verschijnt er een inline waarschuwing naast de knop.

Als de groep bevroren is, staan snoozeminuten vast op de waarde die vóór het bevriezen is gekozen. Je kunt nog steeds snoozen, zolang snooze is toegestaan en de reden aan de regels voldoet.

Een statusbericht bevestigt de snooze. Wanneer de snooze eindigt, keert de groep automatisch terug naar normaal.

Je kunt een snooze ook eerder beëindigen met de knop **End Snooze**.

---

## 10. Bulkacties

- **Delete All** verwijdert alle groepen.
  - Vraagt altijd om bevestiging.
  - Als minstens één groep bevroren is, vereist dit hetzelfde ritueel van 20 stappen als ontdooien.
  - Als een groep strikt bevroren en nog vergrendeld is, is **Delete All** uitgeschakeld.

---

## 11. Custom groepen (volledige referentie)

Een `Custom`-groep voert een JavaScript-functie uit in de background service worker. De functie wordt ongeveer elke seconde aangeroepen en de extensie gebruikt wat zij teruggeeft om te bepalen welke domeinen nu geblokkeerd moeten worden.

### 11.1 Functiesignatuur

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

Parameters:

- `month` — `1` tot `12`.
- `dayOfMonth` — `1` tot `31`.
- `dayName` — bijvoorbeeld `"Monday"`.
- `hour` — `0` tot `23`.
- `minute` — `0` tot `59`.
- `blockedDomains` — de lopende lijst domeinen die andere regels al hebben opgeleverd. Je kunt eraan toevoegen, hem vervangen of negeren.
- `helpers` — een bundel helperobjecten (zie hieronder).

Returnwaarde:

- Een array met domeinstrings die nu geblokkeerd moeten worden, OF
- niets (in dat geval gebruikt de extensie wat jij `blockedDomains` hebt gemuteerd).

De functie wordt gevalideerd bij opslaan. Syntaxisfouten geven een statuswaarschuwing en de regel wordt pas gebruikt nadat je dit hebt hersteld. Als je functie op runtime een fout gooit, vangt de extensie die af, logt naar de background-console en valt terug op het vorige resultaat.

### 11.2 Adaptieve planning

Custom regels draaien normaal ongeveer elke seconde. Als je regel te lang duurt, vertraagt de extensie automatisch de lus (tot ongeveer elke 5 seconden). Je hoeft dit niet zelf te beheren.

### 11.3 Het object `helpers`

Binnen de functie biedt `helpers` verschillende sub-helpers. Elk heeft een lange naam en een korte alias. Er zijn ook expliciete getter-methoden:

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — de huidige epoch-tijd in milliseconden.

Alle helper-methoden zijn ontworpen om veilig te zijn: slechte parameters geven `null`, `false` of een lege waarde terug in plaats van een fout te gooien.

#### 11.3.1 `timerHelper`

Beheert afteltimers gekoppeld aan een domein. Timers blijven bestaan over browserherstarts heen. Elke timer hoort bij de custom groep die hem heeft gemaakt.

- `createTimer(domain, durationMs, displayName?)` — maakt en retourneert een unieke timer-id, of `null` bij ongeldige invoer. Voorbeeld: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`. Terwijl de gebruiker op een pagina is die met dat domein overeenkomt, toont de overlay in de pagina `Timer1: 30:00` en telt af.
- `deleteTimer(id)` — verwijdert de timer. Geeft `true` terug bij succes.
- `pauseTimer(id)` — pauzeert het aftellen.
- `continueTimer(id)` / `resumeTimer(id)` — hervat een gepauzeerde timer.
- `resetTimer(id, durationMs?)` — start de timer opnieuw. Zonder `durationMs` wordt de oorspronkelijke waarde hergebruikt.
- `addMs(id, ms)` — voegt milliseconden toe (of trekt af met negatieve waarden).
- `remainingMs(id)` — resterende milliseconden.
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — booleans.
- `getDomain(id)` / `getDisplayName(id)` — timerinfo uitlezen.
- `findByDomain(domain)` — array van timer-id's voor dat domein.
- `list()` — array van `{ id, domain, displayName, durationMs, remainingMs, isPaused }` voor elke timer die deze groep bezit.

Maximale timerduur is ongeveer 30 dagen.

#### 11.3.2 `persistenceHelper`

Map-achtige opslag met scope per groep. Waarden moeten JSON-serialiseerbaar zijn. Handig om status tussen aanroepen te onthouden.

- `set(key, value)` — slaat elke JSON-waarde op. Geeft `true` terug bij succes.
- `get(key, defaultValue?)` — geeft de opgeslagen waarde terug, of `defaultValue` als die ontbreekt.
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`.

Zachte limieten: ongeveer 200 sleutels per groep, 16 KB per waarde.

#### 11.3.3 `domainHelper`

- `normalize(value)` — geeft het canonieke domein terug zoals `youtube.com`, of `null`.
- `matches(hostname, site)` — `true` als `hostname` bij `site` hoort (inclusief subdomeinen).

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — schrijft naar de background-console.

Om deze berichten te zien: `chrome://extensions` → Developer Mode inschakelen → klik op de "service worker"-link van de extensie.

#### 11.3.5 `platformHelper`

Inspecteer ondersteunde sociale/video-platforms.

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`.
- `normalizePlatform(value)` — geeft de canonieke platformnaam terug, of `null`.
- `normalizeAuthor(author, platform)` — normaliseert een auteuridentifier (handle, URL, enz.) voor een specifiek platform, of `null`.
- `detect(urlOrHost)` / `getContext(urlOrHost)` — geeft `{ platform, hostname, pathname, type, authors, url }` terug, of `null`.
  - `type` is `"short" | "long" | "post" | "unknown"`.
  - `authors` is de lijst genormaliseerde auteurs die uit die URL detecteerbaar zijn.
- `getType(urlOrHost)` — snelkoppeling voor `detect(...).type`.
- `getPlatform(urlOrHost)` — snelkoppeling voor `detect(...).platform`.
- `getAuthors(urlOrHost)` — snelkoppeling voor `detect(...).authors`.
- `matchesAuthor(urlOrHost, platform, authors)` — geeft `true` terug als de URL op dat platform staat en een van de opgegeven auteurs overeenkomt.

### 11.4 Voorbeelden

Makkelijk: blokkeer sociale media op weekdagochtenden.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

Gemiddeld: 30 minuten YouTube per browsersessie, met zichtbare aftelling.

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

Moeilijker: blokkeer een TikTok-sessie alleen als het korte video's zijn EN de auteur in je afleidingslijst staat. Gebruik `platformHelper`.

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

(`globalThis.location` is slechts een voorbeeldplaceholder — normaal stuur je `platformHelper` vanuit je eigen logica aan, niet vanuit de locatie van de worker, omdat de background worker geen echte pagina-URL heeft.)

Moeilijkst: roterende "site van de dag" met een dagelijkse limiet, persistent over herstarts.

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

## 12. Gedrag op meerdere pagina's

- Alle geopende tabbladen in dezelfde groep delen dezelfde timer.
- Wanneer je naar een tabblad in dezelfde groep schakelt, wordt de overlay direct vernieuwd om de actuele gedeelde tijd te tonen.
- Wanneer een nieuwe regel wordt toegevoegd, detecteert elke geopende pagina de wijziging en ververst binnen een fractie van een seconde; je hoeft tabbladen niet handmatig te herladen.
- Wanneer een regel verloopt, worden verborgen feedkaarten en navigatieknoppen bij de volgende refresh hersteld.

---

## 13. Internationalisatie

De volledige UI is vertaald. Gebruik de taalkeuze **Language** rechtsboven.

Ondersteunde talen omvatten Engels, Chinees (vereenvoudigd), Spaans, Japans, Koreaans, plus gedeeltelijke dekking voor Hindi, Arabisch, Bengaals, Portugees, Russisch, Punjabi, Duits, Frans, Turks, Vietnamees, Italiaans, Thai, Nederlands, Pools, Indonesisch, Urdu en Perzisch. Talen met gedeeltelijke dekking vallen terug op Engels voor ontbrekende strings.

De handleiding zelf laadt het markdown-bestand dat overeenkomt met je geselecteerde taal, met Engels als fallback.

---

## 14. Statusmeldingen

Statusmeldingen verschijnen als een gecentreerde toast die na ongeveer twee seconden vervaagt:

- "Saved changes."
- "Created \"Group name\"."
- Validatiefouten zoals "Allowed minutes must be a number greater than 0."
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

Voor invoervelden met formaateisen verschijnt de melding ook naast de relevante knop (voor snooze).

---

## 15. Privacy en opslag

- Alles wordt lokaal opgeslagen in `chrome.storage.local`. Er wordt geen data ergens naartoe verzonden.
- Opgeslagen items zijn onder meer: je groepen, gebruikstimers, laatste resettijden, snoozerecords, custom timers en custom persistente waarden.
- De extensie leest geen paginacontent buiten wat nodig is om het paginatype te detecteren (pad/hostnaam/bekende DOM-markeringen voor videosites). Ze leest je berichten, posts, reacties of privécontent niet.

---

## 16. Machtigingen

- `storage` — voor de bovenstaande data.
- `declarativeNetRequest` — voor native blokkering van `Default`-groepen.
- `alarms` — om regelovergangen efficiënt te plannen.
- `host_permissions: <all_urls>` — zodat het content script de timer-overlay kan tonen en platformcontext op elke pagina kan detecteren.

---

## 17. Probleemoplossing

- **Een groep die ik heb toegevoegd doet niets.** Controleer of de groep ingeschakeld is, de planning het nu toestaat, er geen snooze actief is en (voor platformgroepen) de pagina echt overeenkomt met het gekozen contenttype en auteurfilter.
- **Een timer zit vast of is fout op één tabblad.** Schakel weg en terug, of focus het tabblad — dat triggert een geforceerde refresh van de gedeelde timer.
- **Feedkaarten verschijnen opnieuw terwijl ze verborgen zouden moeten zijn.** Feed-verberging draait alleen terwijl de regel actief blokkeert. Als je een `after-minutes`-regel hebt, start feed-verberging zodra je tijd nul bereikt.
- **Een YouTube-navigatieknop die verborgen had moeten zijn is er nog.** Navigatieverberging vereist dat de regel op "do not filter by author" staat en dat het contenttype Shorts of YouTube posts is. Met auteurfilters is verberging alleen per kaart.
- **Custom regel deed niets of gaf stilletjes een fout.** Open `chrome://extensions`, zet Developer Mode aan, klik op de "service worker"-link van de extensie en controleer de console. Gebruik `helpers.logHelper.log(...)` om je regel te traceren.
- **Ik kan een groep niet verwijderen.** De groep is waarschijnlijk bevroren. Strikt bevroren groepen kunnen helemaal niet verwijderd worden totdat hun vergrendeling afloopt; niet-strikt bevroren groepen kunnen via het ontdooi-ritueel worden verwijderd.

---

## 18. Begrippenlijst

- **Blokgroep** — één regelset met eigen type, gedrag, planning en bevries-/snooze-instellingen.
- **Instant block** — de regel blokkeert direct wanneer die actief is.
- **After-minutes block** — de regel begint pas te blokkeren nadat het tijdsbudget van de periode op is.
- **Reset interval** — hoe vaak het after-minutes-budget reset.
- **Schedule** — dagen + tijdvensters waarin een groep actief is.
- **Freeze / Strict freeze** — anti-manipulatie toestanden.
- **Snooze** — tijdelijke uitschakeling met geschreven motivatie.
- **Author filter** — voor platformgroepen beperkt dit de regel tot bepaalde contentmakers.
- **Content type** — voor platformgroepen beperkt dit de regel tot bepaalde contentvormen (short, long, post).
- **Helpers** — hulpmiddelen die aan de functie van een custom regel worden doorgegeven.
- **Platform** — een van `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Elk heeft een eigen groepstype en feed-verbergingslogica.

---

## 19. Beperkingen

- Feed-verberging hangt af van de huidige DOM van elk platform. Als het platform de lay-out wijzigt, moeten de verbergingsselectors mogelijk worden bijgewerkt.
- Platformcontextdetectie voor niet-YouTube-sites is grotendeels URL-gebaseerd en daarom het betrouwbaarst op canonieke content-URL's.
- Lussen van custom regels draaien in de background worker, niet in pagina's, dus DOM-informatie is niet beschikbaar binnen de functie. Gebruik in plaats daarvan `platformHelper.detect(url)` met een URL-string.
- De browser kan de service worker pauzeren wanneer die inactief is. De extensie hervat hem zodra een pagina of alarm hem nodig heeft; gebruikstimers verliezen hierdoor geen nauwkeurigheid.
