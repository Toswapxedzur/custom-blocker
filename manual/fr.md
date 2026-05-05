# Custom Web Blocker — Manuel d'instructions

Ce document est le manuel de reference complet de l'extension. Il commence par les flux les plus simples et les plus courants, puis passe progressivement a des sujets avances comme les regles de blocage JavaScript personnalisees et l'API de helpers.

Si vous debutez totalement, lisez simplement **Quick start** et **Block groups overview**. Tout ce qui suit ces sections est optionnel, selon ce que vous voulez faire.

---

## 1. Ce que fait cette extension

Custom Web Blocker vous permet de bloquer des sites web et des distractions en ligne selon des regles que vous definissez vous-meme. Vous pouvez :

- Bloquer des sites immediatement via le blocage reseau natif du navigateur (le meme type de blocage qui produit `ERR_BLOCKED_BY_CLIENT`).
- Vous autoriser un certain nombre de minutes par jour sur un site, puis le bloquer une fois la limite depassee.
- Bloquer des types de contenu specifiques sur YouTube, TikTok, Facebook, Instagram, Twitch et Reddit (pas le site entier).
- Masquer le contenu bloque dans les fils des plateformes prises en charge, au lieu de seulement bloquer des pages individuelles.
- Planifier quand une regle est active, par jour de la semaine et par plages horaires `HHMM-HHMM`.
- Geler une regle pour eviter de la modifier facilement. Le gel strict la verrouille pendant un nombre d'heures defini et impose un rituel de confirmation en 20 etapes pour annuler.
- Mettre une regle en snooze temporairement, mais seulement apres avoir ecrit une justification suffisamment longue.
- Ecrire des regles de blocage JavaScript personnalisees avec des helpers pour les minuteries, le stockage persistant, la detection de plateforme, la correspondance de domaines et la journalisation.
- Utiliser l'extension dans plus de 20 langues.

L'extension est une extension Chrome Manifest V3, avec une page d'editeur (le popup), un service worker d'arriere-plan et un content script qui s'execute sur chaque page.

---

## 2. Tour de l'interface

Quand vous cliquez sur l'icone de l'extension, l'editeur s'ouvre comme une page web complete (pas un petit popup). La page contient ces zones :

- **Top bar**
  - Bouton **Instruction Manual** (ce document)
  - Selecteur **Language**
- **Left panel — Block Groups**
  - Liste de vos groupes de blocage. Chaque carte affiche le nom du groupe, une courte ligne de resume, et une case a cocher d'activation/desactivation.
  - Le bouton **Add** cree un nouveau groupe. Le menu deroulant a cote choisit le type.
  - **Delete All** supprime tous les groupes, avec confirmations supplementaires si un groupe est gele.
  - Vous pouvez faire glisser la poignee `::` d'une carte vers le haut ou le bas pour reordonner les groupes.
  - Vous pouvez faire glisser le separateur vertical pour redimensionner ce panneau.
- **Right panel — Editor**
  - Edite le groupe actuellement selectionne : nom, comportement de blocage, blocklists, filtres specifiques au type, planning, freeze, snooze.
  - Toutes les modifications sont enregistrees automatiquement une fraction de seconde apres que vous arretez de taper ou d'interagir.
