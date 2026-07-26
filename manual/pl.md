# Odniesienie do funkcjonalności rozszerzenia Vault

## Cel i status

To jest wiarygodna specyfikacja funkcjonalna rozszerzenia przeglądarki Vault. Dokumentuje umowę dotyczącą produktu: dane, które użytkownik może skonfigurować, dokładne zachowania wynikające z konfiguracji, publiczny język reguł niestandardowych i ograniczenia, które mają do niego zastosowanie.

Celowo nie jest to przewodnik szybkiego startu. Samouczek internetowy jest ścieżką edukacyjną. Ten dokument jest przeznaczony dla osób, które muszą konfigurować, testować, konserwować, kontrolować lub odtwarzać zachowania Vault widoczne dla użytkownika.

Kod jest prawdą kanoniczną, gdy ten dokument i produkt nie są ze sobą zgodne. Nazwy w tym dokumencie korzystają ze słownictwa przechowywanego/publicznego produktu, tam gdzie jest to praktyczne. Słowo takie jak „zwroty” oznacza zwracaną wartość udostępnioną regule niestandardowej; nie obiecuje wyniku na poziomie przeglądarki, jeśli przeglądarka lub strona odmówi żądanej akcji.

## 1. Granica produktu

Vault jest rozszerzeniem WebExtension kontrolującym fokus. Jej jednostką konfiguracji jest **grupa bloków**. Grupa może:

- zdecydować, że witryna najwyższego poziomu, strona platformy, twórca, społeczność, serwer, kanał lub konto powinny zostać zablokowane;
- ukryj skonfigurowane powierzchnie platform lub pasujące karty kanałów;
- mierzyć czas spędzony w pasującym zakresie;
- zastosować harmonogram, ochronę przed zamrożeniem lub tymczasową drzemkę, jeśli pozwala na to typ grupy;
- uruchomić niestandardową regułę JavaScript z interfejsem API zdarzeń;
- pokaż licznik czasu, panel, komunikat lub dziennik strony na stronie;
- przekierowywać, nawigować, zamykać kartę przeglądarki lub utrzymywać listę blokowania witryn utworzoną wyłącznie na podstawie reguł sesji;
- opcjonalnie uczestniczyć w lokalnie podłączonym klastrze mostów Vault.

Vault działa tylko w profilu przeglądarki, w którym jest zainstalowany, i tylko tam, gdzie przeglądarka pozwala na uruchomienie skryptu zawartości. Nie:

- zainstaluj natywną aplikację lub rozszerzenie przeglądarki;
- blokować aplikacje systemu operacyjnego;
- omijać monity o pozwolenie przeglądarki, ograniczenia przeglądania prywatnego lub własny model bezpieczeństwa witryny internetowej;
- gwarantuje ukrywanie oparte na selektorach, gdy platforma innej firmy zmienia swój DOM;
- udostępnij stan reguły niestandardowej pomiędzy profilami, chyba że użytkownik wyeksportuje/skonfiguruje go osobno;
- zapewnić zaporę sieciową, serwer proxy, kontrolę konta lub usługę monitorowania rodzicielskiego.

W całym tekście stosowana jest następująca terminologia:

| Termin | Znaczenie |
| --- | --- |
| Grupa | Jeden niezależnie nazwany obiekt konfiguracyjny. Nazwy muszą być unikalne w obrębie rozszerzenia, ignorując wielkość liter. |
| Grupa witryn | Zwykła grupa, której głównym warunkiem dopasowania jest lista domen. |
| Grupa platformowa | Zwykła grupa specjalizująca się w YouTube, TikTok, Facebooku, Instagramie, Twitchu, Reddicie, Discord lub Twitterze/X. |
| Grupa niestandardowa | Grupa posiadająca regułę JavaScript i jej rejestracje zdarzeń. Jego reguła decyduje o jego zachowaniu. |
| Dopasuj | Strona, element kanału lub powierzchnia platformy spełnia warunki skonfigurowane w grupie. |
| Aktywny | Grupa jest włączona, spełnia wymagania swojego harmonogramu i nie jest obecnie odłożona. Grupy niestandardowe nie podlegają normalnemu interfejsowi harmonogramu. |
| Blok | Zapobiegaj dalszemu użytkowaniu bieżącej strony najwyższego poziomu, zwykle poprzez przekierowanie do jej docelowego miejsca docelowego. |
| Ukryj | Usuń lub ukryj element/kartę na aktualnie renderowanej stronie. Ukrywanie się nie jest blokadą sieci. |
| Zastępczy adres URL | Cel przekierowania specyficzny dla grupy. Jeśli puste, używana jest globalna rezerwa. |
| Efekt zezwolenia/wyjątku | Werdykt karty platformy, który ratuje pasujące treści z reguł ukrywania o niższym priorytecie. Nie jest to ogólna lista dozwolonych witryn. |

## 2. Model grupowy i wspólny cykl życia

Każda przechowywana grupa ma stabilny identyfikator, nazwę, typ, włączoną flagę i wspólne pola zasad. Domyślnie włączona jest nowa grupa normalna. Grupę można wybrać, zapisać poprzez funkcję automatycznego zapisywania edytora, zmienić jej kolejność, wyeksportować, zaimportować, zamrozić, odmrozić, odłożyć, wyłączyć lub usunąć.

### 2.1 Kolejność i nakładanie się

Do tej samej strony może pasować więcej niż jedna grupa. Vault ocenia zapisane grupy od końca wyświetlanej listy do początku. Podczas projektowania nakładających się reguł traktuj niższe pozycje na liście jako dopasowania późniejsze/wyższe.

W przypadku zwykłego blokowania witryn najwyższego poziomu dowolna odpowiednia grupa blokowania może spowodować, że strona będzie niedostępna. Do filtrowania kart zasilających kaskada platformy wykorzystuje kolejność i efekt każdej pasującej grupy: późniejsze dopasowanie zezwolenia/wyjątku może uratować element przed predykatami blokującymi o niższym priorytecie. To wyjątek jest ograniczony do powierzchni filtrującej karty platformy; nie cofa normalnego bloku witryny obejmującego całą stronę.

### 2.2 Stan włączony

Grupy wyłączone są zachowywane, ale nie uczestniczą w normalnym dopasowywaniu, licznikach czasu, harmonogramach ani zwykłych operacjach drzemki. Wyłączenie grupy niestandardowej powoduje również usunięcie jej aktywnych rejestracji. Ponowne włączenie nie powoduje przekształcenia niezapisanego tekstu w aktywną regułę niestandardową; uruchom regułę, aby załadować zapisane źródło.

### 2.3 Pola wspólne

| Pole | Znaczenie i ograniczenia |
| --- | --- |
| Imię | Niepusty, przycięty i unikalny w tym punkcie końcowym bez uwzględniania wielkości liter. Most identyfikuje również grupy, które można połączyć, według nazwy i typu, więc stabilne nazwy mają znaczenie. |
| Włączone | Włącza lub wyłącza normalne dopasowanie. |
| Zachowanie | Blokada natychmiastowa, blokada po zaliczeniu lub timer/odliczanie. Grupy niestandardowe korzystają z własnej reguły zamiast zwykłego selektora zachowań. |
| Dozwolone minuty | Liczba dodatnia używana przez zachowanie bloku po naddawaniu. Nowe grupy mają domyślnie 15 minut. |
| Resetuj godziny interwałów | Liczba dodatnia używana przez normalne grupy czasowe. Nowe grupy domyślnie mają 24 godziny. |
| Aktywne dni | Od poniedziałku do niedzieli. Zwykła grupa jest nieaktywna, jeśli nie wybrano bieżącego lokalnego dnia tygodnia. |
| Okna czasowe | Zero lub więcej okien czasu lokalnego, po jednym w wierszu, zapisanych jako HHMM-HHMM. |
| Tryb zamrażania | Brak, Zamrożone, Ściśle zamrożone lub Zamrożone rodzicielsko. |
| Polityka drzemki | Określa, czy grupa pozwala na drzemkę, z kontrolą czasu trwania/opóźnienia/odnowienia/potwierdzenia dla normalnych grup. |
| Zastępczy adres URL | Miejsce docelowe używane, jeśli grupa blokuje stronę. |
| Przejdź do następnego | Jeśli jest dostępny w edytorze, prosi normalny przepływ blokujący o przejście obok zablokowanego celu, zamiast pozostania na nim. |

### 2.4 Normalne zachowania grupowe

Zwykły edytor oferuje trzy zachowania:

| Zachowanie | Wynik funkcjonalny |
| --- | --- |
| Zablokuj natychmiast | Gdy grupa jest aktywna i pasuje, normalna decyzja o zablokowaniu strony jest natychmiastowa. |
| Blokuj po kilku minutach | Dopasowany czas widocznej strony naliczany jest w ramach skonfigurowanego limitu. Po wyczerpaniu się limitu normalna grupa blokuje się do czasu zresetowania okresu jej wykorzystania lub grupy w inny sposób nieaktywnej/odłożonej. |
| Timer (odliczanie, bez bloku) | Pasujący czas widocznej strony jest rejestrowany i można go wyświetlić. Ten tryb nigdy nie blokuje tylko dlatego, że jego licznik czasu osiągnął wartość. |

