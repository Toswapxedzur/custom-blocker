# Benutzerhandbuch der Vault-Browsererweiterung

Vault steuert Websites und unterstützte Plattforminhalte im Browserprofil, in dem es installiert ist. Öffnen Sie den Editor über die Schaltfläche der Erweiterung in der Symbolleiste. Bei bestehender Verbindung stellt Mac Vault oder Windows Vault die lokale Tag-Zuweisung und Aktivität bereit; die Erweiterung setzt Browserziele durch.

## Blockierungsgruppen

Eine **Blockierungsgruppe** wendet eine Blockierungsrichtlinie an. Eine **Klassifizierungsgruppe** weist Inhalten Tags zu; sie blockiert selbst nichts.

1. Fügen Sie eine Blockierungsgruppe hinzu und geben Sie ihr einen Namen.
2. Wählen Sie unter **Gilt für** die Ziele aus.
3. Legen Sie fest, wann die Blockierung gilt, und stellen Sie gegebenenfalls einen Zeitplan oder ein Zeitkontingent ein.
4. Aktivieren Sie die Gruppe. Ihre Ziele verwenden die gemeinsame Richtlinie der Gruppe.

Gewöhnliche Änderungen werden automatisch gespeichert. Eine Fehlermeldung bedeutet, dass die Änderung nicht angenommen wurde; korrigieren Sie das Feld und versuchen Sie es erneut. Deaktivieren Sie eine Gruppe, um ihre Richtlinie auszusetzen und ihre Konfiguration zu behalten. **Gruppe löschen** entfernt sie. Ziehen Sie Gruppen, um ihre Reihenfolge zu ändern. Mehrere Gruppen können für dasselbe Ziel gelten; das Aufschieben einer Gruppe hebt die Blockierung einer anderen nicht auf.

**Exportieren** kopiert eine Gruppenkonfiguration. **Importieren** ersetzt nach Bestätigung die Konfiguration der ausgewählten Gruppe.

### Zeitkontingent und Zeitplan

**Sofort blockieren** gilt immer dann, wenn die aktivierte Gruppe zutrifft und ihr Zeitplan aktiv ist. **Nach Verbrauch des Zeitkontingents blockieren** erlaubt die betreffende Nutzung, bis das Kontingent aufgebraucht ist.

Stellen Sie das Kontingent in Minuten und das Rücksetzintervall in Stunden ein. Ein gleitendes Limit zählt die Nutzung im vorangegangenen Zeitfenster. Das Zurücksetzen um Mitternacht beginnt zur lokalen Mitternacht einen neuen Zeitraum, auch bei einem gleitenden Limit.

Wählen Sie aktive Wochentage und optional lokale Zeitfenster, eines pro Zeile, beispielsweise **09:00-12:00**. Eine leere Fensterliste gilt während der gesamten ausgewählten Tage. Ein Fenster muss am selben Tag später enden als beginnen; teilen Sie einen Zeitplan über Nacht auf getrennte Tage auf.

### Aufschieben

Konfigurieren Sie das Aufschieben für jede Blockierungsgruppe. **Blockierung pausieren** setzt die Richtlinie dieser Gruppe für die Pausendauer aus. **Zum Zeitkontingent hinzufügen** ergänzt nutzbare Minuten für eine zeitlich begrenzte Gruppe. Nur verbrauchtes Zusatzkontingent zählt als aufgeschobene Zeit. Ungenutztes Zusatzkontingent verfällt beim nächsten Zurücksetzen; bei einem gleitenden Limit nach einem Zeitfenster oder, falls aktiviert, bereits um Mitternacht.

**Aktivierungsverzögerung** verzögert das Aufschieben, während die Blockierung weiter gilt. **Wartezeit** ist die Zeit nach dem Ende des Aufschiebens bis zur nächsten Anfrage. **Erforderliche Bestätigungen** legt die Anzahl der Bestätigungsschritte fest. Für eine eingefrorene Gruppe ist Aufschieben nur verfügbar, wenn es vor dem Einfrieren erlaubt wurde.

### Einfrieren und PIN

