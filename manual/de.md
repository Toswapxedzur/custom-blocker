# Funktionsreferenz zur Vault-Erweiterung

## Zweck und Status

This is the authoritative functional specification for the Vault browser extension. Es dokumentiert den Produktvertrag: die Daten, die ein Benutzer konfigurieren kann, die genauen Verhaltensweisen, die die Konfiguration hervorruft, die öffentliche benutzerdefinierte Regelsprache und die dafür geltenden Einschränkungen.

Es handelt sich bewusst nicht um eine Kurzanleitung. Das Website-Tutorial ist der Lernpfad. Dieses Dokument richtet sich an Personen, die das für den Benutzer sichtbare Verhalten von Vault konfigurieren, testen, warten, prüfen oder reproduzieren müssen.

Der Code ist die kanonische Wahrheit, wenn dieses Dokument und das Produkt nicht übereinstimmen. Bei den Namen in diesem Dokument wird soweit möglich auf das gespeicherte/öffentliche Vokabular des Produkts zurückgegriffen. Ein Wort wie „returns“ bezeichnet den Rückgabewert, der einer benutzerdefinierten Regel zur Verfügung gestellt wird; Es verspricht kein Ergebnis auf Browserebene, wenn der Browser oder die Seite die angeforderte Aktion ablehnt.

## 1. Produktgrenze

Vault ist eine WebExtension mit Fokussteuerung. Seine Konfigurationseinheit ist eine **Blockgruppe**. Eine Gruppe kann:

- entscheiden, dass eine Website, eine Plattformseite, ein Ersteller, eine Community, ein Server, ein Kanal oder ein Konto der obersten Ebene gesperrt werden soll;
- konfigurierte Plattformoberflächen oder passende Futterkarten ausblenden;
- die in einem passenden Bereich verbrachte Zeit messen;
- einen Zeitplan, einen Einfrierschutz oder eine vorübergehende Schlummerfunktion anwenden, sofern dieser Gruppentyp dies unterstützt;
- Führen Sie eine benutzerdefinierte JavaScript-Regel mit einer Ereignis-API aus;
- einen On-Page-Timer, ein Panel, eine Nachricht oder ein Seitenprotokoll anzeigen;
- Umleiten, Navigieren, Schließen eines Browser-Tabs oder Verwalten einer durch eine Sitzungsregel erstellten Site-Sperrliste;
- optional an einem lokal verbundenen Vault-Bridge-Cluster teilnehmen.

Vault agiert nur innerhalb des Browserprofils, in dem es installiert ist, und nur dort, wo der Browser die Ausführung seines Inhaltsskripts zulässt. Es gilt nicht:

- eine native Anwendung oder Browsererweiterung installieren;
- Betriebssystemanwendungen blockieren;
- Browser-Berechtigungsaufforderungen, Einschränkungen beim privaten Surfen oder das eigene Sicherheitsmodell einer Website umgehen;
- selektorbasiertes Ausblenden garantieren, wenn eine Drittplattform ihr DOM ändert;
- Benutzerdefinierten Regelstatus über Profile hinweg portierbar machen, es sei denn, der Benutzer exportiert/konfiguriert ihn separat;
- Bereitstellung einer Netzwerk-Firewall, eines Proxys, einer Kontokontrolle oder eines elterlichen Überwachungsdienstes.

Die folgende Terminologie wird durchgehend verwendet:

| Begriff | Bedeutung |
| --- | --- |
| Gruppe | Ein unabhängig benanntes Konfigurationsobjekt. Namen müssen innerhalb der Erweiterung eindeutig sein, Groß- und Kleinschreibung wird ignoriert. |
| Site-Gruppe | Eine normale Gruppe, deren Domänenliste die wichtigste Übereinstimmungsbedingung ist. |
| Plattformgruppe | Eine normale Gruppe, spezialisiert auf YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord oder Twitter/X. |
| Benutzerdefinierte Gruppe | Eine Gruppe, die eine JavaScript-Regel und deren Ereignisregistrierungen besitzt. Seine Regel bestimmt sein Verhalten. |
| Übereinstimmung | Die Seite, das Feed-Element oder die Plattformoberfläche erfüllt die konfigurierten Bedingungen einer Gruppe. |
| Aktiv | Die Gruppe ist aktiviert, für ihren Zeitplan berechtigt und befindet sich derzeit nicht im Ruhezustand. Benutzerdefinierte Gruppen unterliegen nicht der normalen Zeitplan-Benutzeroberfläche. |
| Blockieren | Verhindern Sie, dass die aktuelle Seite der obersten Ebene weiterhin nutzbar bleibt, indem Sie normalerweise auf ihr Fallback-Ziel umleiten. |
| Ausblenden | Entfernen oder verbergen Sie ein Element/eine Karte auf der aktuell gerenderten Seite. Verstecken ist keine Netzwerkblockade. |
| Fallback-URL | Ein gruppenspezifisches Weiterleitungsziel. Wenn leer, wird der globale Fallback verwendet. |
| Zulassen/Ausnahmeeffekt | Ein Plattformkartenurteil, das passende Inhalte vor Ausblendregeln mit niedrigerer Priorität rettet. Es handelt sich nicht um eine allgemeine Website-Zulassungsliste. |

## 2. Gruppenmodell und gemeinsamer Lebenszyklus

Jede gespeicherte Gruppe verfügt über eine stabile ID, einen Namen, einen Typ, ein aktiviertes Flag und gemeinsame Richtlinienfelder. Eine neue normale Gruppe ist standardmäßig aktiviert. Eine Gruppe kann ausgewählt, durch das automatische Speicherverhalten des Editors gespeichert, neu angeordnet, exportiert, importiert, eingefroren, entfroren, in den Ruhezustand versetzt, deaktiviert oder gelöscht werden.

### 2.1 Reihenfolge und Überschneidung

Mehrere Gruppen können mit derselben Seite übereinstimmen. Vault wertet gespeicherte Gruppen vom Ende der angezeigten Liste zum Anfang aus. Behandeln Sie niedrigere Elemente in der Liste als Übereinstimmungen mit späterer/höherer Priorität, wenn Sie überlappende Regeln entwerfen.

Bei der normalen Blockierung einer Website auf oberster Ebene kann jede anwendbare Blockierungsgruppe dazu führen, dass die Seite nicht verfügbar ist. Für die Feed-Card-Filterung verwendet die Plattformkaskade die Reihenfolge und Wirkung jeder übereinstimmenden Gruppe: Eine spätere übereinstimmende Zulassung/Ausnahme kann ein Element vor Blockierungsprädikaten mit niedrigerer Priorität retten. Dieses Ausnahmeverhalten ist auf die Filteroberfläche der Plattformkarte beschränkt. Eine normale Blockierung einer ganzen Seite wird dadurch nicht rückgängig gemacht.

### 2.2 Aktivierter Zustand

Deaktivierte Gruppen bleiben erhalten, nehmen jedoch nicht an normalen Zuordnungen, Timern, Zeitplänen oder normalen Schlummervorgängen teil. Durch das Deaktivieren einer benutzerdefinierten Gruppe werden auch deren aktive Registrierungen entladen. Durch die erneute Aktivierung wird nicht gespeicherter Text nicht in eine aktive benutzerdefinierte Regel umgewandelt; Führen Sie die Regel aus, um die gespeicherte Quelle zu laden.

### 2.3 Gemeinsame Felder

| Feld | Bedeutung und Einschränkungen |
| --- | --- |
| Name | Nicht leer, gekürzt und eindeutig, ohne Berücksichtigung der Groß-/Kleinschreibung innerhalb dieses Endpunkts. Die Bridge identifiziert verknüpfbare Gruppen auch nach Namen und Typ, daher sind stabile Namen wichtig. |
| Aktiviert | Aktiviert oder deaktiviert den normalen Abgleich. |
| Verhalten | Sofortiges Blockieren, Blockieren nach einer Zeitspanne oder Timer/Hochzählen. Benutzerdefinierte Gruppen verwenden ihre eigene Regel anstelle dieser normalen Verhaltensauswahl. |
| Erlaubte Minuten | Positive Zahl, die vom Block-nach-Zulage-Verhalten verwendet wird. Neue Gruppen dauern standardmäßig 15 Minuten. |
| Intervallstunden zurücksetzen | Positive Zahl, die von zeitgesteuerten normalen Gruppen verwendet wird. Neue Gruppen sind standardmäßig auf 24 Stunden eingestellt. |
| Aktive Tage | Montag bis Sonntag. Eine normale Gruppe ist inaktiv, wenn der aktuelle lokale Wochentag nicht ausgewählt ist. |
| Zeitfenster | Null oder mehr Ortszeitfenster, eines pro Zeile, geschrieben als HHMM-HHMM. |
| Freeze-Modus | „Keine“, „Eingefroren“, „Strikt eingefroren“ oder „Kindersicherung eingefroren“. |
| Schlummerrichtlinie | Ob die Gruppe Schlummern zulässt, mit Steuerung für Dauer/Verzögerung/Abklingzeit/Bestätigung für normale Gruppen. |
| Fallback-URL | Ziel, das verwendet wird, wenn die Gruppe eine Seite blockiert. |
| Weiter zum nächsten | Wenn es im Editor bereitgestellt wird, fordert es den normalen Blockierungsfluss auf, sich am blockierten Ziel vorbei zu bewegen, anstatt darauf zu bleiben. |

### 2.4 Normales Gruppenverhalten

Der normale Editor bietet drei Verhaltensweisen:

| Verhalten | Funktionsergebnis |
| --- | --- |
| Sofort sperren | Sobald die Gruppe aktiv ist und übereinstimmt, wird die normale Seitenblockierungsentscheidung sofort getroffen. |
| Blockierung nach einigen Minuten | Die entsprechende Zeit für die sichtbare Seite wird auf das konfigurierte Kontingent angerechnet. Wenn das Kontingent erschöpft ist, wird die normale Gruppe blockiert, bis ihr Nutzungszeitraum zurückgesetzt wird oder die Gruppe anderweitig inaktiv/gedummert wird. |
| Timer (hochzählen, kein Block) | Die entsprechende sichtbare Seitenzeit wird erfasst und kann angezeigt werden. Dieser Modus blockiert niemals, nur weil sein Timer einen Wert erreicht. |

