# Manuel de code de l’extension de navigateur Vault

[Manuel d’utilisation](../manual/fr.md)

## Contrat des règles

Source : une expression de fonction `(on, v) => { ... }`. Seuls JavaScript synchrone et l’API ci-dessous sont pris en charge ; aucun rappel de planification JavaScript, réseau, API d’extension ou accès direct au DOM. Les règles temporelles utilisent les minuteurs/suivis gérés ci-dessous, ou `ev.now` et des événements.

- La modification enregistre un brouillon ; **Exécuter** l’active et active le groupe. Les groupes verrouillés ne peuvent pas Exécuter. Une source vide décharge la règle.
- Une exécution réussie remplace les gestionnaires et les panneaux tout en conservant `v.state`. Un échec de compilation/enregistrement conserve la règle précédente ; un dépassement de délai peut l’arrêter. Recharger le moteur enregistre à nouveau la dernière source activée ; les variables de fermeture sont réinitialisées.
- L’enregistrement peut initialiser l’état, enregistrer des gestionnaires, afficher des panneaux et journaliser. Les actions de page/fichier et les émissions doivent être dans les gestionnaires ; leur file d’attente créée pendant l’enregistrement est supprimée.
- Désactiver supprime les appels des gestionnaires et retire les panneaux, feuilles de style, couvertures et décisions d’éléments gérés. Activer restaure les panneaux/feuilles conservés et demande à nouveau les éléments. Exécuter ne supprime pas les feuilles, couvertures ou décisions existantes. Supprimer retire la règle, son état et ses effets. La navigation, les modifications du DOM et les écritures de fichiers ne sont pas annulées.
- Les événements ne sont pas limités par les cibles ordinaires du groupe ; filtrez les URL/éléments dans la règle. Les actions sont mises en file, puis appliquées après la distribution de l’événement. Une exception arrête ce gestionnaire sans annuler son état/ses actions ; les gestionnaires suivants peuvent encore s’exécuter. Il n’existe aucune confirmation d’action hormis les événements de fichier/requête.

## API partagée

- `on(type, handler)` → booléen. Enregistre `handler(ev)` ; plusieurs gestionnaires s’exécutent dans l’ordre d’enregistrement. False signifie des arguments invalides ou une limite de gestionnaires atteinte. `ev = { type: string, now: number, origin: "host" | "user" | "rule", data }` ; `now` est en millisecondes Unix. Les événements réels des contrôles affichés ont `origin: "user"` ; ceux de `v.emit` ont `origin: "rule"`.
- `v.state` : objet JSON modifiable, persisté après la distribution de l’événement. Initialisez les champs absents au lieu d’écraser l’état existant. Affecter une valeur non objet ou un tableau le réinitialise à `{}` ; les mises à jour non sérialisables/trop grandes ne sont pas persistées.
- `v.log(...values)` : écrit dans le Journal de ce groupe. Les erreurs des gestionnaires et les erreurs signalées des actions de page apparaissent aussi ici ; leur signalement ne rejoue pas les actions. Les journaux/Effacer sont indépendants par groupe. Les erreurs de chargement apparaissent dans l’état d’exécution.
- `v.emit(type, data)` : met en file une copie JSON de `data` pour les gestionnaires de ce groupe après l’événement courant, avec un nouveau `now` ; ce n’est pas un appel synchrone.
- `v.panel(id, spec, tabId?)` : remplace le panneau nommé de ce groupe ; omettez `tabId` pour toutes les pages web accessibles ou utilisez un identifiant d’onglet entier. Un `spec` null le retire. Voir Panneaux.
- `v.file(op, path, payload?)` → chaîne d’identifiant de requête. Voir Fichiers.
- `v.store(request)` renvoie un ID de requête ; voir les enregistrements du groupe.

Les autres appels partagés renvoient `undefined`, à l’exception des fonctions de création d’objets temporels gérés nommés ci-dessous. Les identifiants/l’état appartiennent à un groupe, pas à son nom affiché.

## Minuteurs gérés et utilisation sur fenêtre glissante

`v.timer(id, {direction:"down", durationMs:300000})` crée ou renvoie un compte à rebours nommé, initialement en pause. Utilisez `{direction:"up"}` pour un chronomètre croissant. L’objet propose `start()`, `pause()`, `resume()`, `reset()` et `snapshot()`. Démarrer/reprendre sont idempotents ; réinitialiser remet le minuteur en pause avec un temps écoulé nul. Les champs de l’instantané comprennent `ready`, `error`, `elapsedMs`, `remainingMs` (null pour un chronomètre croissant), `running` et `completed`.

