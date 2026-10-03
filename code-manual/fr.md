# Manuel de code de l’extension de navigateur Vault

[Manuel d’utilisation](../manual/fr.md)

## Contrat des règles

Source : une expression de fonction `(on, v) => { ... }`. Seuls JavaScript synchrone et l’API ci-dessous sont pris en charge ; aucun minuteur, réseau, API d’extension ou accès direct au DOM. Les règles temporelles utilisent `ev.now` et des événements.

- La modification enregistre un brouillon ; **Exécuter** l’active et active le groupe. Les groupes verrouillés ne peuvent pas Exécuter. Une source vide décharge la règle.
- Une exécution réussie remplace les gestionnaires et les panneaux tout en conservant `v.state`. Un échec de compilation/enregistrement conserve la règle précédente ; un dépassement de délai peut l’arrêter. Recharger le moteur enregistre à nouveau la dernière source activée ; les variables de fermeture sont réinitialisées.
- L’enregistrement peut initialiser l’état, enregistrer des gestionnaires, afficher des panneaux et journaliser. Les actions de page/fichier et les émissions doivent être dans les gestionnaires ; leur file d’attente créée pendant l’enregistrement est supprimée.
- Désactiver supprime les appels des gestionnaires et retire les panneaux, feuilles de style, couvertures et décisions d’éléments gérés. Activer restaure les panneaux/feuilles conservés et demande à nouveau les éléments. Exécuter ne supprime pas les feuilles, couvertures ou décisions existantes. Supprimer retire la règle, son état et ses effets. La navigation, les modifications du DOM et les écritures de fichiers ne sont pas annulées.
- Les événements ne sont pas limités par les cibles ordinaires du groupe ; filtrez les URL/éléments dans la règle. Les actions sont mises en file, puis appliquées après la distribution de l’événement. Une exception arrête ce gestionnaire sans annuler son état/ses actions ; les gestionnaires suivants peuvent encore s’exécuter. Il n’existe aucune confirmation d’action hormis les événements de fichier/requête.

## API partagée

- `on(type, handler)` → booléen. Enregistre `handler(ev)` ; plusieurs gestionnaires s’exécutent dans l’ordre d’enregistrement. False signifie des arguments invalides ou une limite de gestionnaires atteinte. `ev = { type: string, now: number, data }` ; `now` est en millisecondes Unix.
- `v.state` : objet JSON modifiable, persisté après la distribution de l’événement. Initialisez les champs absents au lieu d’écraser l’état existant. Affecter une valeur non objet ou un tableau le réinitialise à `{}` ; les mises à jour non sérialisables/trop grandes ne sont pas persistées.
- `v.log(...values)` : seul producteur du Journal de ce groupe. Les journaux/Effacer sont indépendants par groupe. Les erreurs de chargement apparaissent dans l’état d’exécution ; les diagnostics des gestionnaires ne remplissent pas le Journal.
- `v.emit(type, data)` : met en file une copie JSON de `data` pour les gestionnaires de ce groupe après l’événement courant, avec un nouveau `now` ; ce n’est pas un appel synchrone.
- `v.panel(id, spec, tabId?)` : remplace le panneau nommé de ce groupe ; omettez `tabId` pour toutes les pages web accessibles ou utilisez un identifiant d’onglet entier. Un `spec` null le retire. Voir Panneaux.
- `v.file(op, path, payload?)` → chaîne d’identifiant de requête. Voir Fichiers.

Les autres appels partagés renvoient `undefined`. Les identifiants/l’état appartiennent à un groupe, pas à son nom affiché.

## Événements du navigateur

