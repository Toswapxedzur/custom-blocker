# Politique de confidentialité — Bloqueur Web personnalisé

_Dernière mise à jour : 2026-08-04_

Cette page explique précisément quelles données l'extension de navigateur **Bloqueur Web personnalisé** collecte, où elles vont et pourquoi chaque autorisation de navigateur est demandée. En résumé : nous ne conservons ni vos règles ni vos données de navigation personnelles. La collecte et la classification facultatives de Vault Classifier restent sous votre contrôle et utilisent le pont local authentifié. Une intégration facultative et distincte d'IA locale (MCP) est elle aussi désactivée par défaut et n'expose des données qu'à un assistant que vous connectez et approuvez vous-même.

## Résumé

- **Votre configuration reste dans votre navigateur.** Les groupes de blocage, les plannings, les règles personnalisées, les journaux, les minuteurs et les préférences ne sont conservés que dans le stockage local de l'extension Chrome (`chrome.storage.local`).
- **Vault Classifier est strictement local.** Si vous activez explicitement l'intégration facultative de Vault Classifier, les éléments visibles des cartes/pages YouTube (comme un titre, la description visible, les étiquettes affichées et les identifiants publics de créateur/vidéo) sont acheminés uniquement via le pont local authentifié de Vault vers Vault Classifier sur votre Mac. Ils ne sont envoyés ni à notre site web, ni à un fournisseur de modèle, ni à l'API Data de YouTube, ni à aucun autre serveur.
- **La collecte est un consentement distinct.** Vault Classifier ne demande à l'extension des métadonnées YouTube rendues et sans publicité qu'après que vous avez activé la collecte YouTube dans son espace de travail de données de classification. Lorsqu'elle est désactivée, l'extension n'envoie aucun titre ni métadonnée de créateur pour la collecte. Lorsqu'elle est activée, les champs locaux conservés peuvent inclure un titre visible, le nom/identifiant du créateur, le type de vidéo, la durée, le texte visible d'abonnés/vues/date de publication et l'URL canonique.
- **Intégration facultative d'IA locale (MCP).** Si vous l'activez et connectez votre propre assistant IA, cet assistant peut — sur votre instruction explicite — lire des données sélectionnées (votre configuration, votre activité, votre temps d'utilisation, les URL des onglets actifs/ouverts, le contenu visible des pages sur les sites que vous avez configurés et toute donnée probante de Classifier) via un serveur Vault local sur votre appareil. Elle est désactivée par défaut, chaque connexion est approuvée par vous, et les mots de passe et clés d'API ne sont jamais lisibles par ce biais. Voir « Intégration facultative d'IA locale (MCP) » ci-dessous.
- **Il n'y a ni analyse d'audience, ni profil publicitaire, ni télémétrie, ni rapport de plantage.**
- **Aucun suivi** de l'activité de navigation au-delà de ce qui est strictement nécessaire pour appliquer les règles de blocage que vous avez vous-même configurées.

## Ce qui est stocké localement

L'extension stocke les éléments suivants dans le stockage local de l'extension de votre navigateur afin de pouvoir fonctionner d'une session à l'autre :

- Les groupes de blocage que vous créez : leurs noms, types de règles, listes de sites bloqués, plannings, paramètres de report (snooze), état de gel et tout JavaScript de règle personnalisée que vous écrivez.
- L'état d'exécution par groupe nécessaire à l'application des limites (par ex. combien de minutes d'un budget d'autorisation différée restent aujourd'hui, quand un report se termine, quand une période de gel strict prend fin).
- Vos propres préférences définies dans **Paramètres** (fréquence de rafraîchissement, délai d'enregistrement automatique, durée de report par défaut, URL de repli par défaut, bascule du mode de débogage, langue d'interface choisie).
- Les entrées du journal d'activité affichées dans le panneau **Journal** de l'application, que vous pouvez effacer depuis l'interface.
- Lorsque vous activez explicitement Vault Classifier, son application locale conserve un cache local, borné par l'utilisateur, des éléments visibles, des scores locaux, des décisions et des corrections nécessaires pour classer et expliquer les entrées. Ce cache reste sur votre Mac et ne fait pas partie du trafic habituel entre l'extension et le serveur.