Die zeitlich festgelegte Nutzung basiert auf der Zeit der sichtbaren Seite. Es ist nicht beabsichtigt, Zeit zu berechnen, während eine Seite in einer Hintergrundregisterkarte ausgeblendet ist. Das Rücksetzintervall ist ein fortlaufendes Richtlinienintervall für die normale zeitgesteuerte Gruppe. Normale Timer sind gruppenunabhängig.

### 2.5 Zeitpläne

Die Zeitpläne gelten für normale Gruppen. Eine benutzerdefinierte Gruppe verfügt über keine normale Zeitplan-Benutzeroberfläche und gilt für JavaScript-Zwecke als aktiv. Die Regel muss selbst jede gewünschte Zeitbedingung auferlegen.

Die Richtlinie für aktive Tage wird anhand der Ortszeit ausgewertet:

1. Wenn der aktuelle Wochentag nicht ausgewählt ist, ist die normale Gruppe inaktiv.
2. Wenn keine gültigen Zeitfenster angegeben werden, bedeutet ein aktiver Tag den ganzen Tag.
3. Wenn gültige Fenster angegeben werden, muss die aktuelle Ortszeit in mindestens einem Fenster stehen.

Jedes Fenster hat die genaue Form HHMM-HHMM, zum Beispiel 0900-1200. Die Stunden müssen zwischen 00 und 23 Uhr liegen, die Minuten zwischen 00 und 59 Uhr, und der Beginn muss vor dem Ende am selben Tag liegen. Ein Fenster schließt seinen Anfang ein und schließt sein Ende aus. Zeitfenster über Mitternacht, z. B. 2300-0100, sind nicht gültig. Leere Zeilen werden ignoriert und doppelte Fenster werden ausgeblendet.

### 2.6 Schlummern

Für eine normale Gruppe ist die Schlummerfunktion ein vorübergehender inaktiver Zustand mit bis zu drei Phasen:

| Phase | Ergebnis |
| --- | --- |
| Ausstehend | Die angeforderte Schlummerfunktion ist vorhanden, wurde jedoch aufgrund der Aktivierungsverzögerung nicht gestartet. Die Gruppe ist immer noch aktiv. |
| Aktiv | Die Gruppe ist während der Schlummerdauer vorübergehend inaktiv. |
| Abklingzeit | Die Schlummerpause ist beendet, die Gruppe ist wieder aktiv und eine weitere Schlummerpause kann erst beginnen, wenn die Abklingzeit abgelaufen ist. |

Konfigurationsfelder für normale Gruppen sind:

| Feld | Regel |
| --- | --- |
| Schlummerfunktion zulassen | Wenn diese Option deaktiviert ist, kann die normale Schlummerfunktion nicht gestartet werden. |
| Schlummerdauer | Positive Minuten. Eine neue normale Gruppe übernimmt den globalen Standardwert, zunächst 30. |
| Aktivierungsverzögerung | Null oder mehr Minuten. Leer bedeutet Null. |
| Abklingzeit | Null bis fünf Minuten. Leer bedeutet Null. |
| Bestätigungen | Eine nicht negative ganze Zahl. Das Produkt erfordert so viele Bestätigungsinteraktionen, bevor der Anfrage stattgegeben wird. |

Eine benutzerdefinierte Gruppe behandelt die Snooze-Schaltfläche nur als Eingabeereignis. Vault gibt das benutzerdefinierte Ereignis mit dem Namen snoozePress für diese Gruppe aus; Es wird nicht der normale Dauer-/Verzögerungs-/Abklingzeit-Fallback im Namen der Regel angewendet. Eine benutzerdefinierte Regel kann das Ereignis, ihre eigene Persistenz, ein Panel, einen Timer oder überhaupt keine Aktion verwenden.

### 2.7 Einfrieren

Das Einfrieren schützt eine Gruppe vor gewöhnlichen Konfigurationsänderungen und vor normalen Snooze-Änderungen. Durch die Auswahl eines Einfriermodus im Selektor wird die Gruppe nicht automatisch eingefroren; Die Einfrieraktion wendet den gewählten Modus an.

| Modus | Funktionsvertrag |
| --- | --- |
| Gefroren | Die Gruppe ist gesperrt, bis der normale Bestätigungsablauf zum Auftauen des Produkts abgeschlossen ist. |
| Streng gefroren | Die Sperrung der Gruppe kann erst wieder aufgehoben werden, wenn die Dauer des strikten Einfrierens abgelaufen ist. Die Dauer muss größer als Null und nicht mehr als 72 Stunden sein; Eine neue Gruppe ist standardmäßig auf 24 Stunden eingestellt. |
| Eltern eingefroren | Für die Freeze/Unfreeze-Verwaltung ist ein Guardian-Passwort erforderlich. Der Konfigurationsdialog verwendet ein sechsstelliges Passwort. |

Eingefrorene Gruppen können nicht über normale Felder bearbeitet werden. Ein über eine Brücke verbundener Cluster mit einem Offline-Mitglied kann auch die Einfrierkontrollen sperren, da Vault den eingefrorenen Zustand im gesamten Cluster nicht sicher koordinieren kann. Freeze ist ein Schutz vor normalen UI-Vorgängen. Es verwandelt ein Browserprofil nicht in eine unveränderliche Sicherheitsgrenze.

### 2.8 Importieren, Exportieren, Löschen und Zurücksetzen

Beim Exportieren wird eine kompatible Darstellung der ausgewählten Gruppe erstellt. Beim Import werden kompatible Gruppendaten validiert und normalisiert, bevor sie hinzugefügt werden. Importierte Gruppennamen müssen weiterhin eindeutig sein. „Gruppe löschen“ entfernt diese Gruppe und ihren normalen Nutzungs-/Schlummerstatus. Clear entfernt alle Gruppen nach der Bestätigung.

Das Zurücksetzen auf die Standardeinstellungen ist ein **globaler Einstellungsvorgang**. Es verwirft erweiterungsweite Präferenzen; Es ist kein Import-/Exportersatz und sollte als destruktiv behandelt werden.

## 3. Gruppentypen und passender Vertrag

### 3.1 Standard-Website-Gruppe

Eine Site-Gruppe besitzt eine durch Zeilen getrennte Website-Liste. Einträge werden in Host-/Domänenform normalisiert. Ein Host-Eintrag entspricht diesem Host und allen seinen Subdomains.

| Einstellung | Ergebnis |
| --- | --- |
| Alles außer diesen Seiten blockieren | Die Liste ist eine Blockliste. Ein passender Host ist blockiert. |
| Blockieren Sie alles außer diesen Websites auf | Die Liste ist eine Zulassungsliste. Jeder Host, der nicht in der Liste enthalten ist, wird blockiert. Eine leere Zulassungsliste ist daher eine absichtliche Sperrung des gesamten Webs. |
| Startseite blockieren | Wendet die Richtlinie der Gruppe auf die konfigurierte Start-/Home-Oberfläche des Browsers an, auf der dieses Steuerelement verfügbar ist. |
| Fallback-URL | Umleitungsziel für einen Block. Bei einem leeren Gruppenwert wird auf den globalen Standardwert zurückgegriffen. |

Die normale Site-Gruppen-Domänenliste ist die einzige deklarative Liste der gesamten Site, die vom Editor bereitgestellt wird. Plattformgruppen stimmen stattdessen mit ihrer eigenen Plattform und den konfigurierten Plattformbedingungen überein.

### 3.2 Videoplattform-Gruppen

YouTube, TikTok, Facebook, Instagram und Twitch sind Videoplattformgruppen. Jeder ist auf seinen eigenen Plattformhost beschränkt. Eine Gruppe kann auf Inhaltsform, Autoren-/Kontobereich, den Home-Feed der Plattform und optionale Steuerelemente zum Ausblenden von Elementen abzielen.

Die allgemeinen Autorenmodi sind:

| Modus | Ergebnis |
| --- | --- |
| Alle | Beschränken Sie sich nicht auf den Autor. Andere konfigurierte Achsen entscheiden über die Übereinstimmung. |
| Einschließen | Passen Sie nur die aufgelisteten normalisierten Ersteller/Konten an. |
| Ausschließen | Alle erkannten Ersteller/Konten außer den aufgelisteten Einträgen abgleichen. |
| Niemand | Entspricht keinem Autor. Dies ist eine absichtliche No-Match-Autorenachse. |
| Tag include | Ordnen Sie Ersteller jedem aufgelisteten Tag zu, wenn Vault sie klassifizieren kann. Unbekannte/nicht klassifizierte Ersteller können nicht geöffnet werden. |
| Tag ausschließen | Ordnen Sie Ersteller ohne die konfigurierten Tags zu, wenn Vault sie klassifizieren kann. Unbekannte/nicht klassifizierte Ersteller können nicht geöffnet werden. |

Die Auswahlmöglichkeiten für die Inhaltsform sind plattformspezifisch:

| Plattform | Inhaltsformulare |
| --- | --- |
| YouTube | Alle Seiten, Shorts, lange Videos, Beiträge. |
| TikTok | Alle Seiten, kurze Videos. |
| Facebook | Alle Seiten, Reels, Videos, Beiträge. |
| Instagram | Alle Seiten, Reels, Videos, Beiträge. |
| Zucken | Alle Seiten, Clips, Streams/VODs, Kanalseiten. |

Vault normalisiert die Autoreneingabe. Der Herausgeber akzeptiert das normale Handle-/Kanal-/Seitenformular der Plattform und die unterstützten Profil-URLs. Es kann fehlerhafte Einträge ablehnen oder sie als ungültig anzeigen, anstatt sie stillschweigend in ein anderes Ziel umzuwandeln.

Die Auswahlmöglichkeiten zum Ausblenden der Oberfläche sind unabhängig von der Blockierung auf oberster Ebene. Sie wirken sich nur auf die Benutzeroberfläche der aktuellen Plattform aus und funktionieren möglicherweise nicht mehr, wenn die Plattform ihr Markup ändert.