Les minuteurs en cours avancent selon le temps réel écoulé lorsque l’application/le navigateur est fermé ou que la règle est désactivée. Un compte à rebours terminé transmet `timerEnded` avec `{id, direction, durationMs, generation, incarnation}` une fois par incarnation et génération du minuteur à chaque membre lorsque sa règle s’exécute à nouveau ; Exécuter ne le rejoue pas. La transmission dépend des événements de l’hôte ; ce n’est pas une alarme en temps réel. Ajoutez `{type:"timer", timerId:"focus", label:"Focus"}` à un panneau pour l’afficher avec le contrôle de texte existant.

`v.rolling(id, {windowMs:3600000, limitMs:600000})` crée ou renvoie un suivi nommé de l’utilisation active. `assign({websites:["youtube.com","reddit.com"], apps:[]})` remplace les affectations de cibles de ce membre. Les règles natives peuvent affecter à la place des identifiants d’applications de la plateforme. Les domaines incluent les sous-domaines. Un suivi regroupe ses cibles ; les autres identifiants ont des quotas indépendants. `snapshot()` renvoie `ready`, `error`, `usedMs`, `remainingMs`, `available` et `nextReturnAtMs` (la prochaine milliseconde où une utilisation enregistrée expire). `available(target?)` vérifie aussi l’affectation lorsqu’une cible est fournie. `reset()` efface l’historique de cet objet.

Toute utilisation admissible observée est comptabilisée, y compris au-delà du quota ; le suivi lui-même ne bloque aucune page/application. Les intervalles de pages visibles qui se chevauchent ne sont comptés qu’une fois, et les applications natives comptabilisent l’utilisation observée au premier plan. Les règles désactivées n’ajoutent aucune utilisation ; l’historique continue d’expirer aux limites exactes des intervalles. La disponibilité ne revient que lorsque l’historique restant est inférieur à la limite. Les échantillons périodiques sont limités à cinq secondes ; les interruptions dues à la fermeture ou à la désactivation ne créent pas d’activité. Les événements émis par l’utilisateur n’ajoutent aucune utilisation.

Les mêmes identifiants d’objet dans des groupes personnalisés liés partagent une autorité locale dans le hub natif. La liaison combine l’historique et les affectations des suivis et conserve l’état du minuteur initiateur ; les configurations incompatibles empêchent la liaison. Chaque membre reçoit son propre événement de fin. La déconnexion rend les suivis partagés indisponibles et refuse les commandes de minuteur jusqu’au retour d’une autorité à jour. Lors de la dissociation, chaque membre conserve l’utilisation partagée finale et l’état du minuteur, restaure ses propres cibles et abandonne les commandes de l’ancienne liaison. Le hub conserve l’instantané final jusqu’à ce que le membre de retour l’enregistre et en accuse réception ; les transferts en attente se terminent avant qu’une nouvelle liaison soit disponible.

Les objets nommés survivent à Exécuter et au redémarrage dans le champ réservé `v.state.$vaultTime` ; ne modifiez pas ce champ directement. Supprimez-les explicitement avec `v.removeTime(id)`. Les identifiants comportent de 1 à 80 lettres ASCII, chiffres, `_` ou `-` ; les noms de propriété réservés sont refusés. Jusqu’à 32 objets partagent la limite d’état de la règle de 64 Kio en UTF-8. Les durées sont des millisecondes entières jusqu’à 365 jours. L’historique glissant est limité à 1024 compartiments d’une minute et 2048 intervalles fusionnés. Les erreurs de capacité de l’historique laissent le suivi indisponible jusqu’à sa réinitialisation explicite ; les configurations invalides et les enregistrements trop volumineux signalent des erreurs sans effacer les données enregistrées.

```js
(on, v) => {
  const timer = v.timer("focus", {durationMs: 300000});
  v.panel("focus", {controls: [
    {type: "timer", timerId: "focus", label: "Focus"},
    {id: "start", type: "button", label: "Start"},
    {id: "pause", type: "button", label: "Pause"},
    {id: "reset", type: "button", label: "Reset"}
  ]});
  on("panel", ev => {
    if (ev.data.eventName !== "click") return;
    if (ev.data.controlId === "start") timer.start();
    if (ev.data.controlId === "pause") timer.pause();
    if (ev.data.controlId === "reset") timer.reset();
  });
  on("timerEnded", ev => v.log("Finished", ev.data.id));
}
```

## Événements du navigateur

La notation des données ci-dessous décrit des types ; ce n’est pas du code exécutable. `?` marque les champs facultatifs.

