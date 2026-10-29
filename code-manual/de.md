# Codehandbuch der Vault-Browsererweiterung

[Benutzerhandbuch](../manual/de.md)

## Regelvertrag

Quelle: ein einzelner Funktionsausdruck `(on, v) => { ... }`. Unterstützt werden ausschließlich synchrones JavaScript und die unten beschriebene API; keine JavaScript-Zeitplanungs-Callbacks, Netzwerkzugriffe, Erweiterungs-APIs oder direkten DOM-Zugriffe. Zeitabhängige Regeln verwenden die unten beschriebenen verwalteten Timer/Tracker oder `ev.now` und Ereignisse.

- Bearbeiten speichert einen Entwurf; **Ausführen** aktiviert ihn und die Gruppe. Eingefrorene Gruppen können nicht ausgeführt werden. Leerer Quelltext entlädt die Regel.
- Erfolgreiches Ausführen ersetzt Handler und Panels und erhält `v.state`. Bei einem Kompilierungs-/Registrierungsfehler bleibt die vorherige Regel erhalten; ein Timeout kann sie stoppen. Das Neuladen der Engine registriert den zuletzt aktivierten Quelltext erneut; Closure-Variablen werden zurückgesetzt.
- Die Registrierung darf Zustand initialisieren, Handler registrieren, Panels anzeigen und protokollieren. Seiten-/Dateiaktionen und Emits gehören in Handler; ihre während der Registrierung angelegte Warteschlange wird verworfen.
- Deaktivieren unterdrückt Handler und hebt verwaltete Panels, Stylesheets, Abdeckungen und Elemententscheidungen auf. Aktivieren stellt erhaltene Panels/Stylesheets wieder her und fordert Elemente erneut an. Ausführen löscht bestehende Stylesheets, Abdeckungen oder Elemententscheidungen nicht. Löschen entfernt die Regel sowie ihren Zustand und ihre Wirkungen. Navigation, DOM-Änderungen und Dateischreibvorgänge werden nicht rückgängig gemacht.
- Ereignisse sind nicht auf gewöhnliche Gruppenziele beschränkt; filtern Sie URLs/Elemente in der Regel. Aktionen werden eingereiht und anschließend nach der Ereignisverteilung angewendet. Ausnahmen stoppen den betreffenden Handler, ohne seinen Zustand/seine Aktionen zurückzusetzen; spätere Handler können weiterlaufen. Außer Datei-/Abfrageereignissen gibt es keine Aktionsbestätigung.

## Gemeinsame API

- `on(type, handler)` → boolescher Wert. Registriert `handler(ev)`; mehrere Handler laufen in Registrierungsreihenfolge. False bedeutet ungültige Argumente oder erreichtes Handlerlimit. `ev = { type: string, now: number, origin: "host" | "user" | "rule", data }`; `now` sind Unix-Millisekunden. Tatsächlich gerenderte Steuerelementereignisse haben `origin: "user"`; Ereignisse von `v.emit` haben `origin: "rule"`.
- `v.state`: veränderliches JSON-Objekt, das nach der Ereignisverteilung gespeichert wird. Initialisieren Sie fehlende Felder, statt bestehenden Zustand zu überschreiben. Das Zuweisen eines Nicht-Objekts oder Arrays setzt es auf `{}` zurück; nicht serialisierbare/zu große Änderungen werden nicht gespeichert.
- `v.log(...values)`: schreibt in das Log dieser Gruppe. Handler-Fehler und gemeldete Fehler bei Seitenaktionen erscheinen ebenfalls hier; die Meldung führt Aktionen nicht erneut aus. Logs/Leeren sind pro Gruppe unabhängig. Ladefehler erscheinen im Ausführungsstatus.
- `v.emit(type, data)`: stellt eine JSON-Kopie von `data` nach dem aktuellen Ereignis für die Handler dieser Gruppe mit einem neuen `now` in die Warteschlange; kein synchroner Aufruf.
- `v.panel(id, spec, tabId?)`: ersetzt das benannte Panel dieser Gruppe; lassen Sie `tabId` für alle zugänglichen Webseiten weg oder verwenden Sie eine ganzzahlige Tab-ID. Null als `spec` entfernt es. Siehe Panels.
- `v.file(op, path, payload?)` → Anfrage-ID als Zeichenfolge. Siehe Dateien.
- `v.store(request)` gibt eine Anforderungs-ID zurück; siehe Gruppenaufzeichnungen.

