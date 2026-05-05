# Custom Web Blocker — Instrukcja użytkownika

To jest pełna instrukcja referencyjna rozszerzenia. Zaczyna się od najprostszych i najczęstszych przepływów pracy, a następnie stopniowo przechodzi do tematów zaawansowanych, takich jak własne reguły blokowania w JavaScript i pomocnicze API.

Jeśli dopiero zaczynasz, przeczytaj tylko **Szybki start** oraz **Przegląd grup blokowania**. Wszystko poniżej tych sekcji jest opcjonalne, zależnie od tego, co chcesz osiągnąć.

---

## 1. Co robi to rozszerzenie

Custom Web Blocker pozwala blokować strony internetowe i rozpraszacze online według reguł, które samodzielnie definiujesz. Możesz:

- Blokować strony natychmiast przy użyciu natywnego blokowania sieci w przeglądarce (ten sam typ blokady, który daje `ERR_BLOCKED_BY_CLIENT`).
- Ustawić sobie określoną liczbę minut dziennie na stronie, a potem zablokować ją po przekroczeniu limitu.
- Blokować określone rodzaje treści na YouTube, TikToku, Facebooku, Instagramie, Twitchu i Reddicie (nie całą stronę).
- Ukrywać zablokowane treści w feedach na obsługiwanych platformach zamiast blokować wyłącznie pojedyncze strony.
- Ustawiać harmonogram aktywności reguły według dni tygodnia i okien czasowych `HHMM-HHMM`.
- Zamrozić regułę, aby nie dało się jej łatwo zmienić. Ścisłe zamrożenie blokuje ją na określoną liczbę godzin i wymaga rytuału 20 potwierdzeń, aby to cofnąć.
- Tymczasowo usypiać regułę (snooze), ale tylko po wpisaniu wystarczająco długiego uzasadnienia.
- Pisać własne reguły blokowania w JavaScript z helperami do timerów, trwałego przechowywania, wykrywania platform, dopasowania domen i logowania.
- Korzystać z rozszerzenia w ponad 20 językach.

Rozszerzenie to Chrome Manifest V3, z jedną stroną edytora (popup), jednym background service workerem oraz jednym content scriptem działającym na każdej stronie.

---

## 2. Przegląd interfejsu

Po kliknięciu ikony rozszerzenia edytor otwiera się jako pełna strona internetowa (nie mały popup). Strona ma następujące obszary:

- **Górny pasek**
  - Przycisk **Instruction Manual** (ten dokument)
  - Przełącznik języka **Language**
- **Lewy panel — Block Groups**
  - Lista grup blokowania. Każda karta pokazuje nazwę grupy, krótki opis i checkbox włącz/wyłącz.
  - Przycisk **Add** tworzy nową grupę. Lista obok wybiera typ.
  - **Delete All** usuwa wszystkie grupy, z dodatkowymi potwierdzeniami, jeśli jakaś grupa jest zamrożona.
  - Możesz przeciągać uchwyt `::` na karcie w górę lub w dół, aby zmienić kolejność grup.
  - Możesz przeciągać pionowy separator, aby zmienić szerokość panelu.
- **Prawy panel — Editor**
  - Edycja aktualnie wybranej grupy: nazwa, zachowanie blokowania, listy blokad, filtry specyficzne dla typu, harmonogram, freeze, snooze.
  - Wszystkie zmiany zapisują się automatycznie po ułamku sekundy od zakończenia wpisywania lub interakcji.
- **Toast** (wyśrodkowany popup, który zanika)
  - Pokazuje komunikaty statusu, np. "Saved changes" albo błędy wejścia.

Gdy strona jest blokowana albo ma aktywny timer, w lewym górnym rogu pojawia się nakładka pokazująca wszystkie ograniczenia czasowe, które aktualnie ją dotyczą, w formacie `hh:mm:ss` (lub `mm:ss`). Wiele ograniczeń wyświetla się w wielu liniach.

---

## 3. Szybki start

