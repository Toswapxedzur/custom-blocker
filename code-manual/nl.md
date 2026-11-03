# Codemanual voor de Vault-browserextensie

[Gebruikershandleiding](../manual/nl.md)

## Contract van de regel

Source: één functie-expressie `(on, v) => { ... }`. Alleen synchrone JavaScript en de onderstaande API worden ondersteund; geen JavaScript-planningscallbacks, netwerk, extensie-API's of directe DOM-toegang. Tijdregels gebruiken de hieronder beschreven beheerde timers/trackers, of `ev.now` en events.

- Wijzigingen slaan een concept op; **Run** activeert de regel en schakelt de groep in. Bevroren groepen kunnen niet Run uitvoeren. Een lege source laadt de regel uit.
- Een geslaagde Run vervangt handlers en panels, met behoud van `v.state`. Bij een fout in compilatie/registratie blijft de vorige regel actief; een timeout kan deze stoppen. Bij het herladen van de engine wordt de laatst geactiveerde source opnieuw geregistreerd; closure variables worden gereset.
- Registratie kan state initialiseren, handlers registreren, panels tonen en loggen. Pagina-/bestandsacties en emits horen in handlers; de tijdens registratie geplaatste wachtrij wordt weggegooid.
- Disable onderdrukt handlers en verwijdert beheerde panels, sheets, covers en itemverdicts. Enable herstelt bewaarde panels/sheets en vraagt items opnieuw op. Run wist bestaande sheets, covers of itemverdicts niet. Delete verwijdert de regel en de state/effecten. Navigatie, DOM-wijzigingen en bestandsschrijfacties worden niet ongedaan gemaakt.
- Events zijn niet beperkt tot gewone groepsdoelen; filter URLs/items in de regel. Acties worden in de wachtrij gezet en na dispatch toegepast. Exceptions stoppen die handler zonder state/actions terug te draaien; latere handlers kunnen nog doorgaan. Alleen file/query-events bevestigen acties.

## Gedeelde API

- `on(type, handler)` → boolean. Registreert `handler(ev)`; meerdere handlers worden uitgevoerd in registratievolgorde. False betekent ongeldige argumenten of dat de handlerlimiet is bereikt. `ev = { type: string, now: number, origin: "host" | "user" | "rule", data }`; `now` is Unix-milliseconden. Echte gebeurtenissen van weergegeven bedieningselementen hebben `origin: "user"`; gebeurtenissen van `v.emit` hebben `origin: "rule"`.
- `v.state`: wijzigbaar JSON-object, opgeslagen na eventdispatch. Initialiseer ontbrekende fields in plaats van bestaande state te overschrijven. Toewijzing van een non-object of array reset naar `{}`; niet-serialiseerbare/te grote wijzigingen worden niet opgeslagen.
- `v.log(...values)`: schrijft naar de Log van deze groep. Fouten in handlers en gemelde fouten bij pagina-acties verschijnen hier ook; het melden voert acties niet opnieuw uit. Logs/Clear zijn per groep onafhankelijk. Laadfouten staan in de Run-status.
- `v.emit(type, data)`: zet een JSON-kopie van `data` in de wachtrij voor de handlers van deze groep na het huidige event, met een nieuwe `now`; dit is geen synchrone aanroep.
- `v.panel(id, spec, tabId?)`: vervangt het benoemde panel van deze groep; laat `tabId` weg voor elke toegankelijke webpagina of gebruik een geheel tab-ID. `spec` null verwijdert het panel. Zie Panels.
- `v.file(op, path, payload?)` → request-ID-string. Zie Files.
- `v.store(request)` retourneert een aanvraag-ID; zie groepsrecords.

Andere gedeelde aanroepen retourneren `undefined`, behalve de hieronder genoemde fabrieksfuncties voor beheerde tijdobjecten. IDs/state horen bij een groep, niet bij de weergavenaam.

## Beheerde timers en voortschrijdend gebruik

