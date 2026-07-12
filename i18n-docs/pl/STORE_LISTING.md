# Źródło informacji o sklepie Chrome Web Store

To jest angielskie źródło bieżącego rozszerzenia Manifest V3. Sprawdź to względem `manifest.json` przed opublikowaniem nowej wersji sklepu.

## Nazwa rozszerzenia

```text
Adamancia Vault
```

## Krótki opis

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## Szczegółowy opis

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## Wyjaśnienia dotyczące uprawnień

| Pozwolenie | Obecny cel |
| --- | --- |
| `storage` | Zapisz grupy, ustawienia i stan edytora lokalnego. |
| `alarms` | Zaplanuj sprawdzanie przeszłości i aktualizacje grup na podstawie czasu. |
| `offscreen` | Uruchom kontrolowane środowisko wykonawcze reguł niestandardowych, w którym Chromium wymaga dokumentu poza ekranem. |
| `tabs` | Przeczytaj kontekst aktywnej karty potrzebny do zastosowania grupy i pokazania stanu. |
| `webNavigation` | Po nawigacji ponownie oceń odpowiednie grupy. |
| `favicon` | Wyświetlaj ikony witryn internetowych w edytorze, jeśli są dostępne. |
| `<all_urls>` | Zastosuj utworzone przez użytkownika reguły witryny i platformy do stron, które użytkownik wybiera do kontrolowania. |

## Zwolnij kontrole

1. Uruchom `./tests/run.sh`.
2. Zaktualizuj wersję manifestu tylko dla zatwierdzenia wydania.
3. Przejrzyj podręcznik w języku angielskim i wyniki kontroli tłumaczeń.
4. Zbuduj artefakt przesyłania na podstawie sprawdzonego zatwierdzenia.
5. Do przesyłanego artefaktu nie dołączaj notatek źródłowych, urządzeń testowych ani prywatnych plików programistycznych.