Czasowe użycie zależy od czasu widocznej strony. Nie ma na celu naliczania czasu, gdy strona jest ukryta na karcie w tle. Interwał resetowania to kroczący interwał polityki dla normalnej grupy czasowej. Normalne timery są niezależne od grupy.

### 2.5 Harmonogramy

Harmonogramy obowiązują dla grup normalnych. Grupa niestandardowa nie ma interfejsu użytkownika normalnego harmonogramu i jest uważana za aktywną na potrzeby kodu JavaScript; reguła musi sama narzucać dowolny pożądany warunek czasowy.

Polityka dnia aktywnego jest oceniana przy użyciu czasu lokalnego:

1. Jeśli nie zostanie wybrany bieżący dzień tygodnia, grupa normalna jest nieaktywna.
2. Jeżeli nie podano obowiązujących okien czasowych, za dzień aktywny uważa się cały dzień.
3. Jeśli podano prawidłowe okna, aktualny czas lokalny musi znajdować się w co najmniej jednym oknie.

Każde okno ma dokładną formę HHMM-HHMM, na przykład 0900-1200. Godziny muszą wynosić od 00 do 23, minuty od 00 do 59, a początek musi przypadać przed końcem tego samego dnia. Okno zawiera jego początek i wyklucza koniec. Okna między północami, takie jak 2300-0100, są nieprawidłowe. Puste linie są ignorowane, a zduplikowane okna są zwijane.

### 2.6 Drzemka

W przypadku normalnej grupy drzemka jest tymczasowym stanem nieaktywnym, składającym się z maksymalnie trzech faz:

| Faza | Wynik |
| --- | --- |
| Oczekuje | Żądana drzemka istnieje, ale nie została rozpoczęta ze względu na opóźnienie aktywacji. Grupa jest nadal aktywna. |
| Aktywny | Grupa jest tymczasowo nieaktywna przez czas drzemki. |
| Czas odnowienia | Drzemka dobiegła końca, grupa jest ponownie aktywna i kolejna drzemka nie może się rozpocząć, dopóki nie upłynie czas odnowienia. |

Pola konfiguracyjne grupy normalnej to:

| Pole | Zasada |
| --- | --- |
| Zezwalaj na drzemkę | Jeśli opcja jest wyłączona, nie można rozpocząć normalnego drzemki. |
| Czas drzemki | Pozytywne minuty. Nowa grupa normalna przyjmuje globalną wartość domyślną, początkowo 30. |
| Opóźnienie aktywacji | Zero lub więcej minut. Puste oznacza zero. |
| Czas odnowienia | Zero przez pięć minut. Puste oznacza zero. |
| Potwierdzenia | Nieujemna liczba całkowita. Produkt wymaga tylu interakcji potwierdzających, zanim zatwierdzi żądanie. |

Grupa Niestandardowa traktuje przycisk Odłóż tylko jako zdarzenie wejściowe. Vault emituje dla tej grupy zdarzenie niestandardowe o nazwie snoozePress; nie stosuje w imieniu reguły normalnego czasu trwania/opóźnienia/odnowienia. Reguła niestandardowa może używać zdarzenia, własnej trwałości, panelu, licznika czasu lub nie wykonywać żadnych działań.

### 2.7 Zamrożenie

Zamrożenie chroni grupę przed zwykłymi zmianami konfiguracji i normalnymi zmianami drzemki. Wybranie trybu zamrożenia w selektorze nie powoduje samoczynnego zamrożenia grupy; akcja zamrożenia powoduje zastosowanie wybranego trybu.

| Tryb | Umowa funkcjonalna |
| --- | --- |
| Zamrożone | Grupa jest zablokowana do czasu zakończenia normalnego procesu potwierdzania odblokowania produktu. |
| Ściśle mrożone | Grupy nie można odmrozić, dopóki nie upłynie czas jej ścisłego zamrożenia. Czas trwania musi być większy od zera i nie dłuższy niż 72 godziny; nowa grupa ma domyślnie ustawioną wartość 24 godzin. |
| Rodzicielskie zamrożone | Do zarządzania blokowaniem/odmrażaniem wymagane jest hasło opiekuna. Okno konfiguracji wykorzystuje sześciocyfrowe hasło. |

Zablokowanych grup nie można edytować za pomocą zwykłych pól. Klaster połączony mostkiem z elementem offline może również blokować kontrolę blokowania, ponieważ Vault nie może bezpiecznie koordynować stanu zablokowania w klastrze. Zamrożenie to ochrona przed normalnymi operacjami interfejsu użytkownika; nie zmienia profilu przeglądarki w niezmienną granicę bezpieczeństwa.

### 2.8 Import, eksport, czyszczenie i resetowanie

Eksport tworzy zgodną reprezentację wybranej grupy. Import sprawdza i normalizuje zgodne dane grupy przed ich dodaniem. Zaimportowane nazwy grup muszą nadal być unikalne. Usuń grupę usuwa tę grupę i jej normalny stan użytkowania/uśpienia. Wyczyść usuwa wszystkie grupy po potwierdzeniu.

Przywracanie ustawień domyślnych to operacja **ustawień globalnych**. Odrzuca preferencje dotyczące całego rozszerzenia; nie jest substytutem importu/eksportu i należy go traktować jako destrukcyjny.

## 3. Rodzaje grup i umowa dopasowująca

### 3.1 Domyślna grupa witryn

Grupa witryn zawiera listę witryn internetowych rozdzielonych wierszami. Wpisy są normalizowane do postaci hosta/domeny. Wpis hosta pasuje do tego hosta i wszystkich jego subdomen.

| Ustawienie | Wynik |
| --- | --- |
| Blokuj wszystko z wyjątkiem tych witryn | Lista jest listą bloków. Pasujący host jest zablokowany. |
| Blokuj wszystko z wyjątkiem tych witryn w | Lista jest listą dozwolonych. Każdy host, którego nie ma na liście, jest blokowany. Pusta lista dozwolonych oznacza zatem celową blokadę całej sieci. |
| Zablokuj stronę główną | Stosuje zasady grupy do skonfigurowanej powierzchni początkowej/głównej przeglądarki, gdzie ta kontrola jest dostępna. |
| Zastępczy adres URL | Miejsce docelowe przekierowania dla bloku. Pusta wartość grupy powraca do globalnej wartości domyślnej. |

Zwykła lista domen grupy witryn jest jedyną deklaratywną listą całej witryny udostępnianą przez edytor. Zamiast tego grupy platform dopasowują się do własnej platformy i skonfigurowanych warunków platformy.

### 3.2 Grupy platform wideo

YouTube, TikTok, Facebook, Instagram i Twitch to grupy platform wideo. Każdy jest ograniczony do własnego hosta platformy. Grupa może kierować reklamy na formę treści, zakres autora/konta, kanał główny platformy i opcjonalne elementy sterujące ukrywaniem elementów.

Ogólne tryby autorskie to:

| Tryb | Wynik |
| --- | --- |
| Wszystko | Nie ograniczaj według autora; inne skonfigurowane osie decydują o dopasowaniu. |
| Uwzględnij | Dopasuj tylko wymienionych znormalizowanych twórców/konta. |
| Wyklucz | Dopasuj wszystkich wykrytych twórców/konta z wyjątkiem wymienionych wpisów. |
| Nikt | Nie pasuje do żadnego autora. Jest to celowa oś autora, która nie pasuje. |
| Oznaczenie zawiera | Dopasuj twórców do dowolnego wymienionego tagu, jeśli Vault może ich sklasyfikować. Nieznani/niesklasyfikowani twórcy nie otwierają się. |
| Tag wyklucza | Dopasuj twórców bez skonfigurowanych tagów, gdy Vault może ich sklasyfikować. Nieznani/niesklasyfikowani twórcy nie otwierają się. |

Opcje formy treści zależą od platformy:

| Platforma | Formularze treści |
| --- | --- |
| YouTube | Wszystkie strony, Shorts, długie filmy, posty. |
| TikTok | Wszystkie strony, krótkie filmy. |
| Facebooka | Wszystkie strony, krążki, filmy, posty. |
| Instagram | Wszystkie strony, krążki, filmy, posty. |
| Trzęś | Wszystkie strony, klipy, strumienie/VOD, strony kanałów. |

Vault normalizuje dane wejściowe autora. Edytor akceptuje zwykły formularz uchwytu/kanału/strony platformy i obsługiwane adresy URL profili. Może odrzucić zniekształcone wpisy lub pokazać je jako nieprawidłowe, zamiast po cichu zmienić je w inny cel.

Opcje ukrywania powierzchni są niezależne od blokowania najwyższego poziomu. Wpływają tylko na bieżący interfejs użytkownika platformy i mogą przestać działać, gdy platforma zmieni swoje znaczniki.

