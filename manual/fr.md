# Référence fonctionnelle de l'extension Vault

## Objectif et statut

Il s'agit de la spécification fonctionnelle faisant autorité pour l'extension du navigateur Vault. Il documente le contrat du produit : les données qu'un utilisateur peut configurer, les comportements exacts produits par la configuration, le langage public des règles personnalisées et les limites qui s'y appliquent.

Il ne s’agit délibérément pas d’un guide de démarrage rapide. Le didacticiel du site Web est le parcours d'apprentissage. Ce document est destiné aux personnes qui doivent configurer, tester, maintenir, auditer ou reproduire le comportement visible par l'utilisateur de Vault.

Le code est la vérité canonique lorsque ce document et le produit sont en désaccord. Les noms dans ce document utilisent le vocabulaire stocké/public du produit lorsque cela est possible. Un mot tel que « retours » désigne la valeur de retour mise à la disposition d'une règle personnalisée ; il ne promet pas de résultat au niveau du navigateur si le navigateur ou la page refuse l'action demandée.

## 1. Limite du produit

Vault est une WebExtension de contrôle de focus. Son unité de configuration est un **groupe de blocs**. Un groupe peut :

- décider qu'un site Web de niveau supérieur, une page de plateforme, un créateur, une communauté, un serveur, une chaîne ou un compte doivent être bloqués ;
- masquer les surfaces de plate-forme configurées ou les cartes de flux correspondantes ;
- mesurer le temps passé dans un périmètre correspondant ;
- appliquer un programme, une protection contre le gel ou une répétition temporaire lorsque ce type de groupe le prend en charge ;
- exécuter une règle JavaScript personnalisée avec une API d'événement ;
- afficher une minuterie, un panneau, un message ou un journal de page sur la page ;
- rediriger, naviguer, fermer un onglet de navigateur ou maintenir une liste de blocage de sites créée par des règles de session uniquement ;
- éventuellement participer à un cluster de pont Vault connecté localement.

Vault agit uniquement dans le profil du navigateur où il est installé et uniquement là où le navigateur autorise l'exécution de son script de contenu. Ce n'est pas le cas :

- installer une application native ou une extension de navigateur ;
- bloquer les applications du système d'exploitation ;
- contourner les invites d'autorisation du navigateur, les restrictions de navigation privée ou le propre modèle de sécurité d'un site Web ;
- garantir le masquage basé sur le sélecteur lorsqu'une plateforme tierce modifie son DOM ;
- Rendre l'état des règles personnalisées portable entre les profils, à moins que l'utilisateur ne l'exporte/le configure séparément ;
- fournir un pare-feu réseau, un proxy, un contrôle de compte ou un service de surveillance parentale.

La terminologie suivante est utilisée partout :

| Terme | Signification |
| --- | --- |
| Groupe | Un objet de configuration nommé indépendamment. Les noms doivent être uniques au sein de l’extension, en ignorant la casse. |
| Groupe de sites | Un groupe normal dont la liste de domaines est sa principale condition de correspondance. |
| Groupe plateforme | Un groupe normal spécialisé pour YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord ou Twitter/X. |
| Groupe personnalisé | Un groupe qui possède une règle JavaScript et ses inscriptions aux événements. Sa règle décide de son comportement. |
| Correspondance | La page, l'élément de fil ou la surface de la plateforme satisfait aux conditions configurées d'un groupe. |
| Actif | Le groupe est activé, éligible pour son planning et n'est pas actuellement mis en attente. Les groupes personnalisés ne sont pas régis par l’interface utilisateur de planification normale. |
| Bloquer | Empêchez la page de niveau supérieur actuelle de rester utilisable, normalement en la redirigeant vers sa cible de secours. |
| Masquer | Supprimer ou masquer un élément/une carte dans la page actuellement rendue. Se cacher n'est pas un blocage du réseau. |
| URL de secours | Une cible de redirection spécifique au groupe. Si vide, la solution de secours globale est utilisée. |
| Effet d'autorisation/d'exception | Un verdict de carte de plate-forme qui sauve le contenu correspondant des règles de masquage de moindre priorité. Il ne s’agit pas d’une liste blanche générale de sites Web. |

## 2. Modèle de groupe et cycle de vie commun

Chaque groupe stocké possède un identifiant stable, un nom, un type, un indicateur activé et des champs de stratégie communs. Un nouveau groupe normal est activé par défaut. Un groupe peut être sélectionné, enregistré par le comportement de sauvegarde automatique de l'éditeur, réorganisé, exporté, importé, gelé, dégelé, mis en attente, désactivé ou supprimé.

### 2.1 Ordre et chevauchement

Plusieurs groupes peuvent correspondre à la même page. Vault évalue les groupes stockés de la fin de la liste affichée vers le début. Traitez les éléments inférieurs de la liste comme des correspondances ultérieures/de priorité supérieure lors de la conception de règles qui se chevauchent.

Pour le blocage de site ordinaire de niveau supérieur, tout groupe de blocage applicable peut rendre la page indisponible. Pour le filtrage des cartes de flux, la cascade de plate-forme utilise l'ordre et l'effet de chaque groupe correspondant : une autorisation/exception de correspondance ultérieure peut sauver un élément des prédicats de blocage de priorité inférieure. Ce comportement d'exception est limité à la surface de filtrage de la carte plate-forme ; il n'annule pas un blocage normal d'une page entière.

### 2.2 État activé

Les groupes handicapés sont conservés mais ne participent pas aux correspondances normales, aux minuteries, aux programmes ou aux opérations de répétition ordinaires. La désactivation d'un groupe personnalisé décharge également ses inscriptions actives. La réactivation ne transforme pas le texte non enregistré en une règle personnalisée active ; exécutez la règle pour charger la source enregistrée.

### 2.3 Champs communs

| Champ | Signification et contraintes |
| --- | --- |
| Nom | Non vide, tronqué et unique, sans tenir compte de la casse au sein de ce point de terminaison. Le pont identifie également les groupes pouvant être liés par nom et type, les noms stables sont donc importants. |
| Activé | Active ou désactive la correspondance normale. |
| Comportement | Blocage instantané, blocage après une allocation ou minuterie/compte à rebours. Les groupes personnalisés utilisent leur propre règle plutôt que ce sélecteur de comportement normal. |
| Minutes autorisées | Nombre positif utilisé par le comportement de blocage après allocation. Les nouveaux groupes durent par défaut 15 minutes. |
| Réinitialiser les heures d'intervalle | Nombre positif utilisé par les groupes normaux chronométrés. Les nouveaux groupes sont par défaut de 24 heures. |
| Journées actives | Du lundi au dimanche. Un groupe normal est inactif lorsque le jour de la semaine locale en cours n'est pas sélectionné. |
| Fenêtres horaires | Zéro ou plusieurs fenêtres d'heure locale, une par ligne, écrites sous la forme HHMM-HHMM. |
| Mode gel | Aucun, Gelé, Gelé strict ou Gelé parental. |
| Politique de répétition | Si le groupe autorise la répétition, avec des contrôles de durée/délai/recharge/confirmation pour les groupes normaux. |
| URL de secours | Destination utilisée si le groupe bloque une page. |
| Passer au suivant | Lorsqu'il est fourni dans l'éditeur, demande au flux de blocage normal de dépasser la cible bloquée plutôt que d'y rester. |

### 2.4 Comportements normaux de groupe

L'éditeur normal propose trois comportements :

| Comportement | Résultat fonctionnel |
| --- | --- |
| Bloquer immédiatement | Une fois que le groupe est actif et correspond, la décision normale de blocage de page est immédiate. |
| Bloquer après quelques minutes | Le temps de page visible correspondant s’accumule dans le cadre de l’allocation configurée. Lorsque l'allocation est épuisée, le groupe normal se bloque jusqu'à ce que sa période d'utilisation soit réinitialisée ou que le groupe soit autrement inactif/mis en veille. |
| Minuterie (compte croissant, pas de blocage) | L’heure correspondante de la page visible est enregistrée et peut être affichée. Ce mode ne bloque jamais simplement parce que son timer atteint une valeur. |

