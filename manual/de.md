# Benutzerdefinierter Webblocker – Bedienungsanleitung

Dies ist das vollständige Referenzhandbuch für die Erweiterung. Es beginnt mit den einfachsten und gängigsten Arbeitsabläufen und geht dann schrittweise zu fortgeschrittenen Themen wie benutzerdefinierten ereignisgesteuerten Blockierungsregeln und der Hilfs-API über.

Wenn Sie ganz neu sind, lesen Sie einfach **Schnellstart** und **Übersicht über Blockgruppen**. Alles unter diesen Abschnitten ist optional, je nachdem, was Sie tun möchten.

---

## 1. Was diese Erweiterung bewirkt

Mit dem benutzerdefinierten Web-Blocker können Sie Websites und Online-Ablenkungen nach selbst definierten Regeln blockieren. Sie können:

- Blockieren Sie Websites sofort mit der nativen Netzwerkblockierung des Browsers (dieselbe Art von Blockierung, die `ERR_BLOCKED_BY_CLIENT` erzeugt).
- Gönnen Sie sich eine bestimmte Anzahl von Minuten pro Tag auf einer Website und blockieren Sie diese dann, sobald Sie dieses Limit überschreiten.
- Blockieren Sie bestimmte Arten von Inhalten auf Jutjub, Kurzvideoportal, Gesichtsbuch, Bildernetz, Live-Portal und Gemeinschaftsforum (nicht die gesamte Website).
- Verstecken Sie blockierte Inhalte aus Feeds auf unterstützten Plattformen, anstatt nur einzelne Seiten zu blockieren.
- Planen Sie, wann eine Regel nach Wochentag und `HHMM-HHMM` Zeitfenstern aktiv ist.
- Frieren Sie eine Regel ein, damit Sie sie nicht einfach ändern können. Strict Freeze sperrt es für eine bestimmte Anzahl von Stunden und erfordert zum Rückgängigmachen ein 20-stufiges Bestätigungsritual.
- Eine Regel vorübergehend deaktivieren, jedoch erst, nachdem eine ausreichend lange Begründung verfasst wurde.
- Schreiben Sie **ereignisgesteuerte** benutzerdefinierte Regeln in Skriptsprache mit Hilfsprogrammen für Vorwärts-/Rückwärts-Timer, persistenten Speicher pro Gruppe, plattformspezifische DOM-Absichten (Navigationsschaltflächen ausblenden, Feedkarten nach Prädikat ausblenden, Timer pro Unterabschnitt festlegen), URL-Dienstprogramme und strukturierte Protokollierung.
- Wählen Sie aus einer integrierten Bibliothek mit über 50 vorgefertigten Vorlagen (Timer, Zeitpläne, Feed-Ausblenden, Fokussitzungen, Weiterleitungen, Nudges, Persistenz, DOM-Optimierungen, Debug-Helfer).
- Verwenden Sie die Erweiterung in über 20 Sprachen.

Die Erweiterung ist eine Chrom-Browser Manifest V3-Erweiterung mit einer Editorseite (dem Popup), einem Hintergrunddienstmitarbeiter, einer Offscreen-Sandbox, die benutzerdefinierten Regelcode hostet, und einem Inhaltsskript, das auf jeder Seite ausgeführt wird. Benutzerdefinierte Regeln leben in der Offscreen-Sandbox; Sie werden einmal pro Ausführen-Klick geladen und bleiben registriert, bis die Regel deaktiviert oder gelöscht wird.

---

## 2. UI-Tour

Wenn Sie auf das Symbol der Erweiterung klicken, wird der Editor als vollständige Webseite geöffnet (kein kleines Popup). Die Seite hat folgende Bereiche:

- **Obere Leiste**
  - Schaltfläche **Bedienungsanleitung** (dieses Dokument)
  - **Sprachauswahl**
  - **Einstellungen**-Zahnrad (erweiterte Umschaltmöglichkeiten, einschließlich **Debug-Modus**)
- **Linker Bereich – Blockgruppen**
  - Liste Ihrer Blockgruppen. Jede Karte zeigt den Gruppennamen, eine kurze Zusammenfassungszeile und ein Kontrollkästchen zum Aktivieren/Deaktivieren.
  - Die Schaltfläche **Hinzufügen** erstellt eine neue Gruppe. Das Dropdown-Menü daneben wählt den Typ aus.
  - **Alle löschen** entfernt jede Gruppe, mit zusätzlichen Bestätigungen, wenn eine Gruppe eingefroren ist.
  – Sie können den `::`-Griff auf einer Karte nach oben oder unten ziehen, um Gruppen neu anzuordnen.
  - Sie können den vertikalen Teiler ziehen, um die Größe dieses Bereichs zu ändern.
- **Rechter Bereich – Editor**
  - Bearbeitet die aktuell ausgewählte Gruppe: Name, Blockierungsverhalten, Blocklisten, typspezifische Filter, Zeitplan, Einfrieren, Schlummern.
  - Alle Änderungen werden automatisch einen Bruchteil einer Sekunde gespeichert, nachdem Sie mit der Eingabe oder Interaktion aufhören.
  – Für **benutzerdefinierte** Gruppen zeigt der Editor auch den **Vorlagen**-Browser, die Schaltfläche **Ausführen** und das Bedienfeld **Protokoll** (in Version 1.1 von *Aktivitätsprotokoll* umbenannt) an.
- **Toast** (zentriertes Popup, das ausgeblendet wird) – zeigt Statusmeldungen wie „Gespeicherte Änderungen“ an. oder Eingabefehler.
- **In-Page-Overlay** – Während ein Tab über einen aktiven Timer oder Block verfügt, wird in der oberen linken Ecke ein Overlay angezeigt, das alle ihn betreffenden Einschränkungen im Format `hh:mm:ss` (oder `mm:ss`) anzeigt. Mehrere Einschränkungen werden in mehreren Zeilen gestapelt. Standardmäßige Blockgruppen-Countdowns und benutzerdefinierte Regel-Timer teilen sich dieses Overlay.

---

## 3. Schnellstart1. Klicken Sie auf das Erweiterungssymbol. Der Editor wird als ganze Seite geöffnet.
2. Wählen Sie im Bereich **Blockgruppen** einen Gruppentyp aus der Dropdown-Liste aus:
   - `Default`, `Jutjub`, `Kurzvideoportal`, `Gesichtsbuch`, `Bildernetz`, `Live-Portal`, `Gemeinschaftsforum` oder `Custom`.
3. Klicken Sie auf **Hinzufügen**. Eine neue Gruppe erscheint und der Editor öffnet sie.
4. Geben Sie ihm einen Namen.
5. Füllen Sie die typspezifischen Felder aus (für `Default` bedeutet das die Liste **Blockierte Websites**).
6. Stellen Sie sicher, dass das Kontrollkästchen der Gruppe im linken Bereich aktiviert ist.
7. Besuchen Sie eine der aufgeführten Websites. Die Sperre soll sofort wirksam werden.

Das ist der ganze glückliche Weg. Der Rest dieses Handbuchs enthält darüber hinaus nur Optionen.

> Wenn Sie für eine benutzerdefinierte Gruppe auf **Ausführen** klicken, wird die neue Regel an **zukünftige** Seitenereignisse angehängt. Für bereits geöffnete Tabs gilt weiterhin die vorherige Regel, bis Sie sie neu laden. Das Popup zeigt nach jedem erfolgreichen Lauf eine entsprechende Erinnerung an.

---

## 4. Übersicht über Blockgruppen

Alles in dieser Erweiterung ist als **Blockgruppen** organisiert. Eine Blockgruppe ist ein Regelsatz:

- Es hat einen Namen, einen Typ und einen aktivierten/deaktivierten Status.
- Es verfügt über ein Blockierungsverhalten (sofort, nach einigen Minuten oder fester Countdown).
- Es verfügt über einen optionalen Zeitplan (Tage + Zeitfenster) und optionale Einfrier-/Schlummerfunktionen.
– Je nach Typ verfügt es über zusätzliche Felder wie eine Liste von Websites, Jutjub-Erstellerfilter, Subreddit-Namen oder eine ereignisgesteuerte Skriptsprache-Regel.

Sie können beliebig viele Gruppen haben. Für dieselbe Seite können sich mehrere Gruppen bewerben. in diesem Fall gewinnt die **strengste** Regel:

- „Sofort sperren“ ist besser als „nach einiger Zeit sperren“.
- Eine Gruppe mit weniger verbleibender Zeit schlägt eine Gruppe mit mehr verbleibender Zeit.

Das Hinzufügen weiterer Gruppen kann also nur dazu führen, dass die Seite früher und nicht später blockiert wird.

**Die Auswertungsreihenfolge erfolgt von unten nach oben.** Wenn die Erweiterung Ihre Blockgruppen iteriert, beginnt sie mit der Gruppe am Ende der Liste und arbeitet sich nach oben vor. Die Gruppe oben in der Liste wird zuletzt ausgewertet und erhält das „letzte Wort“ – wenn beispielsweise eine untere Gruppe `helpers.getPlatformHelper().youtube().hideShortButton()` und eine obere Gruppe `showShortButton()` aufruft, bleibt die Schaltfläche sichtbar. Ziehen Sie den `::`-Griff auf einer Karte, um diese Reihenfolge zu ändern.

---

## 5. Gruppentypen

### 5.1 `Default` – normale Websites blockieren

Zum Blockieren bestimmter Domänen (der typische Anwendungsfall).