Andere gemeinsame Aufrufe geben `undefined` zurück, außer den unten beschriebenen benannten Factory-Funktionen für verwaltete Zeitobjekte. IDs/Zustand gehören zu einer Gruppe, nicht zu ihrem Anzeigenamen.

## Verwaltete Timer und gleitende Nutzung

`v.timer(id, {direction:"down", durationMs:300000})` erstellt einen benannten Countdown oder gibt ihn zurück; anfangs ist er pausiert. Verwenden Sie `{direction:"up"}` für einen aufwärtszählenden Timer. Das Handle bietet `start()`, `pause()`, `resume()`, `reset()` und `snapshot()`. Start/Fortsetzen sind idempotent; Zurücksetzen pausiert den Timer mit null verstrichener Zeit. Die Snapshot-Felder umfassen `ready`, `error`, `elapsedMs`, `remainingMs` (null bei aufwärtszählenden Timern), `running` und `completed`.

Laufende Timer laufen anhand der real verstrichenen Zeit weiter, während die App/der Browser geschlossen oder die Regel deaktiviert ist. Ein abgelaufener Countdown liefert `timerEnded` mit `{id, direction, durationMs, generation, incarnation}` einmal pro Timer-Inkarnation und Generation an jedes Mitglied, wenn dessen Regel das nächste Mal läuft; Ausführen wiederholt es nicht. Die Zustellung hängt von Ereignissen des Hosts ab; dies ist kein Echtzeitalarm. Fügen Sie `{type:"timer", timerId:"focus", label:"Focus"}` in ein Panel ein, um ihn über das vorhandene Text-Steuerelement anzuzeigen.

`v.rolling(id, {windowMs:3600000, limitMs:600000})` erstellt einen benannten Tracker für aktive Nutzung oder gibt ihn zurück. `assign({websites:["youtube.com","reddit.com"], apps:[]})` ersetzt die Zielzuweisungen dieses Mitglieds. Native Regeln können stattdessen App-IDs der Plattform zuweisen. Domains schließen Subdomains ein. Ein Tracker fasst seine Ziele zusammen; andere IDs haben unabhängige Kontingente. `snapshot()` liefert `ready`, `error`, `usedMs`, `remainingMs`, `available` und `nextReturnAtMs` (die nächste Millisekunde, in der aufgezeichnete Nutzung verfällt). `available(target?)` prüft auch die Zuweisung, wenn ein Ziel angegeben ist. `reset()` löscht den Verlauf dieses Objekts.

Jede beobachtete anrechenbare Nutzung zählt, auch über das Kontingent hinaus; der Tracker selbst blockiert keine Seite/App. Überlappende Intervalle sichtbarer Seiten zählen einmal, und native Apps zählen die beobachtete Vordergrundnutzung. Deaktivierte Regeln fügen keine Nutzung hinzu; der Verlauf verfällt weiterhin an den exakten Intervallgrenzen. Verfügbarkeit kehrt erst zurück, wenn der verbleibende Verlauf unter dem Limit liegt. Heartbeat-Stichproben sind auf fünf Sekunden begrenzt; Lücken durch Beenden oder Deaktivieren erzeugen keine Aktivität. Vom Benutzer ausgelöste Ereignisse fügen keine Nutzung hinzu.

Gleiche Objekt-IDs in verknüpften benutzerdefinierten Gruppen teilen eine lokale maßgebliche Instanz im nativen Hub. Verknüpfen kombiniert Tracker-Verlauf und Zuweisungen und behält den Timer-Zustand des initiierenden Mitglieds; inkompatible Konfigurationen verhindern die Verknüpfung. Jedes Mitglied erhält sein eigenes Abschlussereignis. Bei einer Trennung sind gemeinsame Tracker nicht verfügbar und Timer-Steuerbefehle werden abgelehnt, bis wieder aktuelle maßgebliche Daten vorliegen. Beim Aufheben der Verknüpfung behält jedes Mitglied die endgültige gemeinsame Nutzung und den Timer-Zustand, stellt seine eigenen Ziele wieder her und verwirft Befehle der alten Verknüpfung. Der Hub behält den endgültigen Snapshot, bis das zurückkehrende Mitglied ihn speichert und bestätigt; ausstehende Übergaben werden abgeschlossen, bevor eine neue Verknüpfung verfügbar wird.

