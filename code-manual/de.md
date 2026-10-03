# Codehandbuch der Vault-Browsererweiterung

[Benutzerhandbuch](../manual/de.md)

## Regelvertrag

Quelle: ein einzelner Funktionsausdruck `(on, v) => { ... }`. Unterstützt werden ausschließlich synchrones JavaScript und die unten beschriebene API; keine Timer, Netzwerkzugriffe, Erweiterungs-APIs oder direkten DOM-Zugriffe. Zeitabhängige Regeln verwenden `ev.now` und Ereignisse.

- Bearbeiten speichert einen Entwurf; **Ausführen** aktiviert ihn und die Gruppe. Eingefrorene Gruppen können nicht ausgeführt werden. Leerer Quelltext entlädt die Regel.
- Erfolgreiches Ausführen ersetzt Handler und Panels und erhält `v.state`. Bei einem Kompilierungs-/Registrierungsfehler bleibt die vorherige Regel erhalten; ein Timeout kann sie stoppen. Das Neuladen der Engine registriert den zuletzt aktivierten Quelltext erneut; Closure-Variablen werden zurückgesetzt.
- Die Registrierung darf Zustand initialisieren, Handler registrieren, Panels anzeigen und protokollieren. Seiten-/Dateiaktionen und Emits gehören in Handler; ihre während der Registrierung angelegte Warteschlange wird verworfen.
- Deaktivieren unterdrückt Handler und hebt verwaltete Panels, Stylesheets, Abdeckungen und Elemententscheidungen auf. Aktivieren stellt erhaltene Panels/Stylesheets wieder her und fordert Elemente erneut an. Ausführen löscht bestehende Stylesheets, Abdeckungen oder Elemententscheidungen nicht. Löschen entfernt die Regel sowie ihren Zustand und ihre Wirkungen. Navigation, DOM-Änderungen und Dateischreibvorgänge werden nicht rückgängig gemacht.
- Ereignisse sind nicht auf gewöhnliche Gruppenziele beschränkt; filtern Sie URLs/Elemente in der Regel. Aktionen werden eingereiht und anschließend nach der Ereignisverteilung angewendet. Ausnahmen stoppen den betreffenden Handler, ohne seinen Zustand/seine Aktionen zurückzusetzen; spätere Handler können weiterlaufen. Außer Datei-/Abfrageereignissen gibt es keine Aktionsbestätigung.

## Gemeinsame API

- `on(type, handler)` → boolescher Wert. Registriert `handler(ev)`; mehrere Handler laufen in Registrierungsreihenfolge. False bedeutet ungültige Argumente oder erreichtes Handlerlimit. `ev = { type: string, now: number, data }`; `now` sind Unix-Millisekunden.
- `v.state`: veränderliches JSON-Objekt, das nach der Ereignisverteilung gespeichert wird. Initialisieren Sie fehlende Felder, statt bestehenden Zustand zu überschreiben. Das Zuweisen eines Nicht-Objekts oder Arrays setzt es auf `{}` zurück; nicht serialisierbare/zu große Änderungen werden nicht gespeichert.
- `v.log(...values)`: einziger Erzeuger des Protokolls dieser Gruppe. Protokolle/Leeren sind pro Gruppe unabhängig. Ladefehler erscheinen im Ausführungsstatus; Handlerdiagnosen füllen das Protokoll nicht.
- `v.emit(type, data)`: stellt eine JSON-Kopie von `data` nach dem aktuellen Ereignis für die Handler dieser Gruppe mit einem neuen `now` in die Warteschlange; kein synchroner Aufruf.
- `v.panel(id, spec, tabId?)`: ersetzt das benannte Panel dieser Gruppe; lassen Sie `tabId` für alle zugänglichen Webseiten weg oder verwenden Sie eine ganzzahlige Tab-ID. Null als `spec` entfernt es. Siehe Panels.
- `v.file(op, path, payload?)` → Anfrage-ID als Zeichenfolge. Siehe Dateien.

Andere gemeinsame Aufrufe geben `undefined` zurück. IDs/Zustand gehören zu einer Gruppe, nicht zu ihrem Anzeigenamen.

## Browserereignisse

Die folgende Nutzdatennotation beschreibt Typen; sie ist kein ausführbarer Code. `?` kennzeichnet optionale Felder.

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

- `tick` ist näherungsweise; verwenden Sie Zeitstempel statt Tick-Zähler. `active` bedeutet innerhalb eines Browserfensters ausgewählt und beweist nicht, dass der Nutzer darauf schaut. URLs können leer/eingeschränkt sein.
- `visible` stammt von zugänglichen, nicht verborgenen Seiten; `elapsedMs` ist die Zeit seit deren letztem Heartbeat, bei Abdeckung null. Es ist keine aufsummierte Nutzungs- oder Wiedergabezeit.
- `items` meldet neue/geänderte unterstützte Feed-Elemente und sendet sie nach Ausführen/erneutem Aktivieren erneut. `ref` identifiziert eine Karte auf dieser Seite, keine dauerhafte Inhalts-ID; `ref === "page"` bezeichnet die Seite selbst. Leere Titel/URLs/Autoren sind möglich. `authors` enthält plattformspezifische Quellkennungen.
- Plattform-IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. Die Verfügbarkeit von Elementen hängt vom unterstützten Markup der Seite ab.
- Tags erfordern die verbundene Desktop-Klassifizierung und einen Build/eine Plattform mit aktivierter Tag-Zuweisung (Chromium und Safari: YouTube, Reddit, Bilibili, X/`twitter`). Die Konfidenz reicht von 1–5. `tagsSettled === false` bedeutet ausstehend/nicht verfügbar, nicht ohne Tags; abgeschlossenes `tags: []` bedeutet ohne Tags. Firefox-Builds bieten diese Tag-Integration nicht.
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

Pro Ereignis und Gruppe: 256 eingereihte Aktionen, 200 Protokollaufrufe, 64 Emits; Überschreitungen werden verworfen. Pro Regel: 1000 Handler, 24 Panels; jede Steuerelementliste hat 32 Einträge und jede Auswahl 64 Optionen; Überschreitungen werden ignoriert/abgeschnitten. Emit-Ketten stoppen nach 16 Generationen. Limit serialisierten Zustands: 65536 JavaScript-Zeichenfolgenzeichen. Halten Sie Registrierung und die kombinierten Handler jedes Ereignisses unter 1 Sekunde; wiederholte Überschreitungen oder ein harter Timeout stoppen die Gruppe bis zum Ausführen. Das Protokoll behält 200 Einträge, akzeptiert 50/Sekunde pro Gruppe und schneidet lange Nachrichten nahe 4096 Zeichen ab. Timer/Antworten sind bestmöglich, keine Echtzeitgarantien.

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