- **Blockierte Websites**: eine Website pro Zeile. Sowohl `facebook.com` als auch `https://www.facebook.com/somepage` funktionieren; Die Erweiterung extrahiert und normalisiert den Hostnamen.
– Eine Site-Regel gilt für diesen Hostnamen und alle seine Subdomains.
– Dieser Gruppentyp verwendet die native Netzwerkblockierung von Chrom-Browser, ähnlich wie `ERR_BLOCKED_BY_CLIENT`. Das bedeutet, dass die Navigation zu einer blockierten URL gestoppt wird, bevor die Seite überhaupt geladen wird.

### 5.2 `Jutjub` – Jutjub und ähnliche Videoseiten blockieren

Fügt dem Editor einen Abschnitt **Filter** hinzu:

- **Inhaltstyp**:
  - `Apply to all Jutjub pages` – jede Jutjub-Seite zählt.
  - `Apply to Shorts` – es zählen nur Shorts-Seiten.
  - `Apply to long videos` – nur `/watch`, `/live/`, `/embed/` usw.
  - `Apply to Jutjub posts` – Community-Beiträge (`/post/...`, Registerkarten „Kanal-Community/Beiträge“).
- **Autorenfilter**:
  - `Do not filter by author` – Die Identität des Autors spielt keine Rolle.
  - `Apply to certain authors` – nur aufgeführte Autoren lösen diese Gruppe aus.
  - `Apply to all except certain authors` – aufgeführte Autoren sind ausgenommen.
- **Autoren**: ein Autor pro Zeile. Akzeptiert `@handle`, vollständige URLs, `/channel/UC...`, `/c/...`, `/user/...`.
- **Blockierte Einträge im Jutjub-Feed ausblenden**: Während diese Gruppe aktiv blockiert, werden passende Karten in Jutjub-Feeds ausgeblendet. Wenn der Block inaktiv wird, werden sie bei der nächsten Aktualisierung wieder angezeigt.

Wenn für die Inhaltstypen „Shorts“ und „Beiträge“ kein Autorenfilter festgelegt ist und die Gruppe derzeit blockiert, blendet die Erweiterung auch relevante Navigationseinträge (Eintrag in der Seitenleiste „Shorts“, Kanalregisterkarten „Community/Beiträge“) und die entsprechenden Regale wie „Neueste Jutjub-Beiträge“ aus.

Die Kurz-gegen-Lang-Erkennung erstreckt sich auf andere Videoseiten wie Kurzvideoportal, Vimeo, Live-Portal-Clips/VODs und Dailymotion, wenn deren Seitenform erkannt werden kann.

### 5.3 `Kurzvideoportal` – Kurzvideoportal-Inhalte blockieren

Dieselbe Editor-Karte wie der Plattform-Video-Editor, jedoch mit Kurzvideoportal-spezifischen Beschriftungen:- Inhaltstypen: Kurzvideos, Videos, Profilseiten.
- Autoren: Kurzvideoportal-Handles (`@handle`) oder Profil-URLs.
- Beim Ausblenden von Feeds werden passende Karten auf Kurzvideoportal-Seiten ausgeblendet, während die Gruppe aktiv ist.

### 5.4 `Gesichtsbuch` – Gesichtsbuch-Inhalte blockieren

- Inhaltstypen: Reels, Videos, Beiträge.
- Autoren: Seitenname (`page.name`), Profil-URL oder `profile.php?id=...`-Formular (die numerische ID bleibt als `id:<number>` erhalten).
- Beim Ausblenden von Feeds werden passende Feedkarten auf Gesichtsbuch ausgeblendet.

### 5.5 `Bildernetz` – Bildernetz-Inhalte blockieren

- Inhaltstypen: Reels, Videos, Beiträge.
- Autoren: Bildernetz-Handles oder Profil-URLs.
- Reservierte Pfade wie `/reel/`, `/p/`, `/tv/`, `/explore/` werden nicht als Autoren behandelt.
- Beim Ausblenden von Feeds werden passende Karten auf Bildernetz ausgeblendet.

### 5.6 `Live-Portal` – Live-Portal-Inhalte blockieren

- Inhaltstypen: Clips, Streams/VODs, Kanalseiten.
- Autoren: Kanalnamen oder Kanal-URLs.
- Reservierte Pfade wie `/directory`, `/videos`, `/settings` usw. werden nicht als Kanalnamen behandelt.
- Durch das Ausblenden von Feeds werden passende Karten auf Live-Portal ausgeblendet.

### 5.7 `Gemeinschaftsforum` – Gemeinschaftsforum oder bestimmte Subreddits blockieren

- **Subreddits**: ein Subreddit pro Zeile. Eine leere Liste bedeutet, dass die Gruppe für ganz Gemeinschaftsforum gilt. Es werden sowohl `productivity` als auch `r/productivity` akzeptiert.

### 5.8 `Custom` – Blockierung durch ereignisgesteuertes Skriptsprache

Sie schreiben eine Skriptsprache-Funktion, die Handler für Ereignisse wie Seitenöffnung, URL-Änderung, Seiten-Heartbeat, Timer-Ende und Ihre eigenen benutzerdefinierten Ereignisse registriert. Die Funktion wird einmal pro Ausführen-Klick ausgeführt; Die registrierten Handler bleiben in allen Navigationen aktiv, bis Sie erneut auf „Ausführen“ klicken, die Gruppe deaktivieren oder löschen.

`Custom`-Gruppen zeigen nicht: Blockierungsverhalten, blockierte Websites, zulässige Minuten, Rücksetzintervall, geplante Tage oder Zeitfenster. Sie behalten den Editor für **Blockierungsregeln** sowie die standardmäßigen Freeze/Snooze-Steuerelemente bei. Es gibt auch eine Schaltfläche **Vorlagen**, die einen voreingestellten Browser mit parametrisierten Startregeln öffnet; Das Anwenden einer Voreinstellung ersetzt nach Bestätigung die aktuelle Regel.

Die vollständige Referenz zu benutzerdefinierten Regeln und die Hilfs-API finden Sie in **Abschnitt 11**.

---

## 6. Blockierendes Verhalten

Für die meisten Gruppentypen wählen Sie einen von drei Modi.

### 6.1 Sofort sperren

Die Regel ist immer dann aktiv, wenn die Gruppe aktiv ist, der Zeitplan dies zulässt und (bei Plattformgruppen) die Seite übereinstimmt.

Für `Default`-Gruppen wird die native Blockierung von Chrom-Browser verwendet. Für Plattformgruppen wird die In-Page-Overlay-/Exit-Logik verwendet.

### 6.2 Sperre nach einigen Minuten

Hierbei handelt es sich um ein Nutzungsbudget.

- **Erlaubte Minuten vor Block** (dezimal): Wie viele Minuten gönnen Sie sich pro Periode. Beispiel: `15`, `0.5`, `90`.
- **Timer-Reset-Intervall (Stunden)** (dezimal): wie oft das Budget zurückgesetzt wird. Beispiel: `24` für täglich, `1` für stündlich, `0.25` für alle 15 Minuten.

Solange Sie noch Zeit haben, funktioniert die Seite normal und zeigt das Timer-Overlay an. Wenn das Budget Null erreicht, wird die Seite für den Rest des Zeitraums gesperrt und im Overlay wird `0:00` angezeigt. Anschließend wird versucht, die Registerkarte zu schließen.

Die Verlängerung gilt pro Gruppe und Zeitraum:

- Jede Gruppe hat ihr eigenes Budget.
- Die Zeit, die Sie auf einer Seite verbringen, die mit der Gruppe übereinstimmt, wird auf das Budget dieser Gruppe angerechnet.
- Mehrere Tabs in derselben Gruppe teilen sich das Budget. Ihre Timer bleiben synchronisiert; Wenn Sie zu einer anderen Registerkarte wechseln, wird auch eine Aktualisierung erzwungen, sodass die aktuelle gemeinsame Zeit sofort angezeigt wird.

Wenn sich mehrere zeitlich begrenzte Gruppen auf dieselbe Seite bewerben, gewinnt die strengste.

### 6.3 Timer (herunterzählen, dann blockieren)

Dieser Modus zeigt einen Countdown-Timer an und blockiert, sobald er `0:00` erreicht.

- **Timer-Reset-Intervall (Stunden)** (dezimal): sowohl die Timer-Länge als auch die Reset-Häufigkeit. Beispiel: `24` für täglich, `1` für stündlich, `0.25` für alle 15 Minuten.

Im Gegensatz zur **Blockierung nach einer bestimmten Anzahl von Minuten** verfügt dieser Modus **nicht** über ein separates Feld „Erlaubte Minuten vor der Blockierung“. Der Timer startet einfach im Reset-Intervall, zählt herunter, während passende Seiten geöffnet sind, und blockiert dann bis zum nächsten Reset.Countdowns für Standardgruppen und Timer für benutzerdefinierte Gruppen (siehe **Abschnitt 11.3.1**) laufen beide **nur weiter, solange die Registerkarte sichtbar ist**. Durch das Wechseln der Registerkarten, das Minimieren des Fensters oder das Sperren des Bildschirms wird der Countdown automatisch angehalten.

---

## 7. Zeitplan

In der Karte **Zeitplan** können Sie einschränken, wann eine Gruppe aktiv ist:

- **Zu blockierende Tage**: Wählen Sie die Tage aus, an denen die Gruppe gelten soll. Nicht markierte Tage bedeuten, dass die Gruppe an diesem Tag inaktiv ist.
- **Zeitfenster**: Freiformliste, ein Fenster pro Zeile im `HHMM-HHMM`-Format, zum Beispiel:

  ```
  0900-1000
  1200-1300
  ```

  Die Gruppe ist nur innerhalb dieser Fenster aktiv. Eine leere Liste bedeutet den ganzen Tag.

Dies gilt für alle Gruppentypen außer `Custom`. (Benutzerdefinierte Regeln können ihren eigenen Zeitplan mithilfe von `ev.time.dayName` / `ev.time.hour` implementieren; siehe **Abschnitt 11.4**.)

---

## 8. Einfrieren (Anti-Manipulation)

Durch das Einfrieren ist es schwierig, eine Gruppe spontan außer Gefecht zu setzen.

In der **Freeze**-Karte wählen Sie:

- **Eingefroren** – Sie können die Gruppe nicht bearbeiten oder löschen und Sie können die Aktivierungsschaltfläche nicht deaktivieren. Um etwas zu ändern, müssen Sie das Auftauritual durchführen (siehe unten).
- **Streng eingefroren** – das Gleiche wie „Eingefroren“, aber es bleibt für eine von Ihnen gewählte Anzahl von Stunden gesperrt (dezimal, bis zu 72). Bis dieser Timer abläuft, ist nicht einmal das Auftauritual verfügbar.

Wenn eine eingefrorene Gruppe entsperrt werden kann, wird die Schaltfläche **Freigeben** angezeigt. Wenn Sie darauf klicken, wird das **20-Schritte-Ritual** gestartet:

– Das Modal zeigt eine Selbstdisziplin-Botschaft.
- Sie müssen 20 Mal auf `Confirm` klicken.
- Zwischen den Klicks muss eine Wartezeit von 5 Sekunden eingehalten werden.
- Wenn Sie zu irgendeinem Zeitpunkt abbrechen, müssen Sie bei Schritt 1 neu beginnen.
- Die 20 Nachrichten werden rotiert, sodass Sie sie tatsächlich lesen können.

Wenn die Gruppe auch mit „Keine Schlummerfunktion“ gekennzeichnet ist (siehe nächster Abschnitt), können Sie sie im eingefrorenen Zustand auch nicht in den Schlummermodus versetzen.

Der Freeze-Status wird in der Metazeile der Gruppenkarte angezeigt, einschließlich der verbleibenden Zeit für das strikte Freeze.

---

## 9. Schlummern (vorübergehend deaktivieren)

Snooze deaktiviert eine Gruppe vorübergehend, ohne sie freizugeben. Es unterstützt die verzögerte Aktivierung, die Abklingzeit nach dem Schlummern, Bestätigungsschritte und eine laufende Gesamtsumme der Schlummerzeit.

In der **Snooze**-Karte:

- **Schlummerfunktion für diese Gruppe zulassen** – wenn diese Option deaktiviert ist, kann diese Gruppe überhaupt nicht in den Schlummermodus versetzt werden (auch nicht im eingefrorenen Zustand).
- **Schlummerfunktion für (Minuten)** – dezimal, wie lange die Schlummerfunktion dauert.
- **Aktivierungsverzögerung (Minuten)** – dezimal `>= 0`. Nachdem Sie die Schlummerfunktion bestätigt haben, blockiert die Gruppe so lange, bis diese Verzögerung abgelaufen ist. Erst dann wird die Schlummerfunktion aktiv.
- **Abklingzeit nach Schlummerfunktion (Minuten)** – dezimal von `0` bis `5`. Nachdem die Schlummerfunktion beendet ist, können Sie für diese Gruppe keine weitere Schlummerfunktion starten, bis die Abklingzeit abgelaufen ist.
- **Bestätigungszeiten** – ganze Zahl `>= 0`. Wenn dies `0` ist, wird die Schlummerfunktion sofort geplant. Andernfalls startet das Starten der Schlummerfunktion ein Bestätigungsritual mit genau so vielen Schritten.

Bei jedem Snooze-Bestätigungsschritt muss eine erzwungene Wartezeit von **5 Sekunden** eingehalten werden, bevor der nächste Klick zulässig ist. Das Modal teilt Ihnen dies explizit mit und zeigt den Live-Countdown auf der Schaltfläche an.

Wenn die Gruppe eingefroren ist, bleiben die Schlummereinstellungen auf den vor dem Einfrieren gewählten Werten gesperrt. Sie können es immer noch in den Schlummermodus versetzen, solange das Schlummern erlaubt ist, Sie müssen jedoch die gespeicherten Verzögerungs-/Abklingzeit-/Bestätigungseinstellungen verwenden.

Auf der Schlummerkarte wird auch die **Gesamtschlummerzeit** für diese Gruppe angezeigt. Diese Summe zählt die gesamte aktive Schlummerdauer, auch wenn die Site während dieses Fensters aus einem anderen Grund erreichbar ist.

Wenn eine Schlummerfunktion beendet ist, wird die Regel sofort wiederhergestellt. Wenn die Gruppe nicht bereits eingefroren war, friert die Erweiterung sie am Ende der Schlummerfunktion automatisch wieder ein.

Eine Statusmeldung bestätigt die Schlummerfunktion. Wenn die Schlummerfunktion endet, kehrt die Gruppe automatisch zum Normalzustand zurück.

Sie können eine Schlummerfunktion auch vorzeitig mit der Schaltfläche **Schlummer beenden** beenden.

Bei benutzerdefinierten Gruppen löst das Drücken von **Start Snooze** auch ein `snoozePress`-Ereignis in der Regel aus (siehe Ereignistabelle in **Abschnitt 11**), sodass eine benutzerdefinierte Regel das Drücken aufzeichnen, eine Begründung protokollieren oder Folgeereignisse auslösen kann. Die Regel verfügt über **keine programmatische Snooze-API** – sie kann auf den Druck reagieren, ihn jedoch nicht abbrechen oder verlängern.

---

## 10. Massenaktionen- **Alle löschen** entfernt jede Gruppe.
  - Es wird immer nach einer Bestätigung gefragt.
  - Wenn mindestens eine Gruppe eingefroren ist, ist das gleiche 20-Schritte-Ritual erforderlich wie beim Auftauen.
  – Wenn eine Gruppe streng eingefroren und noch gesperrt ist, ist **Alle löschen** deaktiviert.

---

## 11. Benutzerdefinierte Gruppen – ereignisgesteuerte Referenz (v1.1+)

Ab Version 1.1 sind benutzerdefinierte Regeln **ereignisgesteuert**. Ihre Regel ist keine Pro-Heartbeat-Funktion mehr, deren Rückgabewert die Seite blockiert. Stattdessen ist der Regelkörper ein Skript, das Handler für bestimmte Ereignisse registriert (Seitenöffnung, URL-Änderung, Seiten-Heartbeat, benutzerdefinierte Ereignisse usw.). Die Handler bleiben über Seitennavigation und Tab-Wechsel hinweg registriert und leben in einer langlebigen **Offscreen-Sandbox**.

Der Regelkörper wird **einmal pro Ausführen-Klick** ausgeführt (oder einmal, wenn die Gruppe aktiviert ist und bereits eine aktive Quelle vorhanden ist). Um Handler neu zu laden, klicken Sie im Editor auf **Ausführen**. Das Popup zeigt eine Erinnerung an, in der Sie aufgefordert werden, jede bereits geöffnete Seite neu zu laden, damit die neue Regel auch dort gilt.

### 11.1 Regelsignatur

```js
(event, helpers) => {
  // Register handlers here. This function is called exactly once
  // per Run click (or when the group is enabled).
}
```

Zwei Argumente:

- `event` – die **Ereignisregistrierung** für diese Gruppe. Verwenden Sie es zum Registrieren, Überschreiben, Auflisten, Zählen oder Aufheben der Registrierung von Handlern sowie für benutzerdefinierte `post(...)`-Ereignisse.
- `helpers` – das Hilfspaket (siehe **11.3**).

Von der Funktion wird **nicht** erwartet, dass sie einen Wert zurückgibt. Die Entscheidung zum Blockieren oder Zulassen wird später getroffen, wenn ein Ereignis ausgelöst wird und einer Ihrer registrierten Handler `ev.preventDefault()` und/oder `ev.setResult(...)` aufruft.

### 11.2 Lebenszyklus

- **Ausführen** (Schaltfläche pro Gruppe im Editor): Die Engine löscht zunächst jeden Handler, der zuvor mit dieser Gruppe markiert war, und führt dann den Regelkörper in der Offscreen-Sandbox erneut aus. Dies ist die einzige Möglichkeit, sich nach der Bearbeitung der Quelle erneut zu registrieren.
- **Gruppe deaktivieren**: Jeder mit dieser Gruppe markierte Handler wird gelöscht. Die Gruppenquelle bleibt im Speicher, reagiert jedoch nicht mehr auf Ereignisse.
- **Gruppe erneut aktivieren**: Die Engine führt die aktive Quelle für diese Gruppe automatisch erneut aus.
- **Gruppe löschen**: dasselbe wie deaktivieren; Alle mit der Gruppe markierten Handler werden gelöscht.
- **Neuregistrierung mit demselben `(eventType, id)`**: Überschreibt stillschweigend die vorherige Registrierung.

