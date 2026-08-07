# Datenschutzrichtlinie – Benutzerdefinierter Webblocker

_Letzte Aktualisierung: 04.08.2026_

Diese Seite erläutert genau, welche Daten die Browsererweiterung **Benutzerdefinierter Webblocker** erfasst, wohin sie gelangen und warum jede Browserberechtigung angefordert wird. Kurz gesagt: Wir speichern weder Ihre Regeln noch Ihre persönlichen Browserdaten. Die optionale Erfassung und Klassifizierung durch Vault Classifier bleibt unter Ihrer Kontrolle und nutzt die authentifizierte lokale Brücke. Eine gesonderte optionale lokale KI-Integration (MCP) ist ebenfalls standardmäßig deaktiviert und legt Daten nur einem Assistenten offen, den Sie selbst verbinden und freigeben.

## Zusammenfassung

- **Ihre Konfiguration bleibt in Ihrem Browser.** Blockgruppen, Zeitpläne, benutzerdefinierte Regeln, Protokolle, Timer und Einstellungen werden ausschließlich im lokalen Erweiterungsspeicher von Chrome (`chrome.storage.local`) gespeichert.
- **Vault Classifier ist rein lokal.** Wenn Sie die optionale Vault-Classifier-Integration ausdrücklich aktivieren, werden sichtbare YouTube-Karten-/Seiteninhalte (etwa ein Titel, die sichtbare Beschreibung, angezeigte Tags sowie öffentliche Ersteller-/Video-IDs) ausschließlich über die authentifizierte lokale Vault-Brücke an Vault Classifier auf Ihrem Mac weitergeleitet. Sie werden nicht an unsere Website, einen Modellanbieter, die YouTube Data API oder einen anderen Server gesendet.
- **Die Erfassung ist eine separate Zustimmung.** Vault Classifier fordert von der Erweiterung gerenderte, werbefreie YouTube-Metadaten erst an, nachdem Sie in seinem Arbeitsbereich für Klassifizierungsdaten die YouTube-Erfassung eingeschaltet haben. Ist sie aus, sendet die Erweiterung keinerlei Titel- oder Ersteller-Metadaten zur Erfassung. Ist sie ein, können die lokal gespeicherten Felder einen sichtbaren Titel, den Namen/die Kennung des Erstellers, den Videotyp, die Dauer, den sichtbaren Abonnenten-/Aufruf-/Veröffentlichungstext und die kanonische URL umfassen.
- **Optionale lokale KI-Integration (MCP).** Wenn Sie sie einschalten und Ihren eigenen KI-Assistenten verbinden, kann dieser Assistent – auf Ihre ausdrückliche Anweisung hin – ausgewählte Daten (Ihre Konfiguration, Aktivität, Nutzungszeit, die URLs des aktiven/geöffneten Tabs, sichtbare Seiteninhalte auf von Ihnen konfigurierten Websites sowie sämtliche Classifier-Nachweise) über einen lokalen Vault-Server auf Ihrem Gerät lesen. Sie ist standardmäßig deaktiviert, jede Verbindung wird von Ihnen freigegeben, und Passwörter sowie API-Schlüssel sind darüber niemals lesbar. Siehe „Optionale lokale KI-Integration (MCP)“ weiter unten.
- **Es gibt keine Analyse, kein Werbeprofil, keine Telemetrie und keinen Absturzbericht.**
- **Kein Tracking** der Browseraktivität über das hinaus, was zur Anwendung der von Ihnen selbst konfigurierten Blockierregeln unbedingt erforderlich ist.

## Was lokal gespeichert wird

Die Erweiterung speichert Folgendes im lokalen Erweiterungsspeicher Ihres Browsers, damit sie sitzungsübergreifend funktionieren kann:

- Die von Ihnen erstellten Blockgruppen: ihre Namen, Regeltypen, Listen blockierter Websites, Zeitpläne, Schlummereinstellungen (Snooze), Einfrierstatus sowie jedes von Ihnen geschriebene benutzerdefinierte Regel-JavaScript.
- Den pro Gruppe erforderlichen Laufzeitzustand zur Durchsetzung von Limits (z. B. wie viele Minuten eines aufgeschobenen Zeitkontingents heute noch übrig sind, wann ein Schlummern endet, wann eine Phase des strikten Einfrierens endet).
- Ihre eigenen unter **Einstellungen** festgelegten Präferenzen (Taktrate, Verzögerung des automatischen Speicherns, Standard-Schlummerdauer, Standard-Ausweich-URL, Umschalter für den Debugmodus, gewählte Oberflächensprache).
- Die im **Protokoll**-Bereich der App angezeigten Aktivitätsprotokolleinträge, die Sie über die Oberfläche löschen können.
- Wenn Sie Vault Classifier ausdrücklich aktivieren, führt seine lokale App einen benutzerbegrenzten lokalen Zwischenspeicher der sichtbaren Nachweise, lokalen Bewertungen, Entscheidungen und Korrekturen, die zum Klassifizieren und Erläutern von Einträgen nötig sind. Dieser Zwischenspeicher verbleibt auf Ihrem Mac und ist nicht Teil des normalen Datenverkehrs zwischen Erweiterung und Server.

