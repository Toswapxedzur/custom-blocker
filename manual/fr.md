# Bloqueur Web personnalisé — Manuel d'instructions

Ceci est le manuel de référence complet de l’extension. Cela commence par les flux de travail les plus simples et les plus courants et passe progressivement à des sujets avancés tels que les règles de blocage personnalisées basées sur les événements et l'API d'assistance.

Si vous êtes nouveau, lisez simplement **Démarrage rapide** et **Présentation des groupes de blocs**. Tout ce qui se trouve en dessous de ces sections est facultatif, selon ce que vous souhaitez faire.

---

## 1. Que fait cette extension

Custom Web Blocker vous permet de bloquer les sites Web et les distractions en ligne selon des règles que vous définissez vous-même. Vous pouvez :

- Bloquez immédiatement les sites avec le blocage réseau natif du navigateur (le même type de blocage qui produit `ERR_BLOCKED_BY_CLIENT`).
- Accordez-vous un certain nombre de minutes par jour sur un site, puis bloquez-le dès que vous dépassez cette limite.
- Bloquez des types spécifiques de contenu sur plateforme vidéo, TicToc, réseau social bleu, Insta localisé, plateforme de direct et forum communautaire (pas sur l'ensemble du site).
- Masquez le contenu bloqué des flux sur les plates-formes prises en charge au lieu de bloquer uniquement des pages individuelles.
- Planifiez le moment où une règle est active par jour de la semaine et par fenêtres horaires `HHMM-HHMM`.
- Gelez une règle afin de ne pas pouvoir la modifier facilement. Un gel strict le verrouille pendant un nombre d'heures spécifié et nécessite un rituel de confirmation en 20 étapes pour l'annuler.
- Répéter temporairement une règle, mais seulement après avoir rédigé une justification suffisamment longue.
- Écrivez des règles personnalisées **basées sur les événements** en langage de script avec des aides pour les minuteries avant/arrière, le stockage persistant par groupe, les intentions DOM par plate-forme (masquer les boutons de navigation, masquer les cartes de flux par prédicat, définir les minuteries par sous-section), les utilitaires d'URL et la journalisation structurée.
- Choisissez parmi une bibliothèque intégrée de plus de 50 modèles prêts à l'emploi (minuteries, plannings, masquage de flux, sessions de focus, redirections, nudges, persistance, ajustements DOM, aides au débogage).
- Utilisez l'extension dans plus de 20 langues.

L'extension est une extension navigateur de Google Manifest V3 avec une page d'éditeur (la fenêtre contextuelle), un travailleur de service en arrière-plan, un bac à sable hors écran qui héberge le code de règles personnalisées et un script de contenu qui s'exécute dans chaque page. Les règles personnalisées résident dans le bac à sable hors écran ; ils sont chargés une fois par clic d'exécution et restent enregistrés jusqu'à ce que la règle soit désactivée ou supprimée.

---

## 2. Visite guidée de l'interface utilisateur

Lorsque vous cliquez sur l'icône de l'extension, l'éditeur s'ouvre sous la forme d'une page Web complète (et non d'une petite fenêtre contextuelle). La page comporte ces zones :

- **Barre supérieure**
  - Bouton **Manuel d'instructions** (ce document)
  - Sélecteur de **langue**
  - Équipement **Paramètres** (bascules avancées, y compris **Mode débogage**)
- **Panneau de gauche — Groupes de blocs**
  - Liste de vos groupes de blocs. Chaque carte affiche le nom du groupe, une courte ligne de résumé et une case à cocher activer/désactiver.
  - Le bouton **Ajouter** crée un nouveau groupe. La liste déroulante à côté sélectionne le type.
  - **Supprimer tout** supprime chaque groupe, avec des confirmations supplémentaires si un groupe est gelé.
  - Vous pouvez faire glisser la poignée `::` sur une carte vers le haut ou vers le bas pour réorganiser les groupes.
  - Vous pouvez faire glisser le séparateur vertical pour redimensionner ce panneau.
- **Panneau droit — Éditeur**
  - Modifie le groupe actuellement sélectionné : nom, comportement de blocage, listes de blocage, filtres spécifiques au type, planification, gel, répétition.
  - Toutes les modifications sont automatiquement enregistrées une fraction de seconde après que vous ayez arrêté de taper ou d'interagir.
  - Pour les groupes **Personnalisés**, l'éditeur affiche également le navigateur **Modèles**, le bouton **Exécuter** et le panneau **Journal** (renommé *Journal d'activité* dans la version 1.1).
- **Toast** (popup centré qui disparaît) : affiche des messages d'état tels que "Modifications enregistrées". ou des erreurs de saisie.
- **Superposition sur la page** — lorsqu'un onglet a une minuterie ou un bloc actif, une superposition apparaît dans son coin supérieur gauche montrant chaque contrainte l'affectant au format `hh:mm:ss` (ou `mm:ss`). Plusieurs contraintes s'empilent sur plusieurs lignes. Les comptes à rebours par défaut des groupes de blocs et les minuteries de règles personnalisées partagent cette superposition.

---

## 3. Démarrage rapide1. Cliquez sur l'icône d'extension. L'éditeur s'ouvre en pleine page.
2. Dans le panneau **Bloquer les groupes**, choisissez un type de groupe dans la liste déroulante :
   - `Default`, `plateforme vidéo`, `TicToc`, `réseau social bleu`, `Insta localisé`, `plateforme de direct`, `forum communautaire` ou `Custom`.
3. Cliquez sur **Ajouter**. Un nouveau groupe apparaît et l'éditeur l'ouvre.
4. Donnez-lui un nom.
5. Remplissez les champs spécifiques au type (pour `Default`, cela signifie la liste des **Sites Web bloqués**).
6. Assurez-vous que la case du groupe dans le panneau de gauche est activée.
7. Visitez l'un des sites répertoriés. Le blocage devrait prendre effet immédiatement.

C'est tout le chemin du bonheur. Le reste de ce manuel ne contient que des options supplémentaires.

> Lorsque vous appuyez sur **Exécuter** sur un groupe personnalisé, la nouvelle règle s'attache aux **futurs** événements de page. Les onglets déjà ouverts continuent d'exécuter la règle précédente jusqu'à ce que vous les rechargez. La fenêtre contextuelle affiche un rappel à cet effet après chaque exécution réussie.

---

## 4. Aperçu des groupes de blocs

Tout dans cette extension est organisé en **groupes de blocs**. Un groupe de blocs est un ensemble de règles :

- Il a un nom, un type et un état activé/désactivé.
- Il a un comportement bloquant (immédiat, après un certain nombre de minutes ou compte à rebours fixe).
- Il dispose d'un calendrier optionnel (jours + fenêtres horaires) et de commandes de gel/répétition optionnelles.
- Selon le type, il comporte des champs supplémentaires comme une liste de sites Web, des filtres de créateur plateforme vidéo, des noms de subreddit ou une règle langage de script basée sur des événements.

Vous pouvez avoir n'importe quel nombre de groupes. Plusieurs groupes peuvent postuler à la même page ; dans ce cas, la règle **la plus stricte** l'emporte :

- "Bloquer immédiatement" bat "bloquer après un certain temps".
- Un groupe avec moins de temps restant bat un groupe avec plus de temps restant.

Ainsi, l’ajout de groupes supplémentaires ne peut que bloquer une page plus tôt, jamais plus tard.

**L'ordre d'évaluation est de bas en haut.** Lorsque l'extension parcourt vos groupes de blocs, elle commence par le groupe en bas de la liste et progresse vers le haut. Le groupe en haut de la liste est évalué en dernier et obtient le « dernier mot » — par exemple, si un groupe du bas appelle `helpers.getPlatformHelper().youtube().hideShortButton()` et qu'un groupe du haut appelle `showShortButton()`, le bouton reste visible. Faites glisser la poignée `::` sur une carte pour modifier cet ordre.

