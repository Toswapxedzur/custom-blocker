# Custom Web Blocker — Benutzerhandbuch

Dies ist das vollstaendige Referenzhandbuch fuer die Erweiterung. Es beginnt mit den einfachsten und haeufigsten Arbeitsablaeufen und geht dann schrittweise zu fortgeschrittenen Themen ueber, etwa benutzerdefinierte JavaScript-Blockregeln und die Helper-API.

Wenn du ganz neu bist, lies einfach **Quick start** und **Block groups overview**. Alles unterhalb dieser Abschnitte ist optional und haengt davon ab, was du machen moechtest.

---

## 1. Was diese Erweiterung tut

Custom Web Blocker laesst dich Websites und Online-Ablenkungen nach selbst definierten Regeln blockieren. Du kannst:

- Websites sofort mit der nativen Netzwerkblockierung des Browsers blockieren (derselbe Blocktyp, der `ERR_BLOCKED_BY_CLIENT` erzeugt).
- Dir eine bestimmte Anzahl Minuten pro Tag auf einer Website erlauben und sie nach Ueberschreitung des Limits blockieren.
- Bestimmte Arten von Inhalten auf YouTube, TikTok, Facebook, Instagram, Twitch und Reddit blockieren (nicht die ganze Website).
- Blockierte Inhalte in Feeds auf unterstuetzten Plattformen ausblenden statt nur einzelne Seiten zu blockieren.
- Planen, wann eine Regel aktiv ist, nach Wochentag und `HHMM-HHMM`-Zeitfenstern.
- Eine Regel einfrieren, damit du sie nicht leicht aendern kannst. Strenges Einfrieren sperrt sie fuer eine festgelegte Anzahl Stunden und erfordert ein 20-stufiges Bestaetigungsritual zum Aufheben.
- Eine Regel voruebergehend snoozen, aber nur nach einer ausreichend langen Begruendung.
- Eigene JavaScript-Blockregeln schreiben, mit Helfern fuer Timer, persistente Speicherung, Plattformerkennung, Domain-Matching und Logging.
- Die Erweiterung in 20+ Sprachen nutzen.

Die Erweiterung ist eine Chrome-Manifest-V3-Erweiterung mit einer Editor-Seite (das Popup), einem Background-Service-Worker und einem Content-Script, das auf jeder Seite laeuft.

---

## 2. UI-Rundgang

Wenn du auf das Symbol der Erweiterung klickst, oeffnet sich der Editor als vollstaendige Webseite (kein kleines Popup). Die Seite hat diese Bereiche:

- **Top bar**
  - **Instruction Manual**-Button (dieses Dokument)
  - **Language**-Auswahl
- **Left panel — Block Groups**
  - Liste deiner Blockgruppen. Jede Karte zeigt den Gruppennamen, eine kurze Zusammenfassungszeile und eine Aktivieren/Deaktivieren-Checkbox.
  - **Add** erstellt eine neue Gruppe. Das Dropdown daneben waehlt den Typ.
  - **Delete All** entfernt alle Gruppen, mit zusaetzlichen Bestaetigungen, wenn irgendeine Gruppe eingefroren ist.
  - Du kannst den `::`-Handle auf einer Karte nach oben oder unten ziehen, um Gruppen umzusortieren.
  - Du kannst den vertikalen Splitter ziehen, um die Groesse dieses Panels zu aendern.
- **Right panel — Editor**
  - Bearbeitet die aktuell ausgewaehlte Gruppe: Name, Blockierverhalten, Blocklisten, typspezifische Filter, Zeitplan, Freeze, Snooze.
  - Alle Aenderungen werden automatisch einen Bruchteil einer Sekunde gespeichert, nachdem du aufhoerst zu tippen oder zu interagieren.
- **Toast** (zentriertes Popup, das ausblendet)
  - Zeigt Statusmeldungen wie "Saved changes" oder Eingabefehler.

Waehrend eine Seite blockiert wird oder einen aktiven Timer hat, erscheint oben links ein Overlay mit allen aktuell wirksamen Zeitbeschraenkungen im Format `hh:mm:ss` (oder `mm:ss`). Mehrere Beschraenkungen werden in mehreren Zeilen gestapelt.