Benannte Objekte überstehen Ausführen und Neustarts im reservierten Feld `v.state.$vaultTime`; bearbeiten Sie dieses Feld nicht direkt. Entfernen Sie sie ausdrücklich mit `v.removeTime(id)`. IDs bestehen aus 1–80 ASCII-Buchstaben, Ziffern, `_` oder `-`; reservierte Eigenschaftsnamen werden abgelehnt. Bis zu 32 Objekte teilen sich das Zustandslimit der Regel von 64 KiB UTF-8. Zeitdauern sind ganzzahlige Millisekunden bis zu 365 Tagen. Der gleitende Verlauf ist auf 1024 Minuten-Buckets und 2048 zusammengeführte Intervalle begrenzt. Fehler wegen ausgeschöpfter Verlaufskapazität lassen den Tracker bis zum ausdrücklichen Zurücksetzen nicht verfügbar; ungültige Konfigurationen und zu große Speichervorgänge melden Fehler, ohne gespeicherte Daten zu löschen.

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

## Browserereignisse

Die folgende Nutzdatennotation beschreibt Typen; sie ist kein ausführbarer Code. `?` kennzeichnet optionale Felder.

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

- `tick` ist näherungsweise; verwenden Sie Zeitstempel statt Tick-Zähler. `active` bedeutet innerhalb eines Browserfensters ausgewählt und beweist nicht, dass der Nutzer darauf schaut. URLs können leer/eingeschränkt sein.
- `visible` stammt von zugänglichen, nicht verborgenen Seiten; `elapsedMs` ist die Zeit seit deren letztem Heartbeat, bei Abdeckung null. Es ist keine aufsummierte Nutzungs- oder Wiedergabezeit.
- `items` (`platform: "web"` außerhalb erkannter Websites) meldet neue/geänderte unterstützte Feed-Elemente und sendet sie nach Ausführen/erneutem Aktivieren erneut. `ref` identifiziert eine Karte auf dieser Seite, keine dauerhafte Inhalts-ID; `ref === "page"` bezeichnet die Seite selbst. Leere Titel/URLs/Autoren sind möglich. `authors` enthält plattformspezifische Quellkennungen.
- Plattform-IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. Die Verfügbarkeit von Elementen hängt vom unterstützten Markup der Seite ab.
- Tags erfordern die verbundene Desktop-Klassifizierung und einen Build/eine Plattform mit aktivierter Tag-Zuweisung (Chromium und Safari: YouTube, Reddit, Bilibili, X/`twitter`). Die Konfidenz reicht von 1–5. `tagsSettled === false` bedeutet ausstehend/nicht verfügbar, nicht ohne Tags; abgeschlossenes `tags: []` bedeutet ohne Tags.
- `snooze` bedeutet, dass die Aufschieben-Schaltfläche der Gruppe gedrückt wurde. Es löst selbst keine Pause aus.
- Abfrage-/Dateiantworten richten sich an die anfragende Gruppe. Ordnen Sie sie über `requestId` zu, prüfen Sie `error`/`ok` und setzen Sie mit Ticks eine Frist: Antworten können beim Schließen einer Seite, Neuladen der Engine oder Deaktivieren der Gruppe verloren gehen. Anfrage-IDs können sich nach Ausführen wiederholen; ausstehende Anfragen sind keine dauerhaft gespeicherten Aufgaben.

## Browseraktionen

Die ganzzahlige `tabId` muss aus einem Ereignis stammen. Seitenaktionen erfordern eine Seite, auf die Vault zugreifen darf; interne Browserseiten sind nicht verfügbar. Ungültige Eingaben/nicht verfügbare Ziele bewirken im Allgemeinen nichts.