1. Kliknij ikonę rozszerzenia. Edytor otworzy się jako pełna strona.
2. W panelu **Block Groups** wybierz typ grupy z listy:
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit` lub `Custom`.
3. Kliknij **Add**. Pojawi się nowa grupa, a edytor ją otworzy.
4. Nadaj jej nazwę.
5. Uzupełnij pola specyficzne dla typu (dla `Default` to lista **Blocked websites**).
6. Upewnij się, że checkbox grupy w lewym panelu jest włączony.
7. Odwiedź jedną z podanych stron. Blokada powinna zadziałać natychmiast.

To cała podstawowa ścieżka. Reszta tej instrukcji to tylko dodatkowe opcje.

---

## 4. Przegląd grup blokowania

Wszystko w tym rozszerzeniu jest zorganizowane jako **grupy blokowania**. Grupa blokowania to jeden zestaw reguł:

- Ma nazwę, typ i stan włączona/wyłączona.
- Ma zachowanie blokowania (natychmiast lub po określonej liczbie minut).
- Ma opcjonalny harmonogram (dni + okna czasowe) oraz opcjonalne sterowanie freeze/snooze.
- W zależności od typu ma dodatkowe pola, takie jak lista stron, filtry twórców YouTube, nazwy subredditów lub funkcja JavaScript.

Możesz mieć dowolną liczbę grup. Wiele grup może dotyczyć tej samej strony; wtedy wygrywa **najbardziej restrykcyjna** reguła:

- "Block immediately" wygrywa z "block after some time".
- Grupa z mniejszym pozostałym czasem wygrywa z grupą z większym pozostałym czasem.

Dodawanie kolejnych grup może więc tylko przyspieszyć blokadę strony, nigdy jej opóźnić.

Możesz przeciągać grupy za uchwyt `::`, aby zmieniać kolejność. Kolejność nie wpływa na to, która reguła jest najsurowsza, ale wpływa na czytelność listy od góry do dołu.

---

## 5. Typy grup

### 5.1 `Default` — blokowanie zwykłych stron internetowych

Do blokowania konkretnych domen (typowy przypadek użycia).

- **Blocked websites**: jedna strona na linię. Działa zarówno `facebook.com`, jak i `https://www.facebook.com/somepage`; rozszerzenie wyciąga i normalizuje hostname.
- Reguła strony dotyczy tego hostname i wszystkich jego subdomen.
- Ten typ grupy używa natywnego blokowania sieci Chrome, podobnego do `ERR_BLOCKED_BY_CLIENT`. Oznacza to, że nawigacja do zablokowanego URL zostaje zatrzymana, zanim strona się załaduje.

### 5.2 `YouTube` — blokowanie YouTube i podobnych stron wideo

Dodaje sekcję **Filters** w edytorze:

- **Content type**:
  - `Apply to all YouTube pages` — liczy się każda strona YouTube.
  - `Apply to Shorts` — liczą się tylko strony Shorts.
  - `Apply to long videos` — tylko `/watch`, `/live/`, `/embed/` itd.
  - `Apply to YouTube posts` — posty społeczności (`/post/...`, zakładki community/posts kanału).
- **Author filter**:
  - `Do not filter by author` — tożsamość autora nie ma znaczenia.
  - `Apply to certain authors` — tylko wymienieni autorzy uruchamiają tę grupę.
  - `Apply to all except certain authors` — wymienieni autorzy są wyłączeni spod reguły.
- **Authors**: jeden autor na linię. Obsługuje `@handle`, pełne URL, `/channel/UC...`, `/c/...`, `/user/...`.
- **Hide blocked entries in the YouTube feed**: gdy ta grupa aktywnie blokuje, pasujące karty w feedach YouTube są ukrywane. Gdy blokada staje się nieaktywna, wracają po kolejnym odświeżeniu.

Dla typów Shorts i Posts, gdy nie ustawiono filtra autora i grupa aktualnie blokuje, rozszerzenie ukrywa też odpowiednie elementy nawigacji (wpis Shorts w bocznym pasku, zakładki Community/Posts kanału) oraz pasujące sekcje jak "Latest YouTube posts".

