# Politique de confidentialité — Bloqueur Web personnalisé

_Dernière mise à jour : 2026-06-30_

Cette page explique exactement quelles données le navigateur **Custom Web Blocker**
l'extension collecte, où elle va et pourquoi chaque autorisation du navigateur est
demandé. La version courte est la suivante : rien ne quitte votre navigateur.

## Résumé

- **Aucune donnée n'est envoyée à un serveur.** L'extension ne crée aucun réseau
  demandes à un tiers (ou à nous). Il n'a pas d'analyse, non
  télémétrie, pas de rapporteur de crash, pas de configuration à distance, pas de automatique
  mises à jour au-delà du mécanisme standard du Chrome Web Store.
- **Toutes les données restent dans votre navigateur**, conservées via la version locale de Chrome
  stockage d'extension (`chrome.storage.local`). Il n'est jamais synchronisé sauf si
  Chrome lui-même synchronise votre profil local.
- **Aucune information personnelle identifiable n'est collectée** par le
  prolongation à tout moment.
- **Aucun suivi** de l'activité de navigation au-delà de ce qui est strictement nécessaire
  pour appliquer les règles de blocage que vous avez vous-même configurées.

## Ce qui est stocké localement

L'extension stocke les éléments suivants dans l'extension locale de votre navigateur
stockage afin qu'il puisse faire son travail au fil des sessions :

- Les groupes de blocs que vous créez : leurs noms, types de règles, listes de
  sites bloqués, calendriers, paramètres de répétition, état de gel et tout autre
  JavaScript de règle personnalisée que vous écrivez.
- État d'exécution par groupe nécessaire pour appliquer les limites (par exemple, combien
  il reste aujourd'hui quelques minutes d'un budget à allocation différée, lorsqu'une répétition
  se termine, à la fin d’une période de gel strict).