Die Offscreen-Sandbox wird von **allen** benutzerdefinierten Gruppen gemeinsam genutzt. Dort existieren Handler aus verschiedenen Gruppen nebeneinander, die jeweils intern mit ihrer eigenen Gruppen-ID gekennzeichnet sind, sodass „Ausführen“, „Deaktivieren“ oder „Löschen“ nur die richtige Gruppe berührt.

Wenn sich eine benutzerdefinierte Regel nicht richtig verhält (synchrone Endlosschleife, außer Kontrolle geratener Protokoll-Spam usw.), wird sie von der Sandbox unter Quarantäne gestellt: Die Gruppe wird automatisch deaktiviert und der Fehler wird aufgezeichnet, sodass Sie ihn im Protokollbereich sehen können. Um eine unter Quarantäne gestellte Regel wieder zu aktivieren, reparieren Sie die Quelle und klicken Sie auf **Ausführen** – die Engine löscht den Abbruchgrund und lädt die Regel neu.

### 11.2.1 Die Ereignisregistrierung (`event`)

Allgemeine Methoden:

- `event.register(type, id, handler, options?)` – Registrieren Sie einen Handler für einen beliebigen Ereignistyp. `id` ist Ihre eigene Wahl. `options.priority` (Standard `0`) – höhere Läufe zuerst. `options.intervalMs` – nur für `tickEvent`; Drosseln Sie diesen spezifischen Handler relativ zum globalen Tick. Erneute Registrierung mit denselben `(type, id)`-Überschreibungen.
- `event.unregister(type, id)`, `event.unregisterAll(type)`.
- `event.post(type, data?, { scope })` – löst ein benutzerdefiniertes Ereignis aus. `scope: "global"` erreicht jede Gruppe; Der Standardwert `scope: "group"` erreicht nur Handler in der **gleichen** Gruppe.

Zucker pro Ereignistyp (ein Methodensatz pro integriertem Typ):

- `event.registerTickEvent(id, handler, opts)`, `event.getTickEvent(id)`, `event.getTickEvents()`, `event.countTickRegistered()`.
- `event.registerOpenWebEvent(id, handler, opts)`, `event.getOpenWebEvent(id)`, `event.getOpenWebEvents()`, `event.countOpenWebRegistered()`.
- Gleiche Form für `closeWebEvent`, `switchWebEvent`, `switchDomainEvent`, `webChangedEvent`, `pageHeartbeatEvent`, `timerEnded`, `snoozePress`.

### 11.2.2 Integrierte Ereignistypen

| Geben Sie | ein Wenn es feuert | `ev.data` Nutzlast |
|---|---|---|
| `tickEvent` | Global gemeinsam genutzter 1-Sekunden-Tick im gesamten Browser. Wird unabhängig von der Sichtbarkeit der Registerkarte ausgelöst. Verwenden Sie dies für eine uhrartige Logik, die auch dann weiterlaufen muss, wenn kein Tab fokussiert ist. | `{ intervalMs: 1000 }` |
| `pageHeartbeatEvent` | ~250 ms Heartbeat von der Registerkarte **aktiv**, **sichtbar**. Steuert die gesamte Tab-Sichtbarkeits-fähige Logik, einschließlich des in `getOrCreateTimer({ scope })` integrierten automatischen Ankreuzens. Wird **nicht** über Hintergrundregisterkarten oder bei gesperrtem Bildschirm ausgelöst. | `{ elapsedMs }` |
| `openWebEvent` | Es wird ein neuer Tab erstellt ODER eine neue Navigation landet auf einer URL, die die Engine für diesen Tab noch nicht gesehen hat. Wird für bereits geöffnete Tabs nach einem Klick auf „Ausführen“ **nicht** erneut ausgelöst. | `{ previousUrl, isNewTab }` |
| `closeWebEvent` | Eine Registerkarte wird geschlossen. | `{ reason, nextUrl }` |
| `switchWebEvent` | URL **Änderungen** innerhalb derselben Registerkarte – zurück/vor, SPA-Routenänderung oder eine Navigation, die auf einer anderen URL als zuvor landet. Wird bei einem einfachen Neuladen **nicht** ausgelöst (gleiche URL). | `{ previousUrl, previousHostname, sameDomain }` |
| `switchDomainEvent` | Die URL-Änderung überschreitet eine Hostnamensgrenze (z. B. `youtube.com` → `wikipedia.org`). Feuert neben `switchWebEvent`. | `{ previousUrl, previousHostname }` |
| `webChangedEvent` | Die Seite wird auf beliebige Weise (neu) geladen: Öffnen, Wechseln, Aktualisierung des SPA-Verlaufs, **oder einfaches Neuladen, bei dem die gleiche URL erhalten bleibt**. Dies ist der zuverlässige Hook „Die Seite hat sich geändert, alles neu bewerten“. Wird zusammen mit `openWebEvent` / `switchWebEvent` / `switchDomainEvent` ausgelöst und ist der einzige, der beim erneuten Laden derselben URL ausgelöst wird. | `{ previousUrl, previousHostname, sameDomain, isFirstLoad, isReload, transition }`, wobei `transition` `"tabCreated"`, `"commit"` oder `"history"` ist |
| `timerEnded` | Ein von der Gruppe verwalteter Timer erreicht `currentMs === 0`. Wird nur an die Eigentümergruppe geliefert. | `{ timerId, displayName, direction, currentMs }` |
| `snoozePress` | Der Benutzer hat im Popup für diese **benutzerdefinierte** Gruppe **Start Snooze** gedrückt. Reines Benachrichtigungsereignis – der Handler kann beliebigen Code ausführen (protokollieren, umleiten, andere Ereignisse auslösen), aber benutzerdefinierte Regeln verfügen über **keine programmatische Snooze-API**. Hier erstellte Protokolle werden als Toasts auf der aktiven Registerkarte angezeigt. Wird nur an die gepresste Gruppe geliefert. | `{ triggeredAt }` |

URLs in `ev.url` und in Ereignisdaten werden für Ereignisse **normalisiert**: Die Seite „Neuer Tab“ von Chrom-Browser (die die Google-Oberfläche „Google durchsuchen oder URL eingeben“ darstellt), `about:blank` und entsprechende Newtab-Schemata werden als leere Zeichenfolge `""` angezeigt. Ein auf `ev.url === ""` beschränkter Timer tickt also nur, während Sie sich auf der Seite „Neuer Tab“ befinden. Reguläre `google.com`-URLs bleiben unverändert.

### 11.2.3 Das Ereignisobjekt (`ev`)

Jeder Handler wird als `(ev, helpers) => void` aufgerufen. `ev` trägt:

- `ev.type` – der Typ des ausgelösten Ereignisses.
- `ev.groupId` – die ID der empfangenden Gruppe.
- `ev.tabId`, `ev.pageId`, `ev.url`, `ev.hostname` – Kontext für das Ereignis.
- `ev.time` – `{ now, month, dayOfMonth, dayName, hour, minute }` Schnappschuss beim Versand. `dayName` ist `"Sunday"`..`"Saturday"`.
- `ev.data` – ereignisspezifische Nutzlast (siehe Tabelle oben).

Methoden:

- `ev.preventDefault()` – markieren Sie den Versand als „blockiert“. Das Host-Inhaltsskript verlässt die Seite (oder folgt `setRedirectLink`), es sei denn, ein Handler mit höherer Priorität setzt später `setResult(1)`.
- `ev.stopPropagation()` – Stoppen Sie diesen Versand sofort. **Für dieses Ereignis werden in keiner Gruppe weitere Handler aufgerufen**.
- `ev.setResult(value)` – Legen Sie das Versandergebnis fest. `value` kann eine **Zahl** in `[-255, 255]` (`-1`-Block, `0` neutral, `1` zulässig; andere Ganzzahlen werden für Ihre eigene Debug-Logik beibehalten) oder eine **Zeichenfolge** (als Umleitungs-URL interpretiert) sein. Der letzte `setResult`-Aufruf aller Handler gewinnt. Ein numerischer Wert `1` überschreibt alle früheren Werte `preventDefault`.
- `ev.setRedirectLink(url)` / `ev.getRedirectLink()` – die URL, zu der der Host navigieren soll, wenn der Versand als blockiert endet. Dies ist die **einzige** Möglichkeit, von benutzerdefinierten Regeln umzuleiten. Der Editor stellt das Feld „URL umleiten, wenn blockiert“ für benutzerdefinierte Gruppen nicht mehr zur Verfügung.
– `ev.post(type, data, { scope })` – löst ein Folgeereignis aus einem Handler aus.

Darüber hinaus ist `ev` ein Proxy: Jedes Feld, das Sie darauf festlegen (z. B. `ev.foo = 42`), wird in einer `custom`-Map gespeichert und kann vom selben Handler oder von späteren Handlern im selben Dispatch zurückgelesen werden.### 11.3 Das `helpers`-Objekt

Jeder Handler-Aufruf erhält ein neues `helpers`-Bundle, das auf die empfangende Gruppe und die URL des Ereignisses beschränkt ist. Konstante Felder:

– `helpers.now` – Epochen-Millisekunden beim Versand.
- `helpers.currentUrl` – die Ereignis-URL nach der Newtab/Leer-Normalisierung.
- `helpers.groupId` – Empfangsgruppen-ID.

Praktische Tastenkombinationen (leiten Sie zu denselben akkumulatorenfähigen Funktionen weiter, die von den unten aufgeführten Helfern verwendet werden, sodass die Ausgabe weiterhin im Protokollfenster landet):

- `helpers.log(...)`, `helpers.warn(...)`, `helpers.error(...)`.

Zugriffsmethoden:

- `helpers.getLogHelper()` — `log` / `warn` / `error`. Die Ausgabegeschwindigkeit ist begrenzt und pro Versand begrenzt, um zu verhindern, dass außer Kontrolle geratene Regeln das Popup einfrieren.
- `helpers.getDomainHelper()` (alias `helpers.getDomainUtility()`) – URL-Inspektion (siehe **11.3.5**).
- `helpers.getTimerHelper()` – gruppenbezogene Timer (Countdown/Countup); Der Status bleibt über Browser-Neustarts hinweg bestehen.
– `helpers.getPersistenceHelper()` – JSON-Schlüssel/Wert-Speicher, der auf die Gruppe beschränkt ist.
- `helpers.getRedirectionHelper()` – `setRedirectLink(url)` / `getRedirectLink()` (und `set` / `get`-Aliase) plus `createMessageUrl(message)`, das eine `chrome-extension://...`-URL zurückgibt, die die angegebene Nachricht anzeigt.
- `helpers.getPlatformHelper()` – plattformspezifische DOM-Absichten (siehe **11.3.6**).
- `helpers.getDOMHelper()` – generische DOM-Absichten: `hide(sel)`, `show(sel)`, `addClass(sel, c)`, `removeClass(sel, c)`, `setText(sel, text)`, `click(sel)`, `injectCss(css, id?)`, `removeInjectedCss(id)`, `scrollTo(sel)`. Vorgänge werden gestapelt und angewendet, nachdem der Handler zurückkehrt.
- `helpers.getNavigationHelper()` — `back()`, `forward()`, `reload()`, `goTo(url)`, `closeTab()`. Effekte werden auf die Registerkarte angewendet, von der das Ereignis stammt.
– `helpers.getStorageHelper()` – Obermenge von `getPersistenceHelper` plus asynchrone `requestAsyncGet(key)`/`requestAsyncSet(key, value)`-Hooks für erweiterungsübergreifende Speicherung (Ergebnisse kommen als benutzerdefiniertes Folgeereignis an).
- `helpers.getTabHelper()` – `list()`, `getActiveTab()`, `getById(id)`, `countOpen()` gegen einen Snapshot, der mit der Veranstaltung gebündelt ist.

Alle Hilfsmethoden sind sicher: Ungültige Parameter geben `null`, `false` oder einen leeren Wert zurück, anstatt einen Wert auszulösen.

#### 11.3.1 `getTimerHelper()`

Timer pro Gruppe. Jeder Timer wird durch eine von Ihnen gewählte Zeichenfolge `id` identifiziert; Die Identität ist auf die Gruppe beschränkt, sodass zwei Gruppen beide die ID `"yt-shorts"` verwenden können, ohne dass es zu Kollisionen kommt. Der Status bleibt über Browser-Neustarts hinweg bestehen.

Der persistente Zustand eines Timers ist genau: `id`, `displayName`, `direction` (`"forward"` oder `"backward"`), `isPaused` und `currentMs`. Es gibt keine gespeicherte „Anfangsdauer“ – `isExpired` ist nur `currentMs === 0`. Vorwärts-Timer laufen ewig und laufen nie von alleine ab. Rückwärts-Timer hören bei `0` auf zu ticken (keine negativen Werte).

Es gibt zwei Bauweisen. Wählen Sie diejenige aus, deren Semantik Ihren Wünschen entspricht:

- `create({ id, displayName?, direction?, currentMs?, scope?, domain? })` – **erstellt** den Timer immer mit den bereitgestellten Initialisierungswerten und überschreibt dabei alle vorhandenen Zustände, einschließlich `currentMs`. Verwenden Sie dies, wenn Sie „neu beginnen“ meinen, z. innerhalb eines One-Shot-Reset-Zweigs.
- `getOrCreateTimer({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **idempotent**. Wenn bereits ein Timer mit diesem `id` vorhanden ist, werden dessen `displayName` und `direction` möglicherweise aktualisiert, `currentMs` bleibt jedoch erhalten. Andernfalls wird es mit den angegebenen Init-Werten erstellt. Dies ist, was Sie für das allgemeine Muster „Stellen Sie sicher, dass mein Timer vorhanden ist, und lassen Sie ihn dann ticken“ wünschen.

Beide Methoden akzeptieren zwei Prädikatfunktionen, die sich die Engine für die gesamte Lebensdauer der Regel merkt (sie bleiben über Heartbeats und `webChangedEvent`-Neuauswertungen hinweg bestehen, werden jedoch **niemals im Speicher gespeichert**):- `scope: (url) => boolean` – wenn `true` für die aktuell sichtbare URL auf jedem `pageHeartbeatEvent` gilt, tickt der Timer automatisch im Heartbeat-Intervall (~250 ms). Der Helfer selbst blockiert nie; Es aktualisiert nur `currentMs`. Höchstens ein Auto-Tick pro Herzschlag und Timer.
- `domain: (url) => boolean` – wenn `true` für die aktuell sichtbare URL, wird der Timer im In-Page-Overlay (oben links) gerendert. Wenn `domain` weggelassen wird, greift die Engine zur Anzeige auf `scope` zurück, sodass dort auch ein Timer zum Ankreuzen von /shorts/pages ohne zusätzliche Verkabelung angezeigt wird. Geben Sie `domain` explizit an, wenn Sie ein anderes Anzeigefenster wünschen (z. B. nur `/shorts/` ankreuzen, aber die verbleibende Zeit für ganz `youtube.com` anzeigen).

> **Wichtig – ein Timer blockiert nie von selbst.** Wenn ein Rückwärtstimer Null erreicht, stoppt er einfach bei Null und löst einmal `timerEnded` aus. Ob die Seite tatsächlich blockiert wird, hängt von einem separaten `openWebEvent`/`switchWebEvent`-Handler ab, der `ev.preventDefault()` aufruft, nachdem er `helpers.getTimerHelper().isExpired(id)` überprüft hat. Mit dieser Trennung können Sie „Nur-Warn“-Timer, Count-Up-Tracker, Soft-Nudges oder Hard-Blocks erstellen – dasselbe Grundelement, Sie haben die Wahl.

Andere Methoden:

- `delete(id)`, `pause(id)`, `resume(id)` – Standardlebenszyklus. Pause friert `currentMs` ein.
- `setDirection(id, "forward" | "backward")`, `setCurrentMs(id, ms)`, `addMs(id, deltaMs)` – direkte Mutatoren (die meisten Regeln benötigen diese nicht – lassen Sie den Herzschlag den Timer für Sie ticken).
- `setDisplayName(id, name)` – Umbenennen.
- `getCurrentMs(id)`, `getDirection(id)`, `getDisplayName(id)`, `isPaused(id)`, `exists(id)`.
- `isExpired(id)` — `true` wenn `currentMs === 0`.
- `getState(id)` — `{ id, displayName, direction, isPaused, currentMs, isExpired }` oder `null`.
- `list()` – jeder Timer, den diese Gruppe besitzt, als Array von Statusobjekten.

#### 11.3.2 `getPersistenceHelper()`

Kartenähnlicher Speicher, der auf Ihre Gruppe beschränkt ist. Werte müssen JSON-serialisierbar sein.

- `set(key, value)`, `get(key, defaultValue?)`, `has(key)`, `delete(key)`, `keys()`, `entries()`, `clear()`, `size()`.

Weiche Grenzen: etwa 200 Schlüssel pro Gruppe, 16 KB pro Wert.

#### 11.3.3 `getLogHelper()`

- `log(...args)`, `warn(...args)`, `error(...args)` – Schreiben Sie in das Bedienfeld **Protokoll** im Popup (das Hilfspaket leitet sie weiterhin über denselben Akkumulator weiter, unabhängig davon, welcher Versand sie erstellt hat). Jeder Zeile wird `[CustomBlocker:groupId]` vorangestellt.
– Der Helfer hat feste Obergrenzen: ungefähr **200 Protokolleinträge pro Versand** und eine maximale Zeichenfolgenlänge pro Eintrag. Überschüssige Einträge werden verworfen und in `accumulator.logsDropped` gezählt. Dies schützt das Popup vor einem `for (let i = 0; i < 100000; i++) helpers.log(i)`-Ausreißer.
– Wenn der **Debug-Modus** deaktiviert ist (Standard), werden Einträge auf Trace-Ebene, die die Engine selbst ausgibt (Dispatch-Start/Handler-Timing), überall unterdrückt – sie werden nicht im Protokollbereich angezeigt und nicht auf der Konsole gedruckt. Ihre eigenen `log`-/`warn`-/`error`-Anrufe werden immer durchgestellt.

#### 11.3.4 `getRedirectionHelper()`

Überprüfen/überschreiben Sie die Weiterleitungs-URL, die das Inhaltsskript verwendet, wenn die aktuelle Seite blockiert wird.

- `get()` – gibt die aktuell wirksame Weiterleitungs-URL für diesen Versand zurück. Dies ist zunächst die konfigurierte Fallback-URL der integrierten Gruppe (falls vorhanden), andernfalls `""`.
- `set(url)` – überschreibt die Weiterleitungs-URL für diesen Versand. Gibt bei Erfolg `true` zurück, bei Nicht-String-Eingaben `false`. Durch die Übergabe von `""` wird die Umleitungsüberschreibung gelöscht und auf das normale Standard-Exit-Verhalten zurückgegriffen.
- `createMessageUrl(message)` – gibt eine `chrome-extension://<id>/message-page.html?msg=...`-URL zurück, die beim Navigieren die Nachricht zentriert auf einer sauberen Seite anzeigt. Nützlich, um Benutzer nach Ablauf eines Timers auf den Bildschirm „Geh zur Arbeit“/„Pause machen“ umzuleiten. Beispiel: `ev.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Go Work"))`.