L'utilisation programmée est basée sur la durée de la page visible. Il n'est pas prévu de facturer du temps pendant qu'une page est masquée dans un onglet d'arrière-plan. L’intervalle de réinitialisation est un intervalle de politique glissant pour le groupe programmé normal. Les minuteries normales sont indépendantes par groupe.

### 2.5 Horaires

Les horaires s'appliquent aux groupes normaux. Un groupe personnalisé n'a pas d'interface utilisateur de planification normale et est considéré comme actif aux fins de son JavaScript ; la règle doit imposer elle-même toute condition de temps souhaitée.

La politique de jours actifs est évaluée en utilisant l'heure locale :

1. Si le jour de la semaine en cours n'est pas sélectionné, le groupe normal est inactif.
2. Si aucune fenêtre horaire valide n'est fournie, une journée active signifie la journée complète.
3. Si des fenêtres valides sont fournies, l'heure locale actuelle doit figurer dans au moins une fenêtre.

Chaque fenêtre a la forme exacte HHMM-HHMM, par exemple 0900-1200. Les heures doivent être de 00 à 23, les minutes de 00 à 59 et le début doit avoir lieu avant la fin du même jour. Une fenêtre inclut son début et exclut sa fin. Les fenêtres de minuit, telles que 23h00 à 01h00, ne sont pas valides. Les lignes vides sont ignorées et les fenêtres en double sont réduites.

### 2.6 Répétition

Pour un groupe normal, la répétition est un état d'inactivité temporaire comportant jusqu'à trois phases :

| Phases | Résultat |
| --- | --- |
| En attente | Le snooze demandé existe mais n'a pas démarré en raison de son délai d'activation. Le groupe est toujours actif. |
| Actif | Le groupe est temporairement inactif pendant sa durée de répétition. |
| Temps de recharge | La répétition est terminée, le groupe est à nouveau actif et une autre répétition ne peut pas démarrer avant l'expiration du temps de recharge. |

Les champs de configuration du groupe normal sont :

| Champ | Règle |
| --- | --- |
| Autoriser la répétition | Si cette option est désactivée, la répétition normale ne peut pas être démarrée. |
| Durée de répétition | Minutes positives. Un nouveau groupe normal prend la valeur par défaut globale, initialement 30. |
| Délai d'activation | Zéro ou plusieurs minutes. Blanc signifie zéro. |
| Temps de recharge | De zéro à cinq minutes. Blanc signifie zéro. |
| Confirmations | Un nombre entier non négatif. Le produit nécessite autant d’interactions de confirmation avant d’accéder à la demande. |

Un groupe personnalisé traite le bouton Snooze uniquement comme un événement d'entrée. Vault émet l'événement personnalisé nommé snoozePress pour ce groupe ; il n'applique pas le repli normal de durée/délai/temps de recharge au nom de la règle. Une règle personnalisée peut utiliser l'événement, sa propre persistance, un panneau, une minuterie ou aucune action du tout.

### 2.7 Geler

Le gel protège un groupe des changements de configuration ordinaires et des changements de répétition normaux. Le choix d'un mode de gel dans le sélecteur ne gèle pas le groupe en soi ; l'action de gel applique le mode choisi.

| Mode | Contrat fonctionnel |
| --- | --- |
| Congelé | Le groupe est verrouillé jusqu'à ce que le flux normal de confirmation de dégel du produit soit terminé. |
| Strictement congelé | Le groupe ne peut pas être dégelé tant que sa durée de gel strict n'est pas écoulée. La durée doit être supérieure à zéro et ne pas dépasser 72 heures ; un nouveau groupe est par défaut de 24 heures. |
| Gelé parental | Un mot de passe gardien est requis pour la gestion du gel/dégel. La boîte de dialogue de configuration utilise un mot de passe à six chiffres. |

Les groupes gelés ne peuvent pas être modifiés via des champs ordinaires. Un cluster lié par pont avec un membre hors ligne peut également verrouiller les contrôles de gel, car Vault ne peut pas coordonner en toute sécurité l'état gelé dans le cluster. Le gel est une protection contre les opérations normales de l'interface utilisateur ; cela ne transforme pas un profil de navigateur en une limite de sécurité immuable.

### 2.8 Importer, exporter, effacer et réinitialiser

L'exportation produit une représentation compatible du groupe sélectionné. L'importation valide et normalise les données de groupe compatibles avant de les ajouter. Les noms de groupes importés doivent toujours être uniques. Supprimer le groupe supprime ce groupe et son état d'utilisation/répétition normal. Clear supprime tous les groupes après confirmation.

La réinitialisation des valeurs par défaut est une opération de **paramètres globaux**. Il ignore les préférences à l'échelle de l'extension ; ce n’est pas un substitut à l’importation/exportation et doit être traité comme destructeur.

## 3. Types de groupes et contrat correspondant

### 3.1 Groupe de sites Web par défaut

Un groupe de sites possède une liste de sites Web séparés par des lignes. Les entrées sont normalisées sous forme d'hôte/domaine. Une entrée d'hôte correspond à cet hôte et à tous ses sous-domaines.

| Paramètre | Résultat |
| --- | --- |
| Bloquez tout sauf ces sites | La liste est une liste de blocage. Un hôte correspondant est bloqué. |
| Bloquez tout sauf ces sites sur | La liste est une liste verte. Tout hôte ne figurant pas dans la liste est bloqué. Une liste blanche vide est donc un verrouillage intentionnel du plein Web. |
| Bloquer la page d'accueil | Applique la stratégie du groupe à la surface de démarrage/accueil du navigateur configurée où ce contrôle est disponible. |
| URL de secours | Destination de redirection pour un bloc. Une valeur de groupe vide revient à la valeur par défaut globale. |

La liste normale de domaines de groupe de sites est la seule liste déclarative de site entier exposée par l'éditeur. Les groupes de plates-formes correspondent à leur propre plate-forme et aux conditions de plate-forme configurées.

### 3.2 Groupes de plateforme vidéo

YouTube, TikTok, Facebook, Instagram et Twitch sont des groupes de plateformes vidéo. Chacun est limité à son propre hôte de plateforme. Un groupe peut cibler le formulaire de contenu, la portée de l'auteur/du compte, le flux d'accueil de la plateforme et les contrôles facultatifs de masquage des éléments.

Les modes de création généraux sont :

| Mode | Résultat |
| --- | --- |
| Tout | Ne limitez pas par auteur ; d'autres axes configurés décident du match. |
| Inclure | Faites correspondre uniquement les créateurs/comptes normalisés répertoriés. |
| Exclure | Faites correspondre tous les créateurs/comptes détectés, à l'exception des entrées répertoriées. |
| Personne | Ne correspond à aucun auteur. Il s’agit d’un axe d’auteur délibéré sans correspondance. |
| La balise inclut | Faites correspondre les créateurs avec n'importe quelle balise répertoriée lorsque Vault peut les classer. Les créateurs inconnus/non classés échouent à l'ouverture. |
| Balise exclure | Faites correspondre les créateurs sans les balises configurées lorsque Vault peut les classer. Les créateurs inconnus/non classés échouent à l'ouverture. |

Les choix de forme de contenu sont spécifiques à la plateforme :

| Plateforme | Formulaires de contenu |
| --- | --- |
| YouTube | Toutes les pages, courts métrages, longues vidéos, publications. |
| Tik Tok | Toutes les pages, courtes vidéos. |
| Facebook | Toutes les pages, bobines, vidéos, publications. |
| Instagram | Toutes les pages, bobines, vidéos, publications. |
| Twitch | Toutes les pages, clips, flux/VOD, pages de chaînes. |

Vault normalise la saisie de l'auteur. L'éditeur accepte le formulaire de handle/canal/page ordinaire de la plateforme et les URL de profil prises en charge. Il peut rejeter les entrées mal formées ou les afficher comme invalides plutôt que de les transformer silencieusement en une cible différente.

