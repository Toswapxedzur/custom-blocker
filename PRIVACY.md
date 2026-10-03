# Privacy Policy — Vault browser extension

_Last updated: 2026-10-04_

This policy describes Vault in supported Chromium browsers and Safari Vault. Blocking configuration and ordinary rule enforcement stay on your device. Tagging and Activity use a connected Mac Vault or Windows Vault app; those apps' research and dictionary features can make network requests described below and in their own policies.

## Local storage and collection

The extension stores blocking groups, targets, schedules, allowance usage, snooze/freeze state, custom rules, bounded rule logs and preferences in local extension storage. Safari's containing app also keeps native rule state and user-selected folder grants locally. Linked Vault programs exchange supported settings and usage through an authenticated device-local bridge; this is not cloud sync.

The connected desktop app controls recording in **Activity → Recording**, global tagging in **Settings → Classifier**, and each Classifier group's pause state. Recording a supported platform feed can collect visible public content metadata: source identifiers and names, canonical URLs, titles, descriptions, content types, duration and displayed public counts. Enabled app/website recording and retention are controlled in Activity. Pausing tagging does not itself stop recording. The extension has no separate collection or tagging switch.

Collected evidence and corrections are sent over the authenticated local connection to the desktop app. The app retains its local cache and Activity records according to your configured limits. The extension does not send that evidence directly to a model provider or Vault's website.

## Desktop app network features

Local model inference runs on the desktop device. Requested model downloads contact the model hosting source. Consented web research contacts your configured provider with sanitized public subjects; provider connection tests and model-list requests also contact that provider. API keys are stored locally and authenticate provider requests.

Official dictionary checks, downloads and creator cache misses contact Vault's dictionary service. A creator cache miss sends the public, platform-scoped source ID. Full-download creator lookup is local. Personal descriptions take priority over official definitions.

**Help improve the creator dictionary** is on by default, disclosed before the first contribution, and can be disabled in **Settings → Classifier**. Enabled contributions send sampled missing public creator IDs and public follower/subscriber counts, not titles, browsing history, personal definitions, API keys or persistent device/user identifiers. Disabling cancels pending contributions and stops future ones, without recalling requests already received. Read the desktop policy and disclosure for limits and retention.

## AI connections (MCP)

Mac Vault and Windows Vault start authenticated local MCP endpoints and automatically configure supported AI clients detected on the device. Manage these clients in the desktop app's AI connections window. The extension serves supported browser requests through its authenticated local connection; Safari uses its native containing app connection.

Connected clients can read configuration, usage, Activity, supported page evidence and Classifier data, and perform supported actions subject to Vault's normal policy and freeze gates. There is no separate approval prompt for every tool call. PINs and provider API keys cannot be read back through MCP. Data received by an AI client follows that client's privacy policy and may be sent to a remote provider. Vault's local bridge is not itself a cloud transport.

## Permissions

| Permission | Purpose |
| --- | --- |
| `storage` | Persist extension configuration, preferences and runtime state locally. |
| `favicon` | Display browser-cached website icons in Chromium. |
| `nativeMessaging` | Authenticate Chromium's device-local connection; route Safari's native rules, folder operations and desktop bridge. |
| `alarms` | Refresh schedules, allowance state, snoozes and freezes. |
| `offscreen` | Host Chromium's isolated custom-rule runtime. |
| `tabs` | Open the editor and inspect supported tab identities for configured policy and tools. |
| `webNavigation` | Recognize in-page navigation and refresh policy/collectors. |
| Website access | Apply configured policy and collect enabled supported-platform evidence. Safari requests HTTP/HTTPS access. |
| `unlimitedStorage` in Safari | Avoid local WebKit storage quota failures; it adds no website or filesystem access. |

## Custom rules and selected folders

Rules run in an isolated runtime through Vault's supported API, with execution and output limits. They do not receive unrestricted page or network access. Browser rules can affect configured pages through supported actions; native rules run in Safari's containing app. File operations are restricted to folders you explicitly select and authorize. Rule source and state stay local unless you export them or provide them to an AI client.

## What Vault does not collect

Vault has no account, cross-device cloud sync, advertising profile, analytics tracker or crash reporter. Ordinary enforcement does not upload browsing history or your configuration. Content collectors do not read form inputs or passwords. Enabled Activity recording, research, dictionary requests and AI-client processing are the specific data flows described above; hosting/network providers process their associated requests.

## Website and contact

The website has its own privacy policy. Its demos use fictional data and do not connect to your installed Vault configuration. For privacy questions, use the public source repository or the contact channel on the Vault website.
