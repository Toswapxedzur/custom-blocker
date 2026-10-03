# Manuel d’utilisation de l’extension de navigateur Vault

Vault contrôle les sites web et les contenus des plateformes prises en charge dans le profil du navigateur où il est installé. Ouvrez son éditeur avec le bouton de l’extension dans la barre d’outils. Une fois connecté, Mac Vault ou Windows Vault fournit l’étiquetage local et l’Activité ; l’extension applique les cibles du navigateur.

## Groupes de blocage

Un **groupe de blocage** applique une politique de blocage. Un **groupe du Classificateur** attribue des étiquettes au contenu ; il ne bloque rien à lui seul.

1. Ajoutez un groupe de blocage et donnez-lui un nom.
2. Choisissez les cibles sous **S’applique à**.
3. Choisissez quand le blocage s’applique, puis définissez les horaires ou le temps autorisé nécessaires.
4. Activez le groupe. Ses cibles partagent sa politique.

Les modifications courantes sont enregistrées automatiquement. Une erreur signifie que la modification n’a pas été acceptée ; corrigez le champ et réessayez. Désactivez un groupe pour arrêter sa politique tout en conservant sa configuration. **Supprimer le groupe** le retire. Faites glisser les groupes pour les réordonner. Plusieurs groupes peuvent s’appliquer à une cible ; mettre l’un en pause ne lève pas le blocage d’un autre.

**Exporter** copie la configuration d’un groupe. **Importer** remplace la configuration du groupe sélectionné après confirmation.

### Temps autorisé et horaires

**Bloquer immédiatement** s’applique dès que le groupe activé correspond et que ses horaires sont actifs. **Bloquer lorsque le temps autorisé est épuisé** permet l’utilisation correspondante jusqu’à épuisement du temps disponible.

Définissez le temps autorisé en minutes et l’intervalle de réinitialisation en heures. Une limite glissante compte l’utilisation dans la fenêtre précédente. La réinitialisation à minuit commence une nouvelle période à minuit local, y compris pour une limite glissante.

Choisissez les jours actifs et, éventuellement, des plages horaires locales, une par ligne, par exemple **09:00-12:00**. Une liste vide s’applique pendant toute la journée des jours sélectionnés. Une plage doit se terminer après son début le même jour ; répartissez un horaire nocturne sur des jours distincts.

### Pause

Configurez la pause dans chaque groupe de blocage. **Mettre le blocage en pause** suspend la politique du groupe pendant la durée de pause. **Ajouter au temps autorisé** ajoute des minutes utilisables à un groupe limité dans le temps. Seul le temps supplémentaire consommé compte comme temps de pause. Le temps supplémentaire inutilisé expire à la prochaine réinitialisation ; pour une limite glissante, après une fenêtre, ou plus tôt à minuit si cette option est activée.

**Délai d’activation** reporte la pause tandis que le blocage continue. **Délai après la pause** est l’attente entre la fin d’une pause et une nouvelle demande. **Confirmations requises** définit le nombre d’étapes de confirmation. La pause n’est disponible dans un groupe verrouillé que si elle était autorisée avant le verrouillage.

### Verrouillage et PIN

**Verrouiller les modifications** empêche les modifications courantes. Le déverrouillage exige dix confirmations espacées de cinq secondes, ainsi que l’attente configurée et le PIN à six chiffres, le cas échéant. **Attente avant le déverrouillage** accepte 0–72 heures ; 0 n’ajoute aucune attente.

Pendant le verrouillage, l’attente peut être prolongée et un PIN ajouté s’il n’en existe pas. Ces conditions ne peuvent pas être assouplies avant le déverrouillage du groupe. La suppression respecte également l’attente restante et le PIN.

### Groupes liés

Utilisez **Lier** pour connecter des groupes explicitement sélectionnés dans d’autres programmes Vault. Les groupes liés partagent leur nom, les paramètres de politique pris en charge, les cibles, l’utilisation et les conditions de verrouillage. Chaque programme modifie et applique les types de cibles qu’il prend en charge ; les autres entrées restent accessibles aux programmes liés. Délier conserve chaque groupe et ses paramètres.

Si un membre lié est hors ligne, la modification peut être indisponible. Ouvrez l’application Vault de bureau et le navigateur lié pour les reconnecter. Une politique enregistrée localement peut continuer de s’appliquer lorsqu’un membre est hors ligne.

## Obtenir de l’aide

Cliquez sur le petit **i** près d’un champ pour voir son explication. Cliquez à l’extérieur ou appuyez sur Échap pour la fermer. Les listes restent dans des zones défilantes ; faites défiler la zone pour atteindre d’autres entrées. La recherche filtre la liste visible sans supprimer d’entrées.

Les règles personnalisées ont leur propre [Manuel de code](../code-manual/fr.md). Il explique l’éditeur, l’activation, les journaux, l’accès aux fichiers et l’API prise en charge.

## Sites web et contenus des plateformes

Ajoutez des domaines ou des URL complètes, un par entrée. Un domaine comprend ses sous-domaines. Un chemin limite la correspondance à ce chemin et à ses descendants. **Tout bloquer sauf ces sites** transforme la liste en liste d’autorisation.

