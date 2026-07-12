# Rozszerzenie skarbca

Rozszerzenie Vault to narzędzie skupiające Manifest V3 dla przeglądarek Chromium. Jego obecny edytor zarządza grupami blokowania witryn internetowych, grupami obsługiwanych platform, niestandardowymi grupami JavaScript, harmonogramami, elementami sterującymi blokowania i drzemki oraz opcjonalnymi łączami mostowymi aplikacji internetowych.

Kod źródłowy stanowi umowę dotyczącą produktu. Podręcznik w aplikacji w języku angielskim pod adresem [manual/en.md](manual/en.md) wyjaśnia dostarczone elementy sterujące; zastępuje poprzednie podręczniki skopiowane i przetłumaczone maszynowo.

## Aktualne możliwości

- Domyślne grupy witryn internetowych z zachowaniem listy blokowanych lub dozwolonych, opcjonalnym przekierowaniem, natychmiastowym blokowaniem, limitem czasu lub odliczaniem.
- Dedykowane grupy dla YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord i Twitter / X.
- Filtry specyficzne dla platformy i opcjonalne elementy sterujące ukrywaniem, jeśli obsługuje je bieżący profil platformy.
- Niestandardowe grupy JavaScript ze sprawdzaniem składni, szablonami, kontrolkami uruchamiania, kontrolowanym środowiskiem wykonawczym i źródłem dziennika.
- Harmonogramy dla grup, tryby zamrażania, sterowanie drzemką, import/eksport i automatyczne zapisywanie.
- Opcjonalny dostęp do folderu lokalnego dla obsługiwanych operacji tekstowych, CSV i JSON z regułami niestandardowymi.
— Opcjonalne połączenie z natywnym koncentratorem mostu Vault dla jawnie połączonych grup.

## Uruchom lokalnie

1. Otwórz `chrome://extensions` w przeglądarce Chromium.
2. Włącz **Tryb programisty**.
3. Wybierz **Załaduj rozpakowane** i wybierz ten folder repozytorium.
4. Otwórz rozszerzenie Vault i utwórz grupę.

Manifest wymaga przeglądarki Chrome 116 lub nowszej w celu obsługi bieżących interfejsów API poza ekranem i reguł.

## Kontrole rozwoju

Uruchom zestaw testów rozszerzeń z tego folderu:

```bash
./tests/run.sh
```

Pakiet sprawdza zachowanie pomocnika, profile platform, renderowanie Markdown i audyt katalogu tłumaczeń.

## Zlokalizowane podręczniki i tłumaczenia

Źródłem kanonicznym pozostają dokumenty angielskie. Rozszerzenie dostarcza zlokalizowane podręczniki obok `manual/en.md`, a zlokalizowane kopie innych utrzymywanych dokumentów znajdują się pod `i18n-docs/<locale>/`.

Katalogi interfejsu użytkownika w `translation/*.json` są kompletne dla każdej obsługiwanej lokalizacji. Sprawdź katalogi i zlokalizowane dokumenty za pomocą:

```bash
node scripts/translation-audit.js
node scripts/documentation-audit.js
```

## Zakres

Rozszerzenie Vault działa tylko w profilu przeglądarki, w którym jest zainstalowane, oraz na stronach, do których przeglądarka zapewnia mu dostęp. Nie instaluje aplikacji natywnych, nie zmienia uprawnień systemowych ani nie synchronizuje grup, chyba że użytkownik wyraźnie podłączy most i połączy pasujące grupy.
