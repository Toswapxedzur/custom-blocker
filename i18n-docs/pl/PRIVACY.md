# Polityka prywatności — Niestandardowa blokada sieci

_Ostatnia aktualizacja: 2026-08-04_

Ta strona wyjaśnia dokładnie, jakie dane zbiera rozszerzenie przeglądarki **Niestandardowa blokada sieci**, dokąd trafiają i dlaczego wymagane jest każde uprawnienie przeglądarki. W skrócie: nie przechowujemy Twoich reguł ani osobistych danych przeglądania. Opcjonalne zbieranie i klasyfikacja przez Vault Classifier pozostają pod Twoją kontrolą i korzystają z uwierzytelnionego mostka lokalnego. Odrębna, opcjonalna integracja lokalnej SI (MCP) również jest domyślnie wyłączona i udostępnia dane wyłącznie asystentowi, którego samodzielnie połączysz i zatwierdzisz.

## Podsumowanie

- **Twoja konfiguracja pozostaje w przeglądarce.** Grupy blokowania, harmonogramy, reguły niestandardowe, dzienniki, liczniki czasu i preferencje są przechowywane wyłącznie w lokalnej pamięci rozszerzenia Chrome (`chrome.storage.local`).
- **Vault Classifier działa wyłącznie lokalnie.** Jeśli jawnie włączysz opcjonalną integrację z Vault Classifier, widoczne elementy kart/stron YouTube (takie jak tytuł, widoczny opis, wyświetlane etykiety oraz publiczne identyfikatory twórcy/wideo) są kierowane wyłącznie przez uwierzytelniony lokalny mostek Vault do Vault Classifier na Twoim Macu. Nie są wysyłane do naszej witryny, do dostawcy modelu, do interfejsu YouTube Data API ani do żadnego innego serwera.
- **Zbieranie to osobna zgoda (opt-in).** Vault Classifier prosi rozszerzenie o wyrenderowane metadane YouTube bez reklam dopiero po włączeniu przez Ciebie zbierania z YouTube w jego obszarze roboczym danych klasyfikacji. Gdy jest wyłączone, rozszerzenie nie wysyła żadnego tytułu ani metadanych twórcy na potrzeby zbierania. Gdy jest włączone, zachowywane pola lokalne mogą obejmować widoczny tytuł, nazwę/identyfikator twórcy, typ wideo, czas trwania, widoczny tekst z liczbą subskrybentów/wyświetleń/datą publikacji oraz kanoniczny adres URL.
- **Opcjonalna integracja lokalnej SI (MCP).** Jeśli ją włączysz i połączysz własnego asystenta SI, taki asystent może — na Twoje wyraźne polecenie — odczytać wybrane dane (Twoją konfigurację, aktywność, czas użytkowania, adresy URL aktywnej/otwartych kart, widoczną treść stron w skonfigurowanych przez Ciebie witrynach oraz wszelkie dane Classifier) za pośrednictwem lokalnego serwera Vault na Twoim urządzeniu. Jest domyślnie wyłączona, każde połączenie jest przez Ciebie zatwierdzane, a hasła i klucze API nigdy nie są przez nią odczytywalne. Zobacz „Opcjonalna integracja lokalnej SI (MCP)” poniżej.
- **Nie ma analityki, profilu reklamowego, telemetrii ani raportowania awarii.**
- **Brak śledzenia** aktywności przeglądania poza tym, co jest ściśle niezbędne do stosowania reguł blokowania, które sam skonfigurowałeś.

## Co jest przechowywane lokalnie

Rozszerzenie przechowuje następujące elementy w lokalnej pamięci rozszerzenia Twojej przeglądarki, aby mogło działać między sesjami:

- Utworzone przez Ciebie grupy blokowania: ich nazwy, typy reguł, listy zablokowanych witryn, harmonogramy, ustawienia drzemki (snooze), stan zamrożenia oraz dowolny kod JavaScript reguł niestandardowych, który napiszesz.
- Stan wykonawczy poszczególnych grup potrzebny do egzekwowania limitów (np. ile minut z odroczonego budżetu przydziału pozostało dzisiaj, kiedy kończy się drzemka, kiedy kończy się okres ścisłego zamrożenia).
- Twoje własne preferencje ustawione w **Ustawieniach** (częstotliwość odświeżania, opóźnienie automatycznego zapisu, domyślny czas drzemki, domyślny zapasowy adres URL, przełącznik trybu debugowania, wybrany język interfejsu).
- Wpisy dziennika aktywności widoczne w panelu **Dziennik** w aplikacji, które możesz wyczyścić z poziomu interfejsu.
- Gdy jawnie włączysz Vault Classifier, jego lokalna aplikacja utrzymuje ograniczoną przez użytkownika lokalną pamięć podręczną widocznych danych, ocen lokalnych, decyzji i korekt potrzebnych do klasyfikowania i objaśniania wpisów. Ta pamięć podręczna pozostaje na Twoim Macu i nie jest częścią normalnego ruchu między rozszerzeniem a serwerem.