---

## 3. Quick start

1. Klicke auf das Erweiterungssymbol. Der Editor oeffnet sich als vollstaendige Seite.
2. Waehle im Panel **Block Groups** einen Gruppentyp aus dem Dropdown:
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit` oder `Custom`.
3. Klicke **Add**. Eine neue Gruppe erscheint, und der Editor oeffnet sie.
4. Gib ihr einen Namen.
5. Fuelle die typspezifischen Felder aus (bei `Default` ist das die Liste **Blocked websites**).
6. Stelle sicher, dass die Checkbox der Gruppe im linken Panel eingeschaltet ist.
7. Besuche eine der aufgefuehrten Seiten. Die Blockierung sollte sofort greifen.

Das ist der gesamte Happy Path. Der Rest dieses Handbuchs sind nur Optionen obendrauf.

---

## 4. Block groups overview

Alles in dieser Erweiterung ist als **Blockgruppen** organisiert. Eine Blockgruppe ist ein Regelsatz:

- Sie hat einen Namen, einen Typ und einen Aktiviert/Deaktiviert-Zustand.
- Sie hat ein Blockierverhalten (sofort oder nach einer Anzahl Minuten).
- Sie hat optional einen Zeitplan (Tage + Zeitfenster) und optionale Freeze/Snooze-Steuerungen.
- Je nach Typ hat sie zusaetzliche Felder wie eine Liste von Websites, YouTube-Autorenfilter, Subreddit-Namen oder eine JavaScript-Funktion.

Du kannst beliebig viele Gruppen haben. Mehrere Gruppen koennen auf dieselbe Seite zutreffen; dann gewinnt die **strengste** Regel:

- "Block immediately" schlaegt "block after some time".
- Eine Gruppe mit weniger verbleibender Zeit schlaegt eine Gruppe mit mehr verbleibender Zeit.

Das Hinzufuegen weiterer Gruppen kann eine Seite also nur frueher blockieren, nie spaeter.

Du kannst Gruppen ueber ihren `::`-Handle ziehen, um sie neu anzuordnen. Die Reihenfolge aendert nicht, welche Regel am strengsten ist, steuert aber die Lesereihenfolge der Liste von oben nach unten.

---

## 5. Gruppentypen

### 5.1 `Default` — normale Websites blockieren

Zum Blockieren bestimmter Domains (der typische Anwendungsfall).

- **Blocked websites**: eine Seite pro Zeile. Sowohl `facebook.com` als auch `https://www.facebook.com/somepage` funktionieren; die Erweiterung extrahiert und normalisiert den Hostnamen.
- Eine Seitenregel gilt fuer diesen Hostnamen und alle seine Subdomains.
- Dieser Gruppentyp nutzt Chromes native Netzwerkblockierung, aehnlich `ERR_BLOCKED_BY_CLIENT`. Das bedeutet, die Navigation zu einer blockierten URL wird gestoppt, bevor die Seite ueberhaupt laedt.

### 5.2 `YouTube` — YouTube und aehnliche Video-Seiten blockieren

Fuegt dem Editor einen Abschnitt **Filters** hinzu:

- **Content type**:
  - `Apply to all YouTube pages` — jede YouTube-Seite zaehlt.
  - `Apply to Shorts` — nur Shorts-Seiten zaehlen.
  - `Apply to long videos` — nur `/watch`, `/live/`, `/embed/` usw.
  - `Apply to YouTube posts` — Community-Posts (`/post/...`, Channel-Tabs community/posts).
- **Author filter**:
  - `Do not filter by author` — die Autoridentitaet ist egal.
  - `Apply to certain authors` — nur gelistete Autoren loesen diese Gruppe aus.
  - `Apply to all except certain authors` — gelistete Autoren sind ausgenommen.
- **Authors**: ein Autor pro Zeile. Akzeptiert `@handle`, volle URLs, `/channel/UC...`, `/c/...`, `/user/...`.
- **Hide blocked entries in the YouTube feed**: waehrend diese Gruppe aktiv blockiert, werden passende Karten in YouTube-Feeds ausgeblendet. Wenn die Blockierung inaktiv wird, kommen sie beim naechsten Refresh zurueck.

