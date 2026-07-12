# Datenschutzrichtlinie – Benutzerdefinierter Webblocker

_Letzte Aktualisierung: 30.06.2026_

Auf dieser Seite wird genau erklärt, welche Daten der **Custom Web Blocker**-Browser benötigt
Die Erweiterung erfasst, wohin sie geht und warum die jeweilige Browserberechtigung vorliegt
angefordert. Die Kurzfassung lautet: Nichts verlässt Ihren Browser.

## Zusammenfassung

- **Es werden keine Daten an einen Server gesendet.** Die Erweiterung macht kein Netzwerk mehr
  Anfragen an Dritte (oder an uns). Es gibt keine Analyse, nein
  Telemetrie, kein Crash-Reporter, keine Fernkonfiguration, keine Automatik
  Aktualisierungen, die über den Standardmechanismus des Chrome Web Store hinausgehen.
- **Alle Daten bleiben in Ihrem Browser** und werden über die lokale Version von Chrome gespeichert
  Erweiterungsspeicher (`chrome.storage.local`). Es wird nie synchronisiert, es sei denn
  Chrome selbst synchronisiert Ihr lokales Profil.
- **Es werden keine personenbezogenen Daten erfasst**
  Verlängerung jederzeit möglich.
- **Keine Nachverfolgung** der Browsing-Aktivitäten, die über das unbedingt Notwendige hinausgehen
  um die von Ihnen selbst konfigurierten Sperrregeln anzuwenden.

## Was lokal gespeichert wird

Die Erweiterung speichert Folgendes in der lokalen Erweiterung Ihres Browsers
Speicher, damit er seine Arbeit sitzungsübergreifend erledigen kann:

- Die von Ihnen erstellten Blockgruppen: ihre Namen, Regeltypen, Listen von
  blockierte Websites, Zeitpläne, Schlummereinstellungen, Einfrierstatus usw
  benutzerdefiniertes JavaScript, das Sie schreiben.
– Laufzeitstatus pro Gruppe, der zur Durchsetzung von Grenzwerten erforderlich ist (z. B. wie viele).
  Minuten eines verspäteten Zuschussbudgets verbleiben heute, wenn ein Nickerchen gemacht wird
  endet, wenn eine strikte Sperrfrist endet).
- Ihre eigenen Präferenzen werden in den **Einstellungen** festgelegt (Tickrate, automatische Speicherung).
  Entprellen, Standard-Schlummerdauer, Standard-Fallback-URL, Debug-Modus
  umschalten, ausgewählte UI-Sprache).
- Aktivitätsprotokolleinträge werden im In-App-Bereich **Protokoll** angezeigt, was Sie tun können
  klar aus der Benutzeroberfläche.

Diese Daten werden nur von den eigenen Skripten der Erweiterung gelesen und geschrieben
auf Ihrem Gerät und nur innerhalb Ihres eigenen Browserprofils.

## Was NICHT erfasst oder übermittelt wird

- Der Browserverlauf wird nicht aufgezeichnet, zusammengefasst oder übermittelt.
- Der Seiteninhalt wird nicht exfiltriert, per Screenshot erstellt oder protokolliert.
- Formulareingaben, Passwörter und persönliche Informationen werden niemals gelesen.
- Es werden keine Informationen über Sie, Ihr Gerät oder Ihre Nutzung an die gesendet
  Erweiterungsautor oder ein Dritter.

## Warum jede Berechtigung angefordert wird

| Erlaubnis | Wofür wird es verwendet |
| --- | --- |
| `storage` | Speichern und laden Sie Ihre Blockgruppen, Einstellungen und den Laufzeitstatus nur in Ihrem Browser. |
| `declarativeNetRequest` | Teilen Sie Chrome anhand der von Ihnen konfigurierten Regeln mit, welche URLs nativ blockiert werden sollen. Die Blockierung erfolgt durch den Browser; Die Erweiterung registriert und aktualisiert nur die Regelliste. |
| `alarms` | Wecken Sie den Hintergrunddienstmitarbeiter nach Zeitplan, um zeitbasierte Grenzwerte zu aktualisieren und den Regelstatus zu aktualisieren, wenn ein Snooze-, Freeze- oder Zeitplanfenster endet. |
| `offscreen` | Führen Sie Sandbox-JavaScript mit benutzerdefinierten Regeln in einem Offscreen-Dokument aus, damit es der Erweiterung nicht entgehen oder Ihre Seiten nicht direkt berühren kann. |
| `tabs` | Öffnen Sie den Editor als vollständige Registerkarte, indem Sie auf das Symbolleistensymbol klicken, suchen Sie nach der URL der aktiven Registerkarte, um Gruppenregeln auszuwerten, und laden Sie Registerkarten nach einer Regeländerung, die Sie im Editor vorgenommen haben, neu. |
| `webNavigation` | Erkennen Sie SPA-URL-Änderungen (Push-State-Navigation), damit plattformspezifische Feed-Hider und ereignisgesteuerte Regeln auf die In-Page-Navigation und nicht nur auf das Laden ganzer Seiten reagieren können. |
| `<all_urls>` Hostzugriff | Wenden Sie Ihre Blockierungsregeln und plattformspezifischen Feed-Hider auf alle Websites an, die Sie blockieren möchten. Die Erweiterung liest/ändert Seiten nur auf URLs, für die Sie aktiv eine Regel konfiguriert haben, und nur, um diese Regel durchzusetzen. |