Ihre Konfiguration, der Laufzeitzustand und das Aktivitätsprotokoll verbleiben auf Ihrem Gerät und werden von unserem Dienst nicht gespeichert. Je nach Browser-Build und den von Ihnen aktivierten Funktionen können sie von der Erweiterung, ihrer gerätelokalen Safari-Begleit-App oder einer ausdrücklich verknüpften lokalen Vault-Brücke verarbeitet werden.

## Was NICHT erfasst oder übertragen wird

Dies beschreibt das Verhalten der Erweiterung für sich genommen. Die einzige Ausnahme ist die optionale lokale KI-Integration (MCP), die Sie selbst aktivieren und verbinden können und die im nächsten Abschnitt beschrieben wird.

- Der Browserverlauf wird von der Erweiterung selbst weder aufgezeichnet noch zusammengefasst oder übertragen; er dient nur der Anwendung der von Ihnen konfigurierten Regeln.
- Seiteninhalte werden von der Erweiterung selbst weder abgezogen noch als Screenshot erfasst oder protokolliert.
- Vault-Classifier-Nachweise werden von der Erweiterung nicht vom Gerät übertragen. Sie werden nur dann von der gekoppelten lokalen Brücke und der App verarbeitet, wenn Sie diese Integration ausdrücklich aktivieren.
- Formulareingaben und Passwörter werden von der Erweiterung niemals gelesen; Passwörter und API-Schlüssel sind auch über die lokale KI-Integration (MCP) nicht lesbar.
- Für die normale Regeldurchsetzung werden keine Erweiterungs-, Konto- oder Gerätekennungen und keine Regelkonfiguration übertragen.

## Optionale lokale KI-Integration (MCP)

Die Erweiterung kann optional Anfragen eines lokalen **Vault-MCP-Servers** beantworten, der innerhalb der Vault-Desktop-Apps auf Ihrem eigenen Gerät läuft, sodass Sie Ihren eigenen KI-Assistenten (einen „MCP-Client“) verbinden und ihn Ihre Vault-Einrichtung für Sie lesen oder darauf handeln lassen können. Diese Integration ist **standardmäßig deaktiviert** und ändert nichts, solange Sie sie nicht bewusst einschalten.

- **Sie starten sie.** Nichts wird offengelegt, bis Sie die Integration aktivieren und einen MCP-Client verbinden, und jede Client-Verbindung wird von Ihnen freigegeben. Das Ausschalten widerruft den Zugriff sofort.
- **Der Server ist lokal.** Von der Erweiterung bereitgestellte Daten werden über dieselbe authentifizierte geräteinterne Brücke an einen Vault-MCP-Server auf Ihrem Mac übergeben – nicht an unsere Website oder einen Vault-Server. Die Erweiterung selbst sendet Ihre Daten an keinen Dritten.
- **Danach entscheidet Ihr Assistent.** Sobald ein verbundener MCP-Client auf Ihre Anforderung hin Daten erhält, richtet sich der weitere Umgang damit nach **diesem Client** und dessen eigenen Datenschutzbedingungen. Wenn der von Ihnen gewählte Assistent auf einen entfernten Dienst gestützt ist, kann dieser Assistent Ihre Daten auf Ihre Anweisung hin übertragen – genauso, wie wenn Sie Informationen in ein beliebiges KI-Tool einfügen. Wählen Sie einen Client, dem Sie vertrauen.
- **Was offengelegt werden kann.** Auf Ihre Anweisung hin kann ein verbundener Assistent Ihre Blockgruppen, Zeitpläne, benutzerdefinierten Regeln, das Aktivitätsprotokoll, die Nutzungszeitzähler, die URL des aktiven oder der geöffneten Tabs, sichtbare Seiteninhalte auf von Ihnen konfigurierten Websites sowie sämtliche Vault-Classifier-Nachweise und -Entscheidungen lesen. Zustandsändernde Aktionen (Gruppen bearbeiten, ein Schlummern starten, eine gespeicherte Regel ausführen, eine Klassifizierung auslösen) werden einzeln bestätigt.
- **Geheimnisse bleiben geheim.** Passwörter (etwa ein Passwort der Kindersicherung) und Anbieter-API-Schlüssel sind über diese Integration **nur schreibbar**: Sie können gesetzt, aber von keinem Assistenten wieder gelesen werden.
- **Nur Chromium.** Wie die Classifier-Brücke existiert diese Integration nur in Chromium-Browsern mit dem geräteinternen Host; Firefox und Safari legen sie nicht offen.

## Warum jede Berechtigung angefordert wird