| Plattform | Auswahlmöglichkeiten für ausgeblendete Elemente |
| --- | --- |
| YouTube | Shorts-Navigation/Regale/Karten, beworbene Home-Feed-/Werbeflächen und Kommentare. Bei der werbebezogenen Option wird eine Warnung angezeigt, da das Ausblenden von Anzeigen möglicherweise im Widerspruch zu den Bedingungen einer Plattform steht. |
| TikTok | Entdecken Sie die Navigation. |
| Facebook | Rollennavigation und Rollenoberflächen. |
| Instagram | Rollen und Navigation/Oberflächen erkunden. |
| Zucken | Navigation durchsuchen. |

Der YouTube-Ersteller-Tag-Abgleich verwendet lokale/verfügbare Kanalklassifizierungen. Eine fehlende Klassifizierung wird nicht zu einem Block, nur weil ein Tag-Modus ausgewählt wurde.

### 3.3 Reddit

Eine Reddit-Gruppe gilt nur für Reddit. Seine Entität ist ein Subreddit. Subreddit-Eingaben akzeptieren die normale Community-Form und normalisieren sie vor dem Abgleich.

Die Subreddit-Modi sind:

| Modus | Ergebnis |
| --- | --- |
| Alle | Bewerben Sie sich bei Reddit ohne Einschränkung durch Subreddit-Listen. |
| Einschließen | Bewerben Sie sich auf die aufgeführten Subreddits. |
| Ausschließen | Auf alle außer den aufgeführten Subreddits anwenden. |
| Niemand | Bewerben Sie sich auf keinen Subreddit. |

Die mitgelieferte Option zum Ausblenden der Oberfläche blendet die Navigation „Beliebt/Alle“ aus. Das Verhalten der Feed-Karten hängt von der aktuell erkennbaren Kartenstruktur von Reddit ab.

### 3.4 Zwietracht

Eine Discord-Gruppe gilt nur für Discord-/Discordapp-Seiten. Sein Ziel ist eine Server-ID oder ein Server/Kanal-Paar. Der Zieleditor akzeptiert normalisierte Discord-Kanalpfadwerte.

| Modus | Ergebnis |
| --- | --- |
| Alle | Bewerben Sie sich bei Discord ohne Einschränkung der Zielliste. |
| Einschließen | Nur auf aufgeführte Server- oder Server-/Kanalziele anwenden. |
| Ausschließen | Auf alle außer den aufgeführten Zielen anwenden. |
| Niemand | Auf kein Ziel anwenden. |

Discord verfügt derzeit im normalen Plattformprofil über keine ausgelieferte Option zum Ausblenden von Elementen.

### 3.5 Twitter / X

Auf X/Twitter gilt eine Twitter/X-Gruppe. Es kann für alle Konten gelten oder die für Videoplattformen beschriebenen allgemeinen Kontomodi mit normalisierter Handle-/Profil-Link-Eingabe verwenden.

Die mitgelieferten Optionen zum Ausblenden von Elementen sind „Erkunden“, „Nachrichten“, „Grok“, „Trends“ und „beworbene Feed-Elemente“. Wie bei allen selektorbasierten Oberflächensteuerelementen kann sich eine X-Markup-Änderung auf deren Betrieb auswirken.

### 3.6 Benutzerdefinierte deklarative Gruppenfelder

Eine benutzerdefinierte Gruppe führt hauptsächlich ihre JavaScript-Quelle aus. Es wird weder die normale Verhaltensauswahl noch die normale Zeitplan-Benutzeroberfläche verwendet. Es kann dennoch eine Domänenliste enthalten, wenn es importiert oder über kompatible Daten konfiguriert wird:

- Eine nicht leere benutzerdefinierte Sperrliste kann an der normalen Entscheidung über eine ganze Seite teilnehmen.
– Eine benutzerdefinierte Zulassungsliste kann auch dann teilnehmen, wenn sie leer ist, was zu einer deklarativen Sperrung des gesamten Webs führt.
- Eine nicht konfigurierte benutzerdefinierte Gruppe blockiert nicht versehentlich Seiten, nur weil sie eine Regel hat;
- Benutzerdefinierte Timer blockieren nie von selbst; Eine Regel entscheidet explizit, ob blockiert werden soll, wenn ein Timer abläuft.

## 4. Globale Einstellungen

Globale Einstellungen gelten für die Erweiterung und nicht für eine Gruppe.

| Einstellung | Standard | Verhalten |
| --- | --- | --- |
| Tick-Rate | 1000 ms | Häufigkeit des freigegebenen benutzerdefinierten tickEvents. Der gültige Bereich liegt zwischen 250 und 60.000 ms. Niedrigere Werte können dazu führen, dass ereignisgesteuerte Regeln schneller reagieren, aber mehr CPU verbrauchen. |
| Autosave-Entprellung | 400 ms | Verzögerung nach der letzten Editor-Änderung, bevor die normalen Einstellungen beibehalten werden. Das Maximum beträgt 5.000 ms. |
| Debug-Modus | Aus | Aktiviert die ausführliche Trace-Ausgabe nach benutzerdefinierten Regeln und die On-Page-Debug-Protokollüberlagerung. Es steuert nicht, ob die normalen Protokollaufrufe einer Regel das Popup-Protokoll erreichen. |
| Benutzerdefinierte Regelprotokolle auf Webseiten anzeigen | Auf | Steuert normale Seitenprotokoll-Toasts. Regelautoren können weiterhin explizit eine Nur-Bildschirm- oder Nur-Popup-Ausgabe anfordern. |
| Standard-Schlummerdauer | 30 Minuten | Startwert, der beim Erstellen neuer normaler Gruppen verwendet wird. Bestehende Gruppen behalten ihre eigene Dauer. |
| Standard-Fallback-URL | about:blank | Wird verwendet, wenn eine blockierende Gruppe keine gruppenspezifische Fallback-URL hat. |
| Helfen Sie bei der Klassifizierung von Erstellern | Aus | Explizites Opt-in. Es sendet gefundene YouTube-Kanal-IDs nur an den konfigurierten Klassifizierungsdienst; Es werden weder Titel noch der Wiedergabeverlauf gesendet. |
| Lokaler Dateiordner | Keine | Optionale Ordnerfunktion für benutzerdefinierte Regeln. Siehe Abschnitt 9. |
| Web-App-Brücke | Aus | Optionale Verbindung zu einem kompatiblen lokalen Vault-Hub. Siehe Abschnitt 11. |

### 4.1 Editoroberfläche und Feedbackoberflächen

Der Erweiterungseditor verfügt über eine persistente Gruppenliste und einen Editor für ausgewählte Gruppen. Die Gruppenliste stellt die Gruppentypauswahl, Hinzufügen, Löschen, Auswählen, Aktivieren des Umschaltens und Ziehen der Reihenfolge bereit. Der Teiler ist in der Größe veränderbar. Der Editor für ausgewählte Gruppen stellt gruppenspezifische Felder und die Gruppen-Export-/Importaktionen bereit.

Der Editor speichert gewöhnliche Feldänderungen nach der globalen Entprellzeit automatisch. Validierungsfehler werden als Status-/Toast-Feedback gemeldet; Ungültige Normalwerte werden nicht stillschweigend in unabhängige Einstellungen umgewandelt. Eine eingefrorene Gruppe deaktiviert ihre normalen Bearbeitungssteuerelemente.

Die Erweiterung verfügt außerdem über diese für den Benutzer sichtbaren Feedbackoberflächen:

| Oberfläche | Funktioneller Zweck |
| --- | --- |
| Bedienungsanleitung | Öffnet diese Referenz in der Erweiterung. |
| Sprachauswahl | Wählt die Sprache der Erweiterungsschnittstelle aus. |
| Einstellungen | Öffnet die oben beschriebenen globalen Einstellungen. |
| Status-/Toast-Feedback | Speichern, Importieren, Validieren und Aktionsergebnisse von Berichten. |
| On-Page-Timer-Overlay | Zeigt aktive normale Timer-/Countdown-Elemente und benutzerdefinierte Timer an, die sich in ihrem Anzeigebereich befinden. Es können mehrere Elemente nebeneinander existieren. |
| On-Page-Protokolloberfläche | Empfängt benutzerdefinierte Protokoll-, Warn- und Fehleraufrufe, wenn dies durch globale Einstellungen zulässig ist. |
| Benutzerdefiniertes Protokoll | Ein Live-Aktivitätsprotokoll für durch Regeln erstellte Popup-sichtbare Einträge. Es kann gelöscht und heruntergeladen werden. |

Für benutzerdefinierte Gruppen speichert das Feld „Regeln“ den Quelltext. „Zuerst ausführen“ führt den Regelsyntax-Preflight durch und lädt die Quelle erst, wenn dies erfolgreich ist. Der Editor führt bei Textänderungen auch lokales Quell-Linting durch. Das sichtbare Steuerelement **Let AI Code** öffnet ein Eingabeaufforderungsfeld und kopiert ein Codegenerierungspaket, das die Anfrage des Benutzers, die aktuelle Regel und einen generierten Verweis auf die aktuelle API für benutzerdefinierte Regeln enthält. Es kontaktiert keinen KI-Dienst und ändert die Regel nicht automatisch.

Das Templates-Steuerelement öffnet den Vorlagenbrowser. Wenn eine Vorlage versendet wird, verfügt sie über einen Titel, eine Beschreibung, Tags, Parameter und eine generierte Vorschau. Durch die Anwendung wird nach der Bestätigung der aktuelle Regeltext ersetzt. Der aktuell ausgelieferte Vorlagenkatalog ist leer; Der Browser bleibt für zukünftige kuratierte Vorlagen verfügbar und darf nicht als Quelle aktiver Regeln behandelt werden.

## 5. Benutzerdefinierte Regelsprache

### 5.1 Regelquellenformulare

Die Quelle einer benutzerdefinierten Gruppe ist JavaScript. Beim **Ausführen** entfernt Vault die vorherigen Registrierungen und den Status der Gruppe, die von der vorherigen aktiven Quelle erstellt wurden, und lädt dann die neue Quelle.

