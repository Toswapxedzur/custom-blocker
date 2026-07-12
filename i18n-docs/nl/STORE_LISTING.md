# Chrome Web Store-vermeldingsbron

Dit is de Engelse bron voor de huidige Manifest V3-extensie. Verifieer het met `manifest.json` voordat u een nieuwe winkelbuild publiceert.

## Extensienaam

```text
Adamancia Vault
```

## Korte beschrijving

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## Gedetailleerde beschrijving

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## Toestemmingsverklaringen

| Toestemming | Huidig ​​doel |
| --- | --- |
| `storage` | Bewaar groepen, instellingen en lokale editorstatus. |
| `alarms` | Plan antecedentenonderzoeken en op tijd gebaseerde groepsupdates. |
| `offscreen` | Voer de gecontroleerde aangepaste regelruntime uit waarbij Chromium een ​​document buiten het scherm vereist. |
| `tabs` | Lees de actieve tabbladcontext die nodig is om een ​​groep toe te passen en de status weer te geven. |
| `webNavigation` | Evalueer de toepasselijke groepen opnieuw na navigatie. |
| `favicon` | Geef websitepictogrammen weer in de editor, indien beschikbaar. |
| `<all_urls>` | Pas door de gebruiker gemaakte website- en platformregels toe op pagina's die de gebruiker zelf wil beheren. |

## Vrijgavecontroles

1. Voer `./tests/run.sh` uit.
2. Werk de manifestversie alleen bij voor de release-commit.
3. Bekijk de Engelse handleiding en de output van de vertaalaudit.
4. Bouw het uploadartefact op basis van de beoordeelde commit.
5. Voeg geen bronnotities, testopstellingen of privé-ontwikkelingsbestanden toe aan het uploadartefact.