La notation des données ci-dessous décrit des types ; ce n’est pas du code exécutable. `?` marque les champs facultatifs.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` est approximatif ; utilisez des horodatages, pas des comptes de ticks. `active` signifie sélectionné dans une fenêtre de navigateur, sans prouver que l’utilisateur le regarde. Les URL peuvent être vides/restreintes.
- `visible` provient de pages accessibles et non masquées ; `elapsedMs` est le temps depuis leur dernier signal périodique, zéro lorsqu’elles sont couvertes. Ce n’est ni une utilisation cumulée ni un temps de lecture.
- `items` signale les éléments de flux nouveaux/modifiés pris en charge et les renvoie après Exécuter/réactivation. `ref` identifie une carte sur cette page, pas un identifiant durable de contenu ; `ref === "page"` désigne la page elle-même. Les titres/URL/auteurs peuvent être vides. `authors` contient des identifiants de source propres aux plateformes.
- Identifiants de plateforme : `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. La disponibilité des éléments dépend du balisage pris en charge de la page.
- Les étiquettes nécessitent le Classificateur de bureau connecté et une version/plateforme avec étiquetage activé (Chromium et Safari : YouTube, Reddit, Bilibili, X/`twitter`). La confiance va de 1–5. `tagsSettled === false` signifie en attente/indisponible, pas sans étiquette ; un `tags: []` terminé signifie sans étiquette. Les versions Firefox ne fournissent pas cette intégration d’étiquetage.
- `snooze` signifie que le bouton Pause du groupe a été pressé. Il n’applique aucune pause à lui seul.
- Les réponses de requêtes/fichiers ciblent le groupe demandeur. Faites la correspondance avec `requestId`, vérifiez `error`/`ok` et fixez une échéance avec les ticks : les réponses peuvent se perdre à la fermeture d’une page, au rechargement du moteur ou à la désactivation du groupe. Les identifiants peuvent se répéter après Exécuter ; les requêtes en attente ne constituent pas des tâches durables.

## Actions du navigateur

L’entier `tabId` doit provenir d’un événement. Les actions de page nécessitent une page accessible à Vault ; les pages internes du navigateur sont indisponibles. Les entrées invalides/cibles indisponibles ne produisent généralement aucun effet.

- `v.item(tabId, ref, verdict)` : `"hide"` retire une carte du flux, `"dim"` couvre ses médias, `"allow"` l’exempte des groupes inférieurs, `null` efface la décision de ce groupe. Les références inconnues n’ont aucun effet ; utilisez `v.cover` pour `isPage`. Les décisions suivent l’ordre de la liste des groupes : hide supérieur gagne ; dim supérieur reste face à allow inférieur ; allow empêche les décisions inférieures. Une carte recyclée/retirée nécessite une nouvelle décision.
- `v.cover(tabId, on, message?)` : true couvre la page, false retire sa couverture personnalisée ; le message est vide par défaut (500 caractères maximum). Un seul emplacement de couverture personnalisée par page ; le dernier appel appliqué gagne, indépendamment de l’ordre des groupes. Les changements d’adresse le retirent ; le blocage ordinaire peut encore couvrir la page.
- `v.go(tabId, target)` : une URL HTTP(S) ou `"back"`, `"forward"`, `"reload"` (cible de 4096 caractères maximum).
- `v.close(tabId)` : ferme l’onglet.
- `v.css(tabIdOrStar, id, css)` : identifiant d’onglet entier ou `"*"` ; remplace la feuille du groupe ayant cet identifiant ou la retire avec null. Les feuilles d’onglet se terminent au changement d’adresse ; les feuilles `"*"` atteignent les futures pages. Identifiant de 80 caractères maximum, CSS de 100000 caractères maximum.
- `v.dom(tabId, selector, op, arg?)` : sélecteur CSS (maximum 1000) ; toutes les correspondances, sauf `scrollTo` qui utilise la première. Opérations : `hide` définit en ligne `display:none!important` ; `show` retire display en ligne ; `click` ; `setText` remplace le texte par `arg` ; `addClass`/`removeClass` utilisent un nom de classe ; `scrollTo` fait défiler jusqu’à l’élément. Argument de 2000 caractères maximum. Les modifications persistent jusqu’à une annulation explicite/un remplacement de page.
- `v.query(tabId, selector)` → chaîne d’identifiant de requête ou null pour des arguments invalides. Le résultat est un événement `query` ultérieur : jusqu’à 50 correspondances, `tag` en minuscules, texte normalisé ≤1000 caractères, attributs ≤2000, valeur ≤1000. Aucune correspondance est un `[]` réussi ; un CSS invalide produit `error: "invalid-selector"`. Une page sans récepteur Vault peut ne jamais répondre.

## Panneaux