Die Quelle kann entweder sein:

1. a function expression accepting events and helpers; or
2. reine Anweisungen, die die bereitgestellten Ereignisse (oder Legacy-Ereignisse) und Hilfsvariablen verwenden.

```js
// Function-expression form
(events, helpers) => {
  events.on("openWebEvent", "welcome", (event, h) => {
    h.log("Opened", event.url);
  });
}
```

```js
// Bare-statement form
events.on("openWebEvent", "welcome", (event, h) => {
  h.log("Opened", event.url);
});
```

„Run“ führt die JavaScript-Syntax-/Preflight-Prüfung durch und aktiviert erst bei Erfolg die aktuelle Quelle. Das Speichern von Text und der Fließtext unterscheiden sich bewusst: Eine Regel kann gespeichert werden, ohne zur aktiven Ereignisquelle zu werden.

Die aktive Quelle wird entladen, wenn die benutzerdefinierte Gruppe erneut ausgeführt, deaktiviert, gelöscht oder explizit gestoppt wird. Durch die erneute Ausführung werden die Handler, Timer, Panels, der Persistenz-Bucket und die von der Regel erstellten Plattformprädikate der Regel gelöscht, bevor die Registrierung beginnt. Eine Sandbox-Wiederherstellung kann die aktive Quelle neu laden; Regelautoren müssen daher die Registrierung idempotent machen.

### 5.2 Ausführungsmodell und sichere Annahmen

Custom rules are event registrations, not a continuous script loop. Register handlers during rule initialization, then respond to events.

Jeder Handler erhält:

```js
(event, helpers) => {
  // event: the currently dispatched event object
  // helpers: the public Vault Custom-rule API
}
```

Handler für ein Ereignis, das nach absteigender numerischer Priorität ausgeführt wird; Bei gleicher Priorität wird die Registrierungsreihenfolge verwendet. Ein Handler kann ersetzt werden, indem der gleiche Ereignistyp und die gleiche ID erneut registriert werden. Es gibt maximal 1.000 registrierte Handler für eine benutzerdefinierte Gruppe.

Vault begrenzt die aktive Arbeit eines Handlers auf etwa eine Sekunde. Drei Fristüberschreitungen für dieselbe Gruppe innerhalb einer Minute stellen die Regel unter Quarantäne: Vault deaktiviert sie, anstatt wiederholt einen problematischen Handler auszuführen. Verwenden Sie keine Busy Waits, unbegrenzte Schleifen, synchrone Abfragen oder eine große Anzahl von Mutationen/Protokollen pro Ereignis.

Pro Versand akzeptiert Vault höchstens:

| Artikel | Maximal |
| --- | --- |
| Regelprotokolleinträge | 200 |
| Gepostete Ereignisse | 64 |
| DOM-Operationen | 256 |
| Aktion/Absichten | 256 |
| Panels pro Gruppe | 24 |
| Steuerelemente in einem Panel | 32 |
| Optionen in Auswahl/Funksteuerung | 64 |

Überschüssige Protokoll-, gepostete Ereignis-, DOM-Vorgangs- und Absichtseinträge können gelöscht werden. Eine benutzerdefinierte Regel darf nicht davon abhängen, dass überschüssige Einträge übermittelt werden.

### 5.3 Integrierte Ereignistypen

Die folgenden Ereignistyp-Strings sind integriert. Eine Regel kann auch einen eigenen, nicht leeren Typ-String verwenden, solange dieser nicht mit einem Unterstrich beginnt.

| Ereignistyp | Wenn es gesendet wird | Wichtige Daten |
| --- | --- | --- |
| tickEvent | Gemeinsamer periodischer Tick mit der globalen Tick-Rate-Einstellung. | Aktueller Seiten-/Tab-Kontext, sofern verfügbar. Verwenden Sie die Registrierungsoption „intervallMs“, um die Rate eines einzelnen Handlers zu begrenzen. |
| openWebEvent | Für die Regel wird eine Seite der obersten Ebene verfügbar. | URL, Hostname, Tab-/Seiten-IDs, Uhrzeit. |
| closeWebEvent | Eine Seite/Registerkarte der obersten Ebene wird geschlossen. | URL/Hostnamen-Kontext, sofern verfügbar. |
| webChangedEvent | Eine engagierte Top-Level-Navigation, einschließlich Neuladen über dieselbe URL. | Daten tragen vorherige URL/Hostnamen und Navigationsflags wie isFirstLoad, isReload und sameDomain. |
| timerEnded | Ein benutzerdefinierter Timer wechselt in den abgelaufenen Zustand. | Daten: timerId, displayName, Richtung, currentMs. Es wird nur an die Besitzergruppe des Timers geliefert. |
| snoozePress | Der Benutzer drückt „Schlummer starten“ für diese benutzerdefinierte Gruppe. | Die Regel ist Eigentümer der Antwort. Es wird kein normales Schlummer-Fallback durchgeführt. |
| PanelEvent | Ein gerendertes benutzerdefiniertes Bedienfeld verfügt über eine Interaktion. | Daten- und Komfortfelder umfassen Panel-/Steuerungs-/Ereignis-/Wertinformationen. |
| localFileEvent | Eine angeforderte lokale Dateiaktion wird abgeschlossen. | Zu den Daten- und Komfortfeldern gehören „RequestId“, „Pfad“, „Ergebnis“, „Bytes“, „Einträge“ und „Fehler“. |
| pageHeartbeatEvent | Ein Heartbeat der sichtbaren Seite, etwa alle 250 ms, während die Registerkarte sichtbar ist. | elapsedMs ist die verstrichene Zeit der sichtbaren Seite. Benutzerdefinierte Timer mit Gültigkeitsbereich verwenden es automatisch, auch ohne einen registrierten Handler. |

### 5.4 Ereignisregistrierungs-API

Das erste Argument für eine Quelle im Funktionsstil ist die Ereignisregistrierung. In Bare-Statement-Quellen beziehen sich sowohl „events“ als auch „event“ auf diese Registrierung.

| Methode | Vertrag |
| --- | --- |
| events.on(type, id, handler, options) | Register a handler. Returns true when accepted, false for invalid/capped registrations. |
| events.register(type, id, handler, options) | Alias of on. |
| events.off(type, id) | Unregister a handler. Returns whether something was removed. |
| events.unregister(type, id) | Alias of off. |
| events.unregisterAll(type) | Remove all handlers owned by this group for that event type. Returns the number removed. |
| events.getEvent(type, id) | Return the registered function for this group/id, or null. |
| events.getEvents(type) | Return an object mapping this group's handler ids to functions. |
| events.countRegistered(type) | Return this group's number of registrations for type. |
| events.emit(type, data, options) | Queue a synthetic event. |
| events.post(type, data, options) | Alias of emit. |

Das optionale Handler-Optionsobjekt unterstützt:

| Option | Bedeutung |
| --- | --- |
| Priorität | Numerische Reihenfolge. Höhere Werte werden vor niedrigeren Werten ausgeführt. Standard 0. |
| IntervallMs | Positive Zahl. Nur für tickEvent: Unterdrückt Aufrufe, bis diese Zeit seit dem vorherigen Aufruf des Handlers vergangen ist. |

Synthetische Ereignisse haben standardmäßig den Gruppenbereich: Nur Handler, die zur emittierenden Gruppe gehören, empfangen sie. Verwenden Sie {scope: "global" }, um das Ereignis an jede Regel zu senden, die denselben Typ registriert hat. Verwenden Sie in einem Ereignisnamen keinen führenden Unterstrich; es ist reserviert.

### 5.5 Ereignisobjekt

Jeder Handler erhält ein veränderbares Ereignisobjekt mit gemeinsamen Feldern:

| Feld/Methode | Vertrag |
| --- | --- |
| Typ | Ereignistypzeichenfolge. |
| Gruppen-ID | Benutzerdefinierte Gruppen-ID des Empfängers. |
| tabId, pageId | Browser-IDs, sofern verfügbar; andernfalls null. |
| URL, Hostname | Aktuelle URL und Hostname der obersten Ebene oder leere Zeichenfolgen. |
| Zeit | Kopie des Versandzeitobjekts oder null. |
| Daten | Ereignisspezifische Nutzlast oder null. |
| verhindernDefault() | Markiert den Versand als Seitenblockierungsaktion. Die Seite wird zum aktuellen Weiterleitungslink/-ergebnis umgeleitet, falls vorhanden. Andernfalls verwendet Vault den normalen Exit-/Fallback-Pfad. |
| stopPropagation() | Stoppt spätere Handler für den aktuellen Ereignisversand. |
| setResult(value) | Speichert ein Zahlen- oder Zeichenfolgenergebnis. Eine nicht leere Zeichenfolge wird als Umleitungsziel behandelt. Ergebnis 1 unterdrückt ein ansonsten akkumuliertes präventDefault-Ergebnis. |
| getResult() | Gibt die Ergebnismenge dieses Ereignisobjekts oder null zurück. |
| Beitrag(Typ, Daten, Optionen) | Stellen Sie ein synthetisches Ereignis mit denselben Bereichsregeln wie Events.post in die Warteschlange. |
| setRedirectLink(url) | Legen Sie die Weiterleitungs-URL für diesen Versand fest. Gibt nur für eine Nicht-String-Eingabe „false“ zurück. |
| getRedirectLink() | Lesen Sie die Weiterleitungs-URL dieses Versands oder eine leere Zeichenfolge. |
| close(id) | Fordern Sie das Schließen eines Tabs an. Eine Zahl ist eine Tab-ID, eine Zeichenfolge identifiziert eine URL und ein weggelassener Wert zielt auf den aktiven Tab ab. |
| block(id) | Fügen Sie ein dynamisches Site-Block-Muster nur für die Sitzung hinzu. Wenn keine Zeichenfolgen-ID vorhanden ist, verwenden Sie den Hostnamen des Ereignisses. |
| entsperren(id) | Entfernen Sie ein dynamisches Site-Blockierungsmuster nur für die Sitzung. Wenn keine Zeichenfolgen-ID vorhanden ist, verwenden Sie den Hostnamen des Ereignisses. |
| open() | No-op in der Browsererweiterung. Es können keine Anwendungen gestartet werden. |

