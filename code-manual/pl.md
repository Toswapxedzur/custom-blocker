# Podręcznik kodu rozszerzenia przeglądarki Vault

[Podręcznik użytkownika](../manual/pl.md)

## Zasady działania reguły

Source: jedno wyrażenie funkcji `(on, v) => { ... }`. Obsługiwane są tylko synchroniczny JavaScript i poniższe API; bez wywołań zwrotnych harmonogramu JavaScript, sieci, API rozszerzeń i bezpośredniego dostępu do DOM. Reguły czasowe używają opisanych poniżej zarządzanych timerów/liczników lub `ev.now` i zdarzeń.

- Edycja zapisuje wersję roboczą; **Run** aktywuje ją i włącza grupę. Zamrożonych grup nie można uruchomić przyciskiem Run. Puste source wyładowuje regułę.
- Udane Run zastępuje handlers i panels, zachowując `v.state`. Błąd kompilacji/rejestracji pozostawia poprzednią regułę; timeout może ją zatrzymać. Po ponownym załadowaniu silnika rejestrowany jest ostatni aktywowany source; closure variables są resetowane.
- Rejestracja może zainicjować state, zarejestrować handlers, wyświetlić panels i zapisać log. Akcje strony/pliku i emits należą do handlers; kolejka rejestracji jest odrzucana.
- Disable wstrzymuje handlers i usuwa zarządzane panels, sheets, covers oraz werdykty elementów. Enable przywraca zachowane panels/sheets i ponownie wysyła żądania dotyczące elementów. Run nie czyści istniejących sheets, covers ani werdyktów. Delete usuwa regułę, state i skutki. Nawigacja, zmiany DOM i zapisy plików nie są cofane.
- Events nie są ograniczone zwykłymi celami grupy; filtruj URLs/items w regule. Actions trafiają do kolejki i są stosowane po dispatch. Wyjątek zatrzymuje dany handler, ale nie cofa jego state/actions; kolejne handlers mogą działać. Potwierdzenia nie ma poza events file/query.

## Wspólne API

- `on(type, handler)` → boolean. Rejestruje `handler(ev)`; wiele handlers działa w kolejności rejestracji. False oznacza nieprawidłowe argumenty lub osiągnięcie limitu handlers. `ev = { type: string, now: number, origin: "host" | "user" | "rule", data }`; `now` to milisekundy Unix. Rzeczywiste zdarzenia widocznych kontrolek mają `origin: "user"`; zdarzenia `v.emit` mają `origin: "rule"`.
- `v.state`: modyfikowalny obiekt JSON, zapisywany po event dispatch. Inicjalizuj brakujące fields zamiast nadpisywać istniejący state. Przypisanie non-object lub tablicy resetuje go do `{}`; aktualizacje niepodlegające serializacji lub zbyt duże nie są zapisywane.
- `v.log(...values)`: zapisuje wpisy do Log tej grupy. Pojawiają się tu również błędy procedur obsługi i zgłoszone błędy działań na stronie; zgłoszenie nie powtarza działań. Logs/Clear są niezależne dla grup. Błędy ładowania pojawiają się w statusie Run.
- `v.emit(type, data)`: umieszcza kopię JSON `data` w kolejce handlers tej grupy po bieżącym evencie, ze świeżym `now`; to nie jest wywołanie synchroniczne.
- `v.panel(id, spec, tabId?)`: zastępuje nazwany panel grupy; pomiń `tabId` dla wszystkich dostępnych stron internetowych albo użyj całkowitego tab ID. Null `spec` usuwa panel. Zobacz Panels.
- `v.file(op, path, payload?)` → string request ID. Zobacz Files.
- `v.store(request)` zwraca identyfikator żądania; zobacz rekordy grupy.

Pozostałe wspólne wywołania zwracają `undefined`, z wyjątkiem opisanych poniżej funkcji tworzących nazwane zarządzane obiekty czasu. IDs/state należą do grupy, nie do jej nazwy wyświetlanej.

## Zarządzane timery i użycie w ruchomym oknie