Bei den Inhaltstypen Shorts und Posts blendet die Erweiterung ausserdem relevante Navigationseintraege (Shorts in der Sidebar, Community/Posts-Channel-Tabs) und passende Shelves wie "Latest YouTube posts" aus, wenn kein Autorenfilter gesetzt ist und die Gruppe aktuell blockiert.

Die Short-vs-Long-Erkennung gilt auch fuer andere Video-Seiten wie TikTok, Vimeo, Twitch clips/VODs und Dailymotion, wenn deren Seitenform erkannt werden kann.

### 5.3 `TikTok` — TikTok-Inhalte blockieren

Dieselbe Editor-Karte wie beim Plattform-Video-Editor, aber mit TikTok-spezifischen Labels:

- Inhaltstypen: short videos, videos, profile pages.
- Autoren: TikTok-Handles (`@handle`) oder Profil-URLs.
- Feed-Hiding blendet passende Karten auf TikTok-Seiten aus, waehrend die Gruppe aktiv ist.

### 5.4 `Facebook` — Facebook-Inhalte blockieren

- Inhaltstypen: Reels, videos, posts.
- Autoren: Seitenname (`page.name`), Profil-URL oder `profile.php?id=...`-Form (die numerische ID bleibt als `id:<number>` erhalten).
- Feed-Hiding blendet passende Feed-Karten auf Facebook aus.

### 5.5 `Instagram` — Instagram-Inhalte blockieren

- Inhaltstypen: Reels, videos, posts.
- Autoren: Instagram-Handles oder Profil-URLs.
- Reservierte Pfade wie `/reel/`, `/p/`, `/tv/`, `/explore/` werden nicht als Autoren behandelt.
- Feed-Hiding blendet passende Karten auf Instagram aus.

### 5.6 `Twitch` — Twitch-Inhalte blockieren

- Inhaltstypen: clips, streams/VODs, Channel-Seiten.
- Autoren: Channel-Namen oder Channel-URLs.
- Reservierte Pfade wie `/directory`, `/videos`, `/settings` usw. werden nicht als Channel-Namen behandelt.
- Feed-Hiding blendet passende Karten auf Twitch aus.

### 5.7 `Reddit` — Reddit oder bestimmte Subreddits blockieren

- **Subreddits**: ein Subreddit pro Zeile. Leere Liste bedeutet, die Gruppe gilt fuer ganz Reddit. Sowohl `productivity` als auch `r/productivity` werden akzeptiert.

### 5.8 `Custom` — per JavaScript-Funktion blockieren

Du schreibst eine JavaScript-Funktion. Die Erweiterung ruft sie etwa jede Sekunde auf und verwendet ihren Rueckgabewert als aktuelle Blockliste.

`Custom`-Gruppen zeigen nicht: Blockierverhalten, blockierte Seiten, erlaubte Minuten, Reset-Intervall, Zeitplantage oder Zeitfenster. Sie haben nur ein grosses Eingabefeld — die Funktion **Blocking Rules** — plus die Standard-Steuerungen fuer Freeze/Snooze.

Siehe **Abschnitt 11** fuer die vollstaendige Referenz zu Custom-Regeln und zur Helpers-API.

---

## 6. Blockierverhalten

Fuer die meisten Gruppentypen waehlt man einen von zwei Modi:

### 6.1 Sofort blockieren

Die Regel ist aktiv, wann immer die Gruppe eingeschaltet ist, der Zeitplan es erlaubt und (bei Plattformgruppen) die Seite passt.

Bei `Default`-Gruppen nutzt das Chromes native Blockierung. Bei Plattformgruppen wird die In-Page-Overlay/Exit-Logik genutzt.

### 6.2 Nach einer Anzahl Minuten blockieren

Das ist ein Nutzungsbudget.