Votre configuration, l'état d'exécution et le journal d'activité restent sur votre appareil et ne sont pas enregistrés par notre service. Selon la version du navigateur et les fonctionnalités que vous activez, ils peuvent être traités par l'extension, par son application compagnon locale pour Safari, ou par un pont Vault local explicitement lié.

## Ce qui n'est PAS collecté ni transmis

Ceci décrit le comportement de l'extension par elle-même. La seule exception est l'intégration facultative d'IA locale (MCP) que vous pouvez activer et connecter vous-même, décrite dans la section suivante.

- L'historique de navigation n'est ni enregistré, ni résumé, ni transmis par l'extension elle-même ; il sert uniquement à appliquer les règles que vous avez configurées.
- Le contenu des pages n'est ni exfiltré, ni capturé en image, ni journalisé par l'extension elle-même.
- Les données probantes de Vault Classifier ne sont pas transmises hors de l'appareil par l'extension. Elles sont traitées par le pont local apparié et l'application uniquement lorsque vous activez explicitement cette intégration.
- Les saisies de formulaire et les mots de passe ne sont jamais lus par l'extension ; les mots de passe et les clés d'API ne sont pas non plus lisibles via l'intégration d'IA locale (MCP).
- Aucun identifiant d'extension, de compte ou d'appareil, ni votre configuration de règles, n'est transmis pour l'application normale des règles.

## Intégration facultative d'IA locale (MCP)

L'extension peut, de manière facultative, répondre aux requêtes d'un **serveur MCP Vault** local exécuté au sein des applications de bureau Vault sur votre propre appareil, afin que vous puissiez connecter votre propre assistant IA (un « client MCP ») et lui faire lire votre configuration Vault ou agir dessus pour vous. Cette intégration est **désactivée par défaut** et ne change rien tant que vous ne l'activez pas délibérément.

- **C'est vous qui l'initiez.** Rien n'est exposé tant que vous n'avez pas activé l'intégration et connecté un client MCP, et chaque connexion de client est approuvée par vous. La désactiver révoque immédiatement l'accès.
- **Le serveur est local.** Les données fournies par l'extension sont remises, via le même pont authentifié de l'appareil, à un serveur MCP Vault sur votre Mac — pas à notre site web ni à aucun serveur Vault. L'extension elle-même n'envoie pas vos données à un tiers.
- **Votre assistant décide ensuite.** Une fois qu'un client MCP connecté reçoit des données à votre demande, leur sort est régi par **ce client** et ses propres conditions de confidentialité. Si l'assistant que vous avez choisi s'appuie sur un service distant, cet assistant peut transmettre vos données sur votre instruction — comme lorsque vous collez des informations dans n'importe quel outil d'IA. Choisissez un client en qui vous avez confiance.
- **Ce qui peut être exposé.** Sur votre instruction, un assistant connecté peut lire vos groupes de blocage, vos plannings, vos règles personnalisées, le journal d'activité, les compteurs de temps d'utilisation, l'URL de l'onglet actif ou des onglets ouverts, le contenu visible des pages sur les sites que vous avez configurés, ainsi que toute donnée probante et décision de Vault Classifier. Les actions qui modifient l'état (modifier des groupes, lancer un report, exécuter une règle enregistrée, déclencher une classification) sont confirmées individuellement.
- **Les secrets restent secrets.** Les mots de passe (comme un mot de passe de contrôle parental) et les clés d'API des fournisseurs sont en **écriture seule** via cette intégration : ils peuvent être définis, mais aucun assistant ne peut les relire.
- **Chromium uniquement.** Comme le pont Classifier, cette intégration n'existe que sur les navigateurs Chromium dotés de l'hôte local de l'appareil ; Firefox et Safari ne l'exposent pas.

## Pourquoi chaque autorisation est demandée