`v.timer(id, {direction:"down", durationMs:300000})` tworzy lub zwraca nazwany licznik odliczający, początkowo wstrzymany. Użyj `{direction:"up"}` dla licznika zliczającego w górę. Uchwyt udostępnia `start()`, `pause()`, `resume()`, `reset()` i `snapshot()`. Start/resume są idempotentne; reset przywraca stan wstrzymany z zerowym czasem, który upłynął. Pola migawki obejmują `ready`, `error`, `elapsedMs`, `remainingMs` (null przy zliczaniu w górę), `running` i `completed`.

Uruchomione timery odmierzają czas zegarowy także wtedy, gdy aplikacja/przeglądarka jest zamknięta lub reguła wyłączona. Zakończone odliczanie dostarcza `timerEnded` z `{id, direction, durationMs, generation, incarnation}` raz na wcielenie i generację timera każdemu członkowi przy następnym wykonaniu jego reguły; Run nie powtarza tego zdarzenia. Dostarczenie zależy od zdarzeń hosta; nie jest to alarm czasu rzeczywistego. Umieść `{type:"timer", timerId:"focus", label:"Focus"}` w panelu, aby wyświetlić timer przez istniejącą kontrolkę tekstową.

`v.rolling(id, {windowMs:3600000, limitMs:600000})` tworzy lub zwraca nazwany licznik aktywnego użycia. `assign({websites:["youtube.com","reddit.com"], apps:[]})` zastępuje przypisania celów tego członka. Reguły natywne mogą zamiast tego przypisywać identyfikatory aplikacji danej platformy. Domeny obejmują subdomeny. Jeden licznik sumuje użycie swoich celów; inne identyfikatory mają niezależne limity. `snapshot()` zwraca `ready`, `error`, `usedMs`, `remainingMs`, `available` i `nextReturnAtMs` (najbliższą milisekundę, w której wygasa dowolne zapisane użycie). `available(target?)` sprawdza również przypisanie, jeśli podano cel. `reset()` czyści historię tego obiektu.

Liczy się całe zaobserwowane użycie spełniające warunki, także ponad przyznany limit; sam licznik nie blokuje strony/aplikacji. Nakładające się przedziały widoczności stron liczą się raz, a aplikacje natywne zliczają zaobserwowane użycie na pierwszym planie. Wyłączone reguły nie dodają użycia; historia nadal wygasa na dokładnych granicach przedziałów. Dostępność wraca dopiero wtedy, gdy pozostała historia jest poniżej limitu. Próbki sygnału aktywności są ograniczone do pięciu sekund; przerwy wynikające z zamknięcia/wyłączenia nie tworzą aktywności. Zdarzenia emitowane przez użytkownika nie dodają użycia.

Te same identyfikatory obiektów w połączonych grupach niestandardowych współdzielą jeden lokalny natywny hub jako źródło rozstrzygające. Łączenie scala historię i przypisania liczników oraz zachowuje stan timera inicjującego członka; niezgodne konfiguracje uniemożliwiają połączenie. Każdy członek otrzymuje własne zdarzenie zakończenia. Utrata połączenia powoduje niedostępność wspólnych liczników i odrzucanie poleceń timera do czasu powrotu aktualnego źródła rozstrzygającego. Po rozłączeniu każdy członek zachowuje końcowe wspólne użycie i stan timera, przywraca własne cele i odrzuca polecenia ze starego połączenia. Hub przechowuje końcową migawkę, dopóki powracający członek jej nie zapisze i nie potwierdzi; oczekujące przekazania kończą się przed udostępnieniem nowego połączenia.

Nazwane obiekty przetrwają Run i ponowne uruchomienie w zarezerwowanym `v.state.$vaultTime`; nie edytuj tego pola bezpośrednio. Usuwaj je jawnie przez `v.removeTime(id)`. Identyfikatory mają 1–80 liter ASCII, cyfr, `_` lub `-`; zarezerwowane nazwy właściwości są odrzucane. Do 32 obiektów współdzieli limit stanu reguły wynoszący 64 KiB UTF-8. Czas trwania to całkowita liczba milisekund, maksymalnie 365 dni. Historia ruchomego okna jest ograniczona do 1024 koszyków minutowych i 2048 scalonych przedziałów. Błędy pojemności historii pozostawiają licznik niedostępny do jawnego zresetowania; nieprawidłowe konfiguracje i zbyt duże zapisy zgłaszają błędy bez usuwania zapisanych danych.

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