| Platforma | Dostarczone opcje ukrycia |
| --- | --- |
| YouTube | Nawigacja/półki/karty filmów Short, powierzchnie promowane/reklamowe na stronie głównej i komentarze. Opcja związana z reklamami wyświetla ostrzeżenie, ponieważ ukrywanie reklam może być sprzeczne z warunkami platformy. |
| TikTok | Poznaj nawigację. |
| Facebooka | Nawigacja bębnów i powierzchnie bębnów. |
| Instagram | Kołowrotki i eksploracja nawigacji/powierzchni. |
| Trzęś | Przeglądaj nawigację. |

Dopasowywanie tagów twórcy YouTube wykorzystuje lokalne/dostępne klasyfikacje kanałów. Brakująca klasyfikacja nie staje się blokiem tylko dlatego, że wybrano tryb znacznika.

### 3.3 Reddit

Grupa Reddit obowiązuje tylko na Reddicie. Jego podmiotem jest subreddit. Dane wejściowe Subreddit przyjmują zwykły formularz społeczności i normalizują go przed dopasowaniem.

Tryby subreddita to:

| Tryb | Wynik |
| --- | --- |
| Wszystko | Aplikuj do Reddita bez ograniczeń związanych z listą subreddit. |
| Uwzględnij | Zastosuj do wymienionych subredditów. |
| Wyklucz | Zastosuj do wszystkich oprócz wymienionych subredditów. |
| Nikt | Aplikuj do żadnego subreddita. |

Dołączona opcja ukrywania powierzchni ukrywa nawigację Popularne/Wszystkie. Zachowanie karty informacyjnej zależy od aktualnie wykrywalnej struktury karty w serwisie Reddit.

### 3.4 Niezgoda

Grupa Discord ma zastosowanie tylko na stronach Discord/Discordapp. Jego celem jest identyfikator serwera lub para serwer/kanał. Edytor docelowy akceptuje znormalizowane wartości ścieżki kanału Discord.

| Tryb | Wynik |
| --- | --- |
| Wszystko | Aplikuj do Discorda bez ograniczeń listy docelowej. |
| Uwzględnij | Zastosuj tylko do wymienionych serwerów lub serwerów/kanałów docelowych. |
| Wyklucz | Zastosuj do wszystkich celów z wyjątkiem wymienionych. |
| Nikt | Zastosuj do żadnego celu. |

Discord obecnie nie oferuje opcji ukrywania elementów w normalnym profilu platformy.

### 3.5 Twitter / X

Grupa Twitter/X obowiązuje na X/Twitter. Może dotyczyć wszystkich kont lub korzystać z ogólnych trybów kont opisanych dla platform wideo, ze znormalizowanym wprowadzaniem uchwytu/linku do profilu.

Dostarczone opcje ukrytych elementów to Eksploruj, Wiadomości, Grok, Trendy i promowane elementy kanału. Podobnie jak w przypadku wszystkich kontrolek powierzchniowych opartych na selektorach, zmiana znaczników X może mieć wpływ na ich działanie.

### 3.6 Niestandardowe pola deklaracyjne grupy

Grupa niestandardowa uruchamia przede wszystkim swoje źródło JavaScript. Nie korzysta z selektora normalnego zachowania ani interfejsu użytkownika normalnego harmonogramu. Niemniej jednak może zawierać listę domen po zaimportowaniu lub skonfigurowaniu za pomocą kompatybilnych danych:

- niepusta niestandardowa lista blokowania może brać udział w podejmowaniu decyzji dotyczącej zwykłej witryny obejmującej całą stronę;
- Niestandardowa lista dozwolonych może uczestniczyć nawet wtedy, gdy jest pusta, co powoduje deklaracyjną blokadę całej sieci;
- nieskonfigurowana grupa Własna nie blokuje przypadkowo stron tylko dlatego, że ma regułę;
- Niestandardowe timery nigdy nie blokują się same; reguła wyraźnie decyduje, czy blokować po upływie limitu czasu.

## 4. Ustawienia globalne

Ustawienia globalne dotyczą rozszerzenia, a nie jednej grupy.

| Ustawienie | Domyślne | Zachowanie |
| --- | --- | --- |
| Kurs tyku | 1000 ms | Częstotliwość udostępnionego niestandardowego zdarzenia tickEvent. Prawidłowy zakres wynosi od 250 do 60 000 ms. Niższe wartości mogą sprawić, że reguły sterowane zdarzeniami będą bardziej responsywne, ale będą zużywać więcej procesora. |
| Odrzucenie automatycznego zapisu | 400 ms | Opóźnienie po ostatniej zmianie edytora, zanim normalne ustawienia zostaną zachowane. Maksymalny czas to 5000 ms. |
| Tryb debugowania | Wyłącz | Włącza szczegółowe wyniki śledzenia reguł niestandardowych i nakładkę dziennika debugowania na stronie. Nie kontroluje, czy zwykłe wywołania dziennika reguły docierają do dziennika wyskakującego. |
| Pokaż dzienniki reguł niestandardowych na stronach internetowych | Na | Kontroluje zwykłe tosty dziennika stron. Autorzy reguł nadal mogą jawnie żądać danych wyjściowych wyświetlanych wyłącznie na ekranie lub w wyskakującym okienku. |
| Domyślny czas drzemki | 30 minut | Ziarno używane podczas tworzenia nowych normalnych grup. Istniejące grupy zachowują swój własny czas trwania. |
| Domyślny zastępczy adres URL | o:puste | Używane, gdy grupa blokująca nie ma zastępczego adresu URL specyficznego dla grupy. |
| Pomóż klasyfikować twórców | Wyłącz | Wyraźna zgoda. Wysyła napotkane identyfikatory kanałów YouTube tylko do skonfigurowanej usługi klasyfikacji; nie wysyła tytułów ani historii oglądania. |
| Lokalny folder plików | Brak | Opcjonalna funkcja folderu dla reguł niestandardowych. Patrz sekcja 9. |

### 4.1 Interfejs edytora i powierzchnie opinii

Edytor rozszerzeń zawiera trwałą listę grup i edytor wybranych grup. Lista grup udostępnia selektor typu grupy, dodawanie, czyszczenie, zaznaczanie, przełączanie włączania i kolejność przeciągania. Rozmiar jego rozdzielacza jest zmienny. Edytor wybranej grupy udostępnia pola specyficzne dla grupy oraz akcje grupowego eksportu/importu.

Edytor automatycznie zapisuje zwykłe zmiany w polach po globalnym okresie odrzucenia. Błędy walidacji są zgłaszane jako informacje zwrotne o statusie/wyskakujące; nieprawidłowe wartości normalne nie są dyskretnie konwertowane na niepowiązane ustawienia. Zamrożona grupa wyłącza zwykłe elementy sterujące edycją.

Rozszerzenie ma również następujące widoczne dla użytkownika powierzchnie zwrotne:

| Powierzchnia | Cel funkcjonalny |
| --- | --- |
| Instrukcja obsługi | Otwiera to odwołanie w rozszerzeniu. |
| Wybór języka | Wybiera język interfejsu rozszerzenia. |
| Ustawienia | Otwiera ustawienia globalne opisane powyżej. |
| Informacje zwrotne o statusie/toaście | Raporty zapisują, importują, sprawdzają i sprawdzają wyniki działań. |
| Nakładka licznika czasu na stronie | Pokazuje aktywne normalne elementy licznika/odliczania oraz liczniki niestandardowe znajdujące się w ich zakresie wyświetlania. Wiele elementów może współistnieć. |
| Powierzchnia dziennika na stronie | Odbiera niestandardowe wywołania dziennika, ostrzeżeń i błędów, jeśli pozwalają na to ustawienia globalne. |
| Dziennik niestandardowy | Dziennik aktywności na żywo dla wpisów widocznych w wyskakujących okienkach utworzonych przez reguły. Można go wyczyścić i pobrać. |

W przypadku grup niestandardowych pole Reguły przechowuje tekst źródłowy. Uruchom najpierw wykonuje wstępną inspekcję składni reguły i ładuje źródło tylko wtedy, gdy się to powiedzie. Edytor wykonuje również linting lokalnego źródła w przypadku zmiany tekstu. Widoczna kontrolka **Pozwól AI Code** otwiera pole zachęty i kopiuje pakiet generowania kodu zawierający żądanie użytkownika, bieżącą regułę i wygenerowane odniesienie do bieżącego interfejsu API reguł niestandardowych. Nie kontaktuje się z usługą AI ani nie zmienia automatycznie reguły.

Kontrolka Szablony otwiera przeglądarkę szablonów. Szablon po wysłaniu ma tytuł, opis, znaczniki, parametry i wygenerowany podgląd. Zastosowanie go zastępuje aktualny tekst Regulaminu po potwierdzeniu. Aktualnie dostarczony katalog szablonów jest pusty; przeglądarka pozostaje dostępna dla przyszłych szablonów wyselekcjonowanych i nie należy jej traktować jako źródła aktywnych reguł.