- **Allowed minutes before block** (dezimal): wie viele Minuten du dir pro Zeitraum erlaubst. Beispiel: `15`, `0.5`, `90`.
- **Timer reset interval (hours)** (dezimal): wie oft das Budget zurueckgesetzt wird. Beispiel: `24` taeglich, `1` stuendlich, `0.25` alle 15 Minuten.

Solange Zeit uebrig ist, funktioniert die Seite normal und zeigt das Timer-Overlay. Wenn das Budget Null erreicht, wird die Seite fuer den Rest des Zeitraums blockiert und das Overlay zeigt `0:00`, dann versucht der Tab zu verlassen.

Die Erweiterung arbeitet pro Gruppe und pro Zeitraum:

- Jede Gruppe hat ihr eigenes Budget.
- Zeit auf jeder Seite, die zur Gruppe passt, zaehlt auf das Budget dieser Gruppe.
- Mehrere Tabs derselben Gruppe teilen sich das Budget. Ihre Timer bleiben synchron; ein Wechsel auf einen anderen Tab erzwingt ebenfalls ein Refresh, damit die aktuelle geteilte Zeit sofort angezeigt wird.

Wenn mehrere zeitlimitierte Gruppen auf dieselbe Seite zutreffen, gewinnt die strengste.

---

## 7. Zeitplan

In der Karte **Schedule** kannst du einschränken, wann eine Gruppe aktiv ist:

- **Days to block**: waehle die Tage, an denen die Gruppe gilt. Nicht markierte Tage bedeuten, die Gruppe ist an diesem Tag inaktiv.
- **Time windows**: freie Liste, ein Fenster pro Zeile im Format `HHMM-HHMM`, zum Beispiel:

  ```
  0900-1000
  1200-1300
  ```

  Die Gruppe ist nur innerhalb dieser Fenster aktiv. Leere Liste bedeutet ganztägig.

Das gilt fuer alle Gruppentypen ausser `Custom`.

---

## 8. Freeze (Manipulationsschutz)

Einfrieren macht es schwer, eine Gruppe impulsiv zu deaktivieren.

In der Karte **Freeze** waehlt man:

- **Frozen** — du kannst die Gruppe nicht bearbeiten oder loeschen, und du kannst ihren Aktivieren-Toggle nicht abwaehlen. Um etwas zu aendern, musst du das Unfreeze-Ritual durchlaufen (siehe unten).
- **Strict frozen** — wie Frozen, bleibt aber fuer eine von dir gewaehlte Anzahl Stunden gesperrt (dezimal, bis 72). Bis dieser Timer ablaeuft, ist selbst das Unfreeze-Ritual nicht verfuegbar.

Wenn eine eingefrorene Gruppe entsperrbar ist, erscheint der Button **Unfreeze**. Ein Klick startet das **20-step ritual**:

- Das Modal zeigt eine Selbstdisziplin-Nachricht.
- Du musst `Confirm` 20-mal klicken.
- Zwischen Klicks gibt es eine erzwungene Wartezeit von 5 Sekunden.
- Wenn du an irgendeinem Punkt abbrichst, musst du bei Schritt 1 neu beginnen.
- Die 20 Meldungen rotieren, damit du sie wirklich liest.

Wenn die Gruppe auch als "no snooze" markiert ist (siehe naechster Abschnitt), kannst du sie im eingefrorenen Zustand ebenfalls nicht snoozen.

Der Freeze-Status wird in der Meta-Zeile der Gruppenkarte angezeigt, einschliesslich verbleibender Zeit fuer Strict Freeze.

---

## 9. Snooze (voruebergehend deaktivieren)

Snooze deaktiviert eine Gruppe temporaer, ohne sie zu entfrieren, aber nur mit schriftlicher Begruendung.

In der Karte **Snooze**:

- **Allow snooze for this group** — wenn aus, kann diese Gruppe gar nicht gesnoozed werden (auch nicht waehrend sie eingefroren ist).
- **Snooze for (minutes)** — dezimal, wie lange der Snooze dauert.
- **Reason** — muss **mindestens 100 Zeichen und mehr als 20 Woerter** haben. Der Start-Button bleibt deaktiviert, bis beides erfuellt ist. Falls die Regel fehlschlaegt, erscheint ein Inline-Hinweis neben dem Button.

