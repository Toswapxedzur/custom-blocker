# Podręcznik kodu rozszerzenia przeglądarki Vault

[Podręcznik użytkownika](../manual/pl.md)

## Zasady działania reguły

Source: jedno wyrażenie funkcji `(on, v) => { ... }`. Obsługiwane są tylko synchroniczne JavaScript i poniższe API; bez timers, network, extension APIs i bezpośredniego dostępu do DOM. Reguły czasowe używają `ev.now` i events.

- Edycja zapisuje wersję roboczą; **Run** aktywuje ją i włącza grupę. Zamrożonych grup nie można uruchomić przyciskiem Run. Puste source wyładowuje regułę.
- Udane Run zastępuje handlers i panels, zachowując `v.state`. Błąd kompilacji/rejestracji pozostawia poprzednią regułę; timeout może ją zatrzymać. Po ponownym załadowaniu silnika rejestrowany jest ostatni aktywowany source; closure variables są resetowane.
- Rejestracja może zainicjować state, zarejestrować handlers, wyświetlić panels i zapisać log. Akcje strony/pliku i emits należą do handlers; kolejka rejestracji jest odrzucana.
- Disable wstrzymuje handlers i usuwa zarządzane panels, sheets, covers oraz werdykty elementów. Enable przywraca zachowane panels/sheets i ponownie wysyła żądania dotyczące elementów. Run nie czyści istniejących sheets, covers ani werdyktów. Delete usuwa regułę, state i skutki. Nawigacja, zmiany DOM i zapisy plików nie są cofane.
- Events nie są ograniczone zwykłymi celami grupy; filtruj URLs/items w regule. Actions trafiają do kolejki i są stosowane po dispatch. Wyjątek zatrzymuje dany handler, ale nie cofa jego state/actions; kolejne handlers mogą działać. Potwierdzenia nie ma poza events file/query.

## Wspólne API

- `on(type, handler)` → boolean. Rejestruje `handler(ev)`; wiele handlers działa w kolejności rejestracji. False oznacza nieprawidłowe argumenty lub osiągnięcie limitu handlers. `ev = { type: string, now: number, data }`; `now` to milisekundy Unix.
- `v.state`: modyfikowalny obiekt JSON, zapisywany po event dispatch. Inicjalizuj brakujące fields zamiast nadpisywać istniejący state. Przypisanie non-object lub tablicy resetuje go do `{}`; aktualizacje niepodlegające serializacji lub zbyt duże nie są zapisywane.
- `v.log(...values)`: jedyne źródło wpisów do Log tej grupy. Logs/Clear są niezależne dla grup. Błędy ładowania pojawiają się w statusie Run; diagnostyka handlerów nie trafia do Log.
- `v.emit(type, data)`: umieszcza kopię JSON `data` w kolejce handlers tej grupy po bieżącym evencie, ze świeżym `now`; to nie jest wywołanie synchroniczne.
- `v.panel(id, spec, tabId?)`: zastępuje nazwany panel grupy; pomiń `tabId` dla wszystkich dostępnych stron internetowych albo użyj całkowitego tab ID. Null `spec` usuwa panel. Zobacz Panels.
- `v.file(op, path, payload?)` → string request ID. Zobacz Files.

Pozostałe wspólne wywołania zwracają `undefined`. IDs/state należą do grupy, nie do jej nazwy wyświetlanej.

## Browser events

Notacja payload opisuje typy, nie kod wykonywalny. `?` oznacza opcjonalne fields.

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

