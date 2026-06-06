# Niestandardowy bloker sieciowy — instrukcja obsługi

To jest pełna instrukcja obsługi rozszerzenia. Zaczyna się od najłatwiejszych, najpopularniejszych przepływów pracy i stopniowo przechodzi do zaawansowanych tematów, takich jak niestandardowe reguły blokowania oparte na zdarzeniach i pomocniczy interfejs API.

Jeśli jesteś nowy, po prostu przeczytaj **Szybki start** i **Przegląd grup bloków**. Wszystko poniżej tych sekcji jest opcjonalne, w zależności od tego, co chcesz zrobić.

---

## 1. Co robi to rozszerzenie

Niestandardowy moduł blokowania sieci umożliwia blokowanie witryn internetowych i elementów rozpraszających uwagę w Internecie zgodnie z regułami, które sam definiujesz. Możesz:

- Natychmiast blokuj witryny za pomocą natywnego blokowania sieci przeglądarki (tego samego rodzaju, który generuje `ERR_BLOCKED_BY_CLIENT`).
- Pozwól sobie na określoną liczbę minut dziennie na stronie, a następnie zablokuj ją po przekroczeniu tego limitu.
- Blokuj określone rodzaje treści w Jutub, krótkie wideo, Fejsbuku, sieci zdjęć, Tłiczu i forum społeczności (nie w całej witrynie).
- Ukryj zablokowaną zawartość z kanałów na obsługiwanych platformach, zamiast blokować tylko pojedyncze strony.
- Zaplanuj, kiedy reguła jest aktywna według dnia tygodnia i okien czasowych `HHMM-HHMM`.
- Zablokuj regułę, aby nie można było jej łatwo zmienić. Ścisłe zamrożenie blokuje go na określoną liczbę godzin, a jego cofnięcie wymaga 20-etapowego rytuału potwierdzenia.
- Odłóż regułę tymczasowo, ale dopiero po napisaniu wystarczająco długiego uzasadnienia.
- Napisz **sterowane zdarzeniami** niestandardowe reguły w język skryptowy z pomocnikami dla liczników czasu do przodu/do tyłu, trwałego przechowywania dla grup, intencji DOM dla poszczególnych platform (ukryj przyciski nawigacyjne, ukryj karty kanałów według predykatu, ustaw liczniki czasu dla podsekcji), narzędzia URL i rejestrowanie strukturalne.
- Wybieraj z wbudowanej biblioteki ponad 50 gotowych szablonów (timery, harmonogramy, ukrywanie kanałów, sesje fokusowe, przekierowania, szturchnięcia, trwałość, poprawki DOM, pomocnicy debugowania).
- Użyj rozszerzenia w ponad 20 językach.

Rozszerzenie to rozszerzenie przeglądarka Chrom Manifest V3 z jedną stroną edytora (wyskakującym okienkiem), jednym procesem roboczym usług w tle, jedną piaskownicą poza ekranem, w której znajduje się kod niestandardowych reguł, i jednym skryptem treści uruchamianym na każdej stronie. Niestandardowe reguły znajdują się w piaskownicy poza ekranem; są ładowane raz na kliknięcie Uruchom i pozostają zarejestrowane do momentu wyłączenia lub usunięcia reguły.

---

## 2. Wycieczka po interfejsie użytkownika

Po kliknięciu ikony rozszerzenia edytor otwiera się jako pełna strona internetowa (a nie małe wyskakujące okienko). Na stronie znajdują się następujące obszary:

- **Górny pasek**
  - Przycisk **Instrukcja obsługi** (niniejszy dokument)
  - Selektor **języka**
  - Sprzęt **Ustawienia** (zaawansowane przełączniki, w tym **Tryb debugowania**)
- **Lewy panel — Grupy bloków**
  - Lista twoich grup bloków. Na każdej karcie znajduje się nazwa grupy, krótka linia podsumowująca oraz pole wyboru włączania/wyłączania.
  - Przycisk **Dodaj** tworzy nową grupę. Lista rozwijana obok wybiera typ.
  - **Usuń wszystko** usuwa każdą grupę, z dodatkowym potwierdzeniem, jeśli jakakolwiek grupa jest zamrożona.
  - Możesz przeciągnąć uchwyt `::` na karcie w górę lub w dół, aby zmienić kolejność grup.
  - Możesz przeciągnąć pionowy rozdzielacz, aby zmienić rozmiar tego panelu.
- **Prawy panel — Edytor**
  - Edytuje aktualnie wybraną grupę: nazwę, zachowanie blokujące, listy blokowania, filtry specyficzne dla typu, harmonogram, blokowanie, drzemka.
  - Wszystkie zmiany są zapisywane automatycznie w ułamku sekundy po zakończeniu pisania lub interakcji.
  - W przypadku grup **Niestandardowych** edytor wyświetla także przeglądarkę **Szablony**, przycisk **Uruchom** i panel **Dziennik** (nazwa zmieniona z *Dziennik aktywności* w wersji 1.1).
- **Toast** (wyśrodkowane wyskakujące okienko, które zanika) — wyświetla komunikaty o stanie, takie jak „Zapisane zmiany”. lub błędy wprowadzania.
- **Nakładka na stronie** — gdy karta ma aktywny licznik czasu lub blok, w jej lewym górnym rogu pojawia się nakładka pokazująca wszystkie wpływające na nią ograniczenia w formacie `hh:mm:ss` (lub `mm:ss`). Wiele ograniczeń nakłada się na wiele linii. Domyślne odliczanie grup bloków i liczniki czasu reguł niestandardowych korzystają z tej nakładki.

---

## 3. Szybki start1. Kliknij ikonę rozszerzenia. Edytor otwiera się jako pełna strona.
2. W panelu **Grupy bloków** wybierz z listy rozwijanej typ grupy:
   - `Default`, `Jutub`, `krótkie wideo`, `Fejsbuk`, `sieć zdjęć`, `Tłicz`, `forum społeczności` lub `Custom`.
3. Kliknij **Dodaj**. Pojawi się nowa grupa, którą edytor otworzy.
4. Nazwij to.
5. Wypełnij pola specyficzne dla typu (dla `Default` oznacza to listę **Zablokowane strony internetowe**).
6. Upewnij się, że pole wyboru grupy w lewym panelu jest włączone.
7. Odwiedź jedną z wymienionych witryn. Blokada powinna obowiązywać natychmiast.

To jest cała szczęśliwa ścieżka. Pozostała część tej instrukcji to tylko dodatkowe opcje.

> Kiedy naciśniesz **Uruchom** w grupie niestandardowej, nowa reguła zostanie dołączona do **przyszłych** zdarzeń na stronie. Już otwarte karty zachowują poprzednią regułę, dopóki nie załadujesz ich ponownie. Wyskakujące okienko wyświetla przypomnienie po każdym udanym uruchomieniu.

---

## 4. Przegląd grup bloków

Wszystko w tym rozszerzeniu jest zorganizowane jako **grupy bloków**. Grupa bloków to jeden zestaw reguł:

- Ma nazwę, typ i stan włączenia/wyłączenia.
- Ma działanie blokujące (natychmiastowe, po określonej liczbie minut lub ze stałym odliczaniem).
- Posiada opcjonalny harmonogram (dni + okna czasowe) i opcjonalne elementy sterujące zamrażaniem/drzemką.
- W zależności od typu zawiera dodatkowe pola, takie jak lista stron internetowych, filtry twórców Jutub, nazwy subredditów lub reguła język skryptowy sterowana zdarzeniami.

Możesz mieć dowolną liczbę grup. Do tej samej strony może aplikować wiele grup; w takim przypadku wygrywa **najsurowsza** zasada:

- „Zablokuj natychmiast” zastępuje „blokuj po pewnym czasie”.
- Grupa, której pozostało mniej czasu, pokonuje grupę, której pozostało więcej czasu.

Dlatego dodanie większej liczby grup może spowodować zablokowanie strony tylko wcześniej, nigdy później.

**Kolejność oceny jest od dołu do góry.** Kiedy rozszerzenie iteruje grupy bloków, zaczyna od grupy na dole listy i przesuwa się w górę. Grupa na górze listy jest oceniana jako ostatnia i otrzymuje „ostatnie słowo” — na przykład, jeśli dolna grupa wywołuje `helpers.getPlatformHelper().youtube().hideShortButton()`, a górna grupa wywołuje `showShortButton()`, przycisk pozostaje widoczny. Przeciągnij uchwyt `::` na karcie, aby zmienić tę kolejność.

---

## 5. Typy grup

### 5.1 `Default` — blokuj zwykłe strony internetowe

Do blokowania określonych domen (typowy przypadek użycia).