```text
tick (~1 second): { tabs: { tabId: number, url: string, active: boolean }[] }
tab: { kind: "open" | "navigate" | "close", tabId: number,
       url: string, previousUrl: string | null }
visible: { tabId: number, url: string, elapsedMs: number }
items: { tabId: number, platform: string, items: Item[] }
attachment: { eventName: "click" | "input" | "change", tabId: number,
              attachmentId: string, controlId: string, value: unknown,
              values: { [controlId: string]: unknown }, item: Item, text: string }
record: { requestId: string, ok: boolean, op?: string, key?: string,
          record?: Record | null, entries?: Header[], next?: string | null,
          deleted?: number, error?: string }
snooze: {}
panel: { panelId: string, controlId: string, eventName: string,
         value: string | number | boolean | null,
         values: { [controlId: string]: string | number | boolean } }
query: { requestId: string, tabId: number, url: string, selector: string,
         matches: Match[], error: string }
file: see Files

Item = { ref: string, contentId: string, instanceId: string, attachments: { [id: string]: Attachment },
         url: string, title: string, authors: string[],
         videoForm: "short" | "long" | "post" | "unknown",
         tags: { name: string, confidence: number }[],
         tagsSettled: boolean, isPage: boolean }
Match = { tag: string, text: string, href: string, src: string,
          title: string, label: string, value: string }
```

- `tick` est approximatif ; utilisez des horodatages, pas des comptes de ticks. `active` signifie sélectionné dans une fenêtre de navigateur, sans prouver que l’utilisateur le regarde. Les URL peuvent être vides/restreintes.
- `visible` provient de pages accessibles et non masquées ; `elapsedMs` est le temps depuis leur dernier signal périodique, zéro lorsqu’elles sont couvertes. Ce n’est ni une utilisation cumulée ni un temps de lecture.
- `items` (`platform: "web"` hors des sites reconnus) signale les éléments de flux nouveaux/modifiés pris en charge et les renvoie après Exécuter/réactivation. `ref` identifie une carte sur cette page, pas un identifiant durable de contenu ; `ref === "page"` désigne la page elle-même. Les titres/URL/auteurs peuvent être vides. `authors` contient des identifiants de source propres aux plateformes.
- Identifiants de plateforme : `youtube`, `tiktok`, `facebook`, `instagram`, `twitch`, `reddit`, `discord`, `twitter`, `bluesky`, `threads`, `substack`, `bilibili`, `rumble`, `pinterest`, `kick`, `tumblr`, `peertube`, `pixelfed`, `kuaishou`. La disponibilité des éléments dépend du balisage pris en charge de la page.
- Les étiquettes nécessitent le Classificateur de bureau connecté et une version/plateforme avec étiquetage activé (Chromium et Safari : YouTube, Reddit, Bilibili, X/`twitter`). La confiance va de 1–5. `tagsSettled === false` signifie en attente/indisponible, pas sans étiquette ; un `tags: []` terminé signifie sans étiquette.
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

Par événement et groupe : 256 actions en file, 200 appels de journal, 64 émissions ; le surplus est abandonné. Par règle : 1000 gestionnaires, 24 panneaux ; chaque liste de commandes contient 32 entrées et chaque choix 64 options ; le surplus est ignoré/tronqué. Les chaînes d’émission s’arrêtent après 16 générations. Limite d’état sérialisé : 65536 octets UTF-8. Gardez l’enregistrement et l’ensemble des gestionnaires de chaque événement sous 1 seconde ; les dépassements répétés ou un délai strict dépassé arrêtent le groupe jusqu’à Exécuter. Le journal conserve 200 entrées, accepte 50/seconde par groupe et tronque les messages longs vers 4096 caractères. Les minuteurs/réponses sont fournis au mieux, sans garantie de temps réel.

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


## Appels IA depuis une règle active

Chaque groupe personnalisé choisit une connexion/un modèle et un effort de raisonnement dans **AI calls**. Mac et navigateur utilisent la même API ; les requêtes navigateur nécessitent Mac Vault connecté et les identifiants du fournisseur y restent. Les groupes liés partagent le choix et une limite quotidienne facultative. Vide signifie aucune limite de groupe ; les limites du compte s’appliquent. La limite suit le jour UTC, persiste après redémarrage et compte toutes les tentatives soumises, y compris échouées. Le lien combine l’usage existant ; la dissociation conserve l’usage antérieur.

Le prompt et le contexte enregistrés sont partagés entre les groupes liés et disponibles dans les handlers sous `v.context.ai.prompt` et `v.context.ai.context`. Vault ne les envoie pas automatiquement ; la règle choisit ce qu’elle inclut dans chaque appel `v.ai`.