Ein Handler kann dem Ereignis beliebige zusätzliche Eigenschaften hinzufügen. Lesen Sie sie über event.custom oder direkt über den zugewiesenen Namen, während das Ereignisobjekt aktiv ist. Sie sind kein persistenter Zustand und keine ereignisübergreifende Speicherung.

Für „panelEvent“ werden diese praktischen Felder hinzugefügt: „panelId“, „controlId“, „eventName“, „value“, „values“, „key“, „code“ und „keyInfo“.

Für „localFileEvent“ werden diese praktischen Felder hinzugefügt: „eventName“, „action“, „path“, „directoryPath“, „requestId“, „ok“, „text“, „value“, „entrys“, „exists“, „bytes“ und „error“.

### 5.6 Helfer-Einstiegspunkte

Das Helferobjekt hat diese direkten Eigenschaften:

| Einstiegspunkt | Bedeutung |
| --- | --- |
| helpers.now | Current dispatch timestamp in milliseconds. |
| helpers.currentUrl | Current unmodified URL string for this dispatch. |
| helpers.groupId | Owning Custom-group id. |
| helpers.log / warn / error | Direct aliases for the log helper. |
| helpers.logScreen / warnScreen / errorScreen | Direct aliases for screen-only logs. |
| helpers.logPopup / warnPopup / errorPopup | Direct aliases for popup-only logs. |
| helpers.getLogHelper() | Returns the log helper. |
| helpers.getDomainHelper(), getDomainUtility() | Return the domain helper. |
| helpers.getTimerHelper() | Returns the timer helper. |
| helpers.getPanelHelper() | Returns the panel helper. |
| helpers.getPersistenceHelper() | Returns the persistence helper. |
| helpers.getRedirectionHelper() | Returns the redirect helper. |
| helpers.getDOMHelper() | Returns the DOM helper. |
| helpers.getNavigationHelper() | Returns the navigation helper. |
| helpers.getStorageHelper() | Returns the persistence plus asynchronous storage helper. |
| helpers.getLocalFolderHelper() | Returns the optional local-folder helper. |
| helpers.getTabHelper() | Returns the tab-snapshot helper. |
| helpers.getWindowHelper() | Returns the browser-tab/window helper. |
| helpers.getPlatformHelper() | Returns the platform-helper collection. |
| helpers.platform() | Returns the platform-helper collection. |
| helpers.platform(name) | Returns the named raw platform API. Valid names: youtube, tiktok, facebook, instagram, twitch. |

## 6. Benutzerdefinierte Hilfsreferenz

### 6.1 Domain-Helfer

Get it with helpers.getDomainHelper(). It is also available as helpers.getDomainUtility().

| Methode | Rückkehr und Verhalten |
| --- | --- |
| hostnameOf(url) | Normalisierter Host in Kleinbuchstaben ohne führendes www. oder Null für eine ungültige URL. |
| pathnameOf(url) | URL-Pfadname oder /, wenn die URL nicht analysiert werden kann. |
| entspricht(Hostname, Site) | True, wenn der Hostname der Site entspricht oder deren Subdomain ist. |
| getPlatform(url) | YouTube, Tiktok, Instagram, Facebook, Twitch oder Null. |
| isYouTubeHost(host), isTikTokHost(host), isInstagramHost(host), isFacebookHost(host), isTwitchHost(host), isRedditHost(host), isDiscordHost(host) | Host-Klassifikatoren. |
| youtube(), tiktok(), instagram(), facebook(), twitch() | Gibt das URL-Klassifizierungsobjekt dieser Plattform zurück. |
| isEmptyStartPage(url) | True für die vom Browser unterstützten URLs für leere/neue Tabs/Startseiten. |
| matchesAny(url, patterns) | Vergleichen Sie eine URL mit einem RegExp, einem RegExp-Array oder als reguläre Ausdrücke kompilierten Zeichenfolgen. Ungültige Zeichenfolgenmuster werden ignoriert. |
| pathStartsWith(url, path) | True für einen exakten Pfad oder einen Nachkommen des Pfads. Ein fehlender führender Schrägstrich wird angegeben. |
| queryHas(url, key, value) | True, wenn ein Abfrageschlüssel vorhanden ist; Wenn ein Wert angegeben wird, muss dieser auch dem Zeichenfolgenwert entsprechen. |
| queryGet(url, key) | Abfragewert oder Null. |
| isSearchPage(url) | Erkennt unterstützte Such-URLs von Google, Bing, DuckDuckGo, YouTube, Reddit und X/Twitter. |
| isInfiniteFeedUrl(url) | Erkennt unterstützte Flächen mit unendlichem Vorschub. |
| sameSection(a, b) | Nur wahr, wenn beide URLs einen Host und das erste Pfadnamensegment gemeinsam nutzen. |

Jedes Plattform-URL-Klassifizierungsobjekt macht isPlatformUrl(url), isShortUrl(url), isVideoUrl(url), isPostUrl(url), isHomePage(url), extractAuthor(url) und extractVideoId(url) verfügbar. Eine Methode kann false/null zurückgeben, wenn die URL gültig ist, diese Art von Inhalt jedoch nicht identifiziert.

### 6.2 Timer-Helfer

Get it with helpers.getTimerHelper(). Timers are rule-owned counters. They may be displayed in Vault's page overlay, but they never block on their own.

Optionen zum Erstellen/Abrufen:

| Option | Bedeutung |
| --- | --- |
| id | Erforderliche nicht leere Timer-ID. |
| Anzeigename | Für Menschen lesbares Overlay-Label. |
| Richtung | vorwärts zum Hochzählen; Jeder andere Wert wird rückwärts/Countdown. |
| currentMs | Anfängliche Millisekunden, auf Null begrenzt und begrenzt, falls Grenzen vorhanden sind. |
| minMs, maxMs | Optionale positive Mindest-/Höchstgrenzen. |
| Stiefmutter | Optionaler positiver Quantisierungsschritt für verstrichene Ticks. |
| overlayStyle | Optionale Zeichenfolgen für Farbe, Hintergrund, FontSize, FontWeight, Rahmen, BorderRadius, Innenabstand, Deckkraft und Symbol. Nicht unterstützte/ungültige Teile werden gelöscht. |
| Umfang(URL) | Prädikat, das entscheidet, wo die Zeit für die sichtbare Seite anfällt. |
| Domain(URL) | Prädikat, das entscheidet, wo der Timer im Overlay angezeigt wird; Der Standardwert ist der Bereich. |
| accrueWhen(url) | Optionales zusätzliches Prädikat. Zeit fällt nur an, wenn sowohl „scope“ als auch „accrueWhen“ wahr sind. |

| Methode | Verhalten |
| --- | --- |
| erstellen(Optionen) | Erstellt/ersetzt einen Timer und setzt seinen Status zurück. Gibt eine ID oder Null zurück. |
| getOrCreateTimer(optionen) | Nur erstellen, wenn nicht vorhanden. Der bestehende Zustand bleibt unverändert. Gibt eine ID oder Null zurück. |
| delete(id) | Entfernen Sie den Timer und seine Gültigkeits-/Anzeigeprädikate. |
| pause(id), resume(id) | Angehaltenen Status ändern. Geben Sie nur dann „true“ zurück, wenn eine Zustandsänderung möglich ist. |
| setDirection(id, Richtung) | Vorwärts oder rückwärts einstellen. |
| setCurrentMs(id, ms) | Legen Sie die absolute Anzahl fest, um Grenzen durchzusetzen. |
| addMs(id, deltaMs), subMs(id, deltaMs) | Passen Sie die Anzahl an und erzwingen Sie die Grenzen. |
| setBounds(id, minMs, maxMs) | Setzen Sie positive Grenzen; Übergeben Sie null für eine Bindung, um es zu entfernen. |
| setStep(id, stepMs) | Stellen Sie eine positive Tick-Quantisierung ein. Übergeben Sie null oder null, um es zu löschen. |
| setOverlayStyle(id, style) | Ersetzen/löschen Sie zulässige Overlay-Stile. |
| setDisplayName(id, name) | Overlay-Label festlegen. |
| getCurrentMs(id) | Zahl, Null für einen abwesenden Timer. |
| isExpired(id) | Nur wahr, wenn ein Timer vorhanden ist und currentMs Null ist. |
| isPaused(id) | Boolescher Wert. |
| getDirection(id), getDisplayName(id) | Richtung/Name oder null. |
| existiert(id) | Boolescher Wert. |
| getState(id) | Serialisierbarer Timer-Snapshot oder null. |
| list() | Serialisierbares Array von Timer-Snapshots. |

Bereichsprädikate werden gespeichert, während die benutzerdefinierte Quelle geladen bleibt. Vault treibt passende Timer während sichtbarer pageHeartbeatEvent-Zyklen voran, einen Tick pro Timer und Versand. Ein Rückwärtstimer stoppt bei Null und gibt beim Übergang zu Null timerEnded aus. Er bleibt Null, bis die Regel ihn ändert/zurücksetzt. Verwenden Sie einen Timer-Ende-Handler, um zu entscheiden, ob ein abgelaufener Timer „preventDefault“ aufrufen, eine Umleitung festlegen oder eine andere Aktion ausführen soll.

### 6.3 Persistenter und asynchroner Speicher

Get the synchronous persistence helper with helpers.getPersistenceHelper(). Values must be JSON-serializable. A group can store at most 200 keys and each serialized value is limited to 16 KiB.

| Methode | Verhalten |
| --- | --- |
| get(key, defaultValue) | Liest einen geklonten Wert oder Standardwert. |
| set(Schlüssel, Wert) | Speichern Sie einen JSON-sicheren Klon. Gibt „false“ zurück, wenn der Schlüssel/Wert ungültig ist oder die Tastenbelegung erschöpft ist. |
| delete(key) | Vorhandenen Schlüssel löschen; gibt zurück, ob es existierte. |
| hat(Schlüssel) | Boolescher Wert. |
| Schlüssel() | Array von Schlüsseln. |
| Einträge() | Array geklonter [Schlüssel, Wert]-Paare. |
| klar() | Löschen Sie die gesamte Regelpersistenz für diese Gruppe. |
| size() | Anzahl der Schlüssel. |