- **Zablokowane strony internetowe**: jedna witryna w wierszu. Działają zarówno `facebook.com`, jak i `https://www.facebook.com/somepage`; rozszerzenie wyodrębnia i normalizuje nazwę hosta.
- Reguła witryny ma zastosowanie do tej nazwy hosta i wszystkich jej subdomen.
— Ten typ grupy korzysta z natywnego blokowania sieci przeglądarka Chrom, podobnie jak `ERR_BLOCKED_BY_CLIENT`. Oznacza to, że nawigacja do zablokowanego adresu URL zostaje zatrzymana jeszcze przed załadowaniem strony.

### 5.2 `Jutub` — blokuj Jutub i podobne witryny wideo

Dodaje sekcję **Filtry** do edytora:

- **Typ treści**:
  - `Apply to all Jutub pages` — liczy się każda strona Jutub.
  - `Apply to Shorts` — liczą się tylko strony z filmami Short.
  - `Apply to long videos` — tylko `/watch`, `/live/`, `/embed/` itp.
  - `Apply to Jutub posts` — posty społeczności (`/post/...`, zakładki społeczność/posty kanału).
- **Filtr autora**:
  - `Do not filter by author` — tożsamość autora nie ma znaczenia.
  - `Apply to certain authors` — tylko wymienieni autorzy tworzą tę grupę.
  - `Apply to all except certain authors` — autorzy wymienieni są zwolnieni.
- **Autorzy**: jeden autor w każdym wierszu. Akceptuje `@handle`, pełne adresy URL, `/channel/UC...`, `/c/...`, `/user/...`.
- **Ukryj zablokowane wpisy w kanale Jutub**: gdy ta grupa aktywnie blokuje, pasujące karty w kanałach Jutub są ukryte. Gdy blok stanie się nieaktywny, powrócą przy następnym odświeżeniu.

W przypadku treści typu Shorts i Posts, gdy nie jest ustawiony żaden filtr autora, a grupa jest aktualnie blokowana, rozszerzenie ukrywa również odpowiednie wpisy nawigacyjne (wpis na pasku bocznym Shorts, karty kanałów Społeczność/Posty) i pasujące półki, takie jak „Najnowsze posty w Jutub”.

Wykrywanie krótkich i długich treści obejmuje inne witryny wideo, takie jak krótkie wideo, Vimeo, klipy/VOD na Tłiczu i Dailymotion, jeśli można wykryć ich formę strony.

### 5.3 `krótkie wideo` — blokuj treści krótkie wideo

Ta sama karta edytora, co edytor wideo platformy, ale z etykietami specyficznymi dla krótkie wideo:- Typy treści: krótkie filmy, filmy, strony profilowe.
- Autorzy: uchwyty krótkie wideo (`@handle`) lub adresy URL profili.
- Ukrywanie kanałów ukrywa pasujące karty na stronach krótkie wideo, gdy grupa jest aktywna.

### 5.4 `Fejsbuk` — blokuj treści na Fejsbuku

- Typy treści: krążki, filmy, posty.
- Autorzy: nazwa strony (`page.name`), adres URL profilu lub formularz `profile.php?id=...` (identyfikator numeryczny zostaje zachowany jako `id:<number>`).
- Ukrywanie kanałów ukrywa pasujące karty kanałów na Fejsbuku.

### 5.5 `sieć zdjęć` — blokuj treści na sieci zdjęć

- Typy treści: krążki, filmy, posty.
- Autorzy: uchwyty na sieci zdjęć lub adresy URL profili.
- Zarezerwowane ścieżki, takie jak `/reel/`, `/p/`, `/tv/`, `/explore/` nie są traktowane jako autorzy.
- Ukrywanie kanałów ukrywa pasujące karty na sieci zdjęć.

### 5.6 `Tłicz` — blokowanie zawartości Tłicza

- Typy treści: klipy, strumienie/VOD, strony kanałów.
- Autorzy: nazwy kanałów lub adresy URL kanałów.
- Zarezerwowane ścieżki, takie jak `/directory`, `/videos`, `/settings` itp. nie są traktowane jako nazwy kanałów.
- Ukrywanie kanałów ukrywa pasujące karty na Tłiczu.

### 5.7 `forum społeczności` — blokuj forum społeczności lub określone subreddity

- **Subreddity**: jeden subreddit w każdym wierszu. Pusta lista oznacza, że ​​grupa dotyczy całego forum społeczności. Akceptowane są zarówno `productivity`, jak i `r/productivity`.

### 5.8 `Custom` — blok przez język skryptowy sterowany zdarzeniami

Piszesz funkcję język skryptowy, która **rejestruje moduły obsługi** zdarzeń takich jak otwarcie strony, zmiana adresu URL, puls strony, koniec licznika czasu i własne zdarzenia niestandardowe. Funkcja jest uruchamiana raz na kliknięcie Uruchom; zarejestrowane programy obsługi pozostają aktywne podczas nawigacji, dopóki nie naciśniesz ponownie Uruchom, nie wyłączysz grupy lub ją nie usuniesz.

Grupy `Custom` nie pokazują: zachowań blokujących, zablokowanych witryn, dozwolonych minut, interwału resetowania, dni harmonogramu ani okien czasowych. Zachowują edytor **Reguł blokowania** oraz standardowe elementy sterujące blokowaniem/drzemieniem. Dostępny jest także przycisk **Szablony**, który otwiera gotową przeglądarkę ze sparametryzowanymi regułami startowymi; zastosowanie ustawienia wstępnego zastępuje bieżącą regułę po potwierdzeniu.

Pełne informacje o regułach niestandardowych i interfejsach API można znaleźć w **Sekcji 11**.

---

## 6. Zachowanie blokujące

W przypadku większości typów grup można wybrać jeden z trzech trybów.

### 6.1 Zablokuj natychmiast

Reguła jest aktywna zawsze, gdy grupa jest włączona, pozwala na to harmonogram i (w przypadku grup platform) strona jest zgodna.

W przypadku grup `Default` wykorzystuje to natywne blokowanie przeglądarki przeglądarka Chrom. W przypadku grup platform wykorzystuje logikę nakładki/wyjścia na stronie.

### 6.2 Blokuj po kilku minutach

To jest budżet użytkowania.

- **Dozwolone minuty przed blokiem** (dziesiętne): ile minut pozwalasz sobie na okres. Przykład: `15`, `0.5`, `90`.
- **Interwał resetowania timera (w godzinach)** (dziesiętnie): częstotliwość resetowania budżetu. Przykład: `24` codziennie, `1` co godzinę, `0.25` co 15 minut.

Dopóki masz czas, strona działa normalnie i wyświetla nakładkę licznika czasu. Gdy budżet osiągnie zero, strona zostanie zablokowana na resztę okresu, a nakładka wyświetli `0:00`, a następnie zakładka podejmie próbę wyjścia.

Przedłużenie dotyczy poszczególnych grup i okresów:

- Każda grupa ma swój własny budżet.
- Czas spędzony na dowolnej stronie pasującej do grupy wlicza się do budżetu tej grupy.
- Wiele kart w tej samej grupie ma wspólny budżet. Ich timery pozostają zsynchronizowane; przejście na inną kartę również wymusza odświeżenie, dzięki czemu natychmiast pokazuje aktualny udostępniony czas.

Jeśli do tej samej strony zgłosi się wiele grup ograniczonych czasowo, wygrywa ta z nich, która jest najsurowsza.

### 6.3 Timer (odliczanie, następnie blokowanie)

Ten tryb wyświetla licznik czasu i blokuje się po osiągnięciu `0:00`.

- **Interwał resetowania timera (godziny)** (dziesiętne): zarówno długość timera, jak i częstotliwość resetowania. Przykład: `24` codziennie, `1` co godzinę, `0.25` co 15 minut.

W przeciwieństwie do **Blokuj po określonej liczbie minut**, ten tryb **nie** ma osobnego pola „Dozwolone minuty przed blokadą”. Licznik po prostu rozpoczyna pracę od interwału resetowania, odlicza czas, gdy pasujące strony są otwarte, a następnie blokuje się do następnego resetowania.Odliczanie w grupie domyślnej i liczniki czasu w grupie niestandardowej (patrz **Sekcja 11.3.1**) **postępują tylko wtedy, gdy karta jest widoczna**. Przełączanie kart, minimalizowanie okna lub blokowanie ekranu powoduje automatyczne wstrzymywanie odliczania.

---

## 7. Harmonogram

Na karcie **Harmonogram** możesz określić, kiedy grupa jest aktywna:

- **Dni do zablokowania**: wybierz dni, w które grupa ma zastosowanie. Dni niezaznaczone oznaczają, że grupa jest w danym dniu nieaktywna.
- **Okna czasowe**: lista dowolna, jedno okno w każdym wierszu w formacie `HHMM-HHMM`, na przykład:

  ```
  0900-1000
  1200-1300
  ```

  Grupa jest aktywna tylko w tych oknach. Pusta lista oznacza cały dzień.