`v.ai({ prompt, input? })` renvoie immédiatement un identifiant de requête. Appelez-la dans un handler, pas lors de l’enregistrement de la règle. `input` accepte toute valeur JSON ; chaque prompt/input est limité à20KB. Les réponses arrivent comme événements `ai` events: `. Success text is at most48KB; citations are ` `ask` `note` : {requestId, ok, text, citations, error}. Texte réussi jusqu’à48KB ; citations {url,title}. Gardez les liens de sources visibles et cliquables pour les réponses de recherche Web. La recherche est toujours disponible au modèle. Aucun délai fixe de l’app ; concurrence bornée ; aucun repli de fournisseur ni nouvel essai automatique. Les réponses sont des données, jamais exécutées comme JavaScript ; la règle décide des actions existantes.

```javascript
(on, v) => {
  let pending = null;
  on("panel", ({ data }) => {
    if (data.controlId !== "ask" || pending) return;
    pending = v.ai({ prompt: v.context.ai.prompt || "Summarize this text.", input: {context:v.context.ai.context, note:data.values?.note ?? ""} });
  });
  on("ai", ({ data }) => {
    if (data.requestId !== pending) return;
    pending = null;
    if (!data.ok) { v.log("AI request failed:", data.error); return; }
    v.log(data.text, data.citations);
  });
}
```

Les appels en attente ne sont pas rejoués après redémarrage. Run, désactivation/réactivation et suppression écartent les anciennes réponses ; un navigateur déconnecté signale `ai-unavailable`. Autres erreurs : `ai-not-configured`, `ai-invalid-input`, `ai-busy`, `ai-daily-limit`, `ai-request-failed`, `ai-usage-storage-unavailable`. Un appel échoué ne remplace pas un résultat antérieur conservé par la règle. La limite d’état reste64KB.

Découvrez les choix sans identifiants avec `rule_ai_models` sur Mac ou `settings-rule-ai-models` dans le navigateur ; configurez `ruleAI` via le chemin set-group existant. Champs : `providerModel`, `accountID`, `reasoningEffort` (`default`, `low`, `medium`, `high`) et `dailyRequestLimit` (null ou1–100000). Utilisez un choix retourné ; ne placez ni clé ni URL fournisseur dans le code source.
Les champs enregistrés facultatifs sont `prompt` et `context`, des chaînes de 16KB maximum chacune.

## Enregistrements du groupe

`v.store(request)` lance une opération asynchrone d’enregistrement JSON dans un handler. Les enregistrements sont privés au groupe, persistent après Run et redémarrage, et sont supprimés avec le groupe. Les groupes liés ont des enregistrements séparés. La règle choisit clés, valeurs, versions, invalidation du cache et priorité des retours. Mac et navigateur utilisent la même API, mais chaque app/navigateur a son stockage.

| Requête | Résultat |
|---|---|
| `{op:"get", key}` | `record` ou `null` |
| `{op:"put", key, value, version?, ifRevision?}` | `record` enregistré |
| `{op:"delete", key, ifRevision?}` | `record: null` |
| `{op:"list", prefix?, after?, limit?}` | `entries` triées et `next` |
| `{op:"clear", prefix?}` | nombre `deleted` |

Chaque enregistrement contient `{value, revision, version, updatedAt}`. revision est opaque et change lors d’une vraie écriture ; `version` est une métadonnée de l’appelant. `list` renvoie les en-têtes sans valeurs ; `get` lit un enregistrement et `after: next` `put` `delete` demande la page suivante. Sans `ifRevision`, put/delete sont inconditionnels ; `null` exige une clé absente, une chaîne exige une correspondance exacte. En cas de conflit, retour `ok:false`, `error:"store-conflict"` et `record` courant. Cela évite qu’une réponse automatique tardive remplace un retour utilisateur. `v.context.revision` est un marqueur opaque de configuration que la règle peut inclure à sa version ; le framework n’impose pas de politique de cache.

Limites : clé 1–2048 caractères, version ≤128, valeur JSON ≤64KiB, profondeur ≤32, 10000 clés par groupe et document entier de16MiB. `list` renvoie au plus100 en-têtes et96KiB par page. Maximum32 requêtes par groupe et128 démarrages par seconde au total ; en surcharge, une erreur `store-busy` par groupe/seconde puis les suivantes sont abandonnées. Les erreurs de stockage renvoient `ok:false` ; un document futur ou mal formé est conservé et signale `store-unavailable`. Pas de nouvel essai ni éviction automatiques ; utiliser ticks pour les délais.

## Pièces jointes de contenu enregistrées