- `v.item(tabId, ref, verdict)`: `"hide"` entfernt eine Feed-Karte, `"dim"` deckt ihre Medien ab, `"allow"` nimmt sie von niedrigeren Gruppen aus, `null` löscht die Entscheidung dieser Gruppe. Unbekannte Referenzen bewirken nichts; verwenden Sie `v.cover` für `isPage`. Entscheidungen folgen der Gruppenlistenreihenfolge: höheres hide gewinnt; höheres dim bleibt bei niedrigerem allow erhalten; allow verhindert niedrigere Entscheidungen. Eine wiederverwendete/entfernte Karte benötigt eine neue Entscheidung.
- `v.cover(tabId, on, message?)`: true deckt die Seite ab, false hebt ihre benutzerdefinierte Abdeckung auf; die Nachricht ist standardmäßig leer (maximal 500 Zeichen). Pro Seite gibt es einen Abdeckungsslot; der zuletzt angewendete Abdeckungsaufruf gewinnt unabhängig von der Gruppenreihenfolge. Adressänderungen heben ihn auf; gewöhnliche Blockierung kann die Seite weiterhin abdecken.
- `v.go(tabId, target)`: eine HTTP(S)-URL oder `"back"`, `"forward"`, `"reload"` (Ziel maximal 4096 Zeichen).
- `v.close(tabId)`: schließt den Tab.
- `v.css(tabIdOrStar, id, css)`: ganzzahlige Tab-ID oder `"*"`; ersetzt das Stylesheet der Gruppe mit dieser ID oder entfernt es mit null. Tab-Stylesheets enden bei Adressänderung; `"*"`-Stylesheets erreichen künftige Seiten. ID maximal 80, CSS maximal 100000 Zeichen.
- `v.dom(tabId, selector, op, arg?)`: CSS-Selektor (maximal 1000); alle Treffer, außer `scrollTo` verwendet den ersten. Operationen: `hide` setzt inline `display:none!important`; `show` entfernt die Inline-Anzeige; `click`; `setText` ersetzt Text durch `arg`; `addClass`/`removeClass` verwenden einen Klassennamen; `scrollTo` scrollt in die Ansicht. Argument maximal 2000. Änderungen bleiben bis zur ausdrücklichen Umkehr/Ersetzung der Seite bestehen.
- `v.query(tabId, selector)` → Anfrage-ID als Zeichenfolge oder null bei ungültigen Argumenten. Ergebnis ist ein späteres `query`-Ereignis: bis zu 50 Treffer, kleingeschriebenes `tag`, normalisierter Text ≤1000 Zeichen, Attribute ≤2000, Wert ≤1000. Keine Treffer ist erfolgreiches `[]`; ungültiges CSS ergibt `error: "invalid-selector"`. Eine Seite ohne Vault-Empfänger antwortet möglicherweise nie.

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

Standardwerte: Position unten rechts; vertikales Layout; linksbündig; Rolle region; Breite nach Inhalt. Breitenvorgaben sind 220/280/360px; numerische Panelbreite wird auf 180–520px begrenzt. Steuerelementbreite wird auf 32–520px, Höhe auf 20–360px begrenzt. Numerische Größen akzeptieren auch Pixelzeichenfolgen. Vertikale Varianten ändern Abstände; inline/row brechen nicht um; wrap/toolbar brechen um; twoColumn/grid/split/form verwenden Raster; stack minimiert Abstände. Die Rolle liefert Barrierefreiheitssemantik, keine modale Blockierung.

IDs werden auf ASCII-Buchstaben/-Ziffern/`_`/`-` normalisiert (maximal 80); wählen Sie eindeutige stabile IDs. Ohne Steuerelement-ID wird `control-N` verwendet, ohne/unbekanntem Typ text. Weggelassene Texte/Listen sind leer; disabled ist false. Der Aufruf von `v.panel` ersetzt die gesamte Spezifikation. Weggelassenes `value` verwendet den letzten Steuerelement-Ereigniswert und normalisiert anschließend den Typ; ein ausdrückliches `value` überschreibt ihn. Autofokus ist standardmäßig false. Unbekannte Felder werden verworfen; regeldefinierte Panel-Farben/Schriften/CSS werden nicht unterstützt.

Steuerelementfelder und Werte:

- `text`: Zeichenfolge `text`; standardmäßig Beschriftung. `html`: Zeichenfolge `html`; Skripte, Ereignisattribute, gefährliche URLs und Styling werden entfernt.
- `button`: `label`, optional `action: "submit" | "cancel" | "close"`; Wert ist eine Zeichenfolge (standardmäßig leer). Aktionen erzeugen Ereignisse; sie senden/schließen nichts automatisch.
- `checkbox`, `toggle`: boolesches `value` (standardmäßig false).
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; Zeichenfolgenwert (standardmäßig leer). Leere Optionswerte werden entfernt; Beschriftungen entsprechen standardmäßig dem Wert.
- `textInput`, `textarea`: Zeichenfolgenwert (standardmäßig leer), `placeholder`; textarea `rows` 1–12 (standardmäßig 3).
- `numberInput`, `range`: numerischer Wert (standardmäßig 0), `min`, `max`, positives `step`. Werte werden auf Grenzen begrenzt; nicht angegebene Normalisierungsgrenzen sind −1000000…1000000. Range-Steuerelemente verwenden standardmäßig 0…100; setzen Sie ausdrückliche Grenzen.
- `date`: Zeichenfolge `YYYY-MM-DD`; `time`: Zeichenfolge `HH:MM` oder `HH:MM:SS`; ungültige Anfangsformate werden leer. `color`: `#RRGGBB` (standardmäßig `#000000`).
- `pin`: Ziffernzeichenfolge; `length` 3–12 (standardmäßig 6), `masked` standardmäßig true, `autoSubmit` false. `section`: `text`, `controls`, optional layout/align/role (Rolle standardmäßig group); untergeordnete Abschnitte bei Tiefe 3 haben keine Kinder (Wurzel-Steuerelemente Tiefe 0).

Panelereignisse: Eingabesteuerelemente senden `input`/`change` (Texteingabe ändert sich beim Fokusverlust/Enter; textarea beim Fokusverlust/Strg-oder-Cmd+Enter). Gewöhnliche Steuerelemente senden auch `focus`, `blur`, `key`; Tastenmetadaten werden nicht an die Regel weitergegeben. Schaltflächen senden `click` **und** ihre konfigurierte Aktion als getrennte Ereignisse—behandeln Sie eines. PIN sendet `change` und zusätzlich `submit`, wenn autoSubmit sie vollständig ausfüllt. Ein-/Aushängen verwendet `controlId: ""`, `value: true`. `values` enthält aktuelle Eingabewerte nach ID; Schaltflächen/Text/HTML sind ausgeschlossen. Ereignisse haben keine Herkunfts-Tab-ID; verwenden Sie getrennte Panel-IDs für tabspezifische Interaktionen.

Textlimits: title/label/ariaLabel 240; description/text 1000; HTML 20000; placeholder 500; Eingabetext 2000; andere Wertezeichenfolgen 512; Optionswert/-beschriftung 256. Überschreitungen werden abgeschnitten.