Wie die anderen Nebenwirkungen benutzerdefinierter Regeln wird dieser Status von allen Regeln im aktuellen Versand übernommen. Da die Regeln von unten nach oben ablaufen, gewinnt die oberste Regel, die `set(...)` aufruft.

#### 11.3.5 `getDomainHelper()` (alias `getDomainUtility()`)

URL-Inspektionshilfen. Es gibt kein `normalize()`, da eingehende URLs bereits Newtab-normalisiert sind.

Kern:- `hostnameOf(url)`, `pathnameOf(url)`, `matches(hostname, site)`, `getPlatform(url)`.
- `isYouTubeHost`, `isKurzvideoportalHost`, `isInstagramHost`, `isFacebookHost`, `isTwitchHost`, `isRedditHost`, `isDiscordHost`.
- `youtube()`, `tiktok()`, `instagram()`, `facebook()`, `twitch()` – jeweils gibt `{ isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId }` zurück.

URL-Filterung und Abschnittshilfen:

- `isEmptyStartPage(url)` – `true` für die Seite „Neuer Tab“ und Äquivalente (die URLs, die Handlern als `""` angezeigt werden).
- `matchesAny(url, patterns)` – `patterns` kann ein regulärer Ausdruck, ein regulärer String-Ausdruck oder ein Array von beidem sein.
- `pathStartsWith(url, path)` – grenzenbewusst (`pathStartsWith("/r/", "/r")` ist wahr; `"/results/"` ist nicht wahr).
- `queryHas(url, key, value?)`, `queryGet(url, key)` – Überprüfung der Abfragezeichenfolge.
- `isSearchPage(url)` – erkennt Google-/Bing-/DuckDuckGo-/Jutjub-Ergebnisse/Gemeinschaftsforum-/Zwitscher-/X-Suchen.
- `isInfiniteFeedUrl(url)` – erkennt die algorithmischen Feed-Oberflächen von Jutjub, Kurzvideoportal, Bildernetz, Gesichtsbuch, Gemeinschaftsforum, X.
- `sameSection(a, b)` – gleicher Hostname UND gleiches erstes Pfadsegment.

#### 11.3.6 `getPlatformHelper()`

Plattformspezifische DOM-Absichten und Unterabschnitts-Timer sowie Inspektion. Jeder `helpers.getPlatformHelper().<platform>()` gibt ein Objekt zurück, dessen Methodensatz **durch die Plattform geschützt** ist – Methoden, die auf einer bestimmten Plattform keinen Sinn ergeben, fehlen einfach, sodass der Aufruf von ihnen `TypeError: ... is not a function` auslöst, anstatt stillschweigend keine Operationen durchzuführen. Zum Beispiel existiert `twitch().hidePosts` nicht (Live-Portal hat keine Beiträge) und `tiktok().hideShortButton` existiert nicht (Kurzvideoportals gesamte Erfahrung ist bereits ein Kurzvideo). Verwenden Sie `helpers.getPlatformHelper().hasMethod(platform, name)` oder `.listMethods(platform)` zur Selbstprüfung zur Laufzeit.

Methodenmatrix pro Plattform:

| Methode | youtube | Tiktok | Bildernetz | Gesichtsbuch | zucken |
|---|:---:|:---:|:---:|:---:|:---:|
| `hideShorts` / `showShorts` | ✓ |  |  |  |  |
| `hideReels` / `showReels` |  |  | ✓ | ✓ |  |
| `hideClips` / `showClips` |  |  |  |  | ✓ |
| `hideStreams` / `showStreams` |  |  |  |  | ✓ |
| `hideVideos` / `showVideos` | ✓ | ✓ |  | ✓ | ✓ (VODs) |
| `hidePosts` / `showPosts` | ✓ |  | ✓ | ✓ |  |
| `hideShortButton` / `showShortButton` | ✓ |  |  |  |  |
| `hideHomePage` / `showHomePage` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `hideComments` / `showComments` | ✓ | ✓ | ✓ | ✓ | ✓ (Chat) |
| `filterComments` | ✓ | ✓ | ✓ | ✓ |  |
| `hideLive` / `showLive` / `filterLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isCurrentChannelSubscribed` / `isChannelSubscribed` | ✓ |  |  |  | ✓ |
| `isCurrentChannelVerified` | ✓ |  |  |  |  |
| `isLiveNow` | ✓ | ✓ |  | ✓ | ✓ |
| `isItemLive` | ✓ | ✓ |  | ✓ | ✓ |
| `isAlgorithmicRecommendation` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `isSponsored` | ✓ | ✓ | ✓ | ✓ |  |
| `setShortsTimer` | ✓ |  |  |  |  |
| `setReelsTimer` |  |  | ✓ | ✓ |  |
| `setClipsTimer` |  |  |  |  | ✓ |
| `setStreamsTimer` |  |  |  |  | ✓ |
| `setVideosTimer` | ✓ | ✓ |  | ✓ | ✓ |
| `setPostsTimer` | ✓ |  | ✓ | ✓ |  |

Die plattformnativen Namen (`hideReels`, `hideClips`, `hideStreams`) sind KEINE separaten Buckets von `hideShorts` / `hideVideos` – der Speichersteckplatz ist derselbe; Nur der für den Benutzer sichtbare Name folgt der Terminologie der jeweiligen Plattform.

> **Prädikatslebensdauer und Single-Slot-Regel.** Jeder von `hideShorts` / `hideReels` / `hideClips` / `hideStreams` / `hideVideos` / `hidePosts` / `filterComments` / `filterLive` besitzt **ein** persistentes Prädikat pro `(group, platform, slot)`. Das Prädikat ist **nicht** auf das aktuelle Ereignis beschränkt – sobald Sie es festgelegt haben, bleibt es bei jedem Laden der Seite und bei jedem Versand aktiv, bis entweder das entsprechende `show*()` aufgerufen oder die Gruppe entladen wird. Ein erneuter Aufruf derselben Methode mit einer neuen Funktion **ersetzt** die vorherige – die Engine führt niemals mehrere Prädikate innerhalb einer einzelnen Gruppe ODER-verknüpft. Um Bedingungen zu kombinieren, schreiben Sie ein Prädikat, das die Kombination selbst übernimmt, z. B. `yt.hideVideos(item => isShort(item) || hasKeyword(item))`. In **verschiedenen** Gruppen trägt jede Gruppe ihr eigenes Prädikat bei und ein Element wird ausgeblendet, wenn das Prädikat einer Gruppe übereinstimmt.

Inspektionsmethoden beziehen ihren Wert zum Zeitpunkt der Auslösung aus einem Schnappschuss, der mit dem Ereignis gebündelt ist; Ihre Verfügbarkeit wird durch die obige Matrix bestimmt.

URL-Klassifikatoren werden unabhängig von der Plattform immer erneut verfügbar gemacht: `isPlatformUrl`, `isShortUrl`, `isVideoUrl`, `isPostUrl`, `isHomePage`, `extractAuthor`, `extractVideoId`.Unterabschnitts-Timer registrieren den Timer im persistenten Gruppen-Bucket und aktivieren, wenn der Gültigkeitsbereich festgelegt ist, nur URLs, die mit diesem Unterabschnitt übereinstimmen. Die Timer-Methoden akzeptieren `{ id, direction, currentMs, displayName }` und folgen dem gleichen Gating pro Plattform.

Bei Prädikatmethoden wird das Prädikat pro passender Karte mit einem normalisierten `item` aufgerufen: `{ url, name, author, length, views, publishedAt, description, live?, sponsored?, algorithmic? }`. Jedes Feld kann `null` sein; „unschuldig bis zum Beweis der Schuld“ – geben Sie `false` zurück, wenn das benötigte Feld fehlt.

### 11.4 Beispiele

**Einfach** – Jutjub-Shorts-Seiten an Wochentagen vormittags blockieren:

```js
(event, helpers) => {
  const yt = helpers.getDomainHelper().youtube();

  function maybeBlock(ev) {
    if (!yt.isShortUrl(ev.url)) return;
    const { dayName, hour } = ev.time;
    const weekday = !["Saturday", "Sunday"].includes(dayName);
    if (weekday && hour >= 9 && hour < 12) {
      ev.preventDefault();
      ev.setResult(-1);
    }
  }

  event.registerOpenWebEvent("morning-block", maybeBlock);
  event.registerSwitchWebEvent("morning-block", maybeBlock);
}
```

**Mittel** – 30-Minuten-Tagesbudget für Jutjub-Shorts. Der Timer tickt automatisch bei `pageHeartbeatEvent`s, während eine Shorts-URL sichtbar ist; Ein separater Handler erzwingt die Blockierung, wenn der Timer Null erreicht.