Wykrywanie short-vs-long działa też na innych stronach wideo, takich jak TikTok, Vimeo, Twitch clips/VODs i Dailymotion, gdy da się rozpoznać format strony.

### 5.3 `TikTok` — blokowanie treści TikToka

Ta sama karta edytora co dla platform wideo, ale z etykietami specyficznymi dla TikToka:

- Typy treści: krótkie filmy, filmy, strony profilu.
- Autorzy: handle TikToka (`@handle`) lub URL profilu.
- Ukrywanie feedu ukrywa pasujące karty na stronach TikToka, gdy grupa jest aktywna.

### 5.4 `Facebook` — blokowanie treści Facebooka

- Typy treści: Reels, filmy, posty.
- Autorzy: nazwa strony (`page.name`), URL profilu lub format `profile.php?id=...` (numeryczne id jest zachowane jako `id:<number>`).
- Ukrywanie feedu ukrywa pasujące karty feedu na Facebooku.

### 5.5 `Instagram` — blokowanie treści Instagrama

- Typy treści: Reels, filmy, posty.
- Autorzy: handle Instagrama lub URL profilu.
- Zarezerwowane ścieżki, takie jak `/reel/`, `/p/`, `/tv/`, `/explore/`, nie są traktowane jako autorzy.
- Ukrywanie feedu ukrywa pasujące karty na Instagramie.

### 5.6 `Twitch` — blokowanie treści Twitcha

- Typy treści: clips, streamy/VOD, strony kanałów.
- Autorzy: nazwy kanałów lub URL kanału.
- Zarezerwowane ścieżki, takie jak `/directory`, `/videos`, `/settings` itd., nie są traktowane jako nazwy kanału.
- Ukrywanie feedu ukrywa pasujące karty na Twitchu.

### 5.7 `Reddit` — blokowanie Reddita lub konkretnych subredditów

- **Subreddits**: jeden subreddit na linię. Pusta lista oznacza, że grupa dotyczy całego Reddita. Akceptowane są zarówno `productivity`, jak i `r/productivity`.

### 5.8 `Custom` — blokowanie funkcją JavaScript

Piszesz funkcję JavaScript. Rozszerzenie wywołuje ją mniej więcej co sekundę i używa tego, co zwróci, jako aktualnej listy blokad.

Grupy `Custom` nie pokazują: zachowania blokowania, blokowanych stron, dozwolonych minut, interwału resetu, dni harmonogramu ani okien czasowych. Mają tylko jedno duże pole wejściowe — funkcję **Blocking Rules** — oraz standardowe kontrolki freeze/snooze.

Pełny opis reguł custom i API helperów znajdziesz w **Sekcji 11**.

---

## 6. Zachowanie blokowania

Dla większości typów grup wybierasz jeden z dwóch trybów:

### 6.1 Blokuj natychmiast

Reguła jest aktywna, gdy grupa jest włączona, harmonogram na to pozwala i (dla grup platformowych) strona pasuje.

Dla grup `Default` używa to natywnej blokady Chrome. Dla grup platformowych używa logiki nakładki/wyjścia na stronie.

### 6.2 Blokuj po określonej liczbie minut

To budżet użycia.

- **Allowed minutes before block** (dziesiętnie): ile minut dopuszczasz na okres. Przykład: `15`, `0.5`, `90`.
- **Timer reset interval (hours)** (dziesiętnie): jak często resetuje się budżet. Przykład: `24` dla dobowo, `1` dla godzinowo, `0.25` dla co 15 minut.

Gdy masz jeszcze czas, strona działa normalnie i pokazuje nakładkę timera. Gdy budżet spadnie do zera, strona jest blokowana na resztę okresu, nakładka pokazuje `0:00`, a karta próbuje opuścić stronę.

Rozszerzenie działa per grupa, per okres:

- Każda grupa ma własny budżet.
- Czas spędzony na dowolnej stronie pasującej do grupy liczy się do budżetu tej grupy.
- Wiele kart w tej samej grupie współdzieli budżet. Ich timery pozostają zsynchronizowane; przełączenie na inną kartę też wymusza odświeżenie, aby od razu pokazać aktualny wspólny czas.