---

## 5. Types de groupes

### 5.1 `Default` — bloque les sites Web ordinaires

Pour bloquer des domaines spécifiques (le cas d'utilisation typique).

- **Sites Web bloqués** : un site par ligne. `facebook.com` et `https://www.facebook.com/somepage` fonctionnent ; l'extension extrait et normalise le nom d'hôte.
- Une règle de site s'applique à ce nom d'hôte et à tous ses sous-domaines.
- Ce type de groupe utilise le blocage de réseau natif de navigateur de Google, similaire à `ERR_BLOCKED_BY_CLIENT`. Cela signifie que la navigation vers une URL bloquée est arrêtée avant même le chargement de la page.

### 5.2 `plateforme vidéo` — bloque plateforme vidéo et les sites vidéo similaires

Ajoute une section **Filtres** à l'éditeur :

- **Type de contenu** :
  - `Apply to all plateforme vidéo pages` — chaque page plateforme vidéo compte.
  - `Apply to Shorts` : seules les pages de courts métrages comptent.
  - `Apply to long videos` — uniquement `/watch`, `/live/`, `/embed/`, etc.
  - `Apply to plateforme vidéo posts` — publications de la communauté (`/post/...`, onglets communauté/publications de la chaîne).
- **Filtre auteur** :
  - `Do not filter by author` — l'identité de l'auteur n'a pas d'importance.
  - `Apply to certain authors` — seuls les auteurs répertoriés déclenchent ce groupe.
  - `Apply to all except certain authors` — les auteurs répertoriés sont exemptés.
- **Auteurs** : un auteur par ligne. Accepte `@handle`, les URL complètes, `/channel/UC...`, `/c/...`, `/user/...`.
- **Masquer les entrées bloquées dans le flux plateforme vidéo** : pendant que ce groupe bloque activement, les cartes correspondantes dans les flux plateforme vidéo sont masquées. Lorsque le bloc devient inactif, ils reviennent au prochain rafraîchissement.

Pour les types de contenu Shorts et Posts, lorsqu'aucun filtre d'auteur n'est défini et que le groupe est actuellement bloqué, l'extension masque également les entrées de navigation pertinentes (entrée de la barre latérale Short, onglets de chaîne Communauté/Posts) et les étagères correspondantes telles que « Dernières publications plateforme vidéo ».

La détection courte/longue s'étend à d'autres sites vidéo tels que TicToc, Vimeo, plateforme de direct clips/VOD et Dailymotion lorsque leur forme de page peut être détectée.

### 5.3 `TicToc` — bloquer le contenu TicToc

Même fiche d'éditeur que l'éditeur vidéo de la plateforme, mais avec des étiquettes spécifiques à TicToc :- Types de contenu : courtes vidéos, vidéos, pages de profil.
- Auteurs : identifiants TicToc (`@handle`) ou URL de profil.
- Le masquage du flux masque les cartes correspondantes sur les pages TicToc pendant que le groupe est actif.

### 5.4 `réseau social bleu` — bloquer le contenu réseau social bleu

- Types de contenu : Reels, vidéos, publications.
- Auteurs : nom de la page (`page.name`), URL du profil ou formulaire `profile.php?id=...` (l'identifiant numérique est conservé sous la forme `id:<number>`).
- Le masquage du flux masque les cartes de flux correspondantes sur réseau social bleu.

### 5.5 `Insta localisé` — bloquer le contenu Insta localisé

- Types de contenu : Reels, vidéos, publications.
- Auteurs : identifiants Insta localisé ou URL de profil.
- Les chemins réservés comme `/reel/`, `/p/`, `/tv/`, `/explore/` ne sont pas traités comme des auteurs.
- Le masquage du flux cache les cartes correspondantes sur Insta localisé.

### 5.6 `plateforme de direct` — bloquer le contenu plateforme de direct

- Types de contenu : clips, flux/VOD, pages de chaînes.
- Auteurs : noms de chaînes ou URL de chaînes.
- Les chemins réservés comme `/directory`, `/videos`, `/settings`, etc. ne sont pas traités comme des noms de canaux.
- Le masquage du flux cache les cartes correspondantes sur plateforme de direct.

### 5.7 `forum communautaire` — bloque forum communautaire ou des sous-reddits spécifiques

- **Subreddits** : un subreddit par ligne. La liste vide signifie que le groupe s'applique à l'ensemble de forum communautaire. `productivity` et `r/productivity` sont acceptés.

### 5.8 `Custom` — blocage par langage de script piloté par les événements

Vous écrivez une fonction langage de script qui **enregistre les gestionnaires** pour des événements tels que l'ouverture de page, la modification d'URL, le battement de page, la fin du minuteur et vos propres événements personnalisés. La fonction s'exécute une fois par clic sur Exécuter ; les gestionnaires enregistrés restent actifs dans toutes les navigations jusqu'à ce que vous appuyiez à nouveau sur Exécuter, désactiviez le groupe ou le supprimiez.

Les groupes `Custom` n'affichent pas : comportement de blocage, sites bloqués, minutes autorisées, intervalle de réinitialisation, jours de programmation ou fenêtres horaires. Ils conservent l'éditeur **Règles de blocage** ainsi que les commandes de gel/répétition standard. Il existe également un bouton **Modèles** qui ouvre un navigateur prédéfini avec des règles de démarrage paramétrées ; l'application d'un préréglage remplace la règle actuelle après confirmation.

Voir la **Section 11** pour la référence complète des règles personnalisées et l'API des assistants.

---

## 6. Comportement de blocage

Pour la plupart des types de groupes, vous choisissez l'un des trois modes.

### 6.1 Bloquer immédiatement

La règle est active chaque fois que le groupe est activé, que le planning le permet et (pour les groupes de plateforme) que la page correspond.

Pour les groupes `Default`, cela utilise le blocage natif de navigateur de Google. Pour les groupes de plates-formes, il utilise la logique de superposition/sortie sur la page.

### 6.2 Bloquer après quelques minutes

Il s'agit d'un budget d'utilisation.

- **Minutes autorisées avant le blocage** (décimal) : combien de minutes vous vous accordez par période. Exemple : `15`, `0.5`, `90`.
- **Intervalle de réinitialisation du minuteur (heures)** (décimal) : à quelle fréquence le budget est réinitialisé. Exemple : `24` pour une journée, `1` pour une heure, `0.25` pour toutes les 15 minutes.

Tant qu'il vous reste du temps, la page fonctionne normalement et affiche la superposition de la minuterie. Lorsque le budget atteint zéro, la page est bloquée pour le reste de la période et la superposition affiche `0:00`, puis l'onglet tente de quitter.

La prolongation s'effectue par groupe, par période :

- Chaque groupe a son propre budget.
- Le temps passé sur n'importe quelle page correspondant au groupe est pris en compte dans le budget de ce groupe.
- Plusieurs onglets du même groupe partagent le budget. Leurs minuteries restent synchronisées ; le passage à un autre onglet force également une actualisation afin qu'il affiche immédiatement l'heure partagée actuelle.

Si plusieurs groupes à durée limitée s'appliquent à la même page, le plus strict l'emporte.

### 6.3 Minuterie (compte à rebours, puis blocage)

Ce mode affiche un compte à rebours et se bloque une fois qu'il atteint `0:00`.

- **Intervalle de réinitialisation de la minuterie (heures)** (décimal) : à la fois la durée de la minuterie et la fréquence de réinitialisation. Exemple : `24` pour une journée, `1` pour une heure, `0.25` pour toutes les 15 minutes.

Contrairement au **Bloquer après un certain nombre de minutes**, ce mode ne dispose **pas** de champ distinct « Minutes autorisées avant le blocage ». La minuterie démarre simplement à l'intervalle de réinitialisation, compte à rebours pendant que les pages correspondantes sont ouvertes, puis se bloque jusqu'à la prochaine réinitialisation.Les comptes à rebours des groupes par défaut et les minuteries des groupes personnalisés (voir **Section 11.3.1**) **avancent uniquement lorsque l'onglet est visible**. Changer d'onglet, réduire la fenêtre ou verrouiller l'écran interrompt automatiquement le compte à rebours.

---

## 7. Calendrier

Dans la fiche **Planification**, vous pouvez restreindre le moment où un groupe est actif :

- **Jours à bloquer** : choisissez les jours auxquels le groupe s'applique. Les jours non cochés signifient que le groupe est inactif ce jour-là.
- **Fenêtres horaires** : liste de forme libre, une fenêtre par ligne au format `HHMM-HHMM`, par exemple :

  ```
  0900-1000
  1200-1300
  ```

  Le groupe est actif uniquement dans ces fenêtres. Une liste vide signifie toute la journée.

Cela s'applique à tous les types de groupes à l'exception de `Custom`. (Les règles personnalisées peuvent implémenter leur propre planification à l'aide de `ev.time.dayName` / `ev.time.hour` ; voir **Section 11.4**.)

---

## 8. Gel (anti-falsification)

Le gel rend un groupe difficile à désactiver de manière impulsive.

Dans la carte **Freeze**, vous choisissez :

- **Frozen** — vous ne pouvez pas modifier ou supprimer le groupe, et vous ne pouvez pas décocher sa bascule d'activation. Pour changer quoi que ce soit, vous devez exécuter le rituel de dégel (voir ci-dessous).
- **Congelé strictement** — identique à Gelé, mais il reste verrouillé pendant le nombre d'heures que vous choisissez (décimal, jusqu'à 72). Jusqu'à l'expiration de ce délai, même le rituel de dégel n'est pas disponible.

Lorsqu'un groupe gelé peut être déverrouillé, le bouton **Dégeler** apparaît. En cliquant dessus, vous démarrez le **rituel en 20 étapes** :

- Le modal affiche un message d'autodiscipline.
- Vous devez cliquer 20 fois sur `Confirm`.
- Il y a une attente forcée de 5 secondes entre les clics.
- Si vous annulez à tout moment, vous devez recommencer à partir de l'étape 1.
- Les 20 messages tournent pour que vous les lisiez réellement.

Si le groupe est également marqué « pas de répétition » (voir la section suivante), vous ne pouvez pas non plus le répéter lorsqu'il est gelé.

L'état du gel est affiché dans la méta-ligne de la carte de groupe, y compris le temps restant pour un gel strict.

---

## 9. Snooze (désactivation temporaire)

Snooze désactive temporairement un groupe sans le débloquer. Il prend en charge l'activation différée, le temps de recharge après la répétition, les étapes de confirmation et un total cumulé de temps de répétition.

Dans la carte **Snooze** :

- **Autoriser la répétition pour ce groupe** — si cette option est désactivée, ce groupe ne peut pas du tout être mis en veille (y compris lorsqu'il est gelé).
- **Répéter pendant (minutes)** – décimal, combien de temps dure la répétition.
- **Délai d'activation (minutes)** — décimal `>= 0`. Après avoir confirmé la répétition, le groupe continue de se bloquer jusqu'à ce que ce délai soit écoulé ; ce n'est qu'alors que la répétition devient active.
- **Cooldown après snooze (minutes)** — décimal de `0` à `5`. Une fois la répétition terminée, vous ne pouvez pas démarrer une autre répétition pour ce groupe jusqu'à la fin du temps de recharge.
- **Heures de confirmation** — entier `>= 0`. S'il s'agit de `0`, la répétition est programmée immédiatement. Sinon, démarrer la répétition lance un rituel de confirmation comportant exactement autant d’étapes.

Chaque étape de confirmation de répétition comporte une attente forcée de **5 secondes** avant que le prochain clic ne soit autorisé. Le modal vous l'indique explicitement et affiche le compte à rebours en direct sur le bouton.

Si le groupe est gelé, les paramètres de répétition sont verrouillés aux valeurs choisies avant le gel. Vous pouvez toujours le répéter, tant que la répétition est autorisée, mais vous devez utiliser les paramètres de délai / temps de recharge / confirmation enregistrés.

La carte Snooze affiche également la **durée totale de répétition** pour ce groupe. Ce total compte la durée totale de la répétition active même si le site devient accessible pour une autre raison pendant cette fenêtre.

Lorsqu'une répétition est terminée, la règle revient immédiatement. Si le groupe n'était pas déjà gelé, l'extension le gèle automatiquement à la fin de la répétition.

Un message d'état confirme la répétition. Lorsque la répétition est terminée, le groupe revient automatiquement à la normale.

Vous pouvez également mettre fin à une répétition plus tôt avec le bouton **Fin de la répétition**.

Pour les groupes personnalisés, appuyer sur **Démarrer Snooze** envoie également un événement `snoozePress` dans la règle (voir le tableau des événements dans la **Section 11**), afin qu'une règle personnalisée puisse enregistrer la presse, enregistrer une justification ou déclencher des événements de suivi. La règle n'a **pas d'API de répétition programmatique** : elle peut réagir à la presse, mais ne peut pas l'annuler ou la prolonger.

---

## 10. Actions groupées- **Supprimer tout** supprime tous les groupes.
  - Il demande toujours une confirmation.
  - Si au moins un groupe est gelé, cela nécessite le même rituel en 20 étapes que le dégel.
  - Si un groupe est strictement gelé et toujours verrouillé, **Supprimer tout** est désactivé.

---

## 11. Groupes personnalisés — référence basée sur les événements (v1.1+)

À partir de la version 1.1, les règles personnalisées sont **pilotées par les événements**. Votre règle n'est plus une fonction par battement de cœur dont la valeur de retour bloque la page. Au lieu de cela, le corps de la règle est un script qui **enregistre les gestionnaires** pour des événements spécifiques (ouverture de page, modification d'URL, battement de page, événements personnalisés,…). Les gestionnaires restent enregistrés lors des navigations de pages et des changements d'onglets et vivent dans un **bac à sable hors écran** de longue durée.

Le corps de la règle s'exécute **une fois par clic sur Exécuter** (ou une fois lorsque le groupe est activé et qu'une source active existe déjà). Pour recharger les gestionnaires, cliquez sur **Exécuter** dans l'éditeur. La fenêtre contextuelle affiche un rappel vous demandant de recharger toute page déjà ouverte afin que la nouvelle règle s'y applique également.

### 11.1 Signature des règles

```js
(event, helpers) => {
  // Register handlers here. This function is called exactly once
  // per Run click (or when the group is enabled).
}
```

Deux arguments :

- `event` — le **registre d'événements** pour ce groupe. Utilisez-le pour enregistrer, remplacer, répertorier, compter ou désinscrire les gestionnaires, ainsi que pour les événements personnalisés `post(...)`.
- `helpers` — le bundle d'assistance (voir **11.3**).

La fonction n'est **pas** censée renvoyer une valeur. La décision de bloquer ou d'autoriser est prise plus tard, lorsqu'un événement se déclenche et que l'un de vos gestionnaires enregistrés appelle `ev.preventDefault()` et/ou `ev.setResult(...)`.

### 11.2 Cycle de vie

- **Exécuter** (bouton par groupe dans l'éditeur) : le moteur efface d'abord chaque gestionnaire précédemment étiqueté avec ce groupe, puis réexécute le corps de la règle dans le bac à sable hors écran. C'est le seul moyen de se réinscrire après avoir modifié la source.
- **Désactiver le groupe** : chaque gestionnaire marqué avec ce groupe est effacé. La source du groupe est conservée en stockage mais ne répond plus aux événements.
- **Réactiver le groupe** : le moteur réexécute automatiquement la source active pour ce groupe.
- **Supprimer le groupe** : identique à désactiver ; tous les gestionnaires étiquetés avec le groupe sont effacés.
- **Réinscription avec le même `(eventType, id)`** : remplace silencieusement l'enregistrement précédent.

Le bac à sable hors écran est partagé par **tous** les groupes personnalisés. Des gestionnaires de différents groupes y coexistent, chacun étant marqué en interne avec son identifiant de groupe propriétaire afin que « Exécuter », désactiver ou supprimer ne touche que le bon groupe.

Si une règle personnalisée se comporte mal (boucle infinie synchrone, spam de journal incontrôlable, etc.), le bac à sable la met en quarantaine : le groupe est automatiquement désactivé et l'échec est enregistré afin que vous puissiez le voir dans le panneau Journal. Pour réactiver une règle mise en quarantaine, corrigez la source et cliquez sur **Exécuter** : le moteur efface le motif de l'abandon et recharge la règle.

### 11.2.1 Le registre des événements (`event`)

Méthodes génériques :

- `event.register(type, id, handler, options?)` — enregistre un gestionnaire pour un type d'événement arbitraire. `id` est votre propre choix. `options.priority` (`0` par défaut) — les exécutions supérieures en premier. `options.intervalMs` — pour `tickEvent` uniquement ; limitez ce gestionnaire spécifique par rapport au tick global. Réinscription avec les mêmes remplacements `(type, id)`.
- `event.unregister(type, id)`, `event.unregisterAll(type)`.
- `event.post(type, data?, { scope })` — déclenche un événement personnalisé. `scope: "global"` atteint tous les groupes ; par défaut, `scope: "group"` atteint uniquement les gestionnaires du **même** groupe.

Sucre par type d'événement (un ensemble de méthodes par type intégré) :

- `event.registerTickEvent(id, handler, opts)`, `event.getTickEvent(id)`, `event.getTickEvents()`, `event.countTickRegistered()`.
- `event.registerOpenWebEvent(id, handler, opts)`, `event.getOpenWebEvent(id)`, `event.getOpenWebEvents()`, `event.countOpenWebRegistered()`.
- Même forme pour `closeWebEvent`, `switchWebEvent`, `switchDomainEvent`, `webChangedEvent`, `pageHeartbeatEvent`, `timerEnded`, `snoozePress`.

### 11.2.2 Types d'événements intégrés

| Tapez | Quand il tire | Charge utile `ev.data` |
|---|---|---|
| `tickEvent` | Tick ​​d'une seconde partagé globalement sur l'ensemble du navigateur. Se déclenche quelle que soit la visibilité des onglets. Utilisez-le pour une logique de type horloge qui doit continuer à fonctionner même lorsqu'aucun onglet n'est sélectionné. | `{ intervalMs: 1000 }` |
| `pageHeartbeatEvent` | Environ 250 ms de battement de coeur depuis l'onglet **actif**, **visible**. Pilote toute la logique prenant en compte la visibilité des onglets, y compris la coche automatique intégrée à `getOrCreateTimer({ scope })`. Ne se déclenche **pas** à partir des onglets en arrière-plan ou lorsque l'écran est verrouillé. | `{ elapsedMs }` |
| `openWebEvent` | Un nouvel onglet est créé OU une nouvelle navigation atterrit sur une URL que le moteur n'a pas encore vue pour cet onglet. Ne se relance **pas** pour les onglets déjà ouverts après un clic sur Exécuter. | `{ previousUrl, isNewTab }` |
| `closeWebEvent` | Un onglet est fermé. | `{ reason, nextUrl }` |
| `switchWebEvent` | L'URL **change** dans le même onglet : retour/suivant, changement d'itinéraire SPA ou navigation qui atterrit sur une URL différente de celle d'avant. Ne se déclenche **pas** lors d'un simple rechargement (même URL). | `{ previousUrl, previousHostname, sameDomain }` |
| `switchDomainEvent` | Le changement d'URL traverse une limite de nom d'hôte (par exemple `youtube.com` → `wikipedia.org`). Tire aux côtés du `switchWebEvent`. | `{ previousUrl, previousHostname }` |
| `webChangedEvent` | La page (re)charge de quelque manière que ce soit : ouverture, changement, mise à jour de l'historique SPA, **ou rechargement simple qui conserve la même URL**. Il s’agit du crochet fiable « la page a changé, tout réévaluer ». Se déclenche aux côtés de `openWebEvent` / `switchWebEvent` / `switchDomainEvent` et est le seul à se déclencher pour les rechargements avec la même URL. | `{ previousUrl, previousHostname, sameDomain, isFirstLoad, isReload, transition }` où `transition` est `"tabCreated"`, `"commit"` ou `"history"` |
| `timerEnded` | Un temporisateur géré par le groupe atteint `currentMs === 0`. Livré uniquement au groupe propriétaire. | `{ timerId, displayName, direction, currentMs }` |
| `snoozePress` | L'utilisateur a appuyé sur **Démarrer Snooze** dans la fenêtre contextuelle de ce groupe **personnalisé**. Événement de notification pur : le gestionnaire peut exécuter du code arbitraire (enregistrer, rediriger, déclencher d'autres événements), mais les règles personnalisées n'ont **pas d'API de répétition programmatique**. Les journaux produits ici apparaissent sous forme de toasts sur l'onglet actif. Livré uniquement au groupe pressé. | `{ triggeredAt }` |

Les URL dans `ev.url` et dans les données d'événement sont **normalisées** pour les événements : la page Nouvel onglet de navigateur de Google (qui affiche la surface "Rechercher sur Google ou saisir une URL") de Google, `about:blank` et les schémas de nouvel onglet équivalents sont exposés sous la forme de chaîne vide `""`. Ainsi, une minuterie limitée à `ev.url === ""` ne fonctionne que lorsque vous êtes sur la page du nouvel onglet. Les URL `google.com` normales restent inchangées.

### 11.2.3 L'objet événement (`ev`)

Chaque gestionnaire est appelé comme `(ev, helpers) => void`. `ev` transporte :

- `ev.type` — le type d'événement distribué.
- `ev.groupId` — l'identifiant du groupe de réception.
- `ev.tabId`, `ev.pageId`, `ev.url`, `ev.hostname` — contexte de l'événement.
- `ev.time` — Instantané `{ now, month, dayOfMonth, dayName, hour, minute }` lors de l'expédition. `dayName` est `"Sunday"`..`"Saturday"`.
- `ev.data` — charge utile spécifique à l'événement (voir tableau ci-dessus).

Méthodes :

- `ev.preventDefault()` — marque l'envoi comme "bloqué". Le script de contenu hôte quittera la page (ou suivra `setRedirectLink`) à moins qu'un gestionnaire de priorité plus élevée ne définisse ultérieurement `setResult(1)`.
- `ev.stopPropagation()` — interrompez immédiatement cette expédition. **Aucun autre gestionnaire dans aucun groupe** n'est invoqué pour cet événement.
- `ev.setResult(value)` — définit le résultat de l'envoi. `value` peut être un **nombre** dans `[-255, 255]` (bloc `-1`, `0` neutre, `1` autorisé ; d'autres entiers sont conservés pour votre propre logique de débogage), ou une **chaîne** (interprétée comme une URL de redirection). Le dernier appel `setResult` entre tous les gestionnaires est gagnant. Un `1` numérique remplace tout `preventDefault` antérieur.
- `ev.setRedirectLink(url)` / `ev.getRedirectLink()` — l'URL vers laquelle l'hôte doit accéder lorsque l'envoi se termine comme étant bloqué. Il s'agit du **seul** moyen de rediriger à partir de règles personnalisées ; l'éditeur n'expose plus le champ "URL de redirection en cas de blocage" pour les groupes personnalisés.
- `ev.post(type, data, { scope })` — déclenche un événement de suivi depuis l'intérieur d'un gestionnaire.

