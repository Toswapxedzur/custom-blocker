# Podręcznik użytkownika rozszerzenia przeglądarki Vault

Vault kontroluje witryny i obsługiwane treści platform w profilu przeglądarki, w którym jest zainstalowany. Otwórz edytor przyciskiem rozszerzenia na pasku narzędzi. Po połączeniu Mac Vault lub Windows Vault zapewnia lokalne tagowanie i Activity; rozszerzenie egzekwuje cele przeglądarkowe.

## Grupy blokowania

**Grupa blokowania** stosuje zasady blokowania. **Grupa Classifier** przypisuje tagi do treści; sama niczego nie blokuje.

1. Dodaj grupę blokowania i nadaj jej nazwę.
2. Wybierz cele w sekcji **Dotyczy**.
3. Wybierz, kiedy blokowanie ma obowiązywać, a następnie ustaw harmonogram lub dozwolony czas.
4. Włącz grupę. Jej cele współdzielą zasady grupy.

Zwykłe zmiany są zapisywane automatycznie. Błąd oznacza, że zmiana nie została zaakceptowana; popraw pole i spróbuj ponownie. Wyłącz grupę, aby wstrzymać jej zasady, zachowując konfigurację. **Usuń grupę** usuwa ją. Przeciągaj grupy, aby zmienić ich kolejność. Do celu może pasować kilka grup; odroczenie jednej nie znosi blokady innej.

**Eksportuj** kopiuje konfigurację grupy. **Importuj** zastępuje konfigurację wybranej grupy po potwierdzeniu.

### Dozwolony czas i harmonogram

**Blokuj natychmiast** obowiązuje, gdy włączona grupa pasuje i jej harmonogram jest aktywny. **Blokuj po wykorzystaniu dozwolonego czasu** zezwala na pasujące użycie, dopóki limit czasu się nie wyczerpie.

Ustaw dozwolony czas w minutach, a interwał resetowania w godzinach. Limit kroczący zlicza użycie w poprzedzającym go oknie. Reset o północy rozpoczyna nowy okres o lokalnej północy, również dla limitu kroczącego.

Wybierz aktywne dni tygodnia i opcjonalne lokalne przedziały czasu, po jednym w wierszu, np. **09:00-12:00**. Pusta lista przedziałów oznacza cały wybrany dzień. Przedział musi kończyć się później niż zaczyna tego samego dnia; harmonogram nocny rozdziel na osobne dni.

### Odroczenie

Skonfiguruj odroczenie w każdej grupie blokowania. **Wstrzymaj blokowanie** zawiesza zasady grupy na określony czas. **Dodaj do dozwolonego czasu** dodaje dostępne minuty do grupy z limitem czasu. Jako czas odroczenia liczy się tylko wykorzystany dodatkowy limit. Niewykorzystany dodatkowy czas wygasa przy następnym resecie; dla limitu kroczącego po jednym oknie albo wcześniej o północy, jeśli ta opcja jest włączona.

**Opóźnienie aktywacji** odracza odroczenie, gdy blokowanie nadal działa. **Przerwa** to czas oczekiwania od zakończenia odroczenia do następnej prośby. **Wymagane potwierdzenia** ustawia liczbę etapów potwierdzania. Odroczenie jest dostępne dla zamrożonej grupy tylko wtedy, gdy zezwolono na nie przed zamrożeniem.

### Zamrażanie i PIN

**Zamroź** uniemożliwia zwykłe zmiany. Odmrożenie wymaga dziesięciu potwierdzeń w odstępach pięciu sekund oraz skonfigurowanego czasu oczekiwania i sześciocyfrowego PIN-u. **Czekaj przed odmrożeniem** przyjmuje 0–72 godziny; 0 nie dodaje oczekiwania.

Podczas zamrożenia można wydłużyć czas oczekiwania i dodać PIN, jeśli go nie ma. Tych warunków nie można złagodzić przed odmrożeniem grupy. Usunięcie również wymaga odczekania pozostałego czasu i podania PIN-u.

### Połączone grupy

Użyj **Połącz**, aby połączyć jawnie wybrane grupy w innych programach Vault. Połączone grupy współdzielą nazwę, obsługiwane ustawienia zasad, cele, użycie i warunki zamrożenia. Każdy program edytuje i egzekwuje obsługiwane przez siebie typy celów; pozostałe wpisy celów są dostępne dla połączonych programów. Rozłączenie zachowuje każdą grupę i jej ustawienia.

Jeśli połączony element jest offline, edycja może być niedostępna. Otwórz aplikację Vault na komputerze i połączoną przeglądarkę, aby ponownie nawiązać połączenie. Zapisane lokalnie zasady mogą nadal obowiązywać, gdy element jest offline.

## Uzyskiwanie pomocy

Kliknij małe **i** obok pola, aby zobaczyć wyjaśnienie. Kliknij poza nim lub naciśnij Escape, aby zamknąć. Listy znajdują się w przewijanych polach; przewiń pole, aby zobaczyć więcej pozycji. Wyszukiwanie filtruje widoczną listę bez usuwania pozycji.

Reguły niestandardowe mają osobny [Podręcznik kodu](../code-manual/pl.md). Wyjaśnia on edytor, aktywację, dzienniki, dostęp do plików i obsługiwane API.

## Witryny i treści platform