- **Toast** (popup centre qui s'efface)
  - Affiche des messages d'etat tels que "Saved changes" ou des erreurs d'entree.

Pendant qu'une page est bloquee ou a une minuterie active, un overlay apparait en haut a gauche, affichant toutes les contraintes de temps qui l'affectent actuellement, au format `hh:mm:ss` (ou `mm:ss`). Plusieurs contraintes s'empilent sur plusieurs lignes.

---

## 3. Quick start

1. Cliquez sur l'icone de l'extension. L'editeur s'ouvre en page complete.
2. Dans le panneau **Block Groups**, choisissez un type de groupe dans la liste deroulante :
   - `Default`, `YouTube`, `TikTok`, `Facebook`, `Instagram`, `Twitch`, `Reddit`, ou `Custom`.
3. Cliquez sur **Add**. Un nouveau groupe apparait, et l'editeur l'ouvre.
4. Donnez-lui un nom.
5. Remplissez les champs specifiques au type (pour `Default`, c'est la liste **Blocked websites**).
6. Assurez-vous que la case du groupe dans le panneau de gauche est activee.
7. Visitez un des sites listes. Le blocage devrait s'appliquer immediatement.

C'est tout le happy path. Le reste de ce manuel ajoute simplement des options par-dessus.

---

## 4. Block groups overview

Tout dans cette extension est organise en **block groups**. Un block group est un ensemble de regles :

- Il a un nom, un type et un etat active/desactive.
- Il a un comportement de blocage (immediat ou apres un certain nombre de minutes).
- Il a un planning optionnel (jours + plages horaires) et des controles freeze/snooze optionnels.
- Selon le type, il a des champs supplementaires comme une liste de sites, des filtres d'auteurs YouTube, des noms de subreddits ou une fonction JavaScript.

Vous pouvez avoir autant de groupes que vous voulez. Plusieurs groupes peuvent s'appliquer a la meme page ; dans ce cas, la regle la **plus stricte** gagne :

- "Block immediately" l'emporte sur "block after some time".
- Un groupe avec moins de temps restant l'emporte sur un groupe avec plus de temps restant.

Donc ajouter plus de groupes ne peut que bloquer une page plus tot, jamais plus tard.

Vous pouvez faire glisser les groupes via leur poignee `::` pour les reordonner. L'ordre ne change pas la regle la plus stricte, mais controle la facon dont la liste se lit de haut en bas.

---

## 5. Types de groupes

### 5.1 `Default` — bloquer des sites web classiques

Pour bloquer des domaines specifiques (cas d'usage typique).

- **Blocked websites** : un site par ligne. `facebook.com` et `https://www.facebook.com/somepage` fonctionnent ; l'extension extrait et normalise le hostname.
- Une regle de site s'applique a ce hostname et a tous ses sous-domaines.
- Ce type de groupe utilise le blocage reseau natif de Chrome, similaire a `ERR_BLOCKED_BY_CLIENT`. Cela signifie que la navigation vers une URL bloquee est arretee avant meme le chargement de la page.

### 5.2 `YouTube` — bloquer YouTube et des sites video similaires

Ajoute une section **Filters** dans l'editeur :

- **Content type** :
  - `Apply to all YouTube pages` — toutes les pages YouTube comptent.
  - `Apply to Shorts` — seules les pages Shorts comptent.
  - `Apply to long videos` — uniquement `/watch`, `/live/`, `/embed/`, etc.
  - `Apply to YouTube posts` — publications de communaute (`/post/...`, onglets community/posts de chaine).
- **Author filter** :
  - `Do not filter by author` — l'identite de l'auteur n'a pas d'importance.
  - `Apply to certain authors` — seuls les auteurs listes declenchent ce groupe.
  - `Apply to all except certain authors` — les auteurs listes sont exemptes.
- **Authors** : un auteur par ligne. Accepte `@handle`, URL completes, `/channel/UC...`, `/c/...`, `/user/...`.
- **Hide blocked entries in the YouTube feed** : pendant que ce groupe bloque activement, les cartes correspondantes dans les feeds YouTube sont masquees. Quand le blocage devient inactif, elles reviennent au prochain refresh.

Pour les types de contenu Shorts et Posts, quand aucun filtre auteur n'est defini et que le groupe bloque actuellement, l'extension masque aussi les entrees de navigation pertinentes (entree Shorts de la barre laterale, onglets Community/Posts de chaine) et les sections correspondantes comme "Latest YouTube posts".

La detection short-vs-long s'etend aussi a d'autres sites video comme TikTok, Vimeo, Twitch clips/VODs et Dailymotion quand leur forme de page peut etre detectee.

### 5.3 `TikTok` — bloquer le contenu TikTok

Meme carte d'editeur que l'editeur video de plateforme, mais avec des libelles specifiques a TikTok :

- Types de contenu : short videos, videos, profile pages.
- Auteurs : handles TikTok (`@handle`) ou URL de profil.
- Le masquage de feed cache les cartes correspondantes sur les pages TikTok pendant que le groupe est actif.

### 5.4 `Facebook` — bloquer le contenu Facebook

- Types de contenu : Reels, videos, posts.
- Auteurs : nom de page (`page.name`), URL de profil, ou forme `profile.php?id=...` (l'id numerique est conserve sous `id:<number>`).
- Le masquage de feed cache les cartes correspondantes sur Facebook.

### 5.5 `Instagram` — bloquer le contenu Instagram

- Types de contenu : Reels, videos, posts.
- Auteurs : handles Instagram ou URL de profil.
- Les chemins reserves comme `/reel/`, `/p/`, `/tv/`, `/explore/` ne sont pas traites comme des auteurs.
- Le masquage de feed cache les cartes correspondantes sur Instagram.

### 5.6 `Twitch` — bloquer le contenu Twitch

- Types de contenu : clips, streams/VODs, pages de chaine.
- Auteurs : noms de chaine ou URL de chaine.
- Les chemins reserves comme `/directory`, `/videos`, `/settings`, etc. ne sont pas traites comme des noms de chaine.
- Le masquage de feed cache les cartes correspondantes sur Twitch.

### 5.7 `Reddit` — bloquer Reddit ou des subreddits specifiques

- **Subreddits** : un subreddit par ligne. Liste vide = le groupe s'applique a tout Reddit. `productivity` et `r/productivity` sont tous deux acceptes.

### 5.8 `Custom` — bloquer via une fonction JavaScript

Vous ecrivez une fonction JavaScript. L'extension l'appelle environ chaque seconde et utilise ce qu'elle retourne comme blocklist actuelle.

Les groupes `Custom` n'affichent pas : comportement de blocage, sites bloques, minutes autorisees, intervalle de reset, jours de planning ou plages horaires. Ils ont seulement une grande entree — la fonction **Blocking Rules** — plus les controles freeze/snooze standard.

Voir **Section 11** pour la reference complete des regles custom et de l'API helpers.

---

## 6. Comportement de blocage

Pour la plupart des types de groupes, vous choisissez un des deux modes :

### 6.1 Bloquer immediatement

La regle est active chaque fois que le groupe est active, que le planning l'autorise, et (pour les groupes de plateforme) que la page correspond.

Pour les groupes `Default`, cela utilise le blocage natif de Chrome. Pour les groupes de plateforme, cela utilise la logique d'overlay/sortie dans la page.

### 6.2 Bloquer apres un certain nombre de minutes

C'est un budget d'utilisation.

- **Allowed minutes before block** (decimal) : combien de minutes vous vous autorisez par periode. Exemple : `15`, `0.5`, `90`.
- **Timer reset interval (hours)** (decimal) : frequence de reinitialisation du budget. Exemple : `24` pour quotidien, `1` pour horaire, `0.25` pour toutes les 15 minutes.

Tant qu'il reste du temps, la page fonctionne normalement et affiche l'overlay de minuterie. Quand le budget atteint zero, la page est bloquee pour le reste de la periode et l'overlay affiche `0:00`, puis l'onglet tente de quitter.

L'extension fonctionne par groupe et par periode :

- Chaque groupe a son propre budget.
- Le temps passe sur toute page correspondant au groupe est compte dans le budget de ce groupe.
- Plusieurs onglets du meme groupe partagent le budget. Leurs minuteries restent synchronisees ; basculer vers un autre onglet force aussi un refresh pour afficher immediatement le temps partage courant.

Si plusieurs groupes limites dans le temps s'appliquent a la meme page, le plus strict gagne.

---

## 7. Planning

Dans la carte **Schedule**, vous pouvez restreindre quand un groupe est actif :

- **Days to block** : choisissez les jours ou le groupe s'applique. Les jours non coches signifient que le groupe est inactif ce jour-la.
- **Time windows** : liste libre, une plage par ligne au format `HHMM-HHMM`, par exemple :

  ```
  0900-1000
  1200-1300
  ```

  Le groupe est actif uniquement dans ces plages. Une liste vide signifie toute la journee.

Cela s'applique a tous les types de groupes sauf `Custom`.

---

## 8. Freeze (anti-contournement)

Le gel rend un groupe difficile a desactiver sur une impulsion.

Dans la carte **Freeze**, vous choisissez :

- **Frozen** — vous ne pouvez pas modifier ou supprimer le groupe, et vous ne pouvez pas decocher son toggle d'activation. Pour changer quoi que ce soit, vous devez suivre le rituel de de-gel (voir ci-dessous).
- **Strict frozen** — identique a Frozen, mais reste verrouille pendant un nombre d'heures choisi (decimal, jusqu'a 72). Tant que ce timer n'est pas expire, meme le rituel de de-gel est indisponible.

Quand un groupe gele est deverrouillable, le bouton **Unfreeze** apparait. Le clic lance le **20-step ritual** :

- La fenetre modale affiche un message d'autodiscipline.
- Vous devez cliquer sur `Confirm` 20 fois.
- Il y a une attente forcee de 5 secondes entre les clics.
- Si vous annulez a n'importe quel moment, vous devez recommencer a l'etape 1.
- Les 20 messages tournent pour que vous les lisiez vraiment.

Si le groupe est aussi marque "no snooze" (voir section suivante), vous ne pouvez pas non plus le snoozer pendant qu'il est gele.

Le statut de gel est affiche dans la ligne meta de la carte du groupe, y compris le temps restant pour le gel strict.

---

## 9. Snooze (desactivation temporaire)

Snooze desactive temporairement un groupe sans le de-geler, mais seulement avec une justification ecrite.

Dans la carte **Snooze** :

- **Allow snooze for this group** — si desactive, ce groupe ne peut pas etre snooze du tout (y compris quand il est gele).
- **Snooze for (minutes)** — decimal, duree du snooze.
- **Reason** — doit contenir **au moins 100 caracteres et plus de 20 mots**. Le bouton Start reste desactive tant que les deux conditions ne sont pas remplies. Si la regle echoue, un avertissement inline apparait a cote du bouton.

Si le groupe est gele, les minutes de snooze sont verrouillees a la valeur choisie avant le gel. Vous pouvez toujours le snoozer, tant que le snooze est autorise et que la justification respecte les regles.

Un message d'etat confirme le snooze. Quand le snooze se termine, le groupe revient automatiquement a la normale.

Vous pouvez aussi terminer un snooze plus tot avec le bouton **End Snooze**.

---

## 10. Actions de masse

- **Delete All** supprime tous les groupes.
  - Une confirmation est toujours demandee.
  - Si au moins un groupe est gele, cela exige le meme 20-step ritual que le de-gel.
  - Si un groupe est strict-frozen et toujours verrouille, **Delete All** est desactive.

---

## 11. Groupes custom (reference complete)

Un groupe `Custom` execute une fonction JavaScript dans le service worker d'arriere-plan. La fonction est appelee environ chaque seconde, et l'extension utilise ce qu'elle retourne pour decider quels domaines doivent etre bloques maintenant.

### 11.1 Signature de fonction

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  // your logic
  return blockedDomains;
}
```

Parametres :

- `month` — de `1` a `12`.
- `dayOfMonth` — de `1` a `31`.
- `dayName` — par exemple `"Monday"`.
- `hour` — de `0` a `23`.
- `minute` — de `0` a `59`.
- `blockedDomains` — la liste courante de domaines deja produite par d'autres regles. Vous pouvez y ajouter, la remplacer, ou l'ignorer.
- `helpers` — un ensemble d'objets helper (voir ci-dessous).

Valeur de retour :

- Un tableau de chaines de domaines a bloquer maintenant, OU
- rien (dans ce cas l'extension utilise l'etat de `blockedDomains` apres vos mutations).

La fonction est validee a l'enregistrement. Les erreurs de syntaxe produisent un avertissement de statut, et la regle n'est pas utilisee tant que vous ne la corrigez pas. Si votre fonction lance une erreur a l'execution, l'extension la capture, ecrit dans la console de fond, et revient au resultat precedent.

### 11.2 Planification adaptative

Les regles custom s'executent normalement environ chaque seconde. Si votre regle commence a prendre trop de temps, l'extension ralentit automatiquement la boucle (jusqu'a environ toutes les 5 secondes). Vous n'avez rien a gerer vous-meme.

### 11.3 Objet `helpers`

Dans la fonction, `helpers` expose plusieurs sous-helpers. Chacun a un nom long et un alias court. Il y a aussi des getter methods explicites :

- `helpers.timerHelper` / `helpers.timer` / `helpers.getTimerHelper()`
- `helpers.persistenceHelper` / `helpers.persistence` / `helpers.getPersistenceHelper()`
- `helpers.domainHelper` / `helpers.domain` / `helpers.getDomainHelper()`
- `helpers.logHelper` / `helpers.log` / `helpers.getLogHelper()`
- `helpers.platformHelper` / `helpers.platform` / `helpers.getPlatformHelper()`
- `helpers.now` — temps epoch courant en millisecondes.

Toutes les methodes helper sont concues pour etre sures : les mauvais parametres retournent `null`, `false` ou une valeur vide au lieu de lancer une exception.

#### 11.3.1 `timerHelper`

Gere des minuteries decompte liees a un domaine. Les minuteries persistent entre redemarrages du navigateur. Chaque minuterie appartient au groupe custom qui l'a creee.

- `createTimer(domain, durationMs, displayName?)` — cree et retourne un id de minuterie unique, ou `null` si invalide. Exemple : `createTimer("youtube.com", 30 * 60 * 1000, "Timer1")`. Tant que l'utilisateur est sur une page correspondant a ce domaine, l'overlay dans la page affiche `Timer1: 30:00` et decompte.
- `deleteTimer(id)` — supprime la minuterie. Retourne `true` en cas de succes.
- `pauseTimer(id)` — met le decompte en pause.
- `continueTimer(id)` / `resumeTimer(id)` — reprend une minuterie en pause.
- `resetTimer(id, durationMs?)` — redemarre la minuterie. Sans `durationMs`, reutilise la duree d'origine.
- `addMs(id, ms)` — ajoute des millisecondes (ou soustrait avec des valeurs negatives).
- `remainingMs(id)` — millisecondes restantes.
- `isExpired(id)` / `isPaused(id)` / `exists(id)` — booleens.
- `getDomain(id)` / `getDisplayName(id)` — lit les infos de la minuterie.
- `findByDomain(domain)` — tableau d'ids de minuterie pour ce domaine.
- `list()` — tableau de `{ id, domain, displayName, durationMs, remainingMs, isPaused }` pour chaque minuterie possedee par ce groupe.

La duree maximale d'une minuterie est d'environ 30 jours.

#### 11.3.2 `persistenceHelper`

Stockage type map scope au groupe. Les valeurs doivent etre JSON-serialisables. Utile pour memoriser un etat entre les appels.

- `set(key, value)` — stocke n'importe quelle valeur JSON. Retourne `true` en cas de succes.
- `get(key, defaultValue?)` — retourne la valeur stockee, ou `defaultValue` si absente.
- `has(key)` / `delete(key)` / `keys()` / `entries()` / `size()` / `clear()`.

Limites souples : environ 200 cles par groupe, 16 KB par valeur.

#### 11.3.3 `domainHelper`

- `normalize(value)` — retourne le domaine canonique comme `youtube.com`, ou `null`.
- `matches(hostname, site)` — `true` si `hostname` appartient a `site` (gere les sous-domaines).

#### 11.3.4 `logHelper`

- `log(...args)`, `warn(...args)`, `error(...args)` — ecrivent dans la console de fond.

Pour voir ces messages : `chrome://extensions` -> activez Developer Mode -> cliquez sur le lien "service worker" de l'extension.

#### 11.3.5 `platformHelper`

Inspecte les plateformes sociales/video prises en charge.

- `supportedPlatforms` — `["youtube", "tiktok", "facebook", "instagram", "twitch"]`.
- `normalizePlatform(value)` — retourne le nom canonique de plateforme, ou `null`.
- `normalizeAuthor(author, platform)` — normalise un identifiant d'auteur (handle, URL, etc.) pour une plateforme specifique, ou `null`.
- `detect(urlOrHost)` / `getContext(urlOrHost)` — retourne `{ platform, hostname, pathname, type, authors, url }`, ou `null`.
  - `type` est `"short" | "long" | "post" | "unknown"`.
  - `authors` est la liste des auteurs normalises detectables depuis cette URL.
- `getType(urlOrHost)` — raccourci de `detect(...).type`.
- `getPlatform(urlOrHost)` — raccourci de `detect(...).platform`.
- `getAuthors(urlOrHost)` — raccourci de `detect(...).authors`.
- `matchesAuthor(urlOrHost, platform, authors)` — retourne `true` si l'URL est sur cette plateforme et qu'un des auteurs fournis correspond.

### 11.4 Exemples

Facile : bloquer les reseaux sociaux le matin en semaine.

```js
(month, dayOfMonth, dayName, hour, minute, blockedDomains, helpers) => {
  const isWeekday = !["Saturday", "Sunday"].includes(dayName);

  if (isWeekday && hour >= 9 && hour < 12) {
    return [...blockedDomains, "facebook.com", "instagram.com", "tiktok.com"];
  }

  return blockedDomains;
}
```

Moyen : 30 minutes de YouTube par session navigateur, avec decompte visible.

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

Plus difficile : ne bloquer une session TikTok que si ce sont des short videos ET si l'auteur est dans votre liste de distractions. Utilisez `platformHelper`.

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

(`globalThis.location` est juste un exemple placeholder — normalement vous piloterez `platformHelper` avec votre propre logique, pas avec la location du worker, car le worker d'arriere-plan n'a pas de vraie URL de page.)

Le plus difficile : "site of the day" rotatif avec quota quotidien, persiste a travers les redemarrages.

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

## 12. Comportement multi-pages

- Tous les onglets ouverts du meme groupe partagent la meme minuterie.
- Quand vous passez a un onglet du meme groupe, son overlay se rafraichit immediatement pour afficher le temps partage actuel.
- Quand une nouvelle regle est ajoutee, chaque page ouverte detecte le changement et se rafraichit en une fraction de seconde ; vous n'avez pas besoin de recharger les onglets manuellement.
- Quand une regle expire, les cartes de feed et boutons de navigation masques sont restaures au prochain refresh.

---

## 13. Internationalisation

Toute l'UI est completement traduite. Utilisez le selecteur **Language** en haut a droite.

Les langues prises en charge incluent English, Chinese (Simplified), Spanish, Japanese, Korean, plus une couverture partielle pour Hindi, Arabic, Bengali, Portuguese, Russian, Punjabi, German, French, Turkish, Vietnamese, Italian, Thai, Dutch, Polish, Indonesian, Urdu et Persian. Les langues avec couverture partielle utilisent l'anglais en fallback pour les chaines manquantes.

Le manuel lui-meme charge le fichier markdown correspondant a votre langue selectionnee, avec l'anglais comme fallback.

---

## 14. Messages d'etat

Les messages d'etat apparaissent comme un toast centre qui s'efface apres environ deux secondes :

- "Saved changes."
- "Created \"Group name\"."
- Erreurs de validation comme "Allowed minutes must be a number greater than 0."
- "Snooze minutes must be a number greater than 0."
- "Frozen groups cannot be changed."

Pour les champs avec exigence de format, le message apparait aussi a cote du bouton concerne (pour snooze).

---

## 15. Confidentialite et stockage

- Tout est stocke localement dans `chrome.storage.local`. Aucune donnee n'est envoyee ailleurs.
- Les elements stockes incluent : vos groupes, minuteries d'usage, derniers temps de reset, enregistrements snooze, minuteries custom et valeurs persistantes custom.
- L'extension ne lit pas le contenu des pages au-dela de ce qui est necessaire pour detecter le type de page (path/hostname/known DOM markers for video sites). Elle ne lit pas vos messages, posts, commentaires ou contenus prives.

---

## 16. Permissions

- `storage` — pour les donnees ci-dessus.
- `declarativeNetRequest` — pour le blocage natif des groupes `Default`.
- `alarms` — pour planifier efficacement les transitions de regles.
- `host_permissions: <all_urls>` — pour que le content script puisse afficher l'overlay de minuterie et detecter le contexte de plateforme sur n'importe quelle page.

---

## 17. Depannage

- **Un groupe que j'ai ajoute ne fait rien.** Verifiez que le groupe est active, que le planning l'autorise maintenant, qu'aucun snooze n'est actif, et (pour les groupes de plateforme) que la page correspond bien au type de contenu et au filtre auteur choisis.
- **Une minuterie est bloquee ou incorrecte sur un onglet.** Changez d'onglet puis revenez, ou mettez l'onglet au focus — cela declenche un refresh force depuis la minuterie partagee.
- **Des cartes de feed reapparaissent alors qu'elles devraient etre masquees.** Le masquage de feed ne fonctionne que pendant que la regle bloque activement. Si vous avez une regle `after-minutes`, le masquage se declenche quand votre temps atteint zero.
- **Un bouton de navigation YouTube que j'attendais masque est toujours la.** Le masquage de navigation exige "do not filter by author" et un type de contenu Shorts ou YouTube posts. Avec des filtres auteur, le masquage est uniquement carte par carte.
- **La regle custom n'a rien fait ou a echoue silencieusement.** Ouvrez `chrome://extensions`, activez Developer Mode, cliquez sur le lien "service worker" de l'extension, et verifiez la console. Utilisez `helpers.logHelper.log(...)` pour tracer votre regle.
- **Je ne peux pas supprimer un groupe.** Il est probablement gele. Les groupes strict-frozen ne peuvent pas etre supprimes tant que leur verrou n'expire pas ; les groupes frozen non strict peuvent etre supprimes via le rituel de de-gel.

---

## 18. Glossaire

- **Block group** — un ensemble de regles avec son propre type, comportement, planning et freeze/snooze.
- **Instant block** — la regle bloque immediatement chaque fois qu'elle est active.
- **After-minutes block** — la regle commence a bloquer seulement apres epuisement du budget de temps de la periode.
- **Reset interval** — frequence de reinitialisation du budget after-minutes.
- **Schedule** — jours + plages horaires pendant lesquels un groupe est actif.
- **Freeze / Strict freeze** — etats anti-contournement.
- **Snooze** — desactivation temporaire avec justification ecrite.
- **Author filter** — pour les groupes de plateforme, limite la regle a certains createurs de contenu.
- **Content type** — pour les groupes de plateforme, limite la regle a certaines formes de contenu (short, long, post).
- **Helpers** — utilitaires passes a la fonction d'une regle custom.
- **Platform** — l'une de `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Chacune a son propre type de groupe et sa logique de masquage de feed.

---

## 19. Limitations

- Le masquage de feed depend du DOM actuel de chaque plateforme. Si la plateforme change sa mise en page, les selecteurs de masquage peuvent devoir etre mis a jour.
- La detection de contexte de plateforme pour les sites non YouTube est principalement basee sur l'URL, donc elle est la plus fiable sur les URL de contenu canoniques.
- Les boucles de regles custom s'executent dans le worker d'arriere-plan, pas dans les pages, donc les informations au niveau DOM ne sont pas disponibles dans la fonction. Utilisez plutot `platformHelper.detect(url)` avec une chaine URL.
- Le navigateur peut suspendre le service worker en inactivite. L'extension le reprend des qu'une page ou une alarme en a besoin ; les minuteries d'usage ne perdent pas en precision pour cette raison.