Dotyczy to wszystkich typów grup z wyjątkiem `Custom`. (Reguły niestandardowe mogą implementować własny harmonogram przy użyciu `ev.time.dayName` / `ev.time.hour`; patrz **Sekcja 11.4**.)

---

## 8. Zamrożenie (zabezpieczenie przed manipulacją)

Zamrożenie sprawia, że grupę trudno wyłączyć pod wpływem impulsu.

Na karcie **Zamrożenie** wybierasz:

- **Zamrożona** — nie możesz edytować ani usunąć grupy i nie możesz odznaczyć jej przełącznika włączania. Aby cokolwiek zmienić, musisz przeprowadzić rytuał odmrożenia (patrz poniżej).
- **Ściśle zamrożone** — takie samo jak Kraina lodu, ale pozostaje zablokowane na wybraną przez Ciebie liczbę godzin (w postaci dziesiętnej, do 72). Dopóki nie upłynie ten czas, nawet rytuał odmrożenia nie będzie dostępny.

Gdy zamrożona grupa będzie możliwa do odblokowania, pojawi się przycisk **Odmroź**. Kliknięcie go rozpoczyna **20-etapowy rytuał**:

- Modal pokazuje komunikat o samodyscyplinie.
- Musisz kliknąć `Confirm` 20 razy.
- Pomiędzy kliknięciami następuje wymuszone 5-sekundowe oczekiwanie.
- Jeśli anulujesz w dowolnym momencie, musisz zacząć od kroku 1.
- 20 wiadomości zmienia się tak, abyś je faktycznie przeczytał.

Jeśli grupa jest również oznaczona jako „bez drzemki” (patrz następna sekcja), nie można jej również odłożyć, gdy jest zamrożona.

Stan zamrożenia jest pokazany w metalinii karty grupy, łącznie z czasem pozostałym do całkowitego zamrożenia.

---

## 9. Drzemka (tymczasowe wyłączenie)

Drzemka tymczasowo wyłącza grupę bez jej odmrażania. Obsługuje opóźnioną aktywację, czas odnowienia po drzemce, kroki potwierdzenia i bieżący całkowity czas drzemki.

Na karcie **Drzemka**:

- **Zezwól na drzemkę dla tej grupy** — jeśli opcja jest wyłączona, tej grupy nie można w ogóle odłożyć (w tym w przypadku zamrożenia).
- **Drzemka na (minuty)** — liczba dziesiętna, jak długo trwa drzemka.
- **Opóźnienie aktywacji (minuty)** — liczba dziesiętna `>= 0`. Po potwierdzeniu drzemki grupa będzie blokować do momentu upłynięcia tego opóźnienia; dopiero wtedy drzemka staje się aktywna.
- **Ochłodzenie po drzemce (minuty)** — liczba dziesiętna od `0` do `5`. Po zakończeniu drzemki nie możesz rozpocząć kolejnej drzemki dla tej grupy, dopóki nie zakończy się czas odnowienia.
- **Godziny zatwierdzeń** — liczba całkowita `>= 0`. Jeśli jest to `0`, drzemka zostanie zaplanowana natychmiast. W przeciwnym razie rozpoczęcie drzemki uruchamia rytuał potwierdzenia składający się z dokładnie takiej liczby kroków.

Każdy krok potwierdzenia drzemki wymaga wymuszonego **5-sekundowego oczekiwania**, zanim możliwe będzie następne kliknięcie. Modal informuje o tym wyraźnie i pokazuje na przycisku odliczanie na żywo.

Jeżeli grupa jest zamrożona, ustawienia drzemki zostają zablokowane na wartościach wybranych przed zamrożeniem. Nadal możesz go odłożyć, o ile drzemka jest dozwolona, ​​ale musisz użyć zapisanych ustawień opóźnienia / odnowienia / potwierdzenia.

Karta Drzemka pokazuje także **Całkowity czas drzemki** dla tej grupy. Ta suma liczy cały czas trwania aktywnego drzemki, nawet jeśli w tym oknie witryna stanie się dostępna z innego powodu.

Po zakończeniu drzemki reguła natychmiast powraca. Jeśli grupa nie została jeszcze zamrożona, rozszerzenie automatycznie ją ponownie blokuje po zakończeniu drzemki.

Komunikat o statusie potwierdza drzemkę. Po zakończeniu drzemki grupa automatycznie powraca do normalnego stanu.

Możesz także wcześniej zakończyć drzemkę za pomocą przycisku **Zakończ drzemkę**.

W przypadku grup niestandardowych naciśnięcie przycisku **Rozpocznij drzemkę** powoduje także wywołanie zdarzenia `snoozePress` w regule (zobacz tabelę zdarzeń w **Sekcji 11**), dzięki czemu reguła niestandardowa może rejestrować prasę, rejestrować uzasadnienie lub uruchamiać zdarzenia uzupełniające. Reguła **nie posiada API programowego drzemki** — może reagować na naciski prasy, ale nie może jej anulować ani przedłużyć.

---

## 10. Akcje zbiorcze- **Usuń wszystko** usuwa każdą grupę.
  - Zawsze prosi o potwierdzenie.
  - Jeśli co najmniej jedna grupa zostanie zamrożona, wymagany jest ten sam 20-etapowy rytuał, co w przypadku odmrożenia.
  - Jeśli jakakolwiek grupa jest ściśle zamrożona i nadal zablokowana, opcja **Usuń wszystko** jest wyłączona.

---

## 11. Grupy niestandardowe — odwołanie oparte na zdarzeniach (wersja 1.1+)

Począwszy od wersji 1.1, reguły niestandardowe są **sterowane zdarzeniami**. Twoja reguła nie jest już funkcją per-heartbeat, której zwracana wartość blokuje stronę. Zamiast tego treść reguły to skrypt, który **rejestruje programy obsługi** dla określonych zdarzeń (otwarcie strony, zmiana adresu URL, puls strony, zdarzenia niestandardowe itp.). Programy obsługi pozostają zarejestrowane podczas nawigacji po stronach i przełączania kart oraz znajdują się w długotrwałym **pozaekranowym piaskownicy**.

Treść reguły jest wykonywana **raz na kliknięcie Uruchom** (lub raz, gdy grupa jest włączona i istnieje już aktywne źródło). Aby ponownie załadować programy obsługi, kliknij **Uruchom** w edytorze. W wyskakującym okienku pojawi się przypomnienie z prośbą o ponowne załadowanie dowolnej już otwartej strony, aby nowa reguła również tam miała zastosowanie.

### 11.1 Podpis reguły

```js
(event, helpers) => {
  // Register handlers here. This function is called exactly once
  // per Run click (or when the group is enabled).
}
```

Dwa argumenty:

- `event` — **rejestr zdarzeń** dla tej grupy. Użyj go do rejestrowania, zastępowania, listowania, zliczania lub wyrejestrowywania programów obsługi oraz do niestandardowych zdarzeń `post(...)`.
- `helpers` — pakiet pomocniczy (patrz **11.3**).

**Nie** oczekuje się, że funkcja zwróci wartość. Decyzja o zablokowaniu lub zezwoleniu zostaje podjęta później, gdy zostanie uruchomione zdarzenie i jeden z zarejestrowanych handlerów wywoła `ev.preventDefault()` i/lub `ev.setResult(...)`.

### 11.2 Cykl życia

- **Uruchom** (przycisk dla grupy w edytorze): silnik najpierw czyści każdą procedurę obsługi, która została wcześniej oznaczona w tej grupie, a następnie ponownie uruchamia treść reguły w piaskownicy poza ekranem. Jest to jedyny sposób na ponowną rejestrację po edycji źródła.
- **Wyłącz grupę**: każdy moduł obsługi oznaczony w tej grupie zostanie wyczyszczony. Źródło grupy jest przechowywane w pamięci, ale przestaje odpowiadać na zdarzenia.
- **Włącz ponownie grupę**: silnik automatycznie ponownie uruchamia aktywne źródło dla tej grupy.
- **Usuń grupę**: to samo co wyłączenie; wszystkie programy obsługi oznaczone grupą są usuwane.
- **Ponowna rejestracja przy użyciu tego samego `(eventType, id)`**: dyskretnie zastępuje poprzednią rejestrację.

Piaskownica poza ekranem jest współdzielona przez **wszystkie** grupy niestandardowe. Współistnieją tam programy obsługi z różnych grup, każdy oznaczony wewnętrznie identyfikatorem własnej grupy, więc „Uruchom”, wyłącz lub usuń dotyka tylko właściwej grupy.

