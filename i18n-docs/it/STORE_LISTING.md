# Origine dell'elenco del Chrome Web Store

Questa è la fonte inglese per l'attuale estensione Manifest V3. Verificalo con `manifest.json` prima di pubblicare una nuova build del negozio.

## Nome dell'estensione

```text
Adamancia Vault
```

## Breve descrizione

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## Descrizione dettagliata

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## Spiegazioni sui permessi

| Autorizzazione | Scopo attuale |
| --- | --- |
| `storage` | Salva gruppi, impostazioni e stato dell'editor locale. |
| `alarms` | Pianifica controlli in background e aggiornamenti di gruppo basati sul tempo. |
| `offscreen` | Esegui il runtime controllato con regole personalizzate in cui Chromium richiede un documento fuori schermo. |
| `tabs` | Leggere il contesto della scheda attiva necessario per applicare un gruppo e mostrare lo stato. |
| `webNavigation` | Rivalutare i gruppi applicabili dopo la navigazione. |
| `favicon` | Visualizza le icone del sito Web nell'editor, ove disponibile. |
| `<all_urls>` | Applica le regole del sito web e della piattaforma create dall'utente alle pagine che l'utente sceglie di controllare. |

## Rilascio controlli

1. Eseguire `./tests/run.sh`.
2. Aggiorna la versione manifest solo per il commit del rilascio.
3. Esaminare il manuale in inglese e i risultati dell'audit di traduzione.
4. Crea l'artefatto di caricamento dal commit esaminato.
5. Non includere note sulla fonte, dispositivi di test o file di sviluppo privati nell'elemento di caricamento.