| Autorisation | À quoi elle sert |
| --- | --- |
| `storage` | Enregistrer et charger vos groupes de blocage, vos paramètres et l'état d'exécution uniquement dans votre navigateur. |
| `favicon` | Afficher les icônes de sites mises en cache par le navigateur à côté des règles dans Chromium. Cela n'envoie pas l'historique de navigation et n'effectue aucune requête vers notre service. |
| `nativeMessaging` | Sous Chromium, demander une preuve Native Messaging locale à l'appareil pour le pont authentifié de Vault Classifier ; sous Safari, transmettre les requêtes du bac à sable des règles personnalisées à l'application conteneur locale de l'appareil. Ce n'est pas un transport dans le cloud. |
| `alarms` | Réveiller le service worker d'arrière-plan selon le planning pour actualiser les limites basées sur le temps et l'état des règles à la fin d'une fenêtre de report, de gel ou de planning. |
| `offscreen` | Exécuter le JavaScript des règles personnalisées dans un bac à sable au sein d'un document hors écran afin qu'il ne puisse ni s'échapper de l'extension ni toucher directement vos pages. |
| `tabs` | Ouvrir l'éditeur dans un onglet complet lorsque vous cliquez sur l'icône de la barre d'outils, consulter l'URL de l'onglet actif pour évaluer les règles de groupe et recharger les onglets après une modification de règle effectuée dans l'éditeur. |
| `webNavigation` | Détecter les changements d'URL des applications monopages (navigation par push-state) afin que les masqueurs de fils par plateforme et les règles événementielles puissent réagir à la navigation intra-page, et pas seulement aux chargements de page complets. |
| Accès hôte `<all_urls>` | Appliquer vos règles de blocage et les masqueurs de fils par plateforme sur les sites que vous choisissez de bloquer. L'extension ne lit/modifie les pages que sur les URL pour lesquelles vous avez activement configuré une règle, et uniquement pour appliquer cette règle ; l'adaptateur facultatif de Vault Classifier est limité à YouTube. |

## Règles personnalisées

Si vous écrivez des règles JavaScript personnalisées, ce code :

- S'exécute dans un document hors écran en bac à sable ; il ne peut pas atteindre directement le réseau, vos pages ou d'autres extensions.
- Ne communique avec les scripts de contenu qu'à travers un pont de messages fixe défini par l'API auxiliaire de l'extension.
- Est automatiquement mis en quarantaine (désactivé avec une entrée de journal) s'il dépasse les limites intégrées de CPU, de journal, de messages ou de mutations du DOM.

Vos règles personnalisées sont stockées localement avec le reste de vos paramètres et ne sont jamais transmises hors de l'appareil.

## Statistiques du site web

Cette section concerne le **site web**. Le site web publie un petit panneau **Statistiques** et, pour le renseigner, le serveur conserve quelques totaux agrégés :

- **Nombres de téléchargements** — combien de fois le bouton de téléchargement de chaque produit a été cliqué (macOS, Windows, extension de navigateur, Safari).
- **Comptes** — combien de comptes existent.
- **Activité de questions-réponses** — le nombre total de publications et de commentaires du forum.

Une fois par heure, le serveur enregistre la valeur actuelle de chaque total agrégé. Ces instantanés ne contiennent aucun événement par visiteur, aucun parcours de clics ni historique de session.

- **Entièrement anonyme / dépersonnalisé.** Ce sont de simples totaux cumulés. Ils ne sont **pas** liés à votre nom, compte, e-mail, adresse IP, appareil ou tout autre identifiant : il n'existe aucun moyen de rattacher un total à une personne.
- **Jamais commercial.** Ces données n'existent que pour afficher le panneau public Statistiques. Elles ne sont **jamais vendues, partagées avec des tiers, utilisées à des fins publicitaires ni pour aucun autre objectif commercial.**

## Enfants

L'extension est un outil de productivité à usage général. Elle n'est pas destinée aux enfants, ne collecte sciemment les données de personne et n'affiche aucune publicité.

## Modifications de cette politique

Si les pratiques en matière de données changent dans une version future, ce fichier sera mis à jour et la modification sera résumée dans les notes de version de cette publication.

## Contact

Questions, préoccupations ou rapports de bogue : veuillez ouvrir un ticket sur le dépôt source de l'extension, ou utiliser l'e-mail d'assistance indiqué sur la fiche du Chrome Web Store.