Twoja konfiguracja, stan wykonawczy i dziennik aktywności pozostają na Twoim urządzeniu i nie są zapisywane przez naszą usługę. W zależności od kompilacji przeglądarki i włączonych funkcji mogą być przetwarzane przez rozszerzenie, jego lokalną aplikację towarzyszącą dla Safari lub jawnie połączony lokalny mostek Vault.

## Co NIE jest zbierane ani przesyłane

Poniższe opisuje, jak rozszerzenie zachowuje się samo z siebie. Jedynym wyjątkiem jest opcjonalna integracja lokalnej SI (MCP), którą możesz samodzielnie włączyć i połączyć, opisana w następnej sekcji.

- Historia przeglądania nie jest przez samo rozszerzenie rejestrowana, podsumowywana ani przesyłana; służy wyłącznie do stosowania skonfigurowanych przez Ciebie reguł.
- Treść stron nie jest przez samo rozszerzenie wykradana, zrzucana jako zrzut ekranu ani rejestrowana.
- Dane Vault Classifier nie są przez rozszerzenie przesyłane poza urządzenie. Są przetwarzane przez sparowany lokalny mostek i aplikację wyłącznie wtedy, gdy jawnie włączysz tę integrację.
- Dane wpisywane w formularzach i hasła nigdy nie są odczytywane przez rozszerzenie; hasła i klucze API nie są też odczytywalne przez integrację lokalnej SI (MCP).
- Na potrzeby normalnego egzekwowania reguł nie jest przesyłany żaden identyfikator rozszerzenia, konta ani urządzenia, ani Twoja konfiguracja reguł.

## Opcjonalna integracja lokalnej SI (MCP)

Rozszerzenie może opcjonalnie odpowiadać na żądania lokalnego **serwera MCP Vault** działającego wewnątrz aplikacji komputerowych Vault na Twoim własnym urządzeniu, dzięki czemu możesz połączyć własnego asystenta SI („klienta MCP”) i sprawić, by odczytywał Twoją konfigurację Vault lub działał na niej w Twoim imieniu. Ta integracja jest **domyślnie wyłączona** i niczego nie zmienia, dopóki jej celowo nie włączysz.

- **To Ty ją inicjujesz.** Nic nie jest udostępniane, dopóki nie włączysz integracji i nie połączysz klienta MCP, a każde połączenie klienta jest przez Ciebie zatwierdzane. Wyłączenie natychmiast cofa dostęp.
- **Serwer jest lokalny.** Dane dostarczane przez rozszerzenie są przekazywane — przez ten sam uwierzytelniony mostek na urządzeniu — do serwera MCP Vault na Twoim Macu, a nie do naszej witryny ani żadnego serwera Vault. Samo rozszerzenie nie wysyła Twoich danych do osób trzecich.
- **Następnie decyduje Twój asystent.** Gdy połączony klient MCP otrzyma dane na Twoje żądanie, to, co się z nimi dzieje, jest regulowane przez **tego klienta** i jego własne warunki prywatności. Jeśli wybrany asystent opiera się na usłudze zdalnej, może on przesłać Twoje dane na Twoje polecenie — tak samo jak wtedy, gdy wklejasz informacje do dowolnego narzędzia SI. Wybieraj klienta, któremu ufasz.
- **Co może zostać udostępnione.** Na Twoje polecenie połączony asystent może odczytać Twoje grupy blokowania, harmonogramy, reguły niestandardowe, dziennik aktywności, liczniki czasu użytkowania, adres URL aktywnej karty lub otwartych kart, widoczną treść stron w skonfigurowanych przez Ciebie witrynach oraz wszelkie dane i decyzje Vault Classifier. Działania zmieniające stan (edytowanie grup, uruchamianie drzemki, uruchamianie zapisanej reguły, wyzwalanie klasyfikacji) są potwierdzane pojedynczo.
- **Sekrety pozostają tajne.** Hasła (takie jak hasło kontroli rodzicielskiej) i klucze API dostawców są w ramach tej integracji **tylko do zapisu**: można je ustawić, ale żaden asystent nie może ich odczytać.
- **Tylko Chromium.** Podobnie jak mostek Classifier, ta integracja istnieje wyłącznie w przeglądarkach Chromium z lokalnym hostem na urządzeniu; Firefox i Safari jej nie udostępniają.

## Dlaczego wymagane jest każde uprawnienie