Wenn die Gruppe eingefroren ist, sind Snooze-Minuten auf den vor dem Freeze gewaehlten Wert gesperrt. Du kannst sie weiterhin snoozen, solange Snooze erlaubt ist und die Begruendung den Regeln entspricht.

Eine Statusmeldung bestaetigt den Snooze. Wenn der Snooze endet, kehrt die Gruppe automatisch zum Normalzustand zurueck.

Du kannst einen Snooze auch frueher mit **End Snooze** beenden.

---

## 10. Massenaktionen

- **Delete All** entfernt alle Gruppen.
  - Es fragt immer nach Bestaetigung.
  - Wenn mindestens eine Gruppe eingefroren ist, ist dasselbe 20-step ritual wie beim Entfrieren erforderlich.
  - Wenn irgendeine Gruppe strict-frozen und noch gesperrt ist, ist **Delete All** deaktiviert.

---

## 11. Custom-Gruppen (vollstaendige Referenz)

Eine `Custom`-Gruppe fuehrt eine JavaScript-Funktion im Background-Service-Worker aus. Die Funktion wird etwa jede Sekunde aufgerufen, und die Erweiterung verwendet den Rueckgabewert, um zu entscheiden, welche Domains jetzt blockiert werden sollen.

### 11.1 Funktionssignatur

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

Parameter:

- `month` — `1` bis `12`.
- `dayOfMonth` — `1` bis `31`.
- `dayName` — zum Beispiel `"Monday"`.
- `hour` — `0` bis `23`.
- `minute` — `0` bis `59`.
- `blockedDomains` — die laufende Domain-Liste, die andere Regeln bereits erzeugt haben. Du kannst sie erweitern, ersetzen oder ignorieren.
- `helpers` — ein Bundle von Helper-Objekten (siehe unten).

Rueckgabewert:

- Ein Array von Domain-Strings, die jetzt blockiert werden sollen, ODER
- nichts (dann nutzt die Erweiterung den Zustand, auf den du `blockedDomains` mutiert hast).

Die Funktion wird beim Speichern validiert. Syntaxfehler erzeugen eine Statuswarnung, und die Regel wird nicht verwendet, bis du sie behebst. Wenn deine Funktion zur Laufzeit wirft, faengt die Erweiterung das ab, loggt in die Background-Konsole und faellt auf das vorherige Ergebnis zurueck.

### 11.2 Adaptive Taktung

Custom-Regeln laufen normalerweise etwa jede Sekunde. Wenn deine Regel zu lange dauert, verlangsamt die Erweiterung die Schleife automatisch (bis etwa alle 5 Sekunden). Das musst du nicht selbst steuern.

### 11.3 Das `helpers`-Objekt

Innerhalb der Funktion stellt `helpers` mehrere Unter-Helper bereit. Jeder hat einen langen Namen und einen kurzen Alias. Zusaetzlich gibt es explizite Getter-Methoden:

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — die aktuelle Epoch-Zeit in Millisekunden.

Alle Helper-Methoden sind defensiv ausgelegt: ungueltige Parameter geben `null`, `false` oder einen leeren Wert zurueck statt zu werfen.

#### 11.3.1 `timerHelper`

Verwaltet Countdown-Timer, die an eine Domain gebunden sind. Timer bleiben ueber Browser-Neustarts erhalten. Jeder Timer gehoert zur Custom-Gruppe, die ihn erstellt hat.