## 5. Język reguł niestandardowych

### 5.1 Formularze źródłowe reguł

Źródłem grupy niestandardowej jest JavaScript. Podczas **Uruchomienia** Vault usuwa wcześniejsze rejestracje grupy i stan utworzony przez poprzednie aktywne źródło, a następnie ładuje nowe źródło.

Źródłem może być:

1. a function expression accepting events and helpers; or
2. same instrukcje korzystające z dostarczonych zdarzeń (lub starszych zdarzeń) i zmiennych pomocniczych.

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

Run wykonuje kontrolę składni/weryfikacji wstępnej JavaScript i dopiero wtedy, gdy się powiedzie, aktywuje bieżące źródło. Zapisywanie tekstu i uruchamianie tekstu celowo się różnią: regułę można zapisać bez stania się aktywnym źródłem zdarzenia.

Aktywne źródło jest zwalniane po ponownym uruchomieniu grupy niestandardowej, wyłączeniu, usunięciu lub jawnym zatrzymaniu. Ponowne uruchomienie czyści procedury obsługi reguły, liczniki czasu, panele, zasobnik trwałości i predykaty platformy utworzonej przez reguły przed rozpoczęciem rejestracji. Odzyskiwanie w piaskownicy może ponownie załadować aktywne źródło; autorzy reguł muszą zatem uczynić rejestrację idempotentną.

### 5.2 Model wykonania i bezpieczne założenia

Custom rules are event registrations, not a continuous script loop. Register handlers during rule initialization, then respond to events.

Każdy handler otrzymuje:

```js
(event, helpers) => {
  // event: the currently dispatched event object
  // helpers: the public Vault Custom-rule API
}
```

Procedury obsługi zdarzenia uruchamianego według malejącego priorytetu liczbowego; równy priorytet korzysta z kolejności rejestracji. Procedurę obsługi można zastąpić, ponownie rejestrując ten sam typ zdarzenia i identyfikator. W jednej grupie niestandardowej może być zarejestrowanych maksymalnie 1000 programów obsługi.

Vault ogranicza aktywną pracę jednego handlera do około jednej sekundy. Trzy przekroczenia terminu dla tej samej grupy w ciągu jednej minuty poddają regułę kwarantannie: Vault wyłącza ją zamiast wielokrotnie uruchamiać problematyczną procedurę obsługi. Nie używaj zajętych oczekiwań, nieograniczonych pętli, synchronicznego odpytywania ani ogromnej liczby mutacji/dzienników na zdarzenie.

W ramach jednej wysyłki Vault akceptuje maksymalnie:

| Pozycja | Maksymalnie |
| --- | --- |
| Wpisy dziennika reguł | 200 |
| Opublikowane wydarzenia | 64 |
| Operacje DOM | 256 |
| Działanie/zamierzenia | 256 |
| Panele na grupę | 24 |
| Sterowanie w jednym panelu | 32 |
| Opcje w wyborze/sterowaniu radiem | 64 |

Nadmiar wpisów dziennika, opublikowanych zdarzeń, operacji DOM i zamiarów może zostać usunięty. Reguła niestandardowa nie może zależeć od dostarczenia nadmiaru wpisów.

### 5.3 Wbudowane typy zdarzeń

Wbudowane są następujące ciągi typu zdarzenia. Reguła może również używać własnego, niepustego ciągu typu, o ile nie zaczyna się od podkreślenia.

| Typ zdarzenia | Kiedy zostanie wysłany | Ważne dane |
| --- | --- | --- |
| zaznaczWydarzenie | Wspólny okresowy tick przy globalnym ustawieniu stawki tick. | Bieżący kontekst strony/karty, jeśli jest dostępny. Użyj opcji rejestracji interwałowej, aby ograniczyć szybkość pojedynczego modułu obsługi. |
| openWebEvent | Dla reguły zostanie udostępniona strona najwyższego poziomu. | Adres URL, nazwa hosta, identyfikatory kart/stron, godzina. |
| zamknijWydarzenie internetowe | Strona/karta najwyższego poziomu zostaje zamknięta. | Kontekst adresu URL/nazwy hosta, jeśli jest dostępny. |
| webChangedEvent | Zaangażowana nawigacja na najwyższym poziomie, w tym ponowne ładowanie tego samego adresu URL. | dane zawierają wcześniejsze adresy URL/nazwy hosta i flagi nawigacyjne, takie jak isFirstLoad, isReload i sameDomain. |
| licznik czasuKoniec | Niestandardowy licznik czasu zmienia się w stan wygaśnięcia. | dane: timerId, displayName, kierunek, currentMs. Jest dostarczany tylko do grupy będącej właścicielem timera. |
| drzemkaNaciśnij | Użytkownik naciska przycisk Rozpocznij drzemkę dla tej grupy niestandardowej. | Reguła jest właścicielem odpowiedzi; nie jest wykonywana żadna normalna funkcja drzemki. |
| panelZdarzenie | Wyrenderowany panel niestandardowy zawiera interakcję. | Pola danych i wygody zawierają informacje o panelu/sterowaniu/zdarzeniu/wartości. |
| localFileEvent | Żądana akcja na pliku lokalnym została zakończona. | pola danych i wygody obejmują identyfikator żądania, ścieżkę, wynik, bajty, wpisy i błąd. |
| stronaHeartbeatEvent | Bicie serca widocznej strony, mniej więcej co 250 ms, gdy karta jest widoczna. | elapsedMs to czas, jaki upłynął od widocznej strony. Niestandardowe liczniki czasu o określonym zakresie automatycznie go używają nawet bez zarejestrowanej obsługi. |

### 5.4 API rejestru zdarzeń

Pierwszym argumentem źródła w stylu funkcji jest rejestr zdarzeń. W źródle z pustym oświadczeniem zarówno zdarzenia, jak i zdarzenia odnoszą się do tego rejestru.

| Metoda | Umowa |
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

Opcjonalny obiekt opcji obsługi obsługuje:

| Opcja | Znaczenie |
| --- | --- |
| priorytet | Porządek numeryczny. Wyższe wartości są uruchamiane przed niższymi wartościami. Domyślnie 0. |
| interwałMs | Liczba dodatnia. Tylko dla tickEvent, wstrzymuje wywołania, dopóki nie upłynie tyle czasu od poprzedniego wywołania procedury obsługi. |

Zdarzenia syntetyczne domyślnie mają zasięg grupy: odbierają je tylko procedury obsługi należące do grupy emitującej. Użyj {scope: "global" }, aby wysłać zdarzenie do każdej reguły, która zarejestrowała ten sam typ. Nie używaj znaku podkreślenia wiodącego w nazwie wydarzenia; jest zarezerwowane.

### 5.5 Obiekt zdarzenia

Każdy moduł obsługi otrzymuje modyfikowalny obiekt zdarzenia ze wspólnymi polami:

| Pole/metoda | Umowa |
| --- | --- |
| wpisz | Ciąg typu zdarzenia. |
| Identyfikator grupy | Identyfikator grupy niestandardowej odbiorcy. |
| tabId, pageId | Identyfikatory przeglądarki, jeśli są dostępne; w przeciwnym razie zero. |
| adres URL, nazwa hosta | Bieżący adres URL najwyższego poziomu i nazwa hosta lub puste ciągi znaków. |
| czas | Kopia obiektu czasu wysyłki lub wartość null. |
| dane | Ładunek specyficzny dla zdarzenia lub wartość null. |
| zapobiegajDefault() | Oznacza wysyłkę jako akcję blokującą stronę. Strona zostanie przekierowana do bieżącego linku/wyniku przekierowania, jeśli taki istnieje; w przeciwnym razie Vault użyje normalnej ścieżki wyjścia/zastępczej. |
| stopPropagation() | Zatrzymuje późniejsze procedury obsługi dla bieżącego wywołania zdarzenia. |
| setResult(wartość) | Przechowuje wynik w postaci liczby lub ciągu znaków. Niepusty ciąg znaków jest traktowany jako cel przekierowania; wynik 1 pomija skumulowany w przeciwnym razie wynik zapobieganiaDefault. |
| getResult() | Zwraca wynik ustawiony przez ten obiekt zdarzenia lub wartość null. |
| post(typ, dane, opcje) | Kolejkuj zdarzenie syntetyczne z tymi samymi regułami zakresu co Events.post. |
| setRedirectLink(url) | Ustaw adres URL przekierowania dla tej wysyłki. Zwraca wartość false tylko w przypadku danych wejściowych niebędących ciągiem znaków. |
| getRedirectLink() | Przeczytaj adres URL przekierowania tej wysyłki lub pusty ciąg. |
| zamknij(id) | Poproś o zamknięcie karty. Liczba to identyfikator karty, ciąg znaków identyfikuje adres URL, a pominięta wartość wskazuje aktywną kartę. |
| blok(id) | Dodaj dynamiczny wzorzec blokowania witryny tylko dla sesji. Bez identyfikatora ciągu użyj nazwy hosta wydarzenia. |
| odblokuj(id) | Usuń dynamiczny wzorzec blokowania witryny dotyczący tylko sesji. Bez identyfikatora ciągu użyj nazwy hosta wydarzenia. |
| otwórz() | Brak operacji w rozszerzeniu przeglądarki. Nie może uruchamiać aplikacji. |