`v.timer(id, {direction:"down", durationMs:300000})` maakt een benoemde afteltimer aan of retourneert deze, aanvankelijk gepauzeerd. Gebruik `{direction:"up"}` voor een opteltimer. De handle heeft `start()`, `pause()`, `resume()`, `reset()` en `snapshot()`. Start/resume zijn idempotent; reset keert terug naar gepauzeerd met nul verstreken tijd. Snapshotvelden omvatten `ready`, `error`, `elapsedMs`, `remainingMs` (null bij optellen), `running` en `completed`.

Lopende timers gaan verder volgens de kloktijd terwijl de app/browser gesloten is of de regel uitgeschakeld is. Een voltooide afteltimer levert `timerEnded` met `{id, direction, durationMs, generation, incarnation}` eenmaal per timerincarnatie en generatie aan elk lid wanneer diens regel de volgende keer draait; Run herhaalt dit niet. Levering hangt af van events van de host; dit is geen realtimealarm. Plaats `{type:"timer", timerId:"focus", label:"Focus"}` in een panel om de timer via de bestaande tekstcontrol weer te geven.

`v.rolling(id, {windowMs:3600000, limitMs:600000})` maakt een benoemde tracker voor actief gebruik aan of retourneert deze. `assign({websites:["youtube.com","reddit.com"], apps:[]})` vervangt de doeltoewijzingen van dit lid. Native regels kunnen in plaats daarvan platformgebonden app-IDs toewijzen. Domeinen omvatten subdomeinen. Eén tracker bundelt zijn doelen; andere IDs hebben onafhankelijke tegoeden. `snapshot()` retourneert `ready`, `error`, `usedMs`, `remainingMs`, `available` en `nextReturnAtMs` (de eerstvolgende milliseconde waarop enig vastgelegd gebruik vervalt). `available(target?)` controleert ook de toewijzing wanneer een doel wordt meegegeven. `reset()` wist de geschiedenis van dit object.

Al het waargenomen gebruik dat aan de voorwaarden voldoet telt mee, ook gebruik boven het tegoed; de tracker blokkeert zelf geen pagina/app. Overlappende intervallen van zichtbare pagina's tellen eenmaal, en native apps tellen waargenomen gebruik op de voorgrond. Uitgeschakelde regels voegen geen gebruik toe; geschiedenis vervalt nog steeds op de exacte intervalgrenzen. Beschikbaarheid keert pas terug wanneer de resterende geschiedenis onder de limiet ligt. Heartbeatmetingen zijn begrensd tot vijf seconden; onderbrekingen door afsluiten/uitschakelen creëren geen activiteit. Door de gebruiker uitgezonden events voegen geen gebruik toe.

Dezelfde object-IDs in gekoppelde aangepaste groepen delen één lokale native-hubautoriteit. Koppelen voegt trackergeschiedenis en toewijzingen samen en behoudt de timerstatus van de initiatiefnemer; incompatibele configuraties weigeren de koppeling. Elk lid ontvangt zijn eigen voltooiingsevent. Bij verbindingsverlies worden gedeelde trackers onbeschikbaar en worden timerbedieningen geweigerd totdat een actuele autoriteit terugkeert. Bij ontkoppelen behoudt elk lid het uiteindelijke gedeelde gebruik en de timerstatus, herstelt zijn eigen doelen en laat opdrachten van de oude koppeling vallen. De hub bewaart de laatste snapshot totdat het terugkerende lid deze opslaat en bevestigt; openstaande overdrachten worden voltooid voordat een nieuwe koppeling beschikbaar wordt.

Benoemde objecten overleven Run en herstarten in het gereserveerde `v.state.$vaultTime`; bewerk dat veld niet rechtstreeks. Verwijder ze expliciet met `v.removeTime(id)`. IDs zijn 1–80 ASCII-letters, cijfers, `_` of `-`; gereserveerde eigenschapsnamen worden geweigerd. Maximaal 32 objecten delen de statelimiet van 64 KiB UTF-8 van de regel. Tijdsduur wordt opgegeven in gehele milliseconden, tot 365 dagen. Voortschrijdende geschiedenis is begrensd tot 1024 minuutvakken en 2048 samengevoegde intervallen. Fouten door volle geschiedeniscapaciteit laten de tracker onbeschikbaar totdat deze expliciet wordt gereset; ongeldige configuraties en te grote opslagacties melden fouten zonder opgeslagen gegevens te wissen.