- `createTimer(domain, durationMs, displayName?)` — erstellt und gibt eine eindeutige Timer-ID zurueck, oder `null` bei ungueltigen Eingaben. Beispiel: `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`. Solange der Nutzer auf einer Seite ist, die zu dieser Domain passt, zeigt das In-Page-Overlay `Timer1: 30:00` und zaehlt herunter.
- `deleteTimer(id)` — loescht den Timer. Gibt bei Erfolg `true` zurueck.
- `pauseTimer(id)` — pausiert den Countdown.
- `continueTimer(id)` / `resumeTimer(id)` — setzt einen pausierten Timer fort.
- `resetTimer(id, durationMs?)` — startet den Timer neu. Ohne `durationMs` wird die originale Dauer wiederverwendet.
- `addMs(id, ms)` — addiert Millisekunden (oder subtrahiert mit negativen Werten).
- `remainingMs(id)` — verbleibende Millisekunden.
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — booleans.
- `getDomain(id)` / `getDisplayName(id)` — Timer-Infos lesen.
- `findByDomain(domain)` — Array mit Timer-IDs fuer diese Domain.
- `list()` — Array von `{ id, domain, displayName, durationMs, remainingMs, isPaused }` fuer jeden Timer dieser Gruppe.

Die maximale Timer-Dauer liegt bei etwa 30 Tagen.

#### 11.3.2 `persistenceHelper`

Map-artiger Speicher mit Scope auf deine Gruppe. Werte muessen JSON-serialisierbar sein. Nützlich, um Zustand zwischen Aufrufen zu behalten.

- `set(key, value)` — speichert einen beliebigen JSON-Wert. Gibt bei Erfolg `true` zurueck.
- `get(key, defaultValue?)` — gibt den gespeicherten Wert zurueck oder `defaultValue`, falls nicht vorhanden.
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`.

Weiche Limits: etwa 200 Schluessel pro Gruppe, 16 KB pro Wert.

#### 11.3.3 `domainHelper`

- `normalize(value)` — gibt die kanonische Domain wie `youtube.com` zurueck, oder `null`.
- `matches(hostname, site)` — `true`, wenn `hostname` zu `site` gehoert (inklusive Subdomains).

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — schreibt in die Background-Konsole.

Um diese Meldungen zu sehen: `chrome://extensions` -> Developer Mode aktivieren -> auf den "service worker"-Link der Erweiterung klicken.

#### 11.3.5 `platformHelper`

Untersucht unterstuetzte Social-/Video-Plattformen.

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`.
- `normalizePlatform(value)` — gibt den kanonischen Plattformnamen zurueck, oder `null`.
- `normalizeAuthor(author, platform)` — normalisiert eine Autorenkennung (Handle, URL usw.) fuer eine bestimmte Plattform, oder `null`.
- `detect(urlOrHost)` / `getContext(urlOrHost)` — gibt `{ platform, hostname, pathname, type, authors, url }` zurueck, oder `null`.
  - `type` ist `"short" | "long" | "post" | "unknown"`.
  - `authors` ist die Liste normalisierter Autoren, die aus dieser URL erkennbar sind.
- `getType(urlOrHost)` — Shortcut fuer `detect(...).type`.
- `getPlatform(urlOrHost)` — Shortcut fuer `detect(...).platform`.
- `getAuthors(urlOrHost)` — Shortcut fuer `detect(...).authors`.
- `matchesAuthor(urlOrHost, platform, authors)` — gibt `true` zurueck, wenn die URL auf dieser Plattform liegt und einer der gegebenen Autoren passt.

### 11.4 Beispiele

Einfach: Social Media an Werktagmorgen blockieren.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

Mittel: 30 Minuten YouTube pro Browser-Session mit sichtbarem Countdown.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper } = helpers;
  let id = persistenceHelper.get("youtubeTimer");

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer("youtube.com", 30 * 60 * 1000, "YouTube");
    persistenceHelper.set("youtubeTimer", id);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, "youtube.com"];
  }

  return blockedDomains;
}
```

