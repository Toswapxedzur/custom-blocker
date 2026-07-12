# Source de la liste du Chrome Web Store

Il s'agit de la source anglaise de l'extension actuelle Manifest V3. Vérifiez-le par rapport à `manifest.json` avant de publier une nouvelle version de magasin.

## Nom de l'extension

```text
Adamancia Vault
```

## Brève description

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## Description détaillée

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## Explications des autorisations

| Autorisation | Objectif actuel |
| --- | --- |
| @@@GARDER0000@@@ | Enregistrez les groupes, les paramètres et l'état de l'éditeur local. |
| @@@GARDER0000@@@ | Planifiez des vérifications d’antécédents et des mises à jour de groupe basées sur le temps. |
| @@@GARDER0000@@@ | Exécutez le runtime de règles personnalisées contrôlé où Chromium nécessite un document hors écran. |
| @@@GARDER0000@@@ | Lisez le contexte de l'onglet actif nécessaire pour appliquer un groupe et afficher le statut. |
| @@@GARDER0000@@@ | Réévaluez les groupes applicables après la navigation. |
| @@@GARDER0000@@@ | Affichez les icônes du site Web dans l'éditeur lorsqu'elles sont disponibles. |
| @@@GARDER0000@@@ | Appliquez les règles de site Web et de plate-forme créées par l'utilisateur aux pages que l'utilisateur choisit de contrôler. |

## Libérer les contrôles

1. Exécutez `./tests/run.sh`.
2. Mettez à jour la version du manifeste uniquement pour la validation de la version.
3. Examinez le manuel en anglais et les résultats de l'audit de traduction.
4. Créez l'artefact de téléchargement à partir de la validation révisée.
5. N'incluez pas de notes sources, de montages de test ou de fichiers de développement privés dans l'artefact de téléchargement.
