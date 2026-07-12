# Kluisextensie

Vault-extensie is een Manifest V3-focustool voor Chromium-browsers. De huidige editor beheert websiteblokgroepen, ondersteunde platformgroepen, aangepaste JavaScript-groepen, schema's, bedieningselementen voor bevriezen en snoozen, en optionele web-app-bridge-links.

De broncode is het productcontract. In de Engelse in-app-handleiding op [manual/en.md](manual/en.md) worden de meegeleverde bedieningselementen uitgelegd; het vervangt de eerdere gekopieerde en machinaal vertaalde handleidingen.

## Huidige mogelijkheden

- Standaard websitegroepen met gedrag op de blokkeer- of toelatingslijst, optionele omleiding, onmiddellijke blokkering, toegestane tijd of aftellen.
- Speciale groepen voor YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord en Twitter/X.
- Platformspecifieke filters en optionele besturingselementen voor het verbergen van elementen waar het huidige platformprofiel deze ondersteunt.
- Aangepaste JavaScript-groepen met syntaxiscontrole, sjablonen, runcontroles, een gecontroleerde runtime en een logfeed.
- Schema's per groep, bevriezingsmodi, snooze-bediening, import/export en automatisch opslaan.
- Optionele toegang tot lokale mappen voor ondersteunde tekst-, CSV- en JSON-bewerkingen op maat.
- Optionele verbinding met een native Vault-bridgehub voor expliciet gekoppelde groepen.

## Lokaal uitvoeren

1. Open `chrome://extensions` in een Chromium-browser.
2. Schakel **Ontwikkelaarsmodus** in.
3. Selecteer **Uitgepakt laden** en kies deze repositorymap.
4. Open de Vault-extensie en maak een groep aan.

Het manifest vereist Chrome 116 of hoger voor de huidige offscreen- en regel-API's.

## Ontwikkelingscontroles

Voer de extensietestsuite uit vanuit deze map:

```bash
./tests/run.sh
```

De suite oefent helpergedrag, platformprofielen, Markdown-weergave en de audit van de vertaalcatalogus uit.

## Gelokaliseerde handleidingen en vertalingen

De Engelse documenten blijven de canonieke bron. De extensie verzendt de gelokaliseerde handleidingen naast `manual/en.md`, en de gelokaliseerde kopieën van andere bijgehouden documenten staan ​​onder `i18n-docs/<locale>/`.

De UI-catalogi in `translation/*.json` zijn compleet voor elke ondersteunde landinstelling. Verifieer de catalogi en gelokaliseerde documenten met:

```bash
node scripts/translation-audit.js
node scripts/documentation-audit.js
```

## Reikwijdte

De Vault-extensie werkt alleen in het browserprofiel waar deze is geïnstalleerd en op pagina's waartoe de browser toegang verleent. Het installeert geen native apps, wijzigt geen systeemrechten of synchroniseert geen groepen, tenzij de gebruiker expliciet een brug verbindt en overeenkomende groepen koppelt.