**Einfrieren** verhindert gewöhnliche Änderungen. Zum Auftauen sind zehn Bestätigungen im Abstand von fünf Sekunden sowie eine gegebenenfalls konfigurierte Wartezeit und sechsstellige PIN erforderlich. **Wartezeit vor dem Auftauen** akzeptiert 0–72 Stunden; 0 fügt keine Wartezeit hinzu.

Im eingefrorenen Zustand kann die Wartezeit verlängert und eine PIN hinzugefügt werden, sofern noch keine vorhanden ist. Diese Bedingungen lassen sich erst nach dem Auftauen der Gruppe abschwächen. Auch das Löschen berücksichtigt die verbleibende Wartezeit und die PIN.

### Verknüpfte Gruppen

Verwenden Sie **Verknüpfen**, um ausdrücklich ausgewählte Gruppen in anderen Vault-Programmen zu verbinden. Verknüpfte Gruppen teilen ihren Namen, unterstützte Richtlinieneinstellungen, Ziele, Nutzung und Einfrierbedingungen. Jedes Programm bearbeitet und setzt die von ihm unterstützten Zieltypen durch; andere Zieleinträge bleiben für verknüpfte Programme verfügbar. Beim Aufheben der Verknüpfung bleiben jede Gruppe und ihre Einstellungen erhalten.

Ist ein verknüpftes Mitglied offline, kann die Bearbeitung nicht verfügbar sein. Öffnen Sie die Vault-Desktop-App und den verknüpften Browser, um die Verbindung wiederherzustellen. Eine lokal gespeicherte Richtlinie kann weiter gelten, während ein Mitglied offline ist.

## Hilfe erhalten

Klicken Sie auf das kleine **i** neben einem Feld, um dessen Erklärung anzuzeigen. Klicken Sie außerhalb der Erklärung oder drücken Sie Escape, um sie zu schließen. Listen bleiben in scrollbaren Bereichen; scrollen Sie innerhalb des Bereichs, um weitere Einträge zu erreichen. Die Suche filtert die sichtbare Liste, ohne Einträge zu löschen.

Benutzerdefinierte Regeln haben ein eigenes [Codehandbuch](../code-manual/de.md). Es erklärt den Editor, die Aktivierung, Protokolle, den Dateizugriff und die unterstützte API.

## Websites und Plattforminhalte

Fügen Sie Domains oder vollständige URLs hinzu, eine pro Eintrag. Eine Domain umfasst ihre Subdomains. Ein Pfad begrenzt die Übereinstimmung auf diesen Pfad und seine Unterpfade. **Alles außer diesen Websites blockieren** macht die Liste zu einer Freigabeliste.

Sie können dieselbe Website mehrfach hinzufügen. Jeder Eintrag hat eigene Filter und Seitensteuerungen; beispielsweise kann ein YouTube-Eintrag Shorts und ein anderer einen bestimmten Ersteller blockieren. Zutreffende Einträge werden innerhalb der Gruppe kombiniert und teilen ihren Zeitplan, ihr Kontingent und ihre Aufschiebeoptionen.

Ein Ziel kann eine passende Seite abdecken oder zunächst pausieren und nach einem Countdown Weiter anbieten. Ein blockierendes Ziel hat innerhalb derselben Gruppe Vorrang vor einem pausierenden Ziel. **Bei Blockierung: Weiterleitungsadresse oder Nachricht** akzeptiert eine Webadresse oder eine Abdeckungsnachricht; lassen Sie das Feld leer, um die Seite direkt abzudecken. Eine Pause leitet niemals weiter.

Plattformziele verwenden **Ersteller** für Videoplattformen, **Konten** für Twitter / X, **Communitys** für Reddit und Server-/Kanal-IDs für Discord. Die Steuerungen gelten dort, wo Vault Quelle und Inhaltstyp erkennen kann. Inhaltssteuerungen verbergen unterstützte Seitenelemente wie Anzeigen oder Videokarten. Browserberechtigungen und Websiteänderungen können diese Steuerungen beeinflussen.

### Filter für Inhaltstags