Les choix de masquage de surface sont indépendants du blocage de niveau supérieur. Ils affectent uniquement l’interface utilisateur actuelle de la plateforme et peuvent cesser de fonctionner lorsque la plateforme modifie son balisage.

| Plateforme | Choix d’éléments de masquage expédiés |
| --- | --- |
| YouTube | Navigation/étagères/cartes de raccourcis, surfaces de promotion/annonces du flux d'accueil et commentaires. L'option liée aux publicités présente un avertissement car le masquage des publicités peut entrer en conflit avec les conditions d'une plateforme. |
| Tik Tok | Explorez la navigation. |
| Facebook | Navigation sur les bobines et surfaces des bobines. |
| Instagram | Bobines et exploration de la navigation/surfaces. |
| Twitch | Parcourir la navigation. |

La correspondance des balises de créateur YouTube utilise les classifications des chaînes locales/disponibles. Une classification manquante ne devient pas un bloc simplement parce qu'un mode de balise a été sélectionné.

### 3.3 Reddit

Un groupe Reddit s'applique uniquement sur Reddit. Son entité est un subreddit. L'entrée Subreddit accepte le formulaire de communauté ordinaire et le normalise avant de faire correspondre.

Les modes de sous-reddit sont :

| Mode | Résultat |
| --- | --- |
| Tout | Postulez à Reddit sans restriction de liste de sous-reddit. |
| Inclure | Postulez aux subreddits répertoriés. |
| Exclure | S'applique à tous, sauf aux subreddits répertoriés. |
| Personne | Ne postulez à aucun sous-reddit. |

L’option de masquage de surface fournie masque la navigation Populaire/Tous. Le comportement des cartes d'alimentation dépend de la structure des cartes actuellement détectables de Reddit.

### 3.4 Discorde

Un groupe Discord s'applique uniquement sur les pages Discord/Discordapp. Sa cible est un identifiant de serveur ou une paire serveur/canal. L'éditeur cible accepte les valeurs normalisées du chemin de canal Discord.

| Mode | Résultat |
| --- | --- |
| Tout | Postulez sur Discord sans restriction de liste de cibles. |
| Inclure | Appliquez-le uniquement aux cibles de serveur ou de serveur/canal répertoriées. |
| Exclure | S'applique à toutes les cibles sauf celles répertoriées. |
| Personne | Ne s'applique à aucune cible. |

Discord ne propose actuellement aucun choix d'élément de masquage dans le profil de plate-forme normal.

### 3.5Twitter/X

Un groupe Twitter/X s'applique sur X/Twitter. Il peut s'appliquer à tous les comptes ou utiliser les modes de compte généraux décrits pour les plateformes vidéo, avec une entrée de poignée/lien de profil normalisée.

Les choix d'éléments de masquage fournis sont Explorer, Messages, Grok, Tendances et éléments de flux promus. Comme pour tous les contrôles de surface basés sur des sélecteurs, une modification du balisage X peut affecter leur fonctionnement.

### 3.6 Champs déclaratifs de groupe personnalisés

Un groupe personnalisé exécute principalement sa source JavaScript. Il n'utilise pas le sélecteur de comportement normal ni l'interface utilisateur de planification normale. Il peut néanmoins transporter une liste de domaines lorsqu'il est importé ou configuré via des données compatibles :

- une liste de blocage personnalisée non vide peut participer à la décision ordinaire d'un site entier ;
- une liste blanche personnalisée peut participer même lorsqu'elle est vide, produisant un verrouillage déclaratif full-web ;
- un groupe personnalisé non configuré ne bloque pas accidentellement des pages simplement parce qu'il a une règle ;
- Les minuteries personnalisées ne se bloquent jamais d'elles-mêmes ; une règle décide explicitement s'il faut bloquer à l'expiration d'un minuteur.

## 4. Paramètres globaux

Les paramètres globaux s'appliquent à l'extension plutôt qu'à un groupe.

| Paramètre | Par défaut | Comportement |
| --- | --- | --- |
| Taux de tick | 1000 ms | Fréquence du tickEvent personnalisé partagé. La plage valide est comprise entre 250 et 60 000 ms. Des valeurs inférieures peuvent rendre les règles basées sur les événements plus réactives, mais utiliser davantage de CPU. |
| Anti-rebond de sauvegarde automatique | 400 ms | Délai après le dernier changement d'éditeur avant que les paramètres normaux ne persistent. Le maximum est de 5 000 ms. |
| Mode débogage | Désactivé | Active la sortie détaillée de la trace des règles personnalisées et la superposition du journal de débogage sur la page. Il ne contrôle pas si les appels de journal ordinaires d'une règle atteignent le journal contextuel. |
| Afficher les journaux de règles personnalisées sur les pages Web | Sur | Contrôle les toasts ordinaires du journal des pages. Les auteurs de règles peuvent toujours demander explicitement une sortie écran uniquement ou pop-up uniquement. |
| Durée de répétition par défaut | 30 minutes | Graine utilisée lors de la création de nouveaux groupes normaux. Les groupes existants conservent leur propre durée. |
| URL de secours par défaut | à propos de:vierge | Utilisé lorsqu'un groupe bloquant n'a pas d'URL de secours spécifique au groupe. |
| Aidez à classer les créateurs | Désactivé | Opt-in explicite. Il envoie les identifiants de chaîne YouTube rencontrés uniquement au service de classification configuré ; il n'envoie pas de titres ni d'historique de surveillance. |
| Dossier de fichiers local | Aucun | Capacité de dossier facultative pour les règles personnalisées. Voir le point 9. |

### 4.1 Interface de l'éditeur et surfaces de commentaires

L'éditeur d'extension dispose d'une liste de groupes persistante et d'un éditeur de groupes sélectionnés. La liste des groupes fournit le sélecteur de type de groupe, Ajouter, Effacer, la sélection, activer la bascule et l'ordre de déplacement. Son séparateur est redimensionnable. L'éditeur de groupes sélectionnés fournit des champs spécifiques au groupe et les actions d'exportation/importation du groupe.

L'éditeur enregistre automatiquement les modifications de champs ordinaires après la période anti-rebond globale. Les erreurs de validation sont signalées sous forme de retour d'état/toast ; les valeurs normales invalides ne sont pas converties silencieusement en paramètres non liés. Un groupe gelé désactive ses contrôles d'édition ordinaires.

L'extension dispose également de ces surfaces de commentaires visibles par l'utilisateur :

| Surfaces | Objectif fonctionnel |
| --- | --- |
| Manuel d'instructions | Ouvre cette référence dans l'extension. |
| Sélecteur de langue | Choisit la langue de l'interface de l'extension. |
| Paramètres | Ouvre les paramètres globaux décrits ci-dessus. |
| Commentaires sur l'état/le toast | Les rapports enregistrent, importent, valident et réalisent les résultats des actions. |
| Superposition de minuterie sur la page | Affiche les éléments de minuterie/compte à rebours normaux actifs et les minuteries personnalisées qui se trouvent dans leur champ d'affichage. Plusieurs éléments peuvent coexister. |
| Surface du journal sur la page | Reçoit des appels de journal personnalisés, d’avertissement et d’erreur lorsque les paramètres globaux le permettent. |
| Journal personnalisé | Un journal d'activité en direct pour les entrées visibles dans une fenêtre contextuelle créées par des règles. Il peut être effacé et téléchargé. |

Pour les groupes personnalisés, le champ Règles stocke le texte source. Run first effectue le contrôle en amont de la syntaxe des règles et ne charge la source que lorsque cela réussit. L'éditeur effectue également le peluchage de la source locale à mesure que le texte change. Le contrôle visible **Let AI Code** ouvre un champ d'invite et copie un ensemble de génération de code contenant la demande de l'utilisateur, la règle actuelle et une référence générée à l'API de règle personnalisée actuelle. Il ne contacte pas un service d’IA et ne modifie pas automatiquement la règle.