Jeśli do tej samej strony pasuje kilka grup z limitem czasu, wygrywa najbardziej restrykcyjna.

---

## 7. Harmonogram

W karcie **Schedule** możesz ograniczyć, kiedy grupa jest aktywna:

- **Days to block**: wybierz dni, w których grupa obowiązuje. Dni bez zaznaczenia oznaczają, że grupa jest wtedy nieaktywna.
- **Time windows**: dowolna lista, jedno okno na linię w formacie `HHMM-HHMM`, na przykład:

  ```
  0900-1000
  1200-1300
  ```

  Grupa jest aktywna tylko wewnątrz tych okien. Pusta lista oznacza cały dzień.

Dotyczy to wszystkich typów grup poza `Custom`.

---

## 8. Freeze (zabezpieczenie przed manipulacją)

Zamrożenie utrudnia impulsywne wyłączenie grupy.

W karcie **Freeze** wybierasz:

- **Frozen** — nie możesz edytować ani usuwać grupy i nie możesz odznaczyć przełącznika włączenia. Aby coś zmienić, musisz przejść rytuał odblokowania (patrz niżej).
- **Strict frozen** — to samo co Frozen, ale pozostaje zablokowane przez wybraną liczbę godzin (dziesiętnie, do 72). Dopóki timer nie wygaśnie, nawet rytuał odblokowania jest niedostępny.

Gdy zamrożoną grupę da się odblokować, pojawia się przycisk **Unfreeze**. Kliknięcie uruchamia **rytuał 20 kroków**:

- Okno modalne pokazuje komunikat o samodyscyplinie.
- Musisz kliknąć `Confirm` 20 razy.
- Między kliknięciami jest wymuszone 5 sekund czekania.
- Jeśli anulujesz na dowolnym etapie, musisz zacząć od kroku 1.
- 20 komunikatów rotuje, żeby faktycznie je czytać.

Jeśli grupa jest też oznaczona jako "no snooze" (patrz następna sekcja), nie możesz jej usypiać podczas zamrożenia.

Status freeze jest pokazany w linii meta karty grupy, wraz z pozostałym czasem strict freeze.

---

## 9. Snooze (tymczasowe wyłączenie)

Snooze tymczasowo wyłącza grupę bez odblokowywania freeze, ale tylko po podaniu pisemnego uzasadnienia.

W karcie **Snooze**:

- **Allow snooze for this group** — jeśli wyłączone, tej grupy nie da się usypiać w ogóle (również podczas freeze).
- **Snooze for (minutes)** — liczba dziesiętna, jak długo trwa snooze.
- **Reason** — musi mieć **co najmniej 100 znaków i więcej niż 20 słów**. Przycisk Start pozostaje wyłączony, dopóki oba warunki nie są spełnione. Jeśli reguła nie przejdzie, obok przycisku pojawia się ostrzeżenie inline.

Jeśli grupa jest zamrożona, minuty snooze są zablokowane na wartości wybranej przed freeze. Nadal możesz uruchomić snooze, o ile jest dozwolone i powód spełnia reguły.

Komunikat statusu potwierdza snooze. Gdy snooze się kończy, grupa automatycznie wraca do normalnego działania.

Snooze możesz też zakończyć wcześniej przyciskiem **End Snooze**.

---

## 10. Operacje zbiorcze

- **Delete All** usuwa wszystkie grupy.
  - Zawsze prosi o potwierdzenie.
  - Jeśli co najmniej jedna grupa jest zamrożona, wymaga tego samego rytuału 20 kroków co odblokowanie.
  - Jeśli jakaś grupa jest strict-frozen i nadal zablokowana, **Delete All** jest wyłączone.

---

## 11. Grupy custom (pełna referencja)

Grupa `Custom` uruchamia funkcję JavaScript w background service workerze. Funkcja jest wywoływana mniej więcej co sekundę, a rozszerzenie używa jej wyniku do decyzji, które domeny powinny być zablokowane w danym momencie.