helpers.getStorageHelper() exposes all the preceding methods and two asynchronous request methods:

| Methode | Verhalten |
| --- | --- |
| requestAsyncGet(key) | Fordern Sie einen asynchronen Speicherlesevorgang an. Gibt true zurück, wenn es in die Warteschlange gestellt wird. Verwenden Sie ein späteres Ereignis/Ihren eigenen Statusfluss, um zu reagieren. es ist kein synchroner Getter. |
| requestAsyncSet(key, value) | Fordern Sie einen asynchronen JSON-sicheren Speicher an. Gibt true zurück, wenn es in die Warteschlange gestellt wird. |

Die Regelpersistenz wird beim Ausführen gelöscht, da eine neue aktive Quelle mit einem sauberen benutzerdefinierten Regelstatus beginnt.

### 6.4 Protokollierungshilfe

Get it with helpers.getLogHelper(). Every method accepts any number of values.

| Methode | Ziel |
| --- | --- |
| Protokoll, Warnung, Fehler | Popup-Aktivitätsprotokoll; Seiten-Toast, wenn globale Seitenprotokoll-Toasts aktiviert sind. |
| logScreen, warnScreen, errorScreen | Nur Seiten-Toast/Debug-Oberfläche; vom Popup-Protokoll ausgeschlossen. |
| logPopup, warnPopup, errorPopup | Nur Popup-Aktivitätsprotokoll; vom Seitentoast ausgeschlossen. |

Protokolle versuchen auch, die Browserkonsole mit einem CustomBlocker-Gruppenpräfix zu erreichen. Dies ist eine Diagnoseausgabe, keine Persistenz-API. Verwenden Sie den Persistenzhelfer für den Status.

### 6.5 Redirect-Helfer

Get it with helpers.getRedirectionHelper().

| Methode | Verhalten |
| --- | --- |
| get(), getRedirectLink() | Gibt die aktuelle Weiterleitungs-URL für den Versand oder eine leere Zeichenfolge zurück. |
| set(url), setRedirectLink(url) | Legen Sie die Weiterleitungs-URL für den aktuellen Versand fest. |
| createMessageUrl(Nachricht) | Erstellen Sie eine erweiterungslokale Nachrichtenseiten-URL, die die bereitgestellte Nachricht anzeigt. |

Durch das alleinige Festlegen einer Weiterleitung wird die Navigation nicht erzwungen. Kombinieren Sie es mit event.preventDefault() oder legen Sie über event.setResult() eine nicht leere Zeichenfolge fest, je nach gewünschtem Regelablauf.

### 6.6 DOM-Helfer

Get it with helpers.getDOMHelper(). These actions are queued and applied to the current page. Selectors must be valid for the page browser; malformed selectors or elements that do not exist can produce no visible result.

| Methode | Angeforderte Maßnahme |
| --- | --- |
| hide(selector), show(selector) | Passende Elemente ein-/ausblenden. |
| addClass(selector, className), removeClass(selector, className) | CSS-Klasse mutieren. |
| setText(selector, text) | Ersetzen Sie Textinhalte. |
| click(selector) | Klicken Sie auf das übereinstimmende Element. |
| injectCss(css, id) | Fügen Sie einen identifizierten CSS-Block hinzu. |
| removeInjectedCss(id) | Entfernen Sie einen zuvor identifizierten injizierten CSS-Block. |
| scrollTo(selector) | Scrollen Sie durch ein übereinstimmendes Element, um es anzuzeigen. |

DOM-Aktionen bieten kein uneingeschränktes Seitenskripting. Sie sind eine begrenzte Aktionsoberfläche und sollten idempotent sein, wenn sie von Heartbeat-/Tick-Handlern verwendet werden.

### 6.7 Navigation, Tabs und Browserfenster-Hilfe

Get navigation with helpers.getNavigationHelper().

| Methode | Angeforderte Maßnahme |
| --- | --- |
| zurück() | Navigieren Sie zur aktuellen Registerkarte zurück. |
| vorwärts() | Navigieren Sie in der aktuellen Registerkarte vorwärts. |
| reload() | Aktuellen Tab neu laden. |
| goTo(url) | Navigieren Sie auf der aktuellen Registerkarte zur URL. |
| closeTab() | Aktuelle Registerkarte schließen. |

Get a snapshot helper with helpers.getTabHelper().

| Methode | Rückgabe/Aktion |
| --- | --- |
| list() | Kopie des aktuellen Tab-Snapshots. |
| getActiveTab() | Aktiver Tab-Snapshot oder null. |
| getById(id) | Übereinstimmender Tab-Snapshot oder null. |
| countOpen() | Anzahl der Registerkarten im Snapshot. |
| requestRefresh() | Fordern Sie einen neuen Tab-Snapshot für spätere Regelarbeiten an. |

Get the browser-tab/window helper with helpers.getWindowHelper(). In the extension, a "window" is represented by browser tabs.

| Methode | Verhalten |
| --- | --- |
| current() | Aktuell aktives Tab-Objekt: ID, URL, Hostname, Titel, isBrowser. |
| all() | Array von Tab-Objekten mit ID, URL, Hostname, Titel, aktiv. |
| close(idOrUrl) | Wird mit numerischer Tabulator-ID, genauer URL-Zeichenfolge oder aktivem Tab geschlossen, wenn dieser Wert weggelassen wird. |
| closeTab() | Aktive Registerkarte schließen. |
| Block(Muster) | Fügen Sie einen normalisierten Domänenblock nur für Sitzungen hinzu und wenden Sie ihn an. |
| entsperren (Muster) | Entfernen Sie einen normalisierten sitzungsspezifischen Domänenblock. |
| isBlocked(urlOrHostname) | Fragen Sie die von der Regel erstellte Sitzungsblockliste ab. |
| getBlocked() | Listen Sie aktuelle, in der Sitzung erstellte Muster auf. |

Durch Regeln erstellte Blockmuster normalisieren http/https, führende www. und Pfade in ein Hostmuster. Sie stimmen genau mit dem Host und den Subdomains überein. Bei dieser dynamischen Sperrliste handelt es sich um Sitzungsspeicher, nicht um eine gespeicherte normale Site-Gruppe.

### 6.8 Hilfsprogramm für lokale Dateiordner

Get it with helpers.getLocalFolderHelper(). It only operates after the user has selected a folder in Global Settings and granted browser permission. It is asynchronous: every request returns a request id; completion arrives as localFileEvent.

| Methode | Verhalten |
| --- | --- |
| isAvailable() | Meldet, dass die API-Oberfläche vorhanden ist; Dies beweist nicht, dass ein Ordner derzeit autorisiert ist. |
| requestRead(path) | Fordern Sie die Lektüre des Textes an. |
| requestWrite(Pfad, Text) | Text schreiben anfordern. |
| requestAppend(path, text) | Text anfordern. |
| requestList(path = "") | Fordern Sie einen Verzeichniseintrag an. |
| requestExists(path) | Existenztest anfordern. |
| requestReadJson(path) | JSON-Lesevorgang anfordern; Der Pfad muss mit .json enden. |
| requestWriteJson(Pfad, Wert) | JSON-Schreiben anfordern; Der Pfad muss auf .json enden und der Wert muss JSON-sicher sein. |

Pfade sind immer relativ zum ausgewählten Stamm. Sie dürfen nicht absolut, laufwerksqualifiziert oder mit einem Punkt versehen sein oder enthalten. oder .. Segmente. Für Dateivorgänge werden nur TXT-, CSV- und JSON-Dateien akzeptiert. Die Ordnerauswahl kann jederzeit widerrufen werden; Eine fehlgeschlagene Anfrage meldet „ok false“ und eine Fehlerzeichenfolge in „localFileEvent“.

### 6.9 Plattform-Helfer

Get the collection with helpers.getPlatformHelper() or helpers.platform(). Get one raw platform API with helpers.platform("youtube"), for example.

Alle Rohplattform-APIs stellen Folgendes bereit:

| Methode | Verhalten |
| --- | --- |
| hide(Prädikat, Optionen) | Legen Sie für jeden Feedkartensteckplatz auf dieser Plattform dasselbe Prädikat pro Element fest. |
| hide(Slot, Prädikat, Optionen) | Legen Sie ein Prädikat pro Element fest. Das Prädikat empfängt das von dieser Plattform bereitgestellte Plattformelement/Snapshot. |
| erlauben(Prädikat, Optionen), erlauben(Slot, Prädikat, Optionen) | Identisch mit hide, erstellt jedoch ein Zulassungs-/Ausnahmeurteil. |
| show(), show(slot) | Löschen Sie alle oder einen installierten Prädikatslot. |
| surface(name, „hide“ oder „show“) | Einen gesamten Plattformbereich ein-/ausblenden. home ist der öffentliche Name für homePage. |
| Timer(Slot, Optionen) | Konfigurieren Sie einen Plattform-Unterabschnitts-Timer. Gibt bei Angabe die Datei „options.id“ zurück, andernfalls null. |
| erneut scannen() | Bewerten Sie bereits gescannte Feedkarten nach externen Regelstatusänderungen erneut. |
| snapshot() | Gibt den aktuellen Plattform-Snapshot oder null zurück. |
| slots(), surface(), timerSlots() | Gibt die unterstützten Namen für diese Plattform zurück. |
| isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId | URL-Helfer für diese Plattform. |

Ein Slot besitzt ein Prädikat für eine Gruppe/Plattform. Ein späterer Aufruf zum Ausblenden/Zulassen für denselben Slot ersetzt das frühere Prädikat; es ist kein implizites ODER. Das optionale Optionsobjekt erkennt:

| Option | Wirkung |
| --- | --- |
| blockPageOnVisit | Wenn eine passende Karte/Seite besucht wird, fordern Sie eine Seitensperre an, anstatt nur die Karte auszublenden. |
| Wirkung | blockieren (Standard) oder zulassen. Die Allow-Helfer-Sets erlauben automatisch. |

Rufen Sie „Rescan“ immer dann auf, wenn ein Prädikat von einem Status abhängt, der sich nach der ersten Auswertung der Karten geändert hat, z. B. von einem Panel-Kontrollkästchen, einer Quote oder einem Zeitschwellenwert.

Rohe Plattformunterstützungsmatrix:

| Plattform | Prädikatslots | Oberflächennamen | Timer-Slots |
| --- | --- | --- | --- |
| YouTube | Kurzfilme, Videos, Beiträge, Kommentare, Live | Startseite, ShortButton, Kommentare, Live | Kurzfilme, Videos, Beiträge |
| TikTok | Videos, Kommentare, Live | Startseite, Kommentare, Live | Videos |
| Instagram | Shorts, Beiträge, Kommentare | Startseite, Kommentare | Shorts, Beiträge |
| Facebook | Kurzfilme, Videos, Beiträge, Kommentare, Live | Startseite, Kommentare, Live | Kurzfilme, Videos, Beiträge |
| Zucken | Kurzfilme, Streams, Videos, Live | Startseite, Kommentare, Live | Kurzfilme, Streams, Videos |

Der rohe benutzerdefinierte Plattform-Helfer stellt Reddit, Discord oder Twitter/X nicht zur Verfügung. Nutzen Sie allgemeine URL-, DOM-, Timer-, Panel- und Navigationsfunktionen für benutzerdefinierte Arbeiten an diesen Websites.

## 7. Benutzerdefinierte Panels

The panel helper creates safe, declarative on-page panels. Get it with helpers.getPanelHelper(). A panel can be scoped to URLs, react to interactions, display timer state, and retain its user-entered values for the active rule lifetime.

### 7.1 Panel-API

| Methode | Verhalten |
| --- | --- |
| create(config) | Erstellen oder ersetzen Sie ein Panel. Gibt eine normalisierte Panel-ID oder Null zurück. |
| getOrCreatePanel(config) | Nur bei Abwesenheit erstellen; gibt id oder null zurück. |
| update(id, patch) | Ersetzen Sie die angegebenen Panelfelder nach der Validierung. |
| delete(id) | Entfernen Sie ein Panel und seine registrierten Inline-Handler. |
| show(id), hide(id) | Sichtbarkeit ändern. |
| setValue(panelId, controlId, value) | Legen Sie nach der Validierung einen beschreibbaren Steuerwert fest. |
| updateControl(panelId, controlId, patch) | Ersetzen Sie die zulässigen Felder eines Steuerelements. |
| deaktivieren(PanelId, ControlId), aktivieren(PanelId, ControlId) | Schalten Sie die Verfügbarkeit der Steuerung um. |
| setOptions(panelId, controlId, Optionen) | Ersetzen Sie Auswahl-/Radiooptionen. |
| setText(panelId, controlId, text) | Aktualisieren Sie eine Schaltflächenbeschriftung, einen Text/Abschnittstext oder eine andere Steuerelementbeschriftung. |
| setTheme(panelId, theme) | Ersetzen Sie das Panel-Thema. |
| setTitle(panelId, title), setDescription(panelId, description) | Text aktualisieren. |
| getValue(panelId, controlId) | Gibt einen geklonten oder undefinierten Wert zurück. |
| getValues(panelId) | Gibt alle beschreibbaren Werte zurück, verschlüsselt durch die Kontroll-ID. |
| getState(id) | Gibt einen serialisierbaren Panel-Snapshot oder null zurück. |
| list() | Gibt serialisierbare Snapshots aller Panels zurück. |
| Benachrichtigung(config) | Erstellen Sie unten rechts ein kompaktes Statusfeld mit optionaler Nachricht/Text. |
| bestätigen(config) | Erstellen Sie einen zentrierten Dialog mit generierten Schaltflächen zum Bestätigen und Abbrechen. |
| checklist(config) | Erstellen Sie ein Panel mit Kontrollkästchenelementen. |
| form(config) | Erstellen Sie ein Formularlayout-Panel aus Feldern. |

### 7.2 Panel-Konfiguration

| Feld | Akzeptierte Werte/Verhalten |
| --- | --- |
| id | Erforderlich. Normalisiert auf Buchstaben, Ziffern, Unterstrich, Bindestrich; maximal 80 Zeichen. |
| Titel | Paneltitel, maximal 240 Zeichen. |
| Beschreibung oder Text | Beschreibung, maximal 1.000 Zeichen. |
| Position | Oben links, Oben rechts, Unten links, Unten rechts oder Mitte. Standard unten rechts. |
| ausrichten | links, in der Mitte oder rechts. Standard links. |
| Layout | vertikal, kompakt, komfortabel, geräumig, inline, Zeile, Wrap, zweispaltig, Raster, geteilt, Formular, Symbolleiste oder Stapel. Standardvertikal. |
| Priorität | Numerische Anzeigereihenfolge, begrenzt auf -1000 bis 1000. Höhere Felder werden zuerst angezeigt. |
| Breite | klein, mittel, groß oder 180 bis 520 Pixel. |
| textSize/fontSize | 10 bis 32 Pixel oder 0,65 bis 2 rem/em. |
| ariaLabel/a11yLabel | Zugängliches Etikett. |
| Rolle | Region, Dialog, Warnung, Status, Formular oder Gruppe. |
| Autofokus | Boolescher Wert. |
| Thema/Farben | Hintergrund, Vordergrund, Akzent, Rand, stummgeschaltet, Schriftgröße/Textgröße, Titelgröße. |
| steuert | Array mit bis zu 32 Steuerelementen, wobei die Abschnitte auf bis zu drei Ebenen verschachtelt sind. |
| sichtbar | False blendet das Panel aus. |
| Bereich(URL), Domäne(URL) | Funktionen zur Steuerung der Verfügbarkeit/Anzeige. Domain hat Vorrang; Ohne Domäne werden Bereichssteuerelemente angezeigt. |

Panel-Inline-Handlerfelder können im Panel oder im einzelnen Steuerelement angezeigt werden: onEvent, onChange, onClick, onInput, onFocus, onBlur, onSubmit, onClose, onMount, onUnmount, onKey und onKeyDown. Jeder erhält die normalen Parameter (Ereignis, Helfer). Ein Inline-Handler wird ersetzt, wenn dieses Panel mit Steuerelementdefinitionen neu erstellt/aktualisiert wird.

### 7.3 Kontrollen

Die verfügbaren Steuerelementtypen sind Text, Kontrollkästchen, Auswahl, Texteingabe, Textbereich, Schaltfläche, Abschnitt, Timer, Zahleneingabe, Bereich, Umschalten, Radio, Datum, Uhrzeit, Farbe, Pin und HTML. Aliase-Eingabe, Dropdown, Gruppe, Nummer, Schieberegler, Schalter, Rohdaten und Markup werden auf ihren entsprechenden Typ normalisiert.

Alle Steuerelemente akzeptieren ID, Typ, Beschriftung, Wert, deaktiviert, Priorität und gegebenenfalls Layout, Ausrichtung, ariaLabel/a11yLabel, AutoFocus, Breite, Höhe und Zeilen.

| Geben Sie | ein Wichtige Felder und Wertvertrag |
| --- | --- |
| Text | Text (oder Beschriftung), der als Nicht-Eingabetext gerendert wird. |
| Kontrollkästchen, umschalten | Boolescher Wert. |
| auswählen, radio | Optionen als Strings oder {value, label}-Objekte; maximal 64. Wert ist eine kurze Zeichenfolge. |
| textInput, Textbereich | Zeichenfolgewert, maximal 2.000 Zeichen; optionaler Platzhalter. |
| Schaltfläche | Beschriftung/Text; optionale Aktion „Senden“, „Abbrechen“ oder „Schließen“. |
| Abschnitt | Text/Beschreibung, Rolle und verschachtelte Steuerelemente. |
| Timer | timerId oder Timer-Snapshot; Format ms, ss, mm:ss oder hh:mm:ss; Die Standardeinstellung für showExpired ist „true“. |
| ZahlEingabe, Bereich | Numerischer Wert, der auf den angegebenen Min./Max. Wert festgelegt ist; optionaler positiver Schritt. |
| Datum | Nur JJJJ-MM-TT-Wert. |
| Zeit | Nur HH:MM- oder HH:MM:SS-Wert. |
| Farbe | Sechsstelliger #RRGGBB-Eingabewert. |
| Stift | Nur Ziffern, Länge 3 bis 12, standardmäßig maskiert, optionales AutoSubmit. |
| html | Bereinigtes Markup. Skriptblöcke, Inline-Ereignisattribute und Javascript: URLs werden entfernt. |

Jede gerenderte Interaktion generiert ein PanelEvent. Das Werteobjekt des Ereignisses enthält die beschreibbaren Steuerelemente des Panels, mit Ausnahme von Schaltflächen, Text und Timer-Steuerelementen. Durch eine Schließaktion wird das Panel ausgeblendet, bevor Handler das Ereignis beobachten.

## 8. Aktionsrezepte für benutzerdefinierte Regeln

Die folgenden Beispiele sind Spezifikationen für die öffentliche Komposition und kein Tutorial.

### 8.1 Leiten Sie eine Startseite um

```js
(events, helpers) => {
  events.on("openWebEvent", "redirect-distracting-search", (event, h) => {
    const domain = h.getDomainHelper();
    if (!domain.isSearchPage(event.url)) return;
    event.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Return to your planned task."));
    event.preventDefault();
  });
}
```

### 8.2 Countdown der sichtbaren Zeit mit expliziter Blockierung

```js
(events, helpers) => {
  const timer = helpers.getTimerHelper();
  timer.create({
    id: "reading-budget",
    displayName: "Reading budget",
    direction: "backward",
    currentMs: 10 * 60 * 1000,
    scope: (url) => url.includes("example.com")
  });

  events.on("timerEnded", "stop-at-zero", (event) => {
    if (event.data?.timerId !== "reading-budget") return;
    event.setRedirectLink("about:blank");
    event.preventDefault();
  });
}
```

