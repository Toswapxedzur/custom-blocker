# Polityka prywatności — Niestandardowa blokada sieci

_Ostatnia aktualizacja: 2026-07-13_

Na tej stronie dokładnie wyjaśniono, jakie dane ma przeglądarka **Custom Web Blocker**
rozszerzenie zbiera, dokąd trafia i dlaczego każde uprawnienie przeglądarki jest
żądane. W skrócie: nie zapisujemy Twoich reguł ani osobistych danych
przeglądania. Reguły tagów mogą odpytywać publiczne identyfikatory kanałów
YouTube, ale zapytania nie są przechowywane ani łączone z Tobą.

## Podsumowanie

- **Konfiguracja pozostaje w przeglądarce.** Grupy, harmonogramy, reguły, logi,
  liczniki i preferencje są zapisywane wyłącznie w `chrome.storage.local`.
- **Zapytanie tagów zawiera tylko publiczny identyfikator kanału.** Nie wysyła
  adresu URL, tytułu, wyszukiwania, czasu, konta ani ustawień rozszerzenia.
- **Zapytania nie są zapisywane.** Endpoint jest tylko do odczytu, nie dodaje
  nieznanych kanałów i nie przypisuje żądania do osoby.
- **Brak analityki, telemetrii, reklam i raportów o awariach.**
- **Brak śledzenia** aktywności przeglądania poza niezbędnym zakresem
  aby zastosować skonfigurowane przez siebie reguły blokowania.

## Co jest przechowywane lokalnie

Rozszerzenie przechowuje następujące informacje w lokalnym rozszerzeniu przeglądarki
Storage, aby mógł wykonywać swoją pracę w różnych sesjach:

- Tworzone przez Ciebie grupy bloków: ich nazwy, typy reguł, listy
  zablokowane witryny, harmonogramy, ustawienia drzemki, stan zawieszenia i dowolne
  niestandardową regułę JavaScript, którą piszesz.
- Stan środowiska wykonawczego dla poszczególnych grup potrzebny do egzekwowania limitów (np. ile
  minut z budżetu na opóźnione zasiłki pozostały dzisiaj, kiedy zapadła drzemka
  kończy się wraz z zakończeniem okresu ścisłego zamrożenia).
- Twoje własne preferencje ustawione w **Ustawieniach** (częstotliwość zaznaczania, autozapis
  odrzucenie, domyślny czas drzemki, domyślny zastępczy adres URL, tryb debugowania
  przełącznik, wybrany język interfejsu użytkownika).
- Wpisy dziennika aktywności wyświetlane w panelu **Dziennik** w aplikacji, co jest możliwe
  jasne z interfejsu użytkownika.

Dane te są odczytywane i zapisywane wyłącznie przez własne skrypty rozszerzenia
na Twoim urządzeniu i wyłącznie w Twoim profilu przeglądarki.

## Czego NIE zbiera się ani nie przekazuje

- Historia przeglądania nie jest rejestrowana, podsumowywana ani przesyłana.
- Treść strony nie jest eksfiltrowana, nie robi zrzutów ekranu ani nie jest rejestrowana.
- Dane wejściowe, hasła i dane osobowe nigdy nie są odczytywane.
- Żadne informacje o Tobie, Twoim urządzeniu ani sposobie użytkowania nie są wysyłane do
  autora rozszerzenia lub jakąkolwiek stronę trzecią.

## Dlaczego wymagane jest każde pozwolenie

| Pozwolenie | Do czego służy |
| --- | --- |
| `storage` | Zapisz i załaduj grupy bloków, ustawienia i stan środowiska wykonawczego tylko w przeglądarce. |
| `favicon` | Wyświetla w Chromium obok reguł ikony witryn zapisane lokalnie w pamięci podręcznej przeglądarki. Nie wysyła historii ani żądania do naszej usługi. |
| `nativeMessaging` | W Chromium żąda lokalnego na urządzeniu dowodu Native Messaging dla uwierzytelnionego mostu Vault Classifier; w Safari przekazuje żądania piaskownicy reguł niestandardowych do lokalnej aplikacji na urządzeniu. Nie jest to transport chmurowy. |
| `alarms` | Obudź pracownika usługi działającej w tle zgodnie z harmonogramem, aby odświeżyć limity czasowe i zaktualizować stan reguły po zakończeniu okna drzemki, zawieszenia lub harmonogramu. |
| `offscreen` | Uruchom JavaScript z niestandardową regułą w trybie piaskownicy w dokumencie poza ekranem, aby nie mógł uciec z rozszerzenia ani bezpośrednio dotknąć Twoich stron. |
| `tabs` | Otwórz edytor w trybie pełnej karty po kliknięciu ikony na pasku narzędzi, wyszukaj adres URL aktywnej karty, aby ocenić reguły grupowe i ponownie załaduj karty po zmianie reguły wprowadzonej w edytorze. |
| `webNavigation` | Wykrywaj zmiany adresu URL SPA (nawigacja w trybie push), aby mechanizmy ukrywania kanałów dla poszczególnych platform i reguły oparte na zdarzeniach mogły reagować na nawigację w obrębie strony, a nie tylko ładowanie całej strony. |
| `<all_urls>` dostęp do hosta | Zastosuj reguły blokowania i filtry kanałów dla poszczególnych platform w witrynach, które chcesz zablokować. Rozszerzenie odczytuje/modyfikuje strony tylko pod adresami URL, dla których aktywnie skonfigurowano regułę i tylko w celu wymuszenia tej reguły. |