Procedura obsługi może dołączyć do zdarzenia dowolne dodatkowe właściwości. Przeczytaj je poprzez event.custom lub bezpośrednio pod przypisaną nazwą, gdy obiekt zdarzenia jest aktywny. Nie są one stanami trwałymi i nie stanowią magazynu obejmującego zdarzenia między zdarzeniami.

W przypadku zdarzenia panelEvent dodawane są następujące wygodne pola: panelId, controlId, eventName, wartość, wartości, klucz, kod i keyInfo.

W przypadku zdarzenia localFileEvent dodawane są następujące wygodne pola: nazwa zdarzenia, akcja, ścieżka, ścieżka katalogu, identyfikator żądania, ok, tekst, wartość, wpisy, istnieje, bajty i błąd.

### 5.6 Punkty wejścia pomocnika

Obiekt pomocników ma następujące bezpośrednie właściwości:

| Punkt wejścia | Znaczenie |
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

## 6. Niestandardowe odwołanie do pomocnika

### 6.1 Pomocnik domeny

Get it with helpers.getDomainHelper(). It is also available as helpers.getDomainUtility().

| Metoda | Powrót i zachowanie |
| --- | --- |
| nazwa_hostaOf(url) | Znormalizowany host pisany małymi literami bez początkowego www. lub wartość null w przypadku nieprawidłowego adresu URL. |
| nazwaścieżki(url) | Ścieżka adresu URL lub / gdy nie można przeanalizować adresu URL. |
| dopasowania(nazwa hosta, witryna) | Prawda, gdy nazwa hosta jest równa witrynie lub jest jej subdomeną. |
| getPlatform(url) | youtube, tiktok, instagram, facebook, twitch lub null. |
| isYouTubeHost(host), isTikTokHost(host), isInstagramHost(host), isFacebookHost(host), isTwitchHost(host), isRedditHost(host), isDiscordHost(host) | Klasyfikatory hostów. |
| youtube(), tiktok(), instagram(), facebook(), twitch() | Zwróć obiekt klasyfikatora adresu URL tej platformy. |
| isEmptyStartPage(url) | Dotyczy adresów URL pustej/nowej karty/strony początkowej obsługiwanych przez przeglądarkę. |
| dopasowaniaAny(adres URL, wzorce) | Dopasuj adres URL do jednego wyrażenia RegExp, tablicy RegExp lub ciągów skompilowanych jako wyrażenia regularne. Nieprawidłowe wzorce ciągów są ignorowane. |
| pathStartsWith(url, ścieżka) | Prawda dla dokładnej ścieżki lub potomka ścieżki. Podano brakujący ukośnik wiodący. |
| queryHas(url, klucz, wartość) | Prawda, jeśli istnieje klucz zapytania; gdy podana jest wartość, musi ona być również równa wartości ciągu. |
| zapytanieGet(adres URL, klucz) | Zapytanie o wartość lub null. |
| isSearchPage(url) | Wykrywa obsługiwane adresy URL wyszukiwania Google, Bing, DuckDuckGo, YouTube, Reddit i X/Twitter. |
| isInfiniteFeedUrl(url) | Wykrywa obsługiwane powierzchnie o nieskończonym posuwie. |
| ta sama sekcja (a, b) | Prawda tylko wtedy, gdy oba adresy URL mają wspólny host i pierwszy segment nazwy ścieżki. |

Każdy obiekt klasyfikatora adresu URL platformy udostępnia elementy isPlatformUrl(url), isShortUrl(url), isVideoUrl(url), isPostUrl(url), isHomePage(url), ekstraktAuthor(url) i ekstraktVideoId(url). Metoda może zwrócić wartość false/null, jeśli adres URL jest prawidłowy, ale nie identyfikuje tego rodzaju treści.

### 6.2 Pomocnik timera

Get it with helpers.getTimerHelper(). Timers are rule-owned counters. They may be displayed in Vault's page overlay, but they never block on their own.

Utwórz/pobierz opcje:

| Opcja | Znaczenie |
| --- | --- |
| identyfikator | Wymagany niepusty identyfikator timera. |
| nazwa wyświetlana | Czytelna dla człowieka nakładka etykieta. |
| kierunek | przekaż do odliczenia; każda inna wartość staje się wstecz/odliczaniem. |
| obecna Pani | Początkowe milisekundy, których minimalna wartość wynosi zero i jest ograniczona, jeśli istnieją granice. |
| minMs, maxMs | Opcjonalne dodatnie granice minimalne/maksymalne. |
| macocha | Opcjonalny krok dodatniej kwantyzacji dla minionych taktów. |
| styl nakładki | Opcjonalne ciągi określające kolor, tło, rozmiar czcionki, czcionkę, obramowanie, obramowanieRadius, dopełnienie, krycie i ikonę. Nieobsługiwane/nieprawidłowe części są odrzucane. |
| zakres(adres URL) | Predykat decydujący o tym, gdzie naliczany jest czas widoczności strony. |
| domena(adres URL) | Predykat decydujący o tym, gdzie w nakładce pojawi się licznik czasu; domyślnie zakres. |
| naliczaneKiedy(url) | Opcjonalny dodatkowy predykat. Czas jest naliczany tylko wtedy, gdy zarówno zakres, jak i AccrueWhen mają wartość true. |

| Metoda | Zachowanie |
| --- | --- |
| utwórz(opcje) | Utwórz/zastąp timer i zresetuj jego stan. Zwraca identyfikator lub wartość null. |
| getOrCreateTimer(opcje) | Utwórz tylko w przypadku nieobecności. Stan istniejący pozostaje niezmieniony. Zwraca identyfikator lub wartość null. |
| usuń(id) | Usuń licznik czasu i jego predykaty zakresu/wyświetlania. |
| pauza(id), wznowienie(id) | Zmień stan wstrzymania. Zwraca wartość true tylko wtedy, gdy możliwa jest zmiana stanu. |
| setDirection(id, kierunek) | Ustaw do przodu lub do tyłu. |
| setCurrentMs(id, ms) | Ustaw liczbę bezwzględną, egzekwując granice. |
| addMs(id, deltaMs), subMs(id, deltaMs) | Dostosuj liczbę, egzekwując granice. |
| setBounds(id, minMs, maxMs) | Ustaw pozytywne granice; przekaż wartość null dla powiązanego, aby go usunąć. |
| setStep(id, stepMs) | Ustaw dodatnią kwantyzację tickową. Przekaż wartość null lub zero, aby ją wyczyścić. |
| setOverlayStyle(id, styl) | Zastąp/wyczyść dozwolone style nakładek. |
| setDisplayName(id, nazwa) | Ustaw etykietę nakładki. |
| getCurrentMs(id) | Liczba, zero dla nieobecnego licznika czasu. |
| wygasł(id) | Prawda tylko wtedy, gdy istnieje licznik czasu i currentMs wynosi zero. |
| isPaused(id) | Wartość logiczna. |
| getDirection(id), getDisplayName(id) | Kierunek/nazwa lub wartość null. |
| istnieje(id) | Wartość logiczna. |
| getState(id) | Serializowalna migawka timera lub wartość null. |
| lista() | Serializowalna tablica migawek timera. |

Predykaty zakresu są zapamiętywane, gdy źródło niestandardowe pozostaje załadowane. Vault przesuwa pasujące liczniki czasu podczas widocznych cykli pageHeartbeatEvent, jeden znacznik na licznik czasu na wysyłkę. Timer wsteczny zatrzymuje się na zero i emituje timerEnded przy przejściu do zera. Pozostaje zerowa, dopóki reguła go nie zmieni/zresetuje. Użyj procedury obsługi zakończonej licznikiem czasu, aby zdecydować, czy wygasły licznik czasu powinien wywołać PreventDefault, ustawić przekierowanie lub wykonać inną akcję.

### 6.3 Pamięć trwała i asynchroniczna

Get the synchronous persistence helper with helpers.getPersistenceHelper(). Values must be JSON-serializable. A group can store at most 200 keys and each serialized value is limited to 16 KiB.

| Metoda | Zachowanie |
| --- | --- |
| get(klucz, wartość domyślna) | Przeczytaj sklonowaną wartość lub wartość domyślną. |
| set(klucz, wartość) | Przechowuj klon bezpieczny w formacie JSON. Zwraca wartość false w przypadku nieprawidłowego klucza/wartości lub wyczerpania klawiszy. |
| usuń(klucz) | Usuń istniejący klucz; zwraca informację, czy istniała. |
| ma(klucz) | Wartość logiczna. |
| klucze() | Tablica kluczy. |
| wpisy() | Tablica sklonowanych par [klucz, wartość]. |
| jasne() | Usuń całą trwałość reguł dla tej grupy. |
| rozmiar() | Liczba kluczy. |