```js
(event, helpers) => {
  const TIMER_ID = "yt-shorts-budget";
  const yt = helpers.getDomainHelper().youtube();
  const onShorts = (url) => yt.isShortUrl(url);

  helpers.getTimerHelper().getOrCreateTimer({
    id: TIMER_ID,
    direction: "backward",
    currentMs: 30 * 60 * 1000,
    displayName: "YT Shorts",
    scope: onShorts,
    domain: onShorts
  });

  function maybeBlock(ev, h) {
    if (!yt.isShortUrl(ev.url)) return;
    if (h.getTimerHelper().isExpired(TIMER_ID)) {
      ev.setRedirectLink("https://example.com/focus");
      ev.preventDefault();
      ev.setResult(-1);
    }
  }
  event.registerOpenWebEvent("budget-block", maybeBlock);
  event.registerSwitchWebEvent("budget-block", maybeBlock);

  event.registerTimerEndedEvent("budget-warn", (_ev, h) => {
    h.getLogHelper().log("Budget hit zero.");
  });
}
```

**Schwieriger** – Blenden Sie einzelne Jutjub-Shorts aus, deren Autoren-Handle zu lang ist, und fügen Sie ein „Dieser Short ist ausgeblendet“-CSS ein:

```js
(event, helpers) => {
  const MAX_AUTHOR_LEN = 16;

  function configure(_ev, h) {
    const yt = h.getPlatformHelper().youtube();
    yt.hideShorts(
      (item) => item.author && item.author.length > MAX_AUTHOR_LEN,
      { blockPageOnVisit: true }
    );
    h.getDOMHelper().injectCss(
      "ytd-rich-grid-media[data-cb-hidden] { opacity: 0.2 !important; }",
      "long-author-label"
    );
  }

  event.registerOpenWebEvent("hide-long-shorts", configure);
  event.registerSwitchWebEvent("hide-long-shorts", configure);
  event.registerWebChangedEvent("hide-long-shorts", configure);
}
```

**Am schwierigsten** – Übertragen Sie ein benutzerdefiniertes Ereignis von einem Handler an andere:

```js
(event, helpers) => {
  event.registerSwitchDomainEvent("track-domain", (ev) => {
    ev.post("domainChange", { from: ev.data.previousHostname, to: ev.hostname });
  });

  event.register("domainChange", "log-it", (ev, h) => {
    h.getLogHelper().log("crossed", ev.data.from, "→", ev.data.to);
  });
}
```

---

## 12. Vorlagen

Jede benutzerdefinierte Gruppe verfügt über eine **Vorlagen**-Auswahl, die einen durchsuchbaren voreingestellten Browser öffnet. Die Bibliothek enthält jetzt **50+ Vorlagen**, die in neun Kategorien unterteilt sind, sodass Sie sie durchsuchen können, anstatt Regeln von Grund auf neu schreiben zu müssen:

| Kategorie | Beispiele |
|---|---|
| **Timer** | Site-Zeitbudget (Countdown + Block), Site-Zeit-Tracker (Aufwärtszählen), Jutjub Shorts-Obergrenze, Kurzvideoportal-Feed-Obergrenze, Bildernetz Reels-Obergrenze, Gesichtsbuch Reels-Obergrenze, Live-Portal Clips-Obergrenze, Universelles Ablenkungsbudget, Täglicher Deep-Work-Tracker |
| **Zeitplan** | Blockierung der Arbeitszeiten an Wochentagen, Standorte nur am Wochenende, Abschaltung vor dem Schlafengehen, nur eine Stunde erlauben, Nachrichten nur zum Mittagessen, Neuanfang am Montag, strikte Blockierung von intensiver Arbeit |
| **Feed / Shorts** | Jutjub-Shorts-URLs blockieren, Shorts-Karten ausblenden, Shorts nach Stichwort ausblenden, Jutjub-Startseite-Feed/Kommentare/Trends ausblenden, Kurzvideoportal FYP blockieren, Kurzvideoportal-Shorts ausblenden, Bildernetz-Reels-URLs blockieren, Bildernetz-Reels-Feed ausblenden, Gesichtsbuch-Feed/Reels ausblenden, Gemeinschaftsforum/Zwitscher/LinkedIn-Startseite ausblenden |
| **Weiterleiten** | Ablenkungen → Fokusseite, Shorts → /feed/subscriptions, reddit.com → old.reddit.com, twitter / x → Nitter, neuer Tab → Aufgabenliste |
| **Fokus** | Fokussitzung nur auf Zulassungsliste, Pomodoro 25/5, Blockierung während der Besprechung, Blockierung nach N Besuchen heute, Blockierung bei Streak-Verlust |
| **Stups** | Protokollieren Sie jeden Ablenkungsbesuch, warnen Sie bei jedem Shorts-Besuch und zählen Sie die täglichen Besuche auf einer Website |
| **Beharrlichkeit** | Monatliche Besuchsobergrenze, wöchentliche Sperrung umschalten, besuchte Chatdienst-Kanäle verfolgen |
| **DOM-Optimierungen** | Jutjub-Autoplay ausblenden, umschalten, Zwitscher / X „Was passiert“ ausblenden, generisch „Selektoren auf einer Website ausblenden“ |
| **Debug** | Demo-Countdown (3 s), jedes benutzerdefinierte Ereignis protokollieren |

Filterchips oben in der Auswahl grenzen die Liste nach Kategorie (`Timer`, `Schedule`, `Feed`, …) und Plattform (`Jutjub`, `Kurzvideoportal`, `Bildernetz`, …) ein. Auswahl einer Vorlage:

1. Lädt seine Parametereingaben (URL, Minuten, Stundenbereiche usw.) in eine kleine Form.
2. **Voreinstellung anwenden** zeigt eine Vorschau der generierten Quelle an.
3. Nachdem Sie **Aktuelle benutzerdefinierte Regel durch diese Voreinstellung ersetzen?** bestätigt haben, wird die Quelle in den Editor geschrieben.
4. Klicken Sie dann auf **Ausführen**, um die Handler der Regel in der Offscreen-Sandbox zu registrieren.

Vorlagen werden unter `templates/*.js` (`timers.js`, `schedule.js`, `feed.js`, …) definiert. Jede Datei ruft beim Laden `CB_REGISTER_TEMPLATES([...])` auf und das Popup verbraucht die zusammengeführte Liste. Das Hinzufügen einer neuen Vorlage erfordert das Schreiben eines Eintrags in die entsprechende Datei – keine weiteren Installationen.

---

## 13. Mehrseitenverhalten- Alle geöffneten Tabs in derselben Gruppe haben denselben Timer.
- Wenn Sie zu einer Registerkarte in derselben Gruppe wechseln, wird deren Überlagerung sofort aktualisiert und zeigt die aktuelle gemeinsame Zeit an.
– Benutzerdefinierte Regel-Timer ticken nur auf der Registerkarte **aktiv sichtbar** – gesteuert durch `pageHeartbeatEvent`. Hintergrundregisterkarten und minimierte Fenster rücken sie nicht voran. Dies entspricht dem standardmäßigen Blockgruppen-Countdown.
- Wenn eine neue Regel hinzugefügt wird, erkennt jede geöffnete Seite die Änderung und wertet sie innerhalb eines Sekundenbruchteils neu aus. **aber** neu registrierte Handler „öffnen“ bereits geöffnete Registerkarten nicht rückwirkend. Aus diesem Grund zeigt das Popup nach jedem Lauf eine Erinnerung zum erneuten Laden an.
- Wenn eine Regel abläuft, werden ausgeblendete Feedkarten und Navigationsschaltflächen bei der nächsten Aktualisierung wiederhergestellt.

---

## 14. Einstellungen

Öffnen Sie den Dialog **Einstellungen** über das Zahnradsymbol in der oberen Leiste.

- **Heartbeat-Intervall** – wie oft das Inhaltsskript die Tab-Zeit meldet und `pageHeartbeatEvent` steuert. Standard 250 ms. Niedrigere Werte sind reaktionsschneller, verbrauchen aber mehr CPU.
- **Tick-Intervall** – wie oft das globale `tickEvent` ausgelöst wird. Standard 1000 ms.
- **Debug-Modus** – standardmäßig *aus*. Wenn *ein*, sendet die Engine Trace-Level-Einträge an das Protokollfenster (`[trace] dispatchEvent`, `[trace] N handler(s)`) und `[CustomBlocker:trace]`-Zeilen an die Browserkonsole. Lassen Sie es im täglichen Gebrauch weg; Schalten Sie es ein, während Sie eine fehlerhafte Regel diagnostizieren. `pageHeartbeatEvent` wird von der Trace-Protokollierung ausgeschlossen, selbst wenn der Debug-Modus aktiviert ist, da es viermal pro Sekunde ausgelöst wird und den Rest übertönen würde.

---

## 15. Internationalisierung

Die gesamte Benutzeroberfläche ist übersetzt. Verwenden Sie die **Sprachauswahl** oben rechts.

Zu den unterstützten Sprachen gehören Englisch, Chinesisch (vereinfacht), Spanisch, Japanisch, Koreanisch sowie teilweise Abdeckung für Hindi, Arabisch, Bengali, Portugiesisch, Russisch, Punjabi, Deutsch, Französisch, Türkisch, Vietnamesisch, Italienisch, Thailändisch, Niederländisch, Polnisch, Indonesisch, Urdu und Persisch. Sprachen mit teilweiser Abdeckung greifen bei fehlenden Zeichenfolgen auf Englisch zurück.

Die Bedienungsanleitung selbst lädt die Markdown-Datei, die Ihrer ausgewählten Sprache entspricht, mit Englisch als Ersatz.

---

## 16. Statusmeldungen

Statusmeldungen werden als zentrierter Toast angezeigt, der nach etwa zwei Sekunden ausgeblendet wird:

- „Änderungen gespeichert.“
- „Erstellt „Gruppenname“.“
– „Benutzerdefinierte Regel geladen – N Handler aktiv. Um diese Regel auf bereits geöffnete Registerkarten anzuwenden, laden Sie sie neu.“
– Validierungsfehler wie „Zulässige Minuten müssen eine Zahl größer als 0 sein.“
- „Schlummerminuten müssen eine Zahl größer als 0 sein.“
- „Eingefrorene Gruppen können nicht geändert werden.“

Bei Eingabefeldern mit Formatvorgaben erscheint die Meldung auch neben der entsprechenden Schaltfläche (für Snooze).

---

## 17. Datenschutz und Speicherung

- Alles wird lokal in `chrome.storage.local` gespeichert. Es werden keine Daten irgendwohin gesendet.
- Zu den gespeicherten Elementen gehören: Ihre Gruppen, Nutzungstimer, Zeiten des letzten Zurücksetzens, Schlummerdatensätze, benutzerdefinierte Timer und benutzerdefinierte dauerhafte Werte.
– Die Erweiterung liest Seiteninhalte nicht über das hinaus, was zum Erkennen des Seitentyps (Pfad/Hostname/bekannte DOM-Markierungen für Videoseiten) und zum Auswerten von vom Benutzer geschriebenen Prädikaten erforderlich ist. Ihre Nachrichten, Beiträge, Kommentare oder privaten Inhalte werden nicht gelesen.

---

## 18. Berechtigungen

- `storage` – für die oben genannten Daten.
- `declarativeNetRequest` – zum nativen Blockieren von `Default`-Gruppen.
- `alarms` – um Regelübergänge effizient zu planen.
- `tabs`, `webNavigation` – um die Erstellung von Tabs, URL-Änderungen und Seiten-Heartbeats zu erkennen, damit Ereignisse gesendet werden können.
- `offscreen` – zum Hosten der langlebigen Sandbox mit benutzerdefinierten Regeln.
- `host_permissions: <all_urls>` – damit das Inhaltsskript das Timer-Overlay anzeigen und den Plattformkontext auf jeder Seite erkennen kann.

---

## 19. Fehlerbehebung- **Eine von mir hinzugefügte Gruppe bewirkt nichts.** Stellen Sie sicher, dass die Gruppe aktiviert ist, der Zeitplan dies jetzt zulässt, keine Snooze aktiv ist und (bei Plattformgruppen) die Seite tatsächlich dem ausgewählten Inhaltstyp und Autorenfilter entspricht.
- **Ein Timer hängt oder ist auf einem Tab falsch.** Wechseln Sie weg und zurück oder fokussieren Sie den Tab – das löst eine erzwungene Aktualisierung des gemeinsamen Timers aus.
- **Feed-Karten erscheinen wieder, nachdem ich denke, dass sie ausgeblendet werden sollten.** Das Ausblenden von Feeds wird nur ausgeführt, während die Regel aktiv blockiert. Wenn Sie über eine `after-minutes`-Regel verfügen, wird das Ausblenden von Feeds aktiviert, sobald Ihre Zeit Null erreicht.
- **Eine Jutjub-Navigationsschaltfläche, von der ich erwartet hatte, dass sie ausgeblendet wird, ist immer noch vorhanden.** Das Ausblenden der Navigation erfordert, dass die Regel auf „Nicht nach Autor filtern“ eingestellt ist und der Inhaltstyp „Shorts“ oder „Jutjub-Beiträge“ ist. Bei Autorenfiltern erfolgt das Ausblenden nur pro Karte.
- **Benutzerdefinierte Regel hat nichts getan oder wurde stillschweigend ausgelöst.** Öffnen Sie Einstellungen → aktivieren Sie den **Debug-Modus**, klicken Sie dann erneut auf **Ausführen** und sehen Sie sich das Protokollfenster an. Zeilen mit dem Präfix `[trace]` zeigen alle Dispatcher und Handler an. Verwenden Sie `helpers.getLogHelper().log(...)`, um Ihre eigenen Trace-Punkte hinzuzufügen. Wenn eine fehlerhafte Regel immer wieder automatisch unter Quarantäne gestellt wird, beheben Sie die Ursache und klicken Sie auf „Ausführen“ – „Ausführen“ löscht den Abbruchgrund.
- **Meine neue benutzerdefinierte Regel wirkt sich nicht auf bereits geöffnete Tabs aus.** Laden Sie sie neu. Benutzerdefinierte Regeln werden an *zukünftige* Seitenereignisse angehängt; Das Popup zeigt eine Erinnerung zum Neuladen nach jedem Lauf an.
- **Mein Countdown-Timer läuft nicht weiter.** Timer mit benutzerdefinierten Regeln ticken nur auf der Registerkarte **aktiv sichtbar** über `pageHeartbeatEvent`. Hintergrundregisterkarten, minimierte Fenster und gesperrte Bildschirme pausieren sie absichtlich – dasselbe Verhalten wie beim standardmäßigen Blockgruppen-Countdown.
- **Ich kann eine Gruppe nicht löschen.** Sie ist wahrscheinlich eingefroren. Strikt eingefrorene Gruppen können überhaupt nicht gelöscht werden, bis ihre Sperre abläuft; Nicht streng eingefrorene Gruppen können über das Unfreeze-Ritual gelöscht werden.
- **Das Popup zeigt für immer „Wird ausgeführt…“ an.** Eine benutzerdefinierte Regel ist wahrscheinlich in eine enge Schleife geraten. Die Engine bricht sie nach einem harten Timeout ab und stellt die Regel unter Quarantäne. Öffnen Sie das Protokollfenster für den Abbruchgrund. Korrigieren Sie die Regel und klicken Sie auf Ausführen.

---

## 20. Glossar

- **Blockgruppe** – ein Regelsatz mit eigenem Typ, Verhalten, Zeitplan und Einfrieren/Schlummern.
- **Sofortige Blockierung** – die Regel blockiert sofort, wenn sie aktiv ist.
- **Blockierung nach Minuten** – die Regel beginnt mit der Blockierung erst, wenn das Zeitbudget für den Zeitraum erschöpft ist.
- **Reset-Intervall** – wie oft das Nach-Minuten-Budget zurückgesetzt wird.
- **Zeitplan** – Tage + Zeitfenster, in denen eine Gruppe aktiv ist.
- **Einfrieren / Striktes Einfrieren** – Manipulationsschutzzustände.
- **Snooze** – vorübergehende Deaktivierung mit einem konfigurierbaren Bestätigungsritual.
- **Autorenfilter** – schränkt die Regel für Plattformgruppen auf bestimmte Inhaltsersteller ein.
- **Inhaltstyp** – beschränkt die Regel für Plattformgruppen auf bestimmte Inhaltsformen (kurz, lang, Beitrag).
- **Helfer** – Dienstprogramme, die an den Handler einer benutzerdefinierten Regel übergeben werden.
- **Plattform** – eine von `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Jede hat ihren eigenen Gruppentyp und ihre eigene Logik zum Ausblenden von Feeds.
- **Heartbeat** – der ca. 250 ms lange `pageHeartbeatEvent` wird von der aktiven sichtbaren Registerkarte gesendet.
- **Häkchen** – die 1 s global geteiltes `tickEvent` (sichtbarkeitsunabhängig).
- **Debug-Modus** – eine Einstellung, die die interne Trace-Protokollierung im Protokollbereich und in der Browserkonsole anzeigt.
- **Quarantäne** – automatische Deaktivierung einer benutzerdefinierten Regel, die eine Laufzeit-Sicherheitsobergrenze (Frist, Protokoll-Spam usw.) überschritten hat. Wird beim nächsten Lauf gelöscht.

---

## 21. Einschränkungen- Das Ausblenden von Feeds hängt vom aktuellen DOM der jeweiligen Plattform ab. Wenn die Plattform ihr Layout ändert, müssen möglicherweise die Ausblendungsselektoren aktualisiert werden.
– Die Plattformkontexterkennung für Nicht-Jutjub-Websites erfolgt größtenteils URL-basiert und ist daher bei kanonischen Inhalts-URLs am zuverlässigsten.
– Benutzerdefinierte Regel-Timer ticken mit Heartbeat-Auflösung (~250 ms). Verlassen Sie sich nicht auf sie, wenn es um das Timing unter einer Sekunde geht.
- Prädikate, die an `hideShorts` / `hideVideos` / `hidePosts` übergeben werden, werden pro Feed-Karte synchron ausgewertet. Schwere Logik in einem Prädikat kann das Scrollen im Feed verlangsamen; Halten Sie sie günstig.
- Zwei Registerkarten, die gleichzeitig denselben Timer pro Gruppe bearbeiten, verwenden die Strategie „Letzter Schreibvorgang gewinnt“. Für den typischen Gebrauch ist das in Ordnung; Wenn Sie auf eine genaue Abrechnung angewiesen sind, müssen Sie mit gelegentlichen kleinen Abweichungen rechnen.
– Der Browser unterbricht möglicherweise den Hintergrunddienstmitarbeiter, wenn er inaktiv ist. Die Erweiterung setzt sie fort, sobald eine Seite oder ein Alarm sie benötigt; Website-/zeitgesteuerte Nutzungsbudgets zählen weiterhin über die Heartbeat-Wiedergabe.

## Hinweis zu v1.2

Der Editor für benutzerdefinierte Regeln färbt jetzt Skriptsprache-Syntax ein, und der Vorlagenbrowser nutzt dieselben Farben für Codevorschauen. Die Sammelaktion für Gruppen heißt **Leeren**.