## Browser events

Notacja payload opisuje typy, nie kod wykonywalny. `?` oznacza opcjonalne fields.

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

- `tick` jest przybliżony; używaj timestamps, nie liczby ticków. `active` oznacza stronę wybraną w oknie przeglądarki, nie dowodzi, że użytkownik na nią patrzy. URLs mogą być puste/ograniczone.
- `visible` pochodzi z dostępnych, nieukrytych stron; `elapsedMs` to czas od ostatniego heartbeat i wynosi zero, gdy strona jest zasłonięta. To nie jest skumulowane użycie ani czas odtwarzania.
- `items` (`platform: "web"` poza rozpoznanymi witrynami) zgłasza nowe/zmienione obsługiwane elementy feedu i wysyła je ponownie po Run/wznowieniu. `ref` identyfikuje kartę na tej stronie, nie trwały content ID; `ref === "page"` oznacza samą stronę. Tytuły/URLs/autorzy mogą być puste. `authors` zawiera source identifiers właściwe dla platformy.
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

Na zdarzenie na grupę: 256 działań w kolejce, 200 wywołań logowania, 64 emisje zdarzeń; nadmiar jest odrzucany. Na regułę: 1000 procedur obsługi, 24 panele; każda lista kontrolek ma 32 wpisy, a każdy wybór 64 opcje; nadmiar jest ignorowany/obcinany. Łańcuchy emisji kończą się po 16 generacjach. Limit serializowanego stanu: 65536 bajtów UTF-8. Rejestracja oraz łączne wykonanie procedur obsługi każdego zdarzenia powinny trwać poniżej 1 sekundy; powtarzające się przekroczenia lub twardy limit czasu zatrzymują grupę do ponownego Run. Log przechowuje 200 wpisów, przyjmuje 50 na sekundę na grupę i obcina długie wiadomości przy około 4096 znakach. Timery/odpowiedzi działają w miarę możliwości, bez gwarancji czasu rzeczywistego.

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


## Wywołania AI z działającej reguły

Każda custom group wybiera w **AI calls** połączenie/model i reasoning effort. Reguły Mac i przeglądarki używają tego samego API; żądania przeglądarki wymagają połączonego Mac Vault, a dane dostawcy pozostają tam. Połączone grupy współdzielą wybór i opcjonalny limit dzienny. Pusta wartość oznacza brak limitu grupy, obowiązują limity konta. Limit używa dnia UTC, przetrwa restart i liczy wysłane próby, również nieudane. Link łączy dotychczasowe użycie; unlink zachowuje wcześniejsze.

Zapisany prompt i kontekst są współdzielone przez połączone grupy i dostępne w handlerach jako `v.context.ai.prompt` oraz `v.context.ai.context`. Vault nie wysyła ich automatycznie; reguła wybiera, co dodać do każdego wywołania `v.ai`.

`v.ai({ prompt, input? })` natychmiast zwraca request ID. Wywołaj wewnątrz handlera, nie podczas rejestracji reguły. `input` może być dowolnym JSON; prompt/input mają limit20KB każdy. Odpowiedź przychodzi jako event `ai` events: `. Success text is at most48KB; citations are ` `ask` `note`: {requestId, ok, text, citations, error}. Tekst sukcesu do48KB; cytaty {url,title}. Zachowaj widoczne, klikalne linki źródłowe przy wyświetlaniu odpowiedzi z wyszukiwania Web. Search jest zawsze dostępne dla modelu. Brak stałego terminu aplikacji, współbieżność jest ograniczona; brak fallbacku dostawcy i automatycznej ponownej próby. Odpowiedzi są danymi, nie są wykonywane jako JavaScript. Reguła decyduje, które istniejące działania podjąć.

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