Vous pouvez ajouter plusieurs fois le même site web. Chaque entrée a son propre filtre et ses commandes de page ; par exemple, une entrée YouTube peut bloquer les Shorts et une autre un créateur. Les entrées correspondantes se combinent dans le groupe et partagent ses horaires, son temps autorisé et sa pause.

Une cible peut couvrir une page correspondante ou la mettre d’abord en pause, puis proposer Continuer après un compte à rebours. Une cible de blocage est prioritaire sur une cible de pause du même groupe. **En cas de blocage : adresse de redirection ou message** accepte une adresse web ou un message de couverture ; laissez ce champ vide pour couvrir la page sur place. Une pause ne redirige jamais.

Les cibles de plateformes utilisent **Créateurs** pour les plateformes vidéo, **Comptes** pour Twitter / X, **Communautés** pour Reddit et des identifiants de serveur/canal pour Discord. Les commandes s’appliquent lorsque Vault peut identifier la source et le type de contenu. Les commandes de contenu masquent les éléments de page pris en charge, comme les publicités ou les cartes vidéo. Les autorisations du navigateur et les changements des sites peuvent affecter ces commandes.

### Filtres d’étiquettes de contenu

La connexion au Classificateur et la correction des étiquettes sont disponibles dans les navigateurs Chromium pris en charge, comme Chrome et Edge, et dans Safari Vault sous macOS.

Connectez Mac Vault ou Windows Vault et configurez son Classificateur pour obtenir des étiquettes. Le filtre d’étiquettes d’un groupe de blocage choisit ce qui sera couvert ou masqué. Il ne démarre ni ne suspend l’étiquetage ; utilisez les paramètres du Classificateur de l’application de bureau ou la commande de pause du groupe du Classificateur concerné.

Chaque entrée de site web a un filtre **Appliquer à** : tous les contenus, les créateurs sélectionnés, tous sauf les créateurs sélectionnés, les étiquettes sélectionnées ou tous sauf les étiquettes sélectionnées. Ajoutez une autre entrée du même site lorsque vous avez besoin d’un filtre différent.

Choisissez certaines étiquettes ou tout sauf certaines étiquettes. Une règle peut combiner des étiquettes (**Gaming + Drama**), exiger une confiance (**Gaming @3**) ou définir une exception (**!Tutorial**). **Couvrir le contenu** laisse la correction des étiquettes disponible. **Masquer le contenu** retire l’élément correspondant.

**Bloquer aussi le contenu sans étiquette suffisamment fiable** comprend les résultats terminés sans étiquette au seuil de confiance par défaut, y compris les résultats à faible confiance. Les règles explicitement indiquées sont vérifiées d’abord. **Sans étiquette** signifie que l’étiquetage s’est terminé sans étiquette ; **Étiquetage en cours** signifie qu’un résultat est attendu. L’option distincte pour les contenus en attente contrôle leur couverture jusqu’à la fin de l’étiquetage.

### Corriger les étiquettes

Cliquez sur **+ étiquette** près des étiquettes d’un élément pour ouvrir le sélecteur de correction. Recherchez les étiquettes existantes du Classificateur et choisissez-en une à ajouter. Cliquez sur la commande de suppression d’une étiquette sélectionnée, ou sélectionnez-la et appuyez une fois sur Suppr pour la retirer. Les corrections sont envoyées à l’application de bureau connectée et utilisées pour les étiquetages futurs. Une recherche indisponible affiche **Sans étiquette** et peut être réessayée automatiquement ; cet affichage ne crée pas d’étiquette dans votre Classificateur.

## Paramètres et connexion

**Afficher le + d’ajout rapide** ajoute un petit bouton aux pages prises en charge. Sélectionnez un groupe dans la liste comme destination ; votre sélection est mémorisée lorsque Vault est rouvert. Utilisez le bouton de la page pour l’ajouter à sa liste de sites web. Dans une liste d’autorisation, cela autorise la page. Les groupes verrouillés n’acceptent pas les ajouts rapides.

Les dictionnaires officiels et l’import/export du dictionnaire personnel se configurent dans l’application de bureau sous **Paramètres → Classificateur → Dictionnaires officiels**. Le service de dictionnaires peut être contacté si le créateur manque dans le cache ou si les contributions facultatives sont activées ; la recherche sur le Web a un consentement et des réglages de fournisseur distincts. Consultez le manuel de bureau et les déclarations.

La connexion au Classificateur indique le service Vault local de bureau. Configurez les groupes du Classificateur, les téléchargements de modèles, les Connaissances, le consentement à la recherche et les fournisseurs d’API dans l’application de bureau connectée.

Si les étiquettes manquent, vérifiez que l’application Vault de bureau est ouverte, que la connexion est établie, que l’étiquetage est activé, que le groupe du Classificateur concerné est repris et que son flux de plateforme est enregistré. Vérifiez le téléchargement du modèle dans l’application de bureau. Si le blocage ne s’applique pas, vérifiez l’activation, les cibles, les horaires, le temps autorisé et l’état de pause du groupe.