Le contrôle Modèles ouvre le navigateur de modèles. Un modèle, lorsqu'il est expédié, comporte un titre, une description, des balises, des paramètres et un aperçu généré. Son application remplace le texte actuel des règles après confirmation. Le catalogue de modèles actuellement livré est vide ; le navigateur reste disponible pour les futurs modèles sélectionnés et ne doit pas être traité comme une source de règles actives.

## 5. Langage de règles personnalisées

### 5.1 Formulaires sources de règles

La source d'un groupe personnalisé est JavaScript. Lors de **Exécuter**, Vault supprime les enregistrements et l'état antérieurs du groupe créés par la source active précédente, puis charge la nouvelle source.

La source peut être soit :

1. a function expression accepting events and helpers; or
2. des instructions nues qui utilisent les événements fournis (ou les événements hérités) et les variables d'assistance.

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

Run effectue la vérification de la syntaxe JavaScript/du contrôle en amont et, seulement lorsqu'elle réussit, rend la source actuelle active. L'enregistrement du texte et le texte en cours d'exécution sont intentionnellement différents : une règle peut être enregistrée sans devenir la source d'événement active.

La source active est déchargée lorsque le groupe personnalisé est réexécuté, désactivé, supprimé ou explicitement arrêté. La réexécution efface les gestionnaires de règles, les minuteurs, les panneaux, le compartiment de persistance et les prédicats de plateforme créés par les règles avant le début de l'enregistrement. Une récupération sandbox peut recharger la source active ; les auteurs de règles doivent donc rendre l’enregistrement idempotent.

### 5.2 Modèle d'exécution et hypothèses sûres

Custom rules are event registrations, not a continuous script loop. Register handlers during rule initialization, then respond to events.

Chaque gestionnaire reçoit :

```js
(event, helpers) => {
  // event: the currently dispatched event object
  // helpers: the public Vault Custom-rule API
}
```

Gestionnaires d’un événement exécuté par priorité numérique décroissante ; la priorité égale utilise l'ordre d'enregistrement. Un gestionnaire peut être remplacé en enregistrant à nouveau le même type d'événement et le même identifiant. Il existe un maximum de 1 000 gestionnaires enregistrés pour un groupe personnalisé.

Vault limite le travail actif d'un gestionnaire à environ une seconde. Trois dépassements de délai pour le même groupe en une minute mettent la règle en quarantaine : Vault la désactive plutôt que d'exécuter à plusieurs reprises un gestionnaire problématique. N'utilisez pas d'attentes occupées, de boucles illimitées, d'interrogations synchrones ou un grand nombre de mutations/journaux par événement.

Par expédition, Vault accepte au maximum :

| Article | Maximale |
| --- | --- |
| Entrées du journal des règles | 200 |
| Événements publiés | 64 |
| Opérations DOM | 256 |
| Action/intentions | 256 |
| Panneaux par groupe | 24 |
| Contrôles dans un seul panneau | 32 |
| Options dans sélection/commande radio | 64 |

Les entrées de journal, d'événement publié, d'opération DOM et d'intention excédentaires peuvent être supprimées. Une règle personnalisée ne doit pas dépendre de la livraison d'inscriptions excédentaires.

### 5.3 Types d'événements intégrés

Les chaînes de type d'événement suivantes sont intégrées. Une règle peut également utiliser sa propre chaîne de type non vide, à condition qu'elle ne commence pas par un trait de soulignement.

| Type d'événement | Quand il est envoyé | Données importantes |
| --- | --- | --- |
| tickEvénement | Tick ​​périodique partagé selon le paramètre de taux de tick global. | Contexte de la page/onglet actuel, le cas échéant. Utilisez l’option d’enregistrement intervalMs pour limiter le débit d’un gestionnaire individuel. |
| openWebEvent | Une page de niveau supérieur devient disponible pour la règle. | URL, nom d'hôte, identifiants d'onglet/page, heure. |
| fermerWebEvent | Une page/un onglet de niveau supérieur se ferme. | Contexte URL/nom d’hôte si disponible. |
| webChangedÉvénement | Une navigation engagée de haut niveau, y compris les rechargements avec la même URL. | les données contiennent des indicateurs d'URL/nom d'hôte et de navigation antérieurs tels que isFirstLoad, isReload et sameDomain. |
| minuterieFin | Une minuterie personnalisée passe à son état expiré. | données : timerId, displayName, direction, currentMs. Il est délivré uniquement au groupe propriétaire du timer. |
| snoozePresse | L'utilisateur appuie sur Start Snooze pour ce groupe personnalisé. | La règle est propriétaire de la réponse ; aucune répétition de répétition normale n’est effectuée. |
| panneauÉvénement | Un panneau personnalisé rendu a une interaction. | Les champs de données et de commodité incluent des informations sur le panneau/contrôle/événement/valeur. |
| localFileEvent | Une action de fichier local demandée se termine. | Les champs de données et de commodité incluent requestId, chemin, résultat, octets, entrées et erreur. |
| pageHeartbeatEvent | Un battement de cœur de page visible, environ toutes les 250 ms lorsque l'onglet est visible. | elapsedMs est le temps écoulé sur la page visible. Les minuteries personnalisées Scoped l’utilisent automatiquement même sans gestionnaire enregistré. |

### 5.4 API du registre d'événements

Le premier argument d'une source de style fonction est le registre d'événements. Dans la source de déclaration nue, les événements et l'événement font référence à ce registre.

| Méthode | Contrat |
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

L'objet facultatif d'options de gestionnaire prend en charge :

| Options | Signification |
| --- | --- |
| priorité | Ordre numérique. Les valeurs plus élevées s'exécutent avant les valeurs inférieures. Par défaut 0. |
| intervalleMs | Nombre positif. Pour tickEvent uniquement, supprime les appels jusqu'à ce que ce laps de temps se soit écoulé depuis l'appel précédent du gestionnaire. |

Les événements synthétiques ont par défaut une portée de groupe : seuls les gestionnaires appartenant au groupe émetteur les reçoivent. Utilisez { scope: "global" } pour envoyer l'événement à chaque règle qui a enregistré le même type. N'utilisez pas de trait de soulignement en début de nom d'événement ; c'est réservé.

### 5.5 Objet événement

Chaque gestionnaire reçoit un objet événement mutable avec des champs communs :

| Champ/méthode | Contrat |
| --- | --- |
| tapez | Chaîne de type d'événement. |
| ID groupe | ID du groupe personnalisé du destinataire. |
| tabId, pageId | Identifiants du navigateur lorsqu'ils sont disponibles ; sinon nul. |
| URL, nom d'hôte | URL et nom d'hôte actuels de niveau supérieur, ou chaînes vides. |
| temps | Copie de l'objet d'heure de répartition, ou null. |
| données | Charge utile spécifique à l'événement, ou null. |
| prévenirDefault() | Marque l'envoi comme une action de blocage de page. La page est redirigée vers le lien/résultat de redirection actuel s'il en existe un ; sinon, Vault utilise le chemin de sortie/de secours normal. |
| stopPropagation() | Arrête les gestionnaires ultérieurs pour la répartition de l'événement en cours. |
| setResult(valeur) | Stocke un résultat numérique ou une chaîne. Une chaîne non vide est traitée comme une cible de redirection ; le résultat 1 supprime un résultat PreventDefault autrement accumulé. |
| getResult() | Renvoie le résultat défini par cet objet événement, ou null. |
| post(type, données, options) | Mettez en file d'attente un événement synthétique, avec les mêmes règles de portée que Events.post. |
| setRedirectLink(url) | Définissez l'URL de redirection pour cette expédition. Renvoie false uniquement pour une entrée sans chaîne. |
| getRedirectLink() | Lisez l'URL de redirection de cette expédition ou une chaîne vide. |
| fermer(identifiant) | Demander la fermeture d'un onglet. Un nombre est un identifiant d'onglet, une chaîne identifie une URL et une valeur omise cible l'onglet actif. |
| bloc(identifiant) | Ajoutez un modèle de blocage de site dynamique pour la session uniquement. Sans identifiant de chaîne, utilisez le nom d'hôte de l'événement. |
| débloquer(id) | Supprimez un modèle de blocage de site dynamique de session uniquement. Sans identifiant de chaîne, utilisez le nom d'hôte de l'événement. |
| ouvert() | Pas d'opération dans l'extension du navigateur. Il ne peut pas lancer d'applications. |