```js
(on, v) => {
  const timer = v.timer("focus", {durationMs: 300000});
  v.panel("focus", {controls: [
    {type: "timer", timerId: "focus", label: "Focus"},
    {id: "start", type: "button", label: "Start"},
    {id: "pause", type: "button", label: "Pause"},
    {id: "reset", type: "button", label: "Reset"}
  ]});
  on("panel", ev => {
    if (ev.data.eventName !== "click") return;
    if (ev.data.controlId === "start") timer.start();
    if (ev.data.controlId === "pause") timer.pause();
    if (ev.data.controlId === "reset") timer.reset();
  });
  on("timerEnded", ev => v.log("Finished", ev.data.id));
}
```

## Browerevents

De payloadnotatie hieronder beschrijft typen en is geen uitvoerbare code. `?` markeert optionele fields.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
attachment: { eventName: "click" | "input" | "change", tabId: number,
              attachmentId: string, controlId: string, value: unknown,
              values: { [controlId: string]: unknown }, item: Item, text: string }
record: { requestId: string, ok: boolean, op?: string, key?: string,
          record?: Record | null, entries?: Header[], next?: string | null,
          deleted?: number, error?: string }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, contentId: string, instanceId: string, attachments: { [id: string]: Attachment },
         url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` is bij benadering; gebruik timestamps, geen tickaantallen. `active` betekent geselecteerd in een browservenster en bewijst niet dat de gebruiker ernaar kijkt. URLs kunnen leeg/beperkt zijn.
- `visible` komt van toegankelijke, niet-verborgen pagina's; `elapsedMs` is de tijd sinds hun laatste heartbeat en nul wanneer de pagina wordt afgedekt. Dit is geen cumulatief gebruik of afspeeltijd.
- `items` (`platform: "web"` buiten herkende sites) meldt nieuwe/gewijzigde ondersteunde feeditems en stuurt ze opnieuw na Run/herinschakeling. `ref` identificeert een kaart op die pagina, geen blijvend content-ID; `ref === "page"` duidt de pagina zelf aan. Titels/URLs/auteurs kunnen leeg zijn. `authors` bevat platformgebonden source identifiers.
- Platform IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. Beschikbare items hangen af van ondersteunde markup op de pagina.
- Tags vereisen een verbonden desktop-Classifier en een build/platform met tagging (Chromium en Safari: YouTube, Reddit, Bilibili, X/`twitter`). Confidence is 1–5. `tagsSettled === false` betekent in behandeling/niet beschikbaar, niet niet-getagd; `tags: []` als settled betekent niet-getagd.
- `snooze` betekent dat de Snooze-knop van de groep is ingedrukt. Dit pauzeert niets op zichzelf.
- Query-/fileantwoorden gaan naar de aanvragende groep. Koppel `requestId`, controleer `error`/`ok` en stel een deadline in met ticks: antwoorden kunnen verloren gaan bij sluiten van de pagina, herladen van de engine of uitschakelen van de groep. Request IDs kunnen na Run terugkomen; openstaande verzoeken zijn geen duurzaam werk.

## Browseracties

`tabId` als geheel getal moet uit een event komen. Pagina-acties vereisen een pagina die Vault kan bereiken; interne browserpagina's zijn niet beschikbaar. Ongeldige invoer/onbeschikbare doelen hebben meestal geen effect.

- `v.item(tabId, ref, verdict)`: `"hide"` verwijdert een feedkaart, `"dim"` dekt media af, `"allow"` stelt vrij van lagere groepen, `null` wist het verdict van deze groep. Onbekende refs doen niets; gebruik `v.cover` voor `isPage`. Verdicts volgen de groepsvolgorde: hogere hide wint; hogere dim blijft gelden ondanks lagere allow; allow voorkomt lagere verdicts. Een hergebruikte/verwijderde kaart heeft een nieuwe beslissing nodig.
- `v.cover(tabId, on, message?)`: true dekt de pagina af, false heft de aangepaste cover op; message is standaard leeg (max. 500 tekens). Eén custom-cover-slot per pagina; de laatst toegepaste coveraanroep wint ongeacht de groepsvolgorde. Een adreswijziging heft deze op; gewone blokkering kan de pagina nog steeds afdekken.
- `v.go(tabId, target)`: een HTTP(S)-URL of `"back"`, `"forward"`, `"reload"` (target max. 4096 tekens).
- `v.close(tabId)`: sluit de tab.
- `v.css(tabIdOrStar, id, css)`: geheel tab-ID of `"*"`; vervang het groepsstylesheet met die ID of verwijder met null. Tab-sheets eindigen bij een adreswijziging; `"*"`-sheets gelden ook voor toekomstige pagina's. ID max. 80, CSS max. 100000 tekens.
- `v.dom(tabId, selector, op, arg?)`: CSS-selector (max. 1000); alle matches, behalve dat `scrollTo` de eerste gebruikt. Ops: `hide` stelt inline `display:none!important` in; `show` verwijdert inline display; `click`; `setText` vervangt tekst door `arg`; `addClass`/`removeClass` gebruiken één class name; `scrollTo` scrolt naar de weergave. Arg max. 2000. Wijzigingen blijven bestaan tot ze expliciet worden teruggedraaid/de pagina wordt vervangen.
- `v.query(tabId, selector)` → request-ID-string, of null bij ongeldige argumenten. Resultaat is een later `query`-event: maximaal 50 matches, kleine-letter `tag`, normalized text ≤1000 tekens, attributes ≤2000, value ≤1000. Geen matches is succesvol `[]`; ongeldige CSS geeft `error: "invalid-selector"`. Een pagina zonder Vault-receiver reageert mogelijk niet.

## Panels

```text
spec = { title?: string, description?: string, controls?: Control[],
         position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center",
         width?: "small" | "medium" | "large" | number,
         layout?: Layout, align?: "left" | "center" | "right", role?: Role }