### 11.1 Sygnatura funkcji

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

Parametry:

- `month` — `1` do `12`.
- `dayOfMonth` — `1` do `31`.
- `dayName` — np. `"Monday"`.
- `hour` — `0` do `23`.
- `minute` — `0` do `59`.
- `blockedDomains` — bieżąca lista domen, które już wygenerowały inne reguły. Możesz do niej dodawać, zastąpić ją albo zignorować.
- `helpers` — zestaw obiektów pomocniczych (patrz niżej).

Wartość zwracana:

- Tablica stringów domen do zablokowania teraz, LUB
- nic (wtedy rozszerzenie używa tego, do czego zmodyfikowano `blockedDomains`).

Funkcja jest walidowana przy zapisie. Błędy składni dają ostrzeżenie statusu i reguła nie działa, dopóki ich nie poprawisz. Jeśli funkcja rzuci wyjątek w runtime, rozszerzenie go przechwyci, zaloguje do konsoli background i wróci do poprzedniego wyniku.

### 11.2 Adaptacyjne harmonogramowanie

Reguły custom zwykle działają mniej więcej co sekundę. Jeśli twoja reguła zaczyna działać zbyt długo, rozszerzenie automatycznie spowalnia pętlę (do ok. co 5 sekund). Nie musisz tym zarządzać ręcznie.

### 11.3 Obiekt `helpers`

Wewnątrz funkcji `helpers` udostępnia kilka sub-helperów. Każdy ma długą nazwę i krótki alias. Dostępne są też jawne metody getter:

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — aktualny czas epoki w milisekundach.

Wszystkie metody helperów są zaprojektowane jako bezpieczne: błędne parametry zwracają `null`, `false` albo pustą wartość zamiast rzucać wyjątek.

#### 11.3.1 `timerHelper`

Zarządza timerami odliczającymi przypiętymi do domeny. Timery są trwałe między restartami przeglądarki. Każdy timer należy do grupy custom, która go utworzyła.

- `createTimer(domain, durationMs, displayName?)` — tworzy i zwraca unikalny id timera albo `null`, jeśli dane są niepoprawne. Przykład: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`. Gdy użytkownik jest na stronie pasującej do domeny, nakładka w stronie pokaże `Timer1: 30:00` i będzie odliczać.
- `deleteTimer(id)` — usuwa timer. Zwraca `true` przy sukcesie.
- `pauseTimer(id)` — pauzuje odliczanie.
- `continueTimer(id)` / `resumeTimer(id)` — wznawia zapauzowany timer.
- `resetTimer(id, durationMs?)` — restartuje timer. Bez `durationMs` używa wartości pierwotnej.
- `addMs(id, ms)` — dodaje milisekundy (albo odejmuje dla wartości ujemnych).
- `remainingMs(id)` — pozostałe milisekundy.
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — wartości bool.
- `getDomain(id)` / `getDisplayName(id)` — odczyt informacji timera.
- `findByDomain(domain)` — tablica id timerów dla domeny.
- `list()` — tablica `{ id, domain, displayName, durationMs, remainingMs, isPaused }` dla wszystkich timerów należących do tej grupy.

Maksymalny czas timera to około 30 dni.

#### 11.3.2 `persistenceHelper`

Przechowywanie typu map scoped do twojej grupy. Wartości muszą być serializowalne do JSON. Przydatne do pamiętania stanu między wywołaniami.

- `set(key, value)` — zapisuje dowolną wartość JSON. Zwraca `true` przy sukcesie.
- `get(key, defaultValue?)` — zwraca zapisaną wartość lub `defaultValue`, jeśli brak.
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`.

Miękkie limity: ok. 200 kluczy na grupę, 16 KB na wartość.

#### 11.3.3 `domainHelper`

- `normalize(value)` — zwraca kanoniczną domenę, np. `youtube.com`, albo `null`.
- `matches(hostname, site)` — `true`, jeśli `hostname` należy do `site` (obsługuje subdomeny).

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — zapisują do konsoli background.

