# Chrome Web Store-Eintragsquelle

Dies ist die englische Quelle für die aktuelle Manifest V3-Erweiterung. Überprüfen Sie es anhand von `manifest.json`, bevor Sie einen neuen Store-Build veröffentlichen.

## Erweiterungsname

```text
Adamancia Vault
```

## Kurze Beschreibung

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## Detaillierte Beschreibung

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

##Berechtigungserklärungen

| Erlaubnis | Aktueller Zweck |
| --- | --- |
| `storage` | Speichern Sie Gruppen, Einstellungen und den Status des lokalen Editors. |
| `alarms` | Planen Sie Hintergrundüberprüfungen und zeitbasierte Gruppenaktualisierungen. |
| `offscreen` | Führen Sie die kontrollierte Laufzeit mit benutzerdefinierten Regeln aus, wobei Chromium ein Offscreen-Dokument erfordert. |
| `tabs` | Lesen Sie den Kontext der aktiven Registerkarte, der zum Anwenden einer Gruppe und zum Anzeigen des Status erforderlich ist. |
| `webNavigation` | Bewerten Sie die entsprechenden Gruppen nach der Navigation erneut. |
| `favicon` | Zeigen Sie Website-Symbole im Editor an, sofern verfügbar. |
| `<all_urls>` | Wenden Sie vom Benutzer erstellte Website- und Plattformregeln auf Seiten an, die der Benutzer steuern möchte. |

## Freigabeprüfungen

1. Führen Sie `./tests/run.sh` aus.
2. Aktualisieren Sie die Manifestversion nur für das Release-Commit.
3. Sehen Sie sich das englische Handbuch und die Übersetzungsprüfungsergebnisse an.
4. Erstellen Sie das Upload-Artefakt aus dem überprüften Commit.
5. Fügen Sie dem Upload-Artefakt keine Quellhinweise, Testvorrichtungen oder privaten Entwicklungsdateien hinzu.