helpers.getStorageHelper() exposes all the preceding methods and two asynchronous request methods:

| Metoda | Zachowanie |
| --- | --- |
| requestAsyncGet(klucz) | Zażądaj asynchronicznego odczytu pamięci. Zwraca wartość true, gdy znajduje się w kolejce. Użyj późniejszego wydarzenia/własnego przepływu stanu, aby odpowiedzieć; to nie jest synchroniczny moduł pobierający. |
| requestAsyncSet(klucz, wartość) | Zażądaj asynchronicznego magazynu bezpiecznego JSON. Zwraca wartość true, gdy znajduje się w kolejce. |

Trwałość reguły została wyczyszczona po uruchomieniu, ponieważ nowe aktywne źródło rozpoczyna się od czystego stanu reguły niestandardowej.

### 6.4 Pomocnik logowania

Get it with helpers.getLogHelper(). Every method accepts any number of values.

| Metoda | Miejsce docelowe |
| --- | --- |
| loguj, ostrzegaj, błąd | Wyskakujący dziennik aktywności; toast strony, gdy włączone są globalne toasty dziennika stron. |
| logScreen, warnScreen, errorScreen | Tylko powierzchnia toastowania/debugowania strony; wykluczone z wyskakującego dziennika. |
| logPopup, warnPopup, errorPopup | Tylko wyskakujący dziennik aktywności; wykluczone ze strony toastowej. |

Dzienniki próbują również dotrzeć do konsoli przeglądarki z prefiksem grupy CustomBlocker. To są dane wyjściowe diagnostyczne, a nie interfejs API trwałości. Użyj pomocnika trwałości dla stanu.

### 6.5 Pomocnik przekierowania

Get it with helpers.getRedirectionHelper().

| Metoda | Zachowanie |
| --- | --- |
| get(), getRedirectLink() | Zwróć bieżący adres URL przekierowania wysyłki lub pusty ciąg. |
| set(url), setRedirectLink(url) | Ustaw adres URL przekierowania dla bieżącej wysyłki. |
| utwórzWiadomośćUrl(wiadomość) | Utwórz adres URL strony wiadomości lokalnej rozszerzenia, która wyświetla dostarczony komunikat. |

Samo ustawienie przekierowania nie wymusza nawigacji. Połącz go z event.preventDefault() lub ustaw niepusty ciąg poprzez event.setResult(), zgodnie z żądanym przebiegiem reguły.

### Pomocnik DOM 6.6

Get it with helpers.getDOMHelper(). These actions are queued and applied to the current page. Selectors must be valid for the page browser; malformed selectors or elements that do not exist can produce no visible result.

| Metoda | Żądane działanie |
| --- | --- |
| ukryj(selektor), pokaż(selektor) | Ukryj/pokaż pasujące elementy. |
| addClass(selektor, nazwa klasy), usuńKlasę(selektor, nazwa klasy) | Mutuj klasę CSS. |
| setText(selektor, tekst) | Zastąp treść tekstową. |
| kliknij(selektor) | Kliknij pasujący element. |
| injectCss(css, identyfikator) | Dodaj zidentyfikowany blok CSS. |
| usuńInjectedCss(id) | Usuń wcześniej zidentyfikowany wstrzyknięty blok CSS. |
| przewińDo(selektor) | Przewiń dopasowany element do widoku. |

Akcje DOM nie zapewniają nieograniczonego skryptowania strony. Stanowią ograniczoną powierzchnię działania i powinny być idempotentne, gdy są używane w procedurach obsługi pulsu/tyknięcia.

### 6.7 Nawigacja, karty i pomoc w oknie przeglądarki

Get navigation with helpers.getNavigationHelper().

| Metoda | Żądane działanie |
| --- | --- |
| powrót() | Przejdź do poprzedniej karty. |
| do przodu() | Przejdź do przodu w bieżącej karcie. |
| przeładuj() | Załaduj ponownie bieżącą kartę. |
| przejdźDo(adres URL) | Przejdź do bieżącej karty pod adresem URL. |
| zamknijTab() | Zamknij bieżącą kartę. |

Get a snapshot helper with helpers.getTabHelper().

| Metoda | Powrót/akcja |
| --- | --- |
| lista() | Kopia migawki bieżącej karty. |
| getActiveTab() | Migawka aktywnej karty lub wartość null. |
| getById(id) | Dopasowany zrzut karty lub wartość null. |
| policzOpen() | Liczba kart w migawce. |
| żądanieOdśwież() | Poproś o migawkę nowej karty do późniejszej pracy z regułami. |

Get the browser-tab/window helper with helpers.getWindowHelper(). In the extension, a "window" is represented by browser tabs.

| Metoda | Zachowanie |
| --- | --- |
| prąd() | Bieżący aktywny obiekt karty: id, url, nazwa hosta, tytuł, isBrowser. |
| wszystko() | Tablica obiektów kart z identyfikatorem, adresem URL, nazwą hosta, tytułem i aktywnością. |
| zamknij(idOrUrl) | Zamknij numerycznym identyfikatorem karty, dokładnym ciągiem adresu URL lub aktywną kartą, jeśli została pominięta. |
| zamknijTab() | Zamknij aktywną kartę. |
| blok(wzór) | Dodaj znormalizowany blok domeny tylko dla sesji i zastosuj go. |
| odblokuj(wzór) | Usuń znormalizowany blok domeny tylko dla sesji. |
| isBlocked(urlOrHostname) | Zapytaj o listę blokowanych sesji utworzoną przez regułę. |
| getBlocked() | Lista bieżących wzorców utworzonych w sesji. |

Wzorce bloków utworzone przez reguły normalizują http/https, wiodący www. i ścieżki we wzorzec hosta. Pasują dokładnie do hosta i subdomen. Ta dynamiczna lista blokowania to pamięć sesji, a nie zapisana normalna grupa witryn.

### 6.8 Pomocnik lokalnego folderu plików

Get it with helpers.getLocalFolderHelper(). It only operates after the user has selected a folder in Global Settings and granted browser permission. It is asynchronous: every request returns a request id; completion arrives as localFileEvent.

| Metoda | Zachowanie |
| --- | --- |
| jestDostępny() | Raportuje, że istnieje powierzchnia API; nie oznacza to, że folder jest aktualnie autoryzowany. |
| żądaniePrzeczytania(ścieżka) | Poproś o przeczytanie tekstu. |
| requestWrite(ścieżka, tekst) | Poproś o napisanie tekstu. |
| requestAppend(ścieżka, tekst) | Poproś o dołączenie tekstu. |
| requestList(ścieżka = "") | Poproś o wpis do katalogu. |
| żądanieistnieje(ścieżka) | Poproś o test istnienia. |
| żądanieReadJson(ścieżka) | Poproś o odczyt JSON; ścieżka musi kończyć się na .json. |
| requestWriteJson(ścieżka, wartość) | Poproś o zapis JSON; ścieżka musi kończyć się na .json, a wartość musi być bezpieczna w formacie JSON. |

Ścieżki zawsze odnoszą się do wybranego katalogu głównego. Nie mogą być bezwzględne, kwalifikowane jako dyskowe, poprzedzone kropką ani zawierać . lub... segmenty. Do operacji na plikach akceptowane są wyłącznie pliki .txt, .csv i .json. Wybór folderu można w każdej chwili odwołać; nieudane żądanie zgłasza ok false i ciąg błędu w localFileEvent.

### 6.9 Pomocnik platformy

Get the collection with helpers.getPlatformHelper() or helpers.platform(). Get one raw platform API with helpers.platform("youtube"), for example.

Wszystkie surowe interfejsy API platformy udostępniają:

| Metoda | Zachowanie |
| --- | --- |
| ukryj(predykat, opcje) | Ustaw ten sam predykat dla każdego elementu dla każdego gniazda kart zasilających na tej platformie. |
| hide(slot, predykat, opcje) | Ustaw jeden predykat dla każdego elementu. Predykat odbiera element platformy/migawkę dostarczony przez tę platformę. |
| zezwolenie (predykat, opcje), zezwolenie (miejsce, predykat, opcje) | To samo co hide, ale tworzy werdykt zezwalający/wyjątek. |
| show(), show(slot) | Wyczyść wszystkie lub jedno zainstalowane miejsce predykatów. |
| powierzchnia(nazwa, „ukryj” lub „pokaż”) | Ukryj/pokaż cały region platformy. home to publiczna nazwa strony głównej. |
| timer(slot, opcje) | Skonfiguruj licznik czasu podsekcji platformy. Zwraca opcję.id, jeśli jest podana, w przeciwnym razie ma wartość null. |
| przeskanuj ponownie() | Ponownie oceń już zeskanowane karty kanałów po zmianie stanu reguły zewnętrznej. |
| migawka() | Zwróć bieżącą migawkę platformy lub wartość null. |
| sloty(), powierzchnie(), timerSlots() | Zwróć obsługiwane nazwy dla tej platformy. |
| isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, ekstraktAuthor, ekstraktVideoId | Pomocnicy URL dla tej platformy. |