- `tick` jest przybliżony; używaj timestamps, nie liczby ticków. `active` oznacza stronę wybraną w oknie przeglądarki, nie dowodzi, że użytkownik na nią patrzy. URLs mogą być puste/ograniczone.
- `visible` pochodzi z dostępnych, nieukrytych stron; `elapsedMs` to czas od ostatniego heartbeat i wynosi zero, gdy strona jest zasłonięta. To nie jest skumulowane użycie ani czas odtwarzania.
- `items` zgłasza nowe/zmienione obsługiwane elementy feedu i wysyła je ponownie po Run/wznowieniu. `ref` identyfikuje kartę na tej stronie, nie trwały content ID; `ref === "page"` oznacza samą stronę. Tytuły/URLs/autorzy mogą być puste. `authors` zawiera source identifiers właściwe dla platformy.
- Platform IDs: `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. Dostępność elementów zależy od obsługiwanego markup strony.
- Tagi wymagają połączonego desktopowego Classifier i build/platformy z włączonym tagowaniem (Chromium i Safari: YouTube, Reddit, Bilibili, X/`twitter`). Confidence wynosi 1–5. `tagsSettled === false` oznacza oczekiwanie/brak dostępności, a nie brak tagów; `tags: []` po settled oznacza brak tagów.
- `snooze` oznacza naciśnięcie przycisku Snooze grupy. Samo w sobie nie powoduje pauzy.
- Odpowiedzi query/file trafiają do grupy żądającej. Dopasuj `requestId`, sprawdź `error`/`ok` i ustal deadline za pomocą ticks: odpowiedzi mogą zaginąć po zamknięciu strony, przeładowaniu engine lub wyłączeniu grupy. Request IDs mogą się powtarzać po Run; oczekujące requests nie są trwałą pracą.

## Browser actions

Całkowite `tabId` musi pochodzić z event. Page actions wymagają strony dostępnej dla Vault; wewnętrzne strony przeglądarki są niedostępne. Nieprawidłowe dane/niedostępne cele zwykle nie dają efektu.

- `v.item(tabId, ref, verdict)`: `"hide"` usuwa kartę feedu, `"dim"` zasłania media, `"allow"` zwalnia z niższych grup, `null` usuwa werdykt tej grupy. Nieznane refs nic nie robią; użyj `v.cover` dla `isPage`. Werdykty podlegają kolejności grup: wyższy hide wygrywa; wyższy dim utrzymuje się mimo niższego allow; allow blokuje niższe werdykty. Ponownie użyta/usunięta karta wymaga nowej decyzji.
- `v.cover(tabId, on, message?)`: true zasłania stronę, false usuwa własną osłonę; message domyślnie pusty (maks. 500 znaków). Jedno custom-cover slot na stronę; wygrywa ostatnie zastosowane wywołanie cover, niezależnie od kolejności grup. Zmiana adresu usuwa osłonę; zwykłe blokowanie nadal może zasłonić stronę.
- `v.go(tabId, target)`: URL HTTP(S) lub `"back"`, `"forward"`, `"reload"` (target maks. 4096 znaków).
- `v.close(tabId)`: zamyka tab.
- `v.css(tabIdOrStar, id, css)`: całkowite tab ID lub `"*"`; zastępuje arkusz grupy o danym ID albo usuwa go wartością null. Tab sheets kończą się przy zmianie adresu; sheets `"*"` obejmują przyszłe strony. ID maks. 80, CSS maks. 100000 znaków.
- `v.dom(tabId, selector, op, arg?)`: CSS selector (maks. 1000); wszystkie dopasowania oprócz `scrollTo`, które używa pierwszego. Ops: `hide` ustawia inline `display:none!important`; `show` usuwa inline display; `click`; `setText` zastępuje tekst przez `arg`; `addClass`/`removeClass` używają jednej class name; `scrollTo` przewija do widoku. Arg maks. 2000. Zmiany pozostają do jawnego cofnięcia/zastąpienia strony.
- `v.query(tabId, selector)` → string request ID albo null dla błędnych argumentów. Wynikiem jest późniejszy `query` event: do 50 matches, małe `tag`, normalized text ≤1000 znaków, attributes ≤2000, value ≤1000. Brak dopasowań to udane `[]`; błędny CSS daje `error: "invalid-selector"`. Strona bez receivera Vault może nie odpowiedzieć.

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

Domyślnie: pozycja prawy dół; układ pionowy; wyrównanie do lewej; role region; szerokość dopasowana do treści. Presety szerokości to 220/280/360px; szerokość liczbowa panelu ograniczona do 180–520px. Szerokość control ograniczona do 32–520px, wysokość do 20–360px. Rozmiary liczbowe przyjmują również pixel strings. Warianty pionowe zmieniają odstępy; inline/row nie zawijają; wrap/toolbar zawijają; twoColumn/grid/split/form używają siatek; stack minimalizuje odstępy. Role zapewnia semantykę dostępności, nie blokowanie modalne.

IDs są normalizowane do ASCII letters/digits/`_`/`-` (maks. 80); wybieraj unikalne, stabilne IDs. Pominięte control ID staje się `control-N`; pominięty/nieznany type staje się text. Pominięte text/lists są puste; disabled to false. Wywołanie `v.panel` zastępuje całą spec. Pominięte `value` używa ostatniej wartości event control, a następnie normalizacji typu; jawne `value` ją nadpisuje. Autofocus domyślnie false. Nieznane fields są odrzucane; kolory/fonts/CSS panelu z reguły nie są obsługiwane.

Pola i wartości control:

- `text`: string `text`; domyślnie label. `html`: string `html`; usuwa scripts, event attributes, niebezpieczne URLs i style.
- `button`: `label`, opcjonalne `action: "submit" | "cancel" | "close"`; value jest stringiem (domyślnie pustym). Actions wysyłają events; niczego same nie wysyłają ani nie zamykają.
- `checkbox`, `toggle`: boolean `value` (domyślnie false).
- `select`, `radio`: `options: (string | { value: string, label?: string })[]`; string value (domyślnie pusty). Puste option values są usuwane; labels domyślnie równe value.
- `textInput`, `textarea`: string value (domyślnie pusty), `placeholder`; textarea `rows` 1–12 (domyślnie 3).
- `numberInput`, `range`: numeric value (domyślnie 0), `min`, `max`, dodatni `step`. Values są ograniczane; nieokreślone bounds normalizacji to −1000000…1000000. Range domyślnie 0…100; ustaw jawne bounds.
- `date`: string `YYYY-MM-DD`; `time`: string `HH:MM` lub `HH:MM:SS`; nieprawidłowe wartości początkowe są puste. `color`: `#RRGGBB` (domyślnie `#000000`).
- `pin`: ciąg cyfr; `length` 3–12 (domyślnie 6), `masked` domyślnie true, `autoSubmit` false. `section`: `text`, `controls`, opcjonalne layout/align/role (role domyślnie group); child sections na depth 3 nie mają children (root controls depth 0).