### 8.3 Ändern eines Feed-Prädikats aus einem Panel

```js
(events, helpers) => {
  const panel = helpers.getPanelHelper();
  const youtube = helpers.platform("youtube");

  panel.create({
    id: "feed-filter",
    title: "Feed filter",
    controls: [{
      id: "hide-sponsored",
      type: "toggle",
      label: "Hide sponsored items",
      value: true,
      onChange: (event, h) => {
        const api = h.platform("youtube");
        if (event.value) {
          api.hide("videos", (item) => item?.sponsored === true);
        } else {
          api.show("videos");
        }
        api.rescan();
      }
    }]
  });

  youtube.hide("shorts", () => true);
}
```

Für die von der aktiven Plattformoberfläche bereitgestellten Plattform-Snapshot-/Elementwerte müssen Prädikate geschrieben werden. Wenn eine Plattform ein Feld nicht zuverlässig identifizieren kann, sollte das Prädikat nicht geöffnet werden, sondern davon ausgehen, dass ein Wert wahr ist.

## 9. Anforderungsprotokoll für lokale Ordner

Bei Vorgängen in lokalen Ordnern handelt es sich nicht um unmittelbare Datei-E/A. Der vollständige Funktionsablauf ist:

1. Der Benutzer wählt einen Ordner in den globalen Einstellungen aus.
2. Die Regel stellt eine Anfrage in die Warteschlange und empfängt eine Anfrage-ID.
3. Vault fordert die autorisierte Ordnerfunktion auf, den Vorgang auszuführen.
4. Vault sendet localFileEvent an dieselbe benutzerdefinierte Gruppe.
5. Der Handler korreliert event.requestId mit der ursprünglichen Anforderungs-ID.

Erfolgreicher Lesevorgang wird mit Text für Textdateien oder Wert für JSON abgeschlossen. Liste gibt Einträge zurück. „Exists“ gibt „Exists“ zurück. Durch Schreiben/Anhängen werden ggf. Bytes bereitgestellt. Ein Fehler liefert „ok“, „false“ und „error“. Regeln dürfen niemals davon ausgehen, dass ein ausgewählter Ordner nach einem Neuladen, einem Browser-Neustart oder einem Berechtigungsentzug weiterhin autorisiert bleibt.

## 10. Sicherheit und Fehlersemantik benutzerdefinierter Regeln

### 10.1 Kompilierungs- und Ausführungsfehler

Fehler bei der Kompilierung der Syntaxberichte. Run kann bei der Registrierung auch einen Laufzeitfehler melden. Wenn eine funktionsähnliche Quelle einen Syntaxfehler aufweist, greift Vault nicht stillschweigend darauf zurück, sie als harmlose bloße Anweisungen zu behandeln.

Eine leere Quelle hat keine Handler. Sie ist als inaktive benutzerdefinierte Regel gültig, führt jedoch keine konfigurierte benutzerdefinierte Aktion aus.

### 10.2 Handler-Fehler

Eine Ausnahme von einem Handler wird vom gesamten Ereignisversand isoliert. Es handelt sich um eine Diagnoseausgabe; es führt spätere Handler nicht auf magische Weise zum Erfolg. Verwenden Sie enge Handler und protokollieren Sie umsetzbare Fehler.

### 10.3 Quarantäne

Vault kann eine benutzerdefinierte Gruppe nach wiederholten Fristüberschreitungen oder einer Überschreitung während der Registrierung unter Quarantäne stellen. Durch die Quarantäne wird die Gruppe deaktiviert und der Abbruchgrund aufgezeichnet. Korrigieren Sie die Quelle, speichern Sie sie und führen Sie sie explizit erneut aus, um aktive Registrierungen wiederherzustellen.

### 10.4 Browser-/Seitenbeschränkungen

Keine benutzerdefinierte Regel erhält uneingeschränkte Erweiterungs-APIs. Insbesondere:

- Ein DOM-Selektor kann auf einer Plattform nichts finden, was sich geändert hat.
- Navigation, Tab-Schließen und Bildschirmaktionen unterliegen weiterhin den Browserfunktionen.
- Eine Erweiterung kann keine nativen Anwendungen öffnen.
- Für Vorgänge mit lokalen Ordnern sind ein vom Benutzer gewährter Ordner und die unterstützten Dateitypen erforderlich.
– Ein Ereignishandler kann sich nicht darauf verlassen, dass eine unsichtbare Seite weiterhin sichtbare Herzschläge erzeugt.
– Eine Seite kann unabhängig von der Regel neu geladen, navigiert, verworfen oder ein Inhaltsskript ungültig gemacht werden.
- Durch Regeln erstellte dynamische Site-Blöcke sind Sitzungsstatusaktionen und keine dauerhaften Änderungen an Site-Gruppen.

## 11. Web-App-Brücke

Die Brücke ist optional. Es verbindet einen Browser-Erweiterungs-Client mit einem kompatiblen lokalen Vault-Hub. Die Browsererweiterung ist ein Client; Eine native Vault-App stellt den Hub bereit. Der feste lokale Endpunkt ist ws://127.0.0.1:8787 und Protokollkompatibilität ist erforderlich.

Die Verbindungsstatus sind „Aus“, „Verbindung wird hergestellt“, „Getrennt“, „Verbunden“ und „Fehler“. Wenn der Client aktiviert ist, prüft Vault zunächst schnell und setzt dann langsamere Versuche zur erneuten Verbindung fort, bis eine Verbindung hergestellt wird oder der Benutzer sie deaktiviert. Die Verbindung führt nicht automatisch alle Gruppen zusammen.

### 11.1 Gruppen verknüpfen

Gruppen können nur dann verlinkt werden, wenn ihr Name und Typ übereinstimmen und sie zur Verknüpfung berechtigt sind. Der Nutzer wählt/verlinkt explizit die teilnehmenden Programme. Eine verknüpfte Gruppe bildet einen Cluster. Beim Trennen der Verbindung bleiben die lokalen Gruppendaten erhalten; es stoppt die Live-Synchronisierung.

Die Bridge synchronisiert gemeinsame Skalarrichtlinien für unterstützte verknüpfte Gruppen, einschließlich normaler Blockierungsmodus, Zulassungs-/Zurücksetzungswerte, Schlummereinstellungen, aktive Tage/Fenster, Einfrierstatus/-auswahl/-dauer, Homepage-Richtlinie, Zulassungslisteneinstellung, Fallback-URL und Richtlinie zum Weiterspringen. Es koordiniert auch die Nutzung und den Schlummerstatus für Clustermitglieder.

Die Bridge verspricht nicht, dass jedes produktspezifische Feld, jeder Plattformselektor, jeder benutzerdefinierte Quelltext oder jede browserspezifische Funktion auf ein anderes Programm übertragbar ist. Eine Gruppe kann lokal und unverbunden bleiben, auch wenn die Bridge verbunden ist.

Für Frozen-Bridge-Cluster müssen alle relevanten Mitglieder online sein, um Freeze-State-Aktionen durchführen zu können, die eine koordinierte Mutation erfordern. Bei einer Verbindung handelt es sich um einen lokalen Transport, nicht um einen Cloud-Backup- oder Fernsteuerungskanal.

## 12. Verifizierungscheckliste für Betreuer

Verwenden Sie diese Checkliste, wenn Sie eine Version prüfen oder Verhalten reproduzieren:

1. Bestätigen Sie, dass die Gruppe einen nicht leeren, eindeutigen Namen, den richtigen Typ, den aktivierten Status und die beabsichtigte Liste/Reihenfolge hat.
2. Bestätigen Sie für normale Gruppen den aktiven Wochentag, das gültige lokale Zeitfenster, keine aktive Schlummerfunktion und den nicht eingefrorenen Bearbeitungsstatus.
3. Testen Sie für eine Site-Gruppe den genauen Host, die Subdomain und (für die Zulassungsliste) einen Host außerhalb der Liste.
4. Testen Sie für eine Plattformgruppe separat den Abgleich auf Seitenebene, den gezielten Element-/Kartenabgleich, den Autorenmodus, den Inhaltsformmodus und jede aktivierte Oberflächenausblendung.
5. Überprüfen Sie bei zeitgesteuerten normalen Gruppen die Anhäufung sichtbarer Seiten, den Ablauf des Kontingents oder das nicht blockierende Hochzählverhalten sowie das Rücksetzintervall.
6. Führen Sie für benutzerdefinierte Regeln die Syntaxprüfung aus, führen Sie die Aktion aus, überprüfen Sie die Anzahl/Protokolle der Handler, testen Sie jedes registrierte integrierte Ereignis und testen Sie dann ein Neuladen/eine Navigation.
7. Testen Sie jeden benutzerdefinierten Timer an den Scope-Grenzen und bei Null; Überprüfen Sie, ob jeder Block in der Regel explizit ist.
8. Testen Sie Panels mit jedem Steuerwert, jedem deaktivierten Status, jeder Aktion zum Senden/Abbrechen/Schließen und jedem PanelEvent-Handler.
9. Testen Sie den Fehler des lokalen Ordners vor dem Erfolg: kein ausgewählter Ordner, widerrufene Berechtigung, ungültiger Pfad, nicht unterstützte Erweiterung, dann autorisiertes Lesen/Schreiben.
10. Testen Sie die ausgeschaltete Bridge-Verbindung, die eingeschaltete Verbindung, die verbundene/nicht verknüpfte Gruppe und ein Offline-Clustermitglied, bevor Sie sich auf die Synchronisierung oder die Freeze-Koordination verlassen.

## 13. Versionierungsregel

Diese englische Datei ist das gepflegte Quellhandbuch. Lokalisierte Handbücher sind Übersetzungen davon und müssen möglicherweise nach einer Aktualisierung der funktionalen Dokumentation neu erstellt werden. Die Produktquelle bleibt die kanonische Wahrheit für Unklarheiten auf Implementierungsebene.