`v.attach(tabId, item, id, spec)` enregistre une pastille ou une vue HTML/CSS passive pour un élément observé. Fournissez l’`item` complet d’un événement `items` ou `attachment` ; un simple `ref` n’est pas une référence de pièce jointe. `contentId` désigne le contenu enregistré et `instanceId` son apparition actuelle. Gardez cette référence d’origine pendant l’attente d’AI. Vault refuse une pièce jointe tardive si la cible a été supprimée, réutilisée ou a navigué. `v.item(tabId, ref, verdict)` reste indépendant.

Pour une pastille, `spec` vaut `{type:"pill", text, tone?, tooltip?}` ; les tons sont `blue`, `cyan`, `gold`, `pink` ou `red`. Le texte brut accepte 240 caractères, le tooltip 1000. Pour une vue, spec vaut `{type:"html", html, css?, label?}`. Limites : HTML 32000 caractères, CSS 16000, label 200. La vue est reconstruite à partir de HTML/SVG passif autorisé dans une shadow root fermée avec CSS limité. Scripts, attributs d’événement, ressources distantes, intégrations et CSS dangereux sont retirés. La vue reste dans la carte de contenu et défile à 480px de hauteur. Les ID comportent 1–80 lettres/chiffres ASCII, _ ou -. Un spec null retire la pastille du groupe. Appelez depuis un handler ; les échecs de persistance/livraison apparaissent dans Log et ne sont pas relancés automatiquement.

Chaque élément expose les pièces jointes de ce groupe dans `item.attachments`, instantané en lecture seule ; celles des autres groupes n’y figurent pas. Si les données ne sont pas disponibles, `attachments` vaut null et `attachmentError` est défini ; cela ne signifie pas que le cache est vide. Les autres handlers continuent. Utilisez l’exemple pour éviter de redemander AI pour un contenu déjà doté d’un résultat enregistré.

```javascript
(on, v) => {
  on("items", ({data}) => {
    for (const item of data.items) {
      if (item.attachments && !item.attachments.note) {
        v.attach(data.tabId, item, "note", {
          type: "pill", text: "Review this", tone: "blue"
        });
      }
    }
  });
  on("attachment", ({data}) => {
    if (data.attachmentId === "note") {
      v.log("Review clicked", data.item.contentId);
    }
  });
}
```

L’activation par pointeur, Enter ou Space produit l’événement `attachment` du groupe. Les pastilles envoient `click`. Les contrôles d’une vue utilisent `data-control` ou `id` comme `controlId` et envoient `click`, `input` ou `change`, avec le `value` actuel et les `values` bornées des champs nommés. Les vrais événements UI ont `ev.origin === "user"` ; ceux créés par la règle ont `origin === "rule"`. Ils comprennent `tabId`, `attachmentId` et l’`item` actuel. La vue n’exécute pas le code de règle ; pastilles et vues empêchent leurs interactions de faire naviguer la carte sous-jacente. Les données enregistrées ne contiennent ni callback ni code exécutable. Une ancienne révision de pill ne peut pas déclencher une pièce jointe actuelle. Les événements emit de la règle restent sa logique ordinaire ; le navigateur vérifie séparément les vrais messages de clic.

Les pièces jointes sont enregistrées dans ce profil de navigateur par groupe/contenu/ID et reviennent lors d’apparitions ultérieures, de navigation, du redémarrage du navigateur et de Run. Disable les masque en gardant les données ; enable les restaure. La suppression du groupe supprime ses pièces jointes. Les groupes liés les gardent séparées ; aucune synchronisation automatique entre navigateurs/appareils. Les contenus YouTube, Reddit, X et Bilibili reconnus utilisent les ID de plateforme. Les autres utilisent une URL normalisée prudemment ; leur disponibilité dépend du balisage de page pris en charge.

Limites : 8 pièces jointes par groupe/contenu, 32 par élément tous groupes confondus, 10000 entrées de contenu par groupe et document sérialisé de 8MB. Une nouvelle mutation dépassant une limite est refusée avec `attachment-item-limit` ou `attachment-storage-limit` dans Log ; les données existantes sont conservées. Un dispatch regroupe les écritures et des spec identiques ne réécrivent pas le stockage. Les pièces jointes sont une UI de contenu du navigateur, y compris dans le moteur natif de règles Safari. Les règles de l’app Mac n’ont pas de handles de contenu navigateur ni de surface de pièce jointe intégrée.

`code-manual/generic-example.js` est un exemple de politique exécutable. Il utilise des enregistrements, appels AI, retours utilisateur, compare-and-swap, contrôles HTML, verdicts d’élément et rapport d’usage géré par la règle ; ces comportements appartiennent à l’exemple, pas au stockage.