De plus, `ev` est un proxy : tout champ que vous y définissez (par exemple, `ev.foo = 42`) est stocké dans une carte `custom` et peut être relu à partir du même gestionnaire ou à partir de gestionnaires ultérieurs dans la même répartition.### 11.3 L'objet `helpers`

Chaque appel du gestionnaire reçoit un nouveau bundle `helpers` limité au groupe de réception et à l'URL de l'événement. Champs constants :

- `helpers.now` — millisecondes d'époque à l'expédition.
- `helpers.currentUrl` — l'URL de l'événement, après normalisation newtab/blank.
- `helpers.groupId` — identifiant du groupe de réception.

Raccourcis pratiques (itinéraire vers les mêmes fonctions compatibles avec les accumulateurs utilisées par les assistants ci-dessous, de sorte que la sortie atterrit toujours dans le panneau Journal) :

- `helpers.log(...)`, `helpers.warn(...)`, `helpers.error(...)`.

Méthodes d'accès :

- `helpers.getLogHelper()` — `log` / `warn` / `error`. La sortie est limitée en débit et plafonnée par envoi pour empêcher les règles incontrôlables de geler la fenêtre contextuelle.
- `helpers.getDomainHelper()` (alias `helpers.getDomainUtility()`) — Inspection d'URL (voir **11.3.5**).
- `helpers.getTimerHelper()` — minuteries de groupe (compte à rebours/compte croissant) ; l’état persiste lors des redémarrages du navigateur.
- `helpers.getPersistenceHelper()` — Magasin de clés/valeurs JSON limité au groupe.
- `helpers.getRedirectionHelper()` — `setRedirectLink(url)` / `getRedirectLink()` (et alias `set` / `get`) plus `createMessageUrl(message)` qui renvoie une URL `chrome-extension://...` qui affiche le message donné.
- `helpers.getPlatformHelper()` — intentions DOM par plate-forme (voir **11.3.6**).
- `helpers.getDOMHelper()` — intentions DOM génériques : `hide(sel)`, `show(sel)`, `addClass(sel, c)`, `removeClass(sel, c)`, `setText(sel, text)`, `click(sel)`, `injectCss(css, id?)`, `removeInjectedCss(id)`, `scrollTo(sel)`. Les opérations sont regroupées et appliquées après le retour du gestionnaire.
- `helpers.getNavigationHelper()` — `back()`, `forward()`, `reload()`, `goTo(url)`, `closeTab()`. Les effets sont appliqués à l'onglet d'où provient l'événement.
- `helpers.getStorageHelper()` — sur-ensemble de `getPersistenceHelper` plus des hooks asynchrones `requestAsyncGet(key)` / `requestAsyncSet(key, value)` pour le stockage entre extensions (les résultats arrivent sous la forme d'un événement personnalisé de suivi).
- `helpers.getTabHelper()` — `list()`, `getActiveTab()`, `getById(id)`, `countOpen()` par rapport à un instantané fourni avec l'événement.

Toutes les méthodes d'assistance sont sûres : les paramètres incorrects renvoient `null`, `false` ou une valeur vide au lieu de les lancer.

#### 11.3.1 `getTimerHelper()`

Minuteries par groupe. Chaque minuterie est identifiée par une chaîne `id` que vous choisissez ; L'identité est limitée au groupe, de sorte que deux groupes peuvent tous deux utiliser l'identifiant `"yt-shorts"` sans entrer en collision. L’état persiste lors des redémarrages du navigateur.

L’état persistant d’un minuteur est exactement : `id`, `displayName`, `direction` (`"forward"` ou `"backward"`), `isPaused` et `currentMs`. Il n'y a pas de "durée initiale" stockée - `isExpired` est simplement `currentMs === 0`. Les minuteries avancent pour toujours et n’expirent jamais d’elles-mêmes. Les minuteries arrière arrêtent de fonctionner à `0` (aucune valeur négative).

Il existe deux méthodes de construction. Choisissez celui dont la sémantique correspond à ce que vous voulez :

- `create({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **(re)crée toujours** le minuteur avec les valeurs d'initialisation fournies, écrasant tout état existant, y compris `currentMs`. Utilisez-le lorsque vous voulez dire « repartir à zéro », par ex. à l'intérieur d'une branche de réinitialisation unique.
- `getOrCreateTimer({ id, displayName?, direction?, currentMs?, scope?, domain? })` — **idempotent**. Si une minuterie avec ce `id` existe déjà, ses `displayName` et `direction` peuvent être mis à jour mais `currentMs` est conservé. Sinon, il est créé avec les valeurs d'initialisation fournies. C'est ce que vous voulez pour le modèle commun « assurez-vous que mon minuteur existe, puis laissez-le cocher ».

Les deux méthodes acceptent deux fonctions de prédicat dont le moteur se souvient pendant toute la durée de vie de la règle (elles survivent à travers les pulsations et à travers les réévaluations `webChangedEvent`, mais elles ne sont **jamais conservées** dans le stockage) :- `scope: (url) => boolean` — lorsque `true` correspond à l'URL actuellement visible sur chaque `pageHeartbeatEvent`, le minuteur s'active automatiquement en fonction de l'intervalle de battement de cœur (~ 250 ms). L'assistant lui-même ne bloque jamais ; il met uniquement à jour `currentMs`. Au maximum un tick automatique par battement de cœur et par minuterie.
- `domain: (url) => boolean` — lorsque `true` pour l'URL visible actuelle, le minuteur est rendu dans la superposition sur la page (en haut à gauche). Lorsque `domain` est omis, le moteur revient à `scope` pour l'affichage, donc une minuterie « cocher sur /shorts/pages » apparaît également là sans câblage supplémentaire. Fournissez explicitement `domain` si vous souhaitez une porte d'affichage différente (par exemple, cochez uniquement sur `/shorts/`, mais affichez le temps restant sur l'ensemble de `youtube.com`).

> **Important : un minuteur ne se bloque jamais tout seul.** Lorsqu'un minuteur arrière atteint zéro, il s'arrête simplement à zéro et déclenche une fois `timerEnded`. La décision de bloquer réellement la page dépend d'un gestionnaire `openWebEvent` / `switchWebEvent` distinct qui appelle `ev.preventDefault()` après avoir vérifié `helpers.getTimerHelper().isExpired(id)`. Cette séparation vous permet de créer des minuteries « d'avertissement uniquement », des comptes à rebours, des coups de pouce doux ou des blocs durs — même primitive, votre choix.

Autres méthodes :

- `delete(id)`, `pause(id)`, `resume(id)` — cycle de vie standard. La pause gèle `currentMs`.
- `setDirection(id, "forward" | "backward")`, `setCurrentMs(id, ms)`, `addMs(id, deltaMs)` — mutateurs directs (la plupart des règles n'en ont pas besoin — laissez le rythme cardiaque sonner le chronomètre pour vous).
- `setDisplayName(id, name)` — ré-étiqueter.
- `getCurrentMs(id)`, `getDirection(id)`, `getDisplayName(id)`, `isPaused(id)`, `exists(id)`.
- `isExpired(id)` — `true` et suivants `currentMs === 0`.
- `getState(id)` — `{ id, displayName, direction, isPaused, currentMs, isExpired }` ou `null`.
- `list()` — chaque timer que ce groupe possède, sous la forme d'un tableau d'objets d'état.

#### 11.3.2 `getPersistenceHelper()`

Stockage de type carte limité à votre groupe. Les valeurs doivent être sérialisables en JSON.

- `set(key, value)`, `get(key, defaultValue?)`, `has(key)`, `delete(key)`, `keys()`, `entries()`, `clear()`, `size()`.

Limites souples : environ 200 clés par groupe, 16 Ko par valeur.

#### 11.3.3 `getLogHelper()`

- `log(...args)`, `warn(...args)`, `error(...args)` — écrivez dans le panneau **Log** dans la fenêtre contextuelle (le bundle d'assistance les achemine toujours via le même accumulateur, quelle que soit la répartition qui les a produits). Chaque ligne est préfixée par `[CustomBlocker:groupId]`.
- L'assistant a des limites strictes : environ **200 entrées de journal par expédition** et une longueur de chaîne maximale par entrée. Les entrées excédentaires sont supprimées et comptées dans `accumulator.logsDropped`. C'est ce qui protège la fenêtre contextuelle d'un emballement `for (let i = 0; i < 100000; i++) helpers.log(i)`.
- Lorsque le **Mode débogage** est désactivé (par défaut), les entrées de niveau de trace émises par le moteur lui-même (démarrage de la répartition/synchronisation du gestionnaire) sont supprimées partout — elles ne s'affichent pas dans le panneau Journal et ne s'impriment pas sur la console. Vos propres appels `log` / `warn` / `error` passent toujours.

#### 11.3.4 `getRedirectionHelper()`

Inspectez/remplacez l'URL de redirection que le script de contenu utilisera si la page actuelle est bloquée.

- `get()` : renvoie l'URL de redirection effective actuelle pour cette expédition. Initialement, il s'agit de l'URL de secours configurée pour le groupe intégré (le cas échéant), sinon `""`.
- `set(url)` : remplace cette URL de redirection pour cette expédition. Renvoie `true` en cas de succès, `false` pour une entrée sans chaîne. La transmission de `""` efface le remplacement de la redirection et revient au comportement de sortie par défaut normal.
- `createMessageUrl(message)` — renvoie une URL `chrome-extension://<id>/message-page.html?msg=...` qui, lorsqu'on y accède, affiche le message centré sur une page propre. Utile pour rediriger les utilisateurs vers un écran « Aller travailler » / « Faire une pause » après la fin d'un minuteur. Exemple : `ev.setRedirectLink(h.getRedirectionHelper().createMessageUrl("Go Work"))`.

Comme les autres effets secondaires des règles personnalisées, cet état est partagé entre toutes les règles de la répartition actuelle. Étant donné que les règles s'exécutent de bas en haut, la règle la plus haute pour appeler `set(...)` l'emporte.

#### 11.3.5 `getDomainHelper()` (alias `getDomainUtility()`)

Aides à l’inspection d’URL. Il n'y a pas de `normalize()` car les URL entrantes sont déjà normalisées par un nouvel onglet.

Cœur:- `hostnameOf(url)`, `pathnameOf(url)`, `matches(hostname, site)`, `getPlatform(url)`.
- `isYouTubeHost`, `isTikTokHost`, `isInstagramHost`, `isFacebookHost`, `isTwitchHost`, `isRedditHost`, `isDiscordHost`.
- `youtube()`, `tiktok()`, `instagram()`, `facebook()`, `twitch()` — chacun renvoie `{ isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId }`.

Filtrage d'URL et aides de section :

- `isEmptyStartPage(url)` — `true` pour la page du nouvel onglet et équivalents (les URL qui s'affichent sous la forme `""` pour les gestionnaires).
- `matchesAny(url, patterns)` — `patterns` peut être une expression régulière, une expression régulière de chaîne ou un tableau des deux.
- `pathStartsWith(url, path)` — sensible aux limites (`pathStartsWith("/r/", "/r")` est vrai ; `"/results/"` ne l'est pas).
- `queryHas(url, key, value?)`, `queryGet(url, key)` — inspection de chaîne de requête.
- `isSearchPage(url)` — reconnaît les recherches Google / Bing / DuckDuckGo / plateforme vidéo / forum communautaire / Touiteur / X.
- `isInfiniteFeedUrl(url)` — reconnaît les surfaces de flux algorithmiques de plateforme vidéo, TicToc, Insta localisé, réseau social bleu, forum communautaire, X.
- `sameSection(a, b)` — même nom d'hôte ET même premier segment de chemin.

#### 11.3.6 `getPlatformHelper()`

Intentions DOM par plate-forme et minuteries de sous-section, plus inspection. Chaque `helpers.getPlatformHelper().<platform>()` renvoie un objet dont l'ensemble de méthodes est **dépendant de la plate-forme** — les méthodes qui n'ont pas de sens sur une plate-forme donnée sont tout simplement absentes, donc les appeler lance `TypeError: ... is not a function` plutôt que de ne pas fonctionner en silence. Par exemple, `twitch().hidePosts` n'existe pas (plateforme de direct n'a pas de publication) et `tiktok().hideShortButton` n'existe pas (toute l'expérience de TicToc _est déjà_ une vidéo courte). Utilisez `helpers.getPlatformHelper().hasMethod(platform, name)` ou `.listMethods(platform)` pour effectuer une introspection au moment de l'exécution.

Matrice de méthode par plateforme :

| méthode | plateforme vidéo | tic tac | Insta localisé | réseau social bleu | contraction |
|---|:---:|:---:|:---:|:---:|:---:|
| `hideShorts` / `showShorts` | ✓ |  |  |  |  |
| `hideReels` / `showReels` |  |  | ✓ | ✓ |  |
| `hideClips` / `showClips` |  |  |  |  | ✓ |
| `hideStreams` / `showStreams` |  |  |  |  | ✓ |
| `hideVideos` / `showVideos` | ✓ | ✓ |  | ✓ | ✓ (VOD) |
| `hidePosts` / `showPosts` | ✓ |  | ✓ | ✓ |  |
| `hideShortButton` / `showShortButton` | ✓ |  |  |  |  |
| `hideHomePage` / `showHomePage` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `hideComments` / `showComments` | ✓ | ✓ | ✓ | ✓ | ✓ (discussion) |
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

Les noms natifs de la plate-forme (`hideReels`, `hideClips`, `hideStreams`) ne sont PAS des compartiments distincts de `hideShorts` / `hideVideos` — l'emplacement de stockage est le même ; seul le nom visible par l'utilisateur suit la terminologie de chaque plateforme.

> **Durée de vie du prédicat et règle à emplacement unique.** Chacun des `hideShorts` / `hideReels` / `hideClips` / `hideStreams` / `hideVideos` / `hidePosts` / `filterComments` / `filterLive` possède **un** prédicat persistant par `(group, platform, slot)`. Le prédicat n'est **pas** limité à l'événement en cours — une fois que vous l'avez défini, il reste actif à chaque chargement de page et à chaque envoi jusqu'à ce que le `show*()` correspondant soit appelé ou que le groupe soit déchargé. Appeler à nouveau la même méthode avec une nouvelle fonction **remplace** la précédente — le moteur ne fusionne jamais OU-fusionne plusieurs prédicats au sein d'un seul groupe. Pour combiner des conditions, écrivez un prédicat qui effectue la combinaison vous-même, par ex. `yt.hideVideos(item => isShort(item) || hasKeyword(item))`. Dans **différents** groupes, chaque groupe apporte son propre prédicat et un élément est masqué si le prédicat d'un groupe correspond.

Les méthodes d'inspection prennent leur valeur au moment de l'envoi à partir d'un instantané fourni avec l'événement ; leur disponibilité est limitée par la matrice ci-dessus.

Les classificateurs d'URL sont toujours réexposés quelle que soit la plate-forme : `isPlatformUrl`, `isShortUrl`, `isVideoUrl`, `isPostUrl`, `isHomePage`, `extractAuthor`, `extractVideoId`.Les minuteurs de sous-section enregistrent le minuteur dans le compartiment de groupe persistant et, lorsqu'ils sont étendus, cochent uniquement les URL qui correspondent à cette sous-section. Les méthodes de minuterie acceptent `{ id, direction, currentMs, displayName }` et suivent le même déclenchement par plate-forme.

Pour les méthodes de prédicat, le prédicat est appelé par carte correspondante avec un `item` normalisé : `{ url, name, author, length, views, publishedAt, description, live?, sponsored?, algorithmic? }`. N'importe quel champ peut être `null` ; "innocent jusqu'à preuve du contraire" - renvoyez `false` lorsque le champ dont vous avez besoin est manquant.

### 11.4 Exemples

**Facile** : bloquez les pages plateforme vidéo Shorts les matins de la semaine :

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

**Moyen** : budget quotidien de 30 minutes pour plateforme vidéo Shorts. Le minuteur s'active automatiquement sur les `pageHeartbeatEvent` lorsqu'une URL de short est visible ; un gestionnaire distinct applique le blocage lorsque le minuteur atteint zéro.

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

**Plus dur** : masquez les Shorts plateforme vidéo individuels dont le pseudo de l'auteur est trop long et injectez un CSS "ce Short est masqué" :

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

**Le plus difficile** : diffusez un événement personnalisé d'un gestionnaire à d'autres :

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

## 12. Modèles

Chaque groupe personnalisé dispose d'un sélecteur de **Modèles** qui ouvre un navigateur de préréglages consultable. La bibliothèque propose désormais **plus de 50 modèles** organisés en neuf catégories afin que vous puissiez parcourir au lieu d'écrire des règles à partir de zéro :

| Catégorie | Exemples |
|---|---|
| **Minuteries** | Budget temps du site (compte à rebours + blocage), suivi du temps du site (compte croissant), plafond plateforme vidéo Shorts, plafond de flux TicToc, plafond Insta localisé Reels, plafond réseau social bleu Reels, plafond plateforme de direct Clips, budget de distraction universel, suivi quotidien du travail en profondeur |
| **Horaire** | Blocage des heures de travail en semaine, sites uniquement le week-end, arrêt avant le coucher, autorisation d'une heure seulement, informations pour le déjeuner uniquement, nouveau départ du lundi, autorisation des N premières minutes de chaque heure, blocage strict du travail en profondeur |
| **Flux / Shorts** | Bloquer les URL des courts métrages plateforme vidéo, masquer les cartes Shorts, masquer les courts métrages par mot-clé, masquer le flux d'accueil / commentaires / tendances plateforme vidéo, bloquer TicToc FYP, masquer les courts métrages TicToc, bloquer les URL des bobines Insta localisé, masquer le flux Insta localisé Reels, masquer le flux réseau social bleu / Bobines, masquer l'accueil forum communautaire / Touiteur / LinkedIn |
| **Redirection** | Distractions → page de focus, Shorts → /feed/subscriptions, reddit.com → old.reddit.com, twitter / x → Nitter, nouvel onglet → liste de tâches |
| **Concentration** | Session de discussion sur liste verte uniquement, Pomodoro 25/5, blocage pendant la réunion, blocage après N visites aujourd'hui, blocage en cas de perte consécutive |
| **Coup de pouce** | Enregistrez chaque visite de distraction, avertissez à chaque visite Shorts, comptez les visites quotidiennes sur un site |
| **Persistance** | Limite de visites mensuelle, bascule d'interdiction hebdomadaire, suivi des chaînes salon de discussion visitées |
| **Ajustements du DOM** | Masquer la bascule de lecture automatique de plateforme vidéo, masquer Touiteur/X « Que se passe-t-il », générique « masquer les sélecteurs sur un site » |
| **Débogage** | Compte à rebours de la démo (3 s), enregistrez chaque événement personnalisé |

Les puces de filtre en haut du sélecteur réduisent la liste par catégorie (`Timer`, `Schedule`, `Feed`, …) et par plate-forme (`plateforme vidéo`, `TicToc`, `Insta localisé`, …). Sélection d'un modèle :

1. Charge ses entrées de paramètres (URL, minutes, plages d'heures, etc.) dans un petit formulaire.
2. **Appliquer le préréglage** prévisualise la source générée.
3. Après avoir confirmé **Remplacer la règle personnalisée actuelle par ce préréglage ?**, la source est écrite dans l'éditeur.
4. Cliquez ensuite sur **Exécuter** pour enregistrer les gestionnaires de règles dans le bac à sable hors écran.

Les modèles sont définis sous `templates/*.js` (`timers.js`, `schedule.js`, `feed.js`, …). Chaque fichier appelle `CB_REGISTER_TEMPLATES([...])` au moment du chargement et la fenêtre contextuelle consomme la liste fusionnée. Ajouter un nouveau modèle signifie écrire une entrée dans le fichier approprié – pas d’autre plomberie.

---

## 13. Comportement multipage- Tous les onglets ouverts du même groupe partagent le même minuteur.
- Lorsque vous passez à un onglet du même groupe, sa superposition s'actualise immédiatement pour afficher l'heure partagée actuelle.
- Les minuteries à règles personnalisées cochent uniquement sur l'onglet **actif visible** — pilotées par `pageHeartbeatEvent`. Les onglets d'arrière-plan et les fenêtres réduites ne les font pas avancer. Cela correspond au compte à rebours par défaut du groupe de blocs.
- Lorsqu'une nouvelle règle est ajoutée, chaque page ouverte détecte le changement et réévalue en une fraction de seconde ; **mais** les gestionnaires nouvellement enregistrés n'ouvrent pas rétroactivement les onglets déjà ouverts. La fenêtre contextuelle affiche un rappel de rechargement après chaque exécution pour cette raison.
- Lorsqu'une règle expire, les cartes de flux et les boutons de navigation masqués sont restaurés lors de la prochaine actualisation.

---

## 14. Paramètres

Ouvrez la boîte de dialogue **Paramètres** via l'icône d'engrenage dans la barre supérieure.

- **Intervalle de pulsation** : à quelle fréquence le script de contenu signale le temps de tabulation et pilote `pageHeartbeatEvent`. Par défaut 250 ms. Les valeurs inférieures sont plus réactives mais utilisent plus de CPU.
- **Intervalle de coche** — à quelle fréquence le `tickEvent` global se déclenche. Par défaut 1 000 ms.
- **Mode débogage** — *désactivé* par défaut. Lorsqu'il est *activé*, le moteur émet des entrées de niveau trace dans le panneau Journal (`[trace] dispatchEvent`, `[trace] N handler(s)`) et des lignes `[CustomBlocker:trace]` vers la console du navigateur. Laissez-le de côté pour un usage quotidien ; allumez-le tout en diagnostiquant une règle qui se comporte mal. `pageHeartbeatEvent` est exclu de la journalisation des traces même lorsque le mode débogage est activé, car il se déclenche quatre fois par seconde et noierait le reste.

---

## 15. Internationalisation

L'ensemble de l'interface utilisateur est traduit. Utilisez le sélecteur de **Langue** en haut à droite.

Les langues prises en charge incluent l'anglais, le chinois (simplifié), l'espagnol, le japonais, le coréen, ainsi qu'une couverture partielle de l'hindi, de l'arabe, du bengali, du portugais, du russe, du pendjabi, de l'allemand, du français, du turc, du vietnamien, de l'italien, du thaï, du néerlandais, du polonais, de l'indonésien, de l'ourdou et du persan. Les langues avec une couverture partielle reviennent à l'anglais pour les chaînes manquantes.

Le manuel d'instructions lui-même charge le fichier markdown correspondant à la langue sélectionnée, avec l'anglais comme solution de secours.

---

## 16. Messages d'état

Les messages d'état apparaissent sous la forme d'un toast centré qui disparaît après environ deux secondes :

- "Modifications enregistrées."
- "Créé \"Nom du groupe\"."
- "Règle personnalisée chargée — N gestionnaire(s) actif(s). Pour appliquer cette règle sur les onglets que vous avez déjà ouverts, rechargez-les."
- Erreurs de validation telles que "Les minutes autorisées doivent être un nombre supérieur à 0."
- "Les minutes de répétition doivent être un nombre supérieur à 0."
- "Les groupes gelés ne peuvent pas être modifiés."

Pour les champs de saisie avec des exigences de format, le message apparaît également à côté du bouton correspondant (pour snooze).

---

## 17. Confidentialité et stockage

- Tout est stocké localement dans `chrome.storage.local`. Aucune donnée n'est envoyée nulle part.
- Les éléments stockés incluent : vos groupes, les minuteries d'utilisation, les heures de dernière réinitialisation, les enregistrements de répétition, les minuteries personnalisées et les valeurs persistantes personnalisées.
- L'extension ne lit pas le contenu de la page au-delà de ce qui est nécessaire pour détecter le type de page (chemin/nom d'hôte/marqueurs DOM connus pour les sites vidéo) et pour évaluer les prédicats écrits par l'utilisateur. Il ne lit pas vos messages, publications, commentaires ou contenu privé.

---

## 18. Autorisations

- `storage` — pour les données ci-dessus.
- `declarativeNetRequest` — pour le blocage natif des groupes `Default`.
- `alarms` — pour planifier efficacement les transitions de règles.
- `tabs`, `webNavigation` — pour détecter la création d'onglets, les modifications d'URL et les battements de page afin que les événements puissent être distribués.
- `offscreen` — pour héberger le bac à sable à règles personnalisées de longue durée.
- `host_permissions: <all_urls>` — afin que le script de contenu puisse afficher la superposition du minuteur et détecter le contexte de la plate-forme sur n'importe quelle page.

---

## 19. Dépannage- **Un groupe que j'ai ajouté ne fait rien.** Assurez-vous que le groupe est activé, que le calendrier le permet maintenant, qu'aucune répétition n'est active et (pour les groupes de plateforme) que la page correspond réellement au type de contenu et au filtre d'auteur choisis.
- **Une minuterie est bloquée ou incorrecte sur un onglet.** Éloignez-vous et revenez en arrière, ou concentrez-vous sur l'onglet, ce qui déclenche une actualisation forcée à partir de la minuterie partagée.
- **Les cartes de flux réapparaissent après que je pense qu'elles devraient être masquées.** Le masquage du flux ne s'exécute que lorsque la règle bloque activement. Si vous avez une règle `after-minutes`, le masquage du flux entre en vigueur une fois que votre temps atteint zéro.
- **Un bouton de navigation plateforme vidéo que je m'attendais à masquer est toujours là.** Le masquage de la navigation nécessite que la règle soit définie sur « ne pas filtrer par auteur » et que le type de contenu soit des courts métrages ou des publications plateforme vidéo. Avec les filtres d'auteur, le masquage se fait uniquement par carte.
- **La règle personnalisée n'a rien fait ou s'est lancée silencieusement.** Ouvrez les paramètres → activez le **mode Débogage**, puis cliquez à nouveau sur **Exécuter** et regardez le panneau Journal. Les lignes précédées du préfixe `[trace]` indiquent chaque expédition et chaque gestionnaire. Utilisez `helpers.getLogHelper().log(...)` pour ajouter vos propres points de trace. Si une règle qui se comporte mal continue d'être mise en quarantaine automatiquement, corrigez la source et cliquez sur Exécuter — Exécuter efface la raison de l'abandon.
- **Ma nouvelle règle personnalisée n'affecte pas les onglets déjà ouverts.** Rechargez-les. Des règles personnalisées s'attachent aux *futurs* événements de page ; la fenêtre contextuelle affiche un rappel de recharger après chaque exécution.
- **Mon compte à rebours n'avance pas.** Les minuteries à règles personnalisées cochent uniquement sur l'onglet **actif visible** via `pageHeartbeatEvent`. Les onglets d'arrière-plan, les fenêtres réduites et les écrans verrouillés les mettent en pause de par leur conception - même comportement que le compte à rebours par défaut du groupe de blocs.
- **Je ne parviens pas à supprimer un groupe.** Il est probablement gelé. Les groupes strictement gelés ne peuvent pas être supprimés du tout jusqu'à l'expiration de leur verrouillage ; Les groupes gelés non stricts peuvent être supprimés via le rituel de dégel.
- **La fenêtre contextuelle affiche "En cours d'exécution..." pour toujours.** Une règle personnalisée est probablement entrée dans une boucle serrée. Le moteur le tue après un délai d'attente difficile et met la règle en quarantaine. Ouvrez le panneau Journal pour le motif de l'abandon ; corrigez la règle et cliquez sur Exécuter.

---

## 20. Glossaire

- **Groupe de blocs** : un ensemble de règles avec son propre type, comportement, calendrier et gel/répétition.
- **Blocage instantané** — la règle se bloque immédiatement chaque fois qu'elle est active.
- **Blocage après minutes** — la règle ne commence à bloquer qu'une fois le budget temps de la période épuisé.
- **Intervalle de réinitialisation** : à quelle fréquence le budget après les minutes est réinitialisé.
- **Calendrier** — jours + plages horaires pendant lesquels un groupe est actif.
- **Gelage / Gel strict** — états anti-falsification.
- **Snooze** — désactivation temporaire avec un rituel de confirmation configurable.
- **Filtre d'auteur** — pour les groupes de plateformes, restreint la règle à certains créateurs de contenu.
- **Type de contenu** — pour les groupes de plateformes, restreint la règle à certaines formes de contenu (court, long, post).
- **Helpers** — utilitaires transmis au gestionnaire d'une règle personnalisée.
- **Plateforme** — l'une des `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`. Chacun a son propre type de groupe et sa propre logique de masquage des flux.
- **Heartbeat** — le `pageHeartbeatEvent` d'environ 250 ms envoyé à partir de l'onglet visible actif.
- **Cochez** — le 1 s `tickEvent` partagé globalement (indépendant de la visibilité).
- **Mode débogage** : un paramètre qui fait apparaître la journalisation de trace interne dans le panneau Journal et la console du navigateur.
- **Quarantaine** — désactivation automatique d'une règle personnalisée qui a dépassé un plafond de sécurité d'exécution (délai, spam de journal,…). Effacé lors de la prochaine exécution.

---

## 21. Limites- Le masquage des flux dépend du DOM actuel de chaque plateforme. Si la plateforme modifie sa présentation, les sélecteurs masqués devront peut-être être mis à jour.
- La détection du contexte de la plate-forme pour les sites non plateforme vidéo est principalement basée sur les URL, elle est donc plus fiable sur les URL de contenu canonique.
- Les minuteries personnalisées fonctionnent à la résolution du battement de cœur (~ 250 ms). Ne comptez pas sur eux pour un timing inférieur à la seconde.
- Les prédicats transmis à `hideShorts` / `hideVideos` / `hidePosts` sont évalués de manière synchrone par carte d'alimentation. Une logique lourde dans un prédicat peut ralentir le défilement du fil ; gardez-les bon marché.
- Deux onglets éditant le même minuteur par groupe utilisent simultanément une stratégie de « dernière écriture gagne ». Pour une utilisation typique, c'est très bien ; si vous dépendez d’une comptabilité exacte, attendez-vous à de légères dérives occasionnelles.
- Le navigateur peut suspendre le service worker en arrière-plan lorsqu'il est inactif. L'extension le reprend dès qu'une page ou une alarme en a besoin ; les budgets d'utilisation du site / chronométrés continuent de compter via la relecture des battements de cœur.

## Note v1.2

L’éditeur de règles personnalisées colore désormais la syntaxe langage de script, et le navigateur de modèles utilise les mêmes couleurs pour les aperçus de code. L’action groupée des groupes s’appelle **Vider**.