Panel events: input controls wysyłają `input`/`change` (text input zmienia się przy blur/Enter; textarea przy blur/Ctrl-or-Cmd+Enter). Zwykłe controls wysyłają również `focus`, `blur`, `key`; metadane key nie są przekazywane regule. Buttons wysyłają `click` **i** skonfigurowane action jako osobne events — obsłuż jeden. PIN wysyła `change` oraz `submit`, gdy autoSubmit jest pełny. Mount/unmount używa `controlId: ""`, `value: true`. `values` zawiera bieżące input values wg ID; nie obejmuje buttons/text/HTML. Events nie mają źródłowego tab ID; używaj osobnych panel IDs dla interakcji danego taba.

Limity tekstu: title/label/ariaLabel 240; description/text 1000; HTML 20000; placeholder 500; input text 2000; inne value strings 512; option value/label 256. Nadmiar jest obcinany.

## Files

`op`: `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`. Wymaga **Folderu reguł niestandardowych** w Settings i uprawnienia. Safari korzysta z natywnego selektora folderów oraz zachowanego security-scoped grant; dostępny jest tylko wybrany folder.

- `path` jest względny; `/` oddziela directories. Segmenty dopuszczają ASCII letters/digits, spacje i `_.,@()-`; bez początkowej kropki, `.`/`..`, absolute path czy URL. Rozszerzenia plików: `.txt`, `.csv`, `.json` (bez rozróżniania wielkości liter). List path to directory; `""` wyświetla wybrany root. Ścieżki wychodzące poza wybrany folder, także przez symlinks, są odrzucane.
- Read zwraca tekst UTF-8. Write zastępuje/tworzy; append tworzy/dopisuje bez automatycznego newline. Katalogi nadrzędne są tworzone przy zapisie. String payload jest zapisywany dosłownie; inne JSON payloads są serializowane; null/pominięcie oznacza pusty tekst. Parsowanie JSON/CSV należy do reguły. Maksymalny rozmiar pliku: 1048576 UTF-8 bytes.
- List zwraca bezpośrednio widoczne podkatalogi i obsługiwane pliki. Entries: `{ name: string, path: string, kind: "directory" | "file", extension?: string }`; extension pliku zawiera kropkę. Exists zwraca boolean dla obsługiwanego file path.

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

Nieużywane result fields są null; sukces ma pusty error. Błędy obejmują invalid-path, unsupported-file-type, permission/folder unavailable, missing file i file-too-large. Traktuj error jako string, nie ustalony, wyczerpujący enum. Requests nie gwarantują transakcji/kolejności; serializuj operacje read-modify-write dla każdej ścieżki.

## Limity

Na event na group: 256 queued actions, 200 log calls, 64 emits; nadmiar jest odrzucany. Na rule: 1000 handlers, 24 panels; każda control list ma 32 entries, a każdy choice 64 options; nadmiar jest ignorowany/obcinany. Emit chains kończą się po 16 generacjach. Serialized state limit: 65536 JavaScript string characters. Utrzymuj rejestrację i łączne handlers każdego event poniżej 1 sekundy; powtarzające się przekroczenia lub hard timeout zatrzymują group do Run. Log przechowuje 200 entries, przyjmuje 50/sec na group i obcina długie wiadomości w pobliżu 4096 znaków. Timers/replies są best-effort, bez gwarancji real-time.

## Pełna reguła

Pięciominutowa pauza uruchamiana przez Snooze lub jego panel button:

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