Schwieriger: Eine TikTok-Session nur blockieren, wenn es short videos sind UND der Autor in deiner Ablenkerliste steht. Nutze `platformHelper`.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { platformHelper, logHelper } = helpers;
  const distractors = ["someuser", "anotheruser"];
  const url = "https://www.tiktok.com" + (globalThis.location?.pathname ?? "");
  const ctx = platformHelper.detect(url);

  if (ctx?.platform === "tiktok" && ctx.type === "short") {
    if (platformHelper.matchesAuthor(url, "tiktok", distractors)) {
      logHelper.log("Blocking TikTok short by", ctx.authors);
      return [...blockedDomains, "tiktok.com"];
    }
  }

  return blockedDomains;
}
```

(`globalThis.location` ist nur ein Platzhalter-Beispiel — normalerweise steuerst du `platformHelper` mit eigener Logik, nicht mit der Worker-Location, da der Background-Worker keine echte Seiten-URL hat.)

Am schwierigsten: rotierende "site of the day" mit taeglichem Limit, ueber Neustarts hinweg persistent.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const { timerHelper, persistenceHelper, domainHelper, logHelper } = helpers;
  const sites = ["reddit.com", "twitter.com", "news.ycombinator.com"];
  const today = `${month}-${dayOfMonth}`;
  const lastDay = persistenceHelper.get("lastDay");

  if (today !== lastDay) {
    for (const id of timerHelper.list().map((t) => t.id)) {
      timerHelper.deleteTimer(id);
    }
    persistenceHelper.set("lastDay", today);
  }

  const site = sites[(month + dayOfMonth) % sites.length];
  let id = persistenceHelper.get(`timer:${site}`);

  if (!id || !timerHelper.exists(id)) {
    id = timerHelper.createTimer(site, 20 * 60 * 1000, `${site} budget`);
    persistenceHelper.set(`timer:${site}`, id);
    logHelper.log("Started budget for", site);
  }

  if (timerHelper.isExpired(id)) {
    return [...blockedDomains, domainHelper.normalize(site)];
  }

  return blockedDomains;
}
```

---

## 12. Verhalten ueber mehrere Seiten

- Alle offenen Tabs derselben Gruppe teilen sich denselben Timer.
- Wenn du zu einem Tab derselben Gruppe wechselst, aktualisiert sich sein Overlay sofort und zeigt die aktuelle geteilte Zeit.
- Wenn eine neue Regel hinzugefuegt wird, erkennen alle offenen Seiten die Aenderung und aktualisieren sich innerhalb eines Sekundenbruchteils; du musst Tabs nicht manuell neu laden.
- Wenn eine Regel ablaeuft, werden ausgeblendete Feed-Karten und Navigationsbuttons beim naechsten Refresh wiederhergestellt.

---

## 13. Internationalisierung

Die gesamte UI ist vollstaendig uebersetzt. Nutze die **Language**-Auswahl oben rechts.

Unterstuetzte Sprachen umfassen English, Chinese (Simplified), Spanish, Japanese, Korean sowie teilweise Abdeckung fuer Hindi, Arabic, Bengali, Portuguese, Russian, Punjabi, German, French, Turkish, Vietnamese, Italian, Thai, Dutch, Polish, Indonesian, Urdu und Persian. Sprachen mit teilweiser Abdeckung fallen fuer fehlende Strings auf Englisch zurueck.

Das Handbuch selbst laedt die Markdown-Datei passend zur ausgewaehlten Sprache, mit Englisch als Fallback.

---

## 14. Statusmeldungen

Statusmeldungen erscheinen als zentrierter Toast, der nach etwa zwei Sekunden ausblendet:

- "Saved changes."
- "Created \"Group name\"."
- Validierungsfehler wie "Allowed minutes must be a number greater than 0."
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

Bei Eingabefeldern mit Format-Anforderungen erscheint die Meldung ausserdem neben dem entsprechenden Button (fuer Snooze).

---

## 15. Datenschutz und Speicherung

- Alles wird lokal in `chrome.storage.local` gespeichert. Es werden keine Daten irgendwohin gesendet.
- Gespeicherte Elemente umfassen: deine Gruppen, Nutzungstimer, letzte Reset-Zeiten, Snooze-Eintraege, Custom-Timer und Custom-persistente Werte.
- Die Erweiterung liest Seiteninhalte nicht ueber das hinaus, was zur Erkennung des Seitentyps noetig ist (path/hostname/bekannte DOM-Marker fuer Video-Seiten). Sie liest weder deine Nachrichten noch Posts, Kommentare oder private Inhalte.

---

## 16. Berechtigungen