## Dateien

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`. Erfordert **Ordner für benutzerdefinierte Regeln** in den Einstellungen und dessen Berechtigung. Safari verwendet seine native Ordnerauswahl und eine gespeicherte sicherheitsbezogene Zugriffserlaubnis; nur der gewählte Ordner ist verfügbar.

- `path` ist relativ; `/` trennt Verzeichnisse. Segmente erlauben ASCII-Buchstaben/-Ziffern, Leerzeichen und `_.,@()-`; keinen führenden Punkt, `.`/`..`, absoluten Pfad oder URL. Dateiendungen: `.txt`, `.csv`, `.json` (Groß-/Kleinschreibung egal). Der List-Pfad ist ein Verzeichnis; `""` listet die gewählte Wurzel auf.
- Read liefert UTF-8-Text. Write ersetzt/erstellt; append erstellt/hängt ohne automatische neue Zeile an. Schreibvorgänge erstellen übergeordnete Verzeichnisse. Zeichenfolgen-Nutzdaten werden unverändert geschrieben; andere JSON-Nutzdaten werden serialisiert; null/weggelassen bedeutet leeren Text. JSON/CSV zu parsen ist Aufgabe der Regel. Maximale Dateigröße: 1048576 UTF-8-Bytes.
- List liefert direkt enthaltene sichtbare Unterverzeichnisse und unterstützte Dateien. Einträge: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; extension enthält bei Dateien den Punkt. Exists liefert für einen unterstützten Dateipfad einen booleschen Wert.

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

Ungenutzte Ergebnisfelder sind null; bei Erfolg ist error leer. Fehler umfassen invalid-path, unsupported-file-type, nicht verfügbare Berechtigung/Ordner, fehlende Datei und file-too-large. Behandeln Sie error als Zeichenfolge, nicht als festes vollständiges Enum. Anfragen haben keine Transaktions-/Reihenfolgegarantie; führen Sie Lesen-Ändern-Schreiben-Vorgänge pro Pfad nacheinander aus.

## Grenzen

Pro Ereignis und Gruppe: 256 eingereihte Aktionen, 200 Log-Aufrufe, 64 Emits; Überschreitungen werden verworfen. Pro Regel: 1000 Handler, 24 Panels; jede Steuerelementliste hat 32 Einträge und jede Auswahl 64 Optionen; Überschreitungen werden ignoriert/abgeschnitten. Emit-Ketten stoppen nach 16 Generationen. Limit des serialisierten Zustands: 65536 UTF-8-Bytes. Halten Sie die Registrierung und die kombinierten Handler jedes Ereignisses unter 1 Sekunde; wiederholte Überschreitungen oder ein harter Timeout stoppen die Gruppe bis zum Ausführen. Das Log behält 200 Einträge, akzeptiert 50/Sekunde pro Gruppe und schneidet lange Nachrichten bei etwa 4096 Zeichen ab. Timer/Antworten erfolgen nach bestem Bemühen, ohne Echtzeitgarantie.

## Vollständige Regel

Eine fünfminütige Pause, ausgelöst durch Aufschieben oder die Schaltfläche ihres Panels:

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


## KI-Aufrufe aus einer laufenden Regel

Jede benutzerdefinierte Gruppe wählt unter **AI calls** eine Verbindung/ein Modell und Reasoning effort. Mac- und Browserregeln verwenden dieselbe API. Browseranfragen benötigen ein verbundenes Mac Vault; Anbieterdaten bleiben dort. Verknüpfte Gruppen teilen Auswahl und optionales Tageslimit. Leer bedeutet kein Gruppenlimit; Kontolimits gelten weiter. Das Limit gilt pro UTC-Tag, bleibt nach Neustart bestehen und zählt gesendete Versuche einschließlich Fehlern. Verknüpfen addiert bisherigen Verbrauch; Trennen behält ihn.

Gespeicherter Prompt und Kontext werden von verknüpften Gruppen geteilt und stehen Handlern als `v.context.ai.prompt` und `v.context.ai.context` zur Verfügung. Vault sendet sie nicht automatisch; die Regel wählt aus, was jeder `v.ai`-Aufruf enthält.

`v.ai({ prompt, input? })` liefert sofort eine Request-ID. Innerhalb eines Handlers aufrufen, nicht bei der Registrierung. `input` kann jeder JSON-Wert sein; prompt und input sind je auf20KB begrenzt. Antworten kommen als `ai` events: `. Success text is at most48KB; citations are ` `ask` `note`-Events: {requestId, ok, text, citations, error}. Erfolgstext höchstens48KB; Zitate {url,title}. Bei Websuche sichtbare, anklickbare Quellenlinks beibehalten. Suche ist für das Modell immer verfügbar. Keine feste App-Frist, begrenzte Gleichzeitigkeit, kein Provider-Fallback und keine automatische Wiederholung. Antworten sind Daten und werden nicht als JavaScript ausgeführt; die Regel entscheidet über bestehende Aktionen.

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

Offene Aufrufe werden nach Neustart nicht wiederholt. Run, Deaktivieren/Aktivieren und Löschen verwerfen alte Antworten; ein getrennter Browser meldet `ai-unavailable`. Weitere Fehler: `ai-not-configured`, `ai-invalid-input`, `ai-busy`, `ai-daily-limit`, `ai-request-failed`, `ai-usage-storage-unavailable`. Fehlgeschlagene Aufrufe überschreiben kein vorheriges, von der Regel behaltenes Ergebnis. Zustandslimit bleibt64KB.

Anmeldedatenfreie Optionen: Mac `rule_ai_models`, Browser `settings-rule-ai-models`. `ruleAI` über den vorhandenen set-group-Pfad konfigurieren. Felder: `providerModel`, `accountID`, `reasoningEffort` (`default`, `low`, `medium`, `high`), `dailyRequestLimit` (null oder1–100000). Eine zurückgegebene Auswahl nutzen; keinen Schlüssel oder Anbieter-URL in den Regelquelltext schreiben.
Die optional gespeicherten Felder heißen `prompt` und `context`; beide sind Zeichenfolgen bis 16KB.

## Gruppen-Datensätze

`v.store(request)` startet in einem Handler einen asynchronen JSON-Datensatzvorgang. Datensätze sind gruppenintern, bleiben über Run und Neustart erhalten und werden mit der Gruppe gelöscht. Verknüpfte Gruppen haben getrennte Datensätze. Schlüssel, Werte, Versionen, Cache-Invalidierung und Vorrang von Rückmeldungen bestimmt die Regel. Mac- und Browserregeln verwenden dieselbe API, aber getrennte Speicher je App/Browser.

| Anfrage | Ergebnis |
|---|---|
| `{op:"get", key}` | `record` oder `null` |
| `{op:"put", key, value, version?, ifRevision?}` | gespeicherter `record` |
| `{op:"delete", key, ifRevision?}` | `record: null` |
| `{op:"list", prefix?, after?, limit?}` | sortierte `entries` und `next` |
| `{op:"clear", prefix?}` | Anzahl `deleted` |

Ein Datensatz hat `{value, revision, version, updatedAt}`. Die opake revision ändert sich bei echtem Schreiben; `version` sind vom Aufrufer verwaltete Metadaten. `list` gibt Header ohne Werte zurück; `get` liest einen Datensatz, `after: next` `put` `delete` lädt die nächste Seite. Ohne `ifRevision` sind put/delete unbedingt; `null` verlangt einen fehlenden Schlüssel, eine Revisionszeichenfolge exakte Übereinstimmung. Bei Konflikt kommen `ok:false`, `error:"store-conflict"` und der aktuelle `record` zurück. So überschreibt eine verspätete automatische Antwort keine Benutzerrückmeldung. `v.context.revision` ist eine opake Konfigurationsmarke, die eine Regel in ihre Version aufnehmen kann. Das Framework gibt keine Cache-Regel vor.

Grenzen: Schlüssel 1–2048 Zeichen, Version ≤128, JSON-Wert ≤64KiB, Tiefe ≤32, 10000 Schlüssel je Gruppe, gesamtes Dokument 16MiB. `list` höchstens100 Header und96KiB je Seite. Maximal32 Anfragen je Gruppe und128 Starts pro Sekunde insgesamt; Überlast meldet einmal pro Gruppe/Sekunde `store-busy` und verwirft weitere Anfragen. Speicherfehler liefern `ok:false`; zukünftige/fehlerhafte Dokumente bleiben erhalten und melden `store-unavailable`. Keine automatische Wiederholung oder Bereinigung; Fristen mit ticks setzen.

## Gespeicherte Inhaltsanhänge

`v.attach(tabId, item, id, spec)` speichert für ein beobachtetes Inhaltselement eine Markierung oder eine passive HTML/CSS-Ansicht. Übergeben Sie das vollständige `item` aus einem `items`- oder `attachment`-Ereignis; ein bloßes `ref` ist kein Anhang-Handle. `contentId` bezeichnet den gespeicherten Inhalt, `instanceId` sein aktuelles Auftreten. Behalten Sie das ursprüngliche Handle, während Sie auf AI warten. Für entfernte, wiederverwendete oder navigierte Ziele wird ein verspäteter Anhang abgelehnt. `v.item(tabId, ref, verdict)` bleibt davon unabhängig.

Eine Markierung nutzt `spec` als `{type:"pill", text, tone?, tooltip?}`; zulässige Töne sind `blue`, `cyan`, `gold`, `pink` und `red`. Klartext umfasst höchstens 240 Zeichen, der Tooltip 1000. Für eine Ansicht verwenden Sie spec als `{type:"html", html, css?, label?}`. Grenzen: HTML 32000, CSS 16000, label 200 Zeichen. Die Ansicht wird aus erlaubtem passivem HTML/SVG in einer geschlossenen Shadow-Root mit begrenztem CSS neu aufgebaut. Skripte, Ereignisattribute, externe Ressourcen, Einbettungen und unsicheres CSS werden entfernt. Die Ansicht bleibt in der Inhaltskarte und scrollt ab 480px Höhe. IDs enthalten 1–80 ASCII-Buchstaben/Ziffern, _ oder -. Ein null-spec entfernt die Markierung der Gruppe. Rufen Sie die Funktion in einem Handler auf; Speicher- und Zustellfehler erscheinen im Log und werden nicht automatisch wiederholt.

Jedes Element stellt die gespeicherten Anhänge dieser Gruppe als schreibgeschützten Snapshot in `item.attachments` bereit; Anhänge anderer Gruppen sind dort nicht enthalten. Sind gespeicherte Daten nicht verfügbar, ist `attachments` null und `attachmentError` gesetzt; das bedeutet nicht, dass der Cache leer ist. Andere Handler laufen weiter. Verwenden Sie das Beispiel, um AI für Inhalte mit gespeichertem Ergebnis nicht erneut anzufragen.

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

Pointer-, Enter- und Space-Aktivierung erzeugen für die Gruppe ein `attachment`-Ereignis. Markierungen senden `click`. Ansichts-Steuerelemente verwenden `data-control` oder `id` als `controlId` und senden `click`, `input` oder `change` mit aktuellem `value` und begrenzten `values` benannter Felder. Echte UI-Ereignisse haben `ev.origin === "user"`, regelgenerierte `origin === "rule"`. Die Ereignisse enthalten `tabId`, `attachmentId` und das aktuelle `item`. Die Ansicht führt keinen Regelcode aus; beide Ansichtsarten verhindern, dass ihre Bedienung die zugrunde liegende Karte navigiert. Gespeicherte Daten enthalten weder Callback noch ausführbaren Code. Eine veraltete Pill-Revision kann keinen aktuellen Anhang aufrufen. Regel-Emit-Ereignisse bleiben normale Regel-Logik; echte UI-Klicknachrichten prüft der Browser separat.

Anhänge werden im Browserprofil je Gruppe/Inhalt/ID gespeichert und erscheinen bei späteren Vorkommen, Navigation, Browserneustart und Run erneut. Disable blendet sie aus, behält aber die Daten; Enable stellt sie wieder her. Beim Löschen der Gruppe werden ihre Anhänge entfernt. Verknüpfte Gruppen bleiben getrennt; es gibt keine automatische Synchronisierung zwischen Browsern oder Geräten. Bekannte Inhalte von YouTube, Reddit, X und Bilibili verwenden Plattform-IDs. Für andere Inhalte wird eine vorsichtig normalisierte URL verwendet; die Verfügbarkeit hängt daher vom unterstützten Seitenmarkup ab.

Grenzen: 8 Anhänge pro Gruppe/Inhalt, 32 je Inhalt über alle Gruppen, 10000 Inhaltseinträge pro Gruppe und 8MB für das serialisierte Anhangdokument. Bei Erreichen einer Grenze wird die neue Änderung mit `attachment-item-limit` oder `attachment-storage-limit` im Log abgelehnt; vorhandene Daten bleiben erhalten. Ein Dispatch bündelt Schreibvorgänge; identische spec-Werte schreiben den Speicher nicht erneut. Anhänge sind Browser-Inhaltsoberfläche, auch in Safaris nativer Regel-Engine. Mac-App-Regeln haben keine Browser-Inhalts-Handles oder In-App-Anhangoberfläche.

`code-manual/generic-example.js` ist ein ausführbares Policy-Beispiel. Es verwendet Datensätze, AI-Aufrufe, Feedback mit Benutzerursprung, Compare-and-Swap, HTML-Steuerelemente, Inhaltsentscheidungen und einen regelgesteuerten Nutzungsbericht. Diese Funktionen stammen aus dem Beispielcode und sind keine besonderen Eigenschaften des Datensatz- oder Anhangspeichers.