## Reguły niestandardowe

Jeśli napiszesz niestandardowe reguły JavaScript, ten kod:

- Działa w dokumencie w trybie piaskownicy poza ekranem; nie może bezpośrednio dotrzeć do
  sieć, Twoje strony lub inne rozszerzenia.
- Komunikuje się ze skryptami treści tylko poprzez stały mostek komunikatów
  zdefiniowane przez pomocniczy interfejs API rozszerzenia.
- Jest automatycznie poddawany kwarantannie (wyłączany wpisem w dzienniku), jeśli tak jest
  przekracza wbudowane limity procesora, dziennika, komunikatów po wiadomościach lub mutacji DOM.

Twoje niestandardowe reguły są przechowywane lokalnie wraz z resztą ustawień
i nigdy nie są przesyłane poza urządzenie.

## Statystyki witryny i usługi tagów twórcy

Ta sekcja dotyczy **witryny i usługi tagów twórców**. Rozszerzenie może w trybie
tylko do odczytu odpytywać publiczne ID kanałów; żądania nie są zapisywane.
Panel **Statystyki** przechowuje tylko liczniki niepowiązane z osobą:

- **Liczba pobrań** — ile razy był przycisk pobierania każdego produktu
  kliknięty (macOS, Windows, rozszerzenie przeglądarki, Safari).
- **Sklasyfikowani twórcy** – ilu twórców YouTube zostało oznaczonych.
- **Konta** — ile kont istnieje.
- **Aktywność pytań i odpowiedzi** — łączna liczba postów i komentarzy na forum.

Raz na godzinę serwer zapisuje aktualną wartość każdego z tych zliczeń i
nic więcej. Nie ma żadnych rekordów dotyczących poszczególnych zdarzeń, strumieni kliknięć ani sesji
historia.

- **W pełni anonimowe / pozbawione identyfikacji.** Są to zwykłe sumy bieżące. Oni
  nie są** powiązane z Twoim imieniem i nazwiskiem, kontem, adresem e-mail, adresem IP, urządzeniem ani żadnym innym
  inny identyfikator — nie ma możliwości przypisania licznika do osoby.
- **Nigdy komercyjne.** Te dane istnieją wyłącznie w celu pokazania publicznych statystyk
  panelu. Nie jest **nigdy sprzedawany, udostępniany osobom trzecim, używany w celach reklamowych,
  lub wykorzystane w jakimkolwiek innym celu komercyjnym.**
- **Opcjonalne wkłady w postaci identyfikatora kanału.** Jeśli – i tylko wtedy – wyrazisz na to zgodę,
  rozszerzenie/strona internetowa może udostępniać YouTube **identyfikatory kanałów** (nigdy tytuły filmów,
  historię oglądania lub cokolwiek osobistego), aby pomóc w sklasyfikowaniu twórców dla każdego.
- **Wkłady ręczne.** Przy świadomym zgłoszeniu zalogowanego użytkownika powiązanie
  e-mail–kanał jest przechowywane tylko przez ruchome okno 24 godzin i czyszczone co godzinę.
- **Kolejka publiczna.** Może pokazywać publiczny ID i stan, lecz nie czas ani zgłaszającego.

## Dzieci

Rozszerzenie jest narzędziem zwiększającym produktywność ogólnego przeznaczenia. Tak nie jest
skierowany do dzieci, nie zbiera świadomie od nikogo danych oraz
nie wyświetla żadnych reklam.

## Zmiany w tej polityce

Jeśli praktyki dotyczące danych kiedykolwiek ulegną zmianie w przyszłej wersji, ten plik ulegnie zmianie
zostać zaktualizowane, a zmiana zostanie podsumowana w uwagach do wersji
to wydanie.

## Kontakt

Pytania, wątpliwości lub raporty o błędach: otwórz problem na stronie
repozytorium źródłowego rozszerzenia lub skorzystaj z adresu e-mail pomocy technicznej podanego na stronie
Lista Chrome Web Store.