```text
spec = { title?: string, description?: string, controls?: Control[],
         position?: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center",
         width?: "small" | "medium" | "large" | number,
         layout?: Layout, align?: "left" | "center" | "right", role?: Role }
Control = { id?: string, type?: string, label?: string, value?, disabled?: boolean,
            ariaLabel?: string, autoFocus?: boolean,
            align?: "left" | "center" | "right", layout?: Layout,
            width?: "full" | "auto" | number, height?: "auto" | number,
            ...type-specific fields below }
Layout = "vertical" | "compact" | "comfortable" | "spacious" | "inline" | "row"
       | "wrap" | "twoColumn" | "grid" | "split" | "form" | "toolbar" | "stack"
Role = "region" | "dialog" | "alert" | "status" | "form" | "group"
```

Valeurs par défaut : position en bas à droite ; disposition verticale ; alignement à gauche ; rôle region ; largeur selon le contenu. Les largeurs prédéfinies sont 220/280/360px ; la largeur numérique du panneau est limitée à 180–520px. La largeur des commandes est limitée à 32–520px et leur hauteur à 20–360px. Les tailles numériques acceptent aussi des chaînes en pixels. Les variantes verticales changent l’espacement ; inline/row ne reviennent pas à la ligne ; wrap/toolbar reviennent à la ligne ; twoColumn/grid/split/form utilisent des grilles ; stack réduit l’espacement. Le rôle fournit une sémantique d’accessibilité, pas un blocage modal.

Les identifiants sont normalisés en lettres/chiffres ASCII/`_`/`-` (maximum 80) ; choisissez des identifiants uniques et stables. Sans identifiant de commande, `control-N` est utilisé ; sans type/type inconnu, text. Les textes/listes omis sont vides ; disabled vaut false. Appeler `v.panel` remplace toute la spécification. Un `value` omis réutilise la dernière valeur d’événement de la commande, puis normalise le type ; un `value` explicite l’écrase. Autofocus vaut false par défaut. Les champs inconnus sont ignorés ; les couleurs/polices/CSS de panneau fournis par la règle ne sont pas pris en charge.

Champs et valeurs des commandes :

- `text` : chaîne `text` ; étiquette par défaut. `html` : chaîne `html` ; scripts, attributs d’événements, URL dangereuses et styles retirés.
- `button` : `label`, `action: "submit" | "cancel" | "close"` facultatif ; la valeur est une chaîne (vide par défaut). Les actions émettent des événements ; elles ne soumettent/ferment rien automatiquement.
- `checkbox`, `toggle` : `value` booléen (false par défaut).
- `select`, `radio` : `options: (string | { value: string, label?: string })[]` ; valeur chaîne (vide par défaut). Les valeurs d’option vides sont retirées ; les étiquettes utilisent la valeur par défaut.
- `textInput`, `textarea` : valeur chaîne (vide par défaut), `placeholder` ; textarea `rows` 1–12 (3 par défaut).
- `numberInput`, `range` : valeur numérique (0 par défaut), `min`, `max`, `step` positif. Les valeurs sont limitées aux bornes ; les bornes de normalisation non précisées sont −1000000…1000000. Les commandes range utilisent 0…100 par défaut ; fixez des bornes explicites.
- `date` : chaîne `YYYY-MM-DD` ; `time` : chaîne `HH:MM` ou `HH:MM:SS` ; les formats initiaux invalides deviennent vides. `color` : `#RRGGBB` (`#000000` par défaut).
- `pin` : chaîne de chiffres ; `length` 3–12 (6 par défaut), `masked` true par défaut, `autoSubmit` false. `section` : `text`, `controls`, layout/align/role facultatifs (rôle group par défaut) ; les sections enfants de profondeur 3 n’ont pas d’enfants (commandes racines à profondeur 0).

Événements de panneau : les entrées envoient `input`/`change` (entrée texte modifiée à la perte de focus/Entrée ; textarea à la perte de focus/Ctrl-ou-Cmd+Entrée). Les commandes ordinaires envoient aussi `focus`, `blur`, `key` ; les métadonnées de touche ne sont pas transmises à la règle. Les boutons envoient `click` **et** leur action configurée comme événements distincts : traitez-en un. PIN envoie `change`, plus `submit` lorsque autoSubmit le remplit. Montage/démontage utilisent `controlId: ""`, `value: true`. `values` contient les valeurs d’entrée courantes par identifiant ; il exclut boutons/texte/HTML. Les événements n’ont pas d’identifiant d’onglet d’origine ; utilisez des identifiants de panneau distincts pour les interactions propres aux onglets.