Oczekujące wywołania nie są odtwarzane po restarcie. Run, wyłączenie/ponowne włączenie i usunięcie odrzucają nieaktualne odpowiedzi; odłączona przeglądarka zgłasza `ai-unavailable`. Inne błędy: `ai-not-configured`, `ai-invalid-input`, `ai-busy`, `ai-daily-limit`, `ai-request-failed`, `ai-usage-storage-unavailable`. Nieudane wywołanie nie nadpisuje wcześniejszego wyniku zachowanego przez regułę. Limit stanu nadal64KB.

Opcje bez poświadczeń można znaleźć przez `rule_ai_models` na Mac lub `settings-rule-ai-models` w przeglądarce; skonfiguruj `ruleAI` przez istniejącą ścieżkę set-group. Pola: `providerModel`, `accountID`, `reasoningEffort` (`default`, `low`, `medium`, `high`) i `dailyRequestLimit` (null lub1–100000). Użyj zwróconej opcji; nie umieszczaj klucza ani URL dostawcy w kodzie reguły.
Opcjonalne zapisane pola to `prompt` i `context`; każde jest tekstem do16KB.

## Rekordy grupy

`v.store(request)` rozpoczyna asynchroniczną operację rekordu JSON wewnątrz handlera. Rekordy są prywatne dla grupy, pozostają po Run i ponownym uruchomieniu, a usuwane są wraz z grupą. Połączone grupy mają osobne magazyny. Reguła wybiera klucze, wartości, wersje, unieważnianie cache i priorytet informacji zwrotnej. Reguły Mac i przeglądarki używają tego samego API, ale każda aplikacja/przeglądarka ma oddzielny magazyn.

| Request | Result |
|---|---|
| `{op:"get", key}` | `record` lub `null` |
| `{op:"put", key, value, version?, ifRevision?}` | zapisany `record` |
| `{op:"delete", key, ifRevision?}` | `record: null` |
| `{op:"list", prefix?, after?, limit?}` | posortowane `entries` i `next` |
| `{op:"clear", prefix?}` | liczba `deleted` |

Rekord ma postać `{value, revision, version, updatedAt}`. Nieprzezroczysta revision zmienia się przy rzeczywistym zapisie; `version` to metadane wywołującego. `list` zwraca nagłówki bez wartości; `get` odczytuje rekord, a `after: next` `put` `delete` pobiera następną stronę. Bez `ifRevision` put/delete są bezwarunkowe; `null` wymaga nieobecnego klucza, ciąg revision dokładnej zgodności. Konflikt zwraca `ok:false`, `error:"store-conflict"` i bieżący `record`, co zapobiega nadpisaniu informacji użytkownika przez spóźnioną automatyczną odpowiedź. `v.context.revision` to nieprzezroczysty znacznik konfiguracji, który reguła może uwzględnić w swojej wersji. Framework nie narzuca polityki cache.

Limity: klucz 1–2048 znaków, wersja ≤128, wartość JSON ≤64KiB, głębokość ≤32, 10000 kluczy na grupę, cały dokument16MiB. `list` zwraca maksymalnie100 nagłówków i96KiB na stronę. Maks.32 żądania na grupę i128 rozpoczęć/sekundę łącznie; przeciążenie zgłasza `store-busy` raz na grupę na sekundę i odrzuca dalsze żądania. Błędy magazynu zwracają `ok:false`; przyszły/uszkodzony dokument pozostaje zachowany i zgłasza `store-unavailable`. Brak automatycznych ponowień i usuwania. Używaj ticks do terminów.

## Zapisane załączniki treści

`v.attach(tabId, item, id, spec)` zapisuje plakietkę lub pasywny widok HTML/CSS dla zaobserwowanego elementu treści. Przekaż pełne `item` z wydarzenia `items` lub `attachment`; samo `ref` nie jest uchwytem załącznika. `contentId` wskazuje zapisaną treść, a `instanceId` jej bieżące wystąpienie. Zachowaj oryginalny uchwyt podczas oczekiwania na AI. Spóźniony załącznik dla usuniętego, ponownie użytego lub przeniesionego celu zostanie odrzucony. `v.item(tabId, ref, verdict)` działa niezależnie.