Control = { id?: string, type?: string, label?: string, value?, disabled?: boolean,
            ariaLabel?: string, autoFocus?: boolean,
            align?: "left" | "center" | "right", layout?: Layout,
            width?: "full" | "auto" | number, height?: "auto" | number,
            ...type-specific fields below }
Layout = "vertical" | "compact" | "comfortable" | "spacious" | "inline" | "row"
       | "wrap" | "twoColumn" | "grid" | "split" | "form" | "toolbar" | "stack"
Role = "region" | "dialog" | "alert" | "status" | "form" | "group"
```

Standaard: rechtsonder; verticale layout; links uitgelijnd; role region; breedte past bij inhoud. Breedtepreset 220/280/360px; numerieke panelbreedte beperkt tot 180–520px. Controlbreedte 32–520px, hoogte 20–360px. Numerieke maten accepteren ook pixel strings. Verticale varianten wijzigen tussenruimte; inline/row breken niet af; wrap/toolbar breken af; twoColumn/grid/split/form gebruiken rasters; stack minimaliseert tussenruimte. Role geeft toegankelijkheidssemantiek, geen modale blokkering.

IDs worden genormaliseerd naar ASCII-letters/cijfers/`_`/`-` (max. 80); kies unieke, stabiele IDs. Een weggelaten control-ID wordt `control-N`; een weggelaten/onbekende type wordt text. Weggelaten text/lists zijn leeg; disabled is false. `v.panel` vervangt de volledige spec. Weggelaten `value` hergebruikt de laatste controle-eventwaarde en past daarna typenormalisatie toe; expliciete `value` overschrijft deze. Autofocus is standaard false. Onbekende fields worden verwijderd; kleuren/fonts/CSS van panels die door regels worden opgegeven, worden niet ondersteund.

Controlvelden en waarden:

- `text`: string `text`; standaard label. `html`: string `html`; verwijdert scripts, event attributes, gevaarlijke URL's en styling.
- `button`: `label`, optionele `action: "submit" | "cancel" | "close"`; value is een string (standaard leeg). Actions sturen events; ze submitten/sluiten niet automatisch iets.
- `checkbox`, `toggle`: boolean `value` (standaard false).
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; string value (standaard leeg). Lege option values verwijderd; labels standaard gelijk aan value.
- `textInput`, `textarea`: string value (standaard leeg), `placeholder`; textarea `rows` 1–12 (standaard 3).
- `numberInput`, `range`: numeric value (standaard 0), `min`, `max`, positieve `step`. Values vallen binnen grenzen; niet opgegeven normalisatiegrenzen zijn −1000000…1000000. Range-widgets standaard 0…100; stel grenzen expliciet in.
- `date`: string `YYYY-MM-DD`; `time`: string `HH:MM` of `HH:MM:SS`; ongeldige beginformaten worden leeg. `color`: `#RRGGBB` (standaard `#000000`).
- `pin`: cijferstring; `length` 3–12 (standaard 6), `masked` standaard true, `autoSubmit` false. `section`: `text`, `controls`, optionele layout/align/role (role standaard group); child sections op depth 3 hebben geen children (root controls depth 0).