Slot posiada jeden predykat dla jednej grupy/platformy. Późniejsze wywołanie ukryj/zezwól dla tego samego miejsca zastępuje wcześniejszy predykat; nie jest to ukryte OR. Obiekt opcji opcjonalnych rozpoznaje:

| Opcja | Efekt |
| --- | --- |
| blockPageOnVisit | Kiedy odwiedzana jest pasująca karta/strona, poproś o zablokowanie strony, a nie tylko o ukrycie karty. |
| efekt | blokuj (domyślnie) lub zezwalaj. Zestawy pomocnicze zezwolenia pozwalają automatycznie. |

Wywołaj ponowne skanowanie za każdym razem, gdy predykat zależy od stanu, który zmienił się po pierwszej ocenie kart, na przykład pola wyboru panelu, limitu lub progu czasu.

Surowa macierz wsparcia platformy:

| Platforma | Szczeliny predykcyjne | Nazwy powierzchni | Szczeliny timera |
| --- | --- | --- | --- |
| YouTube | szorty, filmy, posty, komentarze, na żywo | strona główna, krótkiPrzycisk, komentarze, na żywo | szorty, filmy, posty |
| TikTok | filmy, komentarze, na żywo | strona główna, komentarze, na żywo | filmy |
| Instagram | spodenki, posty, komentarze | strona główna, komentarze | spodenki, posty |
| Facebooka | szorty, filmy, posty, komentarze, na żywo | strona główna, komentarze, na żywo | szorty, filmy, posty |
| Trzęś | szorty, transmisje, filmy, na żywo | strona główna, komentarze, na żywo | szorty, transmisje, filmy |

Surowy pomocnik platformy niestandardowej nie udostępnia Reddit, Discord ani Twitter/X. Użyj ogólnego adresu URL, DOM, timera, panelu i możliwości nawigacji do niestandardowej pracy w tych witrynach.

## 7. Panele niestandardowe

The panel helper creates safe, declarative on-page panels. Get it with helpers.getPanelHelper(). A panel can be scoped to URLs, react to interactions, display timer state, and retain its user-entered values for the active rule lifetime.

### 7.1 API panelu

| Metoda | Zachowanie |
| --- | --- |
| utwórz(konfiguracja) | Utwórz lub zamień panel. Zwraca znormalizowany identyfikator panelu lub wartość null. |
| getOrCreatePanel(konfiguracja) | Twórz tylko wtedy, gdy nie ma; zwraca identyfikator lub wartość null. |
| aktualizacja(id, poprawka) | Zastąp określone pola panelu po sprawdzeniu poprawności. |
| usuń(id) | Usuń panel i zarejestrowane w nim procedury obsługi. |
| pokaż(id), ukryj(id) | Zmień widoczność. |
| setValue(id panelu, identyfikator kontroli, wartość) | Ustaw zapisywalną wartość kontrolną po zatwierdzeniu. |
| updateControl(id panelu, identyfikator kontroli, poprawka) | Zastąp dozwolone pola kontrolki. |
| wyłącz (panelId, controlId), włącz (panelId, controlId) | Przełącz dostępność kontroli. |
| setOptions(identyfikator panelu, identyfikator kontroli, opcje) | Zastąp opcje wyboru/radia. |
| setText(id panelu, identyfikator kontroli, tekst) | Zaktualizuj etykietę przycisku, tekst/tekst sekcji lub inną etykietę kontrolki. |
| setTheme(id panelu, motyw) | Zamień motyw panelu. |
| setTitle(idpanelu, tytuł), setDescription(idpanelu, opis) | Zaktualizuj tekst. |
| getValue(id panelu, identyfikator kontroli) | Zwróć sklonowaną wartość lub niezdefiniowaną. |
| getValues(id panelu) | Zwróć wszystkie zapisywalne wartości oznaczone identyfikatorem kontrolki. |
| getState(id) | Zwróć serializowalną migawkę panelu lub wartość null. |
| lista() | Zwróć możliwe do serializacji migawki wszystkich paneli. |
| uwaga(konfiguracja) | Utwórz kompaktowy panel stanu w prawym dolnym rogu z opcjonalną wiadomością/tekstem. |
| potwierdź(konfiguracja) | Utwórz wyśrodkowane okno dialogowe z wygenerowanymi przyciskami potwierdzenia i anulowania. |
| lista kontrolna (konfiguracja) | Utwórz panel elementów pól wyboru. |
| formularz(konfiguracja) | Utwórz panel układu formularza z pól. |

### 7.2 Konfiguracja panelu

| Pole | Akceptowane wartości/zachowania |
| --- | --- |
| identyfikator | Wymagany. Znormalizowany do liter, cyfr, podkreśleń i łączników; maksymalnie 80 znaków. |
| tytuł | Tytuł panelu, maksymalnie 240 znaków. |
| opis lub treść | Opis, maksymalnie 1000 znaków. |
| pozycja | w lewym górnym rogu, w prawym górnym rogu, w lewym dolnym rogu, w prawym dolnym rogu lub na środku. Domyślny prawy dolny róg. |
| wyrównaj | lewy, środkowy lub prawy. Domyślnie lewy. |
| układ | pionowy, kompaktowy, wygodny, przestronny, wbudowany, wiersz, zawijany, dwie kolumny, siatka, podział, formularz, pasek narzędzi lub stos. Domyślny pionowy. |
| priorytet | Kolejność wyświetlania numerycznego, ograniczona do -1000 do 1000. Wyższe panele są wyświetlane jako pierwsze. |
| szerokość | mały, średni, duży lub od 180 do 520 pikseli. |
| Rozmiar tekstu/rozmiar czcionki | 10 do 32 pikseli lub 0,65 do 2 rem/em. |
| ariaLabel/a11yLabel | Dostępna etykieta. |
| rola | region, okno dialogowe, alert, stan, formularz lub grupa. |
| autofokus | Wartość logiczna. |
| motyw/kolory | tło, pierwszy plan, akcent, obramowanie, wyciszony, rozmiar czcionki/tekstu, rozmiar tytułu. |
| kontroluje | Tablica maksymalnie 32 elementów sterujących z zagnieżdżeniem sekcji na maksymalnie trzech poziomach. |
| widoczne | Fałsz ukrywa panel. |
| zakres(url), domena(url) | Funkcje sterujące dostępnością/wyświetlaniem. domena ma pierwszeństwo; bez domeny, wyświetlane są elementy sterujące zakresem. |

Pola wbudowanej obsługi panelu mogą pojawiać się na panelu lub w poszczególnych kontrolkach: onEvent, onChange, onClick, onInput, onFocus, onBlur, onSubmit, onClose, onMount, onUnmount, onKey i onKeyDown. Każdy otrzymuje normalne parametry (zdarzenie, pomocniki). Wbudowana procedura obsługi jest zastępowana, gdy panel jest odtwarzany/aktualizowany za pomocą definicji kontrolek.

### 7.3 Sterowanie

Dostępne typy kontrolek to tekst, pole wyboru, zaznaczenie, wejście tekstowe, obszar tekstowy, przycisk, sekcja, licznik czasu, wejście liczbowe, zakres, przełącznik, radio, data, godzina, kolor, pin i HTML. Aliasy wejściowe, rozwijane, grupowe, liczbowe, suwakowe, przełącznikowe, surowe i znaczniki normalizują się do odpowiedniego typu.

Wszystkie elementy sterujące akceptują identyfikator, typ, etykietę, wartość, wyłączone, priorytet i, w stosownych przypadkach, układ, wyrównanie, ariaLabel/a11yLabel, autoFocus, szerokość, wysokość i wiersze.

| Wpisz | Ważne pola i kontrakt wartościowy |
| --- | --- |
| tekst | tekst (lub etykieta) renderowany jako tekst inny niż wejściowy. |
| pole wyboru, przełącz | Wartość logiczna. |
| wybierz, radio | opcje jako ciągi znaków lub obiekty {wartość, etykieta}; maksymalnie 64. Wartość to krótki ciąg. |
| wejście tekstowe, obszar tekstowy | Wartość ciągu, maksymalnie 2000 znaków; opcjonalny symbol zastępczy. |
| przycisk | etykieta/tekst; opcjonalna akcja: prześlij, anuluj lub zamknij. |
| sekcja | tekst/opis, rola i zagnieżdżone kontrolki. |
| minutnik | timerId lub migawka timera; format ms, ss, mm:ss lub gg:mm:ss; showExpired domyślnie ma wartość true. |
| liczbaWejście, zakres | Wartość numeryczna połączona z dostarczaną wartością min/maks; opcjonalny krok dodatni. |
| data | Tylko wartość RRRR-MM-DD. |
| czas | Tylko wartość GG:MM lub GG:MM:SS. |
| kolor | Sześciocyfrowa wartość wejściowa #RRGGBB. |
| szpilka | Tylko cyfry, długość od 3 do 12, domyślnie maskowane, opcjonalnie automatyczne przesyłanie. |
| HTML | Oczyszczone znaczniki. Bloki skryptów, wbudowane atrybuty zdarzeń i JavaScript: adresy URL są usuwane. |