| Berechtigung | Wofür sie verwendet wird |
| --- | --- |
| `storage` | Ihre Blockgruppen, Einstellungen und den Laufzeitzustand nur in Ihrem Browser speichern und laden. |
| `favicon` | In Chromium browsergecachte Website-Symbole neben den Regeln anzeigen. Dabei werden weder der Browserverlauf gesendet noch Anfragen an unseren Dienst gestellt. |
| `nativeMessaging` | Unter Chromium einen gerätelokalen Native-Messaging-Nachweis für die authentifizierte Vault-Classifier-Brücke anfordern; unter Safari Sandbox-Anfragen benutzerdefinierter Regeln an die gerätelokale Container-App weiterleiten. Es handelt sich nicht um einen Cloud-Transport. |
| `alarms` | Den Hintergrund-Service-Worker planmäßig aufwecken, um zeitbasierte Limits und den Regelstatus zu aktualisieren, wenn ein Schlummer-, Einfrier- oder Zeitplanfenster endet. |
| `offscreen` | Das JavaScript benutzerdefinierter Regeln in einem Sandbox-Offscreen-Dokument ausführen, damit es weder aus der Erweiterung ausbrechen noch Ihre Seiten direkt berühren kann. |
| `tabs` | Den Editor als vollständigen Tab öffnen, wenn Sie auf das Symbolleistensymbol klicken, die URL des aktiven Tabs zur Auswertung der Gruppenregeln abrufen und Tabs nach einer von Ihnen im Editor vorgenommenen Regeländerung neu laden. |
| `webNavigation` | SPA-URL-Änderungen (Push-State-Navigation) erkennen, damit plattformspezifische Feed-Ausblender und ereignisgesteuerte Regeln auf die Navigation innerhalb der Seite reagieren können, nicht nur auf vollständige Seitenladungen. |
| Host-Zugriff `<all_urls>` | Ihre Blockierregeln und plattformspezifischen Feed-Ausblender auf den von Ihnen gewählten Websites anwenden. Die Erweiterung liest/ändert Seiten nur auf URLs, für die Sie aktiv eine Regel konfiguriert haben, und nur zur Durchsetzung dieser Regel; der optionale Vault-Classifier-Adapter ist auf YouTube beschränkt. |

## Benutzerdefinierte Regeln

Wenn Sie benutzerdefinierte JavaScript-Regeln schreiben, gilt für diesen Code:

- Er läuft in einem Sandbox-Offscreen-Dokument; er kann weder das Netzwerk noch Ihre Seiten oder andere Erweiterungen direkt erreichen.
- Er kommuniziert mit Content-Skripten ausschließlich über eine feste Nachrichtenbrücke, die durch die Hilfs-API der Erweiterung definiert ist.
- Er wird automatisch unter Quarantäne gestellt (mit einem Protokolleintrag deaktiviert), wenn er die integrierten Grenzwerte für CPU, Protokoll, Post-Message oder DOM-Mutationen überschreitet.

Ihre benutzerdefinierten Regeln werden lokal zusammen mit Ihren übrigen Einstellungen gespeichert und niemals vom Gerät übertragen.

## Website-Statistiken

Dieser Abschnitt betrifft die **Website**. Die Website veröffentlicht ein kleines **Statistik**-Panel; um es zu befüllen, führt der Server einige aggregierte Zählwerte:

- **Downloadzahlen** – wie oft die Download-Schaltfläche jedes Produkts angeklickt wurde (macOS, Windows, Browsererweiterung, Safari).
- **Konten** – wie viele Konten existieren.
- **F&A-Aktivität** – die Gesamtzahl der Forenbeiträge und Kommentare.

Einmal pro Stunde erfasst der Server den aktuellen Wert jedes aggregierten Zählwerts. Diese Momentaufnahmen enthalten kein Ereignis pro Besucher, keinen Klickpfad und keinen Sitzungsverlauf.

- **Vollständig anonym / de-identifiziert.** Es handelt sich um einfache laufende Summen. Sie sind **nicht** mit Ihrem Namen, Konto, Ihrer E-Mail, IP-Adresse, Ihrem Gerät oder einer sonstigen Kennung verknüpft – es gibt keine Möglichkeit, eine Zählung einer Person zuzuordnen.
- **Niemals kommerziell.** Diese Daten existieren nur, um das öffentliche Statistik-Panel anzuzeigen. Sie werden **niemals verkauft, an Dritte weitergegeben, für Werbung oder für einen anderen kommerziellen Zweck verwendet.**

## Kinder

Die Erweiterung ist ein Allzweck-Produktivitätswerkzeug. Sie richtet sich nicht an Kinder, erfasst wissentlich von niemandem Daten und zeigt keine Werbung.

## Änderungen an dieser Richtlinie

Sollten sich die Datenpraktiken in einer künftigen Version ändern, wird diese Datei aktualisiert und die Änderung in den Versionshinweisen jener Veröffentlichung zusammengefasst.

## Kontakt

Fragen, Anliegen oder Fehlerberichte: Bitte öffnen Sie ein Issue im Quell-Repository der Erweiterung oder verwenden Sie die im Chrome Web Store-Eintrag angegebene Support-E-Mail.