Jeśli niestandardowa reguła działa nieprawidłowo (synchroniczna nieskończona pętla, niekontrolowany spam w dziennikach itp.), piaskownica poddaje ją kwarantannie: grupa zostaje automatycznie wyłączona, a awaria jest rejestrowana, dzięki czemu można ją zobaczyć w panelu Dziennik. Aby ponownie włączyć regułę poddaną kwarantannie, napraw źródło i kliknij **Uruchom** — silnik usunie przyczynę przerwania i ponownie załaduje regułę.

### 11.2.1 Rejestr zdarzeń (`event`)

Metody ogólne:

- `event.register(type, id, handler, options?)` — zarejestruj procedurę obsługi dowolnego typu zdarzenia. `id` to Twój własny wybór. `options.priority` (domyślnie `0`) — najpierw uruchamiane są wyższe. `options.intervalMs` — tylko dla `tickEvent`; dławij tę konkretną procedurę obsługi względem globalnego znacznika. Ponowna rejestracja z tymi samymi nadpisaniami `(type, id)`.
- `event.unregister(type, id)`, `event.unregisterAll(type)`.
- `event.post(type, data?, { scope })` — uruchom niestandardowe zdarzenie. `scope: "global"` dociera do każdej grupy; domyślny `scope: "group"` dociera tylko do programów obsługi w **tej samej** grupie.

Cukier na typ zdarzenia (jeden zestaw metod na każdy typ wbudowany):

- `event.registerTickEvent(id, handler, opts)`, `event.getTickEvent(id)`, `event.getTickEvents()`, `event.countTickRegistered()`.
- `event.registerOpenWebEvent(id, handler, opts)`, `event.getOpenWebEvent(id)`, `event.getOpenWebEvents()`, `event.countOpenWebRegistered()`.
- Ten sam kształt dla `closeWebEvent`, `switchWebEvent`, `switchDomainEvent`, `webChangedEvent`, `pageHeartbeatEvent`, `timerEnded`, `snoozePress`.

### 11.2.2 Wbudowane typy zdarzeń

| Wpisz | Kiedy wystrzeli | Ładunek `ev.data` |
|---|---|---|
| `tickEvent` | Globalnie udostępniany 1-sekundowy tik w całej przeglądarce. Uruchamia się niezależnie od widoczności karty. Użyj tej opcji w przypadku logiki zegarowej, która musi działać nawet wtedy, gdy nie jest aktywowana żadna karta. | `{ intervalMs: 1000 }` |
| `pageHeartbeatEvent` | Puls ~250 ms od zakładki **aktywna**, **widoczna**. Obsługuje całą logikę uwzględniającą widoczność kart, w tym funkcję automatycznego zaznaczania wbudowaną w `getOrCreateTimer({ scope })`. Czy **nie** uruchamia się z kart w tle lub gdy ekran jest zablokowany. | `{ elapsedMs }` |
| `openWebEvent` | Tworzona jest nowa karta LUB nowa nawigacja trafia na adres URL, którego wyszukiwarka jeszcze nie widziała dla tej karty. Czy **nie** uruchamia się ponownie w przypadku już otwartych kart po kliknięciu Uruchom. | `{ previousUrl, isNewTab }` |
| `closeWebEvent` | Karta jest zamknięta. | `{ reason, nextUrl }` |
| `switchWebEvent` | Adres URL **zmienia się** w tej samej zakładce — wstecz/do przodu, zmiana trasy SPA lub nawigacja, która trafia na inny adres URL niż poprzednio. Czy **nie** uruchamia się przy zwykłym przeładowaniu (ten sam adres URL). | `{ previousUrl, previousHostname, sameDomain }` |
| `switchDomainEvent` | Zmiana adresu URL przekracza granicę nazwy hosta (np. `youtube.com` → `wikipedia.org`). Płonie obok `switchWebEvent`. | `{ previousUrl, previousHostname }` |
| `webChangedEvent` | Strona (ponownie) ładuje się w dowolny sposób: otwieranie, przełączanie, aktualizacja historii SPA, **lub zwykłe ponowne ładowanie, które zachowuje ten sam adres URL**. To niezawodny hak „zmieniona strona, przeanalizuj wszystko”. Uruchamia się obok `openWebEvent` / `switchWebEvent` / `switchDomainEvent` i jest jedynym, który uruchamia się w przypadku przeładowania tego samego adresu URL. | `{ previousUrl, previousHostname, sameDomain, isFirstLoad, isReload, transition }` gdzie `transition` to `"tabCreated"`, `"commit"` lub `"history"` |
| `timerEnded` | Timer zarządzany przez grupę osiąga `currentMs === 0`. Dostarczone tylko grupie właścicieli. | `{ timerId, displayName, direction, currentMs }` |
| `snoozePress` | Użytkownik nacisnął **Rozpocznij drzemkę** w wyskakującym okienku dla tej **niestandardowej** grupy. Czyste zdarzenie powiadomienia — moduł obsługi może uruchomić dowolny kod (logowanie, przekierowanie, uruchomienie innych zdarzeń), ale reguły niestandardowe nie mają **braku API programistycznego drzemki**. Wytworzone tutaj kłody pojawiają się jako tosty na aktywnej karcie. Dostarczane tylko do tłoczonej grupy. | `{ triggeredAt }` |

Adresy URL w `ev.url` i dane zdarzeń są **normalizowane** pod kątem zdarzeń: strona nowej karty przeglądarki przeglądarka Chrom (która renderuje powierzchnię Google „Wyszukaj w Google lub wpisz adres URL”), `about:blank` i równoważne schematy nowej karty są prezentowane jako pusty ciąg znaków `""`. Zatem licznik czasu o zakresie `ev.url === ""` odmierza czas tylko wtedy, gdy jesteś na stronie nowej karty. Zwykłe adresy URL `google.com` pozostają niezmienione.

### 11.2.3 Obiekt zdarzenia (`ev`)

Każdy moduł obsługi jest wywoływany jako `(ev, helpers) => void`. `ev` przenosi:

- `ev.type` — typ wywoływanego zdarzenia.
- `ev.groupId` — identyfikator grupy odbiorczej.
- `ev.tabId`, `ev.pageId`, `ev.url`, `ev.hostname` — kontekst wydarzenia.
- `ev.time` — migawka `{ now, month, dayOfMonth, dayName, hour, minute }` w chwili wysyłki. `dayName` to `"Sunday"`..`"Saturday"`.
- `ev.data` — ładunek specyficzny dla zdarzenia (patrz tabela powyżej).

Metody:

- `ev.preventDefault()` — oznacz przesyłkę jako „zablokowaną”. Skrypt treści hosta opuści stronę (lub zastosuje się do `setRedirectLink`), chyba że procedura obsługi o wyższym priorytecie ustawi później `setResult(1)`.
- `ev.stopPropagation()` — natychmiast zatrzymaj tę wysyłkę. **W przypadku tego zdarzenia nie są wywoływane żadne dalsze procedury obsługi w żadnej grupie**.
- `ev.setResult(value)` — ustaw wynik wysyłki. `value` może być **liczbą** w `[-255, 255]` (blok `-1`, neutralny `0`, zezwolenie `1`; inne liczby całkowite są zachowywane na potrzeby własnej logiki debugowania) lub **ciąg znaków** (interpretowany jako adres URL przekierowania). Ostatnie wywołanie `setResult` we wszystkich programach obsługi wygrywa. Wartość liczbowa `1` zastępuje wszelkie wcześniejsze wartości `preventDefault`.
- `ev.setRedirectLink(url)` / `ev.getRedirectLink()` — adres URL, pod który host powinien przejść, gdy wysyłka zakończy się jako zablokowana. Jest to **jedyny** sposób na przekierowanie z reguł niestandardowych; edytor nie wyświetla już pola „Przekieruj adres URL po zablokowaniu” dla grup niestandardowych.
- `ev.post(type, data, { scope })` — uruchamia zdarzenie uzupełniające z wnętrza modułu obsługi.

Ponadto `ev` jest serwerem proxy: każde pole, które na nim ustawisz (np. `ev.foo = 42`) jest przechowywane na mapie `custom` i może zostać odczytane z tego samego modułu obsługi lub z kolejnych procedur obsługi w tej samej wysyłce.### 11.3 Obiekt `helpers`

Każde wywołanie modułu obsługi otrzymuje nowy pakiet `helpers` ograniczony do grupy odbierającej i adresu URL zdarzenia. Pola stałe:

- `helpers.now` — milisekundy epoki w chwili wysłania.
- `helpers.currentUrl` — adres URL zdarzenia, po normalizacji nowa karta/puste miejsce.
- `helpers.groupId` — identyfikator grupy odbiorczej.

Wygodne skróty (trasa do tych samych funkcji obsługujących akumulatory, których używają pomocnicy poniżej, dzięki czemu dane wyjściowe nadal trafiają do panelu dziennika):