Każda wyrenderowana interakcja generuje zdarzenie panelEvent. Obiekt wartości zdarzenia zawiera zapisywalne kontrolki panelu, z wyjątkiem przycisków, tekstu i kontrolek timera. Akcja zamknięcia ukrywa panel, zanim obsługa zaobserwuje zdarzenie.

## 8. Przepisy na akcje według reguł niestandardowych

Poniższe przykłady to specyfikacje składu publicznego, a nie samouczek.

### 8.1 Przekieruj stronę otwierającą

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

### 8.2 Odliczanie czasu widocznego z jawną blokadą

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

### 8.3 Zmień predykat kanału z panelu

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

Predykaty muszą być zapisane dla wartości migawki platformy/elementu dostarczonych przez aktywną powierzchnię platformy. Jeśli platforma nie może wiarygodnie zidentyfikować pola, predykat powinien zakończyć się niepowodzeniem, zamiast zakładać, że wartość jest prawdziwa.

## 9. Protokół żądania folderu lokalnego

Operacje na folderze lokalnym nie są natychmiastowymi operacjami wejścia/wyjścia na pliku. Pełna sekwencja funkcjonalna to:

1. Użytkownik wybiera folder w Ustawieniach globalnych.
2. Reguła kolejkuje żądanie i otrzymuje identyfikator żądania.
3. Vault prosi autoryzowany folder o wykonanie operacji.
4. Vault wysyła zdarzenie localFileEvent do tej samej grupy niestandardowej.
5. Procedura obsługi koreluje event.requestId z oryginalnym identyfikatorem żądania.

Pomyślny odczyt kończy się tekstem dla plików tekstowych lub wartością dla JSON. Lista zwraca wpisy. Istnieje zwrot istnieje. Zapis/dołączenie zapewnia bajty, jeśli ma to zastosowanie. Niepowodzenie zapewnia ok, fałsz i błąd. Reguły nie mogą nigdy zakładać, że wybrany folder pozostanie autoryzowany po ponownym załadowaniu, ponownym uruchomieniu przeglądarki lub cofnięciu uprawnień.

## 10. Semantyka bezpieczeństwa i awarii według reguł niestandardowych

### 10.1 Błędy kompilacji i uruchamiania

Sprawdź błąd kompilacji raportów składni. Run może również zgłosić błąd wykonania podczas rejestracji. Jeśli źródło przypominające funkcję zawiera błąd składniowy, Vault nie wraca po cichu do traktowania go jako nieszkodliwego, gołego oświadczenia.

Puste źródło ma zerowe procedury obsługi. Jest ważna jako nieaktywna reguła niestandardowa, ale nie wykonuje skonfigurowanej akcji niestandardowej.

### 10.2 Błędy obsługi

Wyjątek z jednej procedury obsługi jest izolowany od ogólnego wysyłania zdarzeń. Jest to wyjście diagnostyczne; nie sprawia to, że późniejsze procedury obsługi w magiczny sposób odniosą sukces. Używaj wąskich procedur obsługi i rejestruj błędy, które można podjąć.

### 10.3 Kwarantanna

Vault może poddać grupę niestandardową kwarantannie po wielokrotnym przekroczeniu terminu lub przekroczeniu podczas rejestracji. Kwarantanna wyłącza grupę i rejestruje przyczynę przerwania. Popraw źródło, zapisz je i jawnie uruchom ponownie, aby przywrócić aktywne rejestracje.

### 10.4 Ograniczenia przeglądarki/strony

Żadna reguła niestandardowa nie otrzymuje nieograniczonych interfejsów API rozszerzeń. W szczególności:

- selektor DOM nie może znaleźć niczego na platformie, która uległa zmianie;
- nawigacja, zamykanie kart i działania na ekranie zależą od możliwości przeglądarki;
- rozszerzenie nie może otwierać aplikacji natywnych;
- operacje na folderach lokalnych wymagają folderu przyznanego przez użytkownika i obsługiwanych typów plików;
- moduł obsługi zdarzeń nie może polegać na tym, że niewidzialna strona nadal generuje pulsy w czasie widzialnym;
- strona może zostać ponownie załadowana, nawigować, odrzucona lub unieważnić skrypt treści niezależnie od reguły;
- dynamiczne bloki witryn utworzone na podstawie reguł to działania w stanie sesji, a nie trwałe zmiany w grupie witryn.

## 11. Mostek z aplikacją internetową

Rozszerzenie przeglądarki automatycznie uruchamia połączenie ze zgodnym lokalnym koncentratorem Vault pod adresem ws://127.0.0.1:8787. Użytkownik nie ma przełącznika połączenia, a zgodność protokołu jest wymagana.

Vault najpierw sonduje szybko, a następnie ponawia połączenie wolniej przez cały czas działania rozszerzenia. Automatyczny transport sam nie scala grup; łączenie i rozłączanie grup pozostaje jawne.

### 11.1 Łączenie grup

Grupy można łączyć tylko wtedy, gdy ich nazwa i typ są zgodne i kwalifikują się do łączenia. Użytkownik wyraźnie wybiera/łączy uczestniczące programy. Połączona grupa tworzy klaster. Odłączenie pozostawia dane grupy lokalnej nienaruszone; zatrzymuje synchronizację na żywo.

Most synchronizuje współdzieloną politykę skalarną dla obsługiwanych połączonych grup, w tym normalny tryb blokowania, wartości limitów/resetowania, ustawienia drzemki, aktywne dni/okna, stan/wybór/czas trwania zamrożenia, zasady strony głównej, ustawienia listy dozwolonych, zastępczy adres URL i zasady przejścia do następnego. Koordynuje także stan użycia i drzemki dla członków klastra.

Most nie gwarantuje, że każde pole specyficzne dla produktu, selektor platformy, niestandardowy tekst źródłowy lub funkcje specyficzne dla przeglądarki można przenieść do innego programu. Grupa może pozostać lokalna i niepołączona nawet wtedy, gdy most jest podłączony.

Klastry zamrożonych mostów wymagają, aby wszyscy odpowiedni członkowie byli online w celu wykonywania działań w stanie zamrożenia, które wymagają skoordynowanej mutacji. Połączenie to transport lokalny, a nie kanał kopii zapasowej w chmurze lub kanał zdalnego sterowania.

## 12. Lista kontrolna weryfikacyjna dla konserwatorów

Skorzystaj z tej listy kontrolnej podczas audytu wydania lub zachowania związanego z reprodukcją:

1. Upewnij się, że grupa ma niepustą unikalną nazwę, prawidłowy typ, stan włączenia i zamierzoną listę/kolejność.
2. W przypadku normalnych grup potwierdź aktywny dzień tygodnia, prawidłowe okno czasu lokalnego, brak aktywnej drzemki i niezamrożony stan edycji.
3. W przypadku grupy witryn przetestuj dokładny host, subdomenę i (w przypadku listy dozwolonych) host spoza listy.
4. Dla grupy platform oddzielnie przetestuj dopasowanie na poziomie strony, docelowe dopasowanie elementu/karty, tryb autora, tryb formy treści i każdą włączoną funkcję ukrywania powierzchni.
5. W przypadku normalnych grup czasowych sprawdź naliczanie widocznych stron, brak blokowania wygaśnięcia limitu lub zliczanie oraz interwał resetowania.
6. W przypadku reguł niestandardowych uruchom sprawdzanie składni, Uruchom, sprawdź liczbę/dzienniki obsługi, przetestuj każde zarejestrowane wbudowane zdarzenie, a następnie przetestuj ponowne ładowanie/nawigację.
7. Przetestuj każdy niestandardowy timer na granicach zakresu i przy zera; sprawdź, czy jakikolwiek blok jest jawny w regule.
8. Przetestuj panele z każdą wartością kontrolną, stanem wyłączenia, akcją przesłania/anulowania/zamknięcia i obsługą zdarzenia panelEvent.
9. Zanim się powiedzie, przetestuj awarię folderu lokalnego: brak wybranego folderu, cofnięte uprawnienia, nieprawidłowa ścieżka, nieobsługiwane rozszerzenie, następnie autoryzowany odczyt/zapis.
10. Przetestuj automatyczne uruchamianie transportu, grupy połączone/rozłączone i element klastra offline, zanim zaczniesz polegać na synchronizacji lub koordynacji zamrożenia.

## 13. Reguła wersjonowania

Ten plik w języku angielskim stanowi utrzymywaną instrukcję źródłową. Zlokalizowane podręczniki są ich tłumaczeniami i mogą wymagać regeneracji po aktualizacji dokumentacji funkcjonalnej. Źródło produktu pozostaje prawdą kanoniczną w przypadku niejednoznaczności na poziomie wdrożenia.