Limites de texte : title/label/ariaLabel 240 ; description/text 1000 ; HTML 20000 ; placeholder 500 ; texte saisi 2000 ; autres chaînes de valeur 512 ; valeur/étiquette d’option 256. Le dépassement est tronqué.

## Fichiers

`op` : `"read"`, `"write"`, `"append"`, `"list"`, `"exists"`. Nécessite **Dossier des règles personnalisées** dans Paramètres et son autorisation. Safari utilise son sélecteur de dossier natif et une autorisation de sécurité conservée ; seul le dossier choisi est accessible.

- `path` est relatif ; `/` sépare les répertoires. Les segments acceptent lettres/chiffres ASCII, espaces et `_.,@()-` ; pas de point initial, de `.`/`..`, de chemin absolu ou d’URL. Suffixes : `.txt`, `.csv`, `.json` (sans distinction de casse). Le chemin de list est un répertoire ; `""` liste la racine choisie.
- Read renvoie du texte UTF-8. Write remplace/crée ; append crée/ajoute sans nouvelle ligne automatique. Les écritures créent les répertoires parents. Les données chaînes sont écrites telles quelles ; les autres données JSON sont sérialisées ; null/omis signifie un texte vide. Analyser JSON/CSV relève de la règle. Taille maximale du fichier : 1048576 octets UTF-8.
- List renvoie les sous-répertoires visibles immédiats et les fichiers pris en charge. Entrées : `{ name: string, path: string, kind: "directory" | "file", extension?: string }` ; extension comprend le point pour les fichiers. Exists renvoie un booléen pour un chemin de fichier pris en charge.

```text
file.data = { requestId: string, op: string, path: string, ok: boolean,
              text: string | null, entries: Entry[] | null,
              exists: boolean | null, error: string }
```

Les champs de résultat inutilisés sont null ; en cas de succès, error est vide. Les échecs incluent invalid-path, unsupported-file-type, autorisation/dossier indisponible, fichier absent et file-too-large. Traitez error comme une chaîne, pas comme une énumération fixe exhaustive. Les requêtes ne garantissent ni transaction ni ordre ; sérialisez les opérations lecture-modification-écriture par chemin.

## Limites

Par événement et groupe : 256 actions en file, 200 appels de journal, 64 émissions ; le dépassement est ignoré. Par règle : 1000 gestionnaires, 24 panneaux ; chaque liste de commandes contient 32 entrées et chaque choix 64 options ; le dépassement est ignoré/tronqué. Les chaînes d’émission s’arrêtent après 16 générations. Limite d’état sérialisé : 65536 caractères de chaîne JavaScript. Gardez l’enregistrement et l’ensemble des gestionnaires de chaque événement sous 1 seconde ; les dépassements répétés ou un délai strict dépassé arrêtent le groupe jusqu’à Exécuter. Le journal conserve 200 entrées, accepte 50/seconde par groupe et tronque les messages longs vers 4096 caractères. Les minuteurs/réponses sont au mieux, sans garantie de temps réel.

## Règle complète

Une pause de cinq minutes, déclenchée par Pause ou le bouton de son panneau :

```javascript
(on, v) => {
  v.state.pauseUntil ??= 0;
  const pause = ev => { v.state.pauseUntil = ev.now + 300000; };
  v.panel("pause", { controls: [{ id: "pause", type: "button", label: "Pause 5 min" }] });
  on("snooze", pause);
  on("panel", ev => {
    if (ev.data.panelId === "pause" && ev.data.controlId === "pause" && ev.data.eventName === "click") pause(ev);
  });
  on("tick", ev => {
    for (const tab of ev.data.tabs) {
      if (/^https?:\/\/(www\.)?youtube\.com(?:\/|$)/i.test(tab.url)) v.cover(tab.tabId, ev.now >= v.state.pauseUntil);
    }
  });
}
```