Die Verbindung zur Klassifizierung und die Tag-Korrektur sind in unterstützten Chromium-Browsern wie Chrome und Edge sowie in Safari Vault unter macOS verfügbar.

Verbinden Sie Mac Vault oder Windows Vault und konfigurieren Sie dessen Klassifizierung, um Tags zu erhalten. Der Tag-Filter einer Blockierungsgruppe bestimmt, was abgedeckt oder verborgen wird. Er startet oder pausiert die Tag-Zuweisung nicht; verwenden Sie dafür die Klassifizierungseinstellungen der Desktop-App oder die Pausensteuerung der jeweiligen Klassifizierungsgruppe.

Jeder Websiteeintrag hat einen **Anwenden auf**-Filter: alle Inhalte, ausgewählte Ersteller, alle außer ausgewählten Erstellern, ausgewählte Tags oder alle außer ausgewählten Tags. Fügen Sie einen weiteren Eintrag für dieselbe Website hinzu, wenn Sie einen anderen Filter benötigen.

Wählen Sie bestimmte Tags oder alles außer bestimmten Tags. Eine Regel kann Tags kombinieren (**Gaming + Drama**), eine Konfidenz verlangen (**Gaming @3**) oder eine Ausnahme festlegen (**!Tutorial**). **Inhalt abdecken** lässt die Tag-Korrektur verfügbar. **Inhalt verbergen** entfernt das zutreffende Element.

**Auch Inhalte ohne Tag mit ausreichender Konfidenz blockieren** umfasst abgeschlossene Ergebnisse ohne Tag beim standardmäßigen Konfidenzschwellenwert, einschließlich Ergebnissen mit geringer Konfidenz. Ausdrücklich aufgeführte Regeln werden zuerst geprüft. **Ohne Tag** bedeutet, dass die Tag-Zuweisung ohne Tags abgeschlossen wurde; **Tag-Zuweisung läuft** bedeutet, dass ein Ergebnis aussteht. Die separate Option für ausstehende Inhalte steuert die Abdeckung bis zum Abschluss der Tag-Zuweisung.

### Tags korrigieren

Klicken Sie neben den Tags eines Elements auf **+ Tag**, um die Korrekturauswahl zu öffnen. Durchsuchen Sie die vorhandenen Tags der Klassifizierung und wählen Sie einen Tag zum Hinzufügen. Klicken Sie auf die Entfernen-Steuerung eines ausgewählten Tags oder wählen Sie ihn aus und drücken Sie einmal Entf, um ihn zu entfernen. Korrekturen werden an die verbundene Desktop-App gesendet und bei künftigen Tag-Zuweisungen verwendet. Eine nicht verfügbare Abfrage zeigt **Ohne Tag** an und kann automatisch wiederholt werden; diese Anzeige erstellt keinen Tag in Ihrer Klassifizierung.

## Einstellungen und Verbindung

**Schnellhinzufügen + anzeigen** fügt unterstützten Seiten eine kleine Schaltfläche hinzu. Wählen Sie in der Liste eine Gruppe als Ziel; Ihre Auswahl bleibt beim erneuten Öffnen von Vault erhalten. Verwenden Sie die Seitenschaltfläche, um diese Seite zur Websiteliste hinzuzufügen. Bei einer Freigabeliste wird die Seite damit erlaubt. Eingefrorene Gruppen akzeptieren keine Schnellhinzufügungen.

Die Klassifizierungsverbindung meldet den lokalen Vault-Desktop-Dienst. Konfigurieren Sie Klassifizierungsgruppen, Modelldownloads, Wissen, Rechercheeinwilligung und API-Anbieter in der verbundenen Desktop-App.

Fehlen Tags, prüfen Sie, ob die Vault-Desktop-App geöffnet und verbunden ist, die Tag-Zuweisung aktiviert ist, die betreffende Klassifizierungsgruppe fortgesetzt wurde und ihr Plattformfeed aufgezeichnet wird. Prüfen Sie den Modelldownloadstatus in der Desktop-App. Greift die Blockierung nicht, prüfen Sie Aktivierung, Ziele, Zeitplan, Kontingent und Aufschiebestatus der Gruppe.