Un gestionnaire peut attacher des propriétés supplémentaires arbitraires à un événement. Lisez-les via event.custom ou directement par le nom attribué pendant que cet objet événement est vivant. Il ne s’agit pas d’un état persistant et ne constituent pas un stockage multi-événements.

Pour panelEvent, ces champs pratiques sont ajoutés : panelId, controlId, eventName, valeur, valeurs, clé, code et keyInfo.

Pour localFileEvent, ces champs pratiques sont ajoutés : eventName, action, path, directoryPath, requestId, ok, texte, valeur, entrées, existe, octets et erreur.

### 5.6 Points d'entrée des assistants

L'objet helpers a ces propriétés directes :

| Point d'entrée | Signification |
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

## 6. Référence d'assistance personnalisée

### 6.1 Assistant de domaine

Get it with helpers.getDomainHelper(). It is also available as helpers.getDomainUtility().

| Méthode | Retour et comportement |
| --- | --- |
| nom d'hôteDe(url) | Hôte en minuscules normalisé sans www. initial, ou null pour une URL non valide. |
| chemin d'accèsDe(url) | Nom du chemin de l'URL, ou / lorsque l'URL ne peut pas être analysée. |
| correspondances (nom d'hôte, site) | Vrai lorsque le nom d'hôte est égal au site ou correspond à son sous-domaine. |
| getPlatform(url) | youtube, tiktok, instagram, facebook, twitch ou null. |
| isYouTubeHost (hôte), isTikTokHost (hôte), isInstagramHost (hôte), isFacebookHost (hôte), isTwitchHost (hôte), isRedditHost (hôte), isDiscordHost (hôte) | Classificateurs d'hôtes. |
| youtube(), tiktok(), instagram(), facebook(), twitch() | Renvoie l'objet classificateur d'URL de cette plate-forme. |
| isEmptyStartPage(url) | True pour les URL vides/nouvel onglet/page de démarrage prises en charge par le navigateur. |
| matchesAny(url, modèles) | Faites correspondre une URL avec une RegExp, un tableau RegExp ou des chaînes compilées sous forme d'expressions régulières. Les modèles de chaînes non valides sont ignorés. |
| cheminDébutAvec(url, chemin) | Vrai pour un chemin exact ou un descendant de chemin. Une barre oblique manquante est fournie. |
| queryHas(url, clé, valeur) | True si une clé de requête existe ; lorsque la valeur est fournie, elle doit également être égale à la valeur de la chaîne. |
| queryGet(url, clé) | Valeur de requête ou null. |
| isSearchPage(url) | Détecte les URL de recherche Google, Bing, DuckDuckGo, YouTube, Reddit et X/Twitter prises en charge. |
| isInfiniteFeedUrl(url) | Détecte les surfaces à alimentation infinie prises en charge. |
| mêmeSection(a, b) | Vrai uniquement lorsque les deux URL partagent un hôte et le premier segment de chemin d'accès. |

Chaque objet classificateur d'URL de plateforme expose isPlatformUrl(url), isShortUrl(url), isVideoUrl(url), isPostUrl(url), isHomePage(url), extractAuthor(url) et extractVideoId(url). Une méthode peut renvoyer false/null lorsque l'URL est valide mais n'identifie pas ce type de contenu.

### 6.2 Assistant de minuterie

Get it with helpers.getTimerHelper(). Timers are rule-owned counters. They may be displayed in Vault's page overlay, but they never block on their own.

Créer/obtenir des options :

| Options | Signification |
| --- | --- |
| identifiant | ID de minuterie non vide requis. |
| displayName | Étiquette superposée lisible par l'homme. |
| direction | en avant pour le compte à rebours ; toute autre valeur devient un compte à rebours/recul. |
| Mme actuelle | Millisecondes initiales, fixées à zéro et limitées si des limites existent. |
| minMs, maxMs | Limites minimales/maximales positives facultatives. |
| belles-mères | Étape de quantification positive facultative pour les ticks écoulés. |
| style de superposition | Chaînes facultatives pour la couleur, l’arrière-plan, la taille de police, le poids de police, la bordure, le rayon de bordure, le remplissage, l’opacité et l’icône. Les pièces non prises en charge/invalides sont supprimées. |
| portée(url) | Prédicat qui décide où le temps de page visible s'accumule. |
| domaine(url) | Prédicat qui décide où la minuterie apparaît dans la superposition ; la valeur par défaut est la portée. |
| accumulerQuand(url) | Prédicat supplémentaire facultatif. Le temps ne s'accumule que lorsque scope et accuWhen sont tous deux vrais. |

| Méthode | Comportement |
| --- | --- |
| créer(options) | Crée/remplace une minuterie et réinitialise son état. Renvoie l'identifiant ou null. |
| getOrCreateTimer(options) | Créer uniquement en cas d'absence. L'état existant reste inchangé. Renvoie l'identifiant ou null. |
| supprimer(identifiant) | Supprimez la minuterie et ses prédicats de portée/affichage. |
| pause(id), reprise(id) | Changer l'état en pause. Renvoie true uniquement lorsqu'un changement d'état est possible. |
| setDirection(id, direction) | Réglez en avant ou en arrière. |
| setCurrentMs(id, ms) | Définissez le nombre absolu, en appliquant les limites. |
| addMs(id, deltaMs), subMs(id, deltaMs) | Ajustez le nombre, en appliquant les limites. |
| setBounds(id, minMs, maxMs) | Fixez des limites positives ; passez null pour une limite pour le supprimer. |
| setStep(id, stepMs) | Définissez une quantification de tick positive. Passez null ou zéro pour l'effacer. |
| setOverlayStyle(id, style) | Remplacer/effacer les styles de superposition autorisés. |
| setDisplayName(id, nom) | Définir l'étiquette de superposition. |
| getCurrentMs(id) | Numéro, zéro pour un timer absent. |
| estExpiré(id) | Vrai uniquement lorsqu’un minuteur existe et que currentMs est nul. |
| estPause(id) | Booléen. |
| getDirection(id), getDisplayName(id) | Direction/nom ou nul. |
| existe(id) | Booléen. |
| getState(id) | Instantané de minuterie sérialisable ou null. |
| liste() | Tableau sérialisable d’instantanés de minuterie. |

Les prédicats de portée sont mémorisés tandis que la source personnalisée reste chargée. Vault avance les minuteurs correspondants pendant les cycles pageHeartbeatEvent visibles, un tick par minuteur et par envoi. Un temporisateur arrière s'arrête à zéro et émet timerEnded lors de la transition vers zéro. Il reste nul jusqu'à ce que la règle le modifie/le réinitialise. Utilisez un gestionnaire de fin de minuterie pour décider si une minuterie expirée doit appeler PreventDefault, définir une redirection ou effectuer une autre action.

### 6.3 Stockage persistant et asynchrone

Get the synchronous persistence helper with helpers.getPersistenceHelper(). Values must be JSON-serializable. A group can store at most 200 keys and each serialized value is limited to 16 KiB.

| Méthode | Comportement |
| --- | --- |
| get(clé, valeur par défaut) | Lit une valeur clonée ou defaultValue. |
| set(clé, valeur) | Stockez un clone sécurisé JSON. Renvoie false en cas d'épuisement de clé/valeur non valide ou de touches. |
| supprimer (clé) | Supprimer la clé existante ; renvoie s'il a existé. |
| a(clé) | Booléen. |
| clés() | Tableau de clés. |
| entrées() | Tableau de paires [clé, valeur] clonées. |
| clair() | Supprimez toute la persistance des règles pour ce groupe. |
| taille() | Nombre de clés. |

helpers.getStorageHelper() exposes all the preceding methods and two asynchronous request methods:

| Méthode | Comportement |
| --- | --- |
| requestAsyncGet(clé) | Demandez une lecture de stockage asynchrone. Renvoie vrai lorsqu'il est mis en file d'attente. Utilisez un événement ultérieur/votre propre flux d'état pour répondre ; ce n'est pas un getter synchrone. |
| requestAsyncSet(clé, valeur) | Demandez un magasin asynchrone sécurisé JSON. Renvoie vrai lorsqu'il est mis en file d'attente. |

La persistance des règles est effacée lors de l'exécution, car une nouvelle source active démarre avec un état de règle personnalisée propre.

### 6.4 Aide à la journalisation

Get it with helpers.getLogHelper(). Every method accepts any number of values.

| Méthode | Destination |
| --- | --- |
| journaliser, avertir, erreur | Journal d'activité contextuel ; toast de page lorsque les toasts globaux de journaux de pages sont activés. |
| logScreen, warnScreen, errorScreen | Surface de toast/débogage de page uniquement ; exclu du journal contextuel. |
| logPopup, warnPopup, errorPopup | Journal d'activité contextuel uniquement ; exclu du toast de la page. |

Les journaux tentent également d'atteindre la console du navigateur avec un préfixe de groupe CustomBlocker. Il s'agit d'une sortie de diagnostic, pas d'une API de persistance. Utilisez l'assistant de persistance pour l'état.

### 6.5 Assistant de redirection

Get it with helpers.getRedirectionHelper().

| Méthode | Comportement |
| --- | --- |
| get(), getRedirectLink() | Renvoie l'URL de redirection de répartition actuelle ou une chaîne vide. |
| set(url), setRedirectLink(url) | Définissez l'URL de redirection pour l'envoi actuel. |
| createMessageUrl(message) | Créez une URL de page de message local d’extension qui affiche le message fourni. |

Définir une redirection à lui seul ne force pas la navigation. Associez-le à event.preventDefault() ou définissez une chaîne non vide via event.setResult(), selon le flux de règles souhaité.

### 6.6 Assistant DOM

Get it with helpers.getDOMHelper(). These actions are queued and applied to the current page. Selectors must be valid for the page browser; malformed selectors or elements that do not exist can produce no visible result.

| Méthode | Action demandée |
| --- | --- |
| cacher (sélecteur), afficher (sélecteur) | Masquer/afficher les éléments correspondants. |
| addClass(sélecteur, nom de classe), removeClass(sélecteur, nom de classe) | Mutez la classe CSS. |
| setText(sélecteur, texte) | Remplacez le contenu du texte. |
| cliquez sur (sélecteur) | Cliquez sur l'élément correspondant. |
| injectCss(css, identifiant) | Ajoutez un bloc CSS identifié. |
| supprimerInjectedCss(id) | Supprimez un bloc CSS injecté précédemment identifié. |
| scrollTo(sélecteur) | Faites défiler un élément correspondant dans la vue. |

Les actions DOM ne fournissent pas de scripts de page sans restriction. Ils constituent une surface d'action limitée et doivent être idempotents lorsqu'ils sont utilisés par des gestionnaires de battements de cœur/tiques.

### 6.7 Navigation, onglets et assistant dans la fenêtre du navigateur

Get navigation with helpers.getNavigationHelper().

| Méthode | Action demandée |
| --- | --- |
| retour() | Naviguez vers l’onglet actuel en arrière. |
| en avant() | Naviguez vers l’avant dans l’onglet actuel. |
| recharger() | Recharger l'onglet actuel. |
| allerÀ(url) | Accédez à l'onglet actuel jusqu'à l'URL. |
| closeTab() | Ferme l'onglet actuel. |

Get a snapshot helper with helpers.getTabHelper().

| Méthode | Retour/action |
| --- | --- |
| liste() | Copie de l'instantané de l'onglet actuel. |
| getActiveTab() | Instantané de l'onglet actif ou null. |
| getById(id) | Instantané de l'onglet correspondant ou null. |
| countOpen() | Nombre d'onglets dans l'instantané. |
| requestRefresh() | Demandez un nouvel instantané d’onglet pour un travail ultérieur sur les règles. |

Get the browser-tab/window helper with helpers.getWindowHelper(). In the extension, a "window" is represented by browser tabs.

| Méthode | Comportement |
| --- | --- |
| courant() | Objet de l'onglet actif actuel : identifiant, URL, nom d'hôte, titre, isBrowser. |
| tout() | Tableau d'objets onglet avec identifiant, URL, nom d'hôte, titre, actif. |
| fermer(idOrUrl) | Fermez par identifiant d'onglet numérique, chaîne d'URL exacte ou onglet actif en cas d'omission. |
| closeTab() | Fermez l'onglet actif. |
| bloc (motif) | Ajoutez un bloc de domaine normalisé pour la session uniquement et appliquez-le. |
| débloquer (modèle) | Supprimez un bloc de domaine normalisé de session uniquement. |
| isBlocked(urlOuHostname) | Interrogez la liste de blocage de session créée par la règle. |
| getBlocked() | Répertoriez les modèles créés par la session en cours. |

Les modèles de blocs créés par des règles normalisent http/https, menant www., et les chemins dans un modèle d'hôte. Ils correspondent exactement à l’hôte et aux sous-domaines. Cette liste de blocage dynamique est une mémoire de session et non un groupe de sites normal enregistré.

### 6.8 Assistant de dossier de fichiers local

Get it with helpers.getLocalFolderHelper(). It only operates after the user has selected a folder in Global Settings and granted browser permission. It is asynchronous: every request returns a request id; completion arrives as localFileEvent.

| Méthode | Comportement |
| --- | --- |
| estDisponible() | Signale que la surface API existe ; cela ne prouve pas qu'un dossier est actuellement autorisé. |
| requestRead(chemin) | Demander la lecture du texte. |
| requestWrite(chemin, texte) | Demander l'écriture de texte. |
| requestAppend(chemin, texte) | Demander l'ajout de texte. |
| requestList(chemin = "") | Demandez une inscription dans l'annuaire. |
| requestExists(chemin) | Demander un test d'existence. |
| requestReadJson(chemin) | Demander la lecture de JSON ; le chemin doit se terminer par .json. |
| requestWriteJson(chemin, valeur) | Demander l'écriture JSON ; le chemin doit se terminer par .json et la valeur doit être sécurisée pour JSON. |

Les chemins sont toujours relatifs à la racine sélectionnée. Ils ne peuvent pas être absolus, qualifiés de lecteur, préfixés par un point ou contenir . ou .. segments. Seuls les fichiers .txt, .csv et .json sont acceptés pour les opérations sur les fichiers. La sélection de dossiers peut être révoquée à tout moment ; une demande ayant échoué signale ok false et une chaîne d'erreur dans localFileEvent.

### 6.9 Assistant de plateforme

Get the collection with helpers.getPlatformHelper() or helpers.platform(). Get one raw platform API with helpers.platform("youtube"), for example.

Toutes les API de plateforme brute exposent :

| Méthode | Comportement |
| --- | --- |
| cacher(prédicat, options) | Définissez le même prédicat par article pour chaque emplacement de carte d'alimentation sur cette plate-forme. |
| cacher(emplacement, prédicat, options) | Définissez un prédicat par élément. Le prédicat reçoit l'élément/instantané de plateforme fourni par cette plateforme. |
| autoriser (prédicat, options), autoriser (emplacement, prédicat, options) | Identique à hide mais crée un verdict d'autorisation/exception. |
| show(), show(emplacement) | Effacez tout ou un emplacement de prédicat installé. |
| surface(nom, "masquer" ou "afficher") | Masquer/afficher toute une région de plateforme. home est le nom public de la page d'accueil. |
| minuterie (emplacement, options) | Configurez une minuterie de sous-section de plate-forme. Renvoie options.id lorsqu'il est fourni, sinon nul. |
| rescan() | Réévaluez les cartes d’alimentation déjà numérisées après des modifications de l’état des règles externes. |
| instantané() | Renvoie l'instantané actuel de la plate-forme ou null. |
| slots(), surfaces(), timerSlots() | Renvoie les noms pris en charge pour cette plateforme. |
| isPlatformUrl, isShortUrl, isVideoUrl, isPostUrl, isHomePage, extractAuthor, extractVideoId | Assistants d'URL pour cette plate-forme. |

Un emplacement possède un prédicat pour un groupe/plateforme. Un appel masqué/autorisé ultérieur pour le même emplacement remplace le prédicat précédent ; ce n'est pas un OU implicite. L'objet options facultatives reconnaît :

| Options | Effet |
| --- | --- |
| blockPageOnVisit | Lorsqu'une carte/page correspondante est visitée, demandez un blocage de page plutôt que de simplement masquer la carte. |
| effet | bloquer (par défaut) ou autoriser. Les ensembles d'assistance d'autorisation autorisent automatiquement. |

Appelez à nouveau l'analyse chaque fois qu'un prédicat dépend d'un état qui a changé après la première évaluation des cartes, comme une case à cocher de panneau, un quota ou un seuil de temps.

Matrice de support de plateforme brute :

| Plateforme | Emplacements de prédicat | Noms des surfaces | Créneaux horaires |
| --- | --- | --- | --- |
| YouTube | courts métrages, vidéos, posts, commentaires, live | accueil, shortButton, commentaires, en direct | courts métrages, vidéos, articles |
| Tik Tok | vidéos, commentaires, live | accueil, commentaires, live | vidéos |
| Instagram | courts métrages, articles, commentaires | accueil, commentaires | courts métrages, poteaux |
| Facebook | courts métrages, vidéos, posts, commentaires, live | accueil, commentaires, live | courts métrages, vidéos, articles |
| Twitch | courts métrages, streams, vidéos, en direct | accueil, commentaires, live | courts métrages, streams, vidéos |

L'assistant brut de la plateforme personnalisée n'expose pas Reddit, Discord ou Twitter/X. Utilisez les fonctionnalités générales d'URL, de DOM, de minuterie, de panneau et de navigation pour un travail personnalisé sur ces sites.

## 7. Panneaux personnalisés

The panel helper creates safe, declarative on-page panels. Get it with helpers.getPanelHelper(). A panel can be scoped to URLs, react to interactions, display timer state, and retain its user-entered values for the active rule lifetime.

### API du panneau 7.1

| Méthode | Comportement |
| --- | --- |
| créer(config) | Créez ou remplacez un panneau. Renvoie l'identifiant de panneau normalisé ou null. |
| getOrCreatePanel(config) | Créer uniquement en cas d'absence ; renvoie l'identifiant ou null. |
| mise à jour (identifiant, patch) | Remplacez les champs du panneau spécifiés après validation. |
| supprimer(identifiant) | Supprimez un panneau et ses gestionnaires en ligne enregistrés. |
| afficher(id), cacher(id) | Changer la visibilité. |
| setValue(panelId, controlId, valeur) | Définissez une valeur de contrôle inscriptible après validation. |
| updateControl(panelId, controlId, patch) | Remplacez les champs autorisés d’un contrôle. |
| désactiver (panelId, controlId), activer (panelId, controlId) | Basculer la disponibilité du contrôle. |
| setOptions(panelId, controlId, options) | Remplacez les choix de sélection/radio. |
| setText(panelId, controlId, texte) | Mettez à jour une étiquette de bouton, un texte/texte de section ou une autre étiquette de contrôle. |
| setTheme(panelId, thème) | Remplacer le thème du panneau. |
| setTitle(panelId, titre), setDescription(panelId, description) | Mettre à jour le texte. |
| getValue(panelId, controlId) | Renvoie une valeur clonée ou non définie. |
| getValues(panelId) | Renvoie toutes les valeurs inscriptibles saisies par ID de contrôle. |
| getState(id) | Renvoie un instantané de panneau sérialisable ou null. |
| liste() | Renvoie des instantanés sérialisables de tous les panneaux. |
| avis(config) | Créez un panneau d'état compact en bas à droite avec un message/texte facultatif. |
| confirmer(config) | Créez une boîte de dialogue centrée avec les boutons de confirmation et d'annulation générés. |
| liste de contrôle (config) | Créez un panneau d’éléments de case à cocher. |
| formulaire(config) | Créez un panneau de présentation de formulaire à partir de champs. |

### 7.2 Configuration du panneau

| Champ | Valeurs/comportements acceptés |
| --- | --- |
| identifiant | Requis. Normalisé en lettres, chiffres, traits de soulignement, traits d'union ; maximum 80 caractères. |
| titre | Titre du panneau, maximum 240 caractères. |
| description ou corps | Description, 1 000 caractères maximum. |
| poste | en haut à gauche, en haut à droite, en bas à gauche, en bas à droite ou au centre. Par défaut en bas à droite. |
| aligner | gauche, centre ou droite. Gauche par défaut. |
| mise en page | vertical, compact, confortable, spacieux, en ligne, en ligne, enveloppant, deux colonnes, grille, divisé, formulaire, barre d'outils ou pile. Verticale par défaut. |
| priorité | Ordre d'affichage numérique, limité entre -1 000 et 1 000. Les panneaux supérieurs s'affichent en premier. |
| largeur | petit, moyen, grand ou 180 à 520 px. |
| Taille du texte/Taille de la police | 10 à 32 px, ou 0,65 à 2 rem/em. |
| ariaLabel/a11yLabel | Etiquette accessible. |
| rôle | région, boîte de dialogue, alerte, état, formulaire ou groupe. |
| mise au point automatique | Booléen. |
| thème/couleurs | arrière-plan, premier plan, accent, bordure, sourdine, fontSize/textSize, titleSize. |
| contrôles | Tableau pouvant contenir jusqu'à 32 contrôles, avec une imbrication de sections jusqu'à trois niveaux. |
| visible | False masque le panneau. |
| portée (url), domaine (url) | Fonctions de contrôle de disponibilité/affichage. le domaine est prioritaire ; sans domaine, les contrôles de portée s'affichent. |

Les champs du gestionnaire en ligne du panneau peuvent apparaître sur le panneau ou sur un contrôle individuel : onEvent, onChange, onClick, onInput, onFocus, onBlur, onSubmit, onClose, onMount, onUnmount, onKey et onKeyDown. Chacun reçoit les paramètres normaux (événement, helpers). Un gestionnaire en ligne est remplacé lorsque ce panneau est recréé/mis à jour avec des définitions de contrôle.

### 7.3 Contrôles

Les types de contrôle disponibles sont texte, case à cocher, sélection, textInput, textarea, bouton, section, minuterie, numberInput, plage, bascule, radio, date, heure, couleur, code PIN et HTML. Les alias d'entrée, de liste déroulante, de groupe, de numéro, de curseur, de commutateur, de brut et de balisage sont normalisés selon leur type correspondant.

Tous les contrôles acceptent l'identifiant, le type, l'étiquette, la valeur, la désactivation, la priorité et, le cas échéant, la disposition, l'alignement, ariaLabel/a11yLabel, l'autoFocus, la largeur, la hauteur et les lignes.

| Tapez | Champs importants et valeur du contrat |
| --- | --- |
| texte | texte (ou étiquette) rendu sous forme de texte non saisi. |
| case à cocher, bascule | Valeur booléenne. |
| sélectionner, radio | options sous forme de chaînes ou d'objets {value, label} ; maximum 64. La valeur est une chaîne courte. |
| entrée de texte, zone de texte | Valeur de chaîne, 2 000 caractères maximum ; espace réservé facultatif. |
| bouton | étiquette/texte ; action facultative soumettre, annuler ou fermer. |
| rubrique | texte/description, rôle et contrôles imbriqués. |
| minuterie | timerId ou instantané du minuteur ; formater ms, ss, mm:ss ou hh:mm:ss ; showExpired est vrai par défaut. |
| numberInput, plage | Valeur numérique fixée au min/max fourni ; étape positive facultative. |
| date | Valeur AAAA-MM-JJ uniquement. |
| temps | Valeur HH:MM ou HH:MM:SS uniquement. |
| couleur | Valeur d'entrée #RRGGBB à six chiffres. |
| épingle | Chiffres uniquement, longueur 3 à 12, masqués par défaut, soumission automatique en option. |
| HTML | Balisage aseptisé. Les blocs de script, les attributs d'événement en ligne et les URL javascript : sont supprimés. |

Chaque interaction rendue génère panelEvent. L'objet valeurs de l'événement contient les commandes inscriptibles du panneau, à l'exclusion des boutons, du texte et des commandes de minuterie. Une action rapprochée masque le panneau avant que les gestionnaires n'observent l'événement.

## 8. Recettes d'action avec des règles personnalisées

Les exemples suivants sont des spécifications de composition publique et non un didacticiel.

### 8.1 Rediriger une page d'ouverture

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

### 8.2 Compte à rebours du temps visible avec blocage explicite

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

### 8.3 Modifier un prédicat de flux à partir d'un panneau

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

Les prédicats doivent être écrits pour les valeurs d’instantané/d’élément de plateforme fournies par la surface de plateforme active. Si une plateforme ne peut pas identifier un champ de manière fiable, le prédicat doit échouer plutôt que de supposer qu'une valeur est vraie.

## 9. Protocole de demande de dossier local

Les opérations sur les dossiers locaux ne sont pas des E/S de fichier immédiates. La séquence fonctionnelle complète est la suivante :

1. L'utilisateur sélectionne un dossier dans les paramètres globaux.
2. La règle met une demande en file d'attente et reçoit un identifiant de demande.
3. Vault demande à la capacité de dossier autorisée d'effectuer l'opération.
4. Vault envoie localFileEvent au même groupe personnalisé.
5. Le gestionnaire met en corrélation event.requestId avec l'identifiant de la demande d'origine.

La lecture réussie se termine par du texte pour les fichiers texte ou une valeur pour JSON. La liste renvoie les entrées. Existe renvoie existe. Write/append fournit des octets le cas échéant. L'échec fournit ok false et erreur. Les règles ne doivent jamais supposer qu'un dossier sélectionné reste autorisé après un rechargement, un redémarrage du navigateur ou une révocation d'autorisation.

## 10. Sémantique de sécurité et de défaillance des règles personnalisées

### 10.1 Erreurs de compilation et d'exécution

Vérifiez la syntaxe signale l'échec de la compilation. Run peut également signaler une erreur d'exécution lors de l'enregistrement. Si une source de type fonction présente une erreur de syntaxe, Vault ne se contente pas de la traiter silencieusement comme des instructions nues et inoffensives.

Une source vide n’a aucun gestionnaire. Elle est valide en tant que règle personnalisée inactive, mais elle n'effectue aucune action personnalisée configurée.

### 10.2 Erreurs du gestionnaire

Une exception provenant d’un gestionnaire est isolée de la répartition globale des événements. Il s'agit d'une sortie de diagnostic ; cela ne permet pas aux gestionnaires ultérieurs de réussir comme par magie. Utilisez des gestionnaires restreints et enregistrez les erreurs exploitables.

### 10.3 Quarantaine

Vault peut mettre en quarantaine un groupe personnalisé après des dépassements répétés de délais ou un dépassement lors de l'inscription. La quarantaine désactive le groupe et enregistre la raison de son abandon. Corrigez la source, enregistrez-la et exécutez-la à nouveau explicitement pour restaurer les enregistrements actifs.

### 10.4 Limites du navigateur/page

Aucune règle personnalisée ne reçoit d'API d'extension sans restriction. En particulier :

- un sélecteur DOM ne trouve rien sur une plateforme qui a changé ;
- la navigation, la fermeture des onglets et les actions sur l'écran restent soumises aux capacités du navigateur ;
- une extension ne peut pas ouvrir les applications natives ;
- les opérations sur les dossiers locaux nécessitent un dossier accordé par l'utilisateur et les types de fichiers pris en charge ;
- un gestionnaire d'événements ne peut pas compter sur une page invisible qui continue à produire des battements de cœur en temps visible ;
- une page peut recharger, naviguer, être supprimée ou invalider un script de contenu indépendamment de la règle ;
- Les blocs de site dynamiques créés par des règles sont des actions d'état de session, et non des modifications permanentes de groupe de sites.

## 11. Pont d'application Web

L’extension de navigateur démarre automatiquement sa connexion au hub Vault local compatible sur ws://127.0.0.1:8787. Il n’existe aucun interrupteur de connexion utilisateur et la compatibilité du protocole est requise.

Vault effectue d’abord des sondes rapides, puis poursuit des tentatives de reconnexion plus lentes tant que l’extension fonctionne. Le transport automatique ne fusionne pas les groupes ; leur liaison et leur séparation restent explicites.

### 11.1 Lier des groupes

Les groupes peuvent être liés uniquement lorsque leur nom et leur type correspondent et qu'ils sont éligibles pour la liaison. L'utilisateur sélectionne/associe explicitement les programmes participants. Un groupe lié forme un cluster. La déconnexion laisse les données du groupe local intactes ; il arrête la synchronisation en direct.

Le pont synchronise la politique scalaire partagée pour les groupes liés pris en charge, y compris le mode de blocage normal, les valeurs d'autorisation/réinitialisation, les paramètres de répétition, les jours/fenêtres actifs, l'état/choix/durée de gel, la politique de la page d'accueil, le paramètre de liste autorisée, l'URL de secours et la politique de passage à la suivante. Il coordonne également l'utilisation et l'état de répétition pour les membres du cluster.

Le pont ne promet pas que chaque champ spécifique au produit, sélecteur de plate-forme, texte source personnalisé ou fonctionnalité spécifique au navigateur soit transférable à un programme différent. Un groupe peut rester local et non lié même lorsque le pont est connecté.

Les clusters de pont gelés nécessitent que tous les membres concernés soient en ligne pour les actions de gel qui nécessitent une mutation coordonnée. Une connexion est un transport local, pas une sauvegarde cloud ou un canal de contrôle à distance.

## 12. Liste de contrôle de vérification pour les responsables

Utilisez cette liste de contrôle lors de l'audit d'une version ou de la reproduction d'un comportement :

1. Confirmez que le groupe a un nom unique non vide, un type correct, un état activé et une liste/un ordre prévu.
2. Pour les groupes normaux, confirmez le jour de la semaine actif, la fenêtre horaire locale valide, l'absence de répétition active et l'état d'édition non gelé.
3. Pour un groupe de sites, testez l'hôte exact, le sous-domaine et (pour la liste verte) un hôte en dehors de la liste.
4. Pour un groupe de plates-formes, testez séparément la correspondance au niveau de la page, la correspondance élément/carte ciblé, le mode auteur, le mode formulaire de contenu et chaque masquage de surface activé.
5. Pour les groupes normaux chronométrés, vérifiez l'accumulation de pages visibles, l'expiration de l'allocation ou le comportement non bloquant du décompte et l'intervalle de réinitialisation.
6. Pour les règles personnalisées, exécutez la vérification de la syntaxe, Exécutez, inspectez le nombre/les journaux du gestionnaire, testez chaque événement intégré enregistré, puis testez un rechargement/une navigation.
7. Testez chaque minuterie personnalisée aux limites de la portée et à zéro ; vérifiez que tout bloc est explicite dans la règle.
8. Testez les panneaux avec chaque valeur de contrôle, état désactivé, action de soumission/annulation/fermeture et gestionnaire panelEvent.
9. Testez l'échec du dossier local avant de réussir : aucun dossier sélectionné, autorisation révoquée, chemin invalide, extension non prise en charge, puis lecture/écriture autorisée.
10. Testez le démarrage automatique du transport, les groupes liés/non liés et un membre de cluster hors ligne avant de compter sur la synchronisation ou la coordination du gel.

## 13. Règle de gestion des versions

Ce fichier anglais est le manuel source maintenu. Les manuels localisés en sont des traductions et peuvent nécessiter une régénération après une mise à jour de la documentation fonctionnelle. La source du produit reste la vérité canonique en matière d'ambiguïté au niveau de l'implémentation.