- `storage` — fuer die oben genannten Daten.
- `declarativeNetRequest` — fuer native Blockierung von `Default`-Gruppen.
- `alarms` — um Regeluebergaenge effizient zu planen.
- `host_permissions: <all_urls>` — damit das Content-Script das Timer-Overlay anzeigen und Plattformkontext auf jeder Seite erkennen kann.

---

## 17. Fehlerbehebung

- **Eine von mir hinzugefuegte Gruppe macht nichts.** Stelle sicher, dass die Gruppe aktiviert ist, der Zeitplan sie jetzt erlaubt, kein Snooze aktiv ist und (bei Plattformgruppen) die Seite tatsaechlich zum gewaehlten Inhaltstyp und Autorenfilter passt.
- **Ein Timer haengt oder ist in einem Tab falsch.** Wechsle weg und wieder zurueck oder fokussiere den Tab — das loest einen erzwungenen Refresh vom geteilten Timer aus.
- **Feed-Karten erscheinen wieder, obwohl sie versteckt sein sollten.** Feed-Hiding laeuft nur, waehrend die Regel aktiv blockiert. Bei einer `after-minutes`-Regel greift Feed-Hiding, sobald deine Zeit Null erreicht.
- **Ein YouTube-Navigationsbutton, den ich versteckt erwartet habe, ist noch da.** Nav-Hiding erfordert "do not filter by author" und den Inhaltstyp Shorts oder YouTube posts. Mit Autorenfiltern ist das Ausblenden nur pro Karte.
- **Custom-Regel hat nichts getan oder still geworfen.** Oeffne `chrome://extensions`, aktiviere Developer Mode, klicke den "service worker"-Link der Erweiterung und pruefe die Konsole. Nutze `helpers.logHelper.log(...)`, um deine Regel zu verfolgen.
- **Ich kann eine Gruppe nicht loeschen.** Sie ist wahrscheinlich eingefroren. Strict-frozen-Gruppen koennen bis zum Ablauf der Sperre gar nicht geloescht werden; nicht-streng eingefrorene Gruppen koennen ueber das Unfreeze-Ritual geloescht werden.

---

## 18. Glossar

- **Block group** — ein Regelsatz mit eigenem Typ, Verhalten, Zeitplan und Freeze/Snooze.
- **Instant block** — die Regel blockiert sofort, wann immer sie aktiv ist.
- **After-minutes block** — die Regel beginnt erst zu blockieren, nachdem das Zeitbudget fuer den Zeitraum aufgebraucht ist.
- **Reset interval** — wie oft das After-minutes-Budget zurueckgesetzt wird.
- **Schedule** — Tage + Zeitfenster, in denen eine Gruppe aktiv ist.
- **Freeze / Strict freeze** — Manipulationsschutz-Zustaende.
- **Snooze** — voruebergehendes Deaktivieren mit schriftlicher Begruendung.
- **Author filter** — bei Plattformgruppen schraenkt die Regel auf bestimmte Content-Ersteller ein.
- **Content type** — bei Plattformgruppen schraenkt die Regel auf bestimmte Inhaltsformen ein (short, long, post).
- **Helpers** — Utilities, die an die Funktion einer Custom-Regel uebergeben werden.
- **Platform** — eine von `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Jede hat eigenen Gruppentyp und eigene Feed-Hiding-Logik.

---

## 19. Einschraenkungen

- Feed-Hiding haengt vom aktuellen DOM jeder Plattform ab. Wenn die Plattform ihr Layout aendert, muessen die Hiding-Selektoren eventuell aktualisiert werden.
- Die Plattformkontext-Erkennung fuer Nicht-YouTube-Seiten ist meistens URL-basiert und daher am verlaesslichsten auf kanonischen Content-URLs.
- Custom-Regelschleifen laufen im Background-Worker, nicht in Seiten. Daher sind DOM-Informationen innerhalb der Funktion nicht verfuegbar. Verwende stattdessen `platformHelper.detect(url)` mit einem URL-String.
- Der Browser kann den Service-Worker im Leerlauf pausieren. Die Erweiterung startet ihn wieder, sobald eine Seite oder ein Alarm ihn braucht; Nutzungstimer verlieren dadurch keine Genauigkeit.