Aby zobaczyć te komunikaty: `chrome://extensions` → włącz Developer Mode → kliknij link "service worker" rozszerzenia.

#### 11.3.5 `platformHelper`

Inspekcja obsługiwanych platform społecznościowych/wideo.

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`.
- `normalizePlatform(value)` — zwraca kanoniczną nazwę platformy albo `null`.
- `normalizeAuthor(author, platform)` — normalizuje identyfikator autora (handle, URL itd.) dla konkretnej platformy albo `null`.
- `detect(urlOrHost)` / `getContext(urlOrHost)` — zwraca `{ platform, hostname, pathname, type, authors, url }` albo `null`.
  - `type` to `"short" | "long" | "post" | "unknown"`.
  - `authors` to lista znormalizowanych autorów wykrywalnych z tego URL.
- `getType(urlOrHost)` — skrót do `detect(...).type`.
- `getPlatform(urlOrHost)` — skrót do `detect(...).platform`.
- `getAuthors(urlOrHost)` — skrót do `detect(...).authors`.
- `matchesAuthor(urlOrHost, platform, authors)` — zwraca `true`, jeśli URL jest na tej platformie i pasuje do jednego z podanych autorów.

### 11.4 Przykłady

Łatwe: blokuj social media w poranki dni roboczych.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

Średnie: 30 minut YouTube na sesję przeglądarki, z widocznym odliczaniem.

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

Trudniejsze: blokuj sesję TikToka tylko wtedy, gdy to krótkie filmy ORAZ autor jest na twojej liście rozpraszaczy. Użyj `platformHelper`.

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

(`globalThis.location` to tylko przykładowy placeholder — normalnie sterujesz `platformHelper` własną logiką, a nie z location workera, ponieważ background worker nie ma prawdziwego URL strony.)

Najtrudniejsze: rotacyjna "strona dnia" z limitem dziennym, zapisywana między restartami.

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

## 12. Zachowanie na wielu stronach

- Wszystkie otwarte karty w tej samej grupie współdzielą ten sam timer.
- Gdy przełączysz się na kartę w tej samej grupie, jej nakładka odświeża się natychmiast i pokazuje aktualny wspólny czas.
- Gdy dodasz nową regułę, każda otwarta strona wykrywa zmianę i odświeża się w ułamku sekundy; nie musisz ręcznie przeładowywać kart.
- Gdy reguła wygasa, ukryte karty feedu i przyciski nawigacji wracają przy następnym odświeżeniu.

---

## 13. Internacjonalizacja

Cały interfejs jest przetłumaczony. Użyj przełącznika **Language** w prawym górnym rogu.

Obsługiwane języki obejmują angielski, chiński uproszczony, hiszpański, japoński, koreański, plus częściowe pokrycie dla hindi, arabskiego, bengalskiego, portugalskiego, rosyjskiego, pendżabskiego, niemieckiego, francuskiego, tureckiego, wietnamskiego, włoskiego, tajskiego, niderlandzkiego, polskiego, indonezyjskiego, urdu i perskiego. Języki z częściowym pokryciem przechodzą na angielski dla brakujących tekstów.

Sama instrukcja ładuje plik markdown odpowiadający wybranemu językowi, z angielskim jako fallbackiem.

---

## 14. Komunikaty statusu

Komunikaty statusu pojawiają się jako wyśrodkowany toast, który znika po około dwóch sekundach:

- "Saved changes."
- "Created \"Group name\"."
- Błędy walidacji, np. "Allowed minutes must be a number greater than 0."
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

Dla pól wejściowych z wymaganiami formatu komunikat pojawia się też obok odpowiedniego przycisku (dla snooze).

---

## 15. Prywatność i przechowywanie

- Wszystko jest przechowywane lokalnie w `chrome.storage.local`. Żadne dane nie są nigdzie wysyłane.
- Przechowywane elementy obejmują: twoje grupy, timery użycia, czasy ostatnich resetów, rekordy snooze, niestandardowe timery i niestandardowe trwałe wartości.
- Rozszerzenie nie czyta treści stron poza tym, co jest potrzebne do wykrycia typu strony (ścieżka/hostname/znane markery DOM dla stron wideo). Nie czyta twoich wiadomości, postów, komentarzy ani prywatnych treści.

---

## 16. Uprawnienia

- `storage` — dla powyższych danych.
- `declarativeNetRequest` — do natywnego blokowania grup `Default`.
- `alarms` — do wydajnego harmonogramowania przejść reguł.
- `host_permissions: <all_urls>` — aby content script mógł pokazywać nakładkę timera i wykrywać kontekst platformy na dowolnej stronie.

---

## 17. Rozwiązywanie problemów

- **Dodana grupa nic nie robi.** Upewnij się, że grupa jest włączona, harmonogram aktualnie na to pozwala, nie ma aktywnego snooze i (dla grup platformowych) strona faktycznie pasuje do wybranego typu treści i filtra autora.
- **Timer zaciął się lub pokazuje zły czas na jednej karcie.** Przełącz się na inną kartę i wróć albo ustaw fokus na karcie — to wymusza odświeżenie ze wspólnego timera.
- **Karty feedu pojawiają się ponownie, choć powinny być ukryte.** Ukrywanie feedu działa tylko wtedy, gdy reguła aktywnie blokuje. Jeśli masz regułę `after-minutes`, ukrywanie zaczyna działać po osiągnięciu zera czasu.
- **Przycisk nawigacji YouTube, który miał być ukryty, nadal jest widoczny.** Ukrywanie nawigacji wymaga ustawienia reguły na "do not filter by author" oraz typu treści Shorts lub YouTube posts. Przy filtrach autora ukrywanie działa tylko per-karta.
- **Reguła custom nic nie zrobiła lub cicho rzuciła błąd.** Otwórz `chrome://extensions`, włącz Developer Mode, kliknij link "service worker" rozszerzenia i sprawdź konsolę. Użyj `helpers.logHelper.log(...)`, aby śledzić regułę.
- **Nie mogę usunąć grupy.** Prawdopodobnie jest zamrożona. Grupy strict-frozen nie mogą być usunięte, dopóki ich blokada nie wygaśnie; grupy frozen (nie-strict) można usunąć przez rytuał odblokowania.