Dla plakietki `spec` ma postać `{type:"pill", text, tone?, tooltip?}`; tony to `blue`, `cyan`, `gold`, `pink` lub `red`. Zwykły tekst ma limit 240 znaków, tooltip 1000. Dla widoku spec to `{type:"html", html, css?, label?}`. Limity: HTML 32000 znaków, CSS 16000, label 200. Widok jest budowany ponownie z dozwolonego pasywnego HTML/SVG we własnym zamkniętym shadow root z ograniczonym CSS. Usuwane są skrypty, atrybuty zdarzeń, zdalne zasoby, osadzenia i niebezpieczny CSS. Widok pozostaje w karcie treści i przewija się przy wysokości 480px. ID zawiera 1–80 znaków ASCII, cyfr, _ lub -. spec null usuwa plakietkę grupy. Wywołuj w handlerze; błędy zapisu/dostarczenia trafiają do Log i nie są ponawiane automatycznie.

Każdy element udostępnia załączniki tej grupy jako migawkę tylko do odczytu w `item.attachments`; załączników innych grup tam nie ma. Jeśli zapisane dane są niedostępne, `attachments` ma wartość null i ustawione jest `attachmentError`; nie oznacza to pustej pamięci podręcznej. Inne handlery nadal działają. Użyj przykładu, aby nie wysyłać ponownego zapytania do AI dla treści z zapisanym wynikiem.

Aktywacja wskaźnikiem, Enter lub Space tworzy dla grupy zdarzenie `attachment`. Plakietki wysyłają `click`. Kontrolki widoku używają `data-control` lub `id` jako `controlId` i wysyłają `click`, `input` lub `change`, wraz z bieżącym `value` i ograniczonym `values` nazwanych kontrolek. Rzeczywiste zdarzenia UI mają `ev.origin === "user"`, a reguła generuje `origin === "rule"`. Zawierają `tabId`, `attachmentId` i bieżące `item`. Widok nie uruchamia kodu reguły; plakietki i widoki zapobiegają nawigacji karty po ich interakcji. Zapisane dane nie zawierają callbacków ani wykonywalnego kodu. Stara rewizja pill nie może wywołać bieżącego załącznika. Zdarzenia emitowane przez regułę są zwykłą logiką; przeglądarka osobno weryfikuje rzeczywiste komunikaty kliknięcia UI.

Załączniki są zapisywane w tym profilu przeglądarki według grupa/treść/ID i wracają przy kolejnych wystąpieniach, nawigacji, ponownym uruchomieniu przeglądarki i Run. Disable ukrywa je, zachowując dane; enable je przywraca. Usunięcie grupy kasuje jej załączniki. Połączone grupy pozostają osobne; brak automatycznej synchronizacji między przeglądarkami/urządzeniami. Znane treści YouTube, Reddit, X i Bilibili używają ID platformy. Inne używają ostrożnie normalizowanego URL, więc dostępność zależy od obsługiwanego znaczników strony.

Limity: 8 załączników na grupa/treść, 32 na element dla wszystkich grup, 10000 wpisów treści na grupę i dokument załączników 8MB po serializacji. Po osiągnięciu limitu nowa zmiana jest odrzucana z `attachment-item-limit` lub `attachment-storage-limit` w Log; istniejące dane są zachowane. Dispatch grupuje zapisy, a identyczne spec nie powodują ponownego zapisu. Załączniki to interfejs treści przeglądarki, także w natywnym silniku reguł Safari. Reguły aplikacji Mac nie mają uchwytów treści przeglądarki ani powierzchni załączników w aplikacji.

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

`code-manual/generic-example.js` to wykonywalny przykład polityki. Używa rekordów, wywołań AI, informacji zwrotnej użytkownika, compare-and-swap, kontrolek HTML, decyzji o elementach i raportu użycia zarządzanego przez regułę; to zachowanie przykładu, a nie specjalna cecha magazynu.