## Benutzerdefinierte Regeln

Wenn Sie benutzerdefinierte JavaScript-Regeln schreiben, ist dieser Code:

– Läuft in einem Sandbox-Offscreen-Dokument; es kann das nicht direkt erreichen
  Netzwerk, Ihre Seiten oder andere Erweiterungen.
– Kommuniziert mit Inhaltsskripten nur über eine feste Nachrichtenbrücke
  definiert durch die Hilfs-API der Erweiterung.
- Wird automatisch unter Quarantäne gestellt (mit einem Protokolleintrag deaktiviert), wenn dies der Fall ist
  überschreitet die integrierten CPU-, Protokoll-, Post-Message- oder DOM-Mutations-Obergrenzen.

Ihre benutzerdefinierten Regeln werden lokal zusammen mit den übrigen Einstellungen gespeichert
und werden niemals außerhalb des Geräts übertragen.

## Statistiken zu Websites und Ersteller-Tag-Diensten

In diesem Abschnitt geht es um die **Website und den optionalen Creator-Tag-Dienst**,
die von der Erweiterung selbst getrennt sind. Die Erweiterung sendet weiterhin
nichts, wie oben beschrieben. Die Website veröffentlicht eine kleine **Statistik**
Panel, und um es zu füllen, speichert der Server einige aggregierte Zählungen:

- **Download-Anzahl** – wie oft der Download-Button jedes Produkts war
  angeklickt (macOS, Windows, Browsererweiterung, Safari).
- **Klassifizierte YouTuber** – wie viele YouTube-Ersteller getaggt wurden.
- **Konten** – wie viele Konten existieren.
- **Q&A-Aktivität** – die Gesamtzahl der Forumbeiträge und Kommentare.

Einmal pro Stunde zeichnet der Server den aktuellen Wert jeder dieser Zählungen auf und
nichts anderes. Es gibt keine Aufzeichnungen pro Ereignis, keine Clickstreams und keine Sitzung
Geschichte.

- **Vollständig anonym/de-identifiziert.** Dies sind einfache laufende Summen. Sie
  sind **nicht** mit Ihrem Namen, Ihrem Konto, Ihrer E-Mail-Adresse, Ihrer IP-Adresse, Ihrem Gerät oder Ähnlichem verknüpft
  andere Kennung – es gibt keine Möglichkeit, eine Zählung einer Person zuzuordnen.
- **Niemals kommerziell.** Diese Daten dienen nur zur Darstellung öffentlicher Statistiken
  Panel. Es wird niemals verkauft, an Dritte weitergegeben, für Werbung verwendet,
  oder für andere kommerzielle Zwecke verwendet werden.**
- **Optionale Kanal-ID-Beiträge.** Wenn – und nur wenn – Sie sich dafür entscheiden, wird die
  Erweiterung/Website darf YouTube-**Kanal-IDs** teilen (niemals Videotitel,
  B. den Uhrenverlauf oder etwas Persönliches), um die Klassifizierung der Urheber für alle zu erleichtern.

## Kinder

Die Erweiterung ist ein universelles Produktivitätstool. Das ist es nicht
richtet sich an Kinder, sammelt nicht wissentlich Daten von irgendjemandem und
Zeigt keine Werbung an.

## Änderungen an dieser Richtlinie

Sollten sich die Datenpraktiken in einer zukünftigen Version jemals ändern, wird dies auch in dieser Datei der Fall sein
aktualisiert werden und die Änderung wird in den Versionshinweisen für zusammengefasst
diese Veröffentlichung.

## Kontakt

Fragen, Bedenken oder Fehlerberichte: Bitte öffnen Sie ein Problem auf der
Quell-Repository der Erweiterung oder verwenden Sie die auf der aufgeführte Support-E-Mail-Adresse
Eintrag im Chrome Web Store.