| Uprawnienie | Do czego służy |
| --- | --- |
| `storage` | Zapisywanie i wczytywanie Twoich grup blokowania, ustawień i stanu wykonawczego wyłącznie w Twojej przeglądarce. |
| `favicon` | Wyświetlanie obok reguł ikon witryn z pamięci podręcznej przeglądarki w Chromium. Nie wysyła to historii przeglądania ani nie wykonuje żądań do naszej usługi. |
| `nativeMessaging` | W Chromium żądanie od urządzenia lokalnego dowodu Native Messaging dla uwierzytelnionego mostka Vault Classifier; w Safari przekazywanie żądań piaskownicy reguł niestandardowych do lokalnej aplikacji kontenerowej urządzenia. Nie jest to transport w chmurze. |
| `alarms` | Wybudzanie service workera w tle zgodnie z harmonogramem w celu odświeżenia limitów opartych na czasie i stanu reguł, gdy kończy się okno drzemki, zamrożenia lub harmonogramu. |
| `offscreen` | Uruchamianie kodu JavaScript reguł niestandardowych w piaskownicy w dokumencie poza ekranem, aby nie mógł wydostać się z rozszerzenia ani bezpośrednio dotykać Twoich stron. |
| `tabs` | Otwieranie edytora jako pełnej karty po kliknięciu ikony na pasku narzędzi, sprawdzanie adresu URL aktywnej karty w celu oceny reguł grupy oraz przeładowywanie kart po zmianie reguły wprowadzonej przez Ciebie w edytorze. |
| `webNavigation` | Wykrywanie zmian adresu URL w aplikacjach SPA (nawigacja push-state), aby ukrywacze kanałów właściwe dla platform i reguły sterowane zdarzeniami mogły reagować na nawigację wewnątrz strony, a nie tylko na pełne wczytania stron. |
| Dostęp do hostów `<all_urls>` | Stosowanie Twoich reguł blokowania i ukrywaczy kanałów właściwych dla platform w witrynach, które zdecydujesz się zablokować. Rozszerzenie odczytuje/modyfikuje strony wyłącznie pod adresami URL, dla których aktywnie skonfigurowałeś regułę, i tylko w celu jej egzekwowania; opcjonalny adapter Vault Classifier jest ograniczony do YouTube. |

## Reguły niestandardowe

Jeśli piszesz niestandardowe reguły JavaScript, ten kod:

- Działa w piaskownicy w dokumencie poza ekranem; nie może bezpośrednio sięgnąć do sieci, Twoich stron ani innych rozszerzeń.
- Komunikuje się ze skryptami treści wyłącznie przez stały mostek komunikatów zdefiniowany przez pomocnicze API rozszerzenia.
- Jest automatycznie poddawany kwarantannie (wyłączany z wpisem w dzienniku), jeśli przekroczy wbudowane limity CPU, dziennika, komunikatów (post-message) lub mutacji DOM.

Twoje reguły niestandardowe są przechowywane lokalnie wraz z resztą Twoich ustawień i nigdy nie są przesyłane poza urządzenie.

## Statystyki witryny

Ta sekcja dotyczy **witryny**. Witryna publikuje niewielki panel **Statystyki**, a aby go wypełnić, serwer przechowuje kilka zagregowanych liczników:

- **Liczby pobrań** — ile razy kliknięto przycisk pobierania każdego produktu (macOS, Windows, rozszerzenie przeglądarki, Safari).
- **Konta** — ile kont istnieje.
- **Aktywność pytań i odpowiedzi** — łączna liczba wpisów i komentarzy na forum.

Raz na godzinę serwer zapisuje bieżącą wartość każdego zagregowanego licznika. Te migawki nie zawierają żadnego zdarzenia przypisanego do odwiedzającego, ścieżki kliknięć ani historii sesji.

- **W pełni anonimowe / pozbawione identyfikacji.** To zwykłe sumy narastające. **Nie** są powiązane z Twoim imieniem, kontem, adresem e-mail, adresem IP, urządzeniem ani żadnym innym identyfikatorem — nie ma sposobu, aby przypisać licznik do osoby.
- **Nigdy komercyjne.** Te dane istnieją wyłącznie po to, aby wyświetlać publiczny panel Statystyki. **Nigdy nie są sprzedawane, udostępniane osobom trzecim, wykorzystywane do reklamy ani do żadnego innego celu komercyjnego.**

## Dzieci

Rozszerzenie jest narzędziem zwiększającym produktywność ogólnego przeznaczenia. Nie jest skierowane do dzieci, świadomie nie zbiera danych od nikogo i nie wyświetla reklam.

## Zmiany w tej polityce

Jeśli praktyki dotyczące danych kiedykolwiek zmienią się w przyszłej wersji, ten plik zostanie zaktualizowany, a zmiana zostanie podsumowana w informacjach o wersji dla tego wydania.

## Kontakt

Pytania, wątpliwości lub zgłoszenia błędów: otwórz zgłoszenie (issue) w repozytorium źródłowym rozszerzenia lub skorzystaj z adresu e-mail pomocy technicznej podanego na stronie w Chrome Web Store.
