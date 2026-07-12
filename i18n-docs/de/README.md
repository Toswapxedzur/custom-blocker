# Tresorerweiterung

Die Vault-Erweiterung ist ein Manifest V3-Fokus-Tool für Chromium-Browser. Der aktuelle Editor verwaltet Website-Blockgruppen, Gruppen unterstützter Plattformen, benutzerdefinierte JavaScript-Gruppen, Zeitpläne, Freeze- und Snooze-Steuerelemente sowie optionale Web-App-Bridge-Links.

Der Quellcode ist der Produktvertrag. Das englische In-App-Handbuch unter [manual/en.md](manual/en.md) erläutert die mitgelieferten Steuerelemente; Es ersetzt die bisherigen kopierten und maschinell übersetzten Handbücher.

## Aktuelle Fähigkeiten

- Standard-Website-Gruppen mit Blockierungs- oder Zulassungslistenverhalten, optionaler Weiterleitung, sofortiger Blockierung, Zeitvorgabe oder Countdown.
- Spezielle Gruppen für YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord und Twitter / X.
- Plattformspezifische Filter und optionale Steuerelemente zum Ausblenden von Elementen, sofern das aktuelle Plattformprofil sie unterstützt.
– Benutzerdefinierte JavaScript-Gruppen mit Syntaxprüfung, Vorlagen, Ausführungskontrollen, einer kontrollierten Laufzeit und einem Protokoll-Feed.
- Zeitpläne pro Gruppe, Einfriermodi, Schlummersteuerung, Import/Export und automatisches Speichern.
– Optionaler Zugriff auf lokale Ordner für unterstützte benutzerdefinierte Regeltext-, CSV- und JSON-Vorgänge.
– Optionale Verbindung zu einem nativen Vault-Bridge-Hub für explizit verknüpfte Gruppen.

## Lokal ausführen

1. Öffnen Sie `chrome://extensions` in einem Chromium-Browser.
2. Aktivieren Sie den **Entwicklermodus**.
3. Wählen Sie **Ungepackt laden** und wählen Sie diesen Repository-Ordner.
4. Öffnen Sie die Vault-Erweiterung und erstellen Sie eine Gruppe.

Das Manifest erfordert Chrome 116 oder höher für seine aktuellen Offscreen- und Regel-APIs.

## Entwicklungsprüfungen

Führen Sie die Erweiterungstestsuite aus diesem Ordner aus:

```bash
./tests/run.sh
```

Die Suite übt Hilfsverhalten, Plattformprofile, Markdown-Rendering und die Prüfung des Übersetzungskatalogs aus.

## Lokalisierte Handbücher und Übersetzungen

Die englischen Dokumente bleiben die kanonische Quelle. Die Erweiterung liefert ihre lokalisierten Handbücher neben `manual/en.md` und die lokalisierten Kopien anderer gepflegter Dokumente befinden sich unter `i18n-docs/<locale>/`.

Die UI-Kataloge in `translation/*.json` sind für jedes unterstützte Gebietsschema vollständig. Überprüfen Sie die Kataloge und lokalisierten Dokumente mit:

```bash
node scripts/translation-audit.js
node scripts/documentation-audit.js
```

## Geltungsbereich

Die Vault-Erweiterung funktioniert nur in dem Browserprofil, in dem sie installiert ist, und auf Seiten, auf die der Browser ihr Zugriff gewährt. Es werden keine nativen Apps installiert, Systemberechtigungen geändert oder Gruppen synchronisiert, es sei denn, der Benutzer stellt explizit eine Verbindung zu einer Bridge her und verknüpft passende Gruppen.
