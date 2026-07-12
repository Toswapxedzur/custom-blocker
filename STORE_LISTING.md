# Chrome Web Store listing source

This is the English source for the current Manifest V3 extension. Verify it against `manifest.json` before publishing a new store build.

## Extension name

```text
Adamancia Vault
```

## Short description

```text
Block websites, limit time on them, filter supported feeds, and build focused browser routines.
```

## Detailed description

```text
Adamancia Vault is a browser focus tool built around independent block groups.

Create a website blocklist or allowlist, give a site a time allowance, or start a countdown that blocks after it reaches zero. Use dedicated groups for YouTube, TikTok, Facebook, Instagram, Twitch, Reddit, Discord, and Twitter / X when you need a platform-specific boundary instead of a whole-site block.

Every group can have its own schedule, freeze mode, snooze rules, and enabled state. Custom groups provide a JavaScript rule editor with syntax checking, run controls, templates, and a log feed. Rules run in the extension's controlled runtime.

The optional web-app bridge connects to a compatible native Vault hub. It only synchronizes groups that the user explicitly links.

Your configuration lives in the browser profile. The extension does not need an account to create or use block groups.
```

## Permission explanations

| Permission | Current purpose |
| --- | --- |
| `storage` | Save groups, settings, and local editor state. |
| `alarms` | Schedule background checks and time-based group updates. |
| `offscreen` | Run the controlled Custom-rule runtime where Chromium requires an offscreen document. |
| `tabs` | Read the active tab context needed to apply a group and show status. |
| `webNavigation` | Re-evaluate applicable groups after navigation. |
| `favicon` | Display website icons in the editor where available. |
| `<all_urls>` | Apply user-created website and platform rules to pages the user chooses to control. |

## Release checks

1. Run `./tests/run.sh`.
2. Update the manifest version only for the release commit.
3. Review the English manual and translation audit output.
4. Build the upload artifact from the reviewed commit.
5. Do not include source notes, test fixtures, or private development files in the upload artifact.