---

## 18. Słowniczek

- **Grupa blokowania** — jeden zestaw reguł z własnym typem, zachowaniem, harmonogramem i freeze/snooze.
- **Instant block** — reguła blokuje natychmiast, gdy jest aktywna.
- **After-minutes block** — reguła zaczyna blokować dopiero po wyczerpaniu budżetu czasu w okresie.
- **Reset interval** — jak często resetuje się budżet after-minutes.
- **Schedule** — dni + okna czasowe, gdy grupa jest aktywna.
- **Freeze / Strict freeze** — stany zabezpieczenia przed manipulacją.
- **Snooze** — tymczasowe wyłączenie z pisemnym uzasadnieniem.
- **Author filter** — dla grup platformowych ogranicza regułę do określonych twórców treści.
- **Content type** — dla grup platformowych ogranicza regułę do określonych form treści (short, long, post).
- **Helpers** — narzędzia pomocnicze przekazywane do funkcji reguły custom.
- **Platform** — jedna z `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Każda ma własny typ grupy i logikę ukrywania feedu.

---

## 19. Ograniczenia

- Ukrywanie feedu zależy od aktualnego DOM każdej platformy. Jeśli platforma zmieni układ, selektory ukrywania mogą wymagać aktualizacji.
- Wykrywanie kontekstu platformy dla stron innych niż YouTube jest głównie oparte o URL, więc jest najbardziej niezawodne na kanonicznych URL treści.
- Pętle reguł custom działają w background workerze, a nie na stronach, więc informacje DOM nie są dostępne w funkcji. Używaj zamiast tego `platformHelper.detect(url)` z ciągiem URL.
- Przeglądarka może usypiać service workera, gdy jest bezczynny. Rozszerzenie wznowi go, gdy tylko strona lub alarm będzie go potrzebować; timery użycia nie stracą przez to dokładności.
