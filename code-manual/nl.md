# Codemanual voor de Vault-browserextensie

[Gebruikershandleiding](../manual/nl.md)

## Contract van de regel

Source: één functie-expressie `(on, v) => { ... }`. Alleen synchrone JavaScript en de onderstaande API worden ondersteund; geen timers, netwerk, extensie-API's of directe DOM-toegang. Tijdregels gebruiken `ev.now` en events.

- Wijzigingen slaan een concept op; **Run** activeert de regel en schakelt de groep in. Bevroren groepen kunnen niet Run uitvoeren. Een lege source laadt de regel uit.
- Een geslaagde Run vervangt handlers en panels, met behoud van `v.state`. Bij een fout in compilatie/registratie blijft de vorige regel actief; een timeout kan deze stoppen. Bij het herladen van de engine wordt de laatst geactiveerde source opnieuw geregistreerd; closure variables worden gereset.
- Registratie kan state initialiseren, handlers registreren, panels tonen en loggen. Pagina-/bestandsacties en emits horen in handlers; de tijdens registratie geplaatste wachtrij wordt weggegooid.
- Disable onderdrukt handlers en verwijdert beheerde panels, sheets, covers en itemverdicts. Enable herstelt bewaarde panels/sheets en vraagt items opnieuw op. Run wist bestaande sheets, covers of itemverdicts niet. Delete verwijdert de regel en de state/effecten. Navigatie, DOM-wijzigingen en bestandsschrijfacties worden niet ongedaan gemaakt.
- Events zijn niet beperkt tot gewone groepsdoelen; filter URLs/items in de regel. Acties worden in de wachtrij gezet en na dispatch toegepast. Exceptions stoppen die handler zonder state/actions terug te draaien; latere handlers kunnen nog doorgaan. Alleen file/query-events bevestigen acties.

## Gedeelde API

- `on(type, handler)` → boolean. Registreert `handler(ev)`; meerdere handlers worden uitgevoerd in registratievolgorde. False betekent ongeldige argumenten of dat de handlerlimiet is bereikt. `ev = { type: string, now: number, data }`; `now` is Unix-milliseconden.
- `v.state`: wijzigbaar JSON-object, opgeslagen na eventdispatch. Initialiseer ontbrekende fields in plaats van bestaande state te overschrijven. Toewijzing van een non-object of array reset naar `{}`; niet-serialiseerbare/te grote wijzigingen worden niet opgeslagen.
- `v.log(...values)`: de enige producent van de Log van deze groep. Logs/Clear zijn per groep onafhankelijk. Laadfouten staan in Run-status; handlerdiagnostiek komt niet in Log.
- `v.emit(type, data)`: zet een JSON-kopie van `data` in de wachtrij voor de handlers van deze groep na het huidige event, met een nieuwe `now`; dit is geen synchrone aanroep.
- `v.panel(id, spec, tabId?)`: vervangt het benoemde panel van deze groep; laat `tabId` weg voor elke toegankelijke webpagina of gebruik een geheel tab-ID. `spec` null verwijdert het panel. Zie Panels.
- `v.file(op, path, payload?)` → request-ID-string. Zie Files.

Andere gedeelde aanroepen retourneren `undefined`. IDs/state horen bij een groep, niet bij de weergavenaam.

## Browerevents

De payloadnotatie hieronder beschrijft typen en is geen uitvoerbare code. `?` markeert optionele fields.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` is bij benadering; gebruik timestamps, geen tickaantallen. `active` betekent geselecteerd in een browservenster en bewijst niet dat de gebruiker ernaar kijkt. URLs kunnen leeg/beperkt zijn.
- `visible` komt van toegankelijke, niet-verborgen pagina's; `elapsedMs` is de tijd sinds hun laatste heartbeat en nul wanneer de pagina wordt afgedekt. Dit is geen cumulatief gebruik of afspeeltijd.
- `items` meldt nieuwe/gewijzigde ondersteunde feeditems en stuurt ze opnieuw na Run/herinschakeling. `ref` identificeert een kaart op die pagina, geen blijvend content-ID; `ref === "page"` duidt de pagina zelf aan. Titels/URLs/auteurs kunnen leeg zijn. `authors` bevat platformgebonden source identifiers.
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

Per event per group: 256 queued actions, 200 log calls, 64 emits; overschrijding wordt weggegooid. Per rule: 1000 handlers, 24 panels; elke control list heeft 32 entries en elke choice 64 options; overschrijding genegeerd/afgekapt. Emit chains stoppen na 16 generaties. Serialized state limit: 65536 JavaScript string characters. Houd registratie en gecombineerde handlers per event onder 1 seconde; herhaalde overschrijdingen of een hard timeout stoppen de groep tot Run. Log bewaart 200 entries, accepteert 50/sec per group en kort lange berichten rond 4096 tekens in. Timers/replies zijn best-effort, geen real-timegaranties.

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