Dodawaj domeny lub pełne adresy URL, po jednym wpisie. Domena obejmuje subdomeny. Ścieżka ogranicza dopasowanie do niej i jej elementów podrzędnych. **Blokuj wszystko oprócz tych witryn** zmienia listę w listę dozwolonych.

Tę samą witrynę można dodać wiele razy. Każdy wpis ma osobny filtr i elementy sterujące stroną; na przykład jeden wpis YouTube może blokować Shorts, a inny twórcę. Dopasowane wpisy łączą się w grupie i współdzielą jej harmonogram, dozwolony czas oraz odroczenie.

Cel może zasłonić pasującą stronę albo najpierw wstrzymać ją i zaoferować Kontynuuj po odliczaniu. W tej samej grupie cel blokowania ma pierwszeństwo przed celem wstrzymania. **Po zablokowaniu: przekieruj lub pokaż komunikat** przyjmuje adres internetowy albo komunikat zasłaniający; pozostaw pole puste, aby zasłonić stronę na miejscu. Wstrzymanie nigdy nie przekierowuje.

Cele platform używają **Twórców** dla platform wideo, **Kont** dla Twitter / X, **Społeczności** dla Reddit oraz identyfikatorów serwera/kanału dla Discord. Elementy sterujące działają tam, gdzie Vault potrafi rozpoznać źródło i typ treści. Kontrola treści ukrywa obsługiwane elementy strony, takie jak reklamy lub karty wideo. Uprawnienia przeglądarki i zmiany witryn mogą wpływać na te funkcje.

### Filtry tagów treści

Połączenie Classifier i poprawianie tagów są dostępne w obsługiwanych przeglądarkach Chromium, takich jak Chrome i Edge, oraz w Safari Vault na macOS.

Połącz Mac Vault lub Windows Vault i skonfiguruj Classifier, aby uzyskać tagi. Filtr tagów grupy blokowania wybiera treści do zasłonięcia lub ukrycia. Nie rozpoczyna ani nie wstrzymuje tagowania; użyj ustawień Classifier w aplikacji komputerowej lub elementu wstrzymania danej grupy Classifier.

Każdy wpis witryny ma jeden filtr **Zastosuj do**: wszystkie treści, wybrani twórcy, wszyscy oprócz wybranych twórców, wybrane tagi albo wszystkie oprócz wybranych tagów. Dodaj kolejny wpis tej samej witryny, aby użyć innego filtra.

Wybierz określone tagi albo wszystko oprócz nich. Reguła może łączyć tagi (**Gaming + Drama**), wymagać poziomu pewności (**Gaming @3**) lub tworzyć wyjątek (**!Tutorial**). **Zasłoń treści** pozostawia dostępne poprawianie tagów. **Ukryj treści** usuwa pasujący element.

**Blokuj także treści bez wiarygodnego tagu** obejmuje ukończone wyniki bez tagu przy domyślnym progu pewności, także wyniki o niskiej pewności. Najpierw sprawdzane są jawnie podane reguły. **Bez tagu** oznacza, że tagowanie się zakończyło, ale nie przypisano tagów; **Tagowanie** oznacza oczekujący wynik. Osobna opcja treści oczekujących kontroluje zasłanianie elementów do czasu zakończenia tagowania.

### Poprawianie tagów

Kliknij **+ tag** obok tagów elementu, aby otworzyć wybór poprawek. Wyszukaj istniejące tagi Classifier i wybierz jeden, aby go dodać. Kliknij przycisk usuwania zaznaczonego tagu albo zaznacz go i naciśnij Delete raz. Poprawki są wysyłane do połączonej aplikacji komputerowej i wykorzystywane w przyszłym tagowaniu. Niedostępne wyszukiwanie wyświetla **Bez tagu** i może zostać ponowione automatycznie; ten komunikat nie tworzy tagu w Classifier.

## Ustawienia i połączenie

**Pokaż przycisk szybkiego dodawania +** dodaje mały przycisk do obsługiwanych stron. Wybierz grupę docelową na liście; wybór zostanie zapamiętany po ponownym otwarciu Vault. Użyj przycisku strony, aby dodać ją do listy witryn. Na liście dozwolonych ta czynność zezwala na stronę. Zamrożone grupy nie przyjmują szybkich dodatków.

Oficjalne słowniki oraz import/eksport słownika osobistego konfiguruje się w aplikacji desktopowej w **Ustawienia → Klasyfikator → Oficjalne słowniki**. Przy braku twórcy w pamięci podręcznej lub włączonych opcjonalnych przekazaniach może zostać użyta usługa słowników; badania w sieci mają osobną zgodę i ustawienia dostawcy. Zobacz instrukcję desktopową i ujawnienia.

Połączenie Classifier pokazuje lokalną usługę Vault na komputerze. Skonfiguruj grupy Classifier, pobieranie modeli, Knowledge, zgodę na badania i dostawców API w połączonej aplikacji komputerowej.

Jeśli brakuje tagów, sprawdź, czy aplikacja Vault jest otwarta, połączenie działa, tagowanie jest włączone, odpowiednia grupa Classifier została wznowiona, a jej kanał platformy jest rejestrowany. Sprawdź stan pobierania modelu w aplikacji komputerowej. Jeśli blokowanie nie działa, sprawdź aktywność grupy, cele, harmonogram, dozwolony czas i stan odroczenia.
