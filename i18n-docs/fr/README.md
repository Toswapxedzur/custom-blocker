# Extension du coffre-fort

L'extension Vault est un outil de focus Manifest V3 pour les navigateurs Chromium. Son éditeur actuel gère les groupes de blocage de sites Web, les groupes de plates-formes prises en charge, les groupes JavaScript personnalisés, les planifications, les contrôles de gel et de répétition et les liens de pont d'application Web facultatifs.

Le code source est le contrat de produit. Le manuel en anglais intégré à l'application à l'adresse [manual/en.md](manual/en.md) explique les commandes expédiées ; il remplace les manuels précédents copiés et traduits automatiquement.

## Capacités actuelles

- Groupes de sites Web par défaut avec comportement de liste de blocage ou de liste autorisée, redirection facultative, blocage immédiat, allocation de temps ou compte à rebours.
- Groupes dédiés pour YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord et Twitter/X.
- Filtres spécifiques à la plate-forme et contrôles de masquage d'éléments facultatifs lorsque le profil de plate-forme actuel les prend en charge.
- Groupes JavaScript personnalisés avec vérification de la syntaxe, modèles, contrôles d'exécution, environnement d'exécution contrôlé et flux de journaux.
- Planifications par groupe, modes de gel, contrôles de répétition, importation/exportation et sauvegarde automatique.
- Accès facultatif au dossier local pour les opérations de texte de règle personnalisée, CSV et JSON prises en charge.
- Connexion facultative à un hub de pont Vault natif pour les groupes explicitement liés.

## Exécuter localement

1. Ouvrez `chrome://extensions` dans un navigateur Chromium.
2. Activez le **Mode développeur**.
3. Sélectionnez **Charger décompressé** et choisissez ce dossier de référentiel.
4. Ouvrez l'extension Vault et créez un groupe.

Le manifeste nécessite Chrome 116 ou version ultérieure pour ses API hors écran et de règles actuelles.

## Contrôles de développement

Exécutez la suite de tests d'extension à partir de ce dossier :

```bash
./tests/run.sh
```

La suite exerce le comportement d'assistance, les profils de plate-forme, le rendu Markdown et l'audit du catalogue de traduction.

## Manuels et traductions localisés

Les documents anglais restent la source canonique. L'extension expédie ses manuels localisés à côté de `manual/en.md`, et les copies localisées d'autres documents conservés sont en direct sous `i18n-docs/<locale>/`.

Les catalogues d'interface utilisateur dans `translation/*.json` sont complets pour chaque paramètre régional pris en charge. Vérifier les catalogues et documents localisés avec :

```bash
node scripts/translation-audit.js
node scripts/documentation-audit.js
```

## Portée

L'extension Vault n'agit que dans le profil du navigateur où elle est installée et sur les pages auxquelles le navigateur lui accorde l'accès. Il n'installe pas d'applications natives, ne modifie pas les autorisations système et ne synchronise pas les groupes, sauf si l'utilisateur connecte explicitement un pont et lie les groupes correspondants.