Panel-events: inputcontrols sturen `input`/`change` (textinput wijzigt bij blur/Enter; textarea bij blur/Ctrl-or-Cmd+Enter). Gewone controls sturen ook `focus`, `blur`, `key`; key-metadata wordt niet doorgegeven aan de regel. Buttons sturen `click` **en** hun ingestelde action als aparte events—verwerk er één. PIN stuurt `change` en `submit` wanneer autoSubmit compleet is. Mount/unmount gebruikt `controlId: ""`, `value: true`. `values` bevat huidige invoerwaarden per ID; buttons/text/HTML ontbreken. Events hebben geen bron-tab-ID; gebruik aparte panel-IDs voor tabgebonden interacties.

Tekstlimieten: title/label/ariaLabel 240; description/text 1000; HTML 20000; placeholder 500; input text 2000; overige value strings 512; option value/label 256. Overschrijding wordt afgekapt.

## Files

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`. Vereist **Map voor aangepaste regels** in Settings en de bijbehorende machtiging. Safari gebruikt de native mapkiezer en een bewaarde security-scoped grant; alleen de gekozen map is beschikbaar.

- `path` is relatief; `/` scheidt directories. Segmenten mogen ASCII-letters/cijfers, spaties en `_.,@()-` bevatten; geen voorloopdot, `.`/`..`, absolute path of URL. Bestandsextensies: `.txt`, `.csv`, `.json` (hoofdletterongevoelig). List path is een directory; `""` toont de gekozen root.
- Read retourneert UTF-8-tekst. Write vervangt/maakt; append maakt/voegt toe zonder automatische newline. Parent directories worden bij schrijven aangemaakt. String-payload wordt letterlijk geschreven; andere JSON-payloads worden geserialiseerd; null/weggelaten betekent lege tekst. JSON/CSV-parsing is taak van de regel. Maximale bestandsgrootte: 1048576 UTF-8 bytes.
- List retourneert direct zichtbare subdirectories en ondersteunde bestanden. Entries: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; extension bevat bij bestanden de punt. Exists retourneert een boolean voor een ondersteund bestandspad.

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

Ongebruikte result fields zijn null; succes heeft een lege error. Fouten omvatten invalid-path, unsupported-file-type, permission/folder unavailable, missing file en file-too-large. Behandel error als string, niet als vaste uitputtende enum. Requests hebben geen transaction-/volgordegarantie; serialiseer read-modify-write per pad.

## Limieten

Per event per groep: 256 acties in de wachtrij, 200 logaanroepen, 64 emits; het meerdere wordt weggegooid. Per regel: 1000 handlers, 24 panels; elke lijst met controls heeft 32 entries en elke keuzelijst 64 opties; het meerdere wordt genegeerd/afgekapt. Emitketens stoppen na 16 generaties. Limiet voor geserialiseerde state: 65536 UTF-8-bytes. Houd registratie en de gecombineerde handlers van elk event onder 1 seconde; herhaalde overschrijdingen of een harde timeout stoppen de groep tot Run. Log bewaart 200 entries, accepteert 50 per seconde per groep en kapt lange berichten rond 4096 tekens af. Timers/antwoorden zijn naar beste vermogen, zonder realtimegaranties.

## Volledige regel

Een pauze van vijf minuten, gestart met Snooze of de panelknop ervan:

```javascript
(on, v) => {
  v.state.pauseUntil ??= 0;
  const pause = ev => { v.state.pauseUntil = ev.now + 300000; };
  v.panel("pause", { controls: [{ id: "pause", type: "button", label: "Pause 5 min" }] });
  on("snooze", pause);
  on("panel", ev => {
    if (ev.data.panelId === "pause" && ev.data.controlId === "pause" && ev.data.eventName === "click") pause(ev);
  });
  on("tick", ev => {
    for (const tab of ev.data.tabs) {
      if (/^https?:\/\/(www\.)?youtube\.com(?:\/|$)/i.test(tab.url)) v.cover(tab.tabId, ev.now >= v.state.pauseUntil);
    }
  });
}
```


## AI-aanroepen vanuit een actieve regel

Elke custom group kiest onder **AI calls** een verbinding/model en reasoning effort. Mac- en browserregels gebruiken dezelfde API; browserverzoeken vereisen een verbonden Mac Vault en providergegevens blijven daar. Gekoppelde groepen delen de keuze en een optionele dagelijkse limiet. Leeg betekent geen groepslimiet; accountlimieten blijven gelden. De limiet gebruikt UTC-dagen, blijft na herstart bestaan en telt ingediende pogingen, ook mislukte. Link combineert bestaand gebruik; unlink behoudt eerder gebruik.

De opgeslagen prompt en context worden gedeeld door gekoppelde groepen en zijn in handlers beschikbaar als `v.context.ai.prompt` en `v.context.ai.context`. Vault verzendt ze niet automatisch; de regel kiest wat elke `v.ai`-aanroep bevat.

`v.ai({ prompt, input? })` retourneert direct een request-ID. Roep dit binnen een handler aan, niet bij registratie. `input` mag elke JSON-waarde zijn; prompt en input zijn elk maximaal20KB. Antwoorden komen als `ai` events: `. Success text is at most48KB; citations are ` `ask` `note`-events: {requestId, ok, text, citations, error}. Succesvolle tekst maximaal48KB; citaties {url,title}. Behoud zichtbare, klikbare bronlinks bij antwoorden op basis van web search. Search is altijd beschikbaar voor het model. Geen vaste app-deadline; concurrency is begrensd; geen provider-fallback of automatische retry. Antwoorden zijn gegevens, geen uitvoerbare JavaScript; de regel beslist welke bestaande acties worden uitgevoerd.

```javascript
(on, v) => {
  let pending = null;
  on("panel", ({ data }) => {
    if (data.controlId !== "ask" || pending) return;
    pending = v.ai({ prompt: v.context.ai.prompt || "Summarize this text.", input: {context:v.context.ai.context, note:data.values?.note ?? ""} });
  });
  on("ai", ({ data }) => {
    if (data.requestId !== pending) return;
    pending = null;
    if (!data.ok) { v.log("AI request failed:", data.error); return; }
    v.log(data.text, data.citations);
  });
}
```

Openstaande aanroepen worden na herstart niet opnieuw afgespeeld. Run, uitschakelen/opnieuw inschakelen en verwijderen verwerpen oude antwoorden; een niet-verbonden browser meldt `ai-unavailable`. Andere fouten: `ai-not-configured`, `ai-invalid-input`, `ai-busy`, `ai-daily-limit`, `ai-request-failed`, `ai-usage-storage-unavailable`. Mislukte aanroepen overschrijven geen eerder resultaat dat de regel bewaart. De statelimiet blijft64KB.

Ontdek keuzes zonder inloggegevens met `rule_ai_models` op Mac of `settings-rule-ai-models` in de browser. Configureer `ruleAI` via het bestaande set-group-pad. Velden: `providerModel`, `accountID`, `reasoningEffort` (`default`, `low`, `medium`, `high`) en `dailyRequestLimit` (null of1–100000). Gebruik een geretourneerde keuze; zet geen sleutel of provider-URL in de regelbron.
De optionele opgeslagen velden zijn `prompt` en `context`, elk een tekenreeks van maximaal16KB.

## Groepsrecords

`v.store(request)` start binnen een handler een asynchrone JSON-recordbewerking. Records zijn privé per groep, blijven bestaan na Run en herstart en worden met de groep verwijderd. Gekoppelde groepen hebben aparte stores. De regel kiest sleutels, waarden, versies, cache-invalidatie en voorrang van feedback. Mac- en browserregels gebruiken dezelfde API, maar elke app/browser heeft een eigen store.

| Request | Result |
|---|---|
| `{op:"get", key}` | `record` of `null` |
| `{op:"put", key, value, version?, ifRevision?}` | opgeslagen `record` |
| `{op:"delete", key, ifRevision?}` | `record: null` |
| `{op:"list", prefix?, after?, limit?}` | gesorteerde `entries` en `next` |
| `{op:"clear", prefix?}` | aantal `deleted` |

Een record bevat `{value, revision, version, updatedAt}`. De ondoorzichtige revision verandert bij een echte schrijfoperatie; `version` is metadata van de aanroeper. `list` retourneert headers zonder waarden; gebruik `get` om er een te lezen en `after: next` `put` `delete` voor de volgende pagina. Zonder `ifRevision` zijn put/delete onvoorwaardelijk; `null` vereist een ontbrekende sleutel, een revision-string een exacte overeenkomst. Een conflict retourneert `ok:false`, `error:"store-conflict"` en de huidige `record`. Zo overschrijft een late automatische reactie geen gebruikersfeedback. `v.context.revision` is een ondoorzichtige configuratiemarker die een regel in zijn versie kan opnemen. Het framework legt geen cachebeleid op.

Limieten: sleutel 1–2048 tekens, versie ≤128, JSON-waarde ≤64KiB, diepte ≤32, 10000 sleutels per groep, volledig document16MiB. `list` retourneert maximaal100 headers en96KiB per pagina. Maximaal32 verzoeken per groep en128 starts per seconde totaal. Bij overbelasting meldt het systeem één `store-busy` per groep per seconde en laat overige verzoeken vallen. Opslagfouten geven `ok:false`; toekomstige of beschadigde documenten blijven behouden en melden `store-unavailable`. Geen automatische retry of verwijdering. Gebruik ticks voor deadlines.

## Opgeslagen inhoudsbijlagen

`v.attach(tabId, item, id, spec)` slaat een pill of passieve HTML/CSS-weergave op voor een waargenomen inhoudsitem. Geef het volledige `item` van een `items`- of `attachment`-gebeurtenis door; alleen een `ref` is geen bijlagehandle. `contentId` identificeert opgeslagen inhoud en `instanceId` de huidige verschijning. Bewaar de oorspronkelijke handle terwijl je op AI wacht. Een late bijlage voor een verwijderd, hergebruikt of genavigeerd doel wordt geweigerd. `v.item(tabId, ref, verdict)` blijft apart werken.

Voor een pill is `spec` `{type:"pill", text, tone?, tooltip?}`; tonen zijn `blue`, `cyan`, `gold`, `pink` of `red`. Platte tekst: maximaal 240 tekens; tooltip: 1000. Voor een weergave is spec `{type:"html", html, css?, label?}`. Grenzen: HTML 32000 tekens, CSS 16000, label 200. De weergave wordt opnieuw opgebouwd uit toegestane passieve HTML/SVG in een gesloten shadow root met afgebakende CSS. Scripts, eventattributen, externe bronnen, embeds en onveilige CSS worden verwijderd. De weergave blijft in de inhoudskaart en scrolt bij 480px hoogte. ID's bevatten 1–80 ASCII-letters/cijfers, _ of -. Een null-spec verwijdert de pill van de groep. Roep dit aan vanuit een handler; opslag-/bezorgfouten verschijnen in Log en worden niet automatisch opnieuw geprobeerd.

Elk item biedt de bijlagen van deze groep als alleen-lezen snapshot in `item.attachments`; bijlagen van andere groepen staan daar niet in. Als opgeslagen gegevens niet beschikbaar zijn, is `attachments` null en wordt `attachmentError` ingesteld; dat betekent niet dat de cache leeg is. Andere handlers blijven lopen. Gebruik het voorbeeld om AI niet opnieuw aan te vragen voor inhoud met een opgeslagen resultaat.

Activering met aanwijzer, Enter of Space maakt een `attachment`-gebeurtenis voor de groep. Pills sturen `click`. Weergavebesturing gebruikt `data-control` of `id` als `controlId` en stuurt `click`, `input` of `change`, met de huidige `value` en begrensde `values` voor benoemde velden. Echte UI-gebeurtenissen hebben `ev.origin === "user"`; regelgebeurtenissen `origin === "rule"`. Ze bevatten `tabId`, `attachmentId` en het huidige `item`. De weergave voert geen regelcode uit. Pills en weergaven voorkomen dat hun interactie de onderliggende kaart navigeert. Opgeslagen gegevens bevatten geen callback of uitvoerbare code. Een oude pill-revisie kan geen actuele bijlage aanroepen. Rule-emit-gebeurtenissen zijn gewone logica; de browser controleert echte UI-klikberichten afzonderlijk.

Bijlagen worden in dit browserprofiel per groep/inhoud/ID opgeslagen en keren terug bij volgende vermeldingen, navigatie, browserherstart en Run. Disable verbergt ze maar behoudt de gegevens; enable herstelt ze. Groep verwijderen wist de bijlagen. Gekoppelde groepen blijven apart; er is geen automatische synchronisatie tussen browsers/apparaten. Bekende YouTube-, Reddit-, X- en Bilibili-inhoud gebruikt platform-ID's. Andere inhoud gebruikt een voorzichtig genormaliseerde URL, waardoor beschikbaarheid afhangt van ondersteunde paginamarkup.

Grenzen: 8 bijlagen per groep/inhoud, 32 per item over alle groepen, 10000 inhoudsitems per groep en 8MB voor het geserialiseerde bijlagendocument. Bij een limiet wordt de nieuwe wijziging geweigerd met `attachment-item-limit` of `attachment-storage-limit` in Log; bestaande gegevens blijven behouden. Een dispatch bundelt schrijfacties; identieke spec-waarden schrijven de opslag niet opnieuw. Bijlagen zijn browserinhoud-UI, ook in Safari's native rule-engine. Mac-apprules hebben geen browserinhoudhandles of bijlagenscherm in de app.

```javascript
(on, v) => {
  on("items", ({data}) => {
    for (const item of data.items) {
      if (item.attachments && !item.attachments.note) {
        v.attach(data.tabId, item, "note", {
          type: "pill", text: "Review this", tone: "blue"
        });
      }
    }
  });
  on("attachment", ({data}) => {
    if (data.attachmentId === "note") {
      v.log("Review clicked", data.item.contentId);
    }
  });
}
```

`code-manual/generic-example.js` is een uitvoerbaar beleidsvoorbeeld. Het gebruikt records, AI-aanroepen, feedback van de gebruiker, compare-and-swap, HTML-besturingselementen, itemverdicts en een door de regel beheerd gebruiksrapport; dit zijn gedragingen van de voorbeeldcode, geen speciale functies van de opslag.