- `helpers.log(...)`, `helpers.warn(...)`, `helpers.error(...)`.

Metody akcesorów:

- `helpers.getLogHelper()` — `log` / `warn` / `error`. Dane wyjściowe są ograniczone szybkością i limitowane na wysyłkę, aby zapobiec blokowaniu wyskakujących okienek przez niekontrolowane reguły.
- `helpers.getDomainHelper()` (alias `helpers.getDomainUtility()`) — kontrola adresu URL (patrz **11.3.5**).
- `helpers.getTimerHelper()` — timery o zasięgu grupowym (odliczanie/odliczanie); stan utrzymuje się po ponownym uruchomieniu przeglądarki.
- `helpers.getPersistenceHelper()` — magazyn kluczy/wartości JSON o zasięgu grupy.
- `helpers.getRedirectionHelper()` — `setRedirectLink(url)` / `getRedirectLink()` (oraz aliasy `set` / `get`) plus `createMessageUrl(message)`, która zwraca adres URL `chrome-extension://...` wyświetlający dany komunikat.
- `helpers.getPlatformHelper()` — intencje DOM na platformę (patrz **11.3.6**).
- `helpers.getDOMHelper()` — ogólne intencje DOM: `hide(sel)`, `show(sel)`, `addClass(sel, c)`, `removeClass(sel, c)`, `setText(sel, text)`, `click(sel)`, `injectCss(css, id?)`, `removeInjectedCss(id)`, `scrollTo(sel)`. Operacje są grupowane i stosowane po powrocie procedury obsługi.
- `helpers.getNavigationHelper()` — `back()`, `forward()`, `reload()`, `goTo(url)`, `closeTab()`. Efekty są stosowane do karty, z której pochodzi wydarzenie.
- `helpers.getStorageHelper()` — nadzbiór `getPersistenceHelper` plus asynchroniczne haki `requestAsyncGet(key)` / `requestAsyncSet(key, value)` do przechowywania z rozszerzeniem krzyżowym (wyniki pojawiają się jako kolejne niestandardowe zdarzenie).
- `helpers.getTabHelper()` — `list()`, `getActiveTab()`, `getById(id)`, `countOpen()` względem migawki dołączonej do wydarzenia.

Wszystkie metody pomocnicze są bezpieczne: złe parametry zwracają `null`, `false` lub pustą wartość zamiast rzucać.

#### 11.3.1 `getTimerHelper()`

Timery dla poszczególnych grup. Każdy timer jest identyfikowany przez wybrany ciąg `id`; tożsamość jest ograniczona do grupy, zatem dwie grupy mogą używać identyfikatora `"yt-shorts"` bez kolizji. Stan utrzymuje się po ponownym uruchomieniu przeglądarki.

Utrwalony stan licznika czasu to dokładnie: `id`, `displayName`, `direction` (`"forward"` lub `"backward"`), `isPaused` i `currentMs`. Nie ma zapisanego „początkowego czasu trwania” — `isExpired` to po prostu `currentMs === 0`. Liczniki czasu do przodu odliczają czas w nieskończoność i nigdy nie wygasają same. Zegary wsteczne przestają tykać w `0` (brak wartości ujemnych).

Istnieją dwie metody budowy. Wybierz ten, którego semantyka pasuje do tego, czego chcesz:

- `create({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **zawsze (ponownie) tworzy** licznik czasu z dostarczonymi wartościami początkowymi, zastępując każdy istniejący stan, w tym `currentMs`. Użyj tego, gdy masz na myśli „zacznij od nowa”, np. wewnątrz gałęzi resetowania jednorazowego.
- `getOrCreateTimer({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **idempotentny**. Jeśli licznik czasu z tym `id` już istnieje, jego `displayName` i `direction` mogą zostać zaktualizowane, ale `currentMs` zostanie zachowane. W przeciwnym razie jest tworzony przy użyciu podanych wartości początkowych. Tego właśnie chcesz w przypadku typowego wzorca „upewnij się, że mój timer istnieje, a następnie pozwól mu zaznaczyć”.

Obie metody akceptują dwie funkcje predykatów, które silnik zapamiętuje przez cały okres obowiązywania reguły (przetrwają uderzenia serca i ponowne oceny `webChangedEvent`, ale **nigdy nie są utrwalane** w pamięci):- `scope: (url) => boolean` — gdy `true` dla aktualnie widocznego adresu URL na każdym `pageHeartbeatEvent`, licznik czasu automatycznie odmierza czas trwania pulsu (~250 ms). Sam pomocnik nigdy nie blokuje; aktualizuje tylko `currentMs`. Maksymalnie jedno automatyczne zaznaczenie na uderzenie serca na timer.
- `domain: (url) => boolean` — gdy `true` dla aktualnie widocznego adresu URL, licznik czasu jest renderowany w nakładce na stronie (w lewym górnym rogu). Gdy pominięto `domain`, silnik powraca do wyświetlania `scope`, więc licznik czasu „tick on /shorts/pages” również pojawia się tam bez dodatkowego okablowania. Podaj jawnie `domain`, jeśli chcesz inną bramkę wyświetlacza (np. zaznacz tylko na `/shorts/`, ale pokaż pozostały czas we wszystkich `youtube.com`).

> **Ważne — licznik czasu nigdy nie blokuje się sam.** Kiedy licznik czasu wstecz osiągnie zero, po prostu zatrzymuje się na zero i uruchamia raz `timerEnded`. To, czy faktycznie zablokować stronę, zależy od osobnej procedury obsługi `openWebEvent` / `switchWebEvent`, która wywołuje `ev.preventDefault()` po sprawdzeniu `helpers.getTimerHelper().isExpired(id)`. Ta separacja umożliwia budowanie liczników czasu „tylko ostrzegających”, modułów śledzących zliczanie, miękkich szturchnięć lub twardych bloków — ten sam prymityw, według własnego wyboru.

Inne metody:

- `delete(id)`, `pause(id)`, `resume(id)` — standardowy cykl życia. Wstrzymanie zawiesza `currentMs`.
- `setDirection(id, "forward" | "backward")`, `setCurrentMs(id, ms)`, `addMs(id, deltaMs)` — mutatory bezpośrednie (większość reguł ich nie potrzebuje — niech puls tyka za ciebie).
- `setDisplayName(id, name)` — zmień etykietę.
- `getCurrentMs(id)`, `getDirection(id)`, `getDisplayName(id)`, `isPaused(id)`, `exists(id)`.
- `isExpired(id)` — `true` w przypadku `currentMs === 0`.
- `getState(id)` — `{ id, displayName, direction, isPaused, currentMs, isExpired }` lub `null`.
- `list()` — każdy licznik czasu będący własnością tej grupy, jako tablica obiektów stanu.

#### 11.3.2 `getPersistenceHelper()`

Magazyn przypominający mapę, ograniczony do Twojej grupy. Wartości muszą umożliwiać serializację JSON.

- `set(key, value)`, `get(key, defaultValue?)`, `has(key)`, `delete(key)`, `keys()`, `entries()`, `clear()`, `size()`.

Limity miękkie: około 200 kluczy na grupę, 16 KB na wartość.

#### 11.3.3 `getLogHelper()`

- `log(...args)`, `warn(...args)`, `error(...args)` — napisz do panelu **Log** w wyskakującym okienku (pakiet pomocniczy nadal kieruje je przez ten sam akumulator, niezależnie od tego, która wysyłka je wygenerowała). Każda linia jest poprzedzona prefiksem `[CustomBlocker:groupId]`.
- Pomocnik ma twarde ograniczenia: około **200 wpisów dziennika na wysyłkę** i maksymalna długość ciągu na wpis. Nadmiar wpisów jest usuwany i zliczany w `accumulator.logsDropped`. To właśnie chroni wyskakujące okienko przed ucieczką `for (let i = 0; i < 100000; i++) helpers.log(i)`.
- Gdy **Tryb debugowania** jest wyłączony (domyślnie), wpisy na poziomie śledzenia emitowane przez sam silnik (czas rozpoczęcia wysyłki / procedury obsługi) są wszędzie pomijane — nie są wyświetlane w panelu dziennika i nie są drukowane na konsoli. Twoje własne połączenia `log` / `warn` / `error` są zawsze realizowane.

#### 11.3.4 `getRedirectionHelper()`

Sprawdź/zastąp adres URL przekierowania, którego użyje skrypt treści, jeśli bieżąca strona zostanie zablokowana.

- `get()` — zwraca aktualny efektywny adres URL przekierowania dla tej wysyłki. Początkowo jest to skonfigurowany zastępczy adres URL grupy wbudowanej (jeśli istnieje), w przeciwnym razie `""`.
- `set(url)` — zastępuje adres URL przekierowania dla tej wysyłki. Zwraca `true` w przypadku powodzenia, `false` w przypadku wprowadzania danych innych niż ciąg. Przekazanie `""` czyści zastąpienie przekierowania i powraca do normalnego domyślnego zachowania wyjścia.
- `createMessageUrl(message)` — zwraca adres URL `chrome-extension://<id>/message-page.html?msg=...`, który po przejściu do wyświetla komunikat wyśrodkowany na czystej stronie. Przydatne do przekierowywania użytkowników do ekranu „Idź do pracy” / „Zrób sobie przerwę” po upływie określonego czasu. Przykład: `ev.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Go Work"))`.

Podobnie jak inne skutki uboczne reguł niestandardowych, ten stan jest wspólny dla wszystkich reguł w bieżącej wysyłce. Ponieważ reguły działają od dołu do góry, wygrywa reguła znajdująca się najwyżej, wywołująca `set(...)`.

#### 11.3.5 `getDomainHelper()` (alias `getDomainUtility()`)

Pomocnicy do sprawdzania adresów URL. Nie ma `normalize()`, ponieważ przychodzące adresy URL są już znormalizowane w nowej karcie.

Rdzeń:- `hostnameOf(url)`, `pathnameOf(url)`, `matches(hostname, site)`, `getPlatform(url)`.
- `isYouTubeHost`, `isTikTokHost`, `isInstagramHost`, `isFacebookHost`, `isTłiczHost`, `isRedditHost`, `isDyskordHost`.
- `youtube()`, `tiktok()`, `instagram()`, `facebook()`, `twitch()` — każdy zwraca `{ isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId }`.

Filtrowanie adresów URL i pomocnicy sekcji:

- `isEmptyStartPage(url)` — `true` dla strony nowej karty i jej odpowiedników (adresy URL wyświetlane w programach obsługi jako `""`).
- `matchesAny(url, patterns)` — `patterns` może być wyrażeniem regularnym, wyrażeniem regularnym łańcuchowym lub tablicą obu.
- `pathStartsWith(url, path)` — obsługujący granice (`pathStartsWith("/r/", "/r")` ma wartość true; `"/results/"` nie).
- `queryHas(url, key, value?)`, `queryGet(url, key)` — kontrola ciągu zapytań.
- `isSearchPage(url)` — rozpoznaje wyszukiwania w Google / Bing / DuckDuckGo / Jutub / forum społeczności / Twiterze / X.
- `isInfiniteFeedUrl(url)` — rozpoznaje platformy obsługujące algorytmy Jutub, krótkie wideo, sieć zdjęć, Fejsbuk, forum społeczności, X.
- `sameSection(a, b)` — ta sama nazwa hosta ORAZ ten sam pierwszy segment ścieżki.

#### 11.3.6 `getPlatformHelper()`

Intencje DOM dla poszczególnych platform i liczniki czasu podsekcji oraz inspekcja. Każdy `helpers.getPlatformHelper().<platform>()` zwraca obiekt, którego zestaw metod jest **bramkowany przez platformę** — metod, które nie mają sensu na danej platformie, po prostu nie ma, więc wywołanie ich powoduje wygenerowanie `TypeError: ... is not a function`, zamiast cichego braku działania. Na przykład `twitch().hidePosts` nie istnieje (Tłicz nie ma postów) i `tiktok().hideShortButton` nie istnieje (całe doświadczenie krótkiego wideo to już _krótki film). Użyj `helpers.getPlatformHelper().hasMethod(platform, name)` lub `.listMethods(platform)` do introspekcji w czasie wykonywania.

Macierz metod dla poszczególnych platform:

| metoda | Jutub | tiktok | instagramie | facebooku | drgać |
|---|:---:|:---:|:---:|:---:|:---:|
| `hideShorts` / `showShorts` | ✓ |  |  |  |  |
| `hideReels` / `showReels` |  |  | ✓ | ✓ |  |
| `hideClips` / `showClips` |  |  |  |  | ✓ |
| `hideStreams` / `showStreams` |  |  |  |  | ✓ |
| `hideVideos` / `showVideos` | ✓ | ✓ |  | ✓ | ✓ (VOD) |
| `hidePosts` / `showPosts` | ✓ |  | ✓ | ✓ |  |
| `hideShortButton` / `showShortButton` | ✓ |  |  |  |  |
| `hideHomePage` / `showHomePage` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `hideComments` / `showComments` | ✓ | ✓ | ✓ | ✓ | ✓ (czat) |
| `filterComments` | ✓ | ✓ | ✓ | ✓ |  |
| `hideLive` / `showLive` / `filterLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isCurrentChannelSubscribed` / `isChannelSubscribed` | ✓ |  |  |  | ✓ |
| `isCurrentChannelVerified` | ✓ |  |  |  |  |
| `isLiveNow` | ✓ | ✓ |  | ✓ | ✓ |
| `isItemLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isAlgorithmicRecommendation` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `isSponsored` | ✓ | ✓ | ✓ | ✓ |  |
| `setShortsTimer` | ✓ |  |  |  |  |
| `setReelsTimer` |  |  | ✓ | ✓ |  |
| `setClipsTimer` |  |  |  |  | ✓ |
| `setStreamsTimer` |  |  |  |  | ✓ |
| `setVideosTimer` | ✓ | ✓ |  | ✓ | ✓ |
| `setPostsTimer` | ✓ |  | ✓ | ✓ |  |

Nazwy natywne dla platformy (`hideReels`, `hideClips`, `hideStreams`) NIE są oddzielnymi zasobnikami od `hideShorts` / `hideVideos` — miejsce przechowywania jest takie samo; tylko nazwa widoczna dla użytkownika jest zgodna z terminologią każdej platformy.

> **Czas istnienia predykatu i zasada pojedynczego gniazda.** Każdy z `hideShorts` / `hideReels` / `hideClips` / `hideStreams` / `hideVideos` / `hidePosts` / `filterComments` / `filterLive` posiada **jeden** trwały predykat na `(group, platform, slot)`. Predykat **nie** jest ograniczony do bieżącego zdarzenia — po jego ustawieniu pozostaje aktywny przy każdym ładowaniu strony i każdym wysłaniu do czasu wywołania pasującego `show*()` lub wyładowania grupy. Ponowne wywołanie tej samej metody za pomocą nowej funkcji **zastępuje** poprzednią — silnik nigdy nie łączy LUB wielu predykatów w jednej grupie. Aby połączyć warunki, napisz jeden predykat, który sam dokona łączenia, np. `yt.hideVideos(item => isShort(item) || hasKeyword(item))`. W **różnych** grupach każda grupa wnosi swój własny predykat, a element jest ukryty, jeśli predykat dowolnej grupy pasuje.

Metody inspekcji czerpią swoją wartość w momencie wysyłki ze migawki dołączonej do zdarzenia; ich dostępność jest bramkowana przez powyższą macierz.

Klasyfikatory adresów URL są zawsze ponownie eksponowane niezależnie od platformy: `isPlatformUrl`, `isShortUrl`, `isVideoUrl`, `isPostUrl`, `isHomePage`, `extractAuthor`, `extractVideoId`.Liczniki podsekcji rejestrują licznik czasu w segmencie trwałej grupy i, jeśli mają określony zakres, zaznaczają tylko adresy URL pasujące do tej podsekcji. Metody timera akceptują `{ id, direction, currentMs, displayName }` i korzystają z tego samego bramkowania dla poszczególnych platform.

W przypadku metod predykatów predykat jest wywoływany na pasującą kartę ze znormalizowaną wartością `item`: `{ url, name, author, length, views, publishedAt, description, live?, sponsored?, algorithmic? }`. Dowolne pole może mieć wartość `null`; „niewinny do czasu udowodnienia winy” — zwróć `false`, gdy brakuje potrzebnego pola.

### 11.4 Przykłady

**Łatwe** — blokuj strony Jutub Shorts w dni powszednie:

```js
(event, helpers) => {
  const yt = helpers.getDomainHelper().youtube();

  function maybeBlock(ev) {
    if (!yt.isShortUrl(ev.url)) return;
    const { dayName, hour } = ev.time;
    const weekday = !["Saturday", "Sunday"].includes(dayName);
    if (weekday && hour >= 9 && hour < 12) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }

  event.registerOpenWebEvent("morning-block", maybeBlock);
  event.registerSwitchWebEvent("morning-block", maybeBlock);
}
```

**Średni** – 30-minutowy budżet dzienny na Jutub Shorts. Licznik czasu w `pageHeartbeatEvent` odlicza się automatycznie, gdy widoczny jest adres URL Shorts; oddzielny moduł obsługi wymusza blok, gdy licznik czasu osiągnie zero.

```js
(event, helpers) => {
  const TIMER_ID = "yt-shorts-budget";
  const yt = helpers.getDomainHelper().youtube();
  const onShorts = (url) => yt.isShortUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: 30 * 60 * 1000,
    displayName: "YT Shorts",
    scope: onShorts,
    domain: onShorts
  });

  function maybeBlock(ev, h) {
    if (!yt.isShortUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.setRedirectLink("https://example.com/focus");
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("budget-block", maybeBlock);
  event.registerSwitchWebEvent("budget-block", maybeBlock);

  event.registerTimerEndedEvent("budget-warn", (_ev, h) => {
    h.getLogHelper().log("Budget hit zero.");
  });
}
```

**Trudniej** — ukryj poszczególne filmy Short w Jutub, których nazwa autora jest za długa, i wstrzyknij kod CSS „ten film Short jest ukryty”:

```js
(event, helpers) => {
  const MAX_AUTHOR_LEN = 16;

  function configure(_ev, h) {
    const yt = h.getPlatformHelper().youtube();
    yt.hideShorts(
      (item) => item.author && item.author.length > MAX_AUTHOR_LEN,
      { blockPageOnVisit: true }
    );
    h.getDOMHelper().injectCss(
      "ytd-rich-grid-media[data-cb-hidden] { opacity: 0.2 !important; }",
      "long-author-label"
    );
  }

  event.registerOpenWebEvent("hide-long-shorts", configure);
  event.registerSwitchWebEvent("hide-long-shorts", configure);
  event.registerWebChangedEvent("hide-long-shorts", configure);
}
```

**Najtrudniejszy** — transmituj zdarzenie niestandardowe od jednego modułu obsługi do innych:

```js
(event, helpers) => {
  event.registerSwitchDomainEvent("track-domain", (ev) => {
    ev.post("domainChange", { from: ev.data.previousHostname, to: ev.hostname });
  });

  event.register("domainChange", "log-it", (ev, h) => {
    h.getLogHelper().log("crossed", ev.data.from, "→", ev.data.to);
  });
}
```

---

## 12. Szablony

Każda grupa niestandardowa ma selektor **Szablony**, który otwiera przeglądarkę gotowych przeszukiwań. Biblioteka zawiera teraz **ponad 50 szablonów** podzielonych na dziewięć kategorii, dzięki czemu możesz przeglądać zamiast pisać reguły od zera:

| Kategoria | Przykłady |
|---|---|
| **Timery** | Budżet czasu witryny (odliczanie + blokowanie), moduł śledzenia czasu witryny (odliczanie), limit Jutub Shorts, limit kanałów krótkie wideo, limit sieć zdjęć Reels, limit Fejsbuk Reels, limit Tłicz Clips, uniwersalny budżet na rozrywkę, codzienny moduł do śledzenia głębokiej pracy |
| **Harmonogram** | Blokada godzin pracy w dni powszednie, witryny tylko w weekendy, wyłączenie przed snem, zezwolenie tylko na jedną godzinę, wiadomości tylko w porze lunchu, świeży start w poniedziałek, zezwolenie na pierwsze N ​​minut każdej godziny, ścisła blokada dotycząca głębokiej pracy |
| **Kanał / Szorty** | Blokuj adresy URL Jutub Shorts, ukryj karty Shorts, ukryj Shorts według słów kluczowych, ukryj kanał główny Jutub / komentarze / trendy, zablokuj krótkie wideo FYP, ukryj Shorty krótkie wideo, zablokuj adresy URL sieć zdjęć Reels, ukryj kanał sieć zdjęć Reels, ukryj kanał / Reels na Fejsbuku, ukryj stronę główną forum społeczności / Twiter / LinkedIn |
| **Przekierowanie** | Rozproszenia → strona fokusowa, Shorts → /feed/subscriptions, reddit.com → old.reddit.com, twitter / x → Nitter, nowa karta → lista zadań |
| **Skupienie** | Sesja fokusowa dostępna tylko na liście dozwolonych, Pomodoro 25/5, blokada podczas spotkania, blokada po N wizyt dzisiaj, blokada w przypadku utraty passy |
| **Szturchnięcie** | Rejestruj każdą odwracającą uwagę wizytę, ostrzegaj przy każdej wizycie w Shorts, licz codzienne wizyty na stronie |
| **Trwałość** | Miesięczny limit odwiedzin, przełącznik cotygodniowego bana, śledzenie odwiedzonych kanałów Dyskord |
| **Ulepszenia DOM** | Ukryj przełącznik automatycznego odtwarzania Jutub, ukryj Twiter / X „Co się dzieje”, ogólne „ukryj selektory w witrynie” |
| **Debugowanie** | Odliczanie wersji demonstracyjnej (3 s), rejestrowanie każdego niestandardowego zdarzenia |

Filtruj żetony na górze selektora zawęź listę według kategorii (`Timer`, `Schedule`, `Feed`, …) i platformy (`Jutub`, `krótkie wideo`, `sieć zdjęć`, …). Wybór szablonu:

1. Ładuje wprowadzone parametry (adres URL, minuty, zakresy godzin itp.) do małego formularza.
2. **Zastosuj ustawienie wstępne** umożliwia podgląd wygenerowanego źródła.
3. Po potwierdzeniu **Zastąpić obecną regułę niestandardową tym ustawieniem?**, źródło zostanie zapisane w edytorze.
4. Następnie kliknij **Uruchom**, aby zarejestrować procedury obsługi reguły w piaskownicy poza ekranem.

Szablony są zdefiniowane w `templates/*.js` (`timers.js`, `schedule.js`, `feed.js`, …). Każdy plik wywołuje `CB_REGISTER_TEMPLATES([...])` w czasie ładowania, a wyskakujące okienko zużywa połączoną listę. Dodanie nowego szablonu oznacza wpisanie jednego wpisu do odpowiedniego pliku – żadnej innej instalacji.

---

## 13. Zachowanie wielostronicowe- Wszystkie otwarte karty w tej samej grupie mają ten sam licznik czasu.
- Kiedy przełączysz się na kartę w tej samej grupie, jej nakładka zostanie natychmiast odświeżona, aby pokazać bieżący wspólny czas.
- Liczniki czasu z regułami niestandardowymi zaznaczają tylko kartę **aktywne widoczne** — sterowane przez `pageHeartbeatEvent`. Karty w tle i zminimalizowane okna nie powodują ich przesuwania. Odpowiada to domyślnemu odliczaniu grupy bloków.
- Po dodaniu nowej reguły każda otwarta strona wykrywa zmianę i ponownie ocenia ją w ułamku sekundy; **ale** nowo zarejestrowane programy obsługi nie „otwierają” już otwartych zakładek z mocą wsteczną. Z tego powodu wyskakujące okienko wyświetla przypomnienie o ponownym załadowaniu po każdym uruchomieniu.
- Po wygaśnięciu reguły ukryte karty kanałów i przyciski nawigacyjne zostaną przywrócone przy następnym odświeżeniu.

---

## 14. Ustawienia

Otwórz okno dialogowe **Ustawienia** za pomocą ikony koła zębatego na górnym pasku.

- **Interwał pulsu** — jak często skrypt treści raportuje czas tabulatora i dyski `pageHeartbeatEvent`. Domyślnie 250 ms. Niższe wartości są bardziej responsywne, ale zużywają więcej procesora.
- **Interwał zaznaczania** — jak często uruchamia się globalny `tickEvent`. Domyślnie 1000 ms.
- **Tryb debugowania** — domyślnie *wyłączony*. Gdy *włączony*, silnik emituje wpisy na poziomie śledzenia do panelu dziennika (`[trace] dispatchEvent`, `[trace] N handler(s)`) i wiersze `[CustomBlocker:trace]` do konsoli przeglądarki. Zostaw to w codziennym użytkowaniu; włącz go podczas diagnozowania nieprawidłowego działania reguły. `pageHeartbeatEvent` jest wykluczony z rejestrowania śledzenia nawet wtedy, gdy włączony jest tryb debugowania, ponieważ uruchamia się cztery razy na sekundę i zagłusza resztę.

---

## 15. Internacjonalizacja

Cały interfejs użytkownika jest przetłumaczony. Użyj selektora **Język** w prawym górnym rogu.

Obsługiwane języki to angielski, chiński (uproszczony), hiszpański, japoński, koreański, a także częściowe pokrycie dla hindi, arabskiego, bengalskiego, portugalskiego, rosyjskiego, pendżabskiego, niemieckiego, francuskiego, tureckiego, wietnamskiego, włoskiego, tajskiego, holenderskiego, polskiego, indonezyjskiego, urdu i perskiego. Języki z częściowym pokryciem wracają do języka angielskiego w przypadku brakujących ciągów.

Sama instrukcja obsługi ładuje plik przeceny pasujący do wybranego języka, z językiem angielskim jako rezerwowym.

---

## 16. Komunikaty o statusie

Komunikaty o stanie pojawiają się w postaci wyśrodkowanego tostu, który znika po około dwóch sekundach:

- „Zapisane zmiany”.
- "Utworzono \"Nazwę grupy\"."
- „Załadowano niestandardową regułę — N aktywnych procedur obsługi. Aby zastosować tę regułę na już otwartych kartach, załaduj je ponownie.”
- Błędy sprawdzania poprawności, takie jak „Dozwolone minuty muszą być liczbą większą niż 0”.
- „Minuty drzemki muszą być liczbą większą niż 0.”
- „Zamrożonych grup nie można zmienić.”

W przypadku pól wejściowych z wymaganiami dotyczącymi formatu komunikat pojawia się także obok odpowiedniego przycisku (dla drzemki).

---

## 17. Prywatność i przechowywanie

- Wszystko jest przechowywane lokalnie w `chrome.storage.local`. Żadne dane nie są nigdzie przesyłane.
- Przechowywane elementy obejmują: Twoje grupy, liczniki użytkowania, czasy ostatniego resetowania, zapisy drzemki, niestandardowe liczniki czasu i niestandardowe wartości trwałe.
- Rozszerzenie nie odczytuje zawartości strony poza tym, co jest potrzebne do wykrycia typu strony (ścieżka / nazwa hosta / znane znaczniki DOM dla witryn wideo) i do oceny predykatów napisanych przez użytkownika. Nie czyta Twoich wiadomości, postów, komentarzy ani treści prywatnych.

---

## 18. Uprawnienia

- `storage` – dla danych powyżej.
- `declarativeNetRequest` — do natywnego blokowania grup `Default`.
- `alarms` — aby efektywnie planować przejścia reguł.
- `tabs`, `webNavigation` — do wykrywania tworzenia zakładek, zmian adresów URL i pulsu strony w celu wysyłania zdarzeń.
- `offscreen` — do obsługi długowiecznej piaskownicy z regułami niestandardowymi.
- `host_permissions: <all_urls>` — dzięki czemu skrypt treści może wyświetlać nakładkę licznika czasu i wykrywać kontekst platformy na dowolnej stronie.

---

## 19. Rozwiązywanie problemów- **Dodana przeze mnie grupa nic nie robi.** Upewnij się, że grupa jest włączona, harmonogram na to pozwala, drzemka nie jest aktywna i (w przypadku grup platform) strona faktycznie pasuje do wybranego typu treści i filtra autora.
- **Zegar zatrzymał się lub jest nieprawidłowy na jednej karcie.** Przełącz się i cofnij lub skoncentruj kartę — powoduje to wymuszone odświeżenie udostępnionego licznika czasu.
- **Karty kanałów pojawiają się ponownie, gdy uważam, że powinny być ukryte.** Ukrywanie kanałów działa tylko wtedy, gdy reguła aktywnie blokuje. Jeśli masz regułę `after-minutes`, ukrywanie kanałów rozpoczyna się, gdy Twój czas osiągnie zero.
– **Przycisk nawigacyjny Jutub, który powinien być ukryty, nadal jest tam widoczny.** Ukrywanie nawigacji wymaga ustawienia reguły na „nie filtruj według autora” i typu treści na Shorts lub Posty w Jutub. W przypadku filtrów autorskich ukrywanie odbywa się tylko dla poszczególnych kart.
- **Reguła niestandardowa nic nie zrobiła lub wyrzuciła cicho.** Otwórz Ustawienia → włącz **Tryb debugowania**, następnie kliknij ponownie **Uruchom** i obejrzyj panel Dziennik. Linie z prefiksem `[trace]` pokazują każdą wysyłkę i osobę obsługującą. Użyj `helpers.getLogHelper().log(...)`, aby dodać własne punkty śledzenia. Jeśli źle działająca reguła jest automatycznie poddawana kwarantannie, napraw źródło i kliknij Uruchom — Uruchom powoduje usunięcie przyczyny przerwania.
- **Moja nowa reguła niestandardowa nie wpływa na już otwarte karty.** Załaduj je ponownie. Niestandardowe reguły są dołączane do *przyszłych* zdarzeń na stronie; wyskakujące okienko pokazuje przypomnienie o ponownym załadowaniu po każdym uruchomieniu.
- **Mój licznik czasu nie przyspiesza.** Zegary z regułami niestandardowymi zaznaczają się tylko na karcie **aktywne widoczne** za pośrednictwem `pageHeartbeatEvent`. Karty w tle, zminimalizowane okna i zablokowane ekrany wstrzymują je zgodnie z projektem — takie samo zachowanie jak domyślne odliczanie grup bloków.
- **Nie mogę usunąć grupy.** Prawdopodobnie jest zamrożona. Grupy ściśle zamrożone nie mogą zostać w ogóle usunięte, dopóki ich blokada nie wygaśnie; grupy nieściśle zamrożone można usunąć poprzez rytuał odmrożenia.
- **Wyskakujące okienko wyświetla komunikat „Uruchomiony…” na zawsze.** Niestandardowa reguła prawdopodobnie wpadła w błędne koło. Silnik wyłącza go po twardym przekroczeniu limitu czasu i poddaje regułę kwarantannie. Otwórz panel dziennika, aby podać przyczynę przerwania; napraw regułę i kliknij Uruchom.

---

## 20. Słowniczek

- **Grupa bloków** — jeden zestaw reguł z własnym typem, zachowaniem, harmonogramem i blokowaniem/odkładaniem.
- **Natychmiastowe blokowanie** — reguła blokuje się natychmiast, gdy jest aktywna.
- **Blokada po minutach** — reguła rozpoczyna blokowanie dopiero po wyczerpaniu budżetu czasu na dany okres.
- **Interwał resetowania** — jak często resetowany jest budżet minutowy.
- **Harmonogram** — dni + okna czasowe, w których grupa jest aktywna.
- **Zamrożenie / Ścisłe zamrożenie** – stany zabezpieczające przed manipulacją.
- **Drzemka** — tymczasowe wyłączenie z konfigurowalnym rytuałem potwierdzenia.
- **Filtr autora** — w przypadku grup platform ogranicza regułę do niektórych twórców treści.
- **Typ treści** — w przypadku grup platform ogranicza regułę do określonych form treści (krótka, długa, post).
- **Helpers** — narzędzia przekazywane do modułu obsługi reguły niestandardowej.
- **Platforma** — jedna z `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Każdy ma swój własny typ grupy i logikę ukrywania paszy.
- **Heartbeat** — ~250 ms `pageHeartbeatEvent` wysyłane z aktywnej widocznej karty.
- **Zaznacz** — 1 s współdzielona globalnie `tickEvent` (niezależnie od widoczności).
- **Tryb debugowania** — ustawienie wyświetlające wewnętrzne rejestrowanie śladów w panelu dziennika i konsoli przeglądarki.
- **Kwarantanna** — automatyczne wyłączenie niestandardowej reguły, która przekroczyła limit bezpieczeństwa czasu działania (termin, logowanie spamu,…). Wyczyszczone w następnym uruchomieniu.

---

## 21. Ograniczenia- Ukrywanie kanałów zależy od aktualnego DOM każdej platformy. Jeśli platforma zmieni swój układ, może zaistnieć potrzeba aktualizacji ukrywanych selektorów.
— Wykrywanie kontekstu platformy w witrynach innych niż Jutub opiera się głównie na adresach URL, dlatego jest najbardziej niezawodne w przypadku adresów URL treści kanonicznych.
- Zegary reguł niestandardowych tykają z rozdzielczością pulsu (~250 ms). Nie polegaj na nich w przypadku pomiaru czasu poniżej sekundy.
- Predykaty przekazywane do `hideShorts` / `hideVideos` / `hidePosts` są oceniane synchronicznie dla każdej karty źródła. Ciężka logika w predykacie może spowolnić przewijanie kanału; żeby były tanie.
- Dwie zakładki edytujące ten sam licznik czasu dla każdej grupy jednocześnie korzystają ze strategii „wygrywa ostatni zapis”. Do typowego użytku jest to w porządku; jeśli polegasz na dokładnej księgowości, spodziewaj się sporadycznych niewielkich odchyleń.
- Przeglądarka może zawiesić pracownika usługi działającej w tle, gdy jest bezczynny. Rozszerzenie wznawia je, gdy tylko potrzebuje tego strona lub alarm; Budżety użytkowania witryny/czasu są stale zliczane poprzez odtwarzanie pulsu.

## Uwaga v1.2

Edytor reguł niestandardowych koloruje teraz składnię język skryptowy, a przeglądarka szablonów używa tych samych kolorów w podglądach kodu. Zbiorcza akcja grup nazywa się **Wyczyść**.