- Vos propres préférences définies dans **Paramètres** (taux de tick, sauvegarde automatique
  anti-rebond, durée de répétition par défaut, URL de secours par défaut, mode débogage
  bascule, langue d'interface utilisateur choisie).
- Entrées du journal d'activité affichées dans le panneau **Journal** de l'application, que vous pouvez
  clair de l’interface utilisateur.

Ces données sont lues et écrites uniquement par les propres scripts de l'extension, uniquement
sur votre appareil, et uniquement dans votre propre profil de navigateur.

## Ce qui n'est PAS collecté ou transmis

- L'historique de navigation n'est ni enregistré, ni résumé, ni transmis.
- Le contenu de la page n'est pas exfiltré, capturé ou enregistré.
- La saisie du formulaire, les mots de passe et les informations personnelles ne sont jamais lus.
- Aucune information sur vous, votre appareil ou votre utilisation n'est envoyée au
  l'auteur de l'extension ou tout tiers.

## Pourquoi chaque autorisation est demandée

| Autorisation | À quoi sert-il |
| --- | --- |
| @@@GARDER0000@@@ | Enregistrez et chargez vos groupes de blocs, vos paramètres et votre état d'exécution dans votre navigateur uniquement. |
| @@@GARDER0000@@@ | Indiquez à Chrome quelles URL bloquer de manière native, en fonction des règles que vous avez configurées. Le navigateur gère le blocage ; l'extension enregistre et met à jour uniquement la liste de règles. |
| @@@GARDER0000@@@ | Réveillez le travailleur de service en arrière-plan selon la planification pour actualiser les limites temporelles et mettre à jour l'état des règles lorsqu'une fenêtre de répétition, de gel ou de planification se termine. |
| @@@GARDER0000@@@ | Exécutez du JavaScript avec règles personnalisées en bac à sable dans un document hors écran afin qu'il ne puisse pas échapper à l'extension ou toucher directement vos pages. |
| @@@GARDER0000@@@ | Ouvrez l'éditeur sous forme d'onglet complet lorsque vous cliquez sur l'icône de la barre d'outils, recherchez l'URL de l'onglet actif pour évaluer les règles de groupe et rechargez les onglets après une modification de règle que vous avez apportée dans l'éditeur. |
| @@@GARDER0000@@@ | Détectez les modifications d'URL SPA (navigation par état push) afin que les cacheurs de flux par plate-forme et les règles basées sur les événements puissent réagir à la navigation dans la page, et pas seulement au chargement de pages entières. |
| `<all_urls>` accès hôte | Appliquez vos règles de blocage et vos cacheurs de flux par plateforme sur les sites que vous choisissez de bloquer. L'extension lit/modifie les pages uniquement sur les URL pour lesquelles vous avez activement configuré une règle, et uniquement pour appliquer cette règle. |

## Règles personnalisées

Si vous écrivez des règles JavaScript personnalisées, ce code :

- S'exécute dans un document hors écran en bac à sable ; il ne peut pas atteindre directement le
  réseau, vos pages ou d’autres extensions.
- Communique avec les scripts de contenu uniquement via un pont de messages fixe
  défini par l'API d'assistance de l'extension.
- Est automatiquement mis en quarantaine (désactivé avec une entrée de journal) s'il
  dépasse les limites intégrées du processeur, du journal, du message post-message ou de la mutation DOM.

Vos règles personnalisées sont stockées localement avec le reste de vos paramètres
et ne sont jamais transmis depuis l'appareil.

## Statistiques du site Web et du service de balise de créateur

Cette section concerne le **site Web et le service facultatif de balise de créateur**,
qui sont distincts de l’extension elle-même. L'extension envoie toujours
rien, comme décrit ci-dessus. Le site publie une petite **Statistiques**
panneau, et pour le remplir, le serveur conserve quelques comptes globaux :

- **Les téléchargements comptent** : combien de fois le bouton de téléchargement de chaque produit a été actionné
  cliqué (macOS, Windows, extension de navigateur, Safari).
- **Créateurs classés** : combien de créateurs YouTube ont été tagués.
- **Comptes** : combien de comptes existent.
- **Activité questions-réponses** — le nombre total de publications et de commentaires sur le forum.

Une fois par heure, le serveur enregistre la valeur actuelle de chacun de ces comptes et
rien d'autre. Il n'y a pas d'enregistrements par événement, pas de flux de clics et pas de session
histoire.

- **Entièrement anonyme / anonymisé.** Il s'agit de totaux cumulés simples. Ils
  ne sont **pas** liés à votre nom, compte, e-mail, adresse IP, appareil ou tout autre
  autre identifiant - il n'y a aucun moyen d'attribuer un compte à rebours à une personne.
- **Jamais commercial.** Ces données existent uniquement pour montrer les statistiques publiques
  panneau. Il n'est **jamais vendu, partagé avec des tiers, utilisé à des fins publicitaires,
  ou utilisé à toute autre fin commerciale.**
- **Contributions facultatives à l'identifiant de chaîne.** Si — et seulement si — vous vous inscrivez, le
  l'extension/le site Web peut partager des **identifiants de chaîne** YouTube (jamais de titres de vidéo,
  regarder l'historique ou quoi que ce soit de personnel) pour aider à classer les créateurs pour tout le monde.

## Enfants

L'extension est un outil de productivité à usage général. Ce n'est pas
destiné aux enfants, ne collecte sciemment aucune donnée auprès de qui que ce soit, et
n'affiche aucune publicité.

## Modifications apportées à cette politique

Si jamais les pratiques en matière de données changent dans une version future, ce fichier sera
sera mis à jour et le changement sera résumé dans les notes de version pour
cette version.

## Contacter

Questions, préoccupations ou rapports de bogues : veuillez ouvrir un problème sur le
le référentiel source de l'extension, ou utilisez l'e-mail d'assistance répertorié sur le
Liste du Chrome Web Store.
